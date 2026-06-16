const express = require('express');
const db      = require('../db');
const router  = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM rules ORDER BY source_type, priority DESC, id');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { source_type, match_field, match_text, account_code, description, priority } = req.body;
    const { rows } = await db.query(
      'INSERT INTO rules (source_type,match_field,match_text,account_code,description,priority) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [source_type, match_field || 'combined', match_text, account_code, description, priority || 0]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { source_type, match_field, match_text, account_code, description, priority } = req.body;
    const { rows } = await db.query(
      'UPDATE rules SET source_type=$1,match_field=$2,match_text=$3,account_code=$4,description=$5,priority=$6 WHERE id=$7 RETURNING *',
      [source_type, match_field, match_text, account_code, description, priority, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM rules WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
