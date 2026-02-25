
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
    const [pendingCount, setPendingCount] = useState(0); // 待同步筆數
    const syncLock = useRef(false);

    /**
     * 重置所有本地資料的上傳狀態 (防止意外卡死)
     */
    const resetUploadingStatus = async () => {
        const keys = await trainingStore.keys();
        for (const key of keys) {
            const record: any = await trainingStore.getItem(key);
            if (record && record.is_uploading) {
                await trainingStore.setItem(key, { ...record, is_uploading: false });
            }
        }
        setPendingCount(keys.length);
    };

    /**
     * Background sync logic
     */
    const syncData = useCallback(async () => {
        if (!navigator.onLine || syncLock.current) return;

        syncLock.current = true;
        setIsSyncingState(true);

        try {
            // 使用 while 迴圈，確保同步過程中新加入的資料也能被處理
            while (true) {
                if (!navigator.onLine) break;

                const keys = await trainingStore.keys();
                setPendingCount(keys.length);

                if (keys.length === 0) break;

                // 找出所有待同步且非上傳中的資料
                const allRecords: any[] = [];
                for (const key of keys) {
                    const record: any = await trainingStore.getItem(key);
                    if (record && !record.is_synced && !record.is_uploading) {
                        allRecords.push(record);
                    }
                }

                if (allRecords.length === 0) break;

                // 排序：最舊的優先
                allRecords.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                const record = allRecords[0];
                const key = record.id;

                // 1. 鎖定
                await trainingStore.setItem(key, { ...record, is_uploading: true });

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); 

                try {
                    const res = await api.submitRecord({
                        ...record.data,
                        client_id: record.id,
                        created_at: record.created_at
                    }, { signal: controller.signal } as any);
                    
                    clearTimeout(timeoutId);

                    if (res && res.success) {
                        await trainingStore.removeItem(key);
                        console.log(`[Sync Success] ${key}`);
                        await new Promise(resolve => setTimeout(resolve, 200));
                    } else {
                        await trainingStore.setItem(key, { ...record, is_uploading: false });
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } catch (error: any) {
                    clearTimeout(timeoutId);
                    await trainingStore.setItem(key, { ...record, is_uploading: false });
                    
                    if (error.name === 'AbortError') {
                        console.warn(`[Sync Timeout] ${key}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    if (!navigator.onLine) break;
                }
            }
        } catch (error) {
            console.error('[Sync Error] Global sync failed:', error);
        } finally {
            const finalKeys = await trainingStore.keys();
            setPendingCount(finalKeys.length);
            syncLock.current = false;
            setIsSyncingState(false);
        }
    }, []);

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
        setPendingCount(prev => prev + 1);
        
        syncData();
        return id;
    };

    useEffect(() => {
        resetUploadingStatus().then(() => {
            syncData();
        });

        const handleOnline = () => syncData();
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [syncData]);

    return { 
        saveRecord, 
        syncData, 
        isSyncing: isSyncingState,
        pendingCount
    };
};
