const express = require('express');

module.exports = function(db) {
    const router = express.Router();

    // Pastikan tabel otomatis dibuat
    db.run(`CREATE TABLE IF NOT EXISTS topology_positions (
        node_id TEXT PRIMARY KEY,
        x REAL,
        y REAL
    )`);

    // Endpoint GET posisi node
    router.get('/topology/positions', (req, res) => {
        db.all(`SELECT node_id, x, y FROM topology_positions`, [], (err, rows) => {
            if (err) {
                console.error('❌ Error GET positions:', err.message);
                return res.status(500).json({ success: false, error: err.message });
            }
            const positionsObj = {};
            (rows || []).forEach(row => {
                positionsObj[row.node_id] = { x: row.x, y: row.y };
            });
            res.json(positionsObj);
        });
    });

    // Endpoint POST simpan posisi node
    router.post('/topology/positions', (req, res) => {
        const positionsObj = req.body;
        console.payload = positionsObj;
        console.log('📥 Menerima data posisi dari frontend:', JSON.stringify(positionsObj));

        if (!positionsObj || typeof positionsObj !== 'object') {
            return res.status(400).json({ success: false, error: 'Invalid data format' });
        }

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            const stmt = db.prepare(`INSERT OR REPLACE INTO topology_positions (node_id, x, y) VALUES (?, ?, ?)`);
            for (const [nodeId, coords] of Object.entries(positionsObj)) {
                if (coords && coords.x !== undefined && coords.y !== undefined) {
                    stmt.run(nodeId, parseFloat(coords.x), parseFloat(coords.y));
                }
            }
            stmt.finalize();

            db.run("COMMIT", (err) => {
                if (err) {
                    console.error('❌ Error COMMIT positions:', err.message);
                    return res.status(500).json({ success: false, error: err.message });
                }
                console.log('✅ Posisi berhasil disimpan ke database SQLite!');
                res.json({ success: true });
            });
        });
    });

    return router;
};