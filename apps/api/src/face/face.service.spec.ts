import { FaceService, FACE_NOT_ENROLLED_MESSAGE } from './face.service';

// Logic tests with an INJECTED fake extractor: they prove the service's
// gating (enroll stores server-extracted descriptors, verify compares
// them, failures never yield a match) without loading the model. The
// model itself is proven separately by the runtime checks in README
// (same photo distance 0.0, different person ~0.90), not by these tests.
function makeService(opts: { enrolled?: number[] | null; extracted?: number[] | null; failExtract?: string } = {}) {
  const stored: Record<string, unknown> = {};
  const prisma = {
    user: {
      findUnique: jest.fn(async () => ({ id: 7, face_embedding: opts.enrolled ? JSON.stringify(opts.enrolled) : null })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(stored, data);
        return { id: 7 };
      }),
    },
  };
  const extractor = {
    isReady: () => true,
    loadModels: async () => true,
    extractDescriptor: jest.fn(async () => {
      if (opts.failExtract) throw new Error(opts.failExtract);
      return opts.extracted ?? null;
    }),
  };
  const audit = { log: jest.fn(async () => undefined) };
  const service = new FaceService(prisma as never, extractor as never, audit as never);
  return { service, prisma, extractor, stored, audit };
}

const base64Jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64'); // tiny, but the extractor is faked here
const desc = (v: number) => new Array(128).fill(v);

describe('FaceService (fake extractor)', () => {
  it('enroll stores the SERVER-extracted descriptor, never a client value', async () => {
    const { service, stored, extractor } = makeService({ extracted: desc(0.1) });
    const res = await service.enrollFace(7, base64Jpeg);
    expect(res.data.has_face_registered).toBe(true);
    expect(extractor.extractDescriptor).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(stored.face_embedding as string) as number[];
    expect(saved).toEqual(desc(0.1));
    expect(saved.length).toBe(128);
  });

  it('enroll rejects a photo with no detectable face', async () => {
    const { service } = makeService({ extracted: null });
    await expect(service.enrollFace(7, base64Jpeg)).rejects.toThrow('Tidak ada wajah terdeteksi');
  });

  it('verify matches the same descriptor and reports a real distance', async () => {
    const { service } = makeService({ enrolled: desc(0.2), extracted: desc(0.2) });
    const res = await service.verifyFace(7, base64Jpeg);
    expect(res.data.match).toBe(true);
    expect(res.data.distance).toBe(0);
    expect(res.data.threshold).toBe(0.6);
  });

  it('verify rejects a different descriptor', async () => {
    const { service } = makeService({ enrolled: desc(0.1), extracted: desc(-0.1) });
    const res = await service.verifyFace(7, base64Jpeg);
    expect(res.data.match).toBe(false);
    expect(res.data.distance).toBeGreaterThan(0.6);
  });

  it('verify with no enrolled face tells the user to enroll first', async () => {
    const { service, extractor } = makeService({ enrolled: null, extracted: desc(0.1) });
    await expect(service.verifyFace(7, base64Jpeg)).rejects.toThrow(FACE_NOT_ENROLLED_MESSAGE);
    // The extractor must not even run: there is nothing to compare against.
    expect(extractor.extractDescriptor).not.toHaveBeenCalled();
  });

  it('verifyForCheckIn throws on mismatch (caller must create no record)', async () => {
    const { service } = makeService({ enrolled: desc(0.1), extracted: desc(-0.1) });
    await expect(service.verifyForCheckIn(7, base64Jpeg)).rejects.toThrow('tidak cocok');
  });

  it('verifyForCheckIn returns the distance on match', async () => {
    const { service } = makeService({ enrolled: desc(0.3), extracted: desc(0.3) });
    await expect(service.verifyForCheckIn(7, base64Jpeg)).resolves.toEqual({ distance: 0 });
  });

  it('a model outage surfaces as 503, never as a match', async () => {
    const { service } = makeService({ enrolled: desc(0.1), failExtract: 'MODEL_NOT_LOADED' });
    await expect(service.verifyFace(7, base64Jpeg)).rejects.toThrow('belum termuat');
    const err = await service.verifyFace(7, base64Jpeg).catch((e: { getStatus?: () => number }) => e);
    expect(err.getStatus?.()).toBe(503);
  });

  it('a corrupt stored template is treated as "enroll first", not matched', async () => {
    const { service } = makeService({ enrolled: [1, 2, 3] as never, extracted: desc(0.1) });
    await expect(service.verifyFace(7, base64Jpeg)).rejects.toThrow(FACE_NOT_ENROLLED_MESSAGE);
  });
});
