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
    # Autocomplete matches names exactly where /taxa?q= ranks by popularity,
    # which can push a common binomial (Bubo bubo) off the first page.
    for path in ('/taxa/autocomplete', '/taxa'):
        results = api_get(path, {'q': scientific_name, 'per_page': 30})['results']
        matches = [taxon for taxon in results if taxon['name'].lower() == scientific_name.lower()]
        matches.sort(key=lambda taxon: not taxon.get('is_active', True))
        if matches:
            return matches[0]['id']
    raise SystemExit(f'No exact iNaturalist taxon for {scientific_name!r}')


def clean_photos(observation: dict, every: bool = False) -> list[dict]:
    """Photos on the observation that carry an allowed licence.

    Only the first by default. `every` takes them all, for species with few
    clean observations; extra angles of one animal are still real signal, and
    the observation-level split keeps them on one side of validation.
    """
    photos = [
        {
            'observation_id': observation['id'],
            'photo_id': photo['id'],
            'licence': photo['license_code'].lower(),
            'attribution': photo.get('attribution', ''),
            'url': photo['url'].replace('/square.', '/medium.'),
            'taxon': observation.get('taxon', {}).get('name', ''),
        }
        for photo in observation.get('photos', [])
        if (photo.get('license_code') or '').lower() in ALLOWED_LICENCES and photo.get('url')
    ]
    return photos if every else photos[:1]


def collect(params: dict, limit: int, every: bool = False) -> list[dict]:
    photos: list[dict] = []
    seen: set[int] = set()
    id_above = params.pop('id_above', 0)
    while len(photos) < limit:
        page = api_get(
            '/observations',
            {
                'quality_grade': 'research',
                **params,
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
            photos += clean_photos(observation, every)
    return photos[:limit]


def collect_spread(params: dict, limit: int, slices: int = 4, every: bool = False) -> list[dict]:
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
                'quality_grade': 'research',
                **params,
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
    starts = sorted(random.randint(low, high) for _ in range(slices - 1))
    per_slice = -(-limit // slices)
    photos: list[dict] = []
    for floor in [low - 1, *starts]:
        photos += collect({**params, 'id_above': floor}, per_slice, every)
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
    parser.add_argument('--lookalikes', type=Path, default=Path('lookalikes.json'))
    parser.add_argument('--per-lookalike', type=int, default=150)
    parser.add_argument('--other-wide', type=int, default=4000)
    parser.add_argument('--domestic', type=Path, default=Path('domestic.json'))
    args = parser.parse_args()
    random.seed(args.seed)

    pack = json.loads(args.pack.read_text())
    manifest_path = args.out / 'manifest.jsonl'
    existing = {
        (row['label'], row['photo_id'])
        for row in map(json.loads, manifest_path.read_text().splitlines())
    } if manifest_path.exists() else set()
    done_labels = {label for label, _ in existing} | {
        f"{row['label']}+{row['source']}"
        for row in map(json.loads, manifest_path.read_text().splitlines())
        if row.get('source')
    } if manifest_path.exists() else set()

    taxon_ids: list[int] = []
    for species in pack['species']:
        taxon_id = resolve_taxon_id(species['scientificName'])
        taxon_ids.append(taxon_id)
        if species['id'] in done_labels:
            continue
        photos = collect_spread({'taxon_id': taxon_id}, args.per_species)
        save(species['id'], photos, args.out)

    for species, taxon_id in zip(pack['species'], taxon_ids, strict=True):
        # Classes that came up short take every clean photo per observation.
        have = sum(1 for label, _ in existing if label == species['id'])
        if have < args.per_species and species['id'] in done_labels and f"{species['id']}+all" not in done_labels:
            photos = collect_spread({'taxon_id': taxon_id}, args.per_species * 3, every=True)
            save(species['id'], photos, args.out, existing, source='all')

    params = {'iconic_taxa': ICONIC_TAXA, 'without_taxon_id': ','.join(map(str, taxon_ids))}
    if OTHER_CLASS not in done_labels:
        save(OTHER_CLASS, collect_spread(params, args.other), args.out)

    # Lookalikes are the out-of-pack subjects most likely to be named as a
    # pack species, so they are the negatives that matter most: a hiker's
    # Omphalotus must not come back as a chanterelle.
    lookalikes = sorted({name for names in json.loads(args.lookalikes.read_text()).values() for name in names})
    for name in lookalikes:
        if f'{OTHER_CLASS}+lookalike:{name}' in done_labels:
            continue
        try:
            taxon_id = resolve_taxon_id(name)
        except SystemExit as error:
            print(error, flush=True)
            continue
        photos = collect_spread({'taxon_id': taxon_id}, args.per_lookalike)
        save(OTHER_CLASS, photos, args.out, existing, source=f'lookalike:{name}')

    # Pets, livestock, houseplants and garden plants are what a phone is
    # most often pointed at, and iNaturalist marks captive or cultivated
    # organisms casual, so the research-grade sample above never sees them.
    for name in json.loads(args.domestic.read_text()):
        if f'{OTHER_CLASS}+domestic:{name}' in done_labels:
            continue
        try:
            taxon_id = resolve_taxon_id(name)
        except SystemExit as error:
            print(error, flush=True)
            continue
        photos = collect_spread({'taxon_id': taxon_id, 'quality_grade': 'casual,research'}, args.per_lookalike)
        save(OTHER_CLASS, photos, args.out, existing, source=f'domestic:{name}')

    # Many short slices across the id range: four long runs of consecutive
    # observations over-sample whoever was uploading at the time.
    if f'{OTHER_CLASS}+wide' not in done_labels:
        save(OTHER_CLASS, collect_spread(params, args.other_wide, slices=80), args.out, existing, source='wide')


def save(label: str, photos: list[dict], out: Path, existing: set | None = None, source: str = '') -> None:
    """Downloads one batch and appends it to the manifest.

    One class (or one source within a class) at a time, so an interrupted run
    resumes from the next batch instead of starting over.
    """
    label_dir = out / 'images' / label
    label_dir.mkdir(parents=True, exist_ok=True)
    existing = existing if existing is not None else set()
    rows = [
        {**photo, 'label': label, 'path': f"images/{label}/{photo['photo_id']}.jpg", **({'source': source} if source else {})}
        for photo in photos
        if (label, photo['photo_id']) not in existing
    ]
    if not rows and source:
        # Record that the batch ran, so a resume does not fetch it again.
        rows_marker = {'label': label, 'source': source, 'photo_id': None, 'path': '', 'observation_id': 0}
        with (out / 'manifest.jsonl').open('a') as manifest:
            manifest.write(json.dumps(rows_marker) + '\n')
        return
    with ThreadPoolExecutor(max_workers=12) as pool:
        ok = list(pool.map(download, [(out / row['path'], row) for row in rows]))
    with (out / 'manifest.jsonl').open('a') as manifest:
        for row, succeeded in zip(rows, ok, strict=True):
            if succeeded:
                manifest.write(json.dumps(row) + '\n')
    existing.update((label, row['photo_id']) for row in rows)
    print(f"{label}{' ' + source if source else ''}: {sum(ok)}/{len(rows)} photos", flush=True)


if __name__ == '__main__':
    main()
