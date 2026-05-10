# Reflector — Physiotherapy Specialist Reflection Tool

A voice-first dictaphone for structured physiotherapy specialist reflections.

## What it does

- Walk through 8 structured reflection sections
- Record your voice in each section
- Transcript is automatically cleaned (filler words removed, formatting improved)
- Export your completed reflection as a formatted document
- Sessions save automatically and persist between visits
- Works on desktop and mobile

## Setup (5 minutes)

### 1. Install Node.js
Download from https://nodejs.org — get the LTS version.

### 2. Install dependencies
Open a terminal in this folder and run:
```
npm install
```

### 3. Start the app
```
npm start
```

Then open http://localhost:3000 in your browser.

### 4. Add your API keys (optional but recommended)

When you first open the app, it will ask for two keys:

**OpenAI key** — enables voice-to-text (Whisper transcription)
- Go to https://platform.openai.com/api-keys
- Create a new key
- Cost: roughly $0.006 per minute of audio (very cheap)

**Anthropic key** — enables intelligent transcript cleanup
- Go to https://console.anthropic.com/settings/keys
- Create a new key  
- Cost: a few cents per reflection session

Both are optional. Without them, you can still type your reflections manually.

---

## Using the app

1. Click **New reflection**
2. Work through each section — tap the microphone to record
3. Tap the mic again (or the stop square) when done speaking
4. Your transcript appears, cleaned and formatted
5. Use **Next →** to move to the next section
6. Use **← Back** to go back at any time
7. Click the **progress bar segments** at the top to jump to any section
8. When done, press **Export reflection** to get a formatted document

### Tips
- You can **type instead** of speaking — tap "Type instead" below the mic button
- You can **add more** to a section by recording again — it appends to what's there
- Sessions **autosave** — close and reopen anytime
- On mobile, you can add this to your home screen as a PWA

---

## Deploy to the web (to use on your phone without running a server)

### Easiest: Railway
1. Create a free account at https://railway.app
2. Connect your GitHub account
3. Upload this folder to a new GitHub repository
4. In Railway: New Project → Deploy from GitHub → select your repo
5. It will deploy automatically and give you a URL

### Also works: Render, Fly.io, Heroku

---

## File structure

```
reflector/
├── server.js          — Express server (handles Whisper + Claude API calls)
├── package.json       — Dependencies
├── public/
│   ├── index.html     — The entire app (HTML + CSS + JS)
│   └── manifest.json  — PWA configuration
└── README.md          — This file
```

---

## Privacy

- API keys are stored only in your browser's localStorage
- Audio is sent directly to OpenAI's Whisper API for transcription
- Transcripts are sent to Anthropic's Claude API for cleanup
- Nothing is stored on any server — all data lives in your browser
- Clearing your browser data will clear your sessions

---

## Costs (estimated)

For personal use:
- Whisper: ~$0.006/minute of audio
- Claude Haiku cleanup: ~$0.002 per reflection
- Server hosting (Railway free tier): $0

**Total estimated cost: under $2 AUD/month for regular personal use**
