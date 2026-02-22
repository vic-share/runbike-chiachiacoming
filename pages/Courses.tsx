
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { ClassSession, TicketPricing, LookupItem } from '../types';
import { Clock, Loader2, CheckCircle2, AlertCircle, LogIn, MapPin, Users, Ticket, UserPlus, LogOut, Search, ChevronDown, CalendarDays, Zap, Layers, Star, X, Lock, MessageCircle, AlertTriangle, ShieldCheck, Trash2, Edit2, Play, Ban, SlidersHorizontal, Check, Info, RotateCcw, Share2 } from 'lucide-react';
import { format, addDays, startOfWeek, parseISO, isSameDay, isAfter, subDays, startOfDay, endOfDay, subMonths, addMonths } from 'date-fns';
import { hasPermission, hasRole, PERMISSIONS, ROLES } from '../utils/auth';

const Courses: React.FC<{ courseSystemEnabled?: boolean, people?: LookupItem[] }> = ({ courseSystemEnabled = true, people = [] }) => {
    const [schedule, setSchedule] = useState<ClassSession[]>([]);
    const [ticketPricing, setTicketPricing] = useState<TicketPricing | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Filters & UI State
    const [tab, setTab] = useState<'open' | 'finished' | 'all' | 'joined'>('open');
    const [filterCategory, setFilterCategory] = useState<'all' | 'REGULAR' | 'RACING' | 'SPECIAL'>('all');
    const [filterDay, setFilterDay] = useState<'all' | string>('all');
    
    // Date Filter State
    const [dateFilter, setDateFilter] = useState<'1W' | '1M' | '3M' | 'CUSTOM'>('1M');
    const [customStart, setCustomStart] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
    const [isDateMenuOpen, setIsDateMenuOpen] = useState(false); // Toggle for date menu

    const [search, setSearch] = useState('');
    const [isFilterExpanded, setIsFilterExpanded] = useState(false);
    const [isOverflowVisible, setIsOverflowVisible] = useState(false); // To handle dropdown visibility

    // Modals
    const [showJoinConfirm, setShowJoinConfirm] = useState<{show: boolean, session?: ClassSession}>({ show: false });
    const [showExitModal, setShowExitModal] = useState<{show: boolean, session?: ClassSession}>({ show: false });
    const [showDetailModal, setShowDetailModal] = useState<{show: boolean, session?: ClassSession}>({ show: false });
    const [showAdminStatusConfirm, setShowAdminStatusConfirm] = useState<{show: boolean, session?: ClassSession, status?: 'CONFIRMED' | 'CANCELLED' | 'OPEN'}>({ show: false });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<{show: boolean, id?: string|number}>({ show: false });
    const [showBulkJoinModal, setShowBulkJoinModal] = useState<{show: boolean, session?: ClassSession}>({ show: false });
    
    // Admin Remove Student Modal State
    const [adminRemoveTarget, setAdminRemoveTarget] = useState<{studentId: string|number, studentName: string} | null>(null);

    // New: Generic Info/Warning Modal (Replaces window.alert)
    const [infoModal, setInfoModal] = useState<{show: boolean, title: string, message: string, type: 'info' | 'error'}>({ show: false, title: '', message: '', type: 'info' });

    const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
    const [exitReason, setExitReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    // User State
    const [user, setUser] = useState(api.getUser());
    const [showLoginHint, setShowLoginHint] = useState(false);

    // Permission Checks
    const canEdit = hasPermission(user, PERMISSIONS.COURSE_EDIT) || hasRole(user, ROLES.DEV);
    const canViewAll = hasPermission(user, PERMISSIONS.COURSE_VIEW_ALL) || hasRole(user, ROLES.DEV);
    const isRider = !canViewAll;

    useEffect(() => {
        loadData();
    }, [dateFilter, customStart, customEnd]);

    // Handle overflow visibility for dropdowns inside collapsible area
    useEffect(() => {
        if (isFilterExpanded) {
            const t = setTimeout(() => setIsOverflowVisible(true), 300); // Wait for transition
            return () => clearTimeout(t);
        } else {
            setIsOverflowVisible(false);
            setIsDateMenuOpen(false);
        }
    }, [isFilterExpanded]);

    const loadData = async () => {
        setLoading(true);
        try {
            let start, end;
            const today = new Date();
            if (dateFilter === '1W') {
                start = format(subDays(today, 7), 'yyyy-MM-dd');
                end = format(addDays(today, 7), 'yyyy-MM-dd');
            } else if (dateFilter === '1M') {
                start = format(subMonths(today, 1), 'yyyy-MM-dd');
                end = format(addMonths(today, 1), 'yyyy-MM-dd');
            } else if (dateFilter === '3M') {
                start = format(subMonths(today, 3), 'yyyy-MM-dd');
                end = format(addMonths(today, 3), 'yyyy-MM-dd');
            } else if (dateFilter === 'CUSTOM') {
                start = customStart;
                end = customEnd;
            }

            const [data, pricing] = await Promise.all([
                api.fetchWeeklyCourses(start, end),
                api.fetchTicketPricing()
            ]);
            setSchedule(data);
            setTicketPricing(pricing);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getRangeLabel = () => {
        if (dateFilter === 'CUSTOM') {
            try {
                return `${format(parseISO(customStart), 'MM/dd')} - ${format(parseISO(customEnd), 'MM/dd')}`;
            } catch(e) { return 'Invalid Date'; }
        }
        switch(dateFilter) {
            case '1W': return '前後一週';
            case '1M': return '前後一月';
            case '3M': return '前後三月';
            default: return '日期範圍';
        }
    };

    const handleJoinClick = (e: React.MouseEvent, s: ClassSession) => {
        e.stopPropagation();
        if (!user) {
            setShowLoginHint(true);
            setTimeout(() => setShowLoginHint(false), 2000);
            return;
        }

        if (canEdit) {
            // Admin/Coach -> Open Bulk Join
            setBulkSelectedIds([]);
            setShowBulkJoinModal({ show: true, session: s });
        } else {
            // Rider -> Confirm Join Self
            setShowJoinConfirm({ show: true, session: s });
        }
    };

    // Rider Join
    const confirmJoin = async () => {
        if (!showJoinConfirm.session || !user) return;
        setSubmitting(true);
        try {
            await api.joinCourse(showJoinConfirm.session.id, user.id);
            await loadData();
            setShowJoinConfirm({ show: false });
            if (showDetailModal.show) setShowDetailModal({ show: false });
        } catch (e) {
            setInfoModal({ show: true, title: "錯誤", message: "報名失敗，請稍後再試", type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    // Bulk Join
    const handleBulkJoin = async () => {
        if (!showBulkJoinModal.session || bulkSelectedIds.length === 0) return;
        setSubmitting(true);
        try {
            // Process sequentially to avoid DB lock or race conditions, or use Promise.all
            await Promise.all(bulkSelectedIds.map(pid => 
                api.joinCourse(showBulkJoinModal.session!.id, pid)
            ));
            await loadData();
            setShowBulkJoinModal({ show: false });
        } catch(e) {
            setInfoModal({ show: true, title: "錯誤", message: "批量報名失敗", type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const toggleBulkSelect = (id: string) => {
        setBulkSelectedIds(prev => 
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleExitClick = (e: React.MouseEvent, s: ClassSession) => {
        e.stopPropagation();
        setExitReason('');
        setShowExitModal({ show: true, session: s });
    };

    // Admin Kick Student: Trigger Modal
    const handleAdminExitClick = (studentId: string|number, studentName: string) => {
        setAdminRemoveTarget({ studentId, studentName });
    };

    // Confirm Admin Kick
    const confirmAdminRemove = async () => {
        if (!showDetailModal.session || !adminRemoveTarget) return;
        setSubmitting(true);
        try {
            await api.exitCourse(showDetailModal.session.id, adminRemoveTarget.studentId, 'Removed by Coach');
            await loadData();
            // Refresh detail modal
            const updatedSession = (await api.fetchWeeklyCourses()).find(s => s.id === showDetailModal.session?.id);
            if (updatedSession) setShowDetailModal({ show: true, session: updatedSession });
            setAdminRemoveTarget(null);
        } catch (e) {
            setInfoModal({ show: true, title: "錯誤", message: "移除失敗", type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const confirmExit = async () => {
        if (!showExitModal.session || !user) return;
        if (!exitReason.trim()) {
            setInfoModal({ show: true, title: "提示", message: "請輸入退出原因", type: 'info' });
            return;
        }
        setSubmitting(true);
        try {
            await api.exitCourse(showExitModal.session.id, user.id, exitReason);
            await loadData();
            setShowExitModal({ show: false });
            if (showDetailModal.show) setShowDetailModal({ show: false });
        } catch (e) {
            setInfoModal({ show: true, title: "錯誤", message: "退出失敗", type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    // Admin Handlers
    const handleDeleteClick = () => {
        if (!showDetailModal.session) return;
        
        // Safeguard: Prevent deleting Confirmed courses
        if (showDetailModal.session.status === 'CONFIRMED') {
            setInfoModal({
                show: true,
                title: "無法刪除已開課課程",
                message: "為了確保票卷帳務正確，請先執行「取消課程」將票卷自動退還給學生後，再進行刪除。",
                type: 'error'
            });
            return;
        }

        setShowDeleteConfirm({ show: true, id: showDetailModal.session.id });
    };

    const handleDeleteSession = async () => {
        if (!showDeleteConfirm.id) return;
        setSubmitting(true);
        try {
            await api.deleteSession(showDeleteConfirm.id);
            await loadData();
            setShowDeleteConfirm({ show: false });
            setShowDetailModal({ show: false });
        } catch(e) { 
            setInfoModal({ show: true, title: "錯誤", message: "刪除失敗", type: 'error' });
        }
        setSubmitting(false);
    };

    const handleStatusUpdate = async () => {
        if (!showAdminStatusConfirm.session || !showAdminStatusConfirm.status) return;
        setSubmitting(true);
        // Cast to any to allow 'OPEN' which might be missing in strict type defs if not updated
        const targetStatus: any = showAdminStatusConfirm.status;
        try {
            await api.updateSessionStatus(showAdminStatusConfirm.session.id, targetStatus);
            await loadData();
            // Refresh detail modal to show new status
            const updatedSession = (await api.fetchWeeklyCourses()).find(s => s.id === showAdminStatusConfirm.session?.id);
            if (updatedSession) setShowDetailModal({ show: true, session: updatedSession });
            setShowAdminStatusConfirm({ show: false });
        } catch(e) { 
            setInfoModal({ show: true, title: "錯誤", message: "更新失敗", type: 'error' });
        }
        setSubmitting(false);
    };

    const handleShareCourse = async () => {
        if (!showDetailModal.session) return;
        
        const s = showDetailModal.session;
        // Fetch custom footer
        const templates = await api.fetchPushTemplates();
        const footerText = templates.share_footer_text_course || templates.share_footer_text || "請準時出席，若無法出席請提前請假。";

        const dayName = format(parseISO(s.date), 'EEEE');
        const twDay = dayName.replace('Monday', '週一').replace('Tuesday', '週二').replace('Wednesday', '週三').replace('Thursday', '週四').replace('Friday', '週五').replace('Saturday', '週六').replace('Sunday', '週日');
        
        let text = `📅 ${s.date} (${twDay}) ${s.start_time} - ${s.end_time}\n`;
        text += `📍 ${s.location}\n\n`;
        
        const activeStudents = s.students?.filter(st => st.status !== 'CANCELLED') || [];
        text += `參加名單(${activeStudents.length})\n`;
        
        activeStudents.forEach((st, idx) => {
            text += `${idx + 1}. ${st.name}\n`;
        });
        
        text += `\n${footerText}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `課程分享：${s.name}`,
                    text: text,
                });
            } catch (error) {
                console.log('Error sharing', error);
            }
        } else {
            try {
                await navigator.clipboard.writeText(text);
                setInfoModal({ show: true, title: "已複製", message: "課程資訊已複製到剪貼簿", type: 'info' });
            } catch (err) {
                setInfoModal({ show: true, title: "錯誤", message: "無法複製內容", type: 'error' });
            }
        }
    };

    const filteredSchedule = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);

        return schedule.filter(s => {
            const sDate = parseISO(s.date);
            const isPast = isAfter(today, sDate) && !isSameDay(today, sDate);
            const hasJoined = user && s.students?.some(st => String(st.id || (st as any).people_id) === String(user.id) && st.status !== 'CANCELLED');

            // Visibility Logic: Special courses hidden from Rider unless joined
            if (isRider && s.category === 'SPECIAL' && !hasJoined) return false;

            // Tab Filter
            if (tab === 'open' && isPast) return false;
            if (tab === 'finished' && !isPast) return false;
            if (tab === 'joined' && !hasJoined) return false;

            // Category Filter
            if (filterCategory === 'REGULAR' && s.ticket_type !== 'REGULAR') return false;
            if (filterCategory === 'RACING' && s.ticket_type !== 'RACING') return false;
            if (filterCategory === 'SPECIAL' && s.category !== 'SPECIAL') return false;

            // Day Filter
            if (filterDay !== 'all') {
                const dayMap: Record<string, number> = { '0':0, '1':1, '2':2, '3':3, '4':4, '5':5, '6':6 };
                if (sDate.getDay() !== dayMap[filterDay]) return false;
            }
            
            // Search
            if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;

            return true;
        }).sort((a, b) => {
             if (tab === 'finished') return new Date(b.date).getTime() - new Date(a.date).getTime();
             return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
    }, [schedule, tab, filterCategory, filterDay, user, search, isRider]);

    const getCategoryStyle = (cat?: string, ticketType?: string) => {
        if (cat === 'SPECIAL') return { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/30', icon: <Star size={10}/>, label: '專訓課程' };
        if (ticketType === 'RACING') return { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30', icon: <Zap size={10}/>, label: '競速課程' };
        if (ticketType === 'GROUP_PRACTICE') return { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', icon: <Users size={10}/>, label: '團滑' };
        return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: <Layers size={10}/>, label: '一般課程' };
    };

    // Calculate Dynamic Price
    const getDynamicPriceInfo = (session: ClassSession) => {
        if (session.ticket_type === 'GROUP_PRACTICE') {
            return { label: `團滑 $${ticketPricing?.group_practice_price || 0}` };
        }

        if (session.ticket_type !== 'NONE') return { label: session.ticket_type || '一般' };
        
        // Explicit Price Check (Override Dynamic)
        if (session.price && session.price > 0) {
            return { label: `單次 $${session.price}` };
        }
        
        // If special session (Single Settlement)
        const enrolled = session.enrolled_count;
        const tiers = ticketPricing?.special_tiers || [];
        
        if (tiers.length === 0) return { label: `單次 $${session.price || 0}` };

        // Find current tier
        let currentPrice = session.price || 0; 
        const sortedTiers = [...tiers].sort((a, b) => b.headcount - a.headcount);
        const match = sortedTiers.find(t => enrolled >= t.headcount);
        if (match) currentPrice = match.price;
        else if (sortedTiers.length > 0) {
             const lowest = [...tiers].sort((a, b) => a.headcount - b.headcount)[0];
             if (lowest.headcount === 1) currentPrice = lowest.price;
        }

        return { label: `目前 $${currentPrice}/人` };
    };

    const selectablePeople = useMemo(() => {
        return people
            .filter(p => !p.is_hidden && hasRole(p, ROLES.RIDER)) // Only riders
            .sort((a:any, b:any) => a.name.localeCompare(b.name));
    }, [people]);

    // If system is disabled and user is not permitted to view, show lock screen
    if (!courseSystemEnabled && !canViewAll) {
        return (
            <div className="h-full flex flex-col items-center justify-center pb-24 space-y-4 animate-fade-in opacity-50">
                <div className="w-20 h-20 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center">
                    <Lock size={32} className="text-zinc-500" />
                </div>
                <div className="text-center">
                    <h3 className="text-xl font-black text-white italic tracking-tighter">COURSES LOCKED</h3>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">目前課程系統尚未開放</p>
                </div>
            </div>
        );
    }

    const paddingTopClass = isFilterExpanded ? 'pt-[270px]' : 'pt-[110px]';

    return (
        <div className="h-full relative bg-black">
            {/* Header HUD */}
            <div className="absolute top-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-3xl border-b border-white/5 shadow-2xl transition-all">
                <div className="px-4 py-4 space-y-3 max-w-md mx-auto">
                    <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                            <h2 className="text-[10px] font-black text-zinc-600 tracking-[0.4em] uppercase">COURSES</h2>
                            <div className="text-xl font-black text-white italic tracking-tighter flex items-center gap-2">
                                課程資訊
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setIsFilterExpanded(!isFilterExpanded)} 
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isFilterExpanded ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-zinc-500'}`}
                            >
                                <SlidersHorizontal size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Collapsible Filter Section */}
                    <div className={`transition-all duration-300 ease-in-out space-y-3 ${isFilterExpanded ? 'max-h-[300px] pb-2 opacity-100' : 'max-h-0 pb-0 opacity-0'} ${isOverflowVisible ? 'overflow-visible' : 'overflow-hidden'}`}>
                        {/* Search */}
                        <div className="bg-zinc-900/40 rounded-xl flex items-center px-3 border border-white/5 focus-within:border-chiachia-green/40 transition-all h-10">
                           <Search size={14} className="text-zinc-600 shrink-0"/>
                           <input type="text" placeholder="搜尋課程..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-transparent border-none text-white text-[13px] outline-none placeholder:text-zinc-700 ml-2"/>
                        </div>

                        {/* Category | Day */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="relative flex items-center bg-zinc-900/40 rounded-xl border border-white/5 h-10 col-span-1">
                                <select 
                                    value={filterCategory} 
                                    onChange={e => setFilterCategory(e.target.value as any)} 
                                    className="w-full h-full bg-transparent text-[10px] font-black uppercase tracking-wider outline-none border-none appearance-none px-3 text-white truncate"
                                >
                                    <option value="all">所有類型</option>
                                    <option value="REGULAR">一般課程</option>
                                    <option value="RACING">競速課程</option>
                                    <option value="SPECIAL">專訓課程</option>
                                </select>
                                <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500" />
                            </div>
                            
                            <div className="relative flex items-center bg-zinc-900/40 rounded-xl border border-white/5 h-10 col-span-1">
                                 <select value={filterDay} onChange={e => setFilterDay(e.target.value)} className="w-full h-full bg-transparent text-[10px] font-black uppercase tracking-wider outline-none border-none appearance-none px-3 text-white truncate">
                                    <option value="all">所有星期</option>
                                    <option value="1">週一 (Mon)</option>
                                    <option value="2">週二 (Tue)</option>
                                    <option value="3">週三 (Wed)</option>
                                    <option value="4">週四 (Thu)</option>
                                    <option value="5">週五 (Fri)</option>
                                    <option value="6">週六 (Sat)</option>
                                    <option value="0">週日 (Sun)</option>
                                 </select>
                                 <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500" />
                            </div>
                        </div>

                        {/* Date Filter & Collapsible Menu */}
                        <div className="relative z-50">
                            <button 
                                onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
                                className={`relative flex items-center justify-between px-3 h-10 w-full rounded-xl border transition-all ${isDateMenuOpen ? 'bg-zinc-800 border-white/20 text-white' : 'bg-zinc-900/40 border-white/5 text-zinc-500'}`}
                            >
                                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                                    <CalendarDays size={14} className="shrink-0" />
                                    <span className="text-xs font-black uppercase tracking-wider truncate">
                                        {getRangeLabel()}
                                    </span>
                                </div>
                                <ChevronDown size={12} className={`shrink-0 transition-transform ${isDateMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu */}
                            {isDateMenuOpen && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-2 z-[60] flex flex-col gap-1 animate-scale-in">
                                    <div className="grid grid-cols-4 gap-1 mb-1">
                                        {(['1W', '1M', '3M', 'CUSTOM'] as const).map(opt => (
                                            <button 
                                                key={opt}
                                                onClick={() => { setDateFilter(opt); if(opt !== 'CUSTOM') setIsDateMenuOpen(false); }}
                                                className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider ${dateFilter === opt ? 'bg-chiachia-green text-black' : 'bg-black/40 text-zinc-400 hover:text-white'}`}
                                            >
                                                {opt === '1W' ? '1週' : opt === '1M' ? '1月' : opt === '3M' ? '3月' : '自訂'}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    {dateFilter === 'CUSTOM' && (
                                        <div className="flex items-center gap-2 p-2 bg-black/40 rounded-xl mt-1 border border-white/5">
                                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-zinc-800 border border-white/10 rounded-lg px-2 h-8 text-[10px] font-bold text-white w-full outline-none" />
                                            <span className="text-zinc-500 text-[10px] font-black">TO</span>
                                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-zinc-800 border border-white/10 rounded-lg px-2 h-8 text-[10px] font-bold text-white w-full outline-none" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-zinc-900/60 p-1 rounded-xl h-9 w-full">
                            {(['open', 'joined', 'finished', 'all'] as const).map(t => (
                                <button 
                                    key={t} 
                                    onClick={() => setTab(t)} 
                                    className={`flex-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${tab === t ? 'bg-zinc-800 text-chiachia-green shadow-inner' : 'text-zinc-600'}`}
                                >
                                    {t === 'open' ? '開課中' : t === 'joined' ? '已報名' : t === 'finished' ? '已結束' : '全部'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className={`h-full overflow-y-auto px-4 ${paddingTopClass} pb-32 space-y-4 no-scrollbar transition-all duration-300`}>
                {loading ? (
                    <div className="py-24 flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-chiachia-green/40" size={32} />
                        <span className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.3em]">Loading Schedule</span>
                    </div>
                ) : filteredSchedule.length > 0 ? (
                    filteredSchedule.map(s => {
                        const style = getCategoryStyle(s.category, s.ticket_type);
                        const sDate = parseISO(s.date);
                        const isFull = s.enrolled_count >= s.capacity;
                        const hasJoined = user && s.students?.some(st => String(st.id || (st as any).people_id) === String(user.id) && st.status !== 'CANCELLED');
                        
                        // Strict past logic
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const isPast = isAfter(today, sDate) && !isSameDay(today, sDate);

                        // Time Logic for 17:00 Cutoff
                        const cutoffHour = 17;
                        const now = new Date();
                        const isToday = isSameDay(now, sDate);
                        const isPastCutoff = isToday && now.getHours() >= cutoffHour;
                        
                        const isLocked = !canEdit && (isPast || isPastCutoff);
                        
                        const statusBadge = s.status === 'CONFIRMED' 
                            ? { text: 'CONFIRMED', color: 'text-chiachia-green bg-chiachia-green/10 border-chiachia-green/30' }
                            : s.status === 'CANCELLED' 
                                ? { text: 'CANCELLED', color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' }
                                : { text: 'PENDING', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' };

                        const priceInfo = getDynamicPriceInfo(s);
                        
                        const showActionButton = !isPast && s.status !== 'CANCELLED';

                        const containerClass = isPast 
                            ? 'border-white/5 bg-zinc-950/20 opacity-60 grayscale' 
                            : hasJoined 
                                ? 'border-chiachia-green/30 bg-chiachia-green/5' 
                                : 'border-white/5 bg-zinc-950/40 hover:bg-zinc-900/60';

                        return (
                            <div key={s.id} onClick={() => setShowDetailModal({ show: true, session: s })} className="relative group animate-fade-in cursor-pointer">
                                <div className={`relative glass-card rounded-[28px] overflow-hidden border transition-all ${containerClass}`}>
                                    
                                    <div className="flex gap-4 p-5 relative z-10 pr-12 pl-5">
                                        {/* Date Box */}
                                        <div className={`w-14 h-16 rounded-2xl flex flex-col items-center justify-center border transition-colors shrink-0 ${isPast ? 'bg-zinc-900 border-white/5' : hasJoined ? 'bg-chiachia-green/10 border-chiachia-green/30' : 'bg-zinc-900 border-amber-500/20'}`}>
                                            <span className={`text-[9px] font-black uppercase tracking-tighter ${isPast ? 'text-zinc-600' : hasJoined ? 'text-chiachia-green' : 'text-amber-500'}`}>{format(sDate, 'MMM')}</span>
                                            <span className="text-xl font-black text-white leading-none">{format(sDate, 'dd')}</span>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider border ${statusBadge.color}`}>
                                                    {statusBadge.text}
                                                </div>
                                                <div className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider flex items-center gap-1 ${style.bg} ${style.text} ${style.border} border`}>
                                                    {style.icon} {style.label}
                                                </div>
                                            </div>
                                            <h3 className="text-md font-black text-white italic truncate tracking-tight">{s.name}</h3>
                                            <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-bold mt-1.5">
                                                <div className="flex items-center gap-1"><Clock size={10}/> {s.start_time}</div>
                                                <div className="flex items-center gap-1"><MapPin size={10}/> {s.location}</div>
                                            </div>
                                        </div>

                                        {/* Action Button */}
                                        {showActionButton && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
                                                {hasJoined ? (
                                                     <button onClick={(e) => handleExitClick(e, s)} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20 active:scale-95 transition-all shadow-lg">
                                                         <LogOut size={20}/>
                                                     </button>
                                                ) : (
                                                     <button 
                                                         onClick={(e) => handleJoinClick(e, s)} 
                                                         disabled={isFull || isLocked}
                                                         className={`p-3 rounded-xl transition-all shadow-lg border active:scale-95 ${isLocked ? 'bg-zinc-800 text-zinc-500 border-white/5 grayscale' : isFull ? 'bg-zinc-800 text-zinc-600 border-white/5' : 'bg-white/10 border-white/20 text-white hover:bg-chiachia-green hover:text-black hover:border-chiachia-green'}`}
                                                     >
                                                         {isLocked ? <Lock size={20}/> : isFull ? <AlertCircle size={20}/> : <UserPlus size={20}/>}
                                                     </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Bottom Info Bar */}
                                    <div className="px-5 pb-3 pt-0 flex items-center gap-3 relative z-10">
                                         <div className="flex -space-x-1.5">
                                            {s.students?.filter(st => st.status !== 'CANCELLED').slice(0, 4).map(st => (
                                                <div key={st.id || (st as any).people_id} className="w-5 h-5 rounded-full border border-black bg-zinc-800 overflow-hidden">
                                                    {st.s_url ? <img src={st.s_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-[8px] text-zinc-500">{st.name[0]}</div>}
                                                </div>
                                            ))}
                                         </div>
                                         <span className={`text-[9px] font-black uppercase tracking-wider ${isFull ? 'text-rose-500' : 'text-zinc-600'}`}>
                                            {isFull ? 'FULL HOUSE' : `${s.enrolled_count} / ${s.capacity}`}
                                         </span>
                                         {/* Price Label (Unified Color) */}
                                         <div className="ml-auto flex flex-col items-end">
                                             <span className={`text-[9px] font-black flex items-center gap-1 text-zinc-500`}>
                                                 <Ticket size={10}/> {priceInfo.label}
                                             </span>
                                         </div>
                                    </div>

                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="py-20 flex flex-col items-center text-zinc-700 opacity-50 space-y-2">
                        <AlertCircle size={40} />
                        <span className="text-[10px] font-black uppercase tracking-widest">No Classes Found</span>
                    </div>
                )}
            </div>

            {/* Login Hint Toast */}
            {showLoginHint && createPortal(
                <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-white/10 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-2xl z-[60000] animate-slide-down">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                        <LogIn size={16}/>
                    </div>
                    <span className="text-xs font-bold text-white">請先登入以報名課程</span>
                </div>
            , document.body)}

            {/* Join Confirmation Modal (Rider) */}
            {showJoinConfirm.show && createPortal(
                <div className="fixed inset-0 z-[60000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowJoinConfirm({show: false})}>
                    <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-chiachia-green/20 text-center animate-scale-in shadow-[0_0_30px_rgba(57,231,95,0.1)]" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 rounded-full bg-chiachia-green/10 text-chiachia-green flex items-center justify-center mx-auto mb-4 border border-chiachia-green/20">
                            <UserPlus size={32} />
                        </div>
                        <h3 className="text-xl font-black text-white italic mb-2">確認報名</h3>
                        <p className="text-zinc-400 text-sm font-bold mb-6">
                            您確定要報名 <span className="text-white">{showJoinConfirm.session?.name}</span> 嗎？
                            {showJoinConfirm.session?.ticket_type === 'GROUP_PRACTICE' ? (
                                <span className="block mt-1 text-[10px] text-teal-400">* 團滑單次結算 (費用請見現場)</span>
                            ) : showJoinConfirm.session?.ticket_type !== 'NONE' ? (
                                <span className="block mt-1 text-[10px] text-amber-500">* 確認開課後才扣除 1 張{showJoinConfirm.session?.ticket_type === 'REGULAR' ? '一般' : '競技'}課票卷 (可預支)</span>
                            ) : (
                                <span className="block mt-1 text-[10px] text-chiachia-green">* 本課程為單次結算 (現場繳費)</span>
                            )}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setShowJoinConfirm({show: false})} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl active:bg-zinc-700 transition-colors">取消</button>
                            <button onClick={confirmJoin} disabled={submitting} className="py-3 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center">
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : '確認報名'}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Bulk Join Modal (Admin/Coach) */}
            {showBulkJoinModal.show && createPortal(
                <div className="fixed inset-0 z-[60000] flex items-end justify-center bg-black/90 backdrop-blur-md animate-fade-in pb-[env(safe-area-inset-bottom)]" onClick={() => setShowBulkJoinModal({show: false})}>
                    <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 animate-slide-up max-h-[90vh] overflow-hidden shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center border-b border-white/5 pb-4 gap-3">
                            <button onClick={() => setShowBulkJoinModal({ show: false })} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button>
                            <h3 className="text-xl font-black text-white italic">批量報名</h3>
                        </div>
                        <div className="space-y-4 pt-2 flex-1 overflow-hidden flex flex-col">
                            <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest flex justify-between">
                                <span>選擇選手 ({bulkSelectedIds.length})</span>
                                <span>{showBulkJoinModal.session?.name}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 overflow-y-auto no-scrollbar p-1 flex-1">
                                {selectablePeople.map((p: any) => {
                                    const isSelected = bulkSelectedIds.includes(String(p.id));
                                    const isAlreadyJoined = showBulkJoinModal.session?.students?.some((st:any) => String(st.id || st.people_id) === String(p.id) && st.status !== 'CANCELLED');
                                    
                                    if (isAlreadyJoined) return null;

                                    return (
                                        <button 
                                            key={p.id} 
                                            onClick={() => toggleBulkSelect(String(p.id))}
                                            className={`relative group flex flex-col items-center gap-2 p-2 rounded-xl border transition-all ${
                                                isSelected 
                                                ? 'bg-chiachia-green/10 border-chiachia-green' 
                                                : 'bg-zinc-900/40 border-white/10 hover:bg-zinc-800'
                                            }`}
                                        >
                                            <div className={`w-10 h-10 rounded-full overflow-hidden border-2 bg-zinc-950 flex-shrink-0 flex items-center justify-center ${
                                                isSelected ? 'border-chiachia-green shadow-glow-green' : 'border-white/10 group-hover:border-white/30'
                                            }`}>
                                                {p.s_url ? (
                                                    <img src={p.s_url.split('#')[0]} className="w-full h-full object-cover"/>
                                                ) : (
                                                    <UserPlus size={16} className={isSelected ? 'text-chiachia-green' : 'text-zinc-600'}/>
                                                )}
                                            </div>
                                            <span className={`text-[10px] font-bold truncate w-full text-center ${isSelected ? 'text-chiachia-green' : 'text-zinc-400'}`}>
                                                {p.name}
                                            </span>
                                            {isSelected && (
                                                <div className="absolute top-1 right-1 w-3 h-3 bg-chiachia-green rounded-full flex items-center justify-center text-black shadow-glow-green">
                                                    <Check size={8} strokeWidth={4}/>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <button onClick={handleBulkJoin} disabled={submitting || bulkSelectedIds.length === 0} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 mt-auto shrink-0">
                                {submitting ? <Loader2 size={18} className="animate-spin" /> : `確認報名 (${bulkSelectedIds.length}人)`}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Exit Modal */}
            {showExitModal.show && createPortal(
                <div className="fixed inset-0 z-[60000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowExitModal({show: false})}>
                    <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-rose-500/20 text-center animate-scale-in shadow-[0_0_30px_rgba(244,63,94,0.1)]" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                            <LogOut size={32} />
                        </div>
                        <h3 className="text-xl font-black text-white italic mb-2">取消報名</h3>
                        <p className="text-zinc-400 text-xs font-bold mb-4">請輸入取消原因 (如: 生病, 臨時有事)</p>
                        <input 
                            type="text" 
                            value={exitReason} 
                            onChange={e => setExitReason(e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-rose-500/50 mb-4"
                            placeholder="原因..."
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setShowExitModal({show: false})} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl active:bg-zinc-700 transition-colors">保留</button>
                            <button onClick={confirmExit} disabled={submitting || !exitReason} className="py-3 bg-rose-600 text-white font-black rounded-xl shadow-glow-rose active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:grayscale">
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : '確認取消'}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Session Detail Modal */}
            {showDetailModal.show && showDetailModal.session && createPortal(
                <div className="fixed inset-0 z-[50000] flex items-end justify-center bg-black/90 backdrop-blur-md animate-fade-in pb-[env(safe-area-inset-bottom)]" onClick={() => setShowDetailModal({ show: false })}>
                    <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 animate-slide-up max-h-[85vh] overflow-hidden shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start border-b border-white/5 pb-4">
                            <div>
                                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">{showDetailModal.session.date}</div>
                                <h3 className="text-2xl font-black text-white italic tracking-tight">{showDetailModal.session.name}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleShareCourse} className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center active:scale-95 hover:text-white transition-colors">
                                    <Share2 size={18} />
                                </button>
                                <button onClick={() => setShowDetailModal({ show: false })} className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center active:scale-95 hover:text-white transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-zinc-900/50 p-3 rounded-xl border border-white/5">
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase">Enrollment</div>
                                    <div className="text-xl font-black text-white">{showDetailModal.session.enrolled_count} <span className="text-zinc-600 text-xs">/ {showDetailModal.session.capacity}</span></div>
                                </div>
                                <div className="bg-zinc-900/50 p-3 rounded-xl border border-white/5">
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase">Status</div>
                                    <div className={`text-xl font-black ${showDetailModal.session.status === 'CONFIRMED' ? 'text-chiachia-green' : showDetailModal.session.status === 'CANCELLED' ? 'text-rose-500' : 'text-amber-500'}`}>
                                        {showDetailModal.session.status || 'OPEN'}
                                    </div>
                                </div>
                            </div>

                            {/* Dynamic Price Display in Detail (Only for SPECIAL/NONE) */}
                            {showDetailModal.session.ticket_type === 'NONE' && (!showDetailModal.session.price || showDetailModal.session.price === 0) && ticketPricing?.special_tiers && (
                                <div className="bg-zinc-900/30 p-3 rounded-xl border border-chiachia-green/20">
                                    <div className="text-[10px] text-chiachia-green font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                                        <Ticket size={12}/> 動態定價規則
                                    </div>
                                    <div className="space-y-1">
                                        {ticketPricing.special_tiers.map((tier, idx) => {
                                            return (
                                                <div key={idx} className="flex justify-between items-center text-xs text-zinc-400 px-2 py-1 rounded bg-black/20">
                                                    <span>{tier.headcount}人以上</span>
                                                    <span className="font-mono text-white">${tier.price}</span>
                                                </div>
                                            );
                                        })}
                                        <div className="text-[9px] text-zinc-500 mt-1 text-right pt-1 border-t border-white/5">
                                            目前費用: <span className="text-chiachia-green font-black text-sm">${getDynamicPriceInfo(showDetailModal.session).label.replace('目前 $', '').replace('/人', '')}</span> /人
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Student List */}
                            <div className="space-y-2">
                                <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Student List</div>
                                {showDetailModal.session.students && showDetailModal.session.students.length > 0 ? (
                                    showDetailModal.session.students.map((st: any) => (
                                        <div key={st.id || st.people_id} className="flex items-center justify-between p-3 bg-zinc-900/30 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 overflow-hidden">
                                                    {st.s_url ? <img src={st.s_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">{st.name[0]}</div>}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-bold ${st.status === 'CANCELLED' ? 'text-zinc-500' : 'text-white'}`}>{st.name}</span>
                                                    {st.status === 'CANCELLED' && st.note && <span className="text-[10px] text-rose-500 truncate max-w-[150px]">{st.note}</span>}
                                                </div>
                                            </div>
                                            {st.status === 'CANCELLED' ? (
                                                <div className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[9px] font-black uppercase border border-rose-500/20">LEAVE</div>
                                            ) : (
                                                // Admin Kick Button
                                                canEdit && (
                                                    <button 
                                                        onClick={() => handleAdminExitClick(st.id || st.people_id, st.name)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-500 hover:text-rose-500 active:scale-95 transition-all"
                                                    >
                                                        <LogOut size={14}/>
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-4 text-zinc-600 text-xs">尚無人報名</div>
                                )}
                            </div>
                        </div>

                        {/* Admin Actions */}
                        {canEdit && (
                            <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                                <div className="grid grid-cols-2 gap-2">
                                    {showDetailModal.session.status === 'CANCELLED' ? (
                                        <button 
                                            onClick={() => setShowAdminStatusConfirm({ show: true, session: showDetailModal.session, status: 'OPEN' })}
                                            className="py-3 bg-zinc-800 text-zinc-300 font-bold rounded-xl border border-white/10 flex items-center justify-center gap-2 active:scale-95"
                                        >
                                            <RotateCcw size={16}/> 重新開課
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => setShowAdminStatusConfirm({ show: true, session: showDetailModal.session, status: 'CONFIRMED' })}
                                            className="py-3 bg-chiachia-green/10 text-chiachia-green font-bold rounded-xl border border-chiachia-green/30 flex items-center justify-center gap-2 active:scale-95"
                                        >
                                            <CheckCircle2 size={16}/> 確認開課
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => setShowAdminStatusConfirm({ show: true, session: showDetailModal.session, status: 'CANCELLED' })}
                                        className="py-3 bg-rose-500/10 text-rose-500 font-bold rounded-xl border border-rose-500/30 flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <Ban size={16}/> 取消課程
                                    </button>
                                </div>
                                <button 
                                    onClick={handleDeleteClick}
                                    className="py-3 bg-zinc-900 text-zinc-500 font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 hover:text-rose-500 transition-colors"
                                >
                                    <Trash2 size={16}/> 刪除此課程
                                </button>
                            </div>
                        )}
                        
                    </div>
                </div>
            , document.body)}

            {/* Admin Status Confirm Modal */}
            {showAdminStatusConfirm.show && createPortal(
                <div className="fixed inset-0 z-[60000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-white/10 text-center animate-scale-in">
                        <div className="mb-4 text-xl font-black text-white italic">
                            {showAdminStatusConfirm.status === 'CONFIRMED' ? '確認開課' : showAdminStatusConfirm.status === 'OPEN' ? '重新開課' : '取消課程'}
                        </div>
                        <p className="text-zinc-400 text-sm mb-6">
                            確定要變更狀態為 {showAdminStatusConfirm.status}? <br/>
                            {showAdminStatusConfirm.status === 'CANCELLED' && showAdminStatusConfirm.session?.status === 'CONFIRMED' && (
                                <span className="text-amber-500 block mt-1 font-bold">* 系統將自動退還票卷給已報名學生</span>
                            )}
                            {showAdminStatusConfirm.status === 'OPEN' && (
                                <span className="text-teal-400 block mt-1 font-bold">* 課程將回復為等待開課狀態</span>
                            )}
                            系統將會發送推播通知給所有已報名的學生。
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setShowAdminStatusConfirm({ show: false })} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl">取消</button>
                            <button onClick={handleStatusUpdate} disabled={submitting} className={`py-3 font-black rounded-xl text-black flex items-center justify-center ${showAdminStatusConfirm.status === 'CONFIRMED' || showAdminStatusConfirm.status === 'OPEN' ? 'bg-chiachia-green shadow-glow-green' : 'bg-rose-500 text-white shadow-glow-rose'}`}>
                                {submitting ? <Loader2 size={16} className="animate-spin"/> : '確認執行'}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}
            
            {/* Admin Delete Confirm Modal */}
            {showDeleteConfirm.show && createPortal(
                <div className="fixed inset-0 z-[60000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-rose-500/20 text-center animate-scale-in">
                        <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                            <Trash2 size={32} />
                        </div>
                        <h3 className="text-xl font-black text-white italic mb-2">刪除課程</h3>
                        <p className="text-zinc-400 text-sm font-bold mb-6">確定要刪除此課程嗎？所有報名紀錄也會一併刪除。</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setShowDeleteConfirm({ show: false })} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl active:bg-zinc-700 transition-colors">取消</button>
                            <button onClick={handleDeleteSession} disabled={submitting} className="py-3 bg-rose-600 text-white font-black rounded-xl shadow-glow-rose active:scale-95 transition-all flex items-center justify-center">
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : '確認刪除'}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Admin Remove Student Confirmation Modal */}
            {adminRemoveTarget && createPortal(
                <div className="fixed inset-0 z-[60000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setAdminRemoveTarget(null)}>
                    <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-rose-500/20 text-center animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                            <UserPlus size={32} />
                        </div>
                        <h3 className="text-xl font-black text-white italic mb-2">移除選手</h3>
                        <p className="text-zinc-400 text-sm font-bold mb-6">
                            確定要將 <span className="text-white">{adminRemoveTarget.studentName}</span> 移除嗎？<br/>
                            <span className="text-[10px] text-amber-500 block mt-1 font-bold">(若已扣票，系統將自動退還 1 張票卷)</span>
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setAdminRemoveTarget(null)} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl active:bg-zinc-700 transition-colors">取消</button>
                            <button onClick={confirmAdminRemove} disabled={submitting} className="py-3 bg-rose-600 text-white font-black rounded-xl shadow-glow-rose active:scale-95 transition-all flex items-center justify-center">
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : '確認移除'}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Generic Info/Warning Modal */}
            {infoModal.show && createPortal(
                <div className="fixed inset-0 z-[70000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setInfoModal({...infoModal, show: false})}>
                    <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-white/10 text-center animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${infoModal.type === 'error' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-chiachia-green/10 text-chiachia-green border-chiachia-green/20'}`}>
                            {infoModal.type === 'error' ? <AlertTriangle size={32} /> : <Info size={32} />}
                        </div>
                        <h3 className="text-xl font-black text-white italic mb-2">{infoModal.title}</h3>
                        <p className="text-zinc-400 text-sm font-bold mb-6 whitespace-pre-wrap">{infoModal.message}</p>
                        <button onClick={() => setInfoModal({...infoModal, show: false})} className="w-full py-3 bg-zinc-800 text-white font-bold rounded-xl active:scale-95 transition-all">
                            了解
                        </button>
                    </div>
                </div>
            , document.body)}
        </div>
    );
};

export default Courses;