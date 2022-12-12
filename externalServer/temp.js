const path = require('path');
const os = require('os');
console.log(path.join(os.tmpdir(), 'log.txt'));
