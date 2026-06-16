// Ported from Bestum_Regnskap 2.html — auto-categorization logic

const BANK_INCOME_MONTH_RULES = [
  { months: [6, 7], minAmt: 1500, code: '3210', desc: 'Landsleir-avgift' },
  { months: [11, 12], maxAmt: 500, code: '3220', desc: 'Juletur-avgift' },
  { months: [1], minAmt: 1000, code: '3100', desc: 'Kontingent' },
  { maxAmt: 500, code: '3220', desc: 'Turavgift/juletur' },
];

const BANK_SEASONAL = {
  VAREKJØP: { 6: '4100', 7: '4100', 11: '4120', 12: '4120', def: '4500' },
  VISA:      { 6: '4100', 7: '4100', 8: '4100', 12: '4120', def: '4500' },
};

// rules param comes from DB; falls back to hardcoded defaults if empty
function categorizeBank(t, rules = []) {
  const combined = ((t.name || '') + ' ' + (t.title || '')).toUpperCase();
  const payType  = (t.payType || '').toUpperCase();
  const amount   = t.amount;
  const month    = t.month;

  const dbIncome  = rules.filter(r => r.source_type === 'bank_income');
  const dbExpense = rules.filter(r => r.source_type === 'bank_expense');

  if (amount > 0) {
    for (const r of dbIncome) {
      const haystack = r.match_field === 'pay_type' ? payType : combined;
      if (haystack.includes(r.match_text.toUpperCase()))
        return { code: r.account_code, desc: r.description };
    }
    for (const r of BANK_INCOME_MONTH_RULES) {
      const mOk   = !r.months || r.months.includes(month);
      const minOk = !r.minAmt || amount >= r.minAmt;
      const maxOk = !r.maxAmt || amount <= r.maxAmt;
      if (mOk && minOk && maxOk) return { code: r.code, desc: r.desc };
    }
    return { code: '3100', desc: 'Kontingent' };
  }

  for (const r of dbExpense) {
    const haystack = r.match_field === 'pay_type' ? payType : combined;
    if (haystack.includes(r.match_text.toUpperCase()))
      return { code: r.account_code, desc: r.description };
  }

  for (const [kw, seasons] of Object.entries(BANK_SEASONAL)) {
    if (combined.includes(kw) || payType.includes(kw)) {
      return { code: seasons[month] || seasons.def, desc: kw };
    }
  }
  return { code: '4900', desc: 'Andre utgifter' };
}

function categorizeVipps(v, rules = []) {
  const msg   = (v.message || '').toUpperCase();
  const month = v.month;
  const dbVipps = rules.filter(r => r.source_type === 'vipps');
  for (const r of dbVipps) {
    if (msg.includes(r.match_text.toUpperCase()))
      return { code: r.account_code, desc: r.description };
  }
  if (month === 1) return { code: '3400', desc: 'Loddsalg årsfest' };
  return { code: '3900', desc: 'Vipps-innbetaling' };
}

module.exports = { categorizeBank, categorizeVipps };
