require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const pgSession    = require('connect-pg-simple')(session);
const path         = require('path');
const db           = require('./db');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions stored in Postgres
app.use(session({
  store: new pgSession({ pool: db, tableName: 'session', createTableIfMissing: false }),
  secret: process.env.SESSION_SECRET || 'bestum-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
}));

// Auth guard middleware
function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  res.status(401).json({ error: 'Ikke innlogget' });
}

// Public routes
app.use('/auth', require('./routes/auth'));

// Protected API
app.use('/api/dashboard',    requireAuth, require('./routes/dashboard'));
app.use('/api/transactions', requireAuth, require('./routes/transactions'));
app.use('/api/accounts',     requireAuth, require('./routes/accounts'));
app.use('/api/rules',        requireAuth, require('./routes/rules'));
app.use('/api/activities',   requireAuth, require('./routes/activities'));
app.use('/api/budgets',      requireAuth, require('./routes/budgets'));
app.use('/api/years',        requireAuth, require('./routes/years'));
app.use('/api/settings',     requireAuth, require('./routes/settings'));
app.use('/api/import',       requireAuth, require('./routes/import'));

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  // SPA: serve index.html for all non-API routes
  if (!req.path.startsWith('/api') && !req.path.startsWith('/auth')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bestum Regnskap running on port ${PORT}`));
