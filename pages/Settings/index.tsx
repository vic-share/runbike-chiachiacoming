// src/pages/Settings/index.tsx
import React, { useState } from 'react';
import { LookupItem } from '../../types';
import { PlayerManager } from './PlayerManager';
import { CourseTicket } from './CourseTicket';
import { PushSystem } from './PushSystem';
import { createPortal } from 'react-dom'; // 🟢 補上彈窗需要的 portal
import { api } from '../../services/api';
import { Users, Calendar, Bell, LogOut, ChevronRight, UserCircle2 } from 'lucide-react';
import { hasRole, ROLES } from '../../utils/auth';

interface SettingsIndexProps {
    user: any;
    people: LookupItem[];
    classes: LookupItem[];
    tickets: LookupItem[];
    salesHistory?: any[];
    refreshData: () => void;
    // 🟢 移除外部的 onLogout 參數，改由內部自治，確保 App.tsx 傳不傳都不會崩潰黑畫面
}

export const SettingsIndex: React.FC<SettingsIndexProps> = ({ user, people, classes, tickets, salesHistory = [], refreshData }) => {
    const [adminView, setAdminView] = useState<'menu' | 'players' | 'courses' | 'push'>('menu');
    const [showLogoutModal, setShowLogoutModal] = useState(false); // 🟢 內置登出確認彈窗狀態

    const isCoachOrAdmin = hasRole(user, ROLES.COACH) || hasRole(user, ROLES.DEV) || hasRole(user, ROLES.AIDE);

    // 🟢 內部直連 api.logout() 乾淨利落，不依賴外部傳參
    const handleInternalLogout = () => {
        api.logout();
        window.location.reload(); // 🟢 登出後直接刷新頁面，回歸最乾淨的初始登入選擇選手狀態
    };

    if (adminView === 'players') {
        return <PlayerManager people={people} user={user} refreshData={refreshData} onBack={() => setAdminView('menu')} />;
    }

    if (adminView === 'courses') {
        return <CourseTicket classes={classes} tickets={tickets} salesHistory={salesHistory} refreshData={refreshData} onBack={() => setAdminView('menu')} />;
    }

    if (adminView === 'push') {
        return <PushSystem onBack={() => setAdminView('menu')} />;
    }

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* 個人檔案頂部資訊欄 */}
            <div className="glass-card p-5 rounded-3xl border border-white/5 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center">
                    {user?.s_url ? <img src={user.s_url} className="w-full h-full object-cover"/> : <UserCircle2 size={36} className="text-zinc-500"/>}
                </div>
                <div>
                    <h3 className="text-xl font-black text-white">{user?.full_name || user?.name || '未登入'}</h3>
                    <div className="flex gap-1.5 mt-1">
                        {(user?.roles || [ROLES.RIDER]).map((role: string) => (
                            <span key={role} className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-900 border border-white/5 text-zinc-400">{role}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* 後台管理選單區塊 (教練、助教、開發者才會顯示) */}
            {isCoachOrAdmin && (
                <div className="space-y-2">
                    <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest pl-1">工作台後台管理</div>
                    <div className="glass-card rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
                        <button onClick={() => setAdminView('players')} className="w-full p-4 flex items-center justify-between text-left active:bg-zinc-900/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center"><Users size={18}/></div>
                                <span className="font-bold text-white text-sm">人員與選手管理</span>
                            </div>
                            <ChevronRight size={16} className="text-zinc-600"/>
                        </button>
                        
                        <button onClick={() => setAdminView('courses')} className="w-full p-4 flex items-center justify-between text-left active:bg-zinc-900/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center"><Calendar size={18}/></div>
                                <span className="font-bold text-white text-sm">課程、票務與財務</span>
                            </div>
                            <ChevronRight size={16} className="text-zinc-600"/>
                        </button>

                        <button onClick={() => setAdminView('push')} className="w-full p-4 flex items-center justify-between text-left active:bg-zinc-900/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center"><Bell size={18}/></div>
                                <span className="font-bold text-white text-sm">公告與即時推播系統</span>
                            </div>
                            <ChevronRight size={16} className="text-zinc-600"/>
                        </button>
                    </div>
                </div>
            )}

            {/* 系統通用選單 */}
            <div className="space-y-2">
                <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest pl-1">帳戶設定</div>
                <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
                    <button onClick={() => setShowLogoutModal(true)} className="w-full p-4 flex items-center justify-between text-left active:bg-zinc-900/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center"><LogOut size={18}/></div>
                            <span className="font-bold text-rose-500 text-sm">登出系統</span>
                        </div>
                        <ChevronRight size={16} className="text-zinc-700"/>
                    </button>
                </div>
            </div>

            {/* 🟢 補回原本擁有的登出確認對話盒 */}
            {showLogoutModal && createPortal(
                <div className="fixed inset-0 z-[60000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
                    <div className="glass-card w-full max-w-xs rounded-3xl p-6 border border-white/10 text-center animate-scale-in bg-zinc-950">
                        <h3 className="text-xl font-black text-white italic mb-2">登出帳號</h3>
                        <p className="text-zinc-400 text-sm font-bold mb-6">確定要登出管理系統嗎？</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setShowLogoutModal(false)} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl active:bg-zinc-700 transition-colors">取消</button>
                            <button onClick={handleInternalLogout} className="py-3 bg-rose-600 text-white font-black rounded-xl">登出</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};