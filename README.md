# Insight Observer

A React + Vite app where an AI observes a user's webcam reactions to a YouTube video, interviews them about it afterward, and writes a final sentiment report.

## Features

1. **YouTube Video Metadata** — paste a URL, get the title, duration, description, and transcript.
2. **Visual Evaluation** — turn on your webcam and play the video; up to 20 frames are captured (spaced evenly across the video's duration) and sent together to `gpt-5.6` for one consolidated evaluation of your visible reactions.
3. **Interview** — click "Start Interview" to chat with an AI that has your video metadata and visual evaluation as context; it asks what you liked/disliked and references specific facial expressions and timestamps.
4. **Final Synthesis** — click "End Chat" to generate a final written report combining the interview and visual evaluation into an overall sentiment summary.

## Setup

```bash
npm install
```

Create a `.env` file in the project root (this is gitignored — never commit it):

```
VITE_OPENAI_API_KEY=sk-...
```

## Run

```bash
npm run dev
```

Open the printed URL (usually http://localhost:5173).

## Notes

- The webcam and YouTube playback must both be active for frame capture to record — frames are only captured while the video is playing.
- `ai_grading/` contains the exact prompt, visual evaluation, video metadata, and final report from a real test run using [The Odyssey official trailer](https://www.youtube.com/watch?v=Mzw2ttJD2qQ).
