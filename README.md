
# ReMindMap Frontend (Next.js + TypeScript)

This is the frontend for **ReMindMap**, a web application designed to make audio/video content more accessible, especially for neurodiverse users and those with communication difficulties such as aphasia.

The frontend allows users to upload or record videos, which are then processed by a Flask-based backend for summarization and mindmap generation.

## Features

- Upload or record video/audio in-browser
- Extracts audio using `ffmpeg.wasm` on the client ( currently this is done in backend)
- Sends audio to Flask backend for:
  - Transcription (via Whisper)
  - Summarization (via T5 or Gemini)
  - Mindmap generation
- Displays:
  - Time-stamped chapter summaries
  - Interactive and aphasia-friendly mind maps
  - Auto narration with adjustable speed
  - Fullscreen mindmap view with emoji and narration text
- Mobile handoff via QR code for mindmap viewing

##  Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Client Audio Extraction**: `ffmpeg.wasm`
- **State Management**: React context
- **Deployment**: Vercel

##  Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

##  Key Files

- `index.tsx`: Homepage for upload/record/YouTube link input
- `video/[id].tsx`: Dynamic route to display summaries and mindmaps
- `lib/summarizer.ts`: summarizer helpers 
- `lib/config.ts` : all endpoints
- `hooks/useVideoSummarizer.ts`: Custom React hooks (e.g., for TTS, scroll behavior)

##  Backend

See the [ReMindMap Backend Repository](https://github.com/Dwitee/youtube-summary-backend-gcp) for API details.

##  License

MIT License. © 2025 Dwitee Krishna Panda