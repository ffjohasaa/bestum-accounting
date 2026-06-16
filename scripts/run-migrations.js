const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
try { require('dotenv').config(); } catch(e) {}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false });

async function run() {
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    console.log('Running', file);
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await pool.query(sql);
  }
  console.log('Migrations complete.');
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
