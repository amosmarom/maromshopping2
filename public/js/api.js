const API = {
  async request(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  },

  // Categories
  getCategories() { return this.request('/api/categories'); },
  createCategory(data) { return this.request('/api/categories', { method: 'POST', body: data }); },

  // Catalog
  getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/catalog${query ? '?' + query : ''}`);
  },
  getProduct(id) { return this.request(`/api/catalog/${id}`); },
  createProduct(data) { return this.request('/api/catalog', { method: 'POST', body: data }); },
  updateProduct(id, data) { return this.request(`/api/catalog/${id}`, { method: 'PUT', body: data }); },
  deleteProduct(id) { return this.request(`/api/catalog/${id}`, { method: 'DELETE' }); },
  async uploadProductImage(id, file) {
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(`/api/catalog/${id}/image`, { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },

  // Shopping Lists
  getLists() { return this.request('/api/lists'); },
  getList(id) { return this.request(`/api/lists/${id}`); },
  createList(data) { return this.request('/api/lists', { method: 'POST', body: data }); },
  updateList(id, data) { return this.request(`/api/lists/${id}`, { method: 'PUT', body: data }); },
  deleteList(id) { return this.request(`/api/lists/${id}`, { method: 'DELETE' }); },
  addListItem(listId, data) { return this.request(`/api/lists/${listId}/items`, { method: 'POST', body: data }); },
  updateListItem(listId, itemId, data) { return this.request(`/api/lists/${listId}/items/${itemId}`, { method: 'PUT', body: data }); },
  deleteListItem(listId, itemId) { return this.request(`/api/lists/${listId}/items/${itemId}`, { method: 'DELETE' }); },
  completeList(id) { return this.request(`/api/lists/${id}/complete`, { method: 'POST' }); },

  // History
  getHistory() { return this.request('/api/history'); },
  getHistoryDetail(id) { return this.request(`/api/history/${id}`); },
  deleteHistory(id) { return this.request(`/api/history/${id}`, { method: 'DELETE' }); },
};
