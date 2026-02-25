// Service Worker for Chia Chia Coming (Enhanced Debug Version)
const SW_VERSION = 'v1.0.1';

self.addEventListener('push', function(event) {
  let data = { title: '', body: '收到一則新訊息' };
  
  // 1. 追蹤原始推播內容
  console.log(`SW [${SW_VERSION}]: [Step 1] 接收到推播事件`, event);

  try {
    if (event.data) {
      data = event.data.json();
      console.log(`SW [${SW_VERSION}]: [Step 2] 解析 JSON 成功:`, data);
    }
  } catch (e) {
    console.warn(`SW [${SW_VERSION}]: [Step 2] 解析失敗，切換為純文字模式:`, event.data.text());
    data.body = event.data.text();
  }

  // 標題邏輯優化: iOS 不支援空標題或不可見字符，必須給預設值
  const titleToUse = (data.title && data.title.trim() !== '') ? data.title : '系統通知';
  const options = {
    body: data.body,
    icon: 'https://pyltlobngdnoqjnrxefn.supabase.co/storage/v1/object/public/runbike/title/cccm.png',
    badge: 'https://pyltlobngdnoqjnrxefn.supabase.co/storage/v1/object/public/runbike/title/cccm.png',
    data: { url: data.url || '/' },
    tag: 'chiachia-push-sync',
    renotify: true
  };

  // iOS 16.4+ 要求 showNotification 必須是 waitUntil 的直接 Promise
  event.waitUntil(
    self.registration.showNotification(titleToUse, options)
      .then(() => {
         console.log(`SW [${SW_VERSION}]: [Notification] showNotification 執行完畢`);
         // 嘗試設定紅點 (非標準 API，部分瀏覽器支援)
         const nav = self.navigator || navigator;
         if (nav && 'setAppBadge' in nav) {
             return nav.setAppBadge(1).catch(e => console.error("Badge Error:", e));
         }
      })
      .catch(err => console.error(`SW [${SW_VERSION}]: [Notification] Error:`, err))
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  console.log('SW: [Click] 使用者點擊了通知');

  const clickAction = async () => {
    const nav = self.navigator || navigator;
    if (nav && 'clearAppBadge' in nav) {
      try { await nav.clearAppBadge(); } catch (e) {}
    }
    
    const urlToOpen = event.notification.data.url || '/';
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    
    for (const client of clientList) {
      if (client.url.includes(urlToOpen) && 'focus' in client) {
        console.log('SW: [Click] 找到現有分頁，嘗試聚焦');
        return client.focus();
      }
    }
    if (clients.openWindow) {
      console.log('SW: [Click] 開啟新分頁:', urlToOpen);
      return clients.openWindow(urlToOpen);
    }
  };

  event.waitUntil(clickAction());
});

// 強制更新與維持活性
self.addEventListener('install', () => {
  console.log('SW: [Lifecycle] Installing, skipWaiting...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SW: [Lifecycle] Activated!');
  event.waitUntil(clients.claim());
});

// 必須加上 fetch 監聽器，否則 Chrome 診斷會顯示 DOES_NOT_EXIST
self.addEventListener('fetch', (event) => {
  // 不做任何事，但必須存在以維持 SW 完整性
});