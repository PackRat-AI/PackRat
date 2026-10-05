"""Downloads licence-clean training imagery for every species in a pack.

Run from this directory:
    uv run python fetch_images.py --pack ../../Resources/SpeciesPacks/core.json

Only CC0 and CC-BY photos are fetched. CC-BY-NC is excluded because PackRat Pro
is a paid subscription, which makes the app a commercial use — see
docs/features/offline-wildlife-id.md. The licence is checked per photo, not per
observation, because one observation can carry photos under different terms.

Alongside the species classes, an `__other__` class is filled with random
research-grade observations of taxa *not* in the pack. Without it a closed-set
classifier has to spread all of its probability over the species it knows, so
a photo of something outside the pack still comes back as a confident match.
With it, "I don't know this one" is a thing the model can say.

Every downloaded photo is recorded in data/manifest.jsonl with its licence and
attribution, since CC-BY requires that the source stays traceable.
"""

import argparse
import json
import random
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

API = 'https://api.inaturalist.org/v1'
ALLOWED_LICENCES = frozenset({'cc0', 'cc-by'})
OTHER_CLASS = '__other__'
ICONIC_TAXA = 'Plantae,Aves,Mammalia,Fungi,Insecta,Reptilia,Amphibia,Arachnida,Mollusca'

session = requests.Session()
session.headers['User-Agent'] = 'PackRat species-model builder (developer@packratai.com)'


def api_get(path: str, params: dict) -> dict:
    # iNaturalist asks for roughly one request per second.
    for attempt in range(6):
        time.sleep(1.1)
        try:
            response = session.get(f'{API}{path}', params=params, timeout=60)
        except requests.RequestException:
            time.sleep(10 * (attempt + 1))
            continue
        if response.status_code == 200:
            return response.json()
        time.sleep(10 * (attempt + 1))
    raise SystemExit(f'iNaturalist kept failing on {path}; re-run to resume')


def resolve_taxon_id(scientific_name: str) -> int:
    results = api_get('/taxa', {'q': scientific_name, 'per_page': 10})['results']
    for taxon in results:
        if taxon['name'].lower() == scientific_name.lower():
            return taxon['id']
    raise SystemExit(f'No exact iNaturalist taxon for {scientific_name!r}')


def clean_photo(observation: dict) -> dict | None:
    """First photo on the observation that carries an allowed licence."""
    for photo in observation.get('photos', []):
        if (photo.get('license_code') or '').lower() in ALLOWED_LICENCES and photo.get('url'):
            return {
                'observation_id': observation['id'],
                'photo_id': photo['id'],
                'licence': photo['license_code'].lower(),
                'attribution': photo.get('attribution', ''),
                'url': photo['url'].replace('/square.', '/medium.'),
                'taxon': observation.get('taxon', {}).get('name', ''),
            }
    return None


def collect(params: dict, limit: int) -> list[dict]:
    photos: list[dict] = []
    seen: set[int] = set()
    id_above = params.pop('id_above', 0)
    while len(photos) < limit:
        page = api_get(
            '/observations',
            {
                **params,
                'quality_grade': 'research',
                'photo_license': 'cc0,cc-by',
                'per_page': 200,
                'order_by': 'id',
                'order': 'asc',
                'id_above': id_above,
            },
        )
        results = page['results']
        if not results:
            break
        for observation in results:
            id_above = max(id_above, observation['id'])
            if observation['id'] in seen:
                continue
            seen.add(observation['id'])
            photo = clean_photo(observation)
            if photo:
                photos.append(photo)
    return photos[:limit]


def collect_spread(params: dict, limit: int) -> list[dict]:
    """Samples across the whole id range instead of only the oldest records.

    Ordering by id and taking the first N would train only on observations
    from iNaturalist's early years: older cameras, fewer regions. Starting at
    a few random points between the oldest and newest id spreads the sample
    over time.
    """
    bounds = [
        api_get(
            '/observations',
            {
                **params,
                'quality_grade': 'research',
                'photo_license': 'cc0,cc-by',
                'per_page': 1,
                'order_by': 'id',
                'order': order,
            },
        )['results']
        for order in ('asc', 'desc')
    ]
    if not bounds[0]:
        return []
    low, high = bounds[0][0]['id'], bounds[1][0]['id']
    slices = 4
    starts = sorted(random.randint(low, high) for _ in range(slices - 1))
    per_slice = -(-limit // slices)
    photos: list[dict] = []
    for floor in [low - 1, *starts]:
        photos += collect({**params, 'id_above': floor}, per_slice)
    unique = {photo['photo_id']: photo for photo in photos}
    return list(unique.values())[:limit]


def download(item: tuple[Path, dict]) -> bool:
    path, photo = item
    if path.exists():
        return True
    for _ in range(3):
        try:
            response = session.get(photo['url'], timeout=60)
            if response.status_code == 200 and response.content:
                path.write_bytes(response.content)
                return True
        except requests.RequestException:
            time.sleep(2)
    return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--pack', type=Path, required=True)
    parser.add_argument('--per-species', type=int, default=400)
    parser.add_argument('--other', type=int, default=3000)
    parser.add_argument('--out', type=Path, default=Path('data'))
    parser.add_argument('--seed', type=int, default=7)
    args = parser.parse_args()
    random.seed(args.seed)

    pack = json.loads(args.pack.read_text())
    manifest_path = args.out / 'manifest.jsonl'
    existing = {
        (row['label'], row['photo_id'])
        for row in map(json.loads, manifest_path.read_text().splitlines())
    } if manifest_path.exists() else set()
    done_labels = {label for label, _ in existing}

    taxon_ids: list[int] = []
    for species in pack['species']:
        taxon_id = resolve_taxon_id(species['scientificName'])
        taxon_ids.append(taxon_id)
        if species['id'] in done_labels:
            continue
        photos = collect_spread({'taxon_id': taxon_id}, args.per_species)
        save(species['id'], photos, args.out)

    if OTHER_CLASS not in done_labels:
        params = {'iconic_taxa': ICONIC_TAXA, 'without_taxon_id': ','.join(map(str, taxon_ids))}
        save(OTHER_CLASS, collect_spread(params, args.other), args.out)


def save(label: str, photos: list[dict], out: Path) -> None:
    """Downloads one class and appends it to the manifest.

    One class at a time, so an interrupted run resumes from the next class
    instead of starting over.
    """
    label_dir = out / 'images' / label
    label_dir.mkdir(parents=True, exist_ok=True)
    rows = [
        {**photo, 'label': label, 'path': f"images/{label}/{photo['photo_id']}.jpg"}
        for photo in photos
    ]
    with ThreadPoolExecutor(max_workers=12) as pool:
        ok = list(pool.map(download, [(out / row['path'], row) for row in rows]))
    with (out / 'manifest.jsonl').open('a') as manifest:
        for row, succeeded in zip(rows, ok, strict=True):
            if succeeded:
                manifest.write(json.dumps(row) + '\n')
    print(f'{label}: {sum(ok)}/{len(rows)} photos', flush=True)


if __name__ == '__main__':
    main()
