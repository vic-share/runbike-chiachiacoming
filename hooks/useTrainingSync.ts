
import { useState, useEffect, useCallback, useRef } from 'react';
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
    const [isSyncingState, setIsSyncingState] = useState(false);
    const syncLock = useRef(false); // 使用 Ref 進行即時同步鎖定

    /**
     * Background sync logic
     */
    const syncData = useCallback(async () => {
        if (!navigator.onLine || syncLock.current) return;

        syncLock.current = true;
        setIsSyncingState(true);

        try {
            // 1. 獲取所有資料並按時間排序，確保「先紀錄的先同步」
            const keys = await trainingStore.keys();
            const allRecords: any[] = [];
            for (const key of keys) {
                const record = await trainingStore.getItem(key);
                if (record) allRecords.push(record);
            }

            // 按時間戳記由舊到新排序
            const sortedRecords = allRecords
                .filter(r => !r.is_synced && !r.is_uploading)
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            
            for (const record of sortedRecords) {
                if (!navigator.onLine) break;

                const key = record.id;

                // 2. 鎖定該筆資料
                await trainingStore.setItem(key, { ...record, is_uploading: true });

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); 

                try {
                    const res = await api.submitRecord({
                        ...record.data,
                        client_id: record.id,
                        created_at: record.created_at // 傳送手機端的原始時間
                    }, { signal: controller.signal } as any);
                    
                    clearTimeout(timeoutId);

                    if (res && res.success) {
                        await trainingStore.removeItem(key);
                        console.log(`[Sync Success] ${key} - ${record.created_at}`);
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } else {
                        await trainingStore.setItem(key, { ...record, is_uploading: false });
                    }
                } catch (error: any) {
                    clearTimeout(timeoutId);
                    await trainingStore.setItem(key, { ...record, is_uploading: false });
                    
                    if (error.name === 'AbortError') {
                        console.warn(`[Sync Timeout] ${key} timed out.`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }
        } catch (error) {
            console.error('[Sync Error] Global sync failed:', error);
        } finally {
            syncLock.current = false;
            setIsSyncingState(false);
        }
    }, []);

    /**
     * Save record locally first
     */
    const saveRecord = async (data: any) => {
        const id = crypto.randomUUID();
        const record = {
            id,
            data,
            created_at: new Date().toISOString(),
            is_synced: false,
            is_uploading: false
        };

        await trainingStore.setItem(id, record);
        
        // 觸發同步，但 syncData 內部有鎖，所以是安全的
        syncData();

        return id;
    };

    useEffect(() => {
        syncData();
        const handleOnline = () => syncData();
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [syncData]);

    return { 
        saveRecord, 
        syncData, 
        isSyncing: isSyncingState 
    };
};
