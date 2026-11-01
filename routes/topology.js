const express = require('express');

module.exports = function(db) {
    const router = express.Router();

    // 1. Endpoint untuk mengambil semua posisi node dari SQLite
    router.get('/api/topology/positions', (req, res) => {
        db.all(`SELECT node_id, x, y FROM topology_positions`, [], (err, rows) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
            // Ubah format array menjadi objek key-value: { "node_id": {x, y}, ... }
            const positionsObj = {};
            rows.forEach(row => {
                positionsObj[row.node_id] = { x: row.x, y: row.y };
            });
            res.json(positionsObj);
        });
    });

    // 2. Endpoint untuk menyimpan posisi node ke SQLite
    router.post('/api/topology/positions', (req, res) => {
        const positionsObj = req.body; // Format: { "node_id": {x, y}, ... }
        
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            const stmt = db.prepare(`INSERT OR REPLACE INTO topology_positions (node_id, x, y) VALUES (?, ?, ?)`);
            for (const [nodeId, coords] of Object.entries(positionsObj)) {
                stmt.run(nodeId, coords.x, coords.y);
            }
            stmt.finalize();

            db.run("COMMIT", (err) => {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                res.json({ success: true });
            });
        });
    });

    return router;
};