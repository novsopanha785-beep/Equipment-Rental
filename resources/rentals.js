// LINK resource: "this borrower is currently renting this equipment"
// {id, itemId (equipment), personId (borrower), startedAt, endedAt}
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const bus = require('../lib/events');
const { send, HttpError } = require('../lib/respond');
const equipment = require('./equipment'); // ITEM owner's file
const borrowers = require('./borrowers'); // PERSON owner's file

const NAME = 'rentals';
const FILE = path.join(config.DATA_DIR, NAME + '.json');
const COUNTER = path.join(config.DATA_DIR, NAME + '.counter.json');

async function load() {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function save(list) {
  // Write to a temporary file first so an interrupted write cannot corrupt the data file.
  await fs.mkdir(config.DATA_DIR, { recursive: true });
  const tempFile = FILE + '.tmp';
  await fs.writeFile(tempFile, JSON.stringify(list, null, 2) + '\n', 'utf8');
  await fs.rename(tempFile, FILE);
}

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

async function findById(id) {
  const list = await load();
  return list.find((r) => r.id === Number(id));
}

async function create(body) {
  const itemId = body && body.itemId;
  const personId = body && body.personId;
  if (typeof itemId !== 'number' || typeof personId !== 'number' ||
      !Number.isFinite(itemId) || !Number.isFinite(personId)) {
    throw new HttpError(400, 'itemId and personId must be numbers');
  }
  if (!(await equipment.findById(itemId))) throw new HttpError(400, 'Equipment does not exist');
  if (!(await borrowers.findById(personId))) throw new HttpError(400, 'Borrower does not exist');

  const list = await load();
  if (list.some((r) => r.itemId === itemId && r.endedAt === null)) {
    throw new HttpError(409, 'This equipment is already rented out');
  }
  const record = {
    id: await nextId(list),
    itemId,
    personId,
    startedAt: new Date().toISOString(),
    endedAt: null
  };
  list.push(record);
  await save(list);
  bus.emit('created', { resource: NAME, id: record.id });
  return record;
}

async function handle(req, res, parts, body) {
  if (parts.length === 0) {
    if (req.method === 'GET') return send(res, 200, await load());
    if (req.method === 'POST') return send(res, 201, await create(body));
    throw new HttpError(405, 'Method not allowed');
  }

  const id = Number(parts[0]);

  if (parts.length === 1) {
    if (!['GET', 'DELETE'].includes(req.method)) throw new HttpError(405, 'Method not allowed');
    const list = await load();
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) throw new HttpError(404, 'Not found');
    if (req.method === 'GET') return send(res, 200, list[index]);

    list.splice(index, 1);
    await save(list);
    bus.emit('deleted', { resource: NAME, id });
    return send(res, 200, { deleted: id });
  }

  if (parts.length === 2 && parts[1] === 'end') {
    if (req.method !== 'PUT') throw new HttpError(405, 'Method not allowed');
    const list = await load();
    const record = list.find((r) => r.id === id);
    if (!record) throw new HttpError(404, 'Not found');
    if (record.endedAt !== null) throw new HttpError(409, 'Already ended');
    record.endedAt = new Date().toISOString();
    await save(list);
    bus.emit('updated', { resource: NAME, id });
    return send(res, 200, record);
  }

  throw new HttpError(404, 'Not found');
}

module.exports = { path: '/' + NAME, handle, findById };
