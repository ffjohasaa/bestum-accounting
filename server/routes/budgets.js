const express = require('express');
const db      = require('../db');
const router  = express.Router();

router.get('/', async (req, res) => {
  try {
    const { year } = req.query;
    const { rows } = year
      ? await db.query('SELECT * FROM budgets WHERE year=$1 ORDER BY name', [year])
      : await db.query('SELECT * FROM budgets ORDER BY year DESC, name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM budgets WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { year, name, date, expected_participants, min_participants, max_participants, costs } = req.body;
    const { rows } = await db.query(
      `INSERT INTO budgets (year,name,date,expected_participants,min_participants,max_participants,costs)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [year, name, date || null, expected_participants || 9, min_participants || 6, max_participants || 12, JSON.stringify(costs || [])]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, date, expected_participants, min_participants, max_participants, costs } = req.body;
    const { rows } = await db.query(
      `UPDATE budgets SET name=$1,date=$2,expected_participants=$3,min_participants=$4,max_participants=$5,costs=$6
       WHERE id=$7 RETURNING *`,
      [name, date || null, expected_participants, min_participants, max_participants, JSON.stringify(costs || []), req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM budgets WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
