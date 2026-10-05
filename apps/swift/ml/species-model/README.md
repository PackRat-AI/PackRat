# Species model

Builds `apps/swift/Resources/SpeciesModels/WildlifeSpeciesModel.mlpackage`, the
on-device recogniser behind offline wildlife ID. Design and licensing rules:
`docs/features/offline-wildlife-id.md`.

Run from this directory on an Apple Silicon Mac (training uses MPS):

```bash
uv sync
PACK=../../Resources/SpeciesPacks/core.json
uv run python fetch_images.py --pack $PACK   # CC0/CC-BY iNaturalist photos → data/ (incl. lookalikes.json, domestic.json negatives)
uv run python teacher.py --pack $PACK        # BioCLIP 2 soft labels
uv run python train.py --pack $PACK          # MobileNetV4 student → artifacts/
uv run python export.py --pack $PACK         # Core ML, 8-bit, re-scored
uv run python compare.py --pack $PACK artifacts/old.pt artifacts/student.pt  # like-for-like scores
```

The learning rate defaults to 4e-4; 1e-3 is unstable on the medium student. A 30-epoch run takes ~1h45 on an M1 Pro; give it a 2 h timeout.

`data/` and `artifacts/` are gitignored. `fetch_images.py` resumes by class
after an interruption.

Retrain whenever the pack's species list changes. The model's class labels
are the pack's species ids plus `__other__`, and a unit test fails if a pack
species has no label in the bundled model.
