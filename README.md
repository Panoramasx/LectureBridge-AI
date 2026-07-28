# LectureBridge AI

LectureBridge AI is a bilingual classroom assistant for Chinese international students attending English-taught university lectures. It combines live microphone transcription, course-specific glossary preheating, real-time Chinese comprehension support, rescue explanations for missed lecture segments, and post-class study material generation.

The app is built as a React + Vite frontend with an Express server that calls Qwen/DashScope from server-side API routes.

## Features

- **Course glossary preheating**: Paste a syllabus, lecture outline, or slide text before class and generate bilingual academic terms.
- **Live lecture workspace**: Use the browser microphone or built-in simulated lecture scripts to produce lecture transcript chunks.
- **Real-time Chinese understanding layer**: Summarize each English lecture segment into a concise Chinese takeaway, difficulty score, context bridge, and detected jargon.
- **Term highlighting**: Highlight known glossary terms in the transcript and show Chinese explanations on hover.
- **Progressive summaries**: Generate block-level Chinese summaries with key concepts and quick catch-up text.
- **Listening rescue button**: Capture a confusing segment and get a Chinese explanation, sentence breakdown, key vocabulary, analogy, and a suggested English question for the professor or TA.
- **Post-class study mode**: Convert lecture transcripts into Cornell notes, bilingual flashcards, and quiz questions.
- **Preset demo courses**: Includes sample Economics, Computer Science, and Biology course data for local demos.

## Tech Stack

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 4 via `@tailwindcss/vite`
- Express 4
- Qwen/DashScope text generation via OpenAI-compatible API
- Qwen LiveTranslate realtime audio through a server-side WebSocket proxy
- Lucide React icons
- Motion dependency available for UI animation

## Project Structure

```text
.
├── server.ts                    # Express server, Qwen API routes, realtime WS proxy, Vite/static hosting
├── src/
│   ├── App.tsx                  # Top-level view state and shared session state
│   ├── main.tsx                 # React entry point
│   ├── index.css                # Tailwind import and custom glass/gradient utilities
│   ├── types.ts                 # Shared TypeScript domain types
│   ├── data/
│   │   └── presetCourses.ts     # Demo courses, glossaries, and simulated lecture scripts
│   └── components/
│       ├── Navbar.tsx
│       ├── PreheatView.tsx
│       ├── LiveWorkspace.tsx
│       ├── RescueModal.tsx
│       ├── StudyModeView.tsx
│       ├── PrivacyBanner.tsx
│       └── RemoteMicModal.tsx
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── metadata.json
└── .env.example
```

## Prerequisites

- Node.js 20.19 or newer is recommended because the current Vite React plugin release declares that engine range.
- A DashScope/Qwen API key.
- A modern browser with microphone support if you want to test real audio input.

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Set your Qwen/DashScope API configuration in `.env`:

```env
DASHSCOPE_API_KEY="your_dashscope_api_key"
QWEN_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
QWEN_AUDIO_BASE_URL=""
QWEN_REALTIME_WS_URL="wss://dashscope.aliyuncs.com/api-ws/v1/realtime"
QWEN_CHAT_MODEL="qwen3.7-plus"
QWEN_REALTIME_MODEL="qwen3.5-livetranslate-flash-realtime"
QWEN_AUDIO_HTTP_MODEL="qwen3-livetranslate-flash"
QWEN_HTTP_TIMEOUT_MS="45000"
INVITE_CODE="CHANGE_ME"
PORT="3000"
APP_URL="http://localhost:3000"
```

`APP_URL` is mainly useful in hosted environments. For local development, `http://localhost:3000` is sufficient.

## Development

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

The Express server runs on port `3000` and mounts Vite middleware in development, so the frontend and API routes are served from the same origin.

## Production Build

Build the frontend and bundle the server:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

In production mode, `server.ts` serves the built files from `dist`.

## Useful Scripts

```bash
npm run dev      # Start Express + Vite development server
npm run build    # Build Vite app and bundle server to dist/server.cjs
npm start        # Run bundled production server
npm run lint     # Type-check with tsc --noEmit
npm run clean    # Remove generated dist/server.js artifacts
```

## API Routes

All AI features are exposed through server-side routes so the Qwen/DashScope API key is not used directly in browser code.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check for the server |
| `POST` | `/api/auth/verify` | Verify optional self-hosted invite code |
| `POST` | `/api/preload-syllabus` | Extract bilingual academic glossary terms from course material |
| `POST` | `/api/analyze-chunk` | Analyze one lecture transcript segment |
| `POST` | `/api/progressive-summary` | Generate a block-level Chinese lecture summary |
| `POST` | `/api/rescue-analysis` | Explain a confusing lecture snippet in detail |
| `POST` | `/api/transcribe-audio` | HTTP short-audio fallback through `qwen3-livetranslate-flash` streaming Chat Completions |
| `POST` | `/api/generate-study-notes` | Generate Cornell notes, flashcards, and quiz questions |
| `WS` | `/api/live-audio` | Proxy realtime PCM16 audio chunks to Qwen LiveTranslate |

## Typical Workflow

1. Select a preset course from the navigation bar.
2. Open **术语预热** and paste a syllabus, lecture outline, or slide summary.
3. Generate or manually add bilingual glossary terms.
4. Open **课堂实时**.
5. Use **模拟讲课原音** for a demo, or enable the local microphone for real lecture audio.
6. Read the live English transcript, Chinese takeaway, detected terms, and generated summaries.
7. Click **听力救生圈** when a lecture segment is confusing.
8. Open **课后复习** to generate Cornell notes, flashcards, and quiz questions from the transcript.

## Notes and Limitations

- Real microphone input uses the browser `MediaRecorder` API and sends recorded audio chunks to the backend for transcription.
- The current app stores transcript, glossary, rescue history, and generated notes in React state only. Refreshing the page clears the session.
- `RemoteMicModal.tsx` is currently a UI prototype for a phone-based remote microphone flow and is not wired into the main workspace.
- Realtime microphone input is captured with Web Audio, converted to 16kHz PCM16 in the browser, sent to this backend over WebSocket, then proxied to Qwen LiveTranslate. The API key is never exposed to browser code.
- The HTTP short-audio fallback uses `qwen3-livetranslate-flash`, which Alibaba Cloud documents as an OpenAI-compatible streaming API that may require a workspace-specific `QWEN_AUDIO_BASE_URL`; keep it separate from the text endpoint when needed.
- AI responses depend on Qwen/DashScope model availability and the configured `DASHSCOPE_API_KEY`.
- The server currently listens on port `3000`.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DASHSCOPE_API_KEY` | Yes | Qwen/DashScope API key used by server-side AI routes |
| `QWEN_BASE_URL` | No | OpenAI-compatible text API endpoint |
| `QWEN_AUDIO_BASE_URL` | No | Optional dedicated OpenAI-compatible endpoint for `qwen3-livetranslate-flash` HTTP audio fallback |
| `QWEN_REALTIME_WS_URL` | No | Qwen LiveTranslate realtime WebSocket endpoint |
| `QWEN_CHAT_MODEL` | No | Text analysis model, defaults to `qwen3.7-plus` |
| `QWEN_REALTIME_MODEL` | No | Realtime audio model, defaults to `qwen3.5-livetranslate-flash-realtime` |
| `QWEN_AUDIO_HTTP_MODEL` | No | HTTP audio fallback model, defaults to `qwen3-livetranslate-flash` |
| `QWEN_HTTP_TIMEOUT_MS` | No | Server-side Qwen request timeout, defaults to `45000` |
| `INVITE_CODE` | No | Optional self-hosted access gate value for future access control work |
| `PORT` | No | Server port, defaults to `3000` |
| `APP_URL` | No for local dev | Hosted app URL or local app URL |

## License

No license file is included in this repository. Add one before distributing or publishing the project.
