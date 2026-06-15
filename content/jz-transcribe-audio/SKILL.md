---
name: jz-transcribe-audio
description: Transcribe audio and video files to Chinese text using the GLM ASR API. Use when the user wants to convert a voice memo, meeting recording, interview, or video into text. Supports common formats (m4a, mp3, wav, mp4, mov) via automatic ffmpeg conversion. Handles files of any length by splitting into 30-second segments internally.
---

# Transcribe Audio

Use this skill to turn audio or video into Chinese text via [GLM-ASR-2512](https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-asr-2512).

## Quick Start

```bash
python3 /Users/hwang/Projects/jinzheceo/jzskills/content/transcribe-audio/scripts/transcribe.py ~/Downloads/录音.m4a
```

Output defaults to `<input-basename>.txt` next to the input file. Override with `-o`:

```bash
python3 /Users/hwang/Projects/jinzheceo/jzskills/content/transcribe-audio/scripts/transcribe.py ~/Downloads/录音.m4a -o ~/Downloads/转录.txt
```

## How It Works

1. If the input is not MP3, ffmpeg converts it to MP3 (128 kbps).
2. Audio longer than 30 seconds is split into 30‑second segments.
3. Each segment is posted to the GLM ASR endpoint (`glm-asr-2512`).
4. Results are concatenated and written to the output file.

## Supported Formats

Via ffmpeg auto‑conversion: m4a, wav, mp3, mp4, mov, flac, ogg, webm, aac, and most common audio/video containers.

## Credentials

API key lookup order:

1. `~/.config/skills/transcribe-audio/.env` ← recommended
2. `<skill-root>/.env`
3. `GLM_API_KEY` environment variable

Each source is a simple `GLM_API_KEY=<key>` line.

## Pricing

GLM-ASR-2512 costs **¥0.06 / minute**. A 14‑minute recording costs ~¥0.85.

## Limits

- Max file size: 25 MB
- Max segment duration: 30 seconds (script splits longer files automatically)
- Supported segment formats: wav, mp3

## Caveats

- glm-asr-2512 is a recent model (Dec 2025). If the API returns an "unknown model" error, check the [official docs](https://docs.bigmodel.cn/api-reference/模型-API/语音转文本) for the current model name.
- The 30‑second split uses ffmpeg segment copy, so boundaries may occasionally fall mid‑word — adjacent segments usually cover the gap.
- Very short segments (a few seconds of silence) may produce empty or garbled output.
