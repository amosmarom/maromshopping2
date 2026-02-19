const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'public', 'images');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `product-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

// GET /api/catalog - List all products
router.get('/', (req, res) => {
  const { category_id, search } = req.query;
  let sql = `SELECT p.*, c.name as category_name, c.name_he as category_name_he
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id`;
  const params = [];
  const conditions = [];

  if (category_id) {
    conditions.push('p.category_id = ?');
    params.push(category_id);
  }
  if (search) {
    conditions.push('(p.name LIKE ? OR p.name_he LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY c.sort_order, p.name';

  const products = db.prepare(sql).all(...params);
  res.json(products);
});

// GET /api/catalog/:id - Get single product
router.get('/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.name_he as category_name_he
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// POST /api/catalog - Add new product
router.post('/', (req, res) => {
  const { name, name_he, category_id, default_unit, default_quantity, notes } = req.body;
  if (!name && !name_he) return res.status(400).json({ error: 'Name is required' });

  const stmt = db.prepare(`INSERT INTO products (name, name_he, category_id, default_unit, default_quantity, notes)
                           VALUES (?, ?, ?, ?, ?, ?)`);
  const result = stmt.run(
    name || name_he,
    name_he || null,
    category_id || null,
    default_unit || 'יחידה',
    default_quantity || 1,
    notes || null
  );
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(product);
});

// PUT /api/catalog/:id - Update product
router.put('/:id', (req, res) => {
  const { name, name_he, category_id, default_unit, default_quantity, notes } = req.body;
  const stmt = db.prepare(`UPDATE products SET
    name = COALESCE(?, name),
    name_he = COALESCE(?, name_he),
    category_id = COALESCE(?, category_id),
    default_unit = COALESCE(?, default_unit),
    default_quantity = COALESCE(?, default_quantity),
    notes = COALESCE(?, notes)
    WHERE id = ?`);
  stmt.run(name || null, name_he || null, category_id || null, default_unit || null, default_quantity || null, notes || null, req.params.id);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// DELETE /api/catalog/:id - Delete product
router.delete('/:id', (req, res) => {
  const product = db.prepare('SELECT image_path FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  // Delete image file if exists
  if (product.image_path) {
    const imgPath = path.join(__dirname, '..', 'public', product.image_path);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/catalog/:id/image - Upload product image
router.post('/:id/image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  const product = db.prepare('SELECT image_path FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Product not found' });
  }

  // Delete old image if exists
  if (product.image_path) {
    const oldPath = path.join(__dirname, '..', 'public', product.image_path);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const imagePath = '/images/' + req.file.filename;
  db.prepare('UPDATE products SET image_path = ? WHERE id = ?').run(imagePath, req.params.id);

  res.json({ image_path: imagePath });
});

module.exports = router;
