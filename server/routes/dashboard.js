const express = require('express');
const db      = require('../db');
const router  = express.Router();

const DEFAULT_ACTIVITIES = [
  { name: 'Vikentokt',             income_accounts: ['3200'],                        expense_accounts: ['4100'] },
  { name: 'Landsleir',             income_accounts: ['3210'],                        expense_accounts: ['4110','4410'] },
  { name: 'Juletur',               income_accounts: ['3220'],                        expense_accounts: ['4120'] },
  { name: 'Nabbentur',             income_accounts: ['3230'],                        expense_accounts: ['4130'] },
  { name: 'Andre turer',           income_accounts: [],                              expense_accounts: ['4140'] },
  { name: 'Loddsalg/salg',         income_accounts: ['3400','3410','3420'],          expense_accounts: [] },
  { name: 'Forsikring (Gjensidige)',income_accounts: ['3330'],                        expense_accounts: ['4300'] },
  { name: 'Båtdrift',              income_accounts: [],                              expense_accounts: ['5100','5110','5120','5130','5140','5150','5160','5170','5190'] },
  { name: 'Kahytten/lokale',       income_accounts: [],                              expense_accounts: ['4200','4210','4220','4800'] },
  { name: 'Kontingent',            income_accounts: ['3100'],                        expense_accounts: ['4400'] },
  { name: 'Kretskontingent',       income_accounts: [],                              expense_accounts: ['4420'] },
  { name: 'Tilskudd/støtte',       income_accounts: ['3300','3310','3320','3340','3350'], expense_accounts: [] },
  { name: 'Grasrot/Spond/renter',  income_accounts: ['3500','3510','3600'],          expense_accounts: [] },
  { name: 'Tropp/gruppe',          income_accounts: [],                              expense_accounts: ['4500','4510'] },
  { name: 'Admin/gebyrer',         income_accounts: [],                              expense_accounts: ['4600','4700'] },
  { name: 'Andre',                 income_accounts: ['3900'],                        expense_accounts: ['4900'] },
];

// GET /api/dashboard?year=2025
router.get('/', async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) return res.status(400).json({ error: 'year required' });

    const [txRes, yearRes, actRes] = await Promise.all([
      db.query('SELECT * FROM transactions WHERE year=$1 ORDER BY date, id', [year]),
      db.query('SELECT * FROM years WHERE year=$1', [year]),
      db.query('SELECT * FROM activities WHERE year=$1 ORDER BY id', [year]),
    ]);
    const txns     = txRes.rows;
    const yearData = yearRes.rows[0] || { opening_balance: 0 };
    // Use DB activities if defined for this year, otherwise fall back to defaults
    const activityDefs = actRes.rows.length ? actRes.rows : DEFAULT_ACTIVITIES;

    const totalIncome  = txns.reduce((s, t) => s + parseFloat(t.income || 0), 0);
    const totalExpense = txns.reduce((s, t) => s + parseFloat(t.expense || 0), 0);
    const result       = totalIncome - totalExpense;
    const lastBalance  = txns.length ? parseFloat(txns[txns.length - 1].balance || 0) : parseFloat(yearData.opening_balance);

    // Monthly aggregation
    const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));
    for (const t of txns) {
      const m = new Date(t.date).getMonth(); // 0-indexed
      months[m].income  += parseFloat(t.income || 0);
      months[m].expense += parseFloat(t.expense || 0);
    }

    // Category summary
    const byAccount = {};
    for (const t of txns) {
      const code = t.account_code || '4900';
      if (!byAccount[code]) byAccount[code] = { code, name: t.account_name || code, income: 0, expense: 0 };
      byAccount[code].income  += parseFloat(t.income || 0);
      byAccount[code].expense += parseFloat(t.expense || 0);
    }

    // Activity summary driven by DB activities (or defaults)
    const activities = activityDefs.map(a => {
      const inCodes  = a.income_accounts  || [];
      const outCodes = a.expense_accounts || [];
      let inc = 0, exp = 0;
      for (const t of txns) {
        if (inCodes.includes(t.account_code))  inc += parseFloat(t.income || 0);
        if (outCodes.includes(t.account_code)) exp += parseFloat(t.expense || 0);
      }
      return { name: a.name, income: inc, expense: exp, result: inc - exp };
    }).filter(a => a.income > 0 || a.expense > 0);

    res.json({
      year: parseInt(year),
      opening_balance: parseFloat(yearData.opening_balance),
      total_income:    Math.round(totalIncome * 100) / 100,
      total_expense:   Math.round(totalExpense * 100) / 100,
      result:          Math.round(result * 100) / 100,
      closing_balance: Math.round(lastBalance * 100) / 100,
      monthly:         months,
      by_account:      Object.values(byAccount),
      activities,
      transaction_count: txns.length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
