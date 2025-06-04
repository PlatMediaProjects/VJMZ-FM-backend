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
 'https://radio.vjmz-fm.com/radio/8000/stream';
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

import express from "express";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

const router = express.Router();

// POST /contact
router.post("/contact", async (req, res) => {
  const { name, email, comments } = req.body;

  // Validate fields
  if (!name || !email || !comments) {
    return res.status(400).json({ error: "All fields are required." });
  }

  // Save to local file (optional step for recordkeeping)
  const record = `${new Date().toISOString()} | ${name} <${email}>: ${comments}\n`;
  fs.appendFile(
    path.resolve("./submissions/contact.log"),
    record,
    (err) => err && console.error("Log error:", err)
  );

  try {
    // Configure email
    const transporter = nodemailer.createTransport({
      service: "SendGrid", // or "gmail" or any other SMTP
      auth: {
        user: process.env.SENDGRID_USER,
        pass: process.env.SENDGRID_PASS
      }
    });

    const mailOptions = {
      from: email,
      to: "talk2us@vjmz-fm.com",
      subject: `New Contact Form Submission from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${comments}`
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Message sent successfully." });
  } catch (error) {
    console.error("Mail error:", error);
    res.status(500).json({ error: "Failed to send email." });
  }
});
app.post('/music/submit', upload.single('track_file'), (req, res) => {
  const { artist_name, track_title, contact_email, message } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }

  // Log or handle data
  console.log('Received music submission:', {
    artist_name,
    track_title,
    contact_email,
    message,
    filename: file.originalname
  });

  res.json({ success: true, message: 'Music submitted successfully.' });
});

export default router;

