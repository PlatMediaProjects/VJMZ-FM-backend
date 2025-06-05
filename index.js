const express = require('express');
const http = require('http');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const app = express();
const PORT = process.env.PORT || 3000; 

// Middleware to parse JSON bodies
app.use(express.json());

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Stream proxy route (optional)
app.get('/stream', (req, res) => {
  const streamUrl = 'https://radio.vjmz-fm.com/radio/8000/stream';
  http.get(streamUrl, (streamRes) => {
    res.setHeader('Content-Type', 'audio/mpeg');
    streamRes.pipe(res);
  }).on('error', (err) => {
    console.error('Stream Error:', err.message);
    res.status(500).send('Stream Unavailable');
  });
});
app.post('/music/submit', upload.single('track_file'), (req, res) => {
  const { artist_name, track_title, contact_email, message } = req.body;
  const trackFile = req.file;

  if (!trackFile) {
    return res.status(400).send('No file uploaded.');
  }

  console.log('Music Submission Received:', {
    artist_name,
    track_title,
    contact_email,
    message,
    filename: trackFile.originalname,
  });

  // Optional: Store or email the submission

  res.status(200).send('Music submitted successfully!');
});
app.post('/advertise', express.urlencoded({ extended: true }), (req, res) => {
  const { company_name, contact_name, email, phone, message } = req.body;

  console.log("New advertising inquiry received:", {
    company_name,
    contact_name,
    email,
    phone,
    message,
  });

  // You can optionally: send an email, store to DB, etc.
  res.status(200).send('Advertising inquiry submitted successfully!');
});

// Root route
app.get('/', (req, res) => {
  res.send('🎧 VJMZ-FM Backend is Live');
});

// POST /register route
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
    console.error('Registration Error:', err.message);
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email already registered.' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/advertise', express.urlencoded({ extended: true }), async (req, res) => {
  const { company_name, contact_name, email, phone, message } = req.body;

  // 1. Save to PostgreSQL
  try {
    await pool.query(
      'INSERT INTO advertising_inquiries (company_name, contact_name, email, phone, message) VALUES ($1, $2, $3, $4, $5)',
      [company_name, contact_name, email, phone, message]
    );
  } catch (err) {
    console.error('Database insert error:', err);
    return res.status(500).send('Error saving to database.');
  }

  // 2. Send email notification
  const msg = {
    to: 'talk2us@vjmz-fm.com',
    from: 'no-reply@vjmz-fm.com',
    subject: 'New Advertising Inquiry',
    html: `
      <h2>Advertising Inquiry Received</h2>
      <p><strong>Company:</strong> ${company_name}</p>
      <p><strong>Contact:</strong> ${contact_name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Message:</strong><br>${message}</p>
    `,
  };

  try {
    await sgMail.send(msg);
    res.status(200).send('Inquiry received successfully!');
  } catch (err) {
    console.error('SendGrid error:', err.response?.body || err.message);
    res.status(500).send('Error sending email.');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// 📍 backend/contactHandler.js
// This backend handler will save contact form submissions and send them via email to talk2us@vjmz-fm.com



