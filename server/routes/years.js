const express = require('express');
const db      = require('../db');
const router  = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM years ORDER BY year DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { year, opening_balance } = req.body;
    const { rows } = await db.query(
      'INSERT INTO years (year, opening_balance) VALUES ($1, $2) ON CONFLICT (year) DO UPDATE SET opening_balance=$2 RETURNING *',
      [year, opening_balance || 0]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
