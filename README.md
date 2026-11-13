# RentEasy — Equipment Rental System (WBD I Midterm)

A browser-based equipment rental website backed by a REST API built with **plain Node.js**. It intentionally does not use Express, MongoDB, Prisma, or a frontend framework so it remains aligned with the WBD I midterm requirements. Data is stored in JSON files in `data/` and activity events are recorded in `activity.log` using Node's EventEmitter.

## Start the project

```bash
npm install
npm start
```

Open the website at **http://localhost:3000/app**. The API root at **http://localhost:3000/** returns JSON as required by the assignment.

For development with automatic restart:

```bash
npm run dev
```

Run the assignment self-check:

```bash
npm run check
```

The self-check runs on port `3999` with a temporary data directory and currently contains 62 checks.

## Website modules

- **Dashboard:** live capacity, available/rented counts, utilization, seven-day activity, recent rentals, and shop summary.
- **Live inventory:** visual equipment tiles, available/rented filters, rent out equipment, and return it.
- **Borrowers:** register, search, edit, and delete borrowers; prevents deleting a borrower who has an active rental.
- **Equipment:** add, search, edit, and delete equipment; prevents deleting equipment that is rented out.
- **Types:** create and manage equipment categories (e.g. Electronics, Tools, Outdoor).
- **Rental history:** view active/completed rentals, return equipment, search records, and export CSV.
- **Reports:** rental totals, average rental time, and activity by time of day.
- **Demo data:** from an empty dashboard, use **Load demo data** to create sample types, equipment, borrowers, and rentals.

## API routes

| Resource | Routes | Fields |
|---|---|---|
| Equipment (ITEM) | `GET/POST /equipment`, `GET/PUT/DELETE /equipment/:id` | `{id, name, note}` |
| Borrowers (PERSON) | `GET/POST /borrowers`, `GET/PUT/DELETE /borrowers/:id` | `{id, name, phone}` |
| Types (EXTRA) | `GET/POST /types`, `GET/PUT/DELETE /types/:id` | `{id, name, note}` |
| Rentals (LINK) | `GET/POST /rentals`, `GET /rentals/:id`, `PUT /rentals/:id/end`, `DELETE /rentals/:id` | `{id, itemId, personId, startedAt, endedAt}` |

For a rental, `itemId` is the equipment ID and `personId` is the borrower ID. A piece of equipment cannot be in two active rentals at once (`409`). `endedAt` is `null` until the equipment is returned.

## Assignment implementation

- Modules use `require()` and `module.exports`.
- The server uses `http.createServer()`; no Express.
- JSON persistence uses `fs.promises` and `async/await`.
- The API returns JSON and appropriate status codes (`200`, `201`, `400`, `404`, `405`, `409`, `500`).
- Missing data files are treated as empty lists on first run.
- Create/update/delete operations emit EventEmitter events; `activity.js` appends them to `activity.log`.
- JSON files are written through a temporary file followed by rename to reduce the chance of partial writes.

## Example API calls

```bash
curl http://localhost:3000/
curl http://localhost:3000/equipment
curl -X POST http://localhost:3000/equipment -H "Content-Type: application/json" -d "{\"name\":\"Projector\",\"note\":\"HDMI cable included\"}"
curl -X POST http://localhost:3000/borrowers -H "Content-Type: application/json" -d "{\"name\":\"Sokha Chan\",\"phone\":\"012345678\"}"
curl -X POST http://localhost:3000/rentals -H "Content-Type: application/json" -d "{\"itemId\":1,\"personId\":1}"
curl -X PUT http://localhost:3000/rentals/1/end
```

## Project structure

```text
equipment-api/
├── public/
│   └── index.html       # RentEasy website (HTML, CSS, JavaScript)
├── resources/
│   ├── equipment.js     # ITEM resource
│   ├── borrowers.js     # PERSON resource
│   ├── rentals.js       # LINK resource
│   └── types.js         # EXTRA resource
├── lib/
│   ├── events.js
│   ├── respond.js
│   └── static.js
├── data/                # JSON data files
├── activity.js
├── router.js
├── server.js
├── check.js
└── package.json
```
