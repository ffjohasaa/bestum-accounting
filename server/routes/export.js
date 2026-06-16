const express = require('express');
const XLSX    = require('xlsx');
const db      = require('../db');
const router  = express.Router();

// GET /api/export?year=2025
router.get('/', async (req, res) => {
  const { year } = req.query;
  if (!year) return res.status(400).json({ error: 'year required' });

  const [txRes, yearRes] = await Promise.all([
    db.query('SELECT * FROM transactions WHERE year=$1 ORDER BY date, id', [year]),
    db.query('SELECT * FROM years WHERE year=$1', [year]),
  ]);

  const txns    = txRes.rows;
  const yearRow = yearRes.rows[0] || { opening_balance: 0 };

  const wb = XLSX.utils.book_new();

  // ---- Sheet 1: Transaksjoner ----
  const txData = [
    ['Nr', 'Dato', 'Bilagsnr', 'Kontonr', 'Kontonavn', 'Beskrivelse', 'Inn (kr)', 'Ut (kr)', 'Saldo', 'Kilde'],
  ];
  txns.forEach((t, i) => {
    const d = new Date(t.date);
    const dateStr = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
    txData.push([
      i + 1, dateStr, t.ref || '',
      t.account_code || '', t.account_name || '',
      t.description || '',
      parseFloat(t.income)  > 0 ? parseFloat(t.income)  : '',
      parseFloat(t.expense) > 0 ? parseFloat(t.expense) : '',
      parseFloat(t.balance) || '',
      t.source || 'Bank',
    ]);
  });
  const wsTxn = XLSX.utils.aoa_to_sheet(txData);
  wsTxn['!cols'] = [
    {wch:5},{wch:12},{wch:8},{wch:7},{wch:24},{wch:36},{wch:12},{wch:12},{wch:14},{wch:8}
  ];
  XLSX.utils.book_append_sheet(wb, wsTxn, 'Transaksjoner');

  // ---- Sheet 2: Sammendrag ----
  const totalIncome  = txns.reduce((s, t) => s + parseFloat(t.income  || 0), 0);
  const totalExpense = txns.reduce((s, t) => s + parseFloat(t.expense || 0), 0);

  // By account
  const byAcc = {};
  for (const t of txns) {
    const code = t.account_code || '?';
    if (!byAcc[code]) byAcc[code] = { code, name: t.account_name || '', income: 0, expense: 0 };
    byAcc[code].income  += parseFloat(t.income  || 0);
    byAcc[code].expense += parseFloat(t.expense || 0);
  }

  const sumData = [
    [`Bestum Sjøspeidere — Årsregnskap ${year}`],
    [],
    ['', 'Inntekter', 'Utgifter', 'Netto'],
  ];
  for (const a of Object.values(byAcc).sort((a,b) => a.code.localeCompare(b.code))) {
    sumData.push([
      `${a.code} ${a.name}`,
      a.income  || '',
      a.expense || '',
      Math.round((a.income - a.expense) * 100) / 100,
    ]);
  }
  sumData.push([]);
  sumData.push(['Totalt', Math.round(totalIncome*100)/100, Math.round(totalExpense*100)/100, Math.round((totalIncome-totalExpense)*100)/100]);
  sumData.push([]);
  sumData.push(['Inngående saldo', parseFloat(yearRow.opening_balance)]);
  sumData.push(['Årsresultat', Math.round((totalIncome-totalExpense)*100)/100]);
  sumData.push(['Utgående saldo', Math.round((parseFloat(yearRow.opening_balance) + totalIncome - totalExpense)*100)/100]);

  const wsSum = XLSX.utils.aoa_to_sheet(sumData);
  wsSum['!cols'] = [{wch:30},{wch:14},{wch:14},{wch:14}];
  XLSX.utils.book_append_sheet(wb, wsSum, 'Sammendrag');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="Bestum_Regnskap_${year}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

module.exports = router;
