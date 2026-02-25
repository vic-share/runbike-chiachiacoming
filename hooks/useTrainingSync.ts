
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
                
                // Only process unsynced records
                if (record && !record.is_synced) {
                    try {
                        // Attempt to upload to remote D1
                        const res = await api.submitRecord(record.data);
                        
                        if (res.success) {
                            // On success, remove from local storage to keep it clean
                            await trainingStore.removeItem(key);
                        }
                    } catch (error) {
                        console.error(`[Sync Error] Failed to upload record ${key}:`, error);
                        // Record remains in IndexedDB for retry
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
