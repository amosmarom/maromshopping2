# Family Cart — Product Requirements Document

**Product Name:** עגלת המשפחה (Family Cart)
**Version:** 19/02/26
**Author:** Amos Marom
**Status:** Live

---

## 1. Overview

Family Cart is a shared family shopping assistant. It lets family members build shopping lists from a personal product catalog, carry out the actual shopping with a simple tap-to-check interface, and review past shopping trips. It runs as a web app accessible from any browser and is installable on iPhone like a native app.

---

## 2. Target Users

- A small family group (2–4 people)
- Shared single instance — all family members use the same URL
- Primary device: iPhone (Safari)
- Secondary: any desktop browser (Windows/Mac)

---

## 3. Goals

- Replace paper/notes shopping lists with a structured, reusable catalog
- Separate the list-building phase from the actual shopping phase
- Track what was found and what was missing during each trip
- Learn from past shopping trips to pre-populate new lists
- Be fast, simple, and require no login or setup from family members

---

## 4. Non-Goals

- No user accounts or authentication
- No multi-family or multi-tenant support
- No price tracking or budgeting
- No barcode scanning

---

## 5. Core Concepts

| Concept | Description |
|---|---|
| **Product** | A named item in the family catalog, with optional image, category, default quantity and unit |
| **Category** | A grouping for products (e.g. Dairy, Produce, Cleaning). Products in lists are grouped by category |
| **Shopping List** | An active list of products to buy, created before a shopping trip |
| **Build Mode** | The phase where family members add/remove items to a list before going shopping |
| **Shop Mode** | The phase during the actual shopping trip — tap to mark found, or flag as not found |
| **Archive** | Completing a list moves it to history and removes it from the active list view |
| **History** | A log of all completed shopping trips with their items and outcomes |

---

## 6. Features

### 6.1 Shopping Lists

- View all active shopping lists on the home screen
- Each list shows its name, item count (found/total), and creation date
- Create a new list via a + button
- When creating a new list, the app checks the most recent completed trip for items that were not found or left unchecked, and offers to add them to the new list (user can pick which ones)
- Archive a list directly from the home screen (without opening it) using the 🗄 button
- Tap a list to open it

### 6.2 Build Mode (List Editing)

- Search the product catalog to add items
- If a product is not found in the catalog, the user can type a name and the app opens a form to add it to the catalog and the list simultaneously
- Each item shows a thumbnail image (if available), name, quantity and unit
- Items are grouped by product category
- Remove items with a ✕ button
- Switch to Shop Mode when ready to go shopping

### 6.3 Shop Mode (Actual Shopping)

- Tap the green checkbox to mark an item as **found** (turns green, name struck through)
- Tap **"לא נמצא"** (not found) to flag an item as unavailable (turns red/muted)
- A progress bar and counter show: ✓ found / ✗ not found / ◯ remaining
- Archive the list when shopping is complete — this saves it to history

### 6.4 Product Catalog

- A searchable, filterable library of all family products
- Filter by category using chips at the top
- Each product card shows its image, name, and category
- Add, edit, or delete products
- Product fields: Hebrew name, English name (optional), category, default quantity, default unit, image

### 6.5 Product Images

Three ways to add a product image:
1. **File picker** — select any image from the device
2. **Camera button (📷 צלם)** — opens the camera directly on iPhone
3. **Clipboard paste (Ctrl+V)** — paste a copied image on Windows desktop

### 6.6 Categories

- Manage a list of product categories
- Default categories provided: Produce, Dairy, Meat & Fish, Bakery, Pantry, Frozen, Beverages, Snacks, Cleaning, Personal Care, Other
- Add, rename, or delete categories
- Products and list items are automatically grouped by category

### 6.7 History

Two ways to view shopping history:

**By List** — each completed trip is a collapsible card showing the trip name, date, and item count. Expand to see all items. Option to delete a history record.

**By Item** — all history items grouped by product name, showing how many times each product was bought and in which trips. Useful for understanding buying patterns.

---

## 7. Navigation

The app has a fixed bottom navigation bar with four tabs:

| Tab | Icon | Purpose |
|---|---|---|
| רשימות (Lists) | 🛒 | Home screen — active shopping lists |
| קטלוג (Catalog) | 📦 | Browse and manage product catalog |
| קטגוריות (Categories) | 🏷️ | Manage product categories |
| היסטוריה (History) | 📋 | View past shopping trips |

---

## 8. Platform & Access

- **URL:** Hosted on Railway cloud — accessible from any device via browser
- **iPhone:** Installable as a home screen app via Safari → Share → Add to Home Screen
- **Desktop:** Full functionality in any modern browser (Chrome, Edge, Firefox)
- **Offline:** Not supported (requires internet connection)

---

## 9. Design Principles

- **Hebrew first, RTL layout** throughout
- **Mobile-first** — designed for one-handed phone use while in a supermarket
- **No clutter** — minimal UI, large tap targets, clear labels
- **Green theme** — primary color #2e7d32, consistent with a fresh/food aesthetic
- **No login screen** — open the URL and it works immediately

---

## 10. Data & Storage

- All data stored in a cloud database (SQLite on Railway)
- Product images stored in cloud file storage
- Data persists across app updates and server restarts
- No local-only data — all family members see the same state in real time (on page refresh)

---

## 11. Future Ideas (Not Yet Implemented)

- Real-time sync between family members without manual refresh
- Shared notes per item
- Recurring lists / list templates
- Price tracking per product
- Export shopping list to WhatsApp / SMS
