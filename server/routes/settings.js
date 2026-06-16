const express = require('express');
const db      = require('../db');
const router  = express.Router();

router.get('/:year', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT key, value FROM settings WHERE year=$1', [req.params.year]);
    const result = {};
    for (const r of rows) result[r.key] = r.value;
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:year', async (req, res) => {
  try {
    const { year } = req.params;
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await db.query(
        'INSERT INTO settings (year,key,value) VALUES ($1,$2,$3) ON CONFLICT (year,key) DO UPDATE SET value=$3',
        [year, key, JSON.stringify(value)]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
