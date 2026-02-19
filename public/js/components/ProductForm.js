const ProductForm = {
  props: {
    product: { type: Object, default: null },
    categories: { type: Array, default: () => [] },
  },
  emits: ['save', 'cancel'],
  data() {
    return {
      form: {
        name: '',
        name_he: '',
        category_id: '',
        default_unit: 'יחידה',
        default_quantity: 1,
        notes: '',
      },
      imageFile: null,
      imagePreview: null,
      saving: false,
      units: ['יחידה', 'ק"ג', 'גרם', 'ליטר', 'מ"ל', 'חבילה', 'קופסה', 'שקית'],
    };
  },
  created() {
    if (this.product) {
      this.form = {
        name: this.product.name || '',
        name_he: this.product.name_he || '',
        category_id: this.product.category_id || '',
        default_unit: this.product.default_unit || 'יחידה',
        default_quantity: this.product.default_quantity || 1,
        notes: this.product.notes || '',
      };
      if (this.product.image_path) {
        this.imagePreview = this.product.image_path;
      }
    }
  },
  methods: {
    onFileSelect(e) {
      const file = e.target.files[0];
      if (!file) return;
      this.processImage(file);
    },
    async onPaste(e) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          this.processImage(file);
          break;
        }
      }
    },
    processImage(file) {
      // Resize image client-side
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX = 800;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else { w = Math.round(w * MAX / h); h = MAX; }
          }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => {
            this.imageFile = new File([blob], 'product.jpg', { type: 'image/jpeg' });
            this.imagePreview = canvas.toDataURL('image/jpeg');
          }, 'image/jpeg', 0.85);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    },
    async save() {
      if (!this.form.name && !this.form.name_he) return;
      this.saving = true;
      this.$emit('save', { ...this.form, imageFile: this.imageFile });
    },
  },
  template: `
    <div class="modal-overlay" @click.self="$emit('cancel')">
      <div class="modal-content" @paste="onPaste">
        <h2 class="text-lg font-bold mb-4">{{ product ? 'עריכת מוצר' : 'מוצר חדש' }}</h2>

        <div class="space-y-4">
          <!-- Hebrew name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">שם בעברית</label>
            <input v-model="form.name_he" type="text" placeholder="לדוגמה: חלב"
                   class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
          </div>

          <!-- English name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name (English)</label>
            <input v-model="form.name" type="text" dir="ltr" placeholder="e.g. Milk"
                   class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
          </div>

          <!-- Category -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">קטגוריה</label>
            <select v-model="form.category_id"
                    class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">ללא קטגוריה</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name_he || cat.name }}
              </option>
            </select>
          </div>

          <!-- Unit & Quantity -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">יחידת מידה</label>
              <select v-model="form.default_unit"
                      class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                <option v-for="u in units" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">כמות ברירת מחדל</label>
              <input v-model.number="form.default_quantity" type="number"
                     :min="['יחידה','חבילה','קופסה','שקית'].includes(form.default_unit) ? 1 : 0.1"
                     :step="['יחידה','חבילה','קופסה','שקית'].includes(form.default_unit) ? 1 : 0.1"
                     class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
            </div>
          </div>

          <!-- Image -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">תמונה</label>
            <div class="flex items-center gap-3">
              <img v-if="imagePreview" :src="imagePreview" class="product-thumb-lg">
              <div class="flex-1">
                <input type="file" accept="image/*" capture="environment" @change="onFileSelect"
                       class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 file:font-medium hover:file:bg-blue-100">
                <p class="text-xs text-gray-400 mt-1">או הדביקו תמונה (Ctrl+V)</p>
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">הערות</label>
            <textarea v-model="form.notes" rows="2" placeholder="הערות נוספות..."
                      class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none"></textarea>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3 mt-6">
          <button @click="save" :disabled="saving || (!form.name && !form.name_he)"
                  class="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            {{ saving ? 'שומר...' : 'שמור' }}
          </button>
          <button @click="$emit('cancel')" class="px-6 py-2.5 border rounded-lg hover:bg-gray-50">
            ביטול
          </button>
        </div>
      </div>
    </div>
  `,
};
