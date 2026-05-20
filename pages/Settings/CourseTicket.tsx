// src/pages/Settings/CourseTicket.tsx
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { LookupItem } from '../../types';
import { ArrowLeft, Plus, X, Loader2, DollarSign, Calendar, Sliders } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CourseTicketProps {
    classes: LookupItem[];
    tickets: LookupItem[];
    salesHistory?: any[];
    refreshData: () => void;
    onBack: () => void;
}

export const CourseTicket: React.FC<CourseTicketProps> = ({ classes, tickets, salesHistory = [], refreshData, onBack }) => {
    const [subTab, setSubTab] = useState<'classes' | 'tickets' | 'finance'>('classes');
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSave = async () => {
        if (!formData.name) return;
        setIsSubmitting(true);
        try {
            const type = subTab === 'classes' ? 'classes' : 'tickets';
            const meta = subTab === 'classes' ? { minutes: formData.minutes || 60 } : { price: formData.price || 0, total_slots: formData.total_slots || 10 };
            await api.manageLookup(type, formData.name, formData.id || null, false, formData.is_hidden || false, meta);
            await refreshData();
            setShowModal(false);
        } catch (e) { alert('儲存失敗'); }
        setIsSubmitting(false);
    };

    const revenueData = useMemo(() => {
        if (!salesHistory.length) return [{ date: '無數據', amount: 0 }];
        return salesHistory.map(item => ({
            date: item.date ? item.date.substring(5) : '',
            amount: item.amount || 0
        }));
    }, [salesHistory]);

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="w-14 h-14 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 border border-white/5"><ArrowLeft size={24}/></button>
                    <h2 className="text-2xl font-black text-white italic">課程與票務管理</h2>
                </div>
                {subTab !== 'finance' && (
                    <button onClick={() => { setFormData({}); setIsEditMode(false); setShowModal(true); }} className="w-14 h-14 rounded-full bg-chiachia-green text-black flex items-center justify-center shadow-glow-green"><Plus size={24} strokeWidth={3}/></button>
                )}
            </div>

            <div className="bg-zinc-900/50 p-1.5 rounded-xl flex gap-1 border border-white/5 mb-6">
                <button onClick={() => setSubTab('classes')} className={`flex-1 py-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${subTab === 'classes' ? 'bg-zinc-800 text-white border border-white/5' : 'text-zinc-500'}`}><Calendar size={14}/>課程項目</button>
                <button onClick={() => setSubTab('tickets')} className={`flex-1 py-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${subTab === 'tickets' ? 'bg-zinc-800 text-white border border-white/5' : 'text-zinc-500'}`}><Sliders size={14}/>套票方案</button>
                <button onClick={() => setSubTab('finance')} className={`flex-1 py-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${subTab === 'finance' ? 'bg-zinc-800 text-white border border-white/5' : 'text-zinc-500'}`}><DollarSign size={14}/>營收報表</button>
            </div>

            {subTab === 'classes' && (
                <div className="space-y-2.5">
                    {classes.filter(c => !c.is_hidden).map(c => (
                        <div key={c.id} onClick={() => { setFormData({ ...c }); setIsEditMode(true); setShowModal(true); }} className="glass-card p-4 rounded-2xl flex justify-between items-center border border-white/5 active:scale-[0.99] transition-all">
                            <div>
                                <div className="font-bold text-white text-base">{c.name}</div>
                                <div className="text-xs text-zinc-500 mt-0.5">時長: {c.minutes || 60} 分鐘</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {subTab === 'tickets' && (
                <div className="space-y-2.5">
                    {tickets.filter(t => !t.is_hidden).map(t => (
                        <div key={t.id} onClick={() => { setFormData({ ...t }); setIsEditMode(true); setShowModal(true); }} className="glass-card p-4 rounded-2xl flex justify-between items-center border border-white/5 active:scale-[0.99] transition-all">
                            <div>
                                <div className="font-bold text-white text-base">{t.name}</div>
                                <div className="text-xs text-zinc-500 mt-0.5">堂數: {t.total_slots || 10} 堂</div>
                            </div>
                            <div className="text-right">
                                <div className="text-chiachia-green font-black text-lg">${t.price || 0}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {subTab === 'finance' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="glass-card p-4 rounded-2xl border border-white/5">
                        <div className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">近期營收趨勢</div>
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#39e75f" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#39e75f" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23"/>
                                    <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false}/>
                                    <YAxis stroke="#52525b" fontSize={10} tickLine={false}/>
                                    <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }} labelStyle={{ color: '#fff' }}/>
                                    <Area type="monotone" dataKey="amount" stroke="#39e75f" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)"/>
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {showModal && createPortal(
                <div className="fixed inset-0 z-[60000] flex items-end justify-center bg-black/90 pb-[env(safe-area-inset-bottom)]" onClick={() => setShowModal(false)}>
                    <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center border-b border-white/5 pb-4 gap-3 mb-4">
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button>
                            <h3 className="text-xl font-black text-white italic">{isEditMode ? '編輯項目' : '新增項目'}</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">名稱</label>
                                <input type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none" placeholder="輸入名稱"/>
                            </div>
                            {subTab === 'classes' ? (
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">單堂時長 (分鐘)</label>
                                    <input type="number" value={formData.minutes || ''} onChange={e => setFormData({ ...formData, minutes: parseInt(e.target.value) })} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"/>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">定價 (TWD)</label>
                                        <input type="number" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: parseInt(e.target.value) })} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"/>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">總堂數</label>
                                        <input type="number" value={formData.total_slots || ''} onChange={e => setFormData({ ...formData, total_slots: parseInt(e.target.value) })} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"/>
                                    </div>
                                </>
                            )}
                            {isEditMode && (
                                <button type="button" onClick={() => setFormData({ ...formData, is_hidden: true })} className="w-full py-2.5 bg-zinc-900 text-rose-500 font-bold border border-white/5 rounded-xl text-xs">下架此項目</button>
                            )}
                            <button type="button" onClick={handleSave} disabled={isSubmitting || !formData.name} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green flex items-center justify-center gap-2">
                                {isSubmitting && <Loader2 size={18} className="animate-spin" />} 儲存項目
                            </button>
                        </div>
                    </div>
                </div>, document.body
            )}
        </div>
    );
};
