const http = require('http');
const config = require('./config');
const router = require('./router');
require('./activity'); // start listening to events

const server = http.createServer(router);

server.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
});

// The server must never crash
process.on('uncaughtException', (err) => console.error('Uncaught:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));
