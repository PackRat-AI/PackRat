#!/usr/bin/env bun

/**
 * Builds the bundled landscape grid behind Trip Stats' "Landscapes" card: one
 * byte per 0.05° cell (~5.5 km) saying whether a spot is desert, grassland,
 * forest, polar, mountain, coastal, or lakes and rivers.
 *
 * Sources:
 * - Köppen-Geiger climate classes, 1991-2020, 0.1° (Beck et al. 2023,
 *   https://doi.org/10.6084/m9.figshare.21789074, CC BY 4.0). Arid desert
 *   (BW) is desert, steppe (BS) and savanna (Aw) are grassland, tundra and ice
 *   cap (E) are polar at high latitude and mountain elsewhere (alpine), the
 *   rest is forest. Köppen is the usual proxy for biome at this scale.
 *   Its classes follow rainfall, so two named-region overrides correct the
 *   cases hikers notice: steppe inside a named desert or dry basin (Great
 *   Basin, Colorado Plateau) reads as desert, and the named grassland plains
 *   (Great Plains, Pampas, the steppes) read as grassland even where Köppen
 *   calls them humid.
 * - Natural Earth 1:10m (public domain): mountain ranges ("Range/mtn" in
 *   geography regions), glaciated areas, coastline, lakes, and river
 *   centerlines.
 *
 * Priority, highest first: coastal (land within one cell of the sea) → polar
 * → lake shores → mountain → rivers → desert / grassland / forest. Tundra and ice
 * are polar above the Arctic and Antarctic circles; below them they are
 * mountain inside a named range (Denali, the Alps) and polar on open ground.
 *
 * Stored run-length encoded per row, so the app reads ~1 MB of runs instead
 * of a 26 MB grid: for each row, a UInt16 run count, that many UInt16 last
 * columns, then that many UInt8 codes, all little-endian. The whole file is
 * raw DEFLATE, which is what Apple's `NSData.decompressed(using: .zlib)`
 * reads. Row 0 is the northern edge (90°N), column 0 is 180°W.
 *
 * Run from repo root:
 *   bun apps/swift/scripts/generate-landscapes.ts
 *
 * Output:
 *   apps/swift/Resources/Landscapes.bin
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { safeJsonParse } from '@packrat/utils';

const __dir = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dir, '../Resources/Landscapes.bin');

const NATURAL_EARTH =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const KOPPEN_ZIP = 'https://ndownloader.figshare.com/files/61012822';
const KOPPEN_TIF = '1991_2020/koppen_geiger_0p1.tif';

/** Cell size in degrees. Must match `LandscapeGrid.cellSize` in Swift. */
const CELL = 0.05;
const WIDTH = Math.round(360 / CELL);
const HEIGHT = Math.round(180 / CELL);

/** Byte values. Must match `TripLandscape.gridCode` in Swift. */
const Code = Object.freeze({
  none: 0,
  desert: 1,
  grassland: 2,
  forest: 3,
  polar: 4,
  mountain: 5,
  coastal: 6,
  water: 7,
} as const);

/** Tundra or ice on open ground counts as polar from here. */
const SUBPOLAR_LATITUDE = 60;
/** Always polar from here, mountains included. */
const POLAR_LATITUDE = 66;

/** Dry regions where Köppen steppe (BS) reads as desert. */
const DRY_REGIONS: ReadonlySet<string> = new Set(['GREAT BASIN', 'COLORADO PLATEAU']);
/** Plains where Köppen's humid classes are still open grassland. */
const GRASSLAND_REGIONS: ReadonlySet<string> = new Set([
  'GREAT PLAINS',
  'Llano Estacado',
  'PAMPAS',
  'PONTIC STEPPE',
  'KAZAKH STEPPE',
  'Serengeti Plains',
  'Masai Steppe',
  'Darling Downs',
  'Alföld',
]);

type Ring = number[][];
type Geometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] }
  | { type: 'LineString'; coordinates: Ring }
  | { type: 'MultiLineString'; coordinates: Ring[] };
interface Feature {
  properties: Record<string, string | number | null>;
  geometry: Geometry | null;
}

async function cachedFile({ url, name }: { url: string; name: string }): Promise<string> {
  const path = resolve(tmpdir(), name);
  if (!existsSync(path)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    writeFileSync(path, new Uint8Array(await response.arrayBuffer()));
  }
  return path;
}

async function naturalEarth(file: string): Promise<Feature[]> {
  const path = await cachedFile({ url: `${NATURAL_EARTH}/${file}`, name: file });
  return safeJsonParse<{ features: Feature[] }>(readFileSync(path, 'utf8')).features;
}

// MARK: - TIFF (tiled, 8-bit, LZW — the shape of the Köppen file)

function lzwDecode({ input, expected }: { input: Uint8Array; expected: number }): Uint8Array {
  const out = new Uint8Array(expected);
  let outPos = 0;
  let bitPos = 0;
  let codeLength = 9;
  let table: Uint8Array[] = [];
  const reset = () => {
    table = [];
    for (let i = 0; i < 256; i++) table.push(Uint8Array.of(i));
    table.push(new Uint8Array(0), new Uint8Array(0));
    codeLength = 9;
  };
  const read = (): number => {
    let code = 0;
    for (let i = 0; i < codeLength; i++) {
      const byte = input[(bitPos + i) >> 3] ?? 0;
      code = (code << 1) | ((byte >> (7 - ((bitPos + i) & 7))) & 1);
    }
    bitPos += codeLength;
    return code;
  };
  const write = (entry: Uint8Array) => {
    out.set(entry.subarray(0, Math.max(0, expected - outPos)), outPos);
    outPos += entry.length;
  };
  reset();
  let previous: Uint8Array | undefined;
  while (bitPos + codeLength <= input.length * 8 && outPos < expected) {
    const code = read();
    if (code === 257) break;
    if (code === 256) {
      reset();
      previous = undefined;
      continue;
    }
    let entry: Uint8Array;
    const known = table[code];
    if (known) entry = known;
    else if (previous) entry = Uint8Array.of(...previous, previous[0] ?? 0);
    else throw new Error('LZW: bad code');
    write(entry);
    if (previous) table.push(Uint8Array.of(...previous, entry[0] ?? 0));
    previous = entry;
    // TIFF LZW switches width one code early.
    if (table.length + 1 >= 1 << codeLength && codeLength < 12) codeLength++;
  }
  return out;
}

function readTiff(buffer: Uint8Array): { width: number; height: number; pixels: Uint8Array } {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const little = buffer[0] === 0x49;
  const u16 = (offset: number) => view.getUint16(offset, little);
  const u32 = (offset: number) => view.getUint32(offset, little);
  const ifd = u32(4);
  const tags = new Map<number, number[]>();
  for (let i = 0; i < u16(ifd); i++) {
    const entry = ifd + 2 + i * 12;
    const type = u16(entry + 2);
    const count = u32(entry + 4);
    const size = type === 3 ? 2 : 4;
    const base = count * size > 4 ? u32(entry + 8) : entry + 8;
    const values: number[] = [];
    for (let j = 0; j < count; j++) values.push(size === 2 ? u16(base + j * 2) : u32(base + j * 4));
    tags.set(u16(entry), values);
  }
  const tag = (id: number) => tags.get(id) ?? [];
  const [width = 0] = tag(256);
  const [height = 0] = tag(257);
  const [compression] = tag(259);
  const [tileWidth = 0] = tag(322);
  const [tileHeight = 0] = tag(323);
  if (compression !== 5 || !tileWidth) throw new Error('Expected a tiled LZW TIFF');
  const offsets = tag(324);
  const counts = tag(325);
  const across = Math.ceil(width / tileWidth);
  const pixels = new Uint8Array(width * height);
  offsets.forEach((offset, index) => {
    const tile = lzwDecode({
      input: buffer.subarray(offset, offset + (counts[index] ?? 0)),
      expected: tileWidth * tileHeight,
    });
    const x0 = (index % across) * tileWidth;
    const y0 = Math.floor(index / across) * tileHeight;
    for (let y = 0; y < tileHeight && y0 + y < height; y++) {
      for (let x = 0; x < tileWidth && x0 + x < width; x++) {
        pixels[(y0 + y) * width + x0 + x] = tile[y * tileWidth + x] ?? 0;
      }
    }
  });
  return { width, height, pixels };
}

async function koppen(): Promise<{ width: number; height: number; pixels: Uint8Array }> {
  const zip = await cachedFile({ url: KOPPEN_ZIP, name: 'koppen_geiger_tif.zip' });
  const tif = execFileSync('unzip', ['-p', zip, KOPPEN_TIF], { maxBuffer: 64 * 1024 * 1024 });
  return readTiff(new Uint8Array(tif));
}

/** Beck et al. class numbers: 1-3 A, 4-5 BW, 6-7 BS, 8-28 C/D, 29 ET, 30 EF. */
function climateCode({ koppenClass, latitude }: { koppenClass: number; latitude: number }): number {
  if (koppenClass === 0) return Code.none;
  if (koppenClass === 4 || koppenClass === 5) return Code.desert;
  if (koppenClass === 3 || koppenClass === 6 || koppenClass === 7) return Code.grassland;
  if (koppenClass >= 29)
    return Math.abs(latitude) >= SUBPOLAR_LATITUDE ? Code.polar : Code.mountain;
  return Code.forest;
}

// MARK: - Rasterising

const column = (lng: number) => Math.min(WIDTH - 1, Math.max(0, Math.floor((lng + 180) / CELL)));
const row = (lat: number) => Math.min(HEIGHT - 1, Math.max(0, Math.floor((90 - lat) / CELL)));
const latitudeOf = (r: number) => 90 - (r + 0.5) * CELL;

function polygons(geometry: Geometry | null): Ring[][] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function lines(geometry: Geometry | null): Ring[] {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

/** Even-odd scanline fill of one polygon (outer ring plus holes) at cell centres. */
function fillPolygon({ rings, mark }: { rings: Ring[]; mark: (index: number) => void }) {
  const lats = rings.flat().map(([, lat = 0]) => lat);
  const top = row(Math.max(...lats));
  const bottom = row(Math.min(...lats));
  for (let r = top; r <= bottom; r++) {
    const y = latitudeOf(r);
    const crossings: number[] = [];
    for (const ring of rings) {
      for (let i = 0; i + 1 < ring.length; i++) {
        const [x1 = 0, y1 = 0] = ring[i] ?? [];
        const [x2 = 0, y2 = 0] = ring[i + 1] ?? [];
        if (y1 > y !== y2 > y) crossings.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const from = Math.ceil(((crossings[i] ?? 0) + 180) / CELL - 0.5);
      const to = Math.floor(((crossings[i + 1] ?? 0) + 180) / CELL - 0.5);
      for (let c = Math.max(0, from); c <= Math.min(WIDTH - 1, to); c++) mark(r * WIDTH + c);
    }
  }
}

/** Every cell a line passes through, sampled at a quarter cell. */
function traceLine({ line, mark }: { line: Ring; mark: (index: number) => void }) {
  for (let i = 0; i + 1 < line.length; i++) {
    const [x1 = 0, y1 = 0] = line[i] ?? [];
    const [x2 = 0, y2 = 0] = line[i + 1] ?? [];
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (CELL / 4)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      mark(row(y1 + t * (y2 - y1)) * WIDTH + column(x1 + t * (x2 - x1)));
    }
  }
}

function layer(): { cells: Uint8Array; mark: (index: number) => void } {
  const cells = new Uint8Array(WIDTH * HEIGHT);
  return { cells, mark: (index) => (cells[index] = 1) };
}

function dilate(cells: Uint8Array): Uint8Array {
  const out = cells.slice();
  for (let r = 0; r < HEIGHT; r++) {
    for (let c = 0; c < WIDTH; c++) {
      if (!cells[r * WIDTH + c]) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = (c + dc + WIDTH) % WIDTH;
          if (rr >= 0 && rr < HEIGHT) out[rr * WIDTH + cc] = 1;
        }
      }
    }
  }
  return out;
}

async function main() {
  const climate = await koppen();
  const grid = new Uint8Array(WIDTH * HEIGHT);
  const scale = climate.width / WIDTH;
  for (let r = 0; r < HEIGHT; r++) {
    const sourceRow = Math.min(climate.height - 1, Math.floor(r * scale));
    for (let c = 0; c < WIDTH; c++) {
      const koppenClass = climate.pixels[sourceRow * climate.width + Math.floor(c * scale)] ?? 0;
      grid[r * WIDTH + c] = climateCode({ koppenClass, latitude: latitudeOf(r) });
    }
  }

  const mountains = layer();
  const dry = layer();
  const plains = layer();
  for (const feature of await naturalEarth('ne_10m_geography_regions_polys.geojson')) {
    const { FEATURECLA: kind, NAME: name } = feature.properties;
    const target =
      kind === 'Range/mtn'
        ? mountains
        : kind === 'Desert' || DRY_REGIONS.has(String(name))
          ? dry
          : GRASSLAND_REGIONS.has(String(name))
            ? plains
            : undefined;
    if (!target) continue;
    for (const rings of polygons(feature.geometry)) fillPolygon({ rings, mark: target.mark });
  }
  const ice = layer();
  for (const feature of await naturalEarth('ne_10m_glaciated_areas.geojson')) {
    for (const rings of polygons(feature.geometry)) fillPolygon({ rings, mark: ice.mark });
  }
  const water = layer();
  for (const feature of await naturalEarth('ne_10m_lakes.geojson')) {
    for (const rings of polygons(feature.geometry)) {
      fillPolygon({ rings, mark: water.mark });
      for (const ring of rings) traceLine({ line: ring, mark: water.mark });
    }
  }
  // Rivers mark only the cells they cross; widening them would turn every
  // valley a big river runs through into "lakes and rivers".
  const rivers = layer();
  for (const feature of await naturalEarth('ne_10m_rivers_lake_centerlines.geojson')) {
    for (const line of lines(feature.geometry)) traceLine({ line, mark: rivers.mark });
  }
  const coast = layer();
  for (const feature of await naturalEarth('ne_10m_coastline.geojson')) {
    for (const line of lines(feature.geometry)) traceLine({ line, mark: coast.mark });
  }
  const shore = dilate(water.cells);
  const coastal = dilate(coast.cells);

  for (let index = 0; index < grid.length; index++) {
    const base = grid[index] ?? Code.none;
    // The sea in Köppen has no class; a lake cell keeps its shore code.
    if (base === Code.none && !shore[index]) continue;
    const latitude = latitudeOf(Math.floor(index / WIDTH));
    const polar = Math.abs(latitude) >= POLAR_LATITUDE;
    const inRange = mountains.cells[index] === 1;
    let code = base === Code.none ? Code.water : base;
    if (code === Code.grassland && dry.cells[index]) code = Code.desert;
    if (code === Code.forest && plains.cells[index]) code = Code.grassland;
    if (ice.cells[index]) code = polar || !inRange ? Code.polar : Code.mountain;
    if (code === Code.polar && inRange && !polar) code = Code.mountain;
    if (inRange && (code === Code.desert || code === Code.grassland || code === Code.forest)) {
      code = Code.mountain;
    }
    // A lake shore beats the range around it (Tahoe); a river doesn't (Banff).
    if (rivers.cells[index] && code !== Code.polar && code !== Code.mountain) code = Code.water;
    if (shore[index] && code !== Code.polar) code = Code.water;
    if (coastal[index]) code = Code.coastal;
    grid[index] = code;
  }

  const chunks: Uint8Array[] = [];
  for (let r = 0; r < HEIGHT; r++) {
    const ends: number[] = [];
    const codes: number[] = [];
    for (let c = 0; c < WIDTH; c++) {
      const value = grid[r * WIDTH + c] ?? 0;
      if (c + 1 === WIDTH || grid[r * WIDTH + c + 1] !== value) {
        ends.push(c);
        codes.push(value);
      }
    }
    const chunk = new Uint8Array(2 + ends.length * 3);
    const view = new DataView(chunk.buffer);
    view.setUint16(0, ends.length, true);
    ends.forEach((end, i) => {
      view.setUint16(2 + i * 2, end, true);
    });
    chunk.set(codes, 2 + ends.length * 2);
    chunks.push(chunk);
  }
  const runs = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  chunks.reduce((offset, chunk) => {
    runs.set(chunk, offset);
    return offset + chunk.length;
  }, 0);
  const compressed = deflateRawSync(runs, { level: 9 });
  writeFileSync(outputPath, compressed);
  const counts = Object.entries(Code).map(
    ([name, value]) => `${name} ${grid.filter((v) => v === value).length}`,
  );
  console.log(
    `Landscapes.bin: ${WIDTH}×${HEIGHT}, ${(compressed.length / 1024).toFixed(0)} KB\n${counts.join('\n')}`,
  );
}

await main();
