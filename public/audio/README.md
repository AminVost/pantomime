# Packaged game audio

- `timeout-original.m4a`: exact user-provided timeout recording (2026-10-31).
- `end.m4a`: filtered/levelled version of that recording, AAC 48 kHz, 192 kbps; full 3.04 seconds preserved.
- `neon.m4a`: original 120 BPM electro-funk loop, 32 seconds.
- `playful.m4a`: original 110 BPM marimba/bell loop, 34.909 seconds.
- `start`, `correct`, `win`, `tick`: original synthesized cues.

The original compositions are not commercial chart recordings; no popularity/ranking claim is made. All playback is offline. The optional authoring script `mobile/scripts/generate-audio.mjs` recreates music/cues with Node and ffmpeg; ordinary builds use the checked-in assets without ffmpeg. The original timeout recording is preserved for future processing and excluded from Android packaging.

Timeout processing: high-pass at 70 Hz, loudness normalization around -16 LUFS, true-peak ceiling -1.5 dBTP. Playback cannot override the phone's media volume. Device speaker/listening checks remain necessary.
