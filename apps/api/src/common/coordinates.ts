import { BadRequestException } from '@nestjs/common';

// Strict coordinate validation (audit fix).
// There is NO location-less attendance mode in this codebase: an attendance
// record without a valid location must never be stored as normal/approved.
// The old code let null/NaN through because NaN > radius is false, which
// silently produced a "normal/approved" record with no location at all.
export function validateCoordinates(latitude: unknown, longitude: unknown): { latitude: number; longitude: number } {
  const lat = typeof latitude === 'string' ? Number(latitude) : latitude;
  const lon = typeof longitude === 'string' ? Number(longitude) : longitude;
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    throw new BadRequestException('latitude and longitude are required for attendance');
  }
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new BadRequestException('latitude and longitude must be finite numbers');
  }
  if (lat < -90 || lat > 90) throw new BadRequestException('latitude must be between -90 and 90');
  if (lon < -180 || lon > 180) throw new BadRequestException('longitude must be between -180 and 180');
  return { latitude: lat, longitude: lon };
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Calendar-day bounds (server local time) used for the one-check-in-per-day rule.
export function todayBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
