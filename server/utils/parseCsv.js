// Ported from Bestum_Regnskap 2.html — CSV parsing for DNB bank and Vipps

function parseNum(s) {
  return parseFloat((s || '').replace(/,/g, '.').replace(/[\s ]/g, '')) || 0;
}

function parseBankCsvOld(text) {
  // Pre-2026 DNB: semicolon-delimited, single signed Beløp column
  // Columns: [0]Dato [1]Beløp [2]Avsender [3]Mottaker [4]Navn [5]Tittel [6]KID [7]Valuta [8]Betalingstype
  const lines = text.split('\n');
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Bokf') && (lines[i].includes('dato') || lines[i].includes('Dato'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) headerIdx = 0;

  const txns = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 6) continue;
    const dateStr = cols[0];
    const amount  = parseNum(cols[1]);
    if (!dateStr || isNaN(amount) || dateStr === '') continue;
    const parts = dateStr.split('/');
    const month = parts.length >= 2 ? parseInt(parts[1]) : 1;
    txns.push({ date: dateStr, amount, month, name: cols[4] || '', title: cols[5] || '', kid: cols[6] || '', payType: cols[8] || '' });
  }
  txns.reverse();
  return txns;
}

function parseBankCsvNew(text, headerLineIndex) {
  // 2026+ DNB: comma-delimited, preamble rows, split Utgående/Innkommende columns
  const allLines = text.split('\n');
  const dataLines = allLines.slice(headerLineIndex + 1);
  const txns = [];
  for (const line of dataLines) {
    if (!line.trim()) continue;
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 6) continue;
    const dateStr = cols[0];
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) continue;
    const utg = parseNum(cols[1]);
    const inn = parseNum(cols[2]);
    const amount = cols[2].trim() !== '' ? inn : utg;
    if (isNaN(amount)) continue;
    const parts = dateStr.split('/');
    const month = parts.length >= 2 ? parseInt(parts[1]) : 1;
    txns.push({ date: dateStr, amount, month, name: cols[5] || '', title: cols[6] || '', kid: cols[7] || '', payType: cols[9] || '' });
  }
  txns.reverse();
  return txns;
}

function parseVippsCsv(text) {
  const lines = text.split('\n');
  const belastninger = [];
  const utbetalinger = [];
  let gebyrer = 0;
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    // Vipps CSV is comma-delimited, may have quoted fields
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 10) continue;
    const typ = cols[6];
    if (typ === 'Belastning') {
      const dateStr = (cols[4] || '').substring(0, 10);
      const parts   = dateStr.split('-');
      belastninger.push({
        date: dateStr,
        amount: parseFloat(cols[7]) || 0,
        month: parts.length >= 2 ? parseInt(parts[1]) : 1,
        name: (cols[12] || '').trim(),
        message: (cols[14] || '').trim(),
      });
    } else if (typ === 'Utbetaling planlagt') {
      utbetalinger.push({
        bookingDate: (cols[5] || '').trim(),
        amount: Math.abs(parseFloat(cols[7]) || 0),
        payoutNr: (cols[17] || '').trim(),
        bankDate: (cols[19] || '').trim(),
      });
    } else if (typ === 'Gebyrer fratrukket') {
      gebyrer += Math.abs(parseFloat(cols[7]) || 0);
    }
  }
  return { belastninger, utbetalinger, gebyrer: Math.round(gebyrer * 100) / 100 };
}

function detectAndParse(text, filename) {
  const lines = text.split('\n');
  const firstLine = lines[0] || '';

  if (firstLine.includes('Salgssted') || firstLine.includes('MSN/Vippsnummer') || firstLine.includes('Belastning')) {
    return { type: 'vipps', data: parseVippsCsv(text) };
  }

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes('Bokf') && (l.includes('dato') || l.includes('Dato'))) {
      const isNew = l.includes('Utgående') || l.includes('Innkommende');
      return { type: 'bank', data: isNew ? parseBankCsvNew(text, i) : parseBankCsvOld(text) };
    }
  }

  throw new Error(`Ukjent filformat i "${filename}". Forventet bank- eller Vipps-CSV.`);
}

module.exports = { detectAndParse, parseBankCsvOld, parseBankCsvNew, parseVippsCsv };
