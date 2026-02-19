const { createApp } = Vue;

const app = createApp({
  data() {
    return {
      currentView: 'lists',
      pickerMode: false,
      pickerCallback: null,
      toast: null,
      toastTimer: null,
    };
  },
  methods: {
    showToast(message) {
      this.toast = message;
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { this.toast = null; }, 2500);
    },
    openCatalogPicker(callback) {
      this.pickerMode = true;
      this.pickerCallback = callback;
      this.currentView = 'catalog';
    },
    onPickProduct(product) {
      if (this.pickerCallback) {
        this.pickerCallback(product);
        this.pickerMode = false;
        this.pickerCallback = null;
        this.currentView = 'lists';
      }
    },
  },
});

app.component('product-form', ProductForm);
app.component('catalog-view', CatalogView);
app.component('shopping-lists', ShoppingLists);
app.component('history-view', HistoryView);

app.mount('#app');
