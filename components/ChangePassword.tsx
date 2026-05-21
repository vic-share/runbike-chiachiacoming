import React, { useState } from 'react';
import { api } from '../services/api';
import { Loader2 } from 'lucide-react';

const ChangePassword = ({ onComplete }: { onComplete: () => void }) => {
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
  const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
    if (passwords.new !== passwords.confirm) return alert("新密碼不一致");
    setLoading(true);
    try {
        // 直接使用 fetch 確保路徑與 Header 正確，避開 api.ts 封裝問題
        const res = await fetch('/api/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ 
                oldPassword: passwords.old, 
                newPassword: passwords.new 
            })
        });
        const data = await res.json();
        if (data.success) {
            alert("修改成功，系統將重新載入");
            onComplete();
        } else {
            alert(data.msg || "修改失敗");
        }
    } catch (e) { alert("網路請求失敗"); } finally { setLoading(false); }
};

  return (
    <div className="p-6 bg-black h-full flex flex-col justify-center items-center">
      <h2 className="text-white text-xl font-black mb-6">強制更新密碼</h2>
      <input type="password" placeholder="舊密碼 (或預設密碼 123456)" className="w-full p-3 mb-4 bg-zinc-900 text-white rounded" onChange={e => setPasswords({...passwords, old: e.target.value})} />
      <input type="password" placeholder="新密碼" className="w-full p-3 mb-4 bg-zinc-900 text-white rounded" onChange={e => setPasswords({...passwords, new: e.target.value})} />
      <input type="password" placeholder="確認新密碼" className="w-full p-3 mb-6 bg-zinc-900 text-white rounded" onChange={e => setPasswords({...passwords, confirm: e.target.value})} />
      <button onClick={handleSubmit} disabled={loading} className="w-full p-3 bg-chiachia-green font-black rounded text-black">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : "確認修改"}
      </button>
    </div>
  );
};

export default ChangePassword;