# Face model weights

Weights for face-api.js 0.22.2, used by `src/face/descriptor-extractor.ts`
(pure-JS CPU backend — no native canvas required):

- `ssd_mobilenetv1_*` — face detection
- `face_landmark_68_*` — 68-point landmarks
- `face_recognition_*` — 128-dim face descriptor

Source: https://github.com/justadudewhohacks/face-api.js (folder `weights/`).

Download / refresh with (from the repo root):

```bash
bash apps/api/scripts/download-face-weights.sh
```

Total ±12 MB. If this folder is empty or incomplete, the API still boots
but `/face/enroll`, `/face/verify`, and face-gated check-in answer HTTP
503 with a clear message — never a fake success. On a healthy boot the
server logs: `Model wajah dimuat dari <dir> (...)`.
