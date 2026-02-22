
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff, Loader2, AlertTriangle, RefreshCw, X, ToggleLeft, ToggleRight, CheckCircle2, Power, LogIn } from 'lucide-react';

const FALLBACK_KEY = "BM5bTSfktrz3d1oj3PgW2wW8EyBIWUY6Ig5clnjBnEiwE5jnOrobDdGbeqm98_RLu6jZq-0c_hjd6HR8Lr0EusU";

const urlBase64ToUint8Array = (base64String: string) => {
  try {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
  } catch (e) {
      console.error("Key Conversion Error:", e);
      return null;
  }
};

// @ts-ignore
const WORKER_URL = (import.meta.env && import.meta.env.VITE_WORKER_URL) || (typeof window !== 'undefined' && window.ENV && window.ENV.VITE_WORKER_URL) || '/api';

const NotificationToggle: React.FC = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is logged in
    const userStr = localStorage.getItem('CHIACHIA_USER');
    if (userStr) {
        try {
            const u = JSON.parse(userStr);
            if (u && u.id) setUserId(String(u.id));
        } catch (e) {}
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    navigator.serviceWorker.ready.then((registration) => {
        setIsSupported(true);
        setPermission(Notification.permission);
    });
  }, [showModal]); // Re-check user when modal opens

  const getValidatedKey = (): Uint8Array | null => {
      const candidates = [];
      // @ts-ignore
      if (typeof window !== 'undefined' && window.ENV?.VAPID_PUBLIC_KEY) candidates.push({ src: 'window.ENV', val: window.ENV.VAPID_PUBLIC_KEY });
      // @ts-ignore
      if (import.meta.env?.VITE_VAPID_PUBLIC_KEY) candidates.push({ src: 'vite.ENV', val: import.meta.env.VITE_VAPID_PUBLIC_KEY });
      candidates.push({ src: 'FALLBACK', val: FALLBACK_KEY });

      for (let { src, val } of candidates) {
          if (!val) continue;
          const cleanString = String(val).replace(/[\s"']/g, '').trim();
          if (cleanString.length < 50) continue;
          const arr = urlBase64ToUint8Array(cleanString);
          if (arr && arr.length === 65 && arr[0] === 4) return arr;
      }
      return null;
  };

  const handleSubscribe = async (force: boolean = false) => {
      if (!userId) {
          alert("請先登入以訂閱通知");
          return;
      }

      setLoading(true);
      try {
          const convertedKey = getValidatedKey();
          if (!convertedKey) throw new Error("無效的 VAPID Key");

          const registration = await navigator.serviceWorker.ready;
          
          if (force) {
              const oldSub = await registration.pushManager.getSubscription();
              if (oldSub) await oldSub.unsubscribe();
          }

          const newSub = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedKey
          });

          // Inject user ID into subscription payload
          const payload = {
              ...JSON.parse(JSON.stringify(newSub)),
              people_id: userId
          };

          const res = await fetch(`${WORKER_URL}/subscribe`, {
              method: 'POST',
              body: JSON.stringify(payload),
              headers: { 'Content-Type': 'application/json' }
          });

          if (res.ok) {
              setPermission('granted');
              if (force) alert("已成功訂閱通知！");
          } else {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.msg || `Server Error: ${res.status}`);
          }
      } catch (e: any) {
          console.error(e);
          alert(`訂閱失敗: ${e.message}`);
      } finally {
          setLoading(false);
      }
  };

  const handleUnsubscribe = async () => {
      setLoading(true);
      try {
          const registration = await navigator.serviceWorker.ready;
          const sub = await registration.pushManager.getSubscription();
          if (sub) {
              // Call backend to remove
              await fetch(`${WORKER_URL}/unsubscribe`, {
                  method: 'POST',
                  body: JSON.stringify(sub),
                  headers: { 'Content-Type': 'application/json' }
              }).catch(console.error); // Ignore backend errors for unsubscribe, just clear local
              
              await sub.unsubscribe();
          }
          setPermission('default'); // Reset UI to default
          alert("已取消訂閱");
      } catch (e: any) {
          console.error(e);
          alert("取消失敗，請稍後再試");
      } finally {
          setLoading(false);
      }
  };

  const handleRequestPermission = async () => {
      if (!userId) {
          alert("請先登入以啟用通知");
          return;
      }
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
          handleSubscribe(true);
      }
  };

  // Main Toggle Button Logic
  let btnClass = 'bg-white/5 border-white/10 text-zinc-400 hover:text-white';
  let icon = <BellOff size={20} />;
  
  if (!isSupported) {
      btnClass = 'bg-rose-500/10 border-rose-500/30 text-rose-500 cursor-not-allowed';
      icon = <AlertTriangle size={18} />;
  } else if (permission === 'granted') {
      btnClass = 'bg-black/40 border-chiachia-green/50 text-chiachia-green shadow-glow-green';
      icon = (
        <>
            <Bell size={20} className="fill-chiachia-green/20" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-chiachia-green rounded-full shadow-[0_0_8px_#39e75f]"></span>
        </>
      );
  }

  return (
    <>
        <button
          onClick={() => setShowModal(true)}
          disabled={!isSupported}
          className={`relative p-2.5 rounded-full border transition-all active:scale-95 group z-50 pointer-events-auto cursor-pointer ${btnClass}`}
          title="推播設定"
        >
          {icon}
        </button>

        {showModal && createPortal(
            <div className="fixed inset-0 z-[70000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowModal(false)}>
                <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-chiachia-green/20 flex flex-col gap-6 animate-scale-in shadow-[0_0_30px_rgba(57,231,95,0.1)]" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center border-b border-white/5 pb-4">
                        <div className="flex items-center gap-2">
                            <Bell size={20} className="text-chiachia-green" />
                            <h3 className="text-lg font-black text-white italic">推播設定</h3>
                        </div>
                        <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400"><X size={18}/></button>
                    </div>

                    <div className="space-y-4">
                        {/* Status Card */}
                        <div className={`p-4 rounded-xl border flex items-center justify-between ${permission === 'granted' ? 'bg-chiachia-green/5 border-chiachia-green/30' : 'bg-zinc-900 border-white/10'}`}>
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Status</div>
                                <div className={`text-sm font-bold ${permission === 'granted' ? 'text-chiachia-green' : 'text-zinc-400'}`}>
                                    {permission === 'granted' ? '已啟用 (Active)' : permission === 'denied' ? '已封鎖 (Denied)' : '未啟用 (Inactive)'}
                                </div>
                            </div>
                            {permission === 'granted' && <CheckCircle2 size={24} className="text-chiachia-green"/>}
                        </div>

                        {!userId && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
                                <AlertTriangle size={20} className="text-amber-500"/>
                                <span className="text-xs font-bold text-amber-500">請先登入以訂閱通知</span>
                            </div>
                        )}

                        {/* Actions */}
                        {permission === 'default' && (
                            <button onClick={handleRequestPermission} disabled={!userId} className="w-full py-3 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale">
                                <ToggleLeft size={20}/> 啟用推播通知
                            </button>
                        )}

                        {permission === 'granted' && (
                            <div className="space-y-3">
                                <button onClick={() => handleSubscribe(true)} disabled={loading || !userId} className="w-full py-3 bg-zinc-800 text-white font-bold rounded-xl border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                    {loading ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>} 重新同步訂閱
                                </button>
                                <button onClick={handleUnsubscribe} disabled={loading} className="w-full py-3 bg-rose-500/10 text-rose-500 font-bold rounded-xl border border-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                                    <Power size={16}/> 停用通知 (Turn Off)
                                </button>
                                <p className="text-[10px] text-zinc-500 text-center">若收不到通知，請嘗試「重新同步」</p>
                            </div>
                        )}

                        {permission === 'denied' && (
                            <div className="text-center p-4 bg-rose-500/10 rounded-xl border border-rose-500/20">
                                <AlertTriangle size={24} className="text-rose-500 mx-auto mb-2"/>
                                <p className="text-xs text-rose-200 font-bold">通知已被瀏覽器封鎖</p>
                                <p className="text-[10px] text-rose-300 mt-1">請至瀏覽器網址列設定中開啟權限。</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        , document.body)}
    </>
  );
};

export default NotificationToggle;
