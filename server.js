const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Whisper transcription proxy
// Receives audio from browser, forwards to OpenAI Whisper, returns transcript
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const openaiKey = req.headers['x-openai-key'];
  if (!openaiKey) return res.status(400).json({ error: 'No OpenAI key provided' });
  if (!req.file) return res.status(400).json({ error: 'No audio file' });

  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: 'audio.webm',
      contentType: req.file.mimetype || 'audio/webm',
    });
    form.append('model', 'whisper-1');
    form.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, ...form.getHeaders() },
      body: form,
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Whisper error' });
    }

    const data = await response.json();
    res.json({ transcript: data.text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Claude transcript cleanup proxy
app.post('/api/cleanup', async (req, res) => {
  const anthropicKey = req.headers['x-anthropic-key'];
  if (!anthropicKey) return res.status(400).json({ error: 'No Anthropic key' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `You are a silent text formatter. You receive raw speech transcripts and return cleaned versions.

CRITICAL: Return ONLY the cleaned text. No greetings. No explanations. No questions. No preamble. No "I'm ready to...". If the input is empty or unclear, return it unchanged. Never ask for more context. Never respond conversationally. Just clean and return the text.

Cleaning rules:
- Fix grammar and punctuation
- Remove filler words: um, uh, er, like, you know, sort of, kind of, basically, haha
- Remove false starts and obvious repetitions
- Preserve uncertainty language: "I think", "maybe", "probably", "I wasn't sure"
- Preserve emotional language: "I felt", "I was nervous", "I wasn't confident"
- Keep the speaker's exact meaning and voice
- Convert obvious spoken lists into numbered lists
- Do not summarise, shorten, or rewrite meaning
- Do not use formal academic language`,
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Claude error' });
    }

    const data = await response.json();
    res.json({ cleaned: data.content?.[0]?.text || text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve app for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Reflector running at http://localhost:${PORT}`));
