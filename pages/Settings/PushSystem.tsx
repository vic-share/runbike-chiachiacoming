// src/pages/Settings/PushSystem.tsx
import React, { useState } from 'react';
import { api } from '../../services/api';
import { ArrowLeft, Send, Loader2, Sparkles, Bell } from 'lucide-react';

interface PushSystemProps {
    onBack: () => void;
}

export const PushSystem: React.FC<PushSystemProps> = ({ onBack }) => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    const handleSendPush = async () => {
        if (!title || !message) return;
        setIsSending(true);
        try {
            await api.sendGlobalPush(title, message);
            alert('推播發送成功！');
            setTitle('');
            setMessage('');
        } catch (e) { alert('發送失敗'); }
        setIsSending(false);
    };

    const handleAiRefine = async () => {
        if (!message) return;
        setAiLoading(true);
        try {
            // 模擬整合專案既有的 AI 文案擴寫串接
            setTimeout(() => {
                setMessage(prev => prev + ' 🚀 把握黃金訓練期，快來預約教練課程，精進你的賽道技巧！');
                setAiLoading(false);
            }, 1000);
        } catch (e) { setAiLoading(false); }
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="w-14 h-14 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 border border-white/5"><ArrowLeft size={24}/></button>
                    <h2 className="text-2xl font-black text-white italic">公告與即時推播</h2>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center"><Bell size={18}/></div>
            </div>

            <div className="glass-card p-5 rounded-3xl border border-white/5 space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">推播標題</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none" placeholder="例如: 週末營業時間異動公告"/>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">推播內文</label>
                        <button type="button" onClick={handleAiRefine} disabled={aiLoading || !message} className="text-[10px] font-black text-chiachia-green flex items-center gap-1 bg-chiachia-green/10 px-2 py-1 rounded-md border border-chiachia-green/20 disabled:opacity-30">
                            <Sparkles size={10}/> {aiLoading ? 'AI 構思中...' : 'AI 優化文案'}
                        </button>
                    </div>
                    <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none resize-none text-sm" placeholder="輸入要推播給全體學員與選手的公告內容..."/>
                </div>

                <button type="button" onClick={handleSendPush} disabled={isSending || !title || !message} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green flex items-center justify-center gap-2 pt-2 transition-all">
                    {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={16}/>} 發送全體即時推播
                </button>
            </div>
        </div>
    );
};
