// index.js (CommonJS)

// ---------- Imports ----------
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const formData = require("form-data");
const Mailgun = require("mailgun.js");

// ---------- App & Middleware ----------
const app = express();

// Lock CORS to your sites; add more origins if needed
app.use(
  cors({
    origin: [
      "https://vjmz-fm.com",
      "https://www.vjmz-fm.com"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// ---------- Mailgun Client ----------
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY // required
});

// ---------- Health Check ----------
app.get("/health", (_req, res) => res.status(200).send("ok"));

// ---------- Utilities ----------
function htmlEscape(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------- Routes ----------
// POST /api/contact
// Expects JSON: { name, email, phone?, message }
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body || {};

    // Validate input
    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing required fields: name, email, message" });
    }

    // Validate server config
    const domain = process.env.MAILGUN_DOMAIN;      // e.g., "mg.vjmz-fm.com"
    const fromEmail = process.env.FROM_EMAIL;       // e.g., "no-reply@mg.vjmz-fm.com"
    const toEmail = process.env.TO_EMAIL;           // e.g., "talk2us@vjmz-fm.com"
    if (!domain || !fromEmail || !toEmail) {
      return res
        .status(500)
        .json({ ok: false, error: "Server email configuration missing (MAILGUN_DOMAIN, FROM_EMAIL, TO_EMAIL)" });
    }

    const subject = `New contact form message from ${name}`;
    const text = `From: ${name} <${email}>
Phone: ${phone || "(not provided)"}

Message:
${message}`.trim();

    const html = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${htmlEscape(name)}</p>
      <p><strong>Email:</strong> ${htmlEscape(email)}</p>
      <p><strong>Phone:</strong> ${htmlEscape(phone || "(not provided)")}</p>
      <p><strong>Message:</strong></p>
      <p>${htmlEscape(message).replace(/\n/g, "<br>")}</p>
    `;

    // Send via Mailgun
    const mgResp = await mg.messages.create(domain, {
      from: `VJMZ-FM <${fromEmail}>`,
      to: toEmail,
      subject,
      text,
      html,
      "h:Reply-To": email
    });

    if (!mgResp || !mgResp.id) {
      return res.status(502).json({ ok: false, error: "Mailgun did not return a message id" });
    }

    return res.status(200).json({ ok: true, message: "Message sent", id: mgResp.id });
  } catch (err) {
    const msg = err?.message || String(err);
    console.error("Mailgun error:", msg);
    return res.status(502).json({ ok: false, error: msg });
  }
});

// Fallback 404 for unknown routes
app.use((_req, res) => res.status(404).json({ ok: false, error: "Not found" }));

// ---------- Listener (Render-safe: single instance) ----------
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  if (!app.locals.__serverStarted) {
    app.locals.__serverStarted = true;
    app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
  }
}
module.exports = app;
