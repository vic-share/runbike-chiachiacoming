
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
            // 每次同步都重新獲取最新的 keys，避免處理已刪除的資料
            let keys = await trainingStore.keys();
            
            for (const key of keys) {
                // 再次檢查網路，避免在中途斷網
                if (!navigator.onLine) break;

                const record: any = await trainingStore.getItem(key);
                if (!record || record.is_synced || record.is_uploading) continue;

                // 1. 立即鎖定該筆資料
                await trainingStore.setItem(key, { ...record, is_uploading: true });

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1500); // 稍微放寬到 1.5s

                try {
                    const res = await api.submitRecord({
                        ...record.data,
                        client_id: record.id
                    }, { signal: controller.signal } as any);
                    
                    clearTimeout(timeoutId);

                    if (res && res.success) {
                        // 2. 同步成功，徹底移除
                        await trainingStore.removeItem(key);
                        console.log(`[Sync] Record ${key} synced and removed.`);
                    } else {
                        // 伺服器明確回傳失敗
                        await trainingStore.setItem(key, { ...record, is_uploading: false });
                    }
                } catch (error: any) {
                    clearTimeout(timeoutId);
                    // 網路錯誤或超時，還原狀態
                    await trainingStore.setItem(key, { ...record, is_uploading: false });
                    
                    if (error.name === 'AbortError') {
                        console.warn(`[Sync Timeout] ${key} timed out, will retry.`);
                    } else {
                        console.error(`[Sync Error] ${key}:`, error);
                    }
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
