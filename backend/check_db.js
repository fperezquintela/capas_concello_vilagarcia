const Database = require('better-sqlite3');
const db = new Database('dev.db');
const rows = db.prepare('SELECT * FROM layer_metadata').all();
console.log(JSON.stringify(rows, null, 2));
db.close();
