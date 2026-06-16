const express = require('express');
const db      = require('../db');
const router  = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM accounts ORDER BY code');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { code, name, type, color } = req.body;
    const { rows } = await db.query(
      'INSERT INTO accounts (code,name,type,color) VALUES ($1,$2,$3,$4) RETURNING *',
      [code, name, type, color]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:code', async (req, res) => {
  try {
    const { name, type, color } = req.body;
    const { rows } = await db.query(
      'UPDATE accounts SET name=$1, type=$2, color=$3 WHERE code=$4 RETURNING *',
      [name, type, color, req.params.code]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:code', async (req, res) => {
  try {
    await db.query('DELETE FROM accounts WHERE code=$1', [req.params.code]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
