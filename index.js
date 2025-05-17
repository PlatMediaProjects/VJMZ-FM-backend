// VJMZ-FM Listener + Admin System with Homepage

const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { Pool } = require('pg');
const app = express();n
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'vjmz_secret',
  resave: false,
  saveUninitialized: true
}));

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/vjmz'
});

// Create listeners table (run once or with migrations)
db.query(`CREATE TABLE IF NOT EXISTS listeners (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  subscribed BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

// Middleware to protect admin routes
function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.status(403).send('Forbidden');
}

// Homepage route (branded layout)
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>VJMZ-FM | The #1 JAM’N Station Online</title>
        <style>
          body {
            background: #111;
            color: #FFD700;
            font-family: 'Segoe UI', sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          h1 {
            font-size: 3em;
            color: #fff;
          }
          p {
            font-size: 1.2em;
            max-width: 600px;
          }
          a {
            color: #FFD700;
            text-decoration: none;
            margin: 0 8px;
          }
          .nav {
            margin-top: 2rem;
          }
        </style>
      </head>
      <body>
        <h1>🎧 VJMZ-FM</h1>
        <p>Welcome to the Internet’s #1 JAM’N Station — now streaming everywhere 24/7!</p>
        <div class="nav">
          <a href="/signup">Sign Up</a>
          <a href="/signin">Sign In</a>
          <a href="/admin/login">Admin Login</a>
        </div>
      </body>
    </html>
  `);
});

// Admin login route
app.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASS = process.env.ADMIN_PASS;
  if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
    req.session.admin = true;
    return res.send('Admin logged in successfully');
  }
  res.status(401).send('Unauthorized');
});

// Admin: View all listeners
app.get('/admin/listeners', requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT email, subscribed, created_at FROM listeners');
    res.json(result.rows);
  } catch (err) {
    res.status(500).send('Error fetching listeners');
  }
});

// Sign up route
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO listeners (email, password) VALUES ($1, $2)', [email, hashedPassword]);
    res.status(201).send('Signup successful');
  } catch (err) {
    res.status(400).send('Signup failed: ' + err.message);
  }
});

// Sign in route
app.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM listeners WHERE email = $1', [email]);
    const user = result.rows[0];
    if (user && await bcrypt.compare(password, user.password)) {
      req.session.userId = user.id;
      res.send('Signin successful');
    } else {
      res.status(401).send('Invalid credentials');
    }
  } catch (err) {
    res.status(500).send('Signin error');
  }
});

// Newsletter opt-in status (optional route)
app.post('/subscribe', async (req, res) => {
  const { email, subscribed } = req.body;
  try {
    await db.query('UPDATE listeners SET subscribed = $1 WHERE email = $2', [subscribed, email]);
    res.send('Subscription updated');
  } catch (err) {
    res.status(400).send('Error updating subscription');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`VJMZ-FM JAM'N STATION is LIVE on port ${PORT}`));
Add working homepage and listener system)
