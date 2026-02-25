import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);

const FALLBACK_VAPID = "BAYcVhqewAIIymHfS_PpSQq9F2UdGEHiwjdCJRJYoqtnzfONQQj5-_FLDK-gP0yQ_k-JwcHngO1j3rBrSYpAjuA";

const initEnv = () => {
  const w = window as any;
  w.ENV = w.ENV || {};

  console.log('[Init] Syncing window.ENV');

  const meta = import.meta as any;
  
  if (!w.ENV.VAPID_PUBLIC_KEY || w.ENV.VAPID_PUBLIC_KEY === 'undefined') {
      const k = meta.env?.VITE_VAPID_PUBLIC_KEY || FALLBACK_VAPID;
      w.ENV.VAPID_PUBLIC_KEY = String(k).replace(/[\s"']/g, '').trim();
  }

  if (meta.env?.DEV) {
      w.ENV.VITE_SUPABASE_URL = meta.env.VITE_SUPABASE_URL || w.ENV.VITE_SUPABASE_URL;
      w.ENV.VITE_SUPABASE_ANON_KEY = meta.env.VITE_SUPABASE_ANON_KEY || w.ENV.VITE_SUPABASE_ANON_KEY;
  }

  const hasUrl = w.ENV.VITE_SUPABASE_URL && w.ENV.VITE_SUPABASE_URL !== 'undefined' && !w.ENV.VITE_SUPABASE_URL.includes('placeholder');
  
  if (!hasUrl) {
      if (w.ENV.SUPABASE_URL) w.ENV.VITE_SUPABASE_URL = w.ENV.SUPABASE_URL;
      if (w.ENV.SUPABASE_ANON_KEY) w.ENV.VITE_SUPABASE_ANON_KEY = w.ENV.SUPABASE_ANON_KEY;
  }

  // Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('SW registered');
      }).catch(err => {
        console.log('SW failed', err);
      });
    });
  }
};

initEnv();
console.log('React Version:', React.version);
root.render(<App />);
