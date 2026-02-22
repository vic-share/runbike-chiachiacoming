
// Service Worker for Chia Chia Coming
self.addEventListener('push', function(event) {
  let data = { title: '', body: '收到一則新訊息' };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.warn('Push data parse failed, text mode:', event.data.text());
    data.body = event.data.text();
  }

  // 標題邏輯優化：
  // 如果後端沒有提供標題 (title 為空)，我們使用 "零寬空格" (\u200B) 作為標題。
  // 原因：
  // 1. 若傳送空字串 ''，Android Chrome 往往會自動填入 App 名稱，並可能附加 "From [App Name]" 字樣。
  // 2. 若傳送 App 名稱，則會造成視覺重複。
  // 3. 使用 \u200B 可以 "騙過" 瀏覽器認為有標題，但實際上顯示為空白行，讓重點集中在 body 內容，
  //    且能最大程度隱藏中間那行 "From 嘉嘉來了"。
  const titleToUse = (data.title && data.title.trim() !== '') ? data.title : '\u200B';
  const finalBody = data.body;

  const options = {
    body: finalBody,
    icon: 'https://pyltlobngdnoqjnrxefn.supabase.co/storage/v1/object/public/runbike/title/cccm.png',
    badge: 'https://pyltlobngdnoqjnrxefn.supabase.co/storage/v1/object/public/runbike/title/cccm.png',
    data: {
      url: data.url || '/'
    },
    tag: 'chiachia-push-sync',
    renotify: true
  };

  const processPush = async () => {
    // 同步執行設定紅點與顯示通知
    const badgePromise = (async () => {
      const nav = self.navigator || navigator;
      if (nav && 'setAppBadge' in nav) {
        try {
          await nav.setAppBadge(1);
          console.log('SW: Badge set to 1');
        } catch (err) {
          console.error('SW: setAppBadge error', err);
        }
      }
    })();

    const notificationPromise = self.registration.showNotification(titleToUse, options);

    await Promise.all([badgePromise, notificationPromise]);
  };

  event.waitUntil(processPush());
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const clickAction = async () => {
    // 點擊通知時清除紅點
    const nav = self.navigator || navigator;
    if (nav && 'clearAppBadge' in nav) {
      try {
        await nav.clearAppBadge();
      } catch (e) {
        console.error('SW: clearAppBadge failed', e);
      }
    }
    
    // 開啟網頁
    const urlToOpen = event.notification.data.url || '/';
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    
    for (const client of clientList) {
      if (client.url.includes(urlToOpen) && 'focus' in client) {
        return client.focus();
      }
    }
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  };

  event.waitUntil(clickAction());
});

// 強制更新 SW
self.addEventListener('install', () => {
  self.skipWaiting();
});
