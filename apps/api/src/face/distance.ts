// Face-match math, kept dependency-free so it is unit-testable without
// loading any model.
//
// Threshold 0.6 is the conventional face-api.js / dlib face-recognition
// threshold for the 128-dim face descriptor: two descriptors of the SAME
// person typically score well below 0.6, different people typically above
// it. It is a trade-off, not a guarantee: in this VM, a different cast
// member from the same group photo scored 0.67 (correctly rejected, but
// close), while the same person re-detected scored 0.0. There is NO
// liveness detection: a photo of the enrolled person will match, so this
// feature proves "the face in the selfie resembles the enrolled face", not
// "a live person is present".
export const FACE_MATCH_THRESHOLD = 0.6;

export function euclideanDistance(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`descriptor length mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function isFaceMatch(distance: number, threshold = FACE_MATCH_THRESHOLD): boolean {
  return Number.isFinite(distance) && distance <= threshold;
}
