// index.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const formData = require("form-data");
const Mailgun = require("mailgun.js");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- health check for Render ---
app.get("/health", (_req, res) => res.status(200).send("ok"));

// --- Mailgun client ---
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY,
});

// --- CONTACT ROUTE ---
// Matches: https://api.vjmz-fm.com/api/contact  (POST)
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: name, email, message",
      });
    }

    const subject = `New contact form message from ${name}`;
    const text = `
From: ${name} <${email}>
Phone: ${phone || "(not provided)"}

Message:
${message}
    `.trim();

    const html = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || "(not provided)"}</p>
      <p><strong>Message:</strong></p>
      <p>${String(message).replace(/\n/g, "<br>")}</p>
    `;

    // Use your Mailgun domain (e.g., mg.vjmz-fm.com)
    const domain = process.env.MAILGUN_DOMAIN;

    await mg.messages.create(domain, {
      from: `VJMZ-FM <${process.env.FROM_EMAIL}>`,
      to: process.env.TO_EMAIL,
      subject,
      text,
      html,
      "h:Reply-To": email, // so you can reply directly to the sender
    });

    return res.status(200).json({ ok: true, message: "Message sent" });
  } catch (err) {
    console.error("Mailgun error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to send message" });
  }
});

// --- single-listener guard (safe on Render) ---
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  if (!app.locals.__serverStarted) {
    app.locals.__serverStarted = true;
    app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
  }
}

module.exports = app;
