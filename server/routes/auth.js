const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();

// Hash is computed once at startup from env var
let adminHash = null;
async function getHash() {
  if (!adminHash) {
    const pwd = process.env.ADMIN_PASSWORD || 'bestum2025';
    adminHash = await bcrypt.hash(pwd, 10);
  }
  return adminHash;
}
// Pre-warm on module load
getHash();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (username !== 'bestum-admin') return res.status(401).json({ error: 'Ugyldig bruker' });
  const pwd = process.env.ADMIN_PASSWORD || 'bestum2025';
  const ok  = await bcrypt.compare(password, await getHash()) || password === pwd;
  if (!ok) return res.status(401).json({ error: 'Feil passord' });
  req.session.user = 'bestum-admin';
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

module.exports = router;
