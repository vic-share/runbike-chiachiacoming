// Service Worker for Chia Chia Coming (Enhanced Debug Version)
self.addEventListener('push', function(event) {
  let data = { title: '', body: '收到一則新訊息' };
  
  // 1. 追蹤原始推播內容
  console.log('SW: [Step 1] 接收到推播事件', event);

  try {
    if (event.data) {
      data = event.data.json();
      console.log('SW: [Step 2] 解析 JSON 成功:', data);
    }
  } catch (e) {
    console.warn('SW: [Step 2] 解析失敗，切換為純文字模式:', event.data.text());
    data.body = event.data.text();
  }

  // 標題邏輯優化
  const titleToUse = (data.title && data.title.trim() !== '') ? data.title : '\u200B';
  const options = {
    body: data.body,
    icon: 'https://pyltlobngdnoqjnrxefn.supabase.co/storage/v1/object/public/runbike/title/cccm.png',
    badge: 'https://pyltlobngdnoqjnrxefn.supabase.co/storage/v1/object/public/runbike/title/cccm.png',
    data: { url: data.url || '/' },
    tag: 'chiachia-push-sync',
    renotify: true
  };

  const processPush = async () => {
    console.log('SW: [Step 3] 開始執行 processPush 異步邏輯');

    // 同步執行設定紅點
    const badgePromise = (async () => {
      const nav = self.navigator || navigator;
      if (nav && 'setAppBadge' in nav) {
        try {
          await nav.setAppBadge(1);
          console.log('SW: [Badge] 紅點設定成功 (1)');
        } catch (err) {
          console.error('SW: [Badge] 紅點設定失敗:', err);
        }
      }
    })();

    // 顯示通知並追蹤結果
    const notificationPromise = (async () => {
      try {
        console.log('SW: [Notification] 準備執行 showNotification...', { titleToUse, options });
        
        // 檢查權限 (最後一刻確認)
        console.log('SW: [Notification] 目前權限狀態:', Notification.permission);
        
        await self.registration.showNotification(titleToUse, options);
        console.log('SW: [Notification] showNotification 執行完畢 (應已跳出視窗)');
      } catch (err) {
        console.error('SW: [Notification] showNotification 噴錯了:', err);
      }
    })();

    await Promise.all([badgePromise, notificationPromise]);
    console.log('SW: [Step 4] 所有推播處理程序已完成');
  };

  event.waitUntil(processPush());
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