
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
        // 1. 嚴格檢查：網路狀態、是否正在同步中
        if (!navigator.onLine || syncLock.current) return;

        syncLock.current = true;
        setIsSyncingState(true);

        try {
            const keys = await trainingStore.keys();
            for (const key of keys) {
                const record: any = await trainingStore.getItem(key);
                
                // 2. 只有「未同步」且「非上傳中」的資料才處理
                if (record && !record.is_synced && !record.is_uploading) {
                    
                    // 3. 立即標記為上傳中，防止其他程序重複讀取
                    await trainingStore.setItem(key, { ...record, is_uploading: true });

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 1000);

                    try {
                        const res = await api.submitRecord({
                            ...record.data,
                            client_id: record.id // 傳送 UUID 供後端檢查
                        }, { signal: controller.signal } as any);
                        
                        clearTimeout(timeoutId);

                        if (res.success) {
                            // 同步成功，移除本地資料
                            await trainingStore.removeItem(key);
                        } else {
                            // 伺服器回傳失敗，取消上傳中標記，等待下次重試
                            await trainingStore.setItem(key, { ...record, is_uploading: false });
                        }
                    } catch (error: any) {
                        clearTimeout(timeoutId);
                        // 發生錯誤或超時，還原狀態，等待下次重試
                        await trainingStore.setItem(key, { ...record, is_uploading: false });
                        
                        if (error.name === 'AbortError') {
                            console.warn(`[Sync Timeout] Record ${key} timed out.`);
                        }
                        continue;
                    }
                }
            }
        } catch (error) {
            console.error('[Sync Error] Global sync process failed:', error);
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
