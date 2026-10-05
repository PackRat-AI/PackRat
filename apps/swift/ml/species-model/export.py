"""Converts the trained student to the Core ML model bundled in the app.

Run from this directory after train.py:
    uv run python export.py --pack ../../Resources/SpeciesPacks/core.json

The output is a classifier model: its class labels are the pack's species ids
plus `__other__`, so the app reads labels straight off Vision's
`VNClassificationObservation`s and never has to know the output order.
Weights are palettized to 8 bits (6 measurably cost accuracy; 8 did not),
then the compressed model is re-scored on the validation split so a
compression loss shows up here and not on a trail.
"""

import argparse
import json
import shutil
from pathlib import Path

import coremltools as ct
import coremltools.optimize.coreml as cto
import timm
import torch
from PIL import Image

from dataset import OTHER_CLASS, class_labels, load_pack, load_rows, open_image
from train import ARTIFACTS, MEAN, STD

OUTPUT = Path('../../Resources/SpeciesModels/WildlifeSpeciesModel.mlpackage')


class Deployable(torch.nn.Module):
    """Takes a 0–1 RGB image, returns probabilities.

    ImageNet normalisation has a different std per channel, which Core ML's
    image input cannot express (it takes one scale), so it lives in the graph.
    """

    def __init__(self, model: torch.nn.Module):
        super().__init__()
        self.model = model
        self.register_buffer('mean', torch.tensor(MEAN).view(1, 3, 1, 1))
        self.register_buffer('std', torch.tensor(STD).view(1, 3, 1, 1))

    def forward(self, image: torch.Tensor) -> torch.Tensor:
        return torch.softmax(self.model((image - self.mean) / self.std), dim=-1)


def center_crop(image: Image.Image) -> Image.Image:
    # Mirrors Vision's `.centerCrop` option the app uses.
    side = min(image.size)
    left, top = (image.width - side) // 2, (image.height - side) // 2
    return image.crop((left, top, left + side, top + side)).resize((224, 224), Image.BILINEAR)


def score(model: ct.models.MLModel, rows: list[dict]) -> tuple[float, float]:
    correct = species_correct = species_total = 0
    for row in rows:
        prediction = model.predict({'image': center_crop(open_image(row))})['classLabel']
        correct += int(prediction == row['label'])
        if row['label'] != OTHER_CLASS:
            species_total += 1
            species_correct += int(prediction == row['label'])
    return correct / max(len(rows), 1), species_correct / max(species_total, 1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--pack', type=Path, required=True)
    parser.add_argument('--bits', type=int, default=8)
    args = parser.parse_args()

    pack = load_pack(args.pack)
    checkpoint = torch.load(ARTIFACTS / 'student.pt')
    labels = checkpoint['labels']
    if labels != class_labels(pack):
        raise SystemExit('Checkpoint labels do not match the pack; retrain against this pack.')

    student = timm.create_model(checkpoint['student'], pretrained=False, num_classes=len(labels))
    student.load_state_dict(checkpoint['state_dict'])
    model = Deployable(student).eval()
    traced = torch.jit.trace(model, torch.rand(1, 3, 224, 224))

    mlmodel = ct.convert(
        traced,
        inputs=[ct.ImageType(name='image', shape=(1, 3, 224, 224), scale=1 / 255.0, color_layout=ct.colorlayout.RGB)],
        classifier_config=ct.ClassifierConfig(labels),
        minimum_deployment_target=ct.target.iOS17,
        convert_to='mlprogram',
    )
    full_rows = load_rows(labels, 'val')
    full_accuracy, full_species = score(mlmodel, full_rows)

    config = cto.OptimizationConfig(global_config=cto.OpPalettizerConfig(mode='kmeans', nbits=args.bits))
    compressed = cto.palettize_weights(mlmodel, config)
    accuracy, species_accuracy = score(compressed, full_rows)

    compressed.short_description = 'PackRat on-device species classifier (MobileNetV4 distilled from BioCLIP 2)'
    compressed.license = 'Trained on CC0 and CC-BY iNaturalist imagery; teacher BioCLIP 2 (MIT).'
    compressed.user_defined_metadata['packId'] = pack['id']
    compressed.user_defined_metadata['packVersion'] = str(pack['version'])
    compressed.user_defined_metadata['labels'] = json.dumps(labels)

    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    compressed.save(str(OUTPUT))
    size = sum(f.stat().st_size for f in OUTPUT.rglob('*') if f.is_file()) / 1e6
    print(
        f'float16: top-1 {full_accuracy:.3f} (species {full_species:.3f}) · '
        f'{args.bits}-bit: top-1 {accuracy:.3f} (species {species_accuracy:.3f}) · '
        f'{size:.1f} MB · {len(full_rows)} val images'
    )


if __name__ == '__main__':
    main()
