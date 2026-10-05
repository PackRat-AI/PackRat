"""Distils BioCLIP 2 into a MobileNetV4 student sized for a phone.

Run from this directory after teacher.py:
    uv run python train.py --pack ../../Resources/SpeciesPacks/core.json

Loss is the hard label plus the teacher's softened distribution over the
pack's species. The teacher has no opinion on `__other__` (it was only asked
about pack species), so the distillation term covers species images only and
the catch-all class learns from its hard label alone.
"""

import argparse
import math
from collections import Counter
from pathlib import Path

import timm
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import transforms

from dataset import DATA_DIR, OTHER_CLASS, ManifestDataset, class_labels, load_pack, load_rows

STUDENT = 'mobilenetv4_conv_small.e2400_r224_in1k'
MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)
ARTIFACTS = Path('artifacts')


def evaluation_transform():
    return transforms.Compose(
        [
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(MEAN, STD),
        ]
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--pack', type=Path, required=True)
    parser.add_argument('--epochs', type=int, default=25)
    parser.add_argument('--batch', type=int, default=64)
    parser.add_argument('--lr', type=float, default=1e-3)
    parser.add_argument('--temperature', type=float, default=2.0)
    parser.add_argument('--distill-weight', type=float, default=0.5)
    args = parser.parse_args()

    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    pack = load_pack(args.pack)
    labels = class_labels(pack)
    species_count = len(labels) - 1
    other_index = labels.index(OTHER_CLASS)
    teacher = torch.load(DATA_DIR / 'teacher_logits.pt')

    train_rows = load_rows(labels, 'train')
    val_rows = load_rows(labels, 'val')
    train_transform = transforms.Compose(
        [
            transforms.RandomResizedCrop(224, scale=(0.35, 1.0)),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(0.3, 0.3, 0.2, 0.03),
            transforms.ToTensor(),
            transforms.Normalize(MEAN, STD),
        ]
    )
    train_set = ManifestDataset(train_rows, labels, train_transform, teacher)
    val_set = ManifestDataset(val_rows, labels, evaluation_transform())

    # Class-balanced sampling: the catch-all class has several times more
    # photos than any species, and without balancing the cheapest way to
    # lower the loss is to answer "other" more often.
    counts = Counter(row['label'] for row in train_rows)
    weights = [1.0 / counts[row['label']] for row in train_rows]
    sampler = WeightedRandomSampler(weights, num_samples=len(train_rows), replacement=True)
    train_loader = DataLoader(train_set, batch_size=args.batch, sampler=sampler, num_workers=6, persistent_workers=True)
    val_loader = DataLoader(val_set, batch_size=args.batch, num_workers=4)

    model = timm.create_model(STUDENT, pretrained=True, num_classes=len(labels)).to(device)
    optimiser = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.05)
    steps = args.epochs * len(train_loader)
    warmup = len(train_loader)
    scheduler = torch.optim.lr_scheduler.LambdaLR(
        optimiser,
        lambda step: min(1.0, (step + 1) / warmup) * 0.5 * (1 + math.cos(math.pi * min(step, steps) / steps)),
    )

    ARTIFACTS.mkdir(exist_ok=True)
    best = 0.0
    temperature = args.temperature
    for epoch in range(args.epochs):
        model.train()
        for images, targets, teacher_logits in train_loader:
            images, targets, teacher_logits = images.to(device), targets.to(device), teacher_logits.to(device)
            logits = model(images)
            loss = F.cross_entropy(logits, targets, label_smoothing=0.1)
            is_species = targets != other_index
            if is_species.any():
                student = F.log_softmax(logits[is_species, :species_count] / temperature, dim=-1)
                target = F.softmax(teacher_logits[is_species] / temperature, dim=-1)
                distill = F.kl_div(student, target, reduction='batchmean') * temperature**2
                loss = (1 - args.distill_weight) * loss + args.distill_weight * distill
            optimiser.zero_grad()
            loss.backward()
            optimiser.step()
            scheduler.step()

        accuracy, species_accuracy, other_recall = evaluate(model, val_loader, device, other_index)
        print(
            f'epoch {epoch + 1}: val top-1 {accuracy:.3f} · species {species_accuracy:.3f} '
            f'· other recall {other_recall:.3f}',
            flush=True,
        )
        if accuracy > best:
            best = accuracy
            torch.save({'state_dict': model.state_dict(), 'labels': labels, 'student': STUDENT}, ARTIFACTS / 'student.pt')
    print(f'best val top-1 {best:.3f}')


@torch.no_grad()
def evaluate(model, loader, device, other_index: int) -> tuple[float, float, float]:
    model.eval()
    hits = Counter()
    for images, targets in loader:
        predictions = model(images.to(device)).argmax(dim=-1).cpu()
        for prediction, target in zip(predictions.tolist(), targets.tolist(), strict=True):
            bucket = 'other' if target == other_index else 'species'
            hits[f'{bucket}_total'] += 1
            hits[f'{bucket}_correct'] += int(prediction == target)
    total = hits['species_total'] + hits['other_total']
    return (
        (hits['species_correct'] + hits['other_correct']) / max(total, 1),
        hits['species_correct'] / max(hits['species_total'], 1),
        hits['other_correct'] / max(hits['other_total'], 1),
    )


if __name__ == '__main__':
    main()
