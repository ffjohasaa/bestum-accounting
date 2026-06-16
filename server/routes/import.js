const express  = require('express');
const multer   = require('multer');
const db       = require('../db');
const { detectAndParse } = require('../utils/parseCsv');
const { categorizeBank, categorizeVipps } = require('../utils/categorize');
const router   = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

async function getRules() {
  const { rows } = await db.query('SELECT * FROM rules ORDER BY priority DESC');
  return rows;
}

async function getAccounts() {
  const { rows } = await db.query('SELECT code, name FROM accounts');
  return Object.fromEntries(rows.map(r => [r.code, r.name]));
}

// POST /api/import  (multipart: file + year)
router.post('/', upload.array('files'), async (req, res) => {
  const { year } = req.body;
  if (!year) return res.status(400).json({ error: 'year required' });

  const rules    = await getRules();
  const accounts = await getAccounts();
  const log      = [];

  // Ensure year exists
  await db.query('INSERT INTO years (year) VALUES ($1) ON CONFLICT DO NOTHING', [year]);

  for (const file of req.files) {
    const text = file.buffer.toString('utf-8');
    let parsed;
    try {
      parsed = detectAndParse(text, file.originalname);
    } catch (e) {
      log.push({ file: file.originalname, ok: false, message: e.message });
      continue;
    }

    if (parsed.type === 'bank') {
      const result = await importBank(parsed.data, parseInt(year), rules, accounts);
      log.push({ file: file.originalname, ok: true, type: 'bank', ...result });
    } else {
      const result = await importVipps(parsed.data, parseInt(year), rules, accounts);
      log.push({ file: file.originalname, ok: true, type: 'vipps', ...result });
    }
  }

  res.json({ log });
});

async function importBank(txns, year, rules, accounts) {
  // Get existing transactions for dedup
  const { rows: existing } = await db.query(
    "SELECT TO_CHAR(date,'DD.MM.YYYY') as d, (income - expense)::text as amt FROM transactions WHERE year=$1 AND source='Bank'",
    [year]
  );
  const existingSet = new Map();
  for (const r of existing) {
    const k = `${r.d}|${r.amt}`;
    existingSet.set(k, (existingSet.get(k) || 0) + 1);
  }

  // Get last balance and seq_nr
  const { rows: lastRows } = await db.query(
    "SELECT balance, seq_nr FROM transactions WHERE year=$1 ORDER BY date DESC, id DESC LIMIT 1", [year]
  );
  let lastBal = lastRows.length ? parseFloat(lastRows[0].balance || 0) : 0;
  let lastNr  = lastRows.length ? (parseInt(lastRows[0].seq_nr) || 0) : 0;

  let added = 0, skipped = 0;
  for (const t of txns) {
    // Normalise date to DD.MM.YYYY for dedup
    const parts = t.date.split('/');
    const dateDisplay = parts.length === 3
      ? `${parts[2].padStart(2,'0')}.${parts[1].padStart(2,'0')}.${parts[0]}`
      : t.date;
    const isoDate = parts.length === 3
      ? `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`
      : t.date;

    const dedupKey = `${dateDisplay}|${t.amount}`;
    const cnt = existingSet.get(dedupKey) || 0;
    if (cnt > 0) { existingSet.set(dedupKey, cnt - 1); skipped++; continue; }

    const cat  = categorizeBank(t, rules);
    let desc   = t.name || cat.desc;
    if (t.title && t.title !== t.name) desc += ' – ' + t.title;
    if (!desc.trim()) desc = cat.desc;

    lastBal = Math.round((lastBal + t.amount) * 100) / 100;
    lastNr++;

    await db.query(
      `INSERT INTO transactions (year,date,seq_nr,ref,account_code,account_name,description,income,expense,balance,source,reconciled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Bank',true)`,
      [year, isoDate, lastNr, `B${String(lastNr).padStart(3,'0')}`,
       cat.code, accounts[cat.code] || cat.desc, desc,
       t.amount > 0 ? t.amount : 0,
       t.amount < 0 ? Math.abs(t.amount) : 0,
       lastBal]
    );
    added++;
  }
  return { added, skipped };
}

async function importVipps(vippsData, year, rules, accounts) {
  const { belastninger } = vippsData;

  const { rows: existing } = await db.query(
    "SELECT TO_CHAR(date,'YYYY-MM-DD') as d, (income)::text as amt, description FROM transactions WHERE year=$1 AND source='Vipps'",
    [year]
  );
  const existingSet = new Set(existing.map(r => `${r.d}|${r.amt}`));

  let added = 0, skipped = 0;
  for (const b of belastninger) {
    const dedupKey = `${b.date}|${b.amount}`;
    if (existingSet.has(dedupKey)) { skipped++; continue; }

    const cat = categorizeVipps(b, rules);

    await db.query(
      `INSERT INTO transactions (year,date,account_code,account_name,description,income,expense,balance,source,vipps_name,vipps_message,reconciled)
       VALUES ($1,$2,$3,$4,$5,$6,0,0,'Vipps',$7,$8,true)`,
      [year, b.date, cat.code, accounts[cat.code] || cat.desc,
       b.name || cat.desc, b.amount, b.name, b.message]
    );
    added++;
  }
  return { added, skipped };
}

module.exports = router;
