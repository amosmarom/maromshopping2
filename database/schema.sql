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
  checked INTEGER DEFAULT 0,
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

-- Default categories
INSERT OR IGNORE INTO categories (name, name_he, sort_order) VALUES
  ('Produce', 'ירקות ופירות', 1),
  ('Dairy', 'מוצרי חלב', 2),
  ('Meat & Fish', 'בשר ודגים', 3),
  ('Bakery', 'מאפים ולחם', 4),
  ('Pantry', 'מזווה', 5),
  ('Frozen', 'קפואים', 6),
  ('Beverages', 'משקאות', 7),
  ('Snacks', 'חטיפים', 8),
  ('Cleaning', 'ניקיון', 9),
  ('Personal Care', 'טיפוח', 10),
  ('Other', 'אחר', 99);
