// QAS33 — Map overlay utilities (GeoJSON validation + KML → GeoJSON conversion)
// ---------------------------------------------------------------------------
// ISOMORPHIC: safe to import from BOTH client components and server API routes.
// No next/headers, no Prisma, no Node-only APIs — the only browser dependency
// (DOMParser, used for KML) is passed in by the caller; the server never
// parses KML. Fully dependency-free otherwise.

// ---------------------------------------------------------------------------
// GeoJSON types (normalized shapes we store and serve)
// ---------------------------------------------------------------------------

export type GeoJsonGeometryType =
  | "Point"
  | "MultiPoint"
  | "LineString"
  | "MultiLineString"
  | "Polygon"
  | "MultiPolygon"
  | "GeometryCollection";

export interface GeoJsonGeometry {
  type: GeoJsonGeometryType;
  /** Raw nested coordinate structure (validated finite numbers, lng/lat in range). */
  coordinates?: unknown;
  /** Present only for GeometryCollection. */
  geometries?: GeoJsonGeometry[];
}

export interface GeoJsonFeature {
  type: "Feature";
  geometry: GeoJsonGeometry | null;
  /** Sanitized popup-safe properties: only name / title / description (strings ≤ 400 chars). */
  properties: Record<string, string>;
  /** Always stripped — uploaded ids are never trusted. */
  id?: undefined;
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export type ValidateGeoJsonResult =
  | { ok: true; fc: GeoJsonFeatureCollection; featureCount: number; error?: undefined }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const MAX_OVERLAY_FEATURES = 2000;
export const MAX_OVERLAY_JSON_CHARS = 2 * 1024 * 1024; // 2 MB (JSON string length)
const MAX_PROP_CHARS = 400;

// ---------------------------------------------------------------------------
// GeoJSON validation
// ---------------------------------------------------------------------------

const KNOWN_GEOMETRY_TYPES: ReadonlySet<string> = new Set([
  "Point",
  "MultiPoint",
  "LineString",
  "MultiLineString",
  "Polygon",
  "MultiPolygon",
  "GeometryCollection",
]);

/** Position nesting depth per geometry type (Point = 0 → a single [lng, lat, alt?]). */
const COORD_DEPTH: Record<string, number> = {
  Point: 0,
  MultiPoint: 1,
  LineString: 1,
  MultiLineString: 2,
  Polygon: 2,
  MultiPolygon: 3,
};

/** Recursively validate a coordinate structure at the given nesting depth. */
function validateCoords(value: unknown, depth: number, path: string): string | null {
  if (depth <= 0) {
    // A single position: [lng, lat, (alt…)] — all finite, lng/lat in global range.
    if (!Array.isArray(value) || value.length < 2) {
      return `${path}: a coordinate position must be [longitude, latitude(, altitude…)]`;
    }
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== "number" || !Number.isFinite(value[i])) {
        return `${path}: coordinate values must be finite numbers`;
      }
    }
    const lng = value[0] as number;
    const lat = value[1] as number;
    if (lng < -180 || lng > 180) return `${path}: longitude ${lng} is outside [-180, 180]`;
    if (lat < -90 || lat > 90) return `${path}: latitude ${lat} is outside [-90, 90]`;
    return null;
  }
  if (!Array.isArray(value) || value.length === 0) {
    return `${path}: expected a non-empty coordinate array`;
  }
  for (let i = 0; i < value.length; i++) {
    const err = validateCoords(value[i], depth - 1, `${path}[${i}]`);
    if (err) return err;
  }
  return null;
}

function validateGeometry(value: unknown, path: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return `${path}: geometry must be an object`;
  }
  const g = value as { type?: unknown; coordinates?: unknown; geometries?: unknown };
  if (typeof g.type !== "string" || !KNOWN_GEOMETRY_TYPES.has(g.type)) {
    return `${path}: unknown geometry type ${JSON.stringify(g.type)}`;
  }
  if (g.type === "GeometryCollection") {
    if (!Array.isArray(g.geometries) || g.geometries.length === 0) {
      return `${path}: GeometryCollection requires a non-empty "geometries" array`;
    }
    for (let i = 0; i < g.geometries.length; i++) {
      const err = validateGeometry(g.geometries[i], `${path}.geometries[${i}]`);
      if (err) return err;
    }
    return null;
  }
  const err = validateCoords(g.coordinates, COORD_DEPTH[g.type], `${path}.coordinates`);
  if (err) return err;
  return null;
}

/** Keep ONLY name / title / description (strings, trimmed, ≤ 400 chars). */
function sanitizeProperties(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const src = raw as Record<string, unknown>;
  for (const key of ["name", "title", "description"] as const) {
    const v = src[key];
    const s = typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
    const trimmed = s.trim();
    if (trimmed) out[key] = trimmed.slice(0, MAX_PROP_CHARS);
  }
  return out;
}

/**
 * Validate an uploaded overlay document. Accepts a FeatureCollection or a
 * single Feature (normalized to a collection). Returns a sanitized, normalized
 * FeatureCollection safe to store and render — or a helpful error.
 */
export function validateGeoJson(raw: unknown): ValidateGeoJsonResult {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "The file must contain a GeoJSON object (FeatureCollection or Feature)." };
  }
  const doc = raw as { type?: unknown; features?: unknown; geometry?: unknown; properties?: unknown };

  let featuresIn: unknown[];
  if (doc.type === "FeatureCollection") {
    if (!Array.isArray(doc.features)) {
      return { ok: false, error: 'GeoJSON FeatureCollection requires a "features" array.' };
    }
    featuresIn = doc.features;
  } else if (doc.type === "Feature") {
    featuresIn = [doc]; // single Feature → normalize into a collection
  } else {
    return { ok: false, error: 'Unsupported GeoJSON type — expected "FeatureCollection" or "Feature".' };
  }

  if (featuresIn.length === 0) {
    return { ok: false, error: "The overlay contains no features." };
  }
  if (featuresIn.length > MAX_OVERLAY_FEATURES) {
    return { ok: false, error: `The overlay has ${featuresIn.length} features — the maximum is ${MAX_OVERLAY_FEATURES}.` };
  }

  const features: GeoJsonFeature[] = [];
  for (let i = 0; i < featuresIn.length; i++) {
    const f = featuresIn[i];
    if (!f || typeof f !== "object" || Array.isArray(f)) {
      return { ok: false, error: `Feature ${i + 1} is not an object.` };
    }
    const feat = f as { type?: unknown; geometry?: unknown; properties?: unknown };
    if (feat.type !== "Feature") {
      return { ok: false, error: `Feature ${i + 1} is missing type "Feature".` };
    }
    if (feat.geometry !== null && feat.geometry !== undefined) {
      const err = validateGeometry(feat.geometry, `Feature ${i + 1} geometry`);
      if (err) return { ok: false, error: err };
    }
    // id is deliberately dropped; properties are whitelisted above.
    features.push({
      type: "Feature",
      geometry: (feat.geometry as GeoJsonGeometry | null) ?? null,
      properties: sanitizeProperties(feat.properties),
    });
  }

  const fc: GeoJsonFeatureCollection = { type: "FeatureCollection", features };
  const size = JSON.stringify(fc).length;
  if (size > MAX_OVERLAY_JSON_CHARS) {
    return { ok: false, error: `The overlay is too large (${(size / 1024 / 1024).toFixed(2)} MB) — the maximum is 2 MB.` };
  }
  return { ok: true, fc, featureCount: features.length };
}

/** Number of features in a collection. */
export function countFeatures(fc: GeoJsonFeatureCollection): number {
  return fc.features.length;
}

// ---------------------------------------------------------------------------
// KML → GeoJSON (client-side; DOMParser passed in by the browser caller)
// ---------------------------------------------------------------------------

export type KmlToGeoJsonResult =
  | { ok: true; fc: GeoJsonFeatureCollection }
  | { ok: false; error: string };

function localNameOf(el: Element): string {
  return el.localName || el.tagName.replace(/^.*:/, "");
}

/** All descendant elements with the given local name (namespace-prefix safe). */
function descendantsByLocalName(root: Element, name: string): Element[] {
  const all = root.getElementsByTagName("*");
  const out: Element[] = [];
  for (let i = 0; i < all.length; i++) {
    if (localNameOf(all[i]) === name) out.push(all[i]);
  }
  return out;
}

/** Direct child elements with the given local name. */
function childrenByLocalName(el: Element, name: string): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < el.children.length; i++) {
    if (localNameOf(el.children[i]) === name) out.push(el.children[i]);
  }
  return out;
}

function firstChildByLocalName(el: Element, name: string): Element | null {
  return childrenByLocalName(el, name)[0] ?? null;
}

function textOf(el: Element | null): string {
  return (el?.textContent ?? "").trim();
}

/** <coordinates>lng,lat[,alt] lng,lat[,alt] …</coordinates> → position list. */
function parseCoordinatesText(el: Element | null): number[][] {
  const text = textOf(descendantsCoordinates(el));
  if (!text) return [];
  const out: number[][] = [];
  for (const token of text.split(/\s+/)) {
    if (!token) continue;
    const parts = token.split(",");
    if (parts.length < 2) continue;
    const lng = Number(parts[0]);
    const lat = Number(parts[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) continue;
    const position: number[] = [lng, lat];
    const alt = Number(parts[2]);
    if (parts.length >= 3 && Number.isFinite(alt)) position.push(alt);
    out.push(position);
  }
  return out;
}

function descendantsCoordinates(el: Element | null): Element | null {
  if (!el) return null;
  return descendantsByLocalName(el, "coordinates")[0] ?? null;
}

/** Parse one KML geometry element (Point / LineString / LinearRing / Polygon / MultiGeometry). */
function parseKmlGeometry(el: Element): GeoJsonGeometry | null {
  const tag = localNameOf(el);

  if (tag === "Point") {
    const cs = parseCoordinatesText(el);
    return cs.length > 0 ? { type: "Point", coordinates: cs[0] } : null;
  }
  if (tag === "LineString") {
    const cs = parseCoordinatesText(el);
    return cs.length >= 2 ? { type: "LineString", coordinates: cs } : null;
  }
  if (tag === "LinearRing") {
    // A bare LinearRing placemark child renders as a closed line.
    const cs = parseCoordinatesText(el);
    return cs.length >= 3 ? { type: "LineString", coordinates: cs } : null;
  }
  if (tag === "Polygon") {
    const outer = descendantsByLocalName(el, "outerBoundaryIs")
      .flatMap((b) => childrenByLocalName(b, "LinearRing"))
      .map((r) => parseCoordinatesText(r))
      .find((ring) => ring.length >= 3);
    if (!outer) return null;
    const holes = descendantsByLocalName(el, "innerBoundaryIs")
      .flatMap((b) => childrenByLocalName(b, "LinearRing"))
      .map((r) => parseCoordinatesText(r))
      .filter((ring) => ring.length >= 3);
    return { type: "Polygon", coordinates: [outer, ...holes] };
  }
  if (tag === "MultiGeometry") {
    const subs: GeoJsonGeometry[] = [];
    for (let i = 0; i < el.children.length; i++) {
      const g = parseKmlGeometry(el.children[i]);
      if (g) subs.push(g);
    }
    return subs.length > 0 ? { type: "GeometryCollection", geometries: subs } : null;
  }
  return null; // Model, gx:Track, unknown… — skipped
}

/** One <Placemark> → GeoJSON feature (null when its coordinates are malformed). */
function parsePlacemark(pm: Element): GeoJsonFeature | null {
  const name = textOf(firstChildByLocalName(pm, "name"));
  const description = textOf(firstChildByLocalName(pm, "description"));

  let geometry: GeoJsonGeometry | null = null;
  for (let i = 0; i < pm.children.length; i++) {
    const child = pm.children[i];
    const tag = localNameOf(child);
    if (tag === "Point" || tag === "LineString" || tag === "LinearRing" || tag === "Polygon" || tag === "MultiGeometry") {
      const g = parseKmlGeometry(child);
      if (g) {
        geometry = g;
        break; // first valid geometry wins
      }
    }
  }
  if (!geometry) return null; // malformed / missing coordinates → skip this placemark

  const properties: Record<string, string> = {};
  if (name) properties.name = name.slice(0, MAX_PROP_CHARS);
  if (description) properties.description = description.slice(0, MAX_PROP_CHARS);
  return { type: "Feature", geometry, properties };
}

/**
 * Convert KML text into a normalized GeoJSON FeatureCollection. Placemarks can
 * be nested anywhere in the Document/Folder tree. The browser's DOMParser is
 * passed in explicitly (this module stays server-importable).
 */
export function kmlToGeoJson(text: string, parser: DOMParser): KmlToGeoJsonResult {
  let doc: Document;
  try {
    doc = parser.parseFromString(text, "application/xml");
  } catch {
    return { ok: false, error: "The KML file could not be parsed." };
  }
  if (doc.getElementsByTagName("parsererror").length > 0) {
    return { ok: false, error: "The KML file contains invalid XML." };
  }
  const all = doc.getElementsByTagName("*");
  const placemarks: Element[] = [];
  for (let i = 0; i < all.length; i++) {
    if (localNameOf(all[i]) === "Placemark") placemarks.push(all[i]);
  }
  if (placemarks.length === 0) {
    return { ok: false, error: "No placemarks found in the KML file." };
  }
  if (placemarks.length > MAX_OVERLAY_FEATURES) {
    return { ok: false, error: `The KML has ${placemarks.length} placemarks — the maximum is ${MAX_OVERLAY_FEATURES}.` };
  }

  const features: GeoJsonFeature[] = [];
  for (const pm of placemarks) {
    const f = parsePlacemark(pm);
    if (f) features.push(f); // malformed placemarks are skipped
  }
  if (features.length === 0) {
    return { ok: false, error: "No placemarks with valid coordinates were found in the KML file." };
  }
  return { ok: true, fc: { type: "FeatureCollection", features } };
}
