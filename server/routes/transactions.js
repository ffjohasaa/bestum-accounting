const express = require('express');
const db      = require('../db');
const router  = express.Router();

// GET /api/transactions?year=2025&search=&type=&source=&limit=&offset=
router.get('/', async (req, res) => {
  try {
    const { year, search, type, source, limit = 500, offset = 0 } = req.query;
    let where = ['1=1'];
    const params = [];

    if (year) { params.push(year); where.push(`year = $${params.length}`); }
    if (search) {
      params.push(`%${search.toUpperCase()}%`);
      where.push(`(UPPER(description) LIKE $${params.length} OR UPPER(account_name) LIKE $${params.length} OR UPPER(account_code) LIKE $${params.length})`);
    }
    if (type === 'income')  where.push('income > 0');
    if (type === 'expense') where.push('expense > 0');
    if (source) { params.push(source); where.push(`source = $${params.length}`); }

    params.push(parseInt(limit), parseInt(offset));
    const sql = `SELECT * FROM transactions WHERE ${where.join(' AND ')} ORDER BY date, id LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/transactions/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/transactions
router.post('/', async (req, res) => {
  try {
    const t = req.body;
    const { rows } = await db.query(
      `INSERT INTO transactions (year,date,seq_nr,ref,account_code,account_name,description,income,expense,balance,source,vipps_name,vipps_message,reconciled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [t.year, t.date, t.seq_nr, t.ref, t.account_code, t.account_name, t.description,
       t.income || 0, t.expense || 0, t.balance, t.source || 'Bank',
       t.vipps_name, t.vipps_message, t.reconciled ?? true]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/transactions/:id  (partial update — account change, receipt, etc.)
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['account_code','account_name','description','receipt_url','receipt_note','reconciled'];
    const sets = [], params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) { params.push(req.body[key]); sets.push(`${key} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    const { rows } = await db.query(`UPDATE transactions SET ${sets.join(',')} WHERE id = $${params.length} RETURNING *`, params);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/transactions/bulk-update  { ids:[], account_code, account_name }
router.post('/bulk-update', async (req, res) => {
  try {
    const { ids, account_code, account_name } = req.body;
    if (!ids?.length) return res.status(400).json({ error: 'No ids' });
    await db.query(
      `UPDATE transactions SET account_code=$1, account_name=$2 WHERE id = ANY($3::int[])`,
      [account_code, account_name, ids]
    );
    res.json({ updated: ids.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
