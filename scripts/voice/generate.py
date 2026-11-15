#!/usr/bin/env python3
"""Generate the lesson narration clips with the Kokoro neural voice (Apache-2.0).

Usage (or `npm run voice`):
    npx vite-node scripts/voice/export.ts > scripts/voice/narration.jsonl
    python3 scripts/voice/generate.py scripts/voice/narration.jsonl

Needs: pip install kokoro-onnx soundfile; ffmpeg on PATH. The model (~350 MB) is downloaded
once into ~/.cache/banjo-made-simple-voice. Clips are named by a hash of their text, so only
new or edited text is generated; clips no longer used are deleted.
"""
import json, os, subprocess, sys, tempfile, urllib.request
from pathlib import Path

VOICE = "af_heart"  # chosen by ear from the Kokoro voices
SPEED = 0.95  # a touch slower than default: teaching pace
MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
FILES = ["kokoro-v1.0.onnx", "voices-v1.0.bin"]
CACHE = Path(os.environ.get("VOICE_MODEL_DIR", Path.home() / ".cache" / "banjo-made-simple-voice"))
OUT = Path(__file__).resolve().parents[2] / "public" / "voice"


def ensure_model():
    CACHE.mkdir(parents=True, exist_ok=True)
    for f in FILES:
        p = CACHE / f
        if not p.exists():
            print(f"downloading {f}…", file=sys.stderr)
            urllib.request.urlretrieve(MODEL_URL + f, p)
    return CACHE / FILES[0], CACHE / FILES[1]


def main(jsonl: str):
    clips = [json.loads(l) for l in open(jsonl) if l.strip()]
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    todo = [c for c in clips if not (OUT / f"{c['id']}.mp3").exists()]
    if todo:
        import soundfile as sf
        from kokoro_onnx import Kokoro

        model, voices = ensure_model()
        k = Kokoro(str(model), str(voices))
        for i, c in enumerate(todo, 1):
            samples, sr = k.create(c["text"], voice=VOICE, speed=SPEED, lang="en-us")
            with tempfile.NamedTemporaryFile(suffix=".wav") as w:
                sf.write(w.name, samples, sr)
                subprocess.run(
                    ["ffmpeg", "-loglevel", "error", "-y", "-i", w.name, "-af", "loudnorm=I=-18:TP=-2", "-ac", "1", "-ar", "24000",
                     "-c:a", "libmp3lame", "-b:a", "48k", str(OUT / f"{c['id']}.mp3")],
                    check=True,
                )
            manifest[c["id"]] = round(len(samples) / sr, 2)
            print(f"[{i}/{len(todo)}] {c['id']} {manifest[c['id']]}s  {c['text'][:60]}", file=sys.stderr)
    keep = {c["id"] for c in clips}
    for f in OUT.glob("*.mp3"):
        if f.stem not in keep:
            f.unlink()
            print(f"removed stale {f.name}", file=sys.stderr)
    manifest = {k: v for k, v in manifest.items() if k in keep}
    manifest_path.write_text(json.dumps(manifest, indent=0, sort_keys=True) + "\n")
    print(f"{len(keep)} clips, {len(todo)} generated, {sum(manifest.values()) / 60:.1f} min total", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "scripts/voice/narration.jsonl")
