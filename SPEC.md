# עגלת המשפחה — Application Specification

> Give this document to Claude and say: "Build this application from the spec."
> The result will be a fully working clone in a few steps.

---

## Overview

**Name:** עגלת המשפחה (Family Cart)
**Purpose:** Family shopping list manager with product catalog, history, and PWA support.
**Users:** Small family group (~3 people), shared via a cloud URL.
**Language:** Hebrew UI, RTL layout.
**Version:** 19/02/26 17:30

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20 |
| Framework | Express 4 |
| Database | SQLite via better-sqlite3 |
| File uploads | Multer |
| Frontend | Vanilla HTML + CSS + JS (no framework, no build step) |
| Deployment | Railway (NIXPACKS builder) |
| PWA | Web App Manifest + Apple meta tags |

---

## File Structure

```
maromshopping2/
├── server.js
├── package.json
├── railway.toml
├── nixpacks.toml
├── database/
│   ├── db.js
│   └── schema.sql
├── routes/
│   ├── categories.js
│   ├── catalog.js
│   ├── lists.js
│   └── history.js
└── public/
    ├── index.html
    ├── style.css
    ├── app.js
    ├── manifest.json
    └── icons/
        ├── apple-touch-icon.png  (180×180, solid green #2e7d32)
        ├── icon-192.png          (192×192, solid green #2e7d32)
        └── icon-512.png          (512×512, solid green #2e7d32)
```

---

## Deployment Config

### `package.json`
```json
{
  "name": "family-cart",
  "version": "1.0.0",
  "description": "Family Shopping & Catalog Manager",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "better-sqlite3": "^11.7.0",
    "express": "^4.21.0",
    "multer": "^1.4.5-lts.1"
  }
}
```

### `railway.toml`
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### `nixpacks.toml`
```toml
[phases.setup]
nixPkgs = ["nodejs_20", "python3", "gcc", "gnumake"]
```

### Railway Volume
- Mount a single persistent volume at `/app/data`
- This stores both the SQLite database (`/app/data/shopping.db`) and uploaded images (`/app/data/images/`)

---

## Backend

### `server.js`
```js
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'data', 'images')));

require('./database/db');

app.use('/api/categories', require('./routes/categories'));
app.use('/api/catalog',    require('./routes/catalog'));
app.use('/api/lists',      require('./routes/lists'));
app.use('/api/history',    require('./routes/history'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Family Cart running at http://localhost:${PORT}`);
});
```

### `database/db.js`
```js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'shopping.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);
console.log('Database initialized successfully');

module.exports = db;
```

### `database/schema.sql`
```sql
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  name_he TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_he TEXT,
  category_id INTEGER,
  default_unit TEXT DEFAULT 'יחידה',
  default_quantity REAL DEFAULT 1,
  image_path TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL,
  product_id INTEGER,
  custom_name TEXT,
  quantity REAL DEFAULT 1,
  unit TEXT DEFAULT 'יחידה',
  checked INTEGER DEFAULT 0,  -- 0=unchecked, 1=found, 2=not found
  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER,
  list_name TEXT,
  item_count INTEGER,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_history_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  history_id INTEGER NOT NULL,
  product_name TEXT,
  quantity REAL,
  unit TEXT,
  checked INTEGER DEFAULT 1,
  FOREIGN KEY (history_id) REFERENCES purchase_history(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO categories (name, name_he, sort_order) VALUES
  ('Produce',       'ירקות ופירות', 1),
  ('Dairy',         'מוצרי חלב',    2),
  ('Meat & Fish',   'בשר ודגים',    3),
  ('Bakery',        'מאפים ולחם',   4),
  ('Pantry',        'מזווה',         5),
  ('Frozen',        'קפואים',        6),
  ('Beverages',     'משקאות',        7),
  ('Snacks',        'חטיפים',        8),
  ('Cleaning',      'ניקיון',        9),
  ('Personal Care', 'טיפוח',         10),
  ('Other',         'אחר',           99);
```

### `routes/categories.js`
```js
const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY sort_order').all());
});

router.post('/', (req, res) => {
  const { name, name_he, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare('INSERT INTO categories (name, name_he, sort_order) VALUES (?, ?, ?)').run(name, name_he || null, sort_order || 0);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { name, name_he, sort_order } = req.body;
  db.prepare('UPDATE categories SET name = COALESCE(?, name), name_he = COALESCE(?, name_he), sort_order = COALESCE(?, sort_order) WHERE id = ?')
    .run(name || null, name_he || null, sort_order ?? null, req.params.id);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.json(category);
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Category not found' });
  res.json({ success: true });
});

module.exports = router;
```

### `routes/catalog.js`
```js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'data', 'images');
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
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype));
  }
});

router.get('/', (req, res) => {
  const { category_id, search } = req.query;
  let sql = `SELECT p.*, c.name as category_name, c.name_he as category_name_he
             FROM products p LEFT JOIN categories c ON p.category_id = c.id`;
  const params = [], conditions = [];
  if (category_id) { conditions.push('p.category_id = ?'); params.push(category_id); }
  if (search)      { conditions.push('(p.name LIKE ? OR p.name_he LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY c.sort_order, p.name';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const product = db.prepare(`SELECT p.*, c.name as category_name, c.name_he as category_name_he
    FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`).get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.post('/', (req, res) => {
  const { name, name_he, category_id, default_unit, default_quantity, notes } = req.body;
  if (!name && !name_he) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare(`INSERT INTO products (name, name_he, category_id, default_unit, default_quantity, notes) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(name || name_he, name_he || null, category_id || null, default_unit || 'יחידה', default_quantity || 1, notes || null);
  res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { name, name_he, category_id, default_unit, default_quantity, notes } = req.body;
  db.prepare(`UPDATE products SET name = COALESCE(?, name), name_he = COALESCE(?, name_he),
    category_id = COALESCE(?, category_id), default_unit = COALESCE(?, default_unit),
    default_quantity = COALESCE(?, default_quantity), notes = COALESCE(?, notes) WHERE id = ?`)
    .run(name || null, name_he || null, category_id || null, default_unit || null, default_quantity || null, notes || null, req.params.id);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.delete('/:id', (req, res) => {
  const product = db.prepare('SELECT image_path FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.image_path) {
    const imgPath = path.join(__dirname, '..', 'data', 'images', path.basename(product.image_path));
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const product = db.prepare('SELECT image_path FROM products WHERE id = ?').get(req.params.id);
  if (!product) { fs.unlinkSync(req.file.path); return res.status(404).json({ error: 'Product not found' }); }
  if (product.image_path) {
    const oldPath = path.join(__dirname, '..', 'data', 'images', path.basename(product.image_path));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  const imagePath = '/images/' + req.file.filename;
  db.prepare('UPDATE products SET image_path = ? WHERE id = ?').run(imagePath, req.params.id);
  res.json({ image_path: imagePath });
});

module.exports = router;
```

### `routes/lists.js`
```js
const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', (req, res) => {
  res.json(db.prepare(`
    SELECT sl.*, COUNT(li.id) as item_count,
           SUM(CASE WHEN li.checked = 1 THEN 1 ELSE 0 END) as checked_count
    FROM shopping_lists sl
    LEFT JOIN list_items li ON sl.id = li.list_id
    WHERE sl.status = 'active'
    GROUP BY sl.id ORDER BY sl.created_at DESC
  `).all());
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare('INSERT INTO shopping_lists (name) VALUES (?)').run(name);
  res.status(201).json(db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(result.lastInsertRowid));
});

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

router.put('/:id', (req, res) => {
  const { name } = req.body;
  db.prepare('UPDATE shopping_lists SET name = COALESCE(?, name) WHERE id = ?').run(name || null, req.params.id);
  const list = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: 'List not found' });
  res.json(list);
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM shopping_lists WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'List not found' });
  res.json({ success: true });
});

router.post('/:id/items', (req, res) => {
  const { product_id, custom_name, quantity, unit, notes } = req.body;
  const list = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: 'List not found' });
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max_order FROM list_items WHERE list_id = ?').get(req.params.id);
  const sortOrder = (maxOrder?.max_order || 0) + 1;
  let itemUnit = unit || 'יחידה', itemQty = quantity || 1;
  if (product_id) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (product) { itemUnit = unit || product.default_unit; itemQty = quantity || product.default_quantity; }
  }
  const result = db.prepare(`INSERT INTO list_items (list_id, product_id, custom_name, quantity, unit, sort_order, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(req.params.id, product_id || null, custom_name || null, itemQty, itemUnit, sortOrder, notes || null);
  const item = db.prepare(`
    SELECT li.*, p.name as product_name, p.name_he as product_name_he,
           p.image_path, p.category_id, c.name as category_name, c.name_he as category_name_he
    FROM list_items li
    LEFT JOIN products p ON li.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE li.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(item);
});

router.put('/:id/items/:itemId', (req, res) => {
  const { quantity, unit, checked, sort_order, notes } = req.body;
  const updates = [], params = [];
  if (quantity !== undefined)   { updates.push('quantity = ?');   params.push(quantity); }
  if (unit !== undefined)       { updates.push('unit = ?');       params.push(unit); }
  if (checked !== undefined)    { updates.push('checked = ?');    params.push(checked); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
  if (notes !== undefined)      { updates.push('notes = ?');      params.push(notes); }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.itemId, req.params.id);
  db.prepare(`UPDATE list_items SET ${updates.join(', ')} WHERE id = ? AND list_id = ?`).run(...params);
  const item = db.prepare(`
    SELECT li.*, p.name as product_name, p.name_he as product_name_he,
           p.image_path, p.category_id, c.name as category_name, c.name_he as category_name_he
    FROM list_items li LEFT JOIN products p ON li.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id WHERE li.id = ?
  `).get(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

router.delete('/:id/items/:itemId', (req, res) => {
  const result = db.prepare('DELETE FROM list_items WHERE id = ? AND list_id = ?').run(req.params.itemId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });
  res.json({ success: true });
});

router.post('/:id/complete', (req, res) => {
  const list = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: 'List not found' });
  const items = db.prepare('SELECT li.*, p.name as product_name, p.name_he as product_name_he FROM list_items li LEFT JOIN products p ON li.product_id = p.id WHERE li.list_id = ?').all(req.params.id);
  db.transaction(() => {
    const historyResult = db.prepare('INSERT INTO purchase_history (list_id, list_name, item_count) VALUES (?, ?, ?)').run(list.id, list.name, items.length);
    const insertItem = db.prepare('INSERT INTO purchase_history_items (history_id, product_name, quantity, unit, checked) VALUES (?, ?, ?, ?, ?)');
    for (const item of items) {
      insertItem.run(historyResult.lastInsertRowid, item.product_name_he || item.product_name || item.custom_name, item.quantity, item.unit, item.checked);
    }
    db.prepare("UPDATE shopping_lists SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  })();
  res.json({ success: true });
});

module.exports = router;
```

### `routes/history.js`
```js
const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM purchase_history ORDER BY completed_at DESC').all());
});

// Must be before /:id to avoid conflict
router.get('/items', (req, res) => {
  res.json(db.prepare(`
    SELECT phi.*, ph.list_name, ph.completed_at
    FROM purchase_history_items phi
    JOIN purchase_history ph ON phi.history_id = ph.id
    ORDER BY phi.product_name, ph.completed_at DESC
  `).all());
});

router.get('/:id', (req, res) => {
  const record = db.prepare('SELECT * FROM purchase_history WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'History record not found' });
  const items = db.prepare('SELECT * FROM purchase_history_items WHERE history_id = ?').all(req.params.id);
  res.json({ ...record, items });
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM purchase_history WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'History record not found' });
  res.json({ success: true });
});

module.exports = router;
```

---

## Frontend

### `public/manifest.json`
```json
{
  "name": "עגלת המשפחה",
  "short_name": "עגלת המשפחה",
  "description": "רשימות קניות משפחתיות",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#2e7d32",
  "theme_color": "#2e7d32",
  "orientation": "portrait",
  "lang": "he",
  "dir": "rtl",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### PWA Icons
Generate three solid-green (#2e7d32 = rgb(46,125,50)) PNG files using Node.js Buffer + zlib (no external deps):
- `public/icons/apple-touch-icon.png` — 180×180
- `public/icons/icon-192.png` — 192×192
- `public/icons/icon-512.png` — 512×512

### `public/index.html`

Full RTL Hebrew SPA shell. Key structure:
- `<html lang="he" dir="rtl">`
- Apple PWA meta tags + manifest link
- Header with back button, centered title + version span
- 5 views inside `<main>`: lists, list-detail, catalog, categories, history
- Bottom nav: 🛒 רשימות | 📦 קטלוג | 🏷️ קטגוריות | 📋 היסטוריה
- 6 modals: modal-new-list, modal-product, modal-edit-category, modal-add-item, modal-suggest-items, modal-confirm

Critical element IDs (app.js depends on all of these):

**Header:** `btn-back`, `header-title`, `app-version`

**View: lists** — `view-lists`, `lists-container`, `fab-new-list`

**View: list-detail** — `view-list-detail`, `mode-tab-build`, `mode-tab-shop`, `list-progress-wrap`, `list-progress-bar`, `list-progress-text`, `add-item-bar`, `item-search-input`, `btn-add-custom-item`, `item-search-results`, `list-items-container`, `btn-complete-list`

**View: catalog** — `view-catalog`, `catalog-search`, `category-chips`, `catalog-container`, `fab-new-product`

**View: categories** — `view-categories`, `new-category-input`, `btn-add-category`, `categories-container`

**View: history** — `view-history`, `history-tab-lists`, `history-tab-items`, `history-container`

**Modal: new list** — `modal-new-list`, `new-list-name`, `btn-create-list`

**Modal: product** — `modal-product`, `modal-product-title`, `product-edit-id`, `product-name-he`, `product-name-en`, `product-category`, `product-qty`, `product-unit`, `product-image`, `btn-camera`, `product-camera`, `product-image-preview`, `btn-save-product`

**Modal: edit category** — `modal-edit-category`, `edit-category-id`, `edit-category-name`, `btn-save-category`

**Modal: add item** — `modal-add-item`, `add-item-product-id`, `add-item-product-name`, `add-item-qty`, `add-item-unit`, `btn-confirm-add-item`

**Modal: suggest items** — `modal-suggest-items`, `modal-suggest-title`, `modal-suggest-subtitle`, `suggest-items-list`, `btn-confirm-suggestions`, `btn-skip-suggestions`

**Modal: confirm** — `modal-confirm`, `modal-confirm-title`, `modal-confirm-message`, `btn-confirm-delete`

**Toast:** `toast`

Notable markup details:
- `btn-back`: `&#8594;` (→ arrow, RTL so points right = back)
- `btn-complete-list` starts with class `hidden`
- `list-progress-wrap` starts with class `hidden`
- `btn-skip-suggestions` does NOT have `modal-close` class (has its own handler)
- Product modal image section:
  ```html
  <div class="image-input-row">
    <input type="file" id="product-image" class="modal-input" accept="image/*" />
    <button type="button" id="btn-camera" class="btn-camera">📷 צלם</button>
    <input type="file" id="product-camera" accept="image/*" capture="environment" class="hidden" />
  </div>
  <span class="paste-hint">או הדבק תמונה מהלוח (Ctrl+V)</span>
  ```
- History view has mode tabs above the container:
  ```html
  <div class="mode-tabs" style="margin:12px 16px 0">
    <button class="mode-tab active" id="history-tab-lists">📋 לפי רשימה</button>
    <button class="mode-tab" id="history-tab-items">📦 לפי פריט</button>
  </div>
  ```

---

## Application Logic (`public/app.js`)

### State Object
```js
const state = {
  currentView: 'lists',
  currentListId: null,
  currentListName: '',
  categories: [],
  catalogFilter: { search: '', categoryId: null },
  confirmCallback: null,
  addItemPendingProduct: null,
  addToListAfterSave: false,   // true when product modal opened from list search
  listMode: 'build',           // 'build' | 'shop'
  currentListItems: [],        // cached items for mode switch without re-fetch
};
```

### Version
```js
const APP_VERSION = '19/02/26 17:30';  // Update on every change
```

### Key Behaviors

**Navigation:** `navigate(view)` shows the matching `view-{name}` section, loads data, updates bottom nav active state. `openListDetail(id, name)` navigates to list-detail view.

**List modes:** Two tabs — build mode (✏️ עריכה) and shop mode (🛒 קנייה).
- Build mode: shows add-item bar, item rows with delete button, no checkboxes, no progress bar, no archive button.
- Shop mode: hides add-item bar, shows found checkbox + "לא נמצא" button per item, progress bar, archive button.
- `setListMode(mode)` switches between them without re-fetching.

**Item checked states:** `0` = unchecked, `1` = found (green), `2` = not found (red/muted).

**Item rows:**
- Build mode (`buildItemRowBuild`): thumbnail | name + qty | ✕ delete
- Shop mode (`buildItemRowShop`): ✓ checkbox | thumbnail | name + qty | לא נמצא button

**Product thumbnail:** `item.image_path` shown as `<img class="item-thumb">`, fallback is `<span class="item-thumb-placeholder">📦</span>`.

**Found checkbox style:** `.item-btn-found` is a styled box (26×26px, border-radius 6px). Empty = white border. `.active` = green fill + white ✓.

**Adding items to list:** Search bar autocompletes from catalog. Selecting a product opens `modal-add-item` to confirm qty/unit. Pressing "הוסף" with a name not in catalog opens the product modal pre-filled (`state.addToListAfterSave = true`) — saving creates the product AND adds it to the current list.

**Archive list:** From list-detail (shop mode) via `btn-complete-list`, or from the list card via `btn-archive-list`. Both call `POST /api/lists/:id/complete`. Shows confirm dialog with title "אישור ארכוב", label "ארכב", class `btn-success`.

**Suggest missing items:** After creating a new list, fetch the most recent history record, find items where `checked !== 1` (not found or unchecked), show them in `modal-suggest-items` with pre-checked checkboxes. User can deselect items, confirm adds them to the new list.

**Clipboard paste:** `document.addEventListener('paste', ...)` — only active when `modal-product` is visible. Extracts image from `clipboardData.items`, stores as `pastedImageFile`, shows preview.

**Camera button:** `btn-camera` triggers a hidden `<input type="file" capture="environment">` — opens camera directly on iPhone.

**Image upload priority on save:** `pastedImageFile || product-image.files[0] || product-camera.files[0]`

**History views:**
- By list: collapsible cards per shopping trip, lazy-loads items on expand.
- By item: groups all history items by `product_name`, sorted alphabetically, shows which lists and dates each item appeared in.

**showConfirm(message, callback, opts):** `opts = { title, confirmLabel, confirmClass }` — allows reusing the confirm modal for archive (green) vs delete (red).

**`esc(str)`:** HTML-escapes all user content before inserting into innerHTML.

---

## CSS Design System (`public/style.css`)

- **Direction:** RTL (`html { direction: rtl }`)
- **Font:** `Arial, "Segoe UI", Tahoma, sans-serif`
- **Primary color:** `#2e7d32` (dark green)
- **Background:** `#f0f4f0` (light grey-green)
- **Cards:** white, `border-radius: 12px`, subtle shadow
- **Bottom nav:** fixed, safe-area-aware (`padding-bottom: env(safe-area-inset-bottom)`)
- **FAB:** fixed bottom-right (for RTL, positioned `left: 20px`)
- **Mode tabs:** pill style, active = green filled
- **Item states:**
  - `.item-found` — green tint background, name strikethrough, opacity reduced
  - `.item-not-found` — red tint background, muted text
- **Thumbnail:** `.item-thumb` 40×40px, `border-radius: 8px`, `object-fit: cover`
- **Progress bar:** `.progress-bar-wrap` grey track, `.progress-bar` green fill
- **Toast:** fixed top-center, slides in/out, `.success` = green, `.error` = red
- **Modals:** `.modal-overlay` full-screen backdrop, `.modal-box` centered white card, `.modal-box-scroll` allows scrolling for tall content

---

## Feature Summary

| Feature | Description |
|---|---|
| Shopping lists | Create, view, archive. FAB to create, 🗄 button on card to archive directly. |
| List build mode | Add items from catalog or by typing (adds to catalog). Remove items. |
| List shop mode | Mark items found (checkbox) or not found. Progress bar. Archive when done. |
| Missing item suggestions | On new list creation, suggests items not found in previous shopping. |
| Product catalog | Search, filter by category chips, add/edit/delete products with images. |
| Product images | File picker, iPhone camera button (📷 צלם), Windows clipboard paste (Ctrl+V). |
| Categories | Add/edit/delete. Products grouped by category in list and catalog views. |
| History by list | Expandable cards per completed shopping trip. |
| History by item | All items grouped by product name, showing frequency and dates. |
| PWA | Installable on iPhone via Safari → Share → Add to Home Screen. |
| Version display | Shown in header below title, updated with every code change. |
