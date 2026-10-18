# CaptionCraft Nemotron Worker

This Cloudflare Worker polishes text already in the editor. It does not transcribe audio from uploaded video files; a separate speech-to-text engine is required for that.

## Deploy
1. Cloudflare Dashboard → Workers & Pages → Create → Worker; use the code from `worker/index.js`.
2. Worker Settings → Variables and Secrets: add `NVIDIA_API_KEY` as a **Secret** (not plain text). Get the key from https://build.nvidia.com/nvidia/nemotron-3-ultra-550b-a55b
3. Set `ALLOWED_ORIGIN` to your deployed Pages URL, e.g. `https://captioncraft.pages.dev` (no trailing slash).
4. Deploy, then check `https://YOUR-WORKER.workers.dev/health`.
5. Edit `captioncraft/config.js` to set `window.CAPTIONCRAFT_API_URL` to the Worker URL, then commit/redeploy.

## Security and limits
- Never put the NVIDIA key in frontend files or GitHub.
- NVIDIA endpoint availability and quotas can change.
- CORS origin checking does not authenticate callers; add stronger abuse protection before a public launch.
- The Worker sends caption text only, not the video file. Review output for transcription changes.
