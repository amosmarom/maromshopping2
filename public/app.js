/* ===================================================
   Family Cart – app.js
   Vanilla JS SPA – no framework, no build step
   =================================================== */

'use strict';

const APP_VERSION = '19/02/26 17:30';

// ─── State ────────────────────────────────────────────
const state = {
  currentView: 'lists',
  currentListId: null,
  currentListName: '',
  categories: [],
  catalogFilter: { search: '', categoryId: null },
  confirmCallback: null,
  addItemPendingProduct: null, // { id, name_he, name, default_unit, default_quantity }
  addToListAfterSave: false,   // true when product modal opened from list search
  listMode: 'build',           // 'build' | 'shop'
  currentListItems: [],        // cached items — avoids re-fetch on mode switch
};

// ─── API helpers ──────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body && !(body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    opts.body = body;
  }
  const res = await fetch(path, opts);
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const get    = (path)         => api('GET',    path);
const post   = (path, body)   => api('POST',   path, body);
const put    = (path, body)   => api('PUT',    path, body);
const del    = (path)         => api('DELETE', path);

// ─── Toast ─────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast${type ? ' ' + type : ''}`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ─── Modal helpers ────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
}

// ─── Navigation ───────────────────────────────────────
function navigate(view) {
  // Hide list-detail view & show nav when switching main tabs
  if (view !== 'list-detail') {
    state.currentListId = null;
    document.getElementById('btn-back').classList.add('hidden');
    document.getElementById('header-title').textContent = 'עגלת המשפחה';
    document.querySelectorAll('.bottom-nav .nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.view === view);
    });
  }

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const viewEl = document.getElementById(`view-${view}`);
  if (viewEl) viewEl.classList.add('active');
  state.currentView = view;

  // Load data for view
  if (view === 'lists')      loadLists();
  if (view === 'catalog')    loadCatalog();
  if (view === 'categories') loadCategories();
  if (view === 'history')    loadHistory();
}

function openListDetail(listId, listName) {
  state.currentListId = listId;
  state.currentListName = listName;
  document.getElementById('header-title').textContent = listName;
  document.getElementById('btn-back').classList.remove('hidden');
  document.querySelectorAll('.bottom-nav .nav-item').forEach(b => b.classList.remove('active'));
  navigate('list-detail');
  loadListDetail(listId);
}

// ─── Date formatting ──────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

// ─── Product display name ─────────────────────────────
function productLabel(p) {
  return p.name_he || p.name || 'מוצר';
}

// ═══════════════════════════════════════════════════════
//  LISTS VIEW
// ═══════════════════════════════════════════════════════
async function loadLists() {
  const cont = document.getElementById('lists-container');
  cont.innerHTML = '<div class="loading">טוען...</div>';
  try {
    const lists = await get('/api/lists');
    if (!lists.length) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🛒</div>
          <p>אין רשימות עדיין</p>
          <p class="text-muted">לחץ + כדי ליצור רשימה חדשה</p>
        </div>`;
      return;
    }
    cont.innerHTML = '';
    lists.forEach(list => {
      const checked = list.checked_count ?? 0;
      const total   = list.item_count    ?? 0;
      const card = document.createElement('div');
      card.className = 'list-card';
      card.innerHTML = `
        <div class="list-card-main">
          <div class="list-card-title">${esc(list.name)}</div>
          <div class="list-card-meta">
            <span class="list-card-badge">${checked}/${total} פריטים</span>
            <span>${fmtDate(list.created_at)}</span>
          </div>
        </div>
        <button class="btn-archive-list" aria-label="ארכב">🗄</button>`;
      card.querySelector('.list-card-main').addEventListener('click', () => openListDetail(list.id, list.name));
      card.querySelector('.btn-archive-list').addEventListener('click', e => {
        e.stopPropagation();
        showConfirm(`לארכב את "${esc(list.name)}"?`, async () => {
          try {
            await post(`/api/lists/${list.id}/complete`, {});
            card.remove();
            showToast('הרשימה עברה לארכיון', 'success');
          } catch (err) {
            showToast(`שגיאה: ${err.message}`, 'error');
          }
        }, { title: 'אישור ארכוב', confirmLabel: 'ארכב', confirmClass: 'btn-success' });
      });
      cont.appendChild(card);
    });
  } catch (e) {
    cont.innerHTML = `<div class="loading">שגיאה בטעינה: ${esc(e.message)}</div>`;
  }
}

// ─── New List Modal ───────────────────────────────────
document.getElementById('fab-new-list').addEventListener('click', () => {
  document.getElementById('new-list-name').value = '';
  openModal('modal-new-list');
  setTimeout(() => document.getElementById('new-list-name').focus(), 100);
});

document.getElementById('btn-create-list').addEventListener('click', async () => {
  const name = document.getElementById('new-list-name').value.trim();
  if (!name) { showToast('נא להזין שם לרשימה', 'error'); return; }
  try {
    const list = await post('/api/lists', { name });
    closeModal('modal-new-list');
    showToast('הרשימה נוצרה', 'success');
    const suggested = await checkLastShoppingMissing(list.id, list.name);
    if (!suggested) openListDetail(list.id, list.name);
  } catch (e) {
    showToast(`שגיאה: ${e.message}`, 'error');
  }
});

document.getElementById('new-list-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-create-list').click();
});

// ─── Suggest missing items from last shopping ─────────
async function checkLastShoppingMissing(listId, listName) {
  try {
    const history = await get('/api/history');
    if (!history.length) return false;
    const latest = history[0]; // newest first
    const detail = await get(`/api/history/${latest.id}`);
    // remaining = anything NOT marked as found (unchecked=0 or not-found=2)
    const missing = (detail.items || []).filter(i => i.checked !== 1 && i.product_name);
    if (!missing.length) return false;
    openSuggestModal(listId, listName, missing, latest.list_name, latest.completed_at);
    return true;
  } catch {
    return false;
  }
}

function openSuggestModal(listId, listName, items, lastListName, completedAt) {
  const el = document.getElementById('modal-suggest-items');
  el.dataset.listId   = listId;
  el.dataset.listName = listName;

  document.getElementById('modal-suggest-subtitle').textContent =
    `מתוך "${lastListName}" — ${fmtDate(completedAt)}`;

  const container = document.getElementById('suggest-items-list');
  container.innerHTML = '';
  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'suggest-item-row';
    const uid = `sug-${i}`;
    row.innerHTML = `
      <input type="checkbox" id="${uid}" checked />
      <label for="${uid}">${esc(item.product_name)}</label>
      <span class="suggest-item-qty">${item.quantity ?? 1} ${esc(item.unit || '')}</span>`;
    // tap the row toggles the checkbox
    row.addEventListener('click', e => {
      if (e.target.tagName !== 'INPUT') row.querySelector('input').click();
    });
    container.appendChild(row);
  });

  openModal('modal-suggest-items');
}

document.getElementById('btn-confirm-suggestions').addEventListener('click', async () => {
  const el       = document.getElementById('modal-suggest-items');
  const listId   = parseInt(el.dataset.listId);
  const listName = el.dataset.listName;
  const checked  = el.querySelectorAll('input[type="checkbox"]:checked');
  closeModal('modal-suggest-items');

  if (checked.length) {
    const names = Array.from(checked).map(cb =>
      cb.closest('.suggest-item-row').querySelector('label').textContent);
    await Promise.all(names.map(name =>
      post(`/api/lists/${listId}/items`, { custom_name: name, quantity: 1, unit: 'יחידה' }).catch(() => {})));
    showToast(`${checked.length} פריטים נוספו לרשימה`, 'success');
  }

  openListDetail(listId, listName);
});

// Skip suggestion → close modal and go straight to list
document.getElementById('btn-skip-suggestions').addEventListener('click', () => {
  const el = document.getElementById('modal-suggest-items');
  closeModal('modal-suggest-items');
  openListDetail(parseInt(el.dataset.listId), el.dataset.listName);
});

// ═══════════════════════════════════════════════════════
//  LIST DETAIL VIEW
// ═══════════════════════════════════════════════════════
async function loadListDetail(listId) {
  const cont = document.getElementById('list-items-container');
  cont.innerHTML = '<div class="loading">טוען פריטים...</div>';

  // Always reset to build mode when opening a list
  state.listMode = 'build';
  state.currentListItems = [];
  document.getElementById('mode-tab-build').classList.add('active');
  document.getElementById('mode-tab-shop').classList.remove('active');
  document.querySelector('.add-item-bar').classList.remove('hidden');
  document.getElementById('btn-complete-list').classList.add('hidden');
  document.getElementById('list-progress-wrap').classList.add('hidden');
  document.getElementById('list-progress-text').textContent = '';
  document.getElementById('item-search-input').value = '';
  document.getElementById('item-search-results').classList.add('hidden');
  document.getElementById('item-search-results').innerHTML = '';

  try {
    const data = await get(`/api/lists/${listId}`);
    state.currentListItems = data.items || [];
    renderListItems(state.currentListItems);
  } catch (e) {
    cont.innerHTML = `<div class="loading">שגיאה בטעינה: ${esc(e.message)}</div>`;
  }
}

function setListMode(mode) {
  state.listMode = mode;
  document.getElementById('mode-tab-build').classList.toggle('active', mode === 'build');
  document.getElementById('mode-tab-shop').classList.toggle('active', mode === 'shop');
  document.querySelector('.add-item-bar').classList.toggle('hidden', mode === 'shop');
  document.getElementById('item-search-results').classList.add('hidden');
  document.getElementById('btn-complete-list').classList.toggle('hidden', mode === 'build');
  document.getElementById('list-progress-wrap').classList.toggle('hidden', mode === 'build');
  renderListItems(state.currentListItems);
}

function updateProgress(items) {
  const text = document.getElementById('list-progress-text');
  if (state.listMode === 'build') {
    text.textContent = `${items.length} פריטים`;
    return;
  }
  // Shop mode
  const found   = items.filter(i => i.checked === 1).length;
  const missing = items.filter(i => i.checked === 2).length;
  const pending = items.length - found - missing;
  const pct     = items.length ? Math.round((found / items.length) * 100) : 0;
  document.getElementById('list-progress-bar').style.width = `${pct}%`;
  text.innerHTML =
    `<span class="progress-found">✓ ${found}</span>&ensp;` +
    `<span class="progress-missing">✗ ${missing}</span>&ensp;` +
    `<span class="progress-pending">◯ ${pending} נותרו</span>`;
}

function renderListItems(items) {
  const cont = document.getElementById('list-items-container');
  updateProgress(items);

  if (!items.length) {
    const hint = state.listMode === 'build'
      ? '<p class="text-muted">חפש מוצר או הוסף בשם למעלה</p>'
      : '<p class="text-muted">אין פריטים ברשימה</p>';
    cont.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <p>הרשימה ריקה</p>
        ${hint}
      </div>`;
    return;
  }

  // Group by category
  const groups = {};
  items.forEach(item => {
    const key = item.category_name_he || item.category_name || 'ללא קטגוריה';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  cont.innerHTML = '';
  Object.entries(groups).forEach(([catName, catItems]) => {
    const group = document.createElement('div');
    group.className = 'category-group';
    group.innerHTML = `<div class="category-group-title">${esc(catName)}</div>`;
    catItems.forEach(item => {
      group.appendChild(state.listMode === 'shop'
        ? buildItemRowShop(item)
        : buildItemRowBuild(item));
    });
    cont.appendChild(group);
  });
}

// ─── Build mode row: name + qty + delete ─────────────
function buildItemRowBuild(item) {
  const row = document.createElement('div');
  row.className = 'list-item-row';
  row.dataset.itemId = item.id;
  const displayName = item.product_name_he || item.product_name || item.custom_name || 'פריט';
  const qtyLabel = `${item.quantity ?? 1} ${item.unit || ''}`.trim();
  const imgHtml = item.image_path
    ? `<img src="${esc(item.image_path)}" class="item-thumb" alt="" loading="lazy" />`
    : `<span class="item-thumb-placeholder">📦</span>`;
  row.innerHTML = `
    ${imgHtml}
    <div class="item-body">
      <div class="item-name">${esc(displayName)}</div>
      <div class="item-qty">${esc(qtyLabel)}</div>
    </div>
    <button class="item-delete-btn" aria-label="מחק פריט">✕</button>`;
  row.querySelector('.item-delete-btn').addEventListener('click', () => deleteItem(item, row));
  return row;
}

// ─── Shop mode row: ✓ found | name + qty | ✗ not found ─
function buildItemRowShop(item) {
  const stateClass = item.checked === 1 ? 'item-found' : item.checked === 2 ? 'item-not-found' : '';
  const row = document.createElement('div');
  row.className = `list-item-row${stateClass ? ' ' + stateClass : ''}`;
  row.dataset.itemId = item.id;
  const displayName = item.product_name_he || item.product_name || item.custom_name || 'פריט';
  const qtyLabel = `${item.quantity ?? 1} ${item.unit || ''}`.trim();
  const imgHtml = item.image_path
    ? `<img src="${esc(item.image_path)}" class="item-thumb" alt="" loading="lazy" />`
    : `<span class="item-thumb-placeholder">📦</span>`;
  row.innerHTML = `
    <button class="item-btn-found${item.checked === 1 ? ' active' : ''}" aria-label="נמצא">✓</button>
    ${imgHtml}
    <div class="item-body">
      <div class="item-name">${esc(displayName)}</div>
      <div class="item-qty">${esc(qtyLabel)}</div>
    </div>
    <button class="item-btn-notfound${item.checked === 2 ? ' active' : ''}" aria-label="לא נמצא">לא נמצא</button>`;
  row.querySelector('.item-btn-found').addEventListener('click', () =>
    setItemShopState(item, row, item.checked === 1 ? 0 : 1));
  row.querySelector('.item-btn-notfound').addEventListener('click', () =>
    setItemShopState(item, row, item.checked === 2 ? 0 : 2));
  return row;
}

async function setItemShopState(item, row, newChecked) {
  const prev = item.checked;
  item.checked = newChecked;
  const cls = newChecked === 1 ? 'item-found' : newChecked === 2 ? 'item-not-found' : '';
  row.className = `list-item-row${cls ? ' ' + cls : ''}`;
  row.querySelector('.item-btn-found').classList.toggle('active', newChecked === 1);
  row.querySelector('.item-btn-notfound').classList.toggle('active', newChecked === 2);
  updateProgress(state.currentListItems);
  try {
    await put(`/api/lists/${state.currentListId}/items/${item.id}`, { checked: newChecked });
  } catch (e) {
    // Revert
    item.checked = prev;
    const pc = prev === 1 ? 'item-found' : prev === 2 ? 'item-not-found' : '';
    row.className = `list-item-row${pc ? ' ' + pc : ''}`;
    row.querySelector('.item-btn-found').classList.toggle('active', prev === 1);
    row.querySelector('.item-btn-notfound').classList.toggle('active', prev === 2);
    updateProgress(state.currentListItems);
    showToast('שגיאה בעדכון פריט', 'error');
  }
}

async function deleteItem(item, row) {
  try {
    await del(`/api/lists/${state.currentListId}/items/${item.id}`);
    state.currentListItems = state.currentListItems.filter(i => i.id !== item.id);
    row.remove();
    updateProgress(state.currentListItems);
    showToast('הפריט הוסר', 'success');
  } catch (e) {
    showToast(`שגיאה: ${e.message}`, 'error');
  }
}

// ─── Add Item (search) ───────────────────────────────
let searchTimeout;
document.getElementById('item-search-input').addEventListener('input', e => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  const dropdown = document.getElementById('item-search-results');
  if (!q) { dropdown.classList.add('hidden'); dropdown.innerHTML = ''; return; }
  searchTimeout = setTimeout(() => searchCatalogForItem(q), 300);
});

async function searchCatalogForItem(q) {
  const dropdown = document.getElementById('item-search-results');
  try {
    const results = await get(`/api/catalog?search=${encodeURIComponent(q)}`);
    dropdown.innerHTML = '';
    if (!results.length) {
      dropdown.classList.add('hidden');
      return;
    }
    results.slice(0, 8).forEach(p => {
      const item = document.createElement('div');
      item.className = 'search-dropdown-item';
      item.innerHTML = `<span class="item-icon">📦</span><span>${esc(productLabel(p))}</span>`;
      item.addEventListener('click', () => {
        dropdown.classList.add('hidden');
        document.getElementById('item-search-input').value = '';
        openAddItemModal(p);
      });
      dropdown.appendChild(item);
    });
    dropdown.classList.remove('hidden');
  } catch { /* silently ignore */ }
}

function openAddItemModal(product) {
  state.addItemPendingProduct = product;
  document.getElementById('add-item-product-id').value  = product.id;
  document.getElementById('add-item-product-name').textContent = productLabel(product);
  document.getElementById('add-item-qty').value  = product.default_quantity ?? 1;
  document.getElementById('add-item-unit').value = product.default_unit || 'יחידה';
  openModal('modal-add-item');
}

document.getElementById('btn-confirm-add-item').addEventListener('click', async () => {
  const productId = document.getElementById('add-item-product-id').value;
  const qty  = parseFloat(document.getElementById('add-item-qty').value)  || 1;
  const unit = document.getElementById('add-item-unit').value.trim() || 'יחידה';
  try {
    const newItem = await post(`/api/lists/${state.currentListId}/items`,
      { product_id: parseInt(productId), quantity: qty, unit });
    closeModal('modal-add-item');
    showToast('הפריט נוסף', 'success');
    loadListDetail(state.currentListId); // Reload to group properly
  } catch (e) {
    showToast(`שגיאה: ${e.message}`, 'error');
  }
});

// ─── Add Custom Item ──────────────────────────────────
document.getElementById('btn-add-custom-item').addEventListener('click', addCustomItem);
document.getElementById('item-search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const dropdown = document.getElementById('item-search-results');
    const first = dropdown.querySelector('.search-dropdown-item');
    if (first && !dropdown.classList.contains('hidden')) {
      first.click();
    } else {
      addCustomItem();
    }
  }
});

async function addCustomItem() {
  const input = document.getElementById('item-search-input');
  const name  = input.value.trim();
  if (!name) { showToast('נא להזין שם פריט', 'error'); return; }
  // Close dropdown, open product modal pre-filled so item is saved to catalog too
  input.value = '';
  document.getElementById('item-search-results').classList.add('hidden');
  state.addToListAfterSave = true;
  await openProductModal(null, name);
}

// ─── Complete List ────────────────────────────────────
document.getElementById('btn-complete-list').addEventListener('click', () => {
  showConfirm('לארכב את הרשימה?', async () => {
    try {
      await post(`/api/lists/${state.currentListId}/complete`, {});
      showToast('הקנייה הושלמה ונשמרה בהיסטוריה!', 'success');
      navigate('lists');
    } catch (e) {
      showToast(`שגיאה: ${e.message}`, 'error');
    }
  }, { title: 'אישור ארכוב', confirmLabel: 'ארכב', confirmClass: 'btn-success' });
});

// ─── Back button ──────────────────────────────────────
document.getElementById('btn-back').addEventListener('click', () => {
  navigate('lists');
});

// ═══════════════════════════════════════════════════════
//  CATALOG VIEW
// ═══════════════════════════════════════════════════════
async function loadCatalog() {
  const cont = document.getElementById('catalog-container');
  cont.innerHTML = '<div class="loading">טוען...</div>';

  // Load category chips if not already loaded
  await loadCategoryChips();

  try {
    const params = new URLSearchParams();
    if (state.catalogFilter.search)     params.set('search', state.catalogFilter.search);
    if (state.catalogFilter.categoryId) params.set('category_id', state.catalogFilter.categoryId);
    const products = await get(`/api/catalog?${params}`);

    if (!products.length) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <p>אין מוצרים</p>
          <p class="text-muted">לחץ + כדי להוסיף מוצר חדש</p>
        </div>`;
      return;
    }
    cont.innerHTML = '';
    products.forEach(p => cont.appendChild(buildProductCard(p)));
  } catch (e) {
    cont.innerHTML = `<div class="loading">שגיאה בטעינה: ${esc(e.message)}</div>`;
  }
}

async function loadCategoryChips() {
  if (state.categories.length) return; // Already loaded
  try {
    state.categories = await get('/api/categories');
  } catch { state.categories = []; }

  const chipsEl = document.getElementById('category-chips');
  chipsEl.innerHTML = '';
  const all = document.createElement('button');
  all.className = `chip${!state.catalogFilter.categoryId ? ' active' : ''}`;
  all.textContent = 'הכל';
  all.addEventListener('click', () => {
    state.catalogFilter.categoryId = null;
    updateChips(null);
    loadCatalog();
  });
  chipsEl.appendChild(all);

  state.categories.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = `chip${state.catalogFilter.categoryId === cat.id ? ' active' : ''}`;
    chip.textContent = cat.name_he || cat.name;
    chip.dataset.catId = cat.id;
    chip.addEventListener('click', () => {
      state.catalogFilter.categoryId = cat.id;
      updateChips(cat.id);
      loadCatalog();
    });
    chipsEl.appendChild(chip);
  });
}

function updateChips(activeCatId) {
  document.querySelectorAll('#category-chips .chip').forEach(chip => {
    const id = chip.dataset.catId ? parseInt(chip.dataset.catId) : null;
    chip.classList.toggle('active', id === activeCatId);
  });
}

function buildProductCard(p) {
  const card = document.createElement('div');
  card.className = 'product-card';
  const imgSrc = p.image_path ? p.image_path : null;
  card.innerHTML = `
    <div class="product-card-img">
      ${imgSrc ? `<img src="${esc(imgSrc)}" alt="${esc(productLabel(p))}" loading="lazy" />` : '📦'}
    </div>
    <div class="product-card-body">
      <div class="product-card-name">${esc(productLabel(p))}</div>
      <div class="product-card-sub">${esc(p.category_name_he || p.category_name || '')}</div>
    </div>
    <div class="product-card-actions">
      <button class="btn-edit" data-id="${p.id}" aria-label="ערוך">✏️</button>
      <button class="btn-del"  data-id="${p.id}" aria-label="מחק">🗑️</button>
    </div>`;
  card.querySelector('.btn-edit').addEventListener('click', () => openProductModal(p));
  card.querySelector('.btn-del').addEventListener('click', () => {
    showConfirm(`למחוק את "${productLabel(p)}"?`, async () => {
      try {
        await del(`/api/catalog/${p.id}`);
        card.remove();
        showToast('המוצר נמחק', 'success');
      } catch (e) {
        showToast(`שגיאה: ${e.message}`, 'error');
      }
    });
  });
  return card;
}

// ─── Catalog Search ───────────────────────────────────
let catalogSearchTimer;
document.getElementById('catalog-search').addEventListener('input', e => {
  clearTimeout(catalogSearchTimer);
  state.catalogFilter.search = e.target.value.trim();
  catalogSearchTimer = setTimeout(loadCatalog, 350);
});

// ─── Product Modal ────────────────────────────────────
document.getElementById('fab-new-product').addEventListener('click', () => {
  state.addToListAfterSave = false;
  openProductModal(null);
});

async function openProductModal(product, prefillName = '') {
  // Ensure categories are loaded in the select
  await ensureCategoriesLoaded();
  const sel = document.getElementById('product-category');
  sel.innerHTML = '<option value="">-- בחר קטגוריה --</option>';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name_he || cat.name;
    sel.appendChild(opt);
  });

  const isEdit = !!product;
  let title = isEdit ? 'עריכת מוצר' : 'מוצר חדש';
  if (!isEdit && state.addToListAfterSave) title = 'הוסף מוצר חדש לקטלוג ולרשימה';
  document.getElementById('modal-product-title').textContent = title;
  document.getElementById('product-edit-id').value   = isEdit ? product.id : '';
  document.getElementById('product-name-he').value   = isEdit ? (product.name_he || '') : prefillName;
  document.getElementById('product-name-en').value   = isEdit ? (product.name || '') : '';
  document.getElementById('product-qty').value        = isEdit ? (product.default_quantity ?? 1) : 1;
  document.getElementById('product-unit').value       = isEdit ? (product.default_unit || 'יחידה') : 'יחידה';
  document.getElementById('product-image').value      = '';
  document.getElementById('product-camera').value     = '';
  pastedImageFile = null;
  sel.value = isEdit ? (product.category_id || '') : '';

  const preview = document.getElementById('product-image-preview');
  if (isEdit && product.image_path) {
    preview.style.backgroundImage = `url('${esc(product.image_path)}')`;
    preview.style.backgroundSize = 'cover';
    preview.classList.remove('hidden');
  } else {
    preview.classList.add('hidden');
  }

  openModal('modal-product');
}

async function ensureCategoriesLoaded() {
  if (!state.categories.length) {
    try { state.categories = await get('/api/categories'); } catch { state.categories = []; }
  }
}

// ─── Clipboard paste image ────────────────────────────
let pastedImageFile = null;

document.addEventListener('paste', e => {
  if (document.getElementById('modal-product').classList.contains('hidden')) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (!file) continue;
      pastedImageFile = file;
      showImagePreview(file);
      showToast('תמונה הודבקה מהלוח', 'success');
      e.preventDefault();
      break;
    }
  }
});

function showImagePreview(file) {
  const preview = document.getElementById('product-image-preview');
  const reader = new FileReader();
  reader.onload = ev => {
    preview.style.backgroundImage = `url('${ev.target.result}')`;
    preview.style.backgroundSize = 'cover';
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

// Image preview
document.getElementById('product-image').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  pastedImageFile = null;
  showImagePreview(file);
});

// Camera button — opens camera directly on iPhone
document.getElementById('btn-camera').addEventListener('click', () => {
  document.getElementById('product-camera').click();
});
document.getElementById('product-camera').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  pastedImageFile = null;
  showImagePreview(file);
});

document.getElementById('btn-save-product').addEventListener('click', async () => {
  const id       = document.getElementById('product-edit-id').value;
  const nameHe   = document.getElementById('product-name-he').value.trim();
  const nameEn   = document.getElementById('product-name-en').value.trim();
  const catId    = document.getElementById('product-category').value;
  const qty      = parseFloat(document.getElementById('product-qty').value) || 1;
  const unit     = document.getElementById('product-unit').value.trim() || 'יחידה';
  const imageFile = pastedImageFile ||
    document.getElementById('product-image').files[0] ||
    document.getElementById('product-camera').files[0];

  if (!nameHe && !nameEn) {
    showToast('נא להזין שם מוצר', 'error');
    return;
  }

  const body = {
    name_he: nameHe || undefined,
    name: nameEn || undefined,
    category_id: catId ? parseInt(catId) : undefined,
    default_quantity: qty,
    default_unit: unit,
  };

  try {
    let saved;
    if (id) {
      saved = await put(`/api/catalog/${id}`, body);
    } else {
      saved = await post('/api/catalog', body);
    }

    // Upload image if provided
    if (imageFile) {
      const fd = new FormData();
      fd.append('image', imageFile);
      await api('POST', `/api/catalog/${saved.id}/image`, fd);
    }
    pastedImageFile = null;

    closeModal('modal-product');

    // If opened from list search — add the new product to the current list
    if (state.addToListAfterSave && state.currentListId) {
      state.addToListAfterSave = false;
      await post(`/api/lists/${state.currentListId}/items`, {
        product_id: saved.id,
        quantity: qty,
        unit,
      });
      showToast('המוצר נוסף לקטלוג ולרשימה', 'success');
      loadListDetail(state.currentListId);
    } else {
      state.addToListAfterSave = false;
      showToast(id ? 'המוצר עודכן' : 'המוצר נוסף לקטלוג', 'success');
      state.categories = []; // Force chips reload
      loadCatalog();
    }
  } catch (e) {
    showToast(`שגיאה: ${e.message}`, 'error');
  }
});

// ═══════════════════════════════════════════════════════
//  CATEGORIES VIEW
// ═══════════════════════════════════════════════════════
async function loadCategories() {
  const cont = document.getElementById('categories-container');
  cont.innerHTML = '<div class="loading">טוען...</div>';
  try {
    state.categories = await get('/api/categories');
    renderCategories();
  } catch (e) {
    cont.innerHTML = `<div class="loading">שגיאה: ${esc(e.message)}</div>`;
  }
}

function renderCategories() {
  const cont = document.getElementById('categories-container');
  cont.innerHTML = '';
  if (!state.categories.length) {
    cont.innerHTML = '<div class="loading">אין קטגוריות</div>';
    return;
  }
  state.categories.forEach(cat => cont.appendChild(buildCategoryRow(cat)));
}

function buildCategoryRow(cat) {
  const row = document.createElement('div');
  row.className = 'list-row';
  row.dataset.id = cat.id;
  row.innerHTML = `
    <div class="list-row-name">${esc(cat.name_he || cat.name)}</div>
    <div class="list-row-actions">
      <button class="btn-edit" aria-label="ערוך">✏️</button>
      <button class="btn-del"  aria-label="מחק">🗑️</button>
    </div>`;

  row.querySelector('.btn-edit').addEventListener('click', () => openEditCategoryModal(cat));
  row.querySelector('.btn-del').addEventListener('click', () => {
    showConfirm(`למחוק את הקטגוריה "${cat.name_he || cat.name}"?`, async () => {
      try {
        await del(`/api/categories/${cat.id}`);
        state.categories = state.categories.filter(c => c.id !== cat.id);
        renderCategories();
        showToast('הקטגוריה נמחקה', 'success');
      } catch (e) {
        showToast(`שגיאה: ${e.message}`, 'error');
      }
    });
  });
  return row;
}

// ─── Add Category ─────────────────────────────────────
document.getElementById('btn-add-category').addEventListener('click', addCategory);
document.getElementById('new-category-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addCategory();
});

async function addCategory() {
  const input = document.getElementById('new-category-input');
  const name  = input.value.trim();
  if (!name) { showToast('נא להזין שם קטגוריה', 'error'); return; }
  try {
    const cat = await post('/api/categories', { name_he: name, name });
    state.categories.push(cat);
    renderCategories();
    input.value = '';
    showToast('הקטגוריה נוספה', 'success');
  } catch (e) {
    showToast(`שגיאה: ${e.message}`, 'error');
  }
}

// ─── Edit Category Modal ──────────────────────────────
function openEditCategoryModal(cat) {
  document.getElementById('edit-category-id').value   = cat.id;
  document.getElementById('edit-category-name').value = cat.name_he || cat.name;
  openModal('modal-edit-category');
  setTimeout(() => document.getElementById('edit-category-name').focus(), 100);
}

document.getElementById('btn-save-category').addEventListener('click', async () => {
  const id   = document.getElementById('edit-category-id').value;
  const name = document.getElementById('edit-category-name').value.trim();
  if (!name) { showToast('נא להזין שם קטגוריה', 'error'); return; }
  try {
    const updated = await put(`/api/categories/${id}`, { name_he: name, name });
    state.categories = state.categories.map(c => c.id === parseInt(id) ? updated : c);
    renderCategories();
    closeModal('modal-edit-category');
    showToast('הקטגוריה עודכנה', 'success');
  } catch (e) {
    showToast(`שגיאה: ${e.message}`, 'error');
  }
});

document.getElementById('edit-category-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-save-category').click();
});

// ═══════════════════════════════════════════════════════
//  HISTORY VIEW
// ═══════════════════════════════════════════════════════
async function loadHistory() {
  const cont = document.getElementById('history-container');
  cont.innerHTML = '<div class="loading">טוען...</div>';
  try {
    const records = await get('/api/history');
    if (!records.length) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <p>אין היסטוריית קניות</p>
          <p class="text-muted">קניות שהושלמו יופיעו כאן</p>
        </div>`;
      return;
    }
    cont.innerHTML = '';
    records.forEach(rec => cont.appendChild(buildHistoryCard(rec)));
  } catch (e) {
    cont.innerHTML = `<div class="loading">שגיאה: ${esc(e.message)}</div>`;
  }
}

function buildHistoryCard(rec) {
  const card = document.createElement('div');
  card.className = 'history-card';
  card.dataset.id = rec.id;
  card.innerHTML = `
    <div class="history-card-header">
      <div>
        <div class="history-card-title">${esc(rec.list_name)}</div>
        <div class="history-card-meta">${fmtDate(rec.completed_at)} · ${rec.item_count} פריטים</div>
      </div>
      <span class="history-chevron">▼</span>
    </div>
    <div class="history-items-list">
      <div class="loading" style="padding:16px 0">טוען פריטים...</div>
    </div>`;

  const header = card.querySelector('.history-card-header');
  const itemsList = card.querySelector('.history-items-list');

  header.addEventListener('click', async () => {
    const isExpanded = card.classList.contains('expanded');
    if (isExpanded) {
      card.classList.remove('expanded');
      return;
    }
    card.classList.add('expanded');
    // Load items lazily
    if (itemsList.dataset.loaded) return;
    try {
      const detail = await get(`/api/history/${rec.id}`);
      itemsList.dataset.loaded = 'true';
      itemsList.innerHTML = '';
      if (detail.items && detail.items.length) {
        detail.items.forEach(item => {
          const row = document.createElement('div');
          row.className = 'history-item-row';
          row.innerHTML = `
            <span>${esc(item.product_name || 'פריט')}</span>
            <span class="text-muted">${item.quantity ?? 1} ${esc(item.unit || '')}</span>`;
          itemsList.appendChild(row);
        });
      } else {
        itemsList.innerHTML = '<p class="text-muted" style="padding:8px 0">אין פריטים</p>';
      }
      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-del history-delete-btn';
      delBtn.textContent = 'מחק מהיסטוריה';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        showConfirm('למחוק רשומה זו מההיסטוריה?', async () => {
          try {
            await del(`/api/history/${rec.id}`);
            card.remove();
            showToast('הרשומה נמחקה', 'success');
          } catch (er) {
            showToast(`שגיאה: ${er.message}`, 'error');
          }
        });
      });
      itemsList.appendChild(delBtn);
    } catch (e) {
      itemsList.innerHTML = `<p class="text-muted">שגיאה: ${esc(e.message)}</p>`;
    }
  });

  return card;
}

// ─── History by item ──────────────────────────────────
async function loadHistoryByItem() {
  const cont = document.getElementById('history-container');
  cont.innerHTML = '<div class="loading">טוען...</div>';
  try {
    const items = await get('/api/history/items');
    if (!items.length) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <p>אין פריטים בהיסטוריה</p>
        </div>`;
      return;
    }
    // Group by product name
    const groups = {};
    items.forEach(item => {
      const key = item.product_name || 'לא ידוע';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    cont.innerHTML = '';
    Object.entries(groups).sort(([a],[b]) => a.localeCompare(b, 'he')).forEach(([name, entries]) => {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <div class="history-card-header">
          <div>
            <div class="history-card-title">${esc(name)}</div>
            <div class="history-card-meta">${entries.length} פעמים</div>
          </div>
          <span class="history-chevron">▼</span>
        </div>
        <div class="history-items-list">
          ${entries.map(e => `
            <div class="history-item-row">
              <span>${esc(e.list_name)}</span>
              <span class="text-muted">${fmtDate(e.completed_at)} · ${e.quantity ?? 1} ${esc(e.unit || '')}</span>
            </div>`).join('')}
        </div>`;
      card.querySelector('.history-card-header').addEventListener('click', () => {
        card.classList.toggle('expanded');
      });
      cont.appendChild(card);
    });
  } catch (e) {
    cont.innerHTML = `<div class="loading">שגיאה: ${esc(e.message)}</div>`;
  }
}

document.getElementById('history-tab-lists').addEventListener('click', () => {
  document.getElementById('history-tab-lists').classList.add('active');
  document.getElementById('history-tab-items').classList.remove('active');
  loadHistory();
});
document.getElementById('history-tab-items').addEventListener('click', () => {
  document.getElementById('history-tab-items').classList.add('active');
  document.getElementById('history-tab-lists').classList.remove('active');
  loadHistoryByItem();
});

// ═══════════════════════════════════════════════════════
//  CONFIRM MODAL
// ═══════════════════════════════════════════════════════
function showConfirm(message, onConfirm, opts = {}) {
  document.getElementById('modal-confirm-title').textContent   = opts.title   || 'אישור מחיקה';
  document.getElementById('modal-confirm-message').textContent = message;
  const btn = document.getElementById('btn-confirm-delete');
  btn.textContent = opts.confirmLabel || 'מחק';
  btn.className   = opts.confirmClass || 'btn-danger';
  state.confirmCallback = onConfirm;
  openModal('modal-confirm');
}

document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
  closeModal('modal-confirm');
  if (state.confirmCallback) {
    await state.confirmCallback();
    state.confirmCallback = null;
  }
});

// ═══════════════════════════════════════════════════════
//  GLOBAL EVENT WIRING
// ═══════════════════════════════════════════════════════

// Bottom nav tabs
document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.view));
});

// List detail mode tabs
document.getElementById('mode-tab-build').addEventListener('click', () => setListMode('build'));
document.getElementById('mode-tab-shop').addEventListener('click',  () => setListMode('shop'));

// Modal close buttons
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.modal === 'modal-product') { state.addToListAfterSave = false; pastedImageFile = null; }
    closeModal(btn.dataset.modal);
  });
});

// Close modal by clicking overlay backdrop
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});

// Close search dropdown on outside click
document.addEventListener('click', e => {
  const dropdown = document.getElementById('item-search-results');
  const bar = document.getElementById('item-search-input');
  if (!dropdown.contains(e.target) && e.target !== bar) {
    dropdown.classList.add('hidden');
  }
});

// ─── Utility: HTML escape ─────────────────────────────
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Boot ─────────────────────────────────────────────
document.getElementById('app-version').textContent = APP_VERSION;
navigate('lists');
