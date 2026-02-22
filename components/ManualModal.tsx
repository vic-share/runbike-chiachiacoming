
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen, Activity, Trophy, CalendarDays, Wallet, BellRing, Settings, ShieldCheck, Flag } from 'lucide-react';
import { hasRole, ROLES } from '../utils/auth';

interface ManualModalProps {
    user: any;
    onClose: () => void;
}

const Section = ({ title, icon, children }: { title: string, icon: React.ReactNode, children?: React.ReactNode }) => (
    <details className="group bg-zinc-900/40 rounded-xl border border-white/5 overflow-hidden transition-all duration-300 open:bg-zinc-900/80 open:border-white/10">
        <summary className="flex items-center justify-between p-4 cursor-pointer list-none select-none">
            <div className="flex items-center gap-3">
                <div className="text-zinc-400 group-open:text-chiachia-green transition-colors">{icon}</div>
                <span className="text-sm font-bold text-zinc-300 group-open:text-white transition-colors">{title}</span>
            </div>
            <div className="w-5 h-5 flex items-center justify-center relative">
                <div className="w-4 h-0.5 bg-zinc-500 rounded-full group-open:rotate-180 transition-transform"></div>
                <div className="absolute w-4 h-0.5 bg-zinc-500 rounded-full rotate-90 group-open:rotate-180 opacity-100 group-open:opacity-0 transition-all"></div>
            </div>
        </summary>
        <div className="px-4 pb-4 text-xs text-zinc-400 leading-relaxed space-y-2 border-t border-white/5 pt-3 animate-fade-in">
            {children}
        </div>
    </details>
);

const RiderManual = () => (
    <div className="space-y-3">
        <Section title="訓練數據 (Training Data)" icon={<Activity size={18} />}>
            <p><strong className="text-white">查看數據：</strong>進入「數據」頁面，可查看個人的訓練歷程與成績。</p>
            <p><strong className="text-white">趨勢分析：</strong>點擊下方的日期卡片，可展開查看當日詳細數據與折線圖。</p>
        </Section>
        <Section title="賽事報名 (Races)" icon={<Trophy size={18} />}>
            <p><strong className="text-white">報名比賽：</strong>在「賽事」頁面點擊感興趣的比賽。若有名額，點擊右側 <span className="text-chiachia-green">+</span> 按鈕即可報名。</p>
            <p><strong className="text-white">上傳照片：</strong>點擊已報名卡片中的名字，可上傳當日比賽照片作為封面。</p>
            <p><strong className="text-white">榮譽榜：</strong>若獲得名次，系統會標記為個人榮譽，並顯示於數據頁面的跑馬燈。</p>
        </Section>
        <Section title="課程與票卷 (Courses)" icon={<CalendarDays size={18} />}>
            <p><strong className="text-white">預約課程：</strong>在「課程」頁面查看課表，點擊 <span className="text-chiachia-green">User+</span> 按鈕報名。注意：報名後會處於「等待開課」狀態。</p>
            <p><strong className="text-white">扣票機制：</strong>當教練確認開課後，系統才會自動扣除票卷。若課程取消，票卷會自動退還。</p>
            <p><strong className="text-white">購買票卷：</strong>至「設定 &gt; 我的票卷」，點擊右上角「購買」。填寫匯款後五碼送出申請，待教練審核入帳。</p>
        </Section>
    </div>
);

const AideManual = () => (
    <div className="space-y-3">
        <Section title="訓練紀錄 (Training)" icon={<Activity size={18} />}>
            <p><strong className="text-white">開始訓練：</strong>進入「數據」頁面，點擊上方 <span className="text-chiachia-green">START TRAINING</span> 按鈕。</p>
            <p><strong className="text-white">輸入成績：</strong>選擇訓練項目（如直線加速），輸入秒數後送出。可點選「Select Rider」切換要紀錄的選手。</p>
        </Section>
        <Section title="賽事協助 (Events)" icon={<Flag size={18} />}>
            <p><strong className="text-white">批量報名：</strong>小幫手擁有管理權限，可在賽事頁面點擊「+」，一次勾選多位選手進行報名。</p>
            <p><strong className="text-white">成績登錄：</strong>賽事結束後，可進入編輯模式協助教練補登選手的名次與成績。</p>
        </Section>
    </div>
);

const CoachManual = () => (
    <div className="space-y-3">
        <Section title="排課系統 (Scheduling)" icon={<CalendarDays size={18} />}>
            <p><strong className="text-white">建立模板：</strong>在「設定 &gt; 排課系統 &gt; 例行課程」設定每週固定的課表（如週五團練）。系統會自動每週生成。</p>
            <p><strong className="text-white">確認開課：</strong>進入課程詳細頁，點擊「確認開課」。此時系統會自動扣除所有已報名學生的票卷。</p>
            <p><strong className="text-white">取消課程：</strong>若人數不足，點擊「取消課程」。系統會自動退還票卷並發送通知。</p>
        </Section>
        <Section title="財務與票卷 (Finance)" icon={<Wallet size={18} />}>
            <p><strong className="text-white">審核儲值：</strong>在「設定 &gt; 票卷管理 &gt; 庫存」，上方會顯示選手的購票申請。確認收到款項後點擊「確認」即可入帳。</p>
            <p><strong className="text-white">手動加票：</strong>可直接展開選手卡片，手動增減票卷（如補償或贈送）。</p>
            <p><strong className="text-white">財務報表：</strong>在「帳務」頁面可查看每月的營收與票卷消耗狀況。</p>
        </Section>
        <Section title="推播通知 (Push)" icon={<BellRing size={18} />}>
            <p><strong className="text-white">發送公告：</strong>在「設定 &gt; 推播系統 &gt; 教練公告」，可發送即時訊息給所有安裝 APP 的家長。</p>
            <p><strong className="text-white">自動化設定：</strong>可自訂賽前提醒、破紀錄通知、開課通知的文案內容。</p>
        </Section>
        <Section title="系統設定 (Settings)" icon={<Settings size={18} />}>
            <p><strong className="text-white">人員管理：</strong>新增選手、設定角色（教練/小幫手）、重設密碼。</p>
            <p><strong className="text-white">訓練/賽事項目：</strong>管理下拉選單中的訓練種類（如直線、彎道）與賽事系列名稱。</p>
        </Section>
    </div>
);

export const ManualModal: React.FC<ManualModalProps> = ({ user, onClose }) => {
    const isCoach = hasRole(user, ROLES.COACH) || hasRole(user, ROLES.DEV);
    const isAide = hasRole(user, ROLES.AIDE);
    
    // Determine available tabs
    const tabs = [];
    if (isCoach) tabs.push({ id: 'coach', label: '教練手冊', component: <CoachManual /> });
    if (isAide || isCoach) tabs.push({ id: 'aide', label: '助手手冊', component: <AideManual /> });
    tabs.push({ id: 'rider', label: '選手手冊', component: <RiderManual /> });

    const [activeTab, setActiveTab] = useState(tabs[0].id);

    return createPortal(
        <div className="fixed inset-0 z-[60000] flex items-end justify-center bg-black/90 backdrop-blur-md animate-fade-in pb-[env(safe-area-inset-bottom)]" onClick={onClose}>
            <div className="glass-card w-full max-w-sm rounded-t-[32px] bg-zinc-950 border-chiachia-green/20 flex flex-col gap-0 animate-slide-up max-h-[90vh] shadow-[0_0_40px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-chiachia-green/10 flex items-center justify-center text-chiachia-green border border-chiachia-green/20">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white italic tracking-tight">操作說明</h3>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">USER MANUAL</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 active:scale-95 border border-white/5 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs (Only if multiple roles) */}
                {tabs.length > 1 && (
                    <div className="px-6 pt-4">
                        <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab.id ? 'bg-zinc-800 text-white shadow-md border border-white/10' : 'text-zinc-600 hover:text-zinc-400'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
                    {tabs.find(t => t.id === activeTab)?.component}
                    
                    <div className="pt-4 text-center">
                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                            © 2025 CHIA CHIA COMING
                        </p>
                    </div>
                </div>
            </div>
        </div>
    , document.body);
};
