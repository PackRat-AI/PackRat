"""Scores saved student checkpoints on the current validation split.

Run from this directory:
    uv run python compare.py --pack ../../Resources/SpeciesPacks/core.json artifacts/a.pt artifacts/b.pt

The validation split grows whenever the dataset does (harder negatives, more
species photos), so a number from an older training log is not comparable to
a new one. This re-scores every checkpoint on the same images, overall and per
negative source, so "did the new model close the gap" has a like-for-like answer.
"""

import argparse
from collections import defaultdict
from pathlib import Path

import timm
import torch
from torch.utils.data import DataLoader

from dataset import OTHER_CLASS, ManifestDataset, class_labels, load_pack, load_rows
from train import evaluate, evaluation_transform, format_metrics


def source_group(row: dict) -> str:
    source = row.get('source', '')
    return source.split(':')[0] if source else 'random'


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--pack', type=Path, required=True)
    parser.add_argument('checkpoints', type=Path, nargs='+')
    args = parser.parse_args()

    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    labels = class_labels(load_pack(args.pack))
    other_index = labels.index(OTHER_CLASS)
    rows = load_rows(labels, 'val')
    species_rows = [row for row in rows if row['label'] != OTHER_CLASS]
    groups = defaultdict(list)
    for row in rows:
        if row['label'] == OTHER_CLASS:
            groups[source_group(row)].append(row)

    for path in args.checkpoints:
        checkpoint = torch.load(path)
        model = timm.create_model(checkpoint['student'], pretrained=False, num_classes=len(labels))
        model.load_state_dict(checkpoint['state_dict'])
        model = model.to(device)

        def score(subset: list[dict]) -> dict[str, float]:
            loader = DataLoader(ManifestDataset(subset, labels, evaluation_transform()), batch_size=64, num_workers=4)
            return evaluate(model, loader, device, other_index)

        print(f'{path} ({checkpoint["student"]})')
        print(f'  all: {format_metrics(score(rows))}')
        for group, subset in sorted(groups.items()):
            metrics = score(subset)
            print(
                f"  other/{group} ({len(subset)}): recall {metrics['other_recall']:.3f} "
                f"· named confidently {metrics['other_confident']:.3f}"
            )


if __name__ == '__main__':
    main()
