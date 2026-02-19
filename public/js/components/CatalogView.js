const CatalogView = {
  props: {
    pickerMode: { type: Boolean, default: false },
  },
  emits: ['show-toast', 'pick-product'],
  data() {
    return {
      products: [],
      categories: [],
      searchQuery: '',
      selectedCategory: '',
      showProductForm: false,
      editingProduct: null,
      loading: true,
    };
  },
  computed: {
    filteredProducts() {
      let list = this.products;
      if (this.selectedCategory) {
        list = list.filter(p => p.category_id == this.selectedCategory);
      }
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        list = list.filter(p =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.name_he && p.name_he.includes(q))
        );
      }
      return list;
    },
    groupedProducts() {
      const groups = {};
      for (const p of this.filteredProducts) {
        const cat = p.category_name_he || p.category_name || 'ללא קטגוריה';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(p);
      }
      return groups;
    },
  },
  async created() {
    await this.loadData();
  },
  methods: {
    async loadData() {
      this.loading = true;
      try {
        const [products, categories] = await Promise.all([
          API.getProducts(),
          API.getCategories(),
        ]);
        this.products = products;
        this.categories = categories;
      } catch (e) {
        this.$emit('show-toast', 'שגיאה בטעינת הנתונים');
      }
      this.loading = false;
    },
    openAdd() {
      this.editingProduct = null;
      this.showProductForm = true;
    },
    openEdit(product) {
      this.editingProduct = product;
      this.showProductForm = true;
    },
    async onSaveProduct(formData) {
      try {
        const { imageFile, ...data } = formData;
        let product;
        if (this.editingProduct) {
          product = await API.updateProduct(this.editingProduct.id, data);
        } else {
          product = await API.createProduct(data);
        }
        if (imageFile) {
          await API.uploadProductImage(product.id, imageFile);
        }
        this.showProductForm = false;
        this.$emit('show-toast', this.editingProduct ? 'המוצר עודכן' : 'המוצר נוסף');
        await this.loadData();
      } catch (e) {
        this.$emit('show-toast', 'שגיאה בשמירת המוצר');
      }
    },
    async deleteProduct(product) {
      if (!confirm('למחוק את "' + (product.name_he || product.name) + '"?')) return;
      try {
        await API.deleteProduct(product.id);
        this.$emit('show-toast', 'המוצר נמחק');
        await this.loadData();
      } catch (e) {
        this.$emit('show-toast', 'שגיאה במחיקת המוצר');
      }
    },
    pickProduct(product) {
      this.$emit('pick-product', product);
    },
  },
  template: `
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">{{ pickerMode ? 'בחר מוצר' : 'קטלוג מוצרים' }}</h2>
        <button v-if="!pickerMode" @click="openAdd"
                class="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">
          + מוצר חדש
        </button>
      </div>

      <!-- Search & Filter -->
      <div class="flex gap-2 mb-4">
        <input v-model="searchQuery" type="search" placeholder="חיפוש מוצר..."
               class="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
        <select v-model="selectedCategory"
                class="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">כל הקטגוריות</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">
            {{ cat.name_he || cat.name }}
          </option>
        </select>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="spinner"></div>

      <!-- Empty state -->
      <div v-else-if="products.length === 0" class="empty-state">
        <p class="text-4xl mb-3">📦</p>
        <p class="text-lg font-medium">הקטלוג ריק</p>
        <p class="text-sm mt-1">הוסיפו מוצרים כדי להתחיל</p>
        <button @click="openAdd" class="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg">
          + הוסף מוצר ראשון
        </button>
      </div>

      <!-- Products grouped by category -->
      <div v-else>
        <div v-if="filteredProducts.length === 0" class="empty-state">
          <p class="text-lg">לא נמצאו מוצרים</p>
        </div>
        <div v-for="(items, category) in groupedProducts" :key="category" class="mb-6">
          <h3 class="category-header text-sm font-bold text-gray-500 uppercase bg-gray-50 px-2 py-1.5 rounded mb-2">
            {{ category }}
          </h3>
          <div class="space-y-2">
            <div v-for="product in items" :key="product.id"
                 @click="pickerMode ? pickProduct(product) : null"
                 :class="['bg-white rounded-xl p-3 shadow-sm border flex items-center gap-3',
                          pickerMode ? 'cursor-pointer hover:bg-blue-50 active:bg-blue-100' : '']">
              <img v-if="product.image_path" :src="product.image_path" class="product-thumb" alt="">
              <div v-else class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xl shrink-0">
                📦
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ product.name_he || product.name }}</p>
                <p v-if="product.name_he && product.name" class="text-xs text-gray-400" dir="ltr">{{ product.name }}</p>
                <p class="text-xs text-gray-500">{{ product.default_quantity }} {{ product.default_unit }}</p>
              </div>
              <div v-if="!pickerMode" class="flex gap-1 shrink-0">
                <button @click.stop="openEdit(product)" class="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                  ✏️
                </button>
                <button @click.stop="deleteProduct(product)" class="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Product Form Modal -->
      <product-form v-if="showProductForm"
                    :product="editingProduct"
                    :categories="categories"
                    @save="onSaveProduct"
                    @cancel="showProductForm = false">
      </product-form>
    </div>
  `,
};
