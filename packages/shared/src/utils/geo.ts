export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Parses PostGIS EWKB / WKB hex string for a 2D Point.
 * Handles both Little-Endian (01) and Big-Endian (00), with or without SRID flag (0x20000000).
 */
export function parseEWKB(hex: string): LatLng | null {
  if (typeof hex !== 'string') return null;
  const clean = hex.trim().toLowerCase();
  if (!/^[0-9a-f]{42,}$/.test(clean)) return null;

  try {
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const le = view.getUint8(0) === 1;
    const type = view.getUint32(1, le);
    const hasSRID = (type & 0x20000000) !== 0;
    const offset = hasSRID ? 9 : 5;
    if (offset + 16 > bytes.length) return null;
    const lon = view.getFloat64(offset, le);
    const lat = view.getFloat64(offset + 8, le);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return null;
    }
    return { latitude: lat, longitude: lon };
  } catch {
    return null;
  }
}

/**
 * Universal PostGIS / GPS Coordinate Parser.
 * Accurately extracts { latitude, longitude } from:
 * 1. PostGIS EWKB Hex strings (e.g. '0101000020E6100000FA939D2317015440E8ECAEFDAE0D2A40')
 * 2. PostGIS WKT strings (e.g. 'POINT(80.0170 13.0267)')
 * 3. GeoJSON Point objects (e.g. { type: 'Point', coordinates: [80.0170, 13.0267] })
 * 4. Standard coordinate objects ({ latitude, longitude } or { lat, lng })
 */
export function parseCoordinates(loc: any): LatLng | null {
  if (!loc) return null;

  // 1. Direct object formats
  if (typeof loc === 'object') {
    if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      const lon = Number(loc.coordinates[0]);
      const lat = Number(loc.coordinates[1]);
      if (!isNaN(lat) && !isNaN(lon)) return { latitude: lat, longitude: lon };
    }
    if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
      return { latitude: loc.latitude, longitude: loc.longitude };
    }
    if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      return { latitude: loc.lat, longitude: loc.lng };
    }
  }

  // 2. String formats
  if (typeof loc === 'string') {
    const trimmed = loc.trim();

    // Check for PostGIS EWKB / WKB hex string
    if (/^[0-9a-fA-F]{42,}$/.test(trimmed)) {
      const parsed = parseEWKB(trimmed);
      if (parsed) return parsed;
    }

    // Check for WKT POINT(lng lat)
    const match = trimmed.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      const lon = parseFloat(match[1]);
      const lat = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lon)) return { latitude: lat, longitude: lon };
    }

    // Check for JSON string
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const obj = JSON.parse(trimmed);
        return parseCoordinates(obj);
      } catch {
        // ignore
      }
    }
  }

  return null;
}
