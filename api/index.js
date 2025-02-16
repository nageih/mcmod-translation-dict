const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const dbPath = path.join(__dirname, 'Dict-Sqlite.db');

app.use(express.static('public')); 

let db;

function initDatabase() {
    if (!db) {
        db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('无法连接到数据库:', err.message);
            } else {
                console.log('成功连接到SQLite数据库');
            }
        });
    }
    return db;
}

initDatabase();

// 获取数据库文件的最后修改时间
app.get('/api/lastUpdated', (req, res) => {
    fs.stat(dbPath, (err, stats) => {
        if (err) {
            return res.status(500).json({ error: '无法获取数据库文件信息' });
        }
        const lastUpdated = new Date(stats.mtime).toLocaleString();
        res.json({ lastUpdated });
    });
});

app.get('/api/search', (req, res) => {
    const query = req.query.q;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * 50;

    if (!query) {
        return res.status(400).json({ error: '查询参数不能为空' });
    }

    const normalizedQuery = query.trim().toLowerCase();

    const sql = `
    SELECT trans_name, origin_name, modid, version, key, COUNT(*) as frequency,
           CASE
               WHEN LOWER(origin_name) = ? THEN 3
               WHEN LOWER(origin_name) LIKE ? THEN 2
               ELSE 1
           END AS match_weight
    FROM dict
    WHERE LOWER(origin_name) LIKE ?
    GROUP BY trans_name, origin_name, modid, version, key
    ORDER BY match_weight DESC, frequency DESC
    LIMIT 50 OFFSET ?
    `;

    db.all(sql, [
        normalizedQuery, // 完全匹配
        `% ${normalizedQuery} %`, // 包含搜索词作为一个完整单词
        `%${normalizedQuery}%`, // 包含搜索词的所有情况
        offset
    ], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const countSql = `SELECT COUNT(*) as total FROM dict WHERE LOWER(origin_name) LIKE ?`;
        db.get(countSql, [`%${normalizedQuery}%`], (err, countResult) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // 返回搜索结果
            res.json({
                query,
                results: rows,
                total: countResult.total
            });
        });
    });
});

module.exports = (req, res) => {
    app(req, res);
};