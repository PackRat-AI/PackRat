"""Distils BioCLIP 2 into a MobileNetV4 student sized for a phone.

Run from this directory after teacher.py:
    uv run python train.py --pack ../../Resources/SpeciesPacks/core.json

Loss is the hard label plus the teacher's softened distribution over the
pack's species. The teacher has no opinion on `__other__` (it was only asked
about pack species), so the distillation term covers species images only and
the catch-all class learns from its hard label alone.

A third term aligns the student's pooled features (through a projection head
that is dropped at export) with BioCLIP 2's image embedding. That one covers
every image, `__other__` included, and carries far more of what the teacher
knows than a 22-way distribution does.
"""

import argparse
import math
import time
from collections import Counter
from pathlib import Path

import timm
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import transforms

from dataset import DATA_DIR, OTHER_CLASS, ManifestDataset, class_labels, load_pack, load_rows

STUDENT = 'mobilenetv4_conv_medium.e500_r256_in1k'
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
    parser.add_argument('--lr', type=float, default=4e-4)
    parser.add_argument('--temperature', type=float, default=2.0)
    parser.add_argument('--distill-weight', type=float, default=0.5)
    parser.add_argument('--embed-weight', type=float, default=1.0)
    parser.add_argument('--student', default=STUDENT)
    parser.add_argument('--other-share', type=float, default=0.2)
    parser.add_argument('--samples-per-epoch', type=int, default=0)
    args = parser.parse_args()

    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    pack = load_pack(args.pack)
    labels = class_labels(pack)
    species_count = len(labels) - 1
    other_index = labels.index(OTHER_CLASS)
    teacher = torch.load(DATA_DIR / 'teacher_logits.pt')
    teacher_embeddings = torch.load(DATA_DIR / 'teacher_embeddings.pt')

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
    train_set = ManifestDataset(train_rows, labels, train_transform, teacher, teacher_embeddings)
    val_set = ManifestDataset(val_rows, labels, evaluation_transform())

    # Class-balanced sampling: the catch-all class has many times more
    # photos than any species, and without balancing the cheapest way to
    # lower the loss is to answer "other" more often. It still gets a larger
    # share than one species, because it has to cover everything else alive.
    counts = Counter(row['label'] for row in train_rows)
    species_share = (1 - args.other_share) / species_count
    weights = [
        (args.other_share if row['label'] == OTHER_CLASS else species_share) / counts[row['label']] for row in train_rows
    ]
    sampler = WeightedRandomSampler(weights, num_samples=args.samples_per_epoch or len(train_rows), replacement=True)
    train_loader = DataLoader(train_set, batch_size=args.batch, sampler=sampler, num_workers=6, persistent_workers=True)
    val_loader = DataLoader(val_set, batch_size=args.batch, num_workers=4)

    model = timm.create_model(args.student, pretrained=True, num_classes=len(labels)).to(device)
    embed_dim = next(iter(teacher_embeddings.values())).numel()
    projection = torch.nn.Linear(getattr(model, 'head_hidden_size', None) or model.num_features, embed_dim).to(device)
    optimiser = torch.optim.AdamW([*model.parameters(), *projection.parameters()], lr=args.lr, weight_decay=0.05)
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
        started = time.monotonic()
        model.train()
        projection.train()
        for images, targets, teacher_logits, teacher_embedding in train_loader:
            images, targets, teacher_logits = images.to(device), targets.to(device), teacher_logits.to(device)
            teacher_embedding = teacher_embedding.to(device).float()
            pooled = model.forward_head(model.forward_features(images), pre_logits=True)
            logits = model.get_classifier()(pooled)
            loss = F.cross_entropy(logits, targets, label_smoothing=0.1)
            is_species = targets != other_index
            if is_species.any():
                student = F.log_softmax(logits[is_species, :species_count] / temperature, dim=-1)
                target = F.softmax(teacher_logits[is_species] / temperature, dim=-1)
                distill = F.kl_div(student, target, reduction='batchmean') * temperature**2
                loss = (1 - args.distill_weight) * loss + args.distill_weight * distill
            alignment = 1 - F.cosine_similarity(projection(pooled), teacher_embedding, dim=-1).mean()
            loss = loss + args.embed_weight * alignment
            optimiser.zero_grad()
            loss.backward()
            optimiser.step()
            scheduler.step()

        metrics = evaluate(model, val_loader, device, other_index)
        print(f'epoch {epoch + 1} ({time.monotonic() - started:.0f}s): {format_metrics(metrics)}', flush=True)
        # Selected on the balance of the two failure modes, not raw top-1,
        # which the many species images would otherwise dominate.
        balanced = (metrics['species'] + metrics['other_recall']) / 2
        if balanced > best:
            best = balanced
            torch.save({'state_dict': model.state_dict(), 'labels': labels, 'student': args.student}, ARTIFACTS / 'student.pt')
    print(f'best balanced accuracy {best:.3f}')


def format_metrics(metrics: dict[str, float]) -> str:
    return (
        f"top-1 {metrics['top1']:.3f} · species {metrics['species']:.3f} · other recall {metrics['other_recall']:.3f} "
        f"· other named confidently {metrics['other_confident']:.3f}"
    )


# The app's `ConfidencePolicy.confident`: at or above it, a species is
# presented as the answer rather than a suggestion.
CONFIDENT = 0.65


@torch.no_grad()
def evaluate(model, loader, device, other_index: int) -> dict[str, float]:
    """Top-1 numbers plus the one that matters for safety: how often a subject
    outside the pack is shown as a confident species name."""
    model.eval()
    hits = Counter()
    for images, targets in loader:
        probabilities = torch.softmax(model(images.to(device)), dim=-1).cpu()
        species_probabilities = probabilities.clone()
        species_probabilities[:, other_index] = 0
        for prediction, best_species, target in zip(
            probabilities.argmax(dim=-1).tolist(), species_probabilities.max(dim=-1).values.tolist(), targets.tolist(), strict=True
        ):
            bucket = 'other' if target == other_index else 'species'
            hits[f'{bucket}_total'] += 1
            hits[f'{bucket}_correct'] += int(prediction == target)
            if bucket == 'other':
                hits['other_confident'] += int(best_species >= CONFIDENT)
    total = hits['species_total'] + hits['other_total']
    return {
        'top1': (hits['species_correct'] + hits['other_correct']) / max(total, 1),
        'species': hits['species_correct'] / max(hits['species_total'], 1),
        'other_recall': hits['other_correct'] / max(hits['other_total'], 1),
        'other_confident': hits['other_confident'] / max(hits['other_total'], 1),
    }


if __name__ == '__main__':
    main()
