const express = require('express');
const db      = require('../db');
const router  = express.Router();

router.get('/', async (req, res) => {
  try {
    const { year } = req.query;
    const { rows } = year
      ? await db.query('SELECT * FROM activities WHERE year=$1 ORDER BY category, name', [year])
      : await db.query('SELECT * FROM activities ORDER BY year DESC, category, name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { year, name, description, income_accounts, expense_accounts, category } = req.body;
    const { rows } = await db.query(
      'INSERT INTO activities (year,name,description,income_accounts,expense_accounts,category) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [year, name, description, income_accounts || [], expense_accounts || [], category || 'activity']
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, income_accounts, expense_accounts, category } = req.body;
    const { rows } = await db.query(
      'UPDATE activities SET name=$1,description=$2,income_accounts=$3,expense_accounts=$4,category=$5 WHERE id=$6 RETURNING *',
      [name, description, income_accounts, expense_accounts, category || 'activity', req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM activities WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
