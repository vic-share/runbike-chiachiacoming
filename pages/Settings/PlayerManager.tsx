// src/pages/Settings/PlayerManager.tsx
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { LookupItem } from '../../types';
import { ArrowLeft, Plus, X, Loader2, UserCircle2 } from 'lucide-react';
import { hasPermission, hasRole, PERMISSIONS, ROLES } from '../../utils/auth';

const getRoleStyle = (person: any) => {
    const roles = person.roles || [];
    if (roles.includes(ROLES.DEV)) return { border: 'border-blue-500', shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.5)]', iconColor: 'text-blue-500' };
    if (roles.includes(ROLES.COACH)) return { border: 'border-rose-500', shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.5)]', iconColor: 'text-rose-500' };
    if (roles.includes(ROLES.AIDE)) return { border: 'border-amber-500', shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]', iconColor: 'text-amber-500' };
    if (roles.includes(ROLES.RACING)) return { border: 'border-chiachia-green', shadow: 'shadow-[0_0_12px_rgba(57,231,95,0.4)]', iconColor: 'text-chiachia-green' };
    return { border: 'border-white/10', shadow: 'shadow-2xl', iconColor: 'text-zinc-500' };
};

const sortPeopleByRole = (a: any, b: any) => {
    const getTier = (p: any) => {
        if (hasRole(p, ROLES.DEV)) return 4;
        if (hasRole(p, ROLES.COACH)) return 3;
        if (hasRole(p, ROLES.AIDE)) return 2;
        if (hasRole(p, ROLES.RACING)) return 1.5;
        return 1;
    };
    return getTier(b) - getTier(a) || a.name.localeCompare(b.name);
};

interface PlayerManagerProps {
    people: LookupItem[];
    user: any;
    refreshData: () => void;
    onBack: () => void;
}

export const PlayerManager: React.FC<PlayerManagerProps> = ({ people, user, refreshData, onBack }) => {
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resetStatus, setResetStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const canManageDeep = hasPermission(user, PERMISSIONS.CONFIG_MANAGE) || hasRole(user, ROLES.DEV);

    const handleToggleRole = (role: string) => {
        setFormData((prev: any) => {
            const currentRoles = prev.roles || [];
            if (currentRoles.includes(role)) return { ...prev, roles: currentRoles.filter((r: string) => r !== role) };
            return { ...prev, roles: [...currentRoles, role] };
        });
    };

    const handleAddPerson = async () => {
        if (!formData.name) return;
        setIsSubmitting(true);
        try {
            await api.createPerson(formData.name, formData.full_name || formData.name, 'parent', formData.birthday, formData.roles || [ROLES.RIDER]);
            await refreshData();
            setShowModal(false);
        } catch (e) { alert('新增失敗'); }
        setIsSubmitting(false);
    };

    const handleEditPerson = async () => {
        if (!formData.id || !formData.name) return;
        setIsSubmitting(true);
        try {
            await api.manageLookup('people', formData.name, formData.id, false, formData.is_hidden, { birthday: formData.birthday, full_name: formData.full_name, roles: formData.roles });
            await refreshData();
            setShowModal(false);
        } catch (e) { alert('儲存失敗'); }
        setIsSubmitting(false);
    };

    const handleResetPassword = () => {
        if (!formData.id || !formData.name) return;
        setIsSubmitting(true);
        api.manageLookup('people', formData.name, formData.id, false, formData.is_hidden, { password: '123456' }).then(() => {
            setResetStatus('success');
            setTimeout(() => setResetStatus('idle'), 2000);
        }).catch(() => setResetStatus('error')).finally(() => setIsSubmitting(false));
    };

    const sortedPeople = useMemo(() => {
        return people.filter((p: any) => !p.is_hidden).sort(sortPeopleByRole);
    }, [people]);

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="w-14 h-14 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 border border-white/5 active:scale-95 transition-all"><ArrowLeft size={24}/></button>
                    <h2 className="text-2xl font-black text-white italic">人員管理</h2>
                </div>
                <button onClick={() => { setFormData({ roles: [ROLES.RIDER] }); setIsEditMode(false); setShowModal(true); }} className="w-14 h-14 rounded-full bg-chiachia-green text-black flex items-center justify-center shadow-glow-green active:scale-90 transition-transform"><Plus size={24} strokeWidth={3}/></button>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
                {sortedPeople.map((p: any) => {
                    const borderStyle = getRoleStyle(p);
                    return (
                        <button key={p.id} onClick={() => { setFormData({ ...p, is_hidden: !!p.is_hidden }); setIsEditMode(true); setShowModal(true); }} className={`glass-card p-3 rounded-2xl flex flex-col items-center gap-2 relative active:scale-95 transition-all ${p.is_hidden ? 'opacity-40 grayscale' : ''}`}>
                            <div className={`w-16 h-16 rounded-full bg-zinc-800 border-2 ${borderStyle.border} ${borderStyle.shadow} overflow-hidden flex items-center justify-center shrink-0`}>
                                {p?.s_url ? <img src={p.s_url} className="w-full h-full object-cover"/> : <UserCircle2 size={32} className={borderStyle.iconColor}/>}
                            </div>
                            <div className="w-full">
                                <div className={`text-xs font-bold truncate w-full text-center ${p.is_hidden ? 'text-zinc-500' : 'text-white'}`}>{p.full_name || p.name}</div>
                                <div className="text-[10px] text-zinc-500 text-center truncate">({p.name})</div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {showModal && createPortal(
                <div className="fixed inset-0 z-[60000] flex items-end justify-center bg-black/90 pb-[env(safe-area-inset-bottom)]" onClick={() => setShowModal(false)}>
                    <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar mb-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center border-b border-white/5 pb-4 gap-3 mb-4">
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button>
                            <h3 className="text-xl font-black text-white italic">{isEditMode ? '編輯選手' : '新增選手'}</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">暱稱 (登入名稱)</label>
                                <input type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-chiachia-green/50" placeholder="例如: 小明"/>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">全名 (真實姓名)</label>
                                <input type="text" value={formData.full_name || ''} onChange={e => setFormData({ ...formData, full_name: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50" placeholder="例如: 王小明"/>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">生日</label>
                                <input type="date" value={formData.birthday || ''} onChange={e => setFormData({ ...formData, birthday: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 min-w-0"/>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">角色權限</label>
                                <div className="flex flex-wrap gap-2">
                                    {[ROLES.RIDER, ROLES.RACING].map(role => (
                                        <button type="button" key={role} onClick={() => handleToggleRole(role)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${formData.roles?.includes(role) ? 'bg-chiachia-green border-chiachia-green text-black' : 'bg-zinc-900 border-white/10 text-zinc-500'}`}>{role}</button>
                                    ))}
                                    {canManageDeep && [ROLES.AIDE, ROLES.COACH].map(role => (
                                        <button type="button" key={role} onClick={() => handleToggleRole(role)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${formData.roles?.includes(role) ? 'bg-rose-500 border-rose-500 text-white' : 'bg-zinc-900 border-white/10 text-zinc-500'}`}>{role}</button>
                                    ))}
                                </div>
                            </div>
                            
                            {isEditMode && (
                                <div className="flex gap-2 pt-2 border-t border-white/5">
                                    <button type="button" onClick={handleResetPassword} className="flex-1 py-3 bg-zinc-900 text-zinc-400 font-bold rounded-xl border border-white/10 text-xs flex items-center justify-center gap-1 active:scale-95 transition-transform">
                                        {resetStatus === 'success' ? '已重設為123456' : '重設密碼'}
                                    </button>
                                    <button type="button" onClick={() => setFormData({ ...formData, is_hidden: !formData.is_hidden })} className={`flex-1 py-3 rounded-xl text-xs font-bold border active:scale-95 transition-transform ${formData.is_hidden ? 'bg-chiachia-green/10 text-chiachia-green border-chiachia-green/30' : 'bg-zinc-800 text-zinc-500 border-white/5'}`}>
                                        {formData.is_hidden ? '恢復在役' : '設定退休'}
                                    </button>
                                </div>
                            )}

                            <button type="button" onClick={isEditMode ? handleEditPerson : handleAddPerson} disabled={isSubmitting || !formData.name} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 mt-2">
                                {isSubmitting && <Loader2 size={18} className="animate-spin" />} 儲存變更
                            </button>
                        </div>
                    </div>
                </div>, document.body
            )}
        </div>
    );
};
