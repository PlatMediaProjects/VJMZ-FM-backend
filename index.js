const express = require('express');
require('dotenv').config(); // Load environment variables

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const http = require('http');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const multer = require('multer');
const storage = multer.memoryStorage(); 
const upload = multer({ storage: storage });

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Root route
app.get('/', (req, res) => {
  res.send('🎧 VJMZ-FM Backend is Live');
});

// Stream proxy route
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

// Register route
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

// Submit Music
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

  res.status(200).send('Music submitted successfully!');
});

// Advertising Form

app.post('/advertise', async (req, res) => {
  const { company_name, contact_name, email, phone, message } = req.body;

  try {
    await pool.query(
      'INSERT INTO advertising_inquiries (company_name, contact_name, email, phone, message) VALUES ($1, $2, $3, $4, $5)',
      [company_name, contact_name, email, phone, message]
    );
  } catch (err) {
    console.error('Database insert error:', err);
    return res.status(500).send('Error saving to database.');
  }

  const msg = {
    to: process.env.TO_EMAIL,
from: process.env.FROM_EMAIL,

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
app.post('/submit-ad-agreement', async (req, res) => {
  const {
    customerName,
    businessName,
    title,
    startDate,
    adLength,
    frequency,
    duration,
    weeks,
    notes,
    signature,
    dateSigned
  } = req.body;

  const msg = {
    to: 'your-email@vjmz-fm.com', // 🔁 Replace with your email
    from: 'no-reply@vjmz-fm.com', // ✅ Must be verified in SendGrid
    subject: `New Advertising Agreement from ${customerName}`,
    html: `
      <h2>VJMZ-FM Advertising Agreement Submission</h2>
      <p><strong>Customer Name:</strong> ${customerName}</p>
      <p><strong>Business Name:</strong> ${businessName}</p>
      <p><strong>Title:</strong> ${title}</p>
      <p><strong>Start Date:</strong> ${startDate}</p>
      <p><strong>Ad Length:</strong> ${adLength} seconds</p>
      <p><strong>Frequency:</strong> ${frequency} times/day</p>
      <p><strong>Duration:</strong> ${duration} days</p>
      <p><strong>Weeks:</strong> ${weeks}</p>
      <p><strong>Notes:</strong> ${notes}</p>
      <p><strong>Signature:</strong> ${signature}</p>
      <p><strong>Date Signed:</strong> ${dateSigned}</p>
    `
  };

  try {
    await sgMail.send(msg);
    res.send("✅ Success! Your agreement has been submitted and emailed.");
  } catch (error) {
    console.error("SendGrid error:", error);
    res.status(500).send("❌ Submission failed. Please try again later.");
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.get('/test-db', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.status(200).json({
      status: 'success',
      message: 'Database connected!',
      time: result.rows[0].now
    });
  } catch (error) {
    console.error('DB test failed:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to the database',
      error: error.message
    });
  }
});


