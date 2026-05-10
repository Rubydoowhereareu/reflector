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

// Evaluate whether user's answer is sufficient for the question
app.post('/api/evaluate', async (req, res) => {
  const anthropicKey = req.headers['x-anthropic-key'];
  if (!anthropicKey) return res.status(400).json({ error: 'No Anthropic key' });
  const { question, answer, section } = req.body;
  if (!question || !answer) return res.status(400).json({ sufficient: true });

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
        max_tokens: 200,
        system: `You are assessing whether a physiotherapy specialist's spoken reflection answer is sufficient for the question asked.

Return ONLY valid JSON: {"sufficient": true/false, "prompt": "follow-up question if not sufficient"}

Rules:
- sufficient=true if the answer has meaningful content (more than 2-3 sentences or ~30 words)
- sufficient=false if the answer is very brief, vague, or clearly incomplete
- If sufficient=false, prompt should be a single natural spoken follow-up question to draw out more depth
- Never be harsh — keep prompts warm and curious
- If sufficient=true, prompt can be empty string`,
        messages: [{ role: 'user', content: `Section: ${section}\nQuestion: ${question}\nAnswer: ${answer}\n\nAssess:` }],
      }),
    });
    if (!response.ok) return res.json({ sufficient: true, prompt: '' });
    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json({ sufficient: parsed.sufficient !== false, prompt: parsed.prompt || '' });
  } catch (e) {
    res.json({ sufficient: true, prompt: '' });
  }
});


// OpenAI Text-to-Speech
app.post('/api/speak', async (req, res) => {
  const openaiKey = req.headers['x-openai-key'];
  if (!openaiKey) return res.status(400).json({ error: 'No OpenAI key' });
  const { text, voice } = req.body;
  if (!text) return res.status(400).json({ error: 'No text' });
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: 'tts-1', input: text, voice: voice || 'nova', response_format: 'mp3' }),
    });
    if (!response.ok) { const e = await response.json(); return res.status(response.status).json({ error: e.error?.message }); }
    const buffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(buffer));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Reflector running at http://localhost:${PORT}`));
