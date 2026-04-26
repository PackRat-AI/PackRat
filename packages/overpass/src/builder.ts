import type { OsmSport } from './types';

const OSM_SPORT_MAP: Record<OsmSport, string> = {
  hiking: 'hiking',
  cycling: 'bicycle',
  skiing: 'ski',
  running: 'running',
  horse_riding: 'horse_riding',
};

export class TrailQueryBuilder {
  private _timeout = 25;
  private _filters: string[] = [];
  private _spatial = '';
  private _byId: string | null = null;

  sport(sport: OsmSport): this {
    this._filters.push(`["route"="${OSM_SPORT_MAP[sport]}"]`);
    return this;
  }

  name(q: string): this {
    const escaped = q.replace(/"/g, '\\"');
    this._filters.push(`["name"~"${escaped}",i]`);
    return this;
  }

  // biome-ignore lint/complexity/useMaxParams: geographic coords require 3 args
  around(lat: number, lon: number, radiusM: number): this {
    this._spatial = `(around:${Math.round(radiusM)},${lat},${lon})`;
    return this;
  }

  // biome-ignore lint/complexity/useMaxParams: bbox requires 4 coordinate args
  bbox(south: number, west: number, north: number, east: number): this {
    this._spatial = `(${south},${west},${north},${east})`;
    return this;
  }

  id(osmId: number | string | bigint): this {
    this._byId = String(osmId);
    return this;
  }

  timeout(seconds: number): this {
    this._timeout = seconds;
    return this;
  }

  build(): string {
    const preamble = `[out:json][timeout:${this._timeout}];`;

    if (this._byId !== null) {
      return `${preamble}\nrelation(${this._byId});\nout geom;`;
    }

    const typeFilter = '["type"="route"]';
    const filters = [typeFilter, ...this._filters].join('');
    return `${preamble}\nrelation${filters}${this._spatial};\nout geom;`;
  }
}
