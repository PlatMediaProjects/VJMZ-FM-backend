const express = require('express');
require('dotenv').config(); // Load environment variables
const bodyParser = require('body-parser');
const http = require('http');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path'); // ✅ YOU MUST ADD THIS LINE
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const app = express();
const PORT = process.env.PORT || 3000;
// ---- EMAIL STUB (paste near the top of index.js, after imports) ----
async function sendMailStub(msg) {
  console.log('EMAIL STUB → would send:', {
    to: msg.to || msg.To,
    from: msg.from || msg.From,
    subject: msg.subject || msg.Subject,
  });
  return { ok: true };
}


// Middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ✅ Add this here
app.use(express.static(path.join(__dirname, 'public')));

// Your database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Routes come next...
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



app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// 👉 Updated Route for Form Submission with File Uploads
// ---- SUBMIT AD AGREEMENT (with proper try/catch) ----
app.post(
  '/submit-ad-agreement',
  upload.fields([
    { name: 'adFile',  maxCount: 1 },
    { name: 'docFile', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        customerName, email, businessName, title,
        startDate, adLength, frequency, duration,
        weeks, notes, signature, dateSigned
      } = req.body;

      // (optional) attachments if you need them later:
      // const attachments = [];
      // for (const f of (req.files?.adFile || [])) attachments.push({ filename: f.originalname, path: f.path, contentType: f.mimetype });
      // for (const f of (req.files?.docFile || [])) attachments.push({ filename: f.originalname, path: f.path, contentType: f.mimetype });

      // You removed SendGrid — use the stub so the route still returns 200
      await sendMailStub({
        to: 'talk2us@vjmz-fm.com',
        from: 'noreply@vjmz-fm.com',
        subject: `Ad agreement from ${customerName || 'Unknown'}`,
        html: `<p>Business: ${businessName || ''}</p><p>Contact: ${email || ''}</p>`
      });

      // Redirect or JSON — pick one
      // return res.redirect('https://square.link/u/bumPwnJG');  // your Square link
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('submit-ad-agreement error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

  { name: 'adFile', maxCount: 1 },
  { name: 'docFile', maxCount: 1 }
]), async (req, res) => {
  const {
    customerName, email, businessName, title,
    startDate, adLength, frequency, duration,
    weeks, notes, signature, dateSigned
  } = req.body;

  const attachments = [];

  // Attach MP3 if uploaded
  if (req.files['adFile']) {
    const file = req.files['adFile'][0];
    attachments.push({
      content: file.buffer.toString("base64"),
      filename: file.originalname,
      type: file.mimetype,
      disposition: "attachment"
    });
  }

  // Attach document if uploaded
  if (req.files['docFile']) {
    const file = req.files['docFile'][0];
    attachments.push({
      content: file.buffer.toString("base64"),
      filename: file.originalname,
      type: file.mimetype,
      disposition: "attachment"
    });
  }

  const msg = {
    to: 'talk2us@vjmz-fm.com', // ✅ Replace with real email
    from: 'no-reply@vjmz-fm.com', // ✅ Verified sender in SendGrid
    subject: `New Advertising Agreement from ${customerName}`,
    html: `
      <h2>New Ad Agreement Submission</h2>
      <p><strong>Customer Name:</strong> ${customerName}</p>
      <p><strong>Email:</strong> ${email}</p>
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
    `,
    attachments
  };

  try {
  await sendMailStub({
  to: 'talk2us@vjmz-fm.com',
  from: 'noreply@vjmz-fm.com',
  subject: 'Form received',
  html: '<p>Submission logged.</p>'
});

  }
});

// Server start
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

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

  try 
  await sendMailStub({
  to: 'talk2us@vjmz-fm.com',
  from: 'noreply@vjmz-fm.com',
  subject: 'Form received',
  html: '<p>Submission logged.</p>'
});

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
    to: 'talk2us@vjmz-fm.com', // 🔁 Replace with your email
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


app.post('/submit-ad-agreement', upload.fields([
  { name: 'adCopy', maxCount: 1 },
  { name: 'bulletPoints', maxCount: 1 }
]), async (req, res) => {
  const formData = req.body;
  const files = req.files;

  console.log('Form submitted:', formData);
  console.log('Uploaded files:', files);

  // ✅ Redirect to Square payment page
  res.redirect('https://square.link/u/bumpWnJG');
});

// Start Server
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
// ✅ SINGLE LISTENER GUARD — paste at bottom of index.js
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  if (!app.locals.__serverStarted) {
    app.locals.__serverStarted = true;
    app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
  }
}

module.exports = app; // keep this as the final line


