const fs = require('fs').promises;
const bus = require('./lib/events');
const config = require('./config');

// Queue writes so rapid events are appended in the same order they were emitted.
let writeQueue = Promise.resolve();
for (const event of ['created', 'updated', 'deleted']) {
  bus.on(event, ({ resource, id }) => {
    const line = `${new Date().toISOString()} ${event} ${resource} #${id}\n`;
    writeQueue = writeQueue
      .then(() => fs.appendFile(config.LOG_FILE, line, 'utf8'))
      .catch((err) => console.error('Cannot write activity log:', err.message));
  });
}
