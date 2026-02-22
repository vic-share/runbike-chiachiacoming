
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 單例變數
let supabaseInstance: SupabaseClient | null = null;

// [SRE] Hardcoded fallbacks for Preview Environment
const FALLBACK_URL = 'https://pyltlobngdnoqjnrxefn.supabase.co/';
const FALLBACK_KEY = 'sb_publishable_QWLcL3Q54OWYCODyZgNxQQ_yIKJeNQd';

/**
 * 取得環境變數的封裝函數
 * 優先順序：
 * 1. window.ENV (Worker 注入)
 * 2. import.meta.env (Vite 本地)
 */
const getEnv = (key: string): string => {
    // @ts-ignore
    const winEnv = typeof window !== 'undefined' ? window.ENV : null;
    
    // 檢查帶有 VITE_ 前綴的
    if (winEnv && winEnv[key] && winEnv[key] !== 'undefined') return winEnv[key];
    // @ts-ignore
    if (import.meta.env && import.meta.env[key]) return import.meta.env[key];
    
    // 檢查不帶 VITE_ 前綴的 (Cloudflare 常用)
    const noPrefixKey = key.replace('VITE_', '');
    if (winEnv && winEnv[noPrefixKey] && winEnv[noPrefixKey] !== 'undefined') return winEnv[noPrefixKey];
    // @ts-ignore
    if (import.meta.env && import.meta.env[noPrefixKey]) return import.meta.env[noPrefixKey];

    return '';
};

/**
 * 取得 Supabase 實例 (Singleton)
 * 支援「延遲初始化」：如果一開始變數還沒準備好，之後呼叫時會嘗試重新建立正確的連線
 */
export const getSupabase = (): SupabaseClient => {
    let url = getEnv('VITE_SUPABASE_URL');
    let key = getEnv('VITE_SUPABASE_ANON_KEY');

    // [Fix] 強制使用 Fallback，如果環境變數抓不到或為空
    if (!url || url === 'undefined' || url.includes('placeholder')) {
        url = FALLBACK_URL;
    }
    if (!key || key === 'undefined') {
        key = FALLBACK_KEY;
    }

    const hasRealConfig = url && key && url !== 'undefined' && !url.includes('placeholder') && url.startsWith('http');

    // 1. 如果已經有正確的實例，直接回傳
    // @ts-ignore
    if (supabaseInstance && !supabaseInstance.supabaseUrl.includes('placeholder')) {
        return supabaseInstance;
    }

    // 2. 如果目前是 placeholder 但現在拿到了真正的 Config (包含 hardcoded fallback)，則重新建立
    if (hasRealConfig) {
        console.log('[Supabase] Initializing with config:', url);
        supabaseInstance = createClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
            }
        });
        return supabaseInstance;
    }

    // 3. 如果還是沒有 Config，確保有一個 placeholder 實例回傳避免程式崩潰
    if (!supabaseInstance) {
        console.warn('[Supabase] Config missing, using temporary placeholder client');
        supabaseInstance = createClient('https://placeholder.supabase.co', 'placeholder');
    }
    
    return supabaseInstance;
};

export type UploadFolder = 'people' | 'race';

/**
 * 結構化上傳圖片
 */
export const uploadImage = async (
  file: File, 
  folder: UploadFolder, 
  options: {
      personId?: string | number,
      typeSuffix?: 's' | 'b' | 'race',
      raceDate?: string,
      raceName?: string,
      customFileName?: string
  } = {},
  bucket: string = 'runbike'
): Promise<{ url: string | null, error: string | null }> => {
  try {
    // 每次上傳時重新透過 getSupabase 取得最新實例（若之前是 placeholder 此時可能會升級）
    const client = getSupabase();
    
    // @ts-ignore
    if (client.supabaseUrl.includes('placeholder')) {
        // Double check fallback here just in case
        if (FALLBACK_URL && FALLBACK_KEY) {
             // Retry init
             getSupabase();
        } else {
             return { url: null, error: "Supabase 設定尚未載入。請確認 Cloudflare Worker 的環境變數 (VITE_SUPABASE_URL) 已設定。" };
        }
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    let filePath = '';

    if (options.customFileName) {
        filePath = `${folder}/${options.customFileName}.${fileExt}`;
    }
    else if (folder === 'people' && options.personId) {
        const type = options.typeSuffix === 'b' ? 'cover' : 'avatar';
        filePath = `people/${options.personId}/${type}_${timestamp}.${fileExt}`;
    } 
    else if (folder === 'race') {
        const date = options.raceDate || 'unknown_date';
        // FIX: Use purely random name to avoid Chinese character encoding issues in S3/Supabase
        // Old: const name = options.raceName ? options.raceName.replace(/\s+/g, '_') : 'event';
        const randomStr = Math.random().toString(36).substring(7);
        filePath = `race/${date}/evt_${timestamp}_${randomStr}.${fileExt}`;
    } 
    else {
        filePath = `${folder}/${timestamp}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    }

    const { data, error } = await client.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true 
      });

    if (error) throw error;

    const { data: { publicUrl } } = client.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return { url: publicUrl, error: null };
  } catch (error: any) {
    console.error('Supabase Upload Error:', error);
    return { url: null, error: error.message || '上傳失敗' };
  }
};
