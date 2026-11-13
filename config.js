const fs = require('fs');
const path = require('path');

// Load .env: use dotenv if installed, otherwise a tiny manual parser.
try {
  require('dotenv').config();
} catch (e) {
  try {
    const lines = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch (e2) { /* no .env file, use defaults */ }
}

module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  DATA_DIR: path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data')),
  LOG_FILE: path.resolve(process.env.LOG_FILE || path.join(__dirname, 'activity.log'))
};
