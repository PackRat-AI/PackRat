"""Shared dataset plumbing for the teacher, training and export steps."""

import hashlib
import json
from pathlib import Path

from PIL import Image
from torch.utils.data import Dataset

OTHER_CLASS = '__other__'
DATA_DIR = Path('data')
VALIDATION_SHARE = 0.15


def load_pack(path: Path) -> dict:
    return json.loads(path.read_text())


def class_labels(pack: dict) -> list[str]:
    """Species ids in pack order, then the catch-all class last.

    The model's output order is this list, and the Core ML model carries it as
    its class labels, so the app never has to know the order separately.
    """
    return [species['id'] for species in pack['species']] + [OTHER_CLASS]


def is_validation(row: dict) -> bool:
    # Split by observation, not by photo, and by hash rather than shuffle, so
    # the split is stable across runs and two photos of one animal never land
    # on both sides.
    digest = hashlib.sha1(str(row['observation_id']).encode()).digest()
    return digest[0] / 256 < VALIDATION_SHARE


def load_rows(labels: list[str], split: str) -> list[dict]:
    wanted = set(labels)
    rows = [
        row
        for row in map(json.loads, (DATA_DIR / 'manifest.jsonl').read_text().splitlines())
        if row['label'] in wanted and row['path'] and (DATA_DIR / row['path']).exists()
    ]
    unique = {(row['label'], row['photo_id']): row for row in rows}.values()
    return [row for row in unique if is_validation(row) == (split == 'val')]


def open_image(row: dict) -> Image.Image:
    return Image.open(DATA_DIR / row['path']).convert('RGB')


class ManifestDataset(Dataset):
    def __init__(
        self, rows: list[dict], labels: list[str], transform, teacher: dict | None = None, embeddings: dict | None = None
    ):
        self.rows = rows
        self.embeddings = embeddings
        self.index = {label: i for i, label in enumerate(labels)}
        self.transform = transform
        self.teacher = teacher

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, i: int):
        row = self.rows[i]
        image = self.transform(open_image(row))
        target = self.index[row['label']]
        if self.teacher is None:
            return image, target
        if self.embeddings is None:
            return image, target, self.teacher[row['path']]
        return image, target, self.teacher[row['path']], self.embeddings[row['path']]
