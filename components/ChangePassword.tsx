import React, { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, LockKeyhole, KeyRound, Eye, EyeOff } from 'lucide-react';

type Status = 'idle' | 'loading' | 'success' | 'error';

const ChangePassword = ({ onComplete }: { onComplete: () => void }) => {
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async () => {
    if (passwords.new !== passwords.confirm) {
      setErrorMsg('新密碼不一致');
      return;
    }
    if (passwords.new.length < 4) {
      setErrorMsg('新密碼至少需要 4 個字元');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('CHIACHIA_TOKEN')}`
        },
        body: JSON.stringify({
          oldPassword: passwords.old,
          newPassword: passwords.new
        })
      });

      const data = await res.json();

      if (data.success) {
        setStatus('success');
        // 更新 localStorage，清除 must_change_password
        const userStr = localStorage.getItem('CHIACHIA_USER');
        if (userStr) {
          const user = JSON.parse(userStr);
          localStorage.setItem('CHIACHIA_USER', JSON.stringify({
            ...user,
            must_change_password: false
          }));
        }
        setTimeout(() => onComplete(), 2000);
      } else {
        setStatus('error');
        setErrorMsg(data.msg || '修改失敗，請稍後再試');
      }
    } catch (e) {
      setStatus('error');
      setErrorMsg('網路連線失敗');
    }
  };

  // ── 成功畫面 ──────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="glass-card w-full max-w-xs rounded-3xl p-8 border-chiachia-green/20 text-center animate-scale-in flex flex-col items-center gap-5 shadow-[0_0_40px_rgba(57,231,95,0.15)]">
        <div className="w-20 h-20 rounded-full bg-chiachia-green/10 border border-chiachia-green/30 flex items-center justify-center shadow-glow-green">
          <CheckCircle2 size={40} className="text-chiachia-green" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-white italic mb-1">密碼修改成功</h3>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">系統即將重新載入...</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-chiachia-green animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── 表單畫面 ──────────────────────────────────────────────
  return (
    <div className="glass-card w-full max-w-xs rounded-3xl p-8 border-amber-500/20 flex flex-col gap-6 animate-scale-in shadow-[0_0_40px_rgba(245,158,11,0.1)]">

      {/* 標題 */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <LockKeyhole size={28} className="text-amber-400" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-white italic">強制更新密碼</h3>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
            首次登入請修改預設密碼
          </p>
        </div>
      </div>

      {/* 輸入欄位 */}
      <div className="space-y-3">
        {/* 舊密碼 */}
        <div className="space-y-1">
          <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
            舊密碼（預設 123456）
          </label>
          <div className="relative">
            <input
              type={showOld ? 'text' : 'password'}
              value={passwords.old}
              onChange={e => setPasswords({ ...passwords, old: e.target.value })}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 pr-11 text-white font-bold outline-none focus:border-amber-500/50 transition-colors text-center tracking-widest"
              placeholder="••••••"
            />
            <button
              type="button"
              onClick={() => setShowOld(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* 新密碼 */}
        <div className="space-y-1">
          <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
            新密碼
          </label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={passwords.new}
              onChange={e => { setPasswords({ ...passwords, new: e.target.value }); setErrorMsg(''); }}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 pr-11 text-white font-bold outline-none focus:border-chiachia-green/50 transition-colors text-center tracking-widest"
              placeholder="輸入新密碼"
            />
            <button
              type="button"
              onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* 確認新密碼 */}
        <div className="space-y-1">
          <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
            確認新密碼
          </label>
          <input
            type="password"
            value={passwords.confirm}
            onChange={e => { setPasswords({ ...passwords, confirm: e.target.value }); setErrorMsg(''); }}
            className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 text-white font-bold outline-none transition-colors text-center tracking-widest ${
              passwords.confirm && passwords.new !== passwords.confirm
                ? 'border-rose-500/50 focus:border-rose-500'
                : 'border-white/10 focus:border-chiachia-green/50'
            }`}
            placeholder="再次輸入新密碼"
          />
          {passwords.confirm && passwords.new !== passwords.confirm && (
            <p className="text-[10px] text-rose-500 font-bold text-center animate-fade-in">
              ⚠ 密碼不一致
            </p>
          )}
        </div>
      </div>

      {/* 錯誤訊息 */}
      {status === 'error' && errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl animate-fade-in">
          <XCircle size={16} className="text-rose-500 shrink-0" />
          <p className="text-xs font-bold text-rose-400">{errorMsg}</p>
        </div>
      )}

      {/* 送出按鈕 */}
      <button
        onClick={handleSubmit}
        disabled={
          status === 'loading' ||
          !passwords.old ||
          !passwords.new ||
          !passwords.confirm ||
          passwords.new !== passwords.confirm
        }
        className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:grayscale disabled:scale-100"
      >
        {status === 'loading' ? (
          <><Loader2 size={18} className="animate-spin" /> 修改中...</>
        ) : (
          <><KeyRound size={18} /> 確認修改密碼</>
        )}
      </button>
    </div>
  );
};

export default ChangePassword;
