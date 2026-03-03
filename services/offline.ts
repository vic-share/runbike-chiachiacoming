import localforage from 'localforage';

const store = localforage.createInstance({
  name: 'chiachia-data',
  storeName: 'app-cache'
});

export const offlineService = {
  async save(key: string, data: any) {
    try {
      await store.setItem(key, {
        timestamp: Date.now(),
        data
      });
    } catch (e) {
      console.warn('Cache save failed', e);
    }
  },

  async get(key: string) {
    try {
      const cached = await store.getItem<{ timestamp: number, data: any }>(key);
      return cached ? cached.data : null;
    } catch (e) {
      console.warn('Cache read failed', e);
      return null;
    }
  },

  async clear() {
    await store.clear();
  }
};
