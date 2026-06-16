#!/usr/bin/env node
/**
 * Bestum Regnskap MCP Server
 * Exposes the accounting API as MCP tools for use by Claude and other MCP clients.
 *
 * Usage:
 *   BESTUM_URL=https://your-app.herokuapp.com BESTUM_PASSWORD=... node mcp/server.js
 */
const { Server }   = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const BASE_URL = process.env.BESTUM_URL || 'http://localhost:3000';
const PASSWORD = process.env.BESTUM_PASSWORD || process.env.ADMIN_PASSWORD || 'bestum2025';

let sessionCookie = null;

async function login() {
  const r = await fetch(`${BASE_URL}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username: 'bestum-admin', password: PASSWORD }),
  });
  const setCookie = r.headers.get('set-cookie');
  if (setCookie) sessionCookie = setCookie.split(';')[0];
  return r.ok;
}

async function apiFetch(path, opts = {}) {
  if (!sessionCookie) await login();
  const r = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie || '', ...opts.headers },
  });
  if (r.status === 401) {
    sessionCookie = null;
    await login();
    return apiFetch(path, opts);
  }
  return r.json();
}

const TOOLS = [
  {
    name: 'get_dashboard',
    description: 'Get financial dashboard summary for a given year: totals, monthly breakdown, category summary, activity results.',
    inputSchema: { type:'object', properties:{ year:{ type:'number', description:'Accounting year, e.g. 2025' } }, required:['year'] },
  },
  {
    name: 'list_transactions',
    description: 'List bank and Vipps transactions for a year. Supports filtering by search text, type (income/expense), and source (Bank/Vipps).',
    inputSchema: { type:'object', properties:{
      year:   { type:'number' },
      search: { type:'string', description:'Search in description or account name' },
      type:   { type:'string', enum:['income','expense'], description:'Filter by transaction type' },
      source: { type:'string', enum:['Bank','Vipps'] },
      limit:  { type:'number', default:100 },
    }, required:['year'] },
  },
  {
    name: 'get_transaction',
    description: 'Get a single transaction by ID.',
    inputSchema: { type:'object', properties:{ id:{ type:'number' } }, required:['id'] },
  },
  {
    name: 'update_transaction_account',
    description: 'Change the account (konto) code on one or more transactions.',
    inputSchema: { type:'object', properties:{
      ids:          { type:'array', items:{ type:'number' }, description:'Transaction IDs to update' },
      account_code: { type:'string', description:'Account code, e.g. "4210"' },
    }, required:['ids','account_code'] },
  },
  {
    name: 'list_accounts',
    description: 'List all accounts in the chart of accounts (kontoplan).',
    inputSchema: { type:'object', properties:{} },
  },
  {
    name: 'list_years',
    description: 'List all available accounting years with their opening balances.',
    inputSchema: { type:'object', properties:{} },
  },
  {
    name: 'list_activities',
    description: 'List activity configurations for a year.',
    inputSchema: { type:'object', properties:{ year:{ type:'number' } } },
  },
  {
    name: 'list_budgets',
    description: 'List activity budgets for a year.',
    inputSchema: { type:'object', properties:{ year:{ type:'number' } } },
  },
  {
    name: 'create_budget',
    description: 'Create a new activity budget.',
    inputSchema: { type:'object', properties:{
      year:                  { type:'number' },
      name:                  { type:'string' },
      date:                  { type:'string', description:'ISO date, optional' },
      expected_participants: { type:'number', default:9 },
      min_participants:      { type:'number', default:6 },
      max_participants:      { type:'number', default:12 },
      costs: { type:'array', items:{ type:'object', properties:{
        desc:   { type:'string' },
        type:   { type:'string', enum:['fixed','variable'] },
        amount: { type:'number' },
      }}},
    }, required:['year','name'] },
  },
  {
    name: 'create_year',
    description: 'Create a new accounting year with an opening balance.',
    inputSchema: { type:'object', properties:{
      year:            { type:'number' },
      opening_balance: { type:'number', default:0 },
    }, required:['year'] },
  },
  {
    name: 'list_rules',
    description: 'List auto-categorisation rules for bank and Vipps imports.',
    inputSchema: { type:'object', properties:{} },
  },
];

async function callTool(name, args) {
  switch (name) {
    case 'get_dashboard':
      return apiFetch(`/api/dashboard?year=${args.year}`);

    case 'list_transactions': {
      const params = new URLSearchParams({ year: args.year, limit: args.limit || 100 });
      if (args.search) params.set('search', args.search);
      if (args.type)   params.set('type', args.type);
      if (args.source) params.set('source', args.source);
      return apiFetch(`/api/transactions?${params}`);
    }

    case 'get_transaction':
      return apiFetch(`/api/transactions/${args.id}`);

    case 'update_transaction_account': {
      const accs = await apiFetch('/api/accounts');
      const acc  = accs.find(a => a.code === args.account_code);
      return apiFetch('/api/transactions/bulk-update', {
        method: 'POST',
        body: JSON.stringify({ ids: args.ids, account_code: args.account_code, account_name: acc?.name || '' }),
      });
    }

    case 'list_accounts':
      return apiFetch('/api/accounts');

    case 'list_years':
      return apiFetch('/api/years');

    case 'list_activities':
      return apiFetch(`/api/activities${args.year ? `?year=${args.year}` : ''}`);

    case 'list_budgets':
      return apiFetch(`/api/budgets${args.year ? `?year=${args.year}` : ''}`);

    case 'create_budget':
      return apiFetch('/api/budgets', { method:'POST', body: JSON.stringify(args) });

    case 'create_year':
      return apiFetch('/api/years', { method:'POST', body: JSON.stringify(args) });

    case 'list_rules':
      return apiFetch('/api/rules');

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server(
  { name: 'bestum-regnskap', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async req => {
  const { name, arguments: args } = req.params;
  try {
    const result = await callTool(name, args || {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Bestum Regnskap MCP server running (stdio)');
}

main().catch(e => { console.error(e); process.exit(1); });
