/**
 * MediConnect Precision Distance & Telemetry Engine
 * Implements real-time Haversine geodesic distance, dynamic ETA computation,
 * and universal PostGIS EWKB / WKT / GeoJSON coordinate parsing.
 */
import { parseCoordinates, LatLng } from '@mediconnect/shared';

export type { LatLng };

export const distanceService = {
  /**
   * Calculates the great-circle distance between two GPS coordinates using the Haversine formula.
   * @returns Distance in kilometers
   */
  calculateDistanceKm(point1: LatLng, point2: LatLng): number {
    const R = 6371; // Earth's mean radius in km
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);

    const lat1 = this.toRadians(point1.latitude);
    const lat2 = this.toRadians(point2.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  },

  /**
   * Calculates distance in meters
   */
  calculateDistanceMeters(point1: LatLng, point2: LatLng): number {
    return Math.round(this.calculateDistanceKm(point1, point2) * 1000);
  },

  /**
   * Formats distance into a human-friendly string (e.g. "450 m" or "2.3 km")
   */
  formatDistance(km: number): string {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
  },

  /**
   * Calculates Estimated Time of Arrival (ETA) in minutes
   * @param distanceKm Distance remaining in kilometers
   * @param speedKmh Current or average vehicle speed in km/h (default: 48 km/h emergency speed)
   */
  calculateEtaMinutes(distanceKm: number, speedKmh: number = 48): number {
    if (speedKmh <= 0) speedKmh = 35; // City traffic baseline
    const hours = distanceKm / speedKmh;
    const minutes = Math.max(1, Math.round(hours * 60));
    return minutes;
  },

  /**
   * Formats ETA into human-readable string (e.g. "4 mins" or "< 1 min")
   */
  formatEta(minutes: number): string {
    if (minutes <= 1) return '< 1 min';
    return `${minutes} mins`;
  },

  /**
   * Safely parses coordinates from PostGIS EWKB hex, GeoJSON, WKT string ('POINT(lng lat)'), or object.
   */
  parsePoint(loc: any): LatLng | null {
    return parseCoordinates(loc);
  },

  toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
};
