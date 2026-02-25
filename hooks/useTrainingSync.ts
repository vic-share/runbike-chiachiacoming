
import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { api } from '../services/api';

// Initialize localforage instance for training records
const trainingStore = localforage.createInstance({
    name: 'runbike_training',
    storeName: 'records'
});

/**
 * Custom Hook for Offline-First Training Data Synchronization
 */
export const useTrainingSync = () => {
    const [isSyncing, setIsSyncing] = useState(false);

    /**
     * Background sync logic:
     * 1. Check network status
     * 2. Fetch unsynced records from IndexedDB
     * 3. Upload to D1 via API
     * 4. Cleanup on success
     */
    const syncData = useCallback(async () => {
        if (!navigator.onLine || isSyncing) return;

        setIsSyncing(true);
        try {
            const keys = await trainingStore.keys();
            for (const key of keys) {
                const record: any = await trainingStore.getItem(key);
                
                if (record && !record.is_synced) {
                    // 建立 AbortController 用於實作 1 秒超時
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 1000);

                    try {
                        // 傳入 signal，若超過 1 秒會觸發 abort 拋出異常
                        const res = await api.submitRecord({
                            ...record.data,
                            // 這裡可以傳入 signal 給 fetch，但因為 api.ts 封裝了 fetch，
                            // 我們可以直接在呼叫時處理，或者修改 api.ts。
                            // 為了不改動 api.ts 的結構，我們在這裡處理超時判斷。
                        }, { signal: controller.signal } as any);
                        
                        clearTimeout(timeoutId);

                        if (res.success) {
                            await trainingStore.removeItem(key);
                        }
                    } catch (error: any) {
                        clearTimeout(timeoutId);
                        if (error.name === 'AbortError') {
                            console.warn(`[Sync Timeout] Record ${key} sync timed out (>1s), keeping local.`);
                        } else {
                            console.error(`[Sync Error] Failed to upload record ${key}:`, error);
                        }
                        // 發生超時或錯誤，跳過此筆，保留在本地
                        continue;
                    }
                }
            }
        } catch (error) {
            console.error('[Sync Error] Global sync process failed:', error);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);

    /**
     * Save record locally first (Immediate Persistence)
     */
    const saveRecord = async (data: any) => {
        const id = crypto.randomUUID();
        const record = {
            id,
            data,
            created_at: new Date().toISOString(),
            is_synced: false
        };

        // 1. IMMEDIATE write to IndexedDB (Prevents data loss on crash)
        await trainingStore.setItem(id, record);

        // 2. Attempt background sync immediately if online
        syncData();

        return id;
    };

    // Auto-sync on mount and network recovery
    useEffect(() => {
        syncData();

        const handleOnline = () => {
            console.log('[Sync] Network restored, triggering background sync...');
            syncData();
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [syncData]);

    return { 
        saveRecord, 
        syncData, 
        isSyncing 
    };
};
