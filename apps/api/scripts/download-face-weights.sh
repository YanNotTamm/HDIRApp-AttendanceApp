#!/usr/bin/env bash
# Download the face-api.js model weights needed by FaceApiDescriptorExtractor.
# Models: ssdMobilenetv1 (detection) + faceLandmark68Net (landmarks) +
# faceRecognitionNet (128-dim descriptor). Total ~12 MB.
# Usage: bash apps/api/scripts/download-face-weights.sh [target-dir]
# Default target: apps/api/weights (or $FACE_WEIGHTS_DIR).
set -euo pipefail
BASE="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
OUT="${1:-${FACE_WEIGHTS_DIR:-$(dirname "$0")/../weights}}"
mkdir -p "$OUT"
FILES=(
  ssd_mobilenetv1_model-weights_manifest.json
  ssd_mobilenetv1_model-shard1
  ssd_mobilenetv1_model-shard2
  face_landmark_68_model-weights_manifest.json
  face_landmark_68_model-shard1
  face_recognition_model-weights_manifest.json
  face_recognition_model-shard1
  face_recognition_model-shard2
)
for f in "${FILES[@]}"; do
  echo "Downloading $f ..."
  curl -fsSL --retry 3 --retry-delay 3 -o "$OUT/$f" "$BASE/$f"
done
echo "Weights OK in $OUT ($(du -sh "$OUT" | cut -f1))."
echo "Start the API with JWT_SECRET set; on boot it logs 'Model wajah dimuat'."
