#!/usr/bin/env sh
# Assembles a Hugging Face Space repo (Docker SDK) for the backend in $1.
# Usage: sh deploy/hf-space/build.sh <output-dir>
set -eu
out="${1:?output directory required}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
rm -rf "$out" && mkdir -p "$out/data"
cd "$root"
# Tracked files only, so local .env files and caches can never be included.
git archive HEAD Dockerfile .dockerignore backend | tar -x -C "$out"
cp data/sample_events.jsonl "$out/data/"
cp deploy/hf-space/README.md "$out/README.md"
cd "$out" && git init -q -b main && git add -A && git commit -q -m "Deploy WikiPulse backend"
echo "Space repo ready in $out"
