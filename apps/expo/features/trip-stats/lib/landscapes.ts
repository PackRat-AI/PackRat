import { decodeLandscapeGrid, EMPTY_LANDSCAPE_GRID, type LandscapeGrid } from '../utils/landscapes';

let cachedGrid: LandscapeGrid | null = null;

/**
 * The bundled landscape grid, read on first use rather than at import: the file is over a megabyte
 * and only Trip Stats reads it. Built with the Swift app's grid by
 * `apps/swift/scripts/generate-landscapes.ts`.
 */
export function getLandscapeGrid(): LandscapeGrid {
  if (!cachedGrid) {
    const file: { runs: string } = require('../data/landscapes.json');
    try {
      const binary = atob(file.runs);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      cachedGrid = decodeLandscapeGrid(bytes);
    } catch {
      cachedGrid = EMPTY_LANDSCAPE_GRID;
    }
  }
  return cachedGrid;
}
