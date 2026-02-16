require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { AccessToken } = require('livekit-server-sdk');
const Groq = require('groq-sdk');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());


const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});




app.post('/token', async (req, res) => {
  try {
    const { name, room, role } = req.body;
    console.log("📥 TOKEN REQUEST BODY:", req.body);

    if (!name || !room || !role) {
      return res.status(400).json({ error: "Missing name, room, or role" });
    }

    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET || !process.env.LIVEKIT_URL) {
      return res.status(500).json({ error: "LiveKit ENV variables missing" });
    }

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: name,
        metadata: JSON.stringify({ role }),
      }
    );

    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await at.toJwt();
    console.log("✅ TOKEN GENERATED for:", name, "ROLE:", role);

    res.json({
      token: jwt,
      url: process.env.LIVEKIT_URL,
    });
  } catch (e) {
    console.error("❌ TOKEN ERROR:", e);
    res.status(500).json({ error: "Token generation failed" });
  }
});


app.post('/ask-ai', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content:
            'You are a teacher assistant. Answer clearly in short or medium length.',
        },
        {
          role: 'user',
          content: question,
        },
      ],
      temperature: 0.3,
    });

    const answer = completion.choices[0]?.message?.content;

    res.json({ answer });
  } catch (err) {
    console.error('❌ GROQ ERROR:', err);
    res.status(500).json({ error: 'AI response failed' });
  }
});


app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
