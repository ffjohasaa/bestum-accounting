/**
 * Data migration script: reads existing XLSX files and POSTs transactions to the API.
 *
 * Usage:
 *   BESTUM_URL=http://localhost:3000 ADMIN_PASSWORD=bestum2025 node scripts/migrate-data.js
 *
 * Or locally with DATABASE_URL set (runs migrations inline before inserting).
 */
try { require('dotenv').config(); } catch(e) {}
const XLSX   = require('xlsx');
const path   = require('path');
const fs     = require('fs');

const BASE_URL = process.env.BESTUM_URL || 'http://localhost:3000';
const PASSWORD = process.env.ADMIN_PASSWORD || 'bestum2025';

// Paths to existing XLSX files — adjust if needed
const XLSX_FILES = [
  { year: 2023, file: path.join(__dirname, '..', 'Økonomi', '2023', '2 Bestum sjø regnskap 2023.xlsx') },
  { year: 2024, file: path.join(__dirname, '..', 'Økonomi', '2024', '2 Bestum sjø regnskap 2024.xlsx') },
  { year: 2025, file: path.join(__dirname, '..', 'Økonomi', '2025', 'Bestum_Regnskap_2025.xlsx') },
  { year: 2026, file: path.join(__dirname, '..', 'Økonomi', '2026', 'Bestum_Regnskap_2026.xlsx') },
];

let cookie = null;

async function login() {
  const r = await fetch(`${BASE_URL}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username: 'bestum-admin', password: PASSWORD }),
  });
  if (!r.ok) throw new Error('Login failed: ' + await r.text());
  const setCookie = r.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  console.log('Logged in OK');
}

async function api(path, method = 'GET', body) {
  const r = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie || '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`API ${method} ${path} failed: ${t}`); }
  return r.json();
}

function findSheet(wb, name) {
  if (wb.Sheets[name]) return wb.Sheets[name];
  const lower = name.toLowerCase();
  for (const sn of wb.SheetNames) {
    if (sn.toLowerCase().trim().startsWith(lower.substring(0, 6))) return wb.Sheets[sn];
  }
  return null;
}

function readTransactions(wb, year) {
  const ws = findSheet(wb, 'Transaksjoner');
  if (!ws) { console.warn(`  No Transaksjoner sheet in ${year}`); return []; }

  // Find header row
  let headerRow = 5;
  for (let r = 2; r <= 10; r++) {
    const vals = [];
    for (let c = 0; c < 12; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: r-1, c })];
      vals.push(cell ? String(cell.v).trim().toLowerCase() : '');
    }
    const match = [vals[0]==='nr', vals[1]==='dato', vals[5].includes('beskr'), vals[6].includes('inn')].filter(Boolean).length;
    if (match >= 2) { headerRow = r; break; }
  }

  const txns = [];
  for (let r = headerRow + 1; r < 10000; r++) {
    const dateCell = ws[XLSX.utils.encode_cell({ r: r-1, c: 1 })];
    const incCell  = ws[XLSX.utils.encode_cell({ r: r-1, c: 6 })];
    const expCell  = ws[XLSX.utils.encode_cell({ r: r-1, c: 7 })];
    if (!dateCell && !incCell && !expCell) break;

    let dateStr = '';
    if (dateCell) {
      if (dateCell.t === 'd' || dateCell.v instanceof Date) {
        const d = new Date(dateCell.v);
        dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      } else {
        // Convert DD.MM.YYYY to ISO
        const s = String(dateCell.v);
        const parts = s.split(/[./]/);
        if (parts.length === 3) dateStr = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        else dateStr = s;
      }
    }
    if (!dateStr) continue;

    const income  = incCell  ? (typeof incCell.v  === 'number' ? incCell.v  : parseFloat(incCell.v)  || 0) : 0;
    const expense = expCell  ? (typeof expCell.v  === 'number' ? expCell.v  : parseFloat(expCell.v) || 0) : 0;
    const kontonr  = ws[XLSX.utils.encode_cell({ r: r-1, c: 3 })]?.v || '';
    const kontonavn= ws[XLSX.utils.encode_cell({ r: r-1, c: 4 })]?.v || '';
    const desc     = ws[XLSX.utils.encode_cell({ r: r-1, c: 5 })]?.v || '';
    const balance  = ws[XLSX.utils.encode_cell({ r: r-1, c: 8 })]?.v || 0;
    const source   = ws[XLSX.utils.encode_cell({ r: r-1, c: 9 })]?.v || 'Bank';
    const seqNr    = ws[XLSX.utils.encode_cell({ r: r-1, c: 0 })]?.v || null;

    txns.push({ year, date: dateStr, seq_nr: seqNr, account_code: String(kontonr), account_name: String(kontonavn), description: String(desc), income, expense, balance: parseFloat(balance), source: String(source) });
  }
  return txns;
}

function readVipps(wb, year) {
  const ws = findSheet(wb, 'Vipps-avstemming');
  if (!ws) return [];
  const txns = [];
  for (let r = 5; r < 5000; r++) {
    const nrCell  = ws[XLSX.utils.encode_cell({ r: r-1, c: 0 })];
    const amtCell = ws[XLSX.utils.encode_cell({ r: r-1, c: 3 })];
    if (!nrCell || typeof nrCell.v !== 'number') break;

    const dateCell    = ws[XLSX.utils.encode_cell({ r: r-1, c: 1 })];
    const nameCell    = ws[XLSX.utils.encode_cell({ r: r-1, c: 2 })];
    const messageCell = ws[XLSX.utils.encode_cell({ r: r-1, c: 4 })];
    const kontoCell   = ws[XLSX.utils.encode_cell({ r: r-1, c: 6 })];

    let dateStr = '';
    if (dateCell) {
      if (dateCell.t === 'd' || dateCell.v instanceof Date) {
        const d = new Date(dateCell.v);
        dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      } else dateStr = String(dateCell.v);
    }
    if (!dateStr) continue;

    txns.push({
      year, date: dateStr, source: 'Vipps',
      account_code: String(kontoCell?.v || '3900'),
      account_name: '', description: String(nameCell?.v || ''),
      income: parseFloat(amtCell?.v || 0), expense: 0, balance: 0,
      vipps_name: String(nameCell?.v || ''), vipps_message: String(messageCell?.v || ''),
    });
  }
  return txns;
}

async function migrateYear(year, file) {
  if (!fs.existsSync(file)) { console.log(`  Skipping ${year} — file not found: ${file}`); return; }
  console.log(`\nMigrating ${year} from ${path.basename(file)}...`);

  const wb   = XLSX.readFile(file, { cellDates: true });
  const txns = [...readTransactions(wb, year), ...readVipps(wb, year)];
  console.log(`  Found ${txns.length} transactions`);

  // Detect opening balance (first transaction balance - first income + first expense)
  const bankTxns = txns.filter(t => t.source === 'Bank').sort((a,b) => a.date.localeCompare(b.date));
  let openingBalance = 0;
  if (bankTxns.length) {
    const first = bankTxns[0];
    openingBalance = Math.round((parseFloat(first.balance || 0) - parseFloat(first.income || 0) + parseFloat(first.expense || 0)) * 100) / 100;
  }

  await api('/api/years', 'POST', { year, opening_balance: openingBalance });
  console.log(`  Created year ${year} with opening balance ${openingBalance}`);

  let added = 0, errors = 0;
  for (const t of txns) {
    try {
      await api('/api/transactions', 'POST', t);
      added++;
      if (added % 50 === 0) process.stdout.write(`  ${added}/${txns.length}\r`);
    } catch (e) {
      console.error(`  Error inserting transaction: ${e.message}`);
      errors++;
    }
  }
  console.log(`  Done: ${added} added, ${errors} errors`);
}

async function main() {
  await login();
  for (const { year, file } of XLSX_FILES) {
    await migrateYear(year, file);
  }
  console.log('\nMigration complete!');
}

main().catch(e => { console.error(e); process.exit(1); });
