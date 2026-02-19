const ShoppingLists = {
  emits: ['show-toast', 'open-catalog-picker'],
  data() {
    return {
      lists: [],
      activeList: null,
      showNewListDialog: false,
      newListName: '',
      showAddItem: false,
      addItemMode: 'catalog', // 'catalog' or 'custom'
      customItemName: '',
      customItemQty: 1,
      customItemUnit: 'יחידה',
      catalogProducts: [],
      catalogSearch: '',
      categories: [],
      loading: true,
      units: ['יחידה', 'ק"ג', 'גרם', 'ליטר', 'מ"ל', 'חבילה', 'קופסה', 'שקית'],
      // Catalog item confirmation step
      selectedProduct: null,
      selectedProductQty: 1,
      selectedProductUnit: 'יחידה',
      selectedProductNotes: '',
    };
  },
  computed: {
    filteredCatalogProducts() {
      if (!this.catalogSearch) return this.catalogProducts;
      const q = this.catalogSearch.toLowerCase();
      return this.catalogProducts.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.name_he && p.name_he.includes(q))
      );
    },
    groupedItems() {
      if (!this.activeList?.items) return {};
      const groups = {};
      for (const item of this.activeList.items) {
        const cat = item.category_name_he || item.category_name || 'כללי';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
      }
      return groups;
    },
    progress() {
      if (!this.activeList?.items?.length) return 0;
      const checked = this.activeList.items.filter(i => i.checked).length;
      return Math.round((checked / this.activeList.items.length) * 100);
    },
  },
  async created() {
    await this.loadLists();
  },
  methods: {
    async loadLists() {
      this.loading = true;
      try {
        this.lists = await API.getLists();
      } catch (e) {
        this.$emit('show-toast', 'שגיאה בטעינת הרשימות');
      }
      this.loading = false;
    },
    async openList(list) {
      try {
        this.activeList = await API.getList(list.id);
      } catch (e) {
        this.$emit('show-toast', 'שגיאה בטעינת הרשימה');
      }
    },
    async createList() {
      if (!this.newListName.trim()) return;
      try {
        const list = await API.createList({ name: this.newListName.trim() });
        this.newListName = '';
        this.showNewListDialog = false;
        this.$emit('show-toast', 'הרשימה נוצרה');
        await this.loadLists();
        await this.openList(list);
      } catch (e) {
        this.$emit('show-toast', 'שגיאה ביצירת הרשימה');
      }
    },
    async deleteList(list) {
      if (!confirm('למחוק את הרשימה "' + list.name + '"?')) return;
      try {
        await API.deleteList(list.id);
        if (this.activeList?.id === list.id) this.activeList = null;
        this.$emit('show-toast', 'הרשימה נמחקה');
        await this.loadLists();
      } catch (e) {
        this.$emit('show-toast', 'שגיאה במחיקת הרשימה');
      }
    },
    async openAddItem() {
      this.showAddItem = true;
      this.addItemMode = 'catalog';
      this.catalogSearch = '';
      this.selectedProduct = null;
      try {
        const [products, categories] = await Promise.all([
          API.getProducts(),
          API.getCategories(),
        ]);
        this.catalogProducts = products;
        this.categories = categories;
      } catch (e) {
        this.$emit('show-toast', 'שגיאה בטעינת הקטלוג');
      }
    },
    selectFromCatalog(product) {
      this.selectedProduct = product;
      this.selectedProductQty = product.default_quantity || 1;
      this.selectedProductUnit = product.default_unit || 'יחידה';
      this.selectedProductNotes = '';
    },
    cancelSelectProduct() {
      this.selectedProduct = null;
    },
    async confirmAddFromCatalog() {
      if (!this.selectedProduct) return;
      try {
        await API.addListItem(this.activeList.id, {
          product_id: this.selectedProduct.id,
          quantity: this.selectedProductQty,
          unit: this.selectedProductUnit,
          notes: this.selectedProductNotes || undefined,
        });
        this.$emit('show-toast', '"' + (this.selectedProduct.name_he || this.selectedProduct.name) + '" נוסף');
        this.selectedProduct = null;
        this.activeList = await API.getList(this.activeList.id);
      } catch (e) {
        this.$emit('show-toast', 'שגיאה בהוספת המוצר');
      }
    },
    async addCustomItem() {
      if (!this.customItemName.trim()) return;
      try {
        await API.addListItem(this.activeList.id, {
          custom_name: this.customItemName.trim(),
          quantity: this.customItemQty,
          unit: this.customItemUnit,
        });
        this.$emit('show-toast', 'הפריט נוסף');
        this.customItemName = '';
        this.customItemQty = 1;
        this.activeList = await API.getList(this.activeList.id);
      } catch (e) {
        this.$emit('show-toast', 'שגיאה בהוספת הפריט');
      }
    },
    async toggleItem(item) {
      try {
        await API.updateListItem(this.activeList.id, item.id, { checked: !item.checked });
        item.checked = !item.checked;
      } catch (e) {
        this.$emit('show-toast', 'שגיאה בעדכון הפריט');
      }
    },
    isUnitBased(unit) {
      return ['יחידה', 'חבילה', 'קופסה', 'שקית'].includes(unit);
    },
    async updateQuantity(item, delta) {
      const step = this.isUnitBased(item.unit) ? 1 : 0.5;
      const min = this.isUnitBased(item.unit) ? 1 : 0.5;
      const newQty = Math.max(min, item.quantity + (delta > 0 ? step : -step));
      try {
        await API.updateListItem(this.activeList.id, item.id, { quantity: newQty });
        item.quantity = newQty;
      } catch (e) {
        this.$emit('show-toast', 'שגיאה בעדכון הכמות');
      }
    },
    async removeItem(item) {
      try {
        await API.deleteListItem(this.activeList.id, item.id);
        this.activeList.items = this.activeList.items.filter(i => i.id !== item.id);
        this.$emit('show-toast', 'הפריט הוסר');
      } catch (e) {
        this.$emit('show-toast', 'שגיאה בהסרת הפריט');
      }
    },
    async completeList() {
      if (!confirm('לסיים את הקנייה ולשמור בהיסטוריה?')) return;
      try {
        await API.completeList(this.activeList.id);
        this.activeList = null;
        this.$emit('show-toast', 'הקנייה הושלמה ונשמרה בהיסטוריה');
        await this.loadLists();
      } catch (e) {
        this.$emit('show-toast', 'שגיאה בסיום הקנייה');
      }
    },
    itemDisplayName(item) {
      return item.product_name_he || item.product_name || item.custom_name || 'פריט';
    },
  },
  template: `
    <div>
      <!-- Lists overview (no active list) -->
      <div v-if="!activeList">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold">רשימות קניות</h2>
          <button @click="showNewListDialog = true"
                  class="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">
            + רשימה חדשה
          </button>
        </div>

        <div v-if="loading" class="spinner"></div>

        <div v-else-if="lists.length === 0" class="empty-state">
          <p class="text-4xl mb-3">📝</p>
          <p class="text-lg font-medium">אין רשימות פעילות</p>
          <p class="text-sm mt-1">צרו רשימה חדשה כדי להתחיל</p>
          <button @click="showNewListDialog = true" class="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg">
            + צור רשימה ראשונה
          </button>
        </div>

        <div v-else class="space-y-3">
          <div v-for="list in lists" :key="list.id"
               @click="openList(list)"
               class="bg-white rounded-xl p-4 shadow-sm border cursor-pointer hover:shadow-md transition-shadow">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-lg">{{ list.name }}</h3>
                <p class="text-sm text-gray-500">
                  {{ list.item_count || 0 }} פריטים
                  <span v-if="list.checked_count"> · {{ list.checked_count }} סומנו</span>
                </p>
              </div>
              <div class="flex items-center gap-2">
                <div v-if="list.item_count > 0" class="w-12 h-12 rounded-full border-4 flex items-center justify-center text-xs font-bold"
                     :class="list.checked_count === list.item_count ? 'border-green-500 text-green-600' : 'border-blue-300 text-blue-600'"
                     :style="{ borderColor: list.checked_count === list.item_count ? '#22c55e' : '#93c5fd' }">
                  {{ list.item_count > 0 ? Math.round((list.checked_count / list.item_count) * 100) : 0 }}%
                </div>
                <button @click.stop="deleteList(list)" class="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- New list dialog -->
        <div v-if="showNewListDialog" class="modal-overlay" @click.self="showNewListDialog = false">
          <div class="modal-content">
            <h3 class="text-lg font-bold mb-4">רשימה חדשה</h3>
            <input v-model="newListName" type="text" placeholder="שם הרשימה..." autofocus
                   @keyup.enter="createList"
                   class="w-full border rounded-lg px-3 py-2 mb-4 focus:ring-2 focus:ring-blue-500 outline-none">
            <div class="flex gap-3">
              <button @click="createList" :disabled="!newListName.trim()"
                      class="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                צור רשימה
              </button>
              <button @click="showNewListDialog = false" class="px-6 py-2.5 border rounded-lg hover:bg-gray-50">
                ביטול
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Active list view -->
      <div v-else>
        <!-- Header -->
        <div class="flex items-center gap-3 mb-4">
          <button @click="activeList = null; loadLists()" class="p-2 hover:bg-gray-200 rounded-lg">
            ← חזרה
          </button>
          <h2 class="text-xl font-bold flex-1">{{ activeList.name }}</h2>
          <button @click="completeList" v-if="activeList.items?.length"
                  class="bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
            ✓ סיום קנייה
          </button>
        </div>

        <!-- Progress bar -->
        <div v-if="activeList.items?.length" class="mb-4">
          <div class="flex justify-between text-sm text-gray-600 mb-1">
            <span>{{ activeList.items.filter(i => i.checked).length }}/{{ activeList.items.length }} פריטים</span>
            <span>{{ progress }}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-green-500 h-2 rounded-full transition-all" :style="{ width: progress + '%' }"></div>
          </div>
        </div>

        <!-- Items grouped by category -->
        <div v-if="activeList.items?.length" class="space-y-4 mb-20">
          <div v-for="(items, category) in groupedItems" :key="category">
            <h3 class="category-header text-sm font-bold text-gray-500 uppercase bg-gray-100 px-2 py-1.5 rounded mb-2">
              {{ category }}
            </h3>
            <div class="space-y-1">
              <div v-for="item in items" :key="item.id"
                   :class="['bg-white rounded-xl p-3 shadow-sm border flex items-center gap-3', item.checked ? 'item-checked' : '']">
                <!-- Checkbox -->
                <button @click="toggleItem(item)"
                        :class="['w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                                  item.checked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300']">
                  <span v-if="item.checked" class="text-sm">✓</span>
                </button>

                <!-- Image -->
                <img v-if="item.image_path" :src="item.image_path" class="product-thumb" alt="">

                <!-- Name & details -->
                <div class="flex-1 min-w-0">
                  <p class="font-medium truncate">{{ itemDisplayName(item) }}</p>
                  <p v-if="item.notes" class="text-xs text-gray-400">{{ item.notes }}</p>
                </div>

                <!-- Quantity stepper -->
                <div class="qty-stepper shrink-0">
                  <button @click="updateQuantity(item, -0.5)">−</button>
                  <input :value="item.quantity" readonly>
                  <button @click="updateQuantity(item, 0.5)">+</button>
                </div>
                <span class="text-xs text-gray-500 w-10 text-center shrink-0">{{ item.unit }}</span>

                <!-- Delete -->
                <button @click="removeItem(item)" class="p-1 text-gray-300 hover:text-red-500 shrink-0">
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <p class="text-4xl mb-3">🛒</p>
          <p class="text-lg font-medium">הרשימה ריקה</p>
          <p class="text-sm mt-1">הוסיפו פריטים מהקטלוג או באופן ידני</p>
          <button @click="openAddItem" class="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700">
            + הוסף פריט
          </button>
        </div>

        <!-- FAB - Add item -->
        <button @click="openAddItem" class="fab bg-blue-600 text-white hover:bg-blue-700">
          +
        </button>

        <!-- Add item modal -->
        <div v-if="showAddItem" class="modal-overlay" @click.self="showAddItem = false">
          <div class="modal-content">
            <h3 class="text-lg font-bold mb-4">הוספת פריט</h3>

            <!-- Toggle: catalog vs custom -->
            <div class="flex gap-2 mb-4">
              <button @click="addItemMode = 'catalog'"
                      :class="['flex-1 py-2 rounded-lg text-sm font-medium border', addItemMode === 'catalog' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300']">
                מהקטלוג
              </button>
              <button @click="addItemMode = 'custom'"
                      :class="['flex-1 py-2 rounded-lg text-sm font-medium border', addItemMode === 'custom' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300']">
                פריט חופשי
              </button>
            </div>

            <!-- Catalog picker -->
            <div v-if="addItemMode === 'catalog'">
              <!-- Product selected - show details form -->
              <div v-if="selectedProduct" class="space-y-3">
                <div class="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <img v-if="selectedProduct.image_path" :src="selectedProduct.image_path" class="w-10 h-10 rounded object-cover">
                  <span v-else class="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">📦</span>
                  <div class="flex-1">
                    <p class="font-medium">{{ selectedProduct.name_he || selectedProduct.name }}</p>
                    <p v-if="selectedProduct.name_he && selectedProduct.name" class="text-xs text-gray-400" dir="ltr">{{ selectedProduct.name }}</p>
                  </div>
                  <button @click="cancelSelectProduct" class="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs text-gray-600 mb-1">כמות</label>
                    <input v-model.number="selectedProductQty" type="number"
                           :min="isUnitBased(selectedProductUnit) ? 1 : 0.1"
                           :step="isUnitBased(selectedProductUnit) ? 1 : 0.5"
                           class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                  </div>
                  <div>
                    <label class="block text-xs text-gray-600 mb-1">יחידה</label>
                    <select v-model="selectedProductUnit"
                            class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                      <option v-for="u in units" :key="u" :value="u">{{ u }}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="block text-xs text-gray-600 mb-1">הערה</label>
                  <input v-model="selectedProductNotes" type="text" placeholder="למשל: מותג מסוים, גודל..."
                         class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                </div>
                <button @click="confirmAddFromCatalog"
                        class="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700">
                  הוסף לרשימה
                </button>
              </div>

              <!-- No product selected - show search list -->
              <div v-else>
                <input v-model="catalogSearch" type="search" placeholder="חיפוש מוצר..."
                       class="w-full border rounded-lg px-3 py-2 mb-3 focus:ring-2 focus:ring-blue-500 outline-none">
                <div class="max-h-60 overflow-y-auto space-y-1">
                  <div v-for="p in filteredCatalogProducts" :key="p.id"
                       @click="selectFromCatalog(p)"
                       class="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-blue-50 active:bg-blue-100">
                    <img v-if="p.image_path" :src="p.image_path" class="w-8 h-8 rounded object-cover">
                    <span v-else class="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-sm">📦</span>
                    <div class="flex-1">
                      <p class="text-sm font-medium">{{ p.name_he || p.name }}</p>
                      <p class="text-xs text-gray-400">{{ p.default_quantity }} {{ p.default_unit }}</p>
                    </div>
                    <span class="text-blue-600 text-xl">+</span>
                  </div>
                  <p v-if="filteredCatalogProducts.length === 0" class="text-center text-gray-400 py-4 text-sm">
                    לא נמצאו מוצרים
                  </p>
                </div>
              </div>
            </div>

            <!-- Custom item -->
            <div v-if="addItemMode === 'custom'" class="space-y-3">
              <input v-model="customItemName" type="text" placeholder="שם הפריט..."
                     @keyup.enter="addCustomItem"
                     class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-600 mb-1">כמות</label>
                  <input v-model.number="customItemQty" type="number"
                         :min="isUnitBased(customItemUnit) ? 1 : 0.1"
                         :step="isUnitBased(customItemUnit) ? 1 : 0.5"
                         class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                </div>
                <div>
                  <label class="block text-xs text-gray-600 mb-1">יחידה</label>
                  <select v-model="customItemUnit"
                          class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option v-for="u in units" :key="u" :value="u">{{ u }}</option>
                  </select>
                </div>
              </div>
              <button @click="addCustomItem" :disabled="!customItemName.trim()"
                      class="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                הוסף פריט
              </button>
            </div>

            <button @click="showAddItem = false" class="w-full mt-3 py-2.5 border rounded-lg hover:bg-gray-50">
              סגור
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
