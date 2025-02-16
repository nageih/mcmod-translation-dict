const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'Dict-Sqlite.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('无法连接到数据库:', err.message);
    } else {
        console.log('成功连接到SQLite数据库');
    }
});

module.exports = db;