import { euclideanDistance, isFaceMatch, FACE_MATCH_THRESHOLD } from './distance';

describe('face distance / threshold', () => {
  it('identical descriptors score 0 and match', () => {
    const a = [0.1, -0.2, 0.3, 0.0];
    expect(euclideanDistance(a, a)).toBe(0);
    expect(isFaceMatch(0)).toBe(true);
  });

  it('a clearly different descriptor is rejected', () => {
    const a = new Array(128).fill(0.1);
    const b = new Array(128).fill(-0.1);
    const d = euclideanDistance(a, b);
    expect(d).toBeGreaterThan(FACE_MATCH_THRESHOLD);
    expect(isFaceMatch(d)).toBe(false);
  });

  it('a near-duplicate (small noise) still matches', () => {
    const a = new Array(128).fill(0.1);
    const b = a.map((v) => v + 0.01);
    expect(isFaceMatch(euclideanDistance(a, b))).toBe(true);
  });

  it('the 0.6 boundary is inclusive, just above it rejects', () => {
    expect(isFaceMatch(0.6)).toBe(true);
    expect(isFaceMatch(0.60001)).toBe(false);
  });

  it('rejects length mismatches instead of comparing garbage', () => {
    expect(() => euclideanDistance([1, 2], [1])).toThrow('length mismatch');
  });

  it('rejects non-finite distances', () => {
    expect(isFaceMatch(NaN)).toBe(false);
    expect(isFaceMatch(Infinity)).toBe(false);
  });
});
