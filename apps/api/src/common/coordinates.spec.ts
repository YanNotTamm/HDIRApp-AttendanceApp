import { haversineMeters, todayBounds, validateCoordinates } from './coordinates';

describe('haversineMeters', () => {
  it('returns 0 for the same point', () => {
    expect(haversineMeters(-5.39714, 105.26679, -5.39714, 105.26679)).toBe(0);
  });

  it('returns about 111 km for one degree of latitude', () => {
    const d = haversineMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });

  it('distinguishes inside / outside / on the edge of a 100 m radius', () => {
    // ~50 m north of the seed office, ~200 m north, and ~100 m north.
    const office = { lat: -5.39714, lon: 105.26679 };
    const inside = haversineMeters(office.lat, office.lon, office.lat + 0.00045, office.lon);
    const outside = haversineMeters(office.lat, office.lon, office.lat + 0.0018, office.lon);
    const edge = haversineMeters(office.lat, office.lon, office.lat + 0.0009, office.lon);
    expect(inside).toBeLessThan(100);
    expect(outside).toBeGreaterThan(100);
    expect(edge).toBeGreaterThan(90);
    expect(edge).toBeLessThan(110);
  });
});

describe('validateCoordinates', () => {
  it('accepts valid coordinates including the extremes', () => {
    expect(validateCoordinates(-90, -180)).toEqual({ latitude: -90, longitude: -180 });
    expect(validateCoordinates(90, 180)).toEqual({ latitude: 90, longitude: 180 });
    expect(validateCoordinates('-5.39714', '105.26679')).toEqual({
      latitude: -5.39714,
      longitude: 105.26679,
    });
  });

  it('rejects missing, NaN and out-of-range coordinates — never a silent normal/approved', () => {
    expect(() => validateCoordinates(null, 105)).toThrow();
    expect(() => validateCoordinates(-5, null)).toThrow();
    expect(() => validateCoordinates(NaN, 105)).toThrow();
    expect(() => validateCoordinates(-5, NaN)).toThrow();
    expect(() => validateCoordinates(91, 105)).toThrow();
    expect(() => validateCoordinates(-5, 181)).toThrow();
    expect(() => validateCoordinates('not-a-number', 105)).toThrow();
  });
});

describe('todayBounds', () => {
  it('covers exactly one calendar day', () => {
    const { start, end } = todayBounds(new Date('2026-10-30T12:34:56'));
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});
