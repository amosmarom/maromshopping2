const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /api/lists - Get all active lists
router.get('/', (req, res) => {
  const lists = db.prepare(`
    SELECT sl.*, COUNT(li.id) as item_count,
           SUM(CASE WHEN li.checked = 1 THEN 1 ELSE 0 END) as checked_count
    FROM shopping_lists sl
    LEFT JOIN list_items li ON sl.id = li.list_id
    WHERE sl.status = 'active'
    GROUP BY sl.id
    ORDER BY sl.created_at DESC
  `).all();
  res.json(lists);
});

// POST /api/lists - Create new list
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare('INSERT INTO shopping_lists (name) VALUES (?)').run(name);
  const list = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(list);
});

// GET /api/lists/:id - Get list with items grouped by category
router.get('/:id', (req, res) => {
  const list = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: 'List not found' });

  const items = db.prepare(`
    SELECT li.*, p.name as product_name, p.name_he as product_name_he,
           p.image_path, p.category_id,
           c.name as category_name, c.name_he as category_name_he, c.sort_order as category_sort
    FROM list_items li
    LEFT JOIN products p ON li.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE li.list_id = ?
    ORDER BY COALESCE(c.sort_order, 999), li.sort_order, li.added_at
  `).all(req.params.id);

  res.json({ ...list, items });
});

// PUT /api/lists/:id - Update list
router.put('/:id', (req, res) => {
  const { name } = req.body;
  db.prepare('UPDATE shopping_lists SET name = COALESCE(?, name) WHERE id = ?').run(name || null, req.params.id);
  const list = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: 'List not found' });
  res.json(list);
});

// DELETE /api/lists/:id - Delete list
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM shopping_lists WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'List not found' });
  res.json({ success: true });
});

// POST /api/lists/:id/items - Add item to list
router.post('/:id/items', (req, res) => {
  const { product_id, custom_name, quantity, unit, notes } = req.body;
  const list = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: 'List not found' });

  // Get max sort_order
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max_order FROM list_items WHERE list_id = ?').get(req.params.id);
  const sortOrder = (maxOrder?.max_order || 0) + 1;

  let itemUnit = unit || 'יחידה';
  let itemQty = quantity || 1;

  // If adding from catalog, use product defaults
  if (product_id) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (product) {
      itemUnit = unit || product.default_unit;
      itemQty = quantity || product.default_quantity;
    }
  }

  const stmt = db.prepare(`INSERT INTO list_items (list_id, product_id, custom_name, quantity, unit, sort_order, notes)
                           VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const result = stmt.run(req.params.id, product_id || null, custom_name || null, itemQty, itemUnit, sortOrder, notes || null);

  const item = db.prepare(`
    SELECT li.*, p.name as product_name, p.name_he as product_name_he,
           p.image_path, p.category_id,
           c.name as category_name, c.name_he as category_name_he
    FROM list_items li
    LEFT JOIN products p ON li.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE li.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(item);
});

// PUT /api/lists/:id/items/:itemId - Update item
router.put('/:id/items/:itemId', (req, res) => {
  const { quantity, unit, checked, sort_order, notes } = req.body;
  const updates = [];
  const params = [];

  if (quantity !== undefined) { updates.push('quantity = ?'); params.push(quantity); }
  if (unit !== undefined) { updates.push('unit = ?'); params.push(unit); }
  if (checked !== undefined) { updates.push('checked = ?'); params.push(checked ? 1 : 0); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
  if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.itemId, req.params.id);
  db.prepare(`UPDATE list_items SET ${updates.join(', ')} WHERE id = ? AND list_id = ?`).run(...params);

  const item = db.prepare(`
    SELECT li.*, p.name as product_name, p.name_he as product_name_he,
           p.image_path, p.category_id,
           c.name as category_name, c.name_he as category_name_he
    FROM list_items li
    LEFT JOIN products p ON li.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE li.id = ?
  `).get(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

// DELETE /api/lists/:id/items/:itemId - Remove item
router.delete('/:id/items/:itemId', (req, res) => {
  const result = db.prepare('DELETE FROM list_items WHERE id = ? AND list_id = ?').run(req.params.itemId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });
  res.json({ success: true });
});

// POST /api/lists/:id/complete - Complete list and move to history
router.post('/:id/complete', (req, res) => {
  const list = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: 'List not found' });

  const items = db.prepare('SELECT li.*, p.name as product_name, p.name_he as product_name_he FROM list_items li LEFT JOIN products p ON li.product_id = p.id WHERE li.list_id = ?').all(req.params.id);

  const completeTransaction = db.transaction(() => {
    // Create history record
    const historyResult = db.prepare('INSERT INTO purchase_history (list_id, list_name, item_count) VALUES (?, ?, ?)').run(list.id, list.name, items.length);

    // Copy items to history
    const insertHistoryItem = db.prepare('INSERT INTO purchase_history_items (history_id, product_name, quantity, unit, checked) VALUES (?, ?, ?, ?, ?)');
    for (const item of items) {
      insertHistoryItem.run(
        historyResult.lastInsertRowid,
        item.product_name_he || item.product_name || item.custom_name,
        item.quantity,
        item.unit,
        item.checked
      );
    }

    // Mark list as completed
    db.prepare("UPDATE shopping_lists SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  });

  completeTransaction();
  res.json({ success: true, message: 'List completed and saved to history' });
});

module.exports = router;
