const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /api/history - Get purchase history
router.get('/', (req, res) => {
  const history = db.prepare('SELECT * FROM purchase_history ORDER BY completed_at DESC').all();
  res.json(history);
});

// GET /api/history/:id - Get history detail with items
router.get('/:id', (req, res) => {
  const record = db.prepare('SELECT * FROM purchase_history WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'History record not found' });

  const items = db.prepare('SELECT * FROM purchase_history_items WHERE history_id = ?').all(req.params.id);
  res.json({ ...record, items });
});

// DELETE /api/history/:id - Delete history record
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM purchase_history WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'History record not found' });
  res.json({ success: true });
});

module.exports = router;
