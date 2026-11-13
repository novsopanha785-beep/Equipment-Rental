const EventEmitter = require('events');

// One shared bus: resources emit, activity.js listens.
module.exports = new EventEmitter();
