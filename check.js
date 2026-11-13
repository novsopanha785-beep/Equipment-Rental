// Automatic self-check: npm run check
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cfg = require('./check.config.json');

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-'));
const env = {
  ...process.env,
  PORT: String(PORT),
  DATA_DIR: path.join(tmp, 'data'),
  LOG_FILE: path.join(tmp, 'activity.log')
};
let server, pass = 0, fail = 0;

function start() {
  server = spawn(process.execPath, ['server.js'], { env, stdio: 'ignore' });
  return new Promise((r) => setTimeout(r, 800));
}
function stop() {
  return new Promise((r) => { server.once('exit', r); server.kill(); });
}
async function call(method, url, body, raw) {
  const opt = { method, headers: {} };
  if (raw !== undefined) opt.body = raw;
  else if (body !== undefined) opt.body = JSON.stringify(body);
  if (opt.body !== undefined) opt.headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + url, opt);
  let data = null;
  try { data = await res.json(); } catch (e) { /* not json */ }
  return { status: res.status, data, type: res.headers.get('content-type') || '' };
}
function ok(name, cond) {
  if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name); }
}

async function crud(label, p, field) {
  let r = await call('GET', p);
  ok(`${label} GET list -> 200 array`, r.status === 200 && Array.isArray(r.data));
  r = await call('POST', p, {});
  ok(`${label} POST without name -> 400`, r.status === 400 && r.data.error);
  r = await call('POST', p, { name: '   ' });
  ok(`${label} POST empty name -> 400`, r.status === 400);
  r = await call('POST', p, { name: 'A1', [field]: 'x' });
  ok(`${label} POST -> 201 with id`, r.status === 201 && r.data.id === 1 && r.type.includes('application/json'));
  const id = r.data.id;
  r = await call('GET', `${p}/${id}`);
  ok(`${label} GET one -> 200`, r.status === 200 && r.data.name === 'A1');
  r = await call('GET', `${p}/999`);
  ok(`${label} GET missing -> 404`, r.status === 404 && r.data.error);
  r = await call('PUT', `${p}/${id}`, {});
  ok(`${label} PUT without name -> 400`, r.status === 400);
  r = await call('PUT', `${p}/999`, { name: 'Z' });
  ok(`${label} PUT missing -> 404`, r.status === 404);
  r = await call('PUT', `${p}/${id}`, { name: 'B2' });
  ok(`${label} PUT -> 200 updated`, r.status === 200 && r.data.name === 'B2');
  r = await call('PATCH', `${p}/${id}`, { name: 'B2' });
  ok(`${label} PATCH -> 405`, r.status === 405);
  r = await call('DELETE', `${p}/999`);
  ok(`${label} DELETE missing -> 404`, r.status === 404);
  r = await call('POST', p, { name: 'Second' });
  r = await call('DELETE', `${p}/2`);
  ok(`${label} DELETE -> 200 {deleted}`, r.status === 200 && r.data.deleted === 2);
}

async function main() {
  const I = '/' + cfg.items, P = '/' + cfg.persons, L = '/' + cfg.links;
  const E = cfg.extra ? '/' + cfg.extra : null;
  await start();

  let r = await call('GET', '/');
  ok('GET / -> 200 JSON', r.status === 200 && r.data && Array.isArray(r.data.resources));
  const browserRoot = await fetch(BASE + '/', { headers: { Accept: 'text/html' } });
  let browserRootData = null;
  try { browserRootData = await browserRoot.json(); } catch (e) { /* must remain JSON */ }
  ok('GET / remains JSON for browser clients', browserRoot.status === 200 && browserRootData && browserRoot.headers.get('content-type').includes('application/json'));
  const dashboard = await fetch(BASE + '/app', { headers: { Accept: 'text/html' } });
  const dashboardHtml = await dashboard.text();
  ok('GET /app serves dashboard', dashboard.status === 200 && dashboardHtml.includes('RentEasy'));
  r = await call('GET', '/nothing');
  ok('Unknown path -> 404', r.status === 404 && r.data.error);
  r = await call('POST', I, undefined, '{bad json');
  ok('Invalid JSON -> 400', r.status === 400 && r.data.error);
  r = await call('GET', `${I}/%E0%A4%A`);
  ok('Invalid URL encoding -> 400', r.status === 400 && r.data.error);
  r = await call('POST', I, undefined, 'x'.repeat(1024 * 1024 + 1));
  ok('Oversized request body -> 400', r.status === 400 && r.data.error);
  r = await call('DELETE', '/');
  ok('Method not supported on / -> 405', r.status === 405);

  await crud('ITEM', I, 'note');
  await crud('PERSON', P, 'phone');
  if (E) await crud('EXTRA', E, 'note');

  // LINK rules (item id 1 and person id 1 exist; id 2 deleted)
  r = await call('POST', L, { itemId: 'a', personId: 1 });
  ok('LINK non-number ids -> 400', r.status === 400);
  r = await call('POST', L, { itemId: 99, personId: 1 });
  ok('LINK unknown item -> 400', r.status === 400);
  r = await call('POST', L, { itemId: 1, personId: 99 });
  ok('LINK unknown person -> 400', r.status === 400);
  r = await call('POST', L, { itemId: 1, personId: 1 });
  ok('LINK create -> 201, endedAt null', r.status === 201 && r.data.endedAt === null && r.data.startedAt);
  const lid = r.data.id;
  r = await call('POST', L, { itemId: 1, personId: 1 });
  ok('LINK item already taken -> 409', r.status === 409);
  r = await call('GET', `${L}/${lid}`);
  ok('LINK GET one -> 200', r.status === 200);
  r = await call('GET', `${L}/999`);
  ok('LINK GET missing -> 404', r.status === 404);
  r = await call('PUT', `${L}/999/end`);
  ok('LINK end missing -> 404', r.status === 404);
  r = await call('PUT', `${L}/${lid}/end`);
  ok('LINK end -> 200 with endedAt', r.status === 200 && r.data.endedAt);
  r = await call('PUT', `${L}/${lid}/end`);
  ok('LINK end twice -> 409', r.status === 409);
  r = await call('POST', L, { itemId: 1, personId: 1 });
  ok('LINK item free again after end -> 201', r.status === 201);
  r = await call('DELETE', `${L}/${r.data.id}`);
  ok('LINK DELETE -> 200', r.status === 200 && r.data.deleted);
  r = await call('DELETE', `${L}/999`);
  ok('LINK DELETE missing -> 404', r.status === 404);

  // Restart: data must survive and ids must not be reused
  await stop();
  await start();
  r = await call('GET', I);
  ok('Data survives restart', r.status === 200 && r.data.length === 1 && r.data[0].name === 'B2');
  r = await call('POST', I, { name: 'After restart' });
  ok('Ids keep counting after restart', r.status === 201 && r.data.id === 3);

  await new Promise((s) => setTimeout(s, 200));
  const log = fs.existsSync(env.LOG_FILE) ? fs.readFileSync(env.LOG_FILE, 'utf8') : '';
  ok('activity.log has created lines', new RegExp(`created ${cfg.items} #1`).test(log));
  ok('activity.log has updated lines', /updated /.test(log));
  ok('activity.log has deleted lines', /deleted /.test(log));

  await stop();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => { console.error(e); if (server) server.kill(); process.exit(1); });
