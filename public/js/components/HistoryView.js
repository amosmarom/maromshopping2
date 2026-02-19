const HistoryView = {
  emits: ['show-toast'],
  data() {
    return {
      history: [],
      activeRecord: null,
      loading: true,
    };
  },
  async created() {
    await this.loadHistory();
  },
  methods: {
    async loadHistory() {
      this.loading = true;
      try {
        this.history = await API.getHistory();
      } catch (e) {
        this.$emit('show-toast', 'שגיאה בטעינת ההיסטוריה');
      }
      this.loading = false;
    },
    async viewDetail(record) {
      try {
        this.activeRecord = await API.getHistoryDetail(record.id);
      } catch (e) {
        this.$emit('show-toast', 'שגיאה בטעינת הפרטים');
      }
    },
    async deleteRecord(record) {
      if (!confirm('למחוק רשומה זו מההיסטוריה?')) return;
      try {
        await API.deleteHistory(record.id);
        if (this.activeRecord?.id === record.id) this.activeRecord = null;
        this.$emit('show-toast', 'הרשומה נמחקה');
        await this.loadHistory();
      } catch (e) {
        this.$emit('show-toast', 'שגיאה במחיקת הרשומה');
      }
    },
    formatDate(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return d.toLocaleDateString('he-IL', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    },
  },
  template: `
    <div>
      <div v-if="!activeRecord">
        <h2 class="text-xl font-bold mb-4">היסטוריית קניות</h2>

        <div v-if="loading" class="spinner"></div>

        <div v-else-if="history.length === 0" class="empty-state">
          <p class="text-4xl mb-3">📋</p>
          <p class="text-lg font-medium">אין היסטוריה עדיין</p>
          <p class="text-sm mt-1">כשתסיימו קנייה, היא תישמר כאן</p>
        </div>

        <div v-else class="space-y-3">
          <div v-for="record in history" :key="record.id"
               @click="viewDetail(record)"
               class="bg-white rounded-xl p-4 shadow-sm border cursor-pointer hover:shadow-md transition-shadow">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold">{{ record.list_name }}</h3>
                <p class="text-sm text-gray-500">
                  {{ record.item_count }} פריטים · {{ formatDate(record.completed_at) }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-gray-400">←</span>
                <button @click.stop="deleteRecord(record)" class="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Detail view -->
      <div v-else>
        <div class="flex items-center gap-3 mb-4">
          <button @click="activeRecord = null" class="p-2 hover:bg-gray-200 rounded-lg">
            ← חזרה
          </button>
          <div>
            <h2 class="text-xl font-bold">{{ activeRecord.list_name }}</h2>
            <p class="text-sm text-gray-500">{{ formatDate(activeRecord.completed_at) }}</p>
          </div>
        </div>

        <div class="space-y-1">
          <div v-for="item in activeRecord.items" :key="item.id"
               class="bg-white rounded-xl p-3 shadow-sm border flex items-center gap-3">
            <span :class="['w-6 h-6 rounded-full flex items-center justify-center text-xs',
                           item.checked ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400']">
              {{ item.checked ? '✓' : '–' }}
            </span>
            <span class="flex-1 font-medium">{{ item.product_name }}</span>
            <span class="text-sm text-gray-500">{{ item.quantity }} {{ item.unit }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
};
