# CaptionCraft AI

This directory contains an independent CaptionCraft MVP. Website: responsive static HTML/CSS/JS with browser speech recognition, editable captions and SRT/VTT export, plus optional NVIDIA Nemotron transcript cleanup through Cloudflare Worker.

Deploy this directory as a static Cloudflare Pages site; build command empty, output directory `captioncraft/`. Worker source is in `captioncraft/worker/index.js`. See `captioncraft/worker/README.md`.
