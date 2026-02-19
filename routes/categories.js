const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /api/categories - List all categories
router.get('/', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.json(categories);
});

// POST /api/categories - Add new category
router.post('/', (req, res) => {
  const { name, name_he, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const stmt = db.prepare('INSERT INTO categories (name, name_he, sort_order) VALUES (?, ?, ?)');
  const result = stmt.run(name, name_he || null, sort_order || 0);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(category);
});

// PUT /api/categories/:id - Update category
router.put('/:id', (req, res) => {
  const { name, name_he, sort_order } = req.body;
  const stmt = db.prepare('UPDATE categories SET name = COALESCE(?, name), name_he = COALESCE(?, name_he), sort_order = COALESCE(?, sort_order) WHERE id = ?');
  stmt.run(name || null, name_he || null, sort_order ?? null, req.params.id);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.json(category);
});

// DELETE /api/categories/:id - Delete category
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Category not found' });
  res.json({ success: true });
});

module.exports = router;
