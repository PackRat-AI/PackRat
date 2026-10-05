"""Scores every training image with BioCLIP 2, the teacher.

Run from this directory after fetch_images.py:
    uv run python teacher.py --pack ../../Resources/SpeciesPacks/core.json

BioCLIP 2 is far too large to ship (a ViT-L), but it knows the tree of life
much better than anything that fits on a phone. Its zero-shot distribution
over the pack's species is saved per image and used as the soft target the
student learns from, alongside the hard label. Its image embedding is saved
too: that is a teacher signal for every image, `__other__` included, where the
logits over pack species say nothing useful.

Weights: imageomics/bioclip-2, MIT licence, trained on CC0 TreeOfLife-200M.
"""

import argparse
from pathlib import Path

import open_clip
import torch

from dataset import DATA_DIR, OTHER_CLASS, class_labels, load_pack, load_rows, open_image

MODEL = 'hf-hub:imageomics/bioclip-2'


def prompts(species: dict) -> list[str]:
    # BioCLIP was trained on taxonomic and common names together; averaging
    # both phrasings is steadier than either alone.
    return [
        f"a photo of {species['scientificName']}.",
        f"a photo of {species['commonName']}.",
        f"a photo of {species['scientificName']} with common name {species['commonName']}.",
    ]


@torch.no_grad()
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--pack', type=Path, required=True)
    parser.add_argument('--batch', type=int, default=32)
    args = parser.parse_args()

    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    model, _, preprocess = open_clip.create_model_and_transforms(MODEL)
    tokenizer = open_clip.get_tokenizer(MODEL)
    model = model.to(device).eval()

    pack = load_pack(args.pack)
    labels = class_labels(pack)
    text_features = []
    for species in pack['species']:
        features = model.encode_text(tokenizer(prompts(species)).to(device))
        features = features / features.norm(dim=-1, keepdim=True)
        mean = features.mean(dim=0)
        text_features.append(mean / mean.norm())
    text_features = torch.stack(text_features)
    scale = model.logit_scale.exp()

    rows = load_rows(labels, 'train') + load_rows(labels, 'val')
    logits: dict[str, torch.Tensor] = {}
    embeddings: dict[str, torch.Tensor] = {}
    correct = total = 0
    for start in range(0, len(rows), args.batch):
        batch = rows[start : start + args.batch]
        images = torch.stack([preprocess(open_image(row)) for row in batch]).to(device)
        features = model.encode_image(images)
        features = features / features.norm(dim=-1, keepdim=True)
        batch_logits = (scale * features @ text_features.T).float().cpu()
        for row, row_logits, embedding in zip(batch, batch_logits, features.half().cpu(), strict=True):
            embeddings[row['path']] = embedding
            logits[row['path']] = row_logits
            if row['label'] != OTHER_CLASS:
                total += 1
                correct += int(labels[int(row_logits.argmax())] == row['label'])
        print(f'{start + len(batch)}/{len(rows)}', end='\r', flush=True)

    torch.save(logits, DATA_DIR / 'teacher_logits.pt')
    torch.save(embeddings, DATA_DIR / 'teacher_embeddings.pt')
    print(f'\nteacher zero-shot top-1 on pack species: {correct / max(total, 1):.3f} ({total} images)')


if __name__ == '__main__':
    main()
