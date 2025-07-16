# Video Summarizer Frontend (TypeScript + Next.js)

This is a frontend web app for uploading video files, extracting audio client-side, and sending it to a Flask backend running on a GCP VM for summarization.

## Steps

1. Upload a video
2. Audio is extracted in-browser (via ffmpeg.wasm)
3. Audio is sent to `/summarize-upload` on the backend
4. The summary is displayed

## Development

```bash
npm install
npm run dev
```