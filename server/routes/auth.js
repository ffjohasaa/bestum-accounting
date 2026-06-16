const express = require('express');
const router  = express.Router();

const USERS = {
  'bestum-admin': { passwordEnv: 'ADMIN_PASSWORD',    default: 'bestum2025', role: 'admin' },
  'bestum':       { passwordEnv: 'READONLY_PASSWORD', default: 'bestum',     role: 'readonly' },
};

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS[username];
  if (!user) return res.status(401).json({ error: 'Ugyldig bruker' });
  const expected = process.env[user.passwordEnv] || user.default;
  if (password !== expected) return res.status(401).json({ error: 'Feil passord' });
  req.session.user = username;
  req.session.role = user.role;
  res.json({ ok: true, role: user.role });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: req.session.user || null, role: req.session.role || null });
});

module.exports = router;
