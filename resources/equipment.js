// ITEM resource: rental equipment  {id, name, note}
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const bus = require('../lib/events');
const { send, HttpError } = require('../lib/respond');

const NAME = 'equipment';
const FILE = path.join(config.DATA_DIR, NAME + '.json');
const COUNTER = path.join(config.DATA_DIR, NAME + '.counter.json');

// TODO 1: load the data (first run: file missing -> empty list)
async function load() {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// TODO 2: save the data
async function save(list) {
  // Write to a temporary file first so an interrupted write cannot corrupt the data file.
  await fs.mkdir(config.DATA_DIR, { recursive: true });
  const tempFile = FILE + '.tmp';
  await fs.writeFile(tempFile, JSON.stringify(list, null, 2) + '\n', 'utf8');
  await fs.rename(tempFile, FILE);
}

// new id = highest id + 1, and never reuse an id (even after deleting the last one)
async function nextId(list) {
  let last = 0;
  try {
    const counter = JSON.parse(await fs.readFile(COUNTER, 'utf8'));
    if (!Number.isSafeInteger(counter.last) || counter.last < 0) {
      throw new Error(`Invalid ID counter file: ${COUNTER}`);
    }
    last = counter.last;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const highest = list.reduce((max, record) => Math.max(max, Number(record.id) || 0), 0);
  const id = Math.max(last, highest) + 1;
  await fs.mkdir(config.DATA_DIR, { recursive: true });
  const tempCounter = COUNTER + '.tmp';
  await fs.writeFile(tempCounter, JSON.stringify({ last: id }), 'utf8');
  await fs.rename(tempCounter, COUNTER);
  return id;
}

// TODO 3: findById (used by other files)
async function findById(id) {
  const list = await load();
  return list.find((r) => r.id === Number(id));
}

function clean(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      typeof body.name !== 'string' || body.name.trim() === '') {
    throw new HttpError(400, 'name is required');
  }
  const data = { name: body.name.trim() };
  if (body.note !== undefined) data.note = body.note;
  return data;
}

// TODO 4: the routes
async function handle(req, res, parts, body) {
  if (parts.length === 0) {
    if (req.method === 'GET') return send(res, 200, await load());
    if (req.method === 'POST') {
      const data = clean(body);
      const list = await load();
      const record = { id: await nextId(list), ...data };
      list.push(record);
      await save(list);
      bus.emit('created', { resource: NAME, id: record.id });
      return send(res, 201, record);
    }
    throw new HttpError(405, 'Method not allowed');
  }

  if (parts.length === 1) {
    if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
      throw new HttpError(405, 'Method not allowed');
    }
    const id = Number(parts[0]);
    const list = await load();
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) throw new HttpError(404, 'Not found');

    if (req.method === 'GET') return send(res, 200, list[index]);

    if (req.method === 'PUT') {
      const data = clean(body);
      list[index] = { id, ...data };
      await save(list);
      bus.emit('updated', { resource: NAME, id });
      return send(res, 200, list[index]);
    }

    list.splice(index, 1); // DELETE
    await save(list);
    bus.emit('deleted', { resource: NAME, id });
    return send(res, 200, { deleted: id });
  }

  throw new HttpError(404, 'Not found');
}

module.exports = { path: '/' + NAME, handle, findById };
