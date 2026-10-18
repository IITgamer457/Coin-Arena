# CaptionCraft MVP

Responsive static site with local video preview, browser microphone speech recognition where supported, editable/timed caption lines, SRT/VTT export, Hinglish option, and optional NVIDIA Nemotron transcript cleanup via Cloudflare Worker.

## Current limitation
This site does not yet extract or transcribe the uploaded video's audio. Uploaded video stays local for preview. Microphone mode uses browser speech recognition. Nemotron cleans transcript text; it is not an audio transcription engine.

## Deploy
This folder is under `captioncraft/` in the repository. For Pages connected to GitHub, use root directory `captioncraft`, leave the build command empty, and set the output directory to `.`. Create a separate Pages project. Do not change the settings of the existing `coinarena-app` project.

Worker source: `worker/index.js`. See `worker/README.md`. Set the public Worker URL in `config.js`; never store the NVIDIA API key in frontend files.