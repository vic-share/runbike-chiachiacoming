import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { uploadImage } from '../services/supabase';
import { RaceEvent, RaceParticipant, LookupItem } from '../types';
import { User, Lock, KeyRound, ArrowLeft, Plus, Check, Trash2, Camera, UserCircle2, Edit2, Users, MapPin, DollarSign, AlertTriangle, RotateCcw, CheckCircle2, MessageCircle, Calendar, Loader2, LockKeyhole, RefreshCw, Bell, BellRing, Radio, Send, Megaphone, Trophy, CalendarCheck, ToggleLeft, ToggleRight, Clock, ChevronRight, ChevronLeft, Settings as SettingsIcon, BookOpen, TestTube2, Flame, Layers, Star, Zap, Repeat, Ticket, Play, Banknote, FileBarChart, History, Image as ImageIcon } from 'lucide-react';
import { format, differenceInYears, parseISO, addYears, endOfMonth, addMonths, startOfMonth, isSameMonth, subDays, addDays, subMonths, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import { SimpleImageCropper } from '../components/SimpleImageCropper';
import { hasPermission, hasRole, PERMISSIONS, ROLES } from '../utils/auth';
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ManualModal } from '../components/ManualModal';

const SimpleAreaChart = ({ data, color = "#39e75f", showTickets = false }: any) => {
    if (!data || data.length === 0) return null;
    const dataKey = showTickets ? 'tickets' : 'amount';
    const chartColor = showTickets ? '#60a5fa' : color;
    return (
        <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs> <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1"> <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/> <stop offset="95%" stopColor={chartColor} stopOpacity={0}/> </linearGradient> </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis dataKey="date" hide={true} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }} />
                    <Area type="monotone" dataKey={dataKey} stroke={chartColor} fillOpacity={1} fill={`url(#color${dataKey})`} strokeWidth={2}/>
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

// 🟢 識別規則：管理層維持原色，RACING組亮綠光圈
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

const Avatar = ({ p, size = 'md', className = '' }: { p: any, size?: 'sm'|'md'|'lg'|'xl'|'2xl', className?: string }) => {
    let sizeClass = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-16 h-16' : size === 'xl' ? 'w-24 h-24' : size === '2xl' ? 'w-32 h-32' : 'w-10 h-10';
    const style = getRoleStyle(p);
    return (
        <div className={`${sizeClass} rounded-full bg-zinc-800 border-2 ${style.border} ${style.shadow} overflow-hidden flex items-center justify-center shrink-0 ${className}`}>
            {p?.s_url ? <img src={p.s_url} className="w-full h-full object-cover"/> : <UserCircle2 size={size === '2xl' ? 64 : size === 'xl' ? 48 : 20} className={style.iconColor}/>}
        </div>
    );
};

const Header = ({ title, onAdd, onBack }: { title: string, onAdd?: () => void, onBack: () => void }) => (
    <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
            <button onClick={onBack} className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 border border-white/5"><ArrowLeft size={20}/></button>
            <h2 className="text-xl font-black text-white italic">{title}</h2>
        </div>
        {onAdd && <button onClick={onAdd} className="w-12 h-12 rounded-xl bg-chiachia-green text-black flex items-center justify-center shadow-glow-green"><Plus size={20}/></button>}
    </div>
);

const Settings: React.FC<any> = ({ people, refreshData, onLoginSuccess, initialView }) => {
  const [user, setUser] = useState(api.getUser());
  const [adminView, setAdminView] = useState<'menu' | 'players'>('menu');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); 
  const [formData, setFormData] = useState<any>({});
  const [isEditMode, setIsEditMode] = useState(false); 
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [resetStatus, setResetStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // 🟢 權限判定：包含 Aide
  const canManagePeople = hasPermission(user, PERMISSIONS.PEOPLE_MANAGE);
  const canManageDeep = hasPermission(user, PERMISSIONS.CONFIG_MANAGE) || hasRole(user, ROLES.DEV);

  const handleToggleRole = (role: string) => { 
      setFormData((prev: any) => { 
          const currentRoles = prev.roles || []; 
          if (currentRoles.includes(role)) return { ...prev, roles: currentRoles.filter((r: string) => r !== role) }; 
          return { ...prev, roles: [...currentRoles, role] }; 
      }); 
  };

  const handleAddPerson = async () => { if(!formData.name) return; setIsSubmitting(true); await api.createPerson(formData.name, formData.full_name || formData.name, 'parent', formData.birthday, formData.roles || [ROLES.RIDER]); await refreshData(); setShowModal(false); setIsSubmitting(false); };
  const handleEditPerson = async () => { if(!formData.id || !formData.name) return; setIsSubmitting(true); await api.manageLookup('people', formData.name, formData.id, false, formData.is_hidden, { birthday: formData.birthday, full_name: formData.full_name, roles: formData.roles }); await refreshData(); setShowModal(false); setIsSubmitting(false); };
  const handleResetPassword = () => { 
      if(!formData.id || !formData.name) return; 
      setIsSubmitting(true);
      api.manageLookup('people', formData.name, formData.id, false, formData.is_hidden, { password: '123456' }).then(() => {
          setResetStatus('success'); setTimeout(() => setResetStatus('idle'), 2000);
      }).finally(() => setIsSubmitting(false));
  };

  return (
    <div className="h-full bg-black overflow-y-auto pb-40">
        {adminView === 'menu' ? (
            <div className="p-6 space-y-6">
                <h2 className="text-2xl font-black text-white italic mb-6">系統設定</h2>
                <div className="grid grid-cols-2 gap-3">
                    {canManagePeople && <button className="glass-card p-4 rounded-2xl flex items-center gap-3" onClick={() => setAdminView('players')}><Users/>人員管理</button>}
                </div>
            </div>
        ) : (
            <div className="p-6">
                <Header title="人員管理" onBack={() => setAdminView('menu')} onAdd={() => { setFormData({ roles: [ROLES.RIDER] }); setIsEditMode(false); setModalType('player'); setShowModal(true); }} />
                <div className="grid grid-cols-3 gap-3 mt-6">
                    {people.filter(p => !p.is_hidden && (hasRole(p, ROLES.RIDER) || hasRole(p, ROLES.RACING) || hasRole(p, ROLES.AIDE) || hasRole(p, ROLES.COACH))).sort(sortPeopleByRole).map((p: any) => (
                        <button key={p.id} onClick={() => { setFormData({...p}); setIsEditMode(true); setModalType('player'); setShowModal(true); }} className={`glass-card p-3 rounded-2xl flex flex-col items-center gap-2 relative active:scale-95 transition-all ${p.is_hidden ? 'opacity-40 grayscale' : ''}`}>
                            <Avatar p={p} size="xl" />
                            <span className="text-xs font-bold text-white truncate w-full text-center">{p.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        )}

        {showModal && modalType === 'player' && createPortal(
            <div className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/90 p-4" onClick={() => setShowModal(false)}>
                <div className="bg-zinc-950 w-full max-w-sm rounded-[32px] p-6 border border-white/10" onClick={e => e.stopPropagation()}>
                    <h3 className="text-xl font-black text-white mb-4">{isEditMode ? '編輯選手' : '新增選手'}</h3>
                    <div className="space-y-4">
                        <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-900 rounded-xl px-4 py-3 text-white" placeholder="暱稱"/>
                        
                        <div className="space-y-2">
                            <label className="text-[10px] text-zinc-500 font-black uppercase">角色權限</label>
                            <div className="flex flex-wrap gap-2">
                                {/* 🟢 選項控制：所有人員管理權限者(包含AIDE)均可設定 Rider/Racing */}
                                {[ROLES.RIDER, ROLES.RACING].map(role => (
                                    <button key={role} onClick={() => handleToggleRole(role)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border ${formData.roles?.includes(role) ? 'bg-chiachia-green border-chiachia-green text-black' : 'bg-zinc-900 border-white/10 text-zinc-500'}`}>
                                        {role}
                                    </button>
                                ))}
                                {/* 🟢 僅限更高級權限者可操作 Coach/Aide */}
                                {canManageDeep && (
                                    [ROLES.AIDE, ROLES.COACH].map(role => (
                                        <button key={role} onClick={() => handleToggleRole(role)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border ${formData.roles?.includes(role) ? 'bg-rose-500 border-rose-500 text-white' : 'bg-zinc-900 border-white/10 text-zinc-500'}`}>
                                            {role}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                        <button onClick={isEditMode ? handleEditPerson : handleAddPerson} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl">儲存</button>
                    </div>
                </div>
            </div>,
            document.body
        )}
    </div>
  );
};

export default Settings;