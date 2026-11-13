"""Trains the "Hey PackRat" wake word on Modal and downloads the model.

    modal run --detach train_modal.py::main    # everything: data, clips, features, train, export
    modal run train_modal.py::fetch            # copy the finished model into ../android/src/main/assets

Data and clips live on the `packrat-wakeword` volume, so a rerun picks up where the last one stopped.
"""

from pathlib import Path

import modal

TRAINER_REPO = "https://github.com/interkelstar/microwakeword-trainer"
TRAINER_REF = "8fdbadc3b969a8c1993108c0d655910440dfb762"
MWW_REF = "a70bd740d4e79ee8a8bb3db843fe862b88d5d6b0"
PIPER_URL = (
    "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz"
)
# Two shards of AudioSet's balanced set: about 2,000 ten-second clips of real-world sound.
AUDIOSET_SHARDS = ("data/bal_train/00.parquet", "data/bal_train/01.parquet")

HERE = Path(__file__).parent
CONFIG = "hey_packrat.yaml"
MODEL = "hey_packrat"
VOLUME_DIR = "/vol"

# Multi-speaker Piper voices only ever say a clip as speaker 0 unless asked, which throws away
# almost all of the speaker variety (libritts_r alone has 904). Pick one at random per clip.
SPEAKER_PATCH = '''
import functools as _functools, json as _json

@_functools.lru_cache(maxsize=None)
def _num_speakers(voice_onnx):
    try:
        with open(f"{voice_onnx}.json", encoding="utf-8") as f:
            return int(_json.load(f).get("num_speakers", 1))
    except OSError:
        return 1
'''
SYNTH_BEFORE = '''         "--noise_w", str(noise_w)],'''
SYNTH_AFTER = '''         "--noise_w", str(noise_w)]
        + (["--speaker", str(random.randrange(_num_speakers(str(voice_onnx))))]
           if _num_speakers(str(voice_onnx)) > 1 else []),'''


# The trainer starts Piper once per clip, and loading a voice costs seconds, so 100k clips take
# six hours. This replaces its clip generator with one Piper process per voice and setting, fed
# every clip for it as JSON lines, then resamples the results to 16 kHz in parallel.
BATCH_GENERATOR = '''

def _resample_into(raw_path, out_dir):
    import scipy.io.wavfile as wavfile
    import scipy.signal
    try:
        sr, data = wavfile.read(str(raw_path))
        if sr != SAMPLE_RATE:
            data = scipy.signal.resample_poly(data, SAMPLE_RATE, sr).astype(np.int16)
        wavfile.write(str(Path(out_dir) / Path(raw_path).name), SAMPLE_RATE, data)
    finally:
        Path(raw_path).unlink(missing_ok=True)


def _generate_clips(phrases, voice_files, n_total, out_dir, desc):
    import json
    from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

    out_dir.mkdir(parents=True, exist_ok=True)
    existing = count_wav(out_dir)
    if existing >= n_total:
        log.info("  %s: %d clips exist (target %d) — skip", desc, existing, n_total)
        return
    remaining = n_total - existing
    settings = [(ls, ns, nw) for ls in (0.75, 1.0, 1.1, 1.25)
                for ns in (0.667, 0.8, 0.98) for nw in (0.8, 0.9, 0.98)]
    groups = {}
    for _ in range(remaining):
        key = (str(random.choice(voice_files)),) + random.choice(settings)
        groups.setdefault(key, []).append(random.choice(phrases))

    raw_dir = out_dir.parent / f"_raw_{out_dir.name}"
    shutil.rmtree(raw_dir, ignore_errors=True)
    raw_dir.mkdir(parents=True)
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = str(PIPER_BIN_DIR.resolve()) + ":" + env.get("LD_LIBRARY_PATH", "")
    env["ESPEAK_DATA_PATH"] = str(PIPER_ESPEAK.resolve())

    def synthesize(item):
        (voice, ls, ns, nw), texts = item
        speakers = _num_speakers(voice)
        lines = []
        for text in texts:
            entry = {"text": text, "output_file": str(raw_dir / f"{uuid.uuid4().hex}.wav")}
            if speakers > 1:
                entry["speaker_id"] = random.randrange(speakers)
            lines.append(json.dumps(entry))
        result = subprocess.run(
            [str(PIPER_BIN.resolve()), "--model", voice, "--json-input",
             "--length_scale", str(ls), "--noise_scale", str(ns), "--noise_w", str(nw)],
            input="\\n".join(lines) + "\\n", text=True, capture_output=True, env=env,
        )
        if result.returncode != 0:
            log.warning("  piper failed for %s: %s", voice, result.stderr[-500:])

    log.info("  %s: %d clips in %d Piper runs", desc, remaining, len(groups))
    with ThreadPoolExecutor(max_workers=GEN_WORKERS) as pool:
        list(pool.map(synthesize, groups.items()))
    raw = [p for p in raw_dir.glob("*.wav") if p.stat().st_size > 44]
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as pool:
        list(pool.map(_resample_into, raw, [str(out_dir)] * len(raw), chunksize=64))
    shutil.rmtree(raw_dir, ignore_errors=True)
    log.info("  %s: %d new clips", desc, len(raw))
'''


def patch_trainer() -> None:
    path = Path("/trainer/train_mww.py")
    source = path.read_text()
    assert SYNTH_BEFORE in source, "trainer's piper call changed; update SPEAKER_PATCH"
    source = source.replace(SYNTH_BEFORE, SYNTH_AFTER)
    marker = "def synthesize_clip("
    source = source.replace(marker, SPEAKER_PATCH + "\n\n" + marker, 1)
    # Defined after the original, so the phases pick this one up.
    marker = "def phase_generate("
    assert marker in source, "trainer's generate phase moved; update BATCH_GENERATOR"
    source = source.replace(marker, BATCH_GENERATOR + "\n\n" + marker, 1)
    path.write_text(source)


image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "wget", "git", "build-essential", "libsndfile1")
    .pip_install(
        f"git+https://github.com/kahrendt/microWakeWord.git@{MWW_REF}",
        "tensorflow[and-cuda]>=2.16,<2.19",
        "pymicro-features>=2.0",
        "scipy>=1.10.0",
        "tqdm>=4.65.0",
        "huggingface_hub>=0.20.0",
        "PyYAML>=6.0",
        "numpy>=1.24.0,<2.0",
        "mmap_ninja>=0.8",
        "requests>=2.28",
        "pyarrow<20",  # the last line that still runs on NumPy 1
        "soundfile",
    )
    .run_commands(
        f"git clone {TRAINER_REPO} /trainer && cd /trainer && git checkout {TRAINER_REF}",
        "mkdir -p /piper && wget -q -O /tmp/piper.tgz " + PIPER_URL
        + " && tar -xzf /tmp/piper.tgz -C /piper && rm /tmp/piper.tgz",
    )
    .run_function(patch_trainer)
    .add_local_file(HERE / CONFIG, f"/trainer/{CONFIG}")
)

app = modal.App("packrat-wakeword", image=image)
volume = modal.Volume.from_name("packrat-wakeword", create_if_missing=True)


def _workdir() -> Path:
    """The trainer works in ./training; keep that on the volume, with the image's piper in it."""
    import os

    work = Path(VOLUME_DIR) / "run"
    piper = work / "training" / "piper_binary"
    piper.mkdir(parents=True, exist_ok=True)
    if not (piper / "piper").exists():
        (piper / "piper").symlink_to("/piper/piper")
    os.chdir(work)
    return work


def _trainer(*phases: str) -> None:
    import subprocess

    for phase in phases:
        subprocess.run(
            ["python", "/trainer/train_mww.py", "--config", f"/trainer/{CONFIG}", "--phase", phase],
            check=True,
        )
        volume.commit()


def _download_rirs(dest: Path) -> None:
    from huggingface_hub import snapshot_download

    if dest.is_dir() and any(dest.glob("*.wav")):
        return
    snapshot_download(
        "davidscripka/MIT_environmental_impulse_responses",
        repo_type="dataset",
        local_dir=str(dest.parent.parent / "mit_rirs_download"),
        allow_patterns=["16khz/*"],
    )
    dest.parent.mkdir(parents=True, exist_ok=True)
    (dest.parent.parent / "mit_rirs_download" / "16khz").rename(dest)


def _download_background(dest: Path) -> None:
    """AudioSet clips as 16 kHz mono WAVs, for the background-noise augmentation."""
    import io

    import numpy as np
    import pyarrow.parquet as pq
    import scipy.io.wavfile
    import scipy.signal
    import soundfile
    from huggingface_hub import hf_hub_download

    if dest.is_dir() and len(list(dest.glob("*.wav"))) > 1000:
        return
    dest.mkdir(parents=True, exist_ok=True)
    written = 0
    for shard in AUDIOSET_SHARDS:
        path = hf_hub_download("agkphysics/AudioSet", shard, repo_type="dataset")
        table = pq.read_table(path, columns=["audio"])
        for row in table.column("audio").to_pylist():
            try:
                data, rate = soundfile.read(io.BytesIO(row["bytes"]), dtype="float32")
            except Exception:
                continue
            if data.ndim > 1:
                data = data.mean(axis=1)
            if rate != 16_000:
                data = scipy.signal.resample_poly(data, 16_000, rate)
            pcm = np.clip(data * 32767, -32768, 32767).astype(np.int16)
            scipy.io.wavfile.write(dest / f"audioset_{written:05d}.wav", 16_000, pcm)
            written += 1
    print(f"background: {written} clips")


@app.function(volumes={VOLUME_DIR: volume}, cpu=32, memory=65_536, timeout=12 * 60 * 60)
def prepare() -> None:
    """Augmentation data, Piper voices, TTS clips and features. CPU-bound, so many cores, no GPU."""
    import os

    os.environ["MWW_GEN_WORKERS"] = "30"
    work = _workdir()
    _download_rirs(work / "training" / "mit_rirs" / "16khz")
    _download_background(work / "training" / "background")
    volume.commit()
    _trainer("setup", "voices", "generate", "features")


@app.function(volumes={VOLUME_DIR: volume}, gpu="L4", cpu=8, memory=65_536, timeout=6 * 60 * 60)
def train() -> None:
    import shutil

    work = _workdir()
    _trainer("train", "export")
    out = Path(VOLUME_DIR) / "out"
    out.mkdir(exist_ok=True)
    for suffix in ("_mww.tflite", "_mww.json"):
        shutil.copy(work / f"{MODEL}{suffix}", out / f"{MODEL}{suffix}")
    volume.commit()


@app.local_entrypoint()
def main() -> None:
    prepare.remote()
    train.remote()


@app.local_entrypoint()
def fetch() -> None:
    assets = HERE.parent / "android" / "src" / "main" / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    for suffix in ("_mww.tflite", "_mww.json"):
        name = f"{MODEL}{suffix}"
        (assets / name).write_bytes(b"".join(volume.read_file(f"out/{name}")))
        print(f"wrote {assets / name}")
