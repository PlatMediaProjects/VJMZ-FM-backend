const express = require('express');
const http = require('http');
const app = express();

const PORT = process.env.PORT || 3000;

// Stream proxy route
app.get('/stream', (req, res) => {
  const streamUrl = 'http://cast3.my-control-panel.com:7535/;stream.mp3';
  http.get(streamUrl, (streamRes) => {
    res.setHeader('Content-Type', 'audio/mpeg');
    streamRes.pipe(res);
  }).on('error', (err) => {
    console.error('Stream Error:', err.message);
    res.status(500).send('Stream Unavailable');
  });
});

// Basic root message
app.get('/', (req, res) => {
  res.send('🎧 VJMZ-FM Backend is Live');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for Render-hosted PostgreSQL
});
app.use(express.json()); // Needed to parse JSON request bodies

app.post('/register', async (req, res) => {
  const { name, email, password, phone, sms_opt_in } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, phone, sms_opt_in)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, created_at`,
      [name, email, hashedPassword, phone || '', sms_opt_in || false]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Error during registration:', err.message);

    if (err.code === '23505') {
      res.status(409).json({ error: 'Email already registered.' });
    } else {
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
});




