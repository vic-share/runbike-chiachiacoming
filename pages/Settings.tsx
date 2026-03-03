
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { uploadImage } from '../services/supabase';
import { User, Lock, KeyRound, LogIn, ShieldCheck, Wallet, LayoutGrid, Flag, Activity, X, LogOut, ArrowLeft, Plus, Check, Trash2, Camera, UserCircle2, Edit2, Users, MapPin, DollarSign, AlertTriangle, RotateCcw, CheckCircle2, MessageCircle, Calendar, Loader2, LockKeyhole, RefreshCw, Move, ZoomIn, Bell, BellRing, Radio, Send, Megaphone, Trophy, CalendarCheck, CalendarX, FileText, ToggleLeft, ToggleRight, Clock, ChevronRight, ChevronLeft, Settings as SettingsIcon, HelpCircle, TestTube2, Flame, Layers, Star, Zap, Repeat, Ticket, Play, BellOff, CalendarDays, Ban, CreditCard, ChevronDown, ChevronUp, Banknote, FileBarChart, History, Image as ImageIcon, ScrollText, Layers as InventoryIcon, Tag, BookOpen, Power, Filter, XCircle, Share2, PenTool, TrendingUp, TrendingDown } from 'lucide-react';
import { LookupItem, TicketWallet, CourseTemplate, PushTemplates, ClassSession, TicketPricing, PricingTier, FinancialRecord, FinancialReport } from '../types';
import { format, differenceInYears, parseISO, addYears, endOfMonth, addMonths, startOfMonth, isSameMonth, subDays, addDays, subMonths, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import { SimpleImageCropper } from '../components/SimpleImageCropper';
import { hasPermission, hasRole, PERMISSIONS, ROLES } from '../utils/auth';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const SimpleAreaChart = ({ data, color = "#39e75f", showTickets = false }: any) => {
    if (!data || data.length === 0) return null;
    
    const dataKey = showTickets ? 'tickets' : 'amount';
    const chartColor = showTickets ? '#60a5fa' : color; // Blue for tickets, Green for amount

    return (
        <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis 
                        dataKey="date" 
                        hide={true} 
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                        labelStyle={{ color: '#a1a1aa', fontSize: '10px', marginBottom: '4px' }}
                        formatter={(value: any) => [showTickets ? `${value} tickets` : `$${value}`, showTickets ? 'Sold' : 'Revenue']}
                        labelFormatter={(label) => format(parseISO(label), 'yyyy-MM-dd')}
                    />
                    <Area 
                        type="monotone" 
                        dataKey={dataKey} 
                        stroke={chartColor} 
                        fillOpacity={1} 
                        fill={`url(#color${dataKey})`} 
                        strokeWidth={2}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
import { ManualModal } from '../components/ManualModal';

const FALLBACK_VAPID = "BAcjQfCcruqwU6OicgOJh66UR6125vX_rcsk-G_ddnQYdwI2XJK0jKYNF1IckZdqDfu7DvOOaVUFHd-PigfJ2jw";

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

// ... (Canvas Crop Utility & Helper functions remain same) ...
async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; 
    img.src = imageSrc;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => { if (blob) resolve(blob); }, 'image/jpeg', 0.95);
  });
}

const getRoleStyle = (person: any) => {
    const roles = person.roles || [];
    if (roles.includes(ROLES.DEV)) return { tier: 4, border: 'border-blue-500', shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.5)]', iconColor: 'text-blue-500' };
    if (roles.includes(ROLES.COACH)) return { tier: 3, border: 'border-rose-500', shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.5)]', iconColor: 'text-rose-500' };
    if (roles.includes(ROLES.AIDE)) return { tier: 2, border: 'border-amber-500', shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]', iconColor: 'text-amber-500' };
    return { tier: 1, border: 'border-white/10', shadow: 'shadow-2xl', iconColor: 'text-zinc-500' };
};

const sortRiders = (a: any, b: any) => {
    const aIsRider = a.roles && a.roles.includes(ROLES.RIDER);
    const bIsRider = b.roles && b.roles.includes(ROLES.RIDER);
    if (aIsRider && !bIsRider) return -1;
    if (!aIsRider && bIsRider) return 1;
    return a.name.localeCompare(b.name);
};

const sortPeopleByRole = (a: any, b: any) => {
    const tierA = getRoleStyle(a).tier;
    const tierB = getRoleStyle(b).tier;
    if (tierA !== tierB) return tierA - tierB;
    return a.name.localeCompare(b.name);
};

const Avatar = ({ p, size = 'md', className = '' }: { p: any, size?: 'sm'|'md'|'lg'|'xl'|'2xl', className?: string }) => {
    let sizeClass = 'w-10 h-10';
    if(size === 'sm') sizeClass = 'w-8 h-8';
    if(size === 'lg') sizeClass = 'w-16 h-16';
    if(size === 'xl') sizeClass = 'w-24 h-24';
    if(size === '2xl') sizeClass = 'w-32 h-32';
    const style = getRoleStyle(p);
    const borderClass = className.includes('border-') ? '' : `border-2 ${style.border}`;
    const shadowClass = className.includes('shadow-') ? '' : style.shadow;
    return (
        <div className={`${sizeClass} rounded-full bg-zinc-800 ${borderClass} ${shadowClass} overflow-hidden flex items-center justify-center shrink-0 ${className}`}>
            {p?.s_url ? <img src={p.s_url} className="w-full h-full object-cover"/> : <UserCircle2 size={size === '2xl' ? 64 : (size === 'xl' ? 48 : (size === 'lg'?32:20))} className={style.iconColor}/>}
        </div>
    );
};

const MenuCard = ({ title, icon, onClick, description, variant = 'default', disabled = false, badge }: any) => {
    const isDanger = variant === 'danger';
    let bgClass = 'bg-zinc-900/40 border-white/5 hover:border-white/20';
    let iconClass = 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white';
    let textClass = 'text-white';
    if (isDanger) {
        bgClass = 'bg-rose-500/10 border-rose-500/20 hover:border-rose-500/40';
        iconClass = 'bg-rose-500 text-white';
        textClass = 'text-rose-500';
    }
    if (disabled) {
        bgClass = 'bg-zinc-900/20 border-white/5 opacity-30 cursor-not-allowed';
        iconClass = 'bg-zinc-900 text-zinc-600';
        textClass = 'text-zinc-600';
    }
    return (
        <button 
            onClick={disabled ? () => alert('系統目前關閉中，無法操作此功能') : onClick} 
            className={`glass-card p-4 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden transition-all group border w-full text-left touch-manipulation select-none ${bgClass} ${disabled ? '' : 'cursor-pointer'}`}
        >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors mb-2 shadow-inner pointer-events-none ${iconClass} relative`}>
                {React.cloneElement(icon as any, { size: 20 })}
                {badge > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border border-black shadow-lg animate-pulse">
                        {badge > 9 ? '9+' : badge}
                    </div>
                )}
            </div>
            <div className="w-full min-w-0 pointer-events-none">
                <span className={`text-lg font-black italic block truncate ${textClass}`}>{title}</span>
                {description && <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider truncate block">{description}</span>}
            </div>
            {!isDanger && !disabled && ( <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 pointer-events-none"> <ArrowLeft size={16} className="rotate-180"/> </div> )}
            {disabled && ( <div className="absolute top-3 right-3 text-zinc-600"> <Lock size={16}/> </div> )}
        </button>
    );
};

const TemplateEditor = ({ title, icon, colorClass, data, fieldPrefix, setData, timingNote, onTest, variableType = 'race' }: any) => {
    const titleKey = `${fieldPrefix}_title`;
    const bodyKey = `${fieldPrefix}_body`;
    const insertVar = (variable: string) => {
        const currentBody = data[bodyKey] || '';
        setData({ ...data, [bodyKey]: currentBody + variable });
    };
    const vars = variableType === 'race' 
        ? [ { label: '名稱', val: '{name}' }, { label: '日期', val: '{date}' }, { label: '地點', val: '{location}' }, { label: '系列', val: '{race_group}' } ]
        : variableType === 'data'
        ? [ { label: '選手', val: '{name}' }, { label: '項目', val: '{type}' }, { label: '成績', val: '{score}' } ]
        : [ { label: '課程', val: '{name}' }, { label: '日期', val: '{date}' } ]; 

    return (
        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 space-y-3 relative group">
            <div className="flex justify-between items-start">
                <div className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${colorClass}`}> {icon} {title} </div>
                {timingNote && <div className="text-[8px] text-zinc-600 font-mono bg-black/40 px-1.5 py-0.5 rounded border border-white/5">{timingNote}</div>}
            </div>
            <div className="space-y-3">
                <input type="text" placeholder="標題 (預設為 APP 名稱)" value={data[titleKey] || ''} onChange={e => setData({...data, [titleKey]: e.target.value})} className="w-full h-12 bg-black border border-white/10 rounded-xl px-4 text-white text-base font-bold outline-none focus:border-chiachia-green/30 placeholder:text-zinc-700"/>
                <textarea rows={3} placeholder="內容 (點擊下方按鈕插入變數)" value={data[bodyKey] || ''} onChange={e => setData({...data, [bodyKey]: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-base outline-none focus:border-chiachia-green/30 placeholder:text-zinc-700 leading-relaxed"/>
            </div>
            <div className="flex flex-wrap gap-2">
                {vars.map((v) => ( <button key={v.val} onClick={() => insertVar(v.val)} className="px-3 py-1.5 bg-zinc-800 rounded-lg text-[10px] text-zinc-400 border border-white/5 hover:text-white hover:border-white/20 active:scale-95 transition-all font-bold"> + {v.label} </button> ))}
                <div className="flex-1"></div>
                <button onClick={() => onTest(data[titleKey], data[bodyKey])} className="px-4 py-1.5 bg-zinc-800 rounded-lg text-[10px] font-bold text-chiachia-green border border-chiachia-green/20 hover:bg-chiachia-green/10 active:scale-95 transition-all flex items-center gap-1 ml-auto"> <TestTube2 size={12} /> 測試 </button>
            </div>
        </div>
    );
};

const Header = ({ title, onAdd, onBack, onNotificationClick, notificationCount }: { title: string, onAdd?: () => void, onBack: () => void, onNotificationClick?: () => void, notificationCount?: number }) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} className="w-14 h-14 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 active:bg-zinc-800 active:scale-95 transition-all cursor-pointer z-50 touch-manipulation border border-white/5"> <ArrowLeft size={24}/> </button>
          <h2 className="text-2xl font-black text-white italic">{title}</h2>
          {onNotificationClick && (
              <button onClick={onNotificationClick} className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center relative">
                  <BellRing size={20} />
                  {notificationCount && notificationCount > 0 ? (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border border-black shadow-lg animate-pulse">
                          {notificationCount > 9 ? '9+' : notificationCount}
                      </div>
                  ) : null}
              </button>
          )}
        </div>
        {onAdd && ( <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(); }} className="w-14 h-14 rounded-full bg-chiachia-green flex items-center justify-center text-black shadow-glow-green active:scale-90 transition-transform"> <Plus size={24} strokeWidth={3} /> </button> )}
    </div>
);

const Settings: React.FC<any> = ({ people, refreshData, trainingTypes, raceGroups, onLoginSuccess, initialView }) => {
  const [user, setUser] = useState(api.getUser());
  const [reportDateRange, setReportDateRange] = useState<'1W' | '1M' | '3M' | 'ALL' | 'CUSTOM'>('1M');
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [customDateStart, setCustomDateStart] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [customDateEnd, setCustomDateEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // ... (State definitions remain same) ...
  const [adminView, setAdminView] = useState<'menu' | 'players' | 'tickets' | 'courses' | 'training' | 'series' | 'push_system' | 'course_ticket'>('menu');
  const [ticketView, setTicketView] = useState<'menu' | 'inventory' | 'pricing' | 'history' | 'report'>('menu');
  const [pushView, setPushView] = useState<'menu' | 'announcement' | 'race_automation' | 'data_automation' | 'course_automation' | 'share_config'>('menu');
  const [courseCategory, setCourseCategory] = useState<'ROUTINE' | 'GROUP' | 'SPECIAL' | null>(null);
  const [courseSystemEnabled, setCourseSystemEnabled] = useState(true);
  const [step, setStep] = useState<'selectPerson' | 'password'>('selectPerson');
  const [selectedPerson, setSelectedPerson] = useState<LookupItem | null>(null);
  
  const targetList = useMemo(() => {
    return people.filter((p: any) => !p.is_hidden).sort(sortPeopleByRole);
  }, [people]);

  const [loginPass, setLoginPass] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [wallets, setWallets] = useState<TicketWallet[]>([]);
  const myWallet = user ? wallets.find(w => String(w.people_id) === String(user.id)) : undefined;
  const [ticketRequests, setTicketRequests] = useState<any[]>([]);
  const [expandedWalletId, setExpandedWalletId] = useState<string|number|null>(null);
  const [editingBatch, setEditingBatch] = useState<any>(null);
  const [ticketPrices, setTicketPrices] = useState<TicketPricing>({ regular_price: 400, racing_price: 700, group_practice_price: 150, special_tiers: [] });
  const [newTier, setNewTier] = useState<PricingTier>({ headcount: 1, price: 0 });
  const [templates, setTemplates] = useState<CourseTemplate[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [pushTemplates, setPushTemplates] = useState<PushTemplates>({
      is_enabled: true,
      new_race_title: '', new_race_body: '',
      reminder_day_before_title: '', reminder_day_before_body: '',
      reminder_day_start_title: '', reminder_day_start_body: '',
      reminder_day_end_title: '', reminder_day_end_body: '',
      new_record_title: '', new_record_body: '',
      course_open_title: '', course_open_body: '',
      course_cancelled_title: '', course_cancelled_body: '',
      course_confirm_needed_title: '', course_confirm_needed_body: '',
      share_footer_text: '',
      share_footer_text_course: '',
      share_footer_text_race: ''
  });
  const [isSavingTemplates, setIsSavingTemplates] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); 
  const [formData, setFormData] = useState<any>({});
  const [isTemplateMode, setIsTemplateMode] = useState(true); 
  const [isEditMode, setIsEditMode] = useState(false); 
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [createSuccess, setCreateSuccess] = useState(false); 
  const [resetStatus, setResetStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploading, setUploading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [pushMessage, setPushMessage] = useState({ title: '', body: '', url: '/' });
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropAspect, setCropAspect] = useState(1);
  const [uploadTarget, setUploadTarget] = useState<'s' | 'b' | null>(null);
  const [confirmModal, setConfirmModal] = useState<{show: boolean, title: string, message: string, onConfirm: () => void} | null>(null);
  const [successModal, setSuccessModal] = useState<{show: boolean, title: string, message: string} | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [financialReport, setFinancialReport] = useState<FinancialReport | null>(null);
  const [financialHistory, setFinancialHistory] = useState<FinancialRecord[]>([]);
  const [expandedRecord, setExpandedRecord] = useState<number | null>(null);
  const [selectedHistoryPerson, setSelectedHistoryPerson] = useState<LookupItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'TRANSFER' | 'LINEPAY'>('TRANSFER');
  const [bankAccount, setBankAccount] = useState({ bank_code: '', account_number: '' });
  
  // Update History Filter State for Range Support
  const [historyFilter, setHistoryFilter] = useState<{type: string, period: string}>({ type: 'ALL', period: '1M' });
  const [historyDateRange, setHistoryDateRange] = useState<'1W' | '1M' | '3M' | 'ALL' | 'PICK'>('1M');
  const [historyCustomRange, setHistoryCustomRange] = useState<{start: string, end: string}>({
      start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
      end: format(addMonths(new Date(), 1), 'yyyy-MM-dd')
  });
  const [isHistoryDateMenuOpen, setIsHistoryDateMenuOpen] = useState(false);
  
  // New States for Reject Logic
  const [rejectModal, setRejectModal] = useState<{show: boolean, req?: any}>({ show: false });
  const [rejectReason, setRejectReason] = useState('');

  // Handle Initial Deep Link View
  useEffect(() => {
      if (user && initialView) {
          if (initialView === 'coach_requests' && hasPermission(user, PERMISSIONS.TICKET_MANAGE)) {
              setAdminView('tickets');
              setTicketView('inventory');
          } else if (initialView === 'rider_history') {
              if (hasPermission(user, PERMISSIONS.TICKET_MANAGE)) {
                  // If coach clicks rider history link, maybe go to inventory too? Or nothing.
                  // Default to inventory for coach
                  setAdminView('tickets');
                  setTicketView('inventory');
              } else {
                  // Rider: Show history modal
                  setSelectedHistoryPerson(user);
                  loadFinancialHistory(user.id);
                  setModalType('history');
                  setShowModal(true);
              }
          }
      }
  }, [user, initialView]);

  useEffect(() => { window.scrollTo(0, 0); }, [step, adminView, pushView, ticketView, courseCategory]);

  useEffect(() => {
      if(user) {
          loadWallets();
          if(hasPermission(user, PERMISSIONS.TICKET_MANAGE)) loadTicketRequests();
          if((adminView === 'tickets' || adminView === 'course_ticket') && hasPermission(user, PERMISSIONS.TICKET_VIEW_ALL)) { loadTicketPrices(); loadFinancialReport(); loadCourseSystemStatus(); loadBankAccount(); }
          if((adminView === 'courses' || adminView === 'course_ticket') && hasPermission(user, PERMISSIONS.COURSE_VIEW_ALL)) { loadTemplates(); loadSessions(); loadCourseSystemStatus(); loadTicketPrices(); }
          if(adminView === 'push_system' && hasPermission(user, PERMISSIONS.PUSH_MANAGE)) loadPushTemplates();
      }
  }, [adminView, user, ticketView]);

  useEffect(() => { if (modalType === 'settings_menu' && showModal) { if ('Notification' in window) setPushPermission(Notification.permission); } }, [modalType, showModal]);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (step === 'password' && passwordInputRef.current) { passwordInputRef.current.focus(); } }, [step]);

  const loadWallets = async () => setWallets(await api.fetchWallets());
  const loadTicketRequests = async () => setTicketRequests(await api.fetchTicketRequests());
  const loadTemplates = async () => setTemplates(await api.fetchCourseTemplates());
  const loadSessions = async () => {
      // Fetch a wider range for management view (e.g., 3 months back to 6 months forward)
      const start = format(subMonths(new Date(), 3), 'yyyy-MM-dd');
      const end = format(addMonths(new Date(), 6), 'yyyy-MM-dd');
      setSessions(await api.fetchWeeklyCourses(start, end));
  };
  const loadCourseSystemStatus = async () => { const status = await api.fetchCourseSystemStatus(); setCourseSystemEnabled(status.enabled); };
  const loadTicketPrices = async () => setTicketPrices(await api.fetchTicketPricing());
  const loadFinancialReport = async (range?: string, year?: number) => { 
      let query = range || reportDateRange;
      if (query === 'CUSTOM') {
          query = `CUSTOM:${customDateStart}:${customDateEnd}`;
      }
      const report = await api.fetchFinancialReport(query, year || reportYear); 
      setFinancialReport(report); 
  };
  const loadFinancialHistory = async (pid?: string|number) => {
    const history = await api.fetchFinancialHistory(pid);
    const filteredData = history.filter(record => {
        const recordDate = new Date(record.created_at);
        const period = historyFilter.period;
        let isInPeriod = false;
        if (period === '1W') {
            isInPeriod = recordDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        } else if (period === '1M') {
            isInPeriod = recordDate > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        } else if (period === '3M') {
            isInPeriod = recordDate > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        } else if (period === 'CUSTOM') {
            const start = startOfDay(new Date(historyCustomRange.start));
            const end = endOfDay(new Date(historyCustomRange.end));
            if(isValid(start) && isValid(end)) {
              isInPeriod = isWithinInterval(recordDate, { start, end });
            }
        }
                if (period === 'ALL') {
            isInPeriod = true;
        }

        const type = historyFilter.type;
        let isTypeMatch = false;
        if (type === 'ALL') {
            isTypeMatch = true;
        } else {
            isTypeMatch = record.transaction_type === type;
        }

        return isInPeriod && isTypeMatch;
    });
    setFinancialHistory(filteredData);
  };
  const loadBankAccount = async () => { const account = await api.fetchBankAccount(); if(account) setBankAccount(account); };
  const handleSaveBankAccount = async () => { setIsSubmitting(true); try { await api.saveBankAccount(bankAccount); setFeedbackMsg('收款帳號已更新'); setTimeout(() => setFeedbackMsg(null), 2000); setShowModal(false); } catch (e) { alert('儲存失敗'); } finally { setIsSubmitting(false); } };
  
  useEffect(() => {
      if (adminView === 'tickets' && ticketView === 'report') {
          // If it's not custom, or if it IS custom but we want to ensure it loads on view enter
          // Actually, if it's CUSTOM, we usually wait for the user to click "Check"
          // but if they just switched TO a preset, we should load it.
          if (reportDateRange !== 'CUSTOM') {
              loadFinancialReport(reportDateRange, reportYear);
          }
      }
  }, [reportDateRange, adminView, ticketView, reportYear]);

  useEffect(() => {
    if (modalType === 'history' && user) {
      loadFinancialHistory(user.id);
    }
  }, [historyFilter, modalType, user]);

  useEffect(() => {
    if (modalType === 'my_tickets') {
      loadWallets();
    }
  }, [modalType]);

  const loadPushTemplates = async () => {
      const t = await api.fetchPushTemplates();
      setPushTemplates({
          is_enabled: t.is_enabled !== false,
          new_race_title: t.new_race_title || "🏆 新增賽事公告",
          new_race_body: t.new_race_body || "新增賽事：{name}，日期 {date}",
          reminder_day_before_title: t.reminder_day_before_title || "📅 賽事提醒 (明天)",
          reminder_day_before_body: t.reminder_day_before_body || "明天有比賽：{name}，請準時出席！",
          reminder_day_start_title: t.reminder_day_start_title || "🌞 賽事提醒 (今天)",
          reminder_day_start_body: t.reminder_day_start_body || "今天就是 {name} 比賽日，加油！",
          reminder_day_end_title: t.reminder_day_end_title || "🏁 賽事結束",
          reminder_day_end_body: t.reminder_day_end_body || "{name} 圓滿結束，快去更新成績吧！",
          new_record_title: t.new_record_title || "⚡️ 破紀錄通知",
          new_record_body: t.new_record_body || "賀！今日有 {count} 位選手創下新紀錄！",
          course_open_title: t.course_open_title || "✅ 確認開課通知",
          course_open_body: t.course_open_body || "課程 {name} 已確認開課，請準時出席！",
          course_cancelled_title: t.course_cancelled_title || "🚫 停課通知",
          course_cancelled_body: t.course_cancelled_body || "課程 {name} 已取消，請確認行程。",
          course_confirm_needed_title: t.course_confirm_needed_title || "⚠️ 開課確認提醒",
          course_confirm_needed_body: t.course_confirm_needed_body || "今日課程 {name} 報名即將截止，請確認是否開課。",
          share_footer_text: t.share_footer_text || "請準時出席，若無法出席請提前請假。",
          share_footer_text_course: t.share_footer_text_course || t.share_footer_text || "請準時出席，若無法出席請提前請假。",
          share_footer_text_race: t.share_footer_text_race || t.share_footer_text || "請準時出席，若無法出席請提前請假。"
      });
  };

  const handlePushSubscribe = async () => {
      if (!user) return;
      setIsSubmitting(true);
      try {
          if (!('serviceWorker' in navigator)) throw new Error("瀏覽器不支援推播通知");

          let result = Notification.permission;
          if (result === 'default') {
              result = await Notification.requestPermission();
          }
          
          if (result !== 'granted') {
              alert("通知權限被拒絕，請至瀏覽器設定開啟。");
              setPushPermission(result);
              setIsSubmitting(false);
              return;
          }
          
          setPushPermission(result);

          const registration = await navigator.serviceWorker.ready;
          
          // Get Key
          const w = window as any;
          const meta = import.meta as any;
          const keyStr = w.ENV?.VAPID_PUBLIC_KEY || meta.env?.VITE_VAPID_PUBLIC_KEY || FALLBACK_VAPID;
          const convertedKey = urlBase64ToUint8Array(String(keyStr).replace(/[\s"']/g, '').trim());
          
          if (!convertedKey) throw new Error("VAPID Key Invalid");

          // Force refresh subscription
          const oldSub = await registration.pushManager.getSubscription();
          if (oldSub) await oldSub.unsubscribe();

          const newSub = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedKey
          });

          const payload = {
              ...JSON.parse(JSON.stringify(newSub)),
              people_id: user.id
          };

          const WORKER_URL = 'https://runbike-chiachiacoming.sky070680.workers.dev/api'; 

          const res = await fetch(`${WORKER_URL}/subscribe`, {
              method: 'POST',
              body: JSON.stringify(payload),
              headers: { 'Content-Type': 'application/json' }
          });
          
          if (!res.ok) throw new Error("伺服器同步失敗");

          alert("訂閱成功！");
      } catch (e: any) {
          console.error(e);
          alert(`訂閱失敗: ${e.message}`);
      } finally {
          setIsSubmitting(false);
      }
  };

  const handlePushUnsubscribe = async () => {
      setIsSubmitting(true);
      try {
          const registration = await navigator.serviceWorker.ready;
          const sub = await registration.pushManager.getSubscription();
          if (sub) {
              const meta = import.meta as any; 
              const WORKER_URL = 'https://runbike-chiachiacoming.sky070680.workers.dev/api'; 

              await fetch(`${WORKER_URL}/unsubscribe`, {
                  method: 'POST',
                  body: JSON.stringify(sub),
                  headers: { 'Content-Type': 'application/json' }
              }).catch(console.error);
              
              await sub.unsubscribe();
          }
          alert("已停用本機通知");
      } catch (e) {
          alert("取消失敗");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleSaveTicketPrices = async () => { setIsSubmitting(true); try { await api.saveTicketPricing(ticketPrices); await loadTicketPrices(); if (ticketView === 'pricing') { setFeedbackMsg('價格已更新'); setTimeout(() => setFeedbackMsg(null), 2000); } else { setShowModal(false); } } catch (e) { alert('儲存失敗'); } finally { setIsSubmitting(false); } };
  const handleAddTier = () => { if (newTier.headcount > 0 && newTier.price > 0) { setTicketPrices(prev => ({ ...prev, special_tiers: [...(prev.special_tiers || []), newTier].sort((a, b) => a.headcount - b.headcount) })); setNewTier({ headcount: (newTier.headcount + 1), price: 0 }); } };
  const handleDeleteTier = (index: number) => { setTicketPrices(prev => { const next = [...(prev.special_tiers || [])]; next.splice(index, 1); return { ...prev, special_tiers: next }; }); };
  const handleToggleCourseSystem = async () => { const newState = !courseSystemEnabled; setCourseSystemEnabled(newState); await api.toggleCourseSystem(newState); if(refreshData) await refreshData(); };
  const handleSavePushTemplates = async () => { setIsSavingTemplates(true); try { await api.savePushTemplates(pushTemplates); alert('文案已儲存'); } catch (e) { alert('儲存失敗'); } finally { setIsSavingTemplates(false); } };
  
  const handleTestBroadcast = async (titleTemplate: string, bodyTemplate: string) => { 
      if (!titleTemplate || !bodyTemplate) { alert("請先輸入標題與內容"); return; } 
      setIsSubmitting(true); 
      const dummyData: Record<string, string> = { '{name}': '測試大獎賽', '{date}': '2025-12-31', '{location}': '台北體育館', '{race_group}': 'S1 積分賽', '{type}': '直線衝刺', '{score}': '8.888', '{count}': '5' }; 
      let finalTitle = `[測試] ${titleTemplate}`; 
      let finalBody = bodyTemplate; 
      Object.entries(dummyData).forEach(([key, val]) => { finalTitle = finalTitle.split(key).join(val); finalBody = finalBody.split(key).join(val); }); 
      // @ts-ignore
      const meta = import.meta as any; 
      // @ts-ignore
      const WORKER_URL = 'https://runbike-chiachiacoming.sky070680.workers.dev/api'; 
      try { 
          await fetch(`${WORKER_URL}/admin/push`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('CHIACHIA_TOKEN')}` }, body: JSON.stringify({ title: finalTitle, body: finalBody, url: '/races', target_role: 'COACH' }) }); 
          alert(`測試發送成功 (發送給教練群)`); 
      } catch (e: any) { alert('連線錯誤'); } finally { setIsSubmitting(false); } 
  };
  
  const handleSendBroadcast = async () => { if (!pushMessage.body) return; setIsSubmitting(true); const meta = import.meta as any; const WORKER_URL = 'https://runbike-chiachiacoming.sky070680.workers.dev/api'; try { await fetch(`${WORKER_URL}/admin/push`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('CHIACHIA_TOKEN')}` }, body: JSON.stringify({ title: pushMessage.title || '', body: pushMessage.body, url: pushMessage.url, target_role: 'all' }) }); alert(`成功發送`); setPushMessage({ title: '', body: '', url: '/' }); } catch (e) { alert('發送失敗'); } finally { setIsSubmitting(false); } };
  const handleSelectPerson = (person: LookupItem) => { setSelectedPerson(person); setStep('password'); setErrorMsg(''); setLoginPass(''); };
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [adminView, ticketView, courseCategory]);

  const handleLogin = async () => { 
      if (!selectedPerson) return; 
      setIsLoggingIn(true); 
      setErrorMsg(''); 
      try { 
          const res = await api.login(String(selectedPerson.id), loginPass.trim()); 
          if (res.success) { 
              setUser(res.user); 
              
              // Check for notifications permission
              if ('Notification' in window && Notification.permission !== 'granted') {
                  setModalType('settings_menu');
                  setShowModal(true);
                  // Don't call onLoginSuccess yet, user sees modal first
              } else {
                  if (onLoginSuccess) onLoginSuccess(); 
              }
          } else { 
              setErrorMsg(res.msg || "登入失敗"); 
          } 
      } catch (err) { 
          setErrorMsg("系統錯誤"); 
      } 
      setIsLoggingIn(false); 
  };
  
  const handleLogout = () => { setShowLogoutModal(true); };
  const confirmLogout = () => { api.logout(); setUser(null); setStep('selectPerson'); setAdminView('menu'); setShowLogoutModal(false); };
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, typeSuffix: 's' | 'b') => { if (!user) return; const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.addEventListener('load', () => { setCropImageSrc(reader.result?.toString() || null); setUploadTarget(typeSuffix); setCropAspect(typeSuffix === 'b' ? 4 / 5 : 1); setZoom(1); setCrop({ x: 0, y: 0 }); }); reader.readAsDataURL(file); e.target.value = ''; };
  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => { setCroppedAreaPixels(croppedAreaPixels); };
  const handleCropSave = async () => { if (!cropImageSrc || !croppedAreaPixels || !user || !uploadTarget) return; setUploading(true); try { const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels); const file = new File([croppedBlob], `upload_${Date.now()}.jpg`, { type: 'image/jpeg' }); const result = await uploadImage(file, 'people', { personId: user.id, typeSuffix: uploadTarget }); if (result.url) { await api.manageLookup('people', user.name, user.id, false, !!user.is_hidden, { [uploadTarget === 's' ? 's_url' : 'b_url']: result.url }); const newUser = { ...user, [uploadTarget === 's' ? 's_url' : 'b_url']: result.url }; setUser(newUser); localStorage.setItem('CHIACHIA_USER', JSON.stringify(newUser)); await refreshData(); setCropImageSrc(null); } else { alert(result.error); } } catch (e) { alert('上傳失敗'); } finally { setUploading(false); } };
  const handleOpenEditModal = () => { const latestUserData = people.find((p: any) => String(p.id) === String(user?.id)) || user; setFormData({ ...latestUserData, birthday: latestUserData.birthday, myword: latestUserData.myword || latestUserData.bio, full_name: latestUserData.full_name, name: latestUserData.name }); setModalType('parent_edit'); setShowModal(true); };
  const handleUpdateSelf = async () => { if (!user) return; if (modalType === 'change_password' && (passwordError || formData.newPassword !== formData.confirmPassword)) return; setIsSubmitting(true); const newName = formData.name || user.name; const payload: any = {}; if (modalType === 'parent_edit') { payload.birthday = formData.birthday; payload.bio = formData.myword; payload.full_name = formData.full_name; } if (modalType === 'change_password' && formData.newPassword) { payload.password = formData.newPassword; } const res = await api.manageLookup('people', newName, user.id, false, !!user.is_hidden, payload); if (res) { const newUser = { ...user, name: newName, ...(payload.birthday ? { birthday: payload.birthday } : {}), ...(payload.bio ? { myword: payload.bio } : {}), ...(payload.full_name ? { full_name: payload.full_name } : {}) }; setUser(newUser); localStorage.setItem('CHIACHIA_USER', JSON.stringify(newUser)); await refreshData(); setShowModal(false); } setIsSubmitting(false); };
  
  const handleManualCreateSession = (template: CourseTemplate) => { const today = new Date(); const currentDay = today.getDay(); let daysUntil = template.day_of_week - currentDay; if (template.day_of_week === currentDay) daysUntil = 0; else if (daysUntil < 0) daysUntil += 7; const targetDate = new Date(today); targetDate.setDate(today.getDate() + daysUntil); const dateStr = format(targetDate, 'yyyy-MM-dd'); setConfirmModal({ show: true, title: "立即開課", message: `確定要建立 ${template.name} (${dateStr}) 的課程嗎？`, onConfirm: async () => { setIsSubmitting(true); const payload = { template_id: template.id, name: template.name, date: dateStr, start_time: template.start_time, end_time: template.end_time, location: template.location, max_students: template.max_students, ticket_type: template.ticket_type, category: 'ROUTINE' }; const res = await api.createClassSession(payload); if (res) { setFeedbackMsg('開課成功'); await loadSessions(); } else { alert('建立失敗'); } setIsSubmitting(false); setConfirmModal(null); setTimeout(() => setFeedbackMsg(null), 2000); } }); };
  const handleDeleteTemplate = (id: string|number) => { setConfirmModal({ show: true, title: "刪除課程", message: "確定要刪除此課程模板嗎？", onConfirm: async () => { const res = await api.deleteTemplate(id); if(res) await loadTemplates(); setConfirmModal(null); } }); };
  const handleEditTemplate = (t: CourseTemplate) => { setFormData({ id: t.id, name: t.name, day_of_week: t.day_of_week, start_time: t.start_time, end_time: t.end_time, max_students: t.max_students, ticket_type: t.ticket_type, location: t.location, default_student_ids: t.default_student_ids ? (typeof t.default_student_ids === 'string' ? JSON.parse(t.default_student_ids) : t.default_student_ids) : [], category: 'ROUTINE', is_auto_scheduled: t.is_auto_scheduled }); setIsTemplateMode(true); setModalType('template'); setShowModal(true); };
  const handleEditSession = (s: ClassSession) => { setFormData({ id: s.id, name: s.name, date: s.date, start_time: s.start_time, end_time: s.end_time, max_students: s.capacity, ticket_type: s.ticket_type, location: s.location, category: 'SPECIAL', price: s.price }); setIsTemplateMode(false); setModalType('template'); setIsEditMode(true); setShowModal(true); }
  const handleSaveCourse = async () => { if(!formData.name) return; setIsSubmitting(true); let res = false; if (formData.ticket_type === 'GROUP_PRACTICE') { formData.price = 0; } if (formData.category === 'SPECIAL') { const payload = { ...formData, category: 'SPECIAL', ticket_type: formData.ticket_type || 'NONE', max_students: formData.max_students, price: (formData.ticket_type === 'NONE') ? Number(formData.price || 0) : 0 }; res = await (async () => { const r = await api.createClassSession(payload); if (r) await loadSessions(); return r; })(); } else { const payload = { ...formData, category: 'ROUTINE', is_auto_scheduled: true }; res = await api.saveTemplate(payload); if (res) await loadTemplates(); } if(res) { setCreateSuccess(true); setTimeout(() => { setShowModal(false); setCreateSuccess(false); }, 2000); } setIsSubmitting(false); };
  const toggleFixedStudent = (id: number | string) => { setFormData((prev: any) => { const current = prev.default_student_ids || []; if (current.includes(String(id))) { return { ...prev, default_student_ids: current.filter((sid: string) => sid !== String(id)) }; } else { return { ...prev, default_student_ids: [...current, String(id)] }; } }); };
  const handleSaveConfig = async (type: 'training'|'series') => { if(!formData.name) return; setIsSubmitting(true); let res = false; const action = isEditMode ? 'update' : 'create'; const payload = isEditMode ? { id: formData.id, [type === 'training' ? 'type_name' : 'series_name']: formData.name, is_default: formData.is_default } : { [type === 'training' ? 'type_name' : 'series_name']: formData.name, is_default: formData.is_default }; if(type === 'training') res = await api.manageTrainingType(action, payload); if(type === 'series') res = await api.manageRaceSeries(action, payload); if(res) { await refreshData(); setShowModal(false); } setIsSubmitting(false); };
  const handleDeleteConfig = (type: 'training'|'series', id: string|number) => { setConfirmModal({ show: true, title: "確認刪除", message: "確定要刪除此項目嗎？", onConfirm: async () => { let res = false; if(type === 'training') res = await api.manageTrainingType('delete', { id }); if(type === 'series') res = await api.manageRaceSeries('delete', { id }); if(res) { await refreshData(); setShowModal(false); } setConfirmModal(null); } }); };
  const handleAddPerson = async () => { if(!formData.name) return; setIsSubmitting(true); const res = await api.createPerson(formData.name, formData.full_name || formData.name, 'parent', formData.birthday, formData.roles || [ROLES.RIDER]); if(res) { await refreshData(); setShowModal(false); } setIsSubmitting(false); };
  const handleEditPerson = async () => { if(!formData.id || !formData.name) return; setIsSubmitting(true); const res = await api.manageLookup('people', formData.name, formData.id, false, formData.is_hidden, { birthday: formData.birthday, full_name: formData.full_name, roles: formData.roles }); if(res) { if (user && String(formData.id) === String(user.id)) { const newUser = { ...user, name: formData.name, birthday: formData.birthday, full_name: formData.full_name, roles: formData.roles, is_hidden: formData.is_hidden }; setUser(newUser); localStorage.setItem('CHIACHIA_USER', JSON.stringify(newUser)); } await refreshData(); setShowModal(false); } setIsSubmitting(false); };
  
  // Updated: Changed default reset password to 123456
  const handleResetPassword = () => { 
      if(!formData.id || !formData.name) return; 
      setConfirmModal({ 
          show: true, 
          title: "重設密碼", 
          message: `確定要將 ${formData.name} 的密碼重設為 123456 嗎？`, 
          onConfirm: async () => { 
              setIsSubmitting(true); 
              setResetStatus('idle'); 
              const res = await api.manageLookup('people', formData.name, formData.id, false, formData.is_hidden, { password: '123456' }); 
              if(res) { 
                  setResetStatus('success'); 
                  setTimeout(() => setResetStatus('idle'), 3000); 
              } else { 
                  setResetStatus('error'); 
                  setTimeout(() => setResetStatus('idle'), 3000); 
              } 
              setIsSubmitting(false); 
              setConfirmModal(null); 
          } 
      }); 
  };
  
  const handleAddTicket = async () => { if(!formData.people_id || !formData.amount) return; setIsSubmitting(true); const unitPrice = formData.type === 'REGULAR' ? ticketPrices.regular_price : ticketPrices.racing_price; const calculatedCash = unitPrice * Number(formData.amount); const res = await api.addTickets(formData.people_id, formData.type, Number(formData.amount), formData.expiry_date, '教練手動儲值', calculatedCash); if(res) { await loadWallets(); setShowModal(false); } setIsSubmitting(false); };
  const handleRequestPurchase = async () => { 
      const last5 = paymentMethod === 'LINEPAY' ? 'LINEPAY' : formData.last5;
      if(!user || !formData.amount || !last5) return; 
      setIsSubmitting(true); 
      try { 
          const unitPrice = formData.type === 'REGULAR' ? ticketPrices.regular_price : ticketPrices.racing_price; 
          const totalPrice = unitPrice * Number(formData.amount); 
          await api.requestTicketPurchase(user.id, formData.type, Number(formData.amount), last5, totalPrice); 
          if (paymentMethod === 'TRANSFER') localStorage.setItem('CHIACHIA_LAST5', last5); 
          setShowModal(false); 
          setSuccessModal({
              show: true,
              title: '購買請求已送出',
              message: '請等待教練確認您的款項，確認後票卷將自動入帳。'
          });
      } catch (e) { 
          alert('送出失敗，請稍後再試'); 
      } finally { 
          setIsSubmitting(false); 
      } 
  };
  const handleConfirmRequest = (req: any) => {
      setConfirmModal({
          show: true,
          title: "確認入帳",
          message: `確認收到 ${req.person_name} 的匯款 (${req.amount}張 / ${req.last_5_digits === 'LINEPAY' ? 'LINEPAY' : req.last_5_digits})？`,
          onConfirm: async () => {
              setIsSubmitting(true);
              try {
                  const expiry = format(endOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd');
                  await api.addTickets(req.people_id, req.type, req.amount, expiry, '選手儲值', req.total_price);
                  await api.deleteTicketRequest(req.id, undefined, true);
                  await loadWallets();
                  await loadTicketRequests();
                  setConfirmModal(null);
              } catch (e) {
                  alert('處理失敗');
              } finally {
                  setIsSubmitting(false);
              }
          }
      });
  };
  const handleRejectRequest = () => {
      if (!rejectModal.req) return;
      setConfirmModal({
          show: true,
          title: "退回請求",
          message: `確定要退回 ${rejectModal.req.person_name} 的購買請求嗎？`,
          onConfirm: async () => {
              setIsSubmitting(true);
              try {
                  await api.deleteTicketRequest(rejectModal.req.id, rejectReason);
                  await loadTicketRequests();
                  setRejectModal({ show: false });
                  setRejectReason('');
                  setConfirmModal(null);
              } catch (e) {
                  alert('退回失敗');
              } finally {
                  setIsSubmitting(false);
              }
          }
      });
  };
  const handleUpdateBatch = () => {
      if(!editingBatch) return;
      setConfirmModal({
          show: true,
          title: "更新票卷批次",
          message: `確定要更新此票卷批次嗎？`, 
          onConfirm: async () => {
              setIsSubmitting(true);
              try {
                  await api.updateTicketBatch(editingBatch.id, parseInt(editingBatch.amount), editingBatch.expiry_date);
                  await loadWallets();
                  setEditingBatch(null);
                  setConfirmModal(null);
              } catch(e) {
                  alert('更新失敗');
              } finally {
                  setIsSubmitting(false);
              }
          }
      });
  };
  const handleToggleRole = (role: string) => { setFormData((prev: any) => { const currentRoles = prev.roles || []; if (currentRoles.includes(role)) { return { ...prev, roles: currentRoles.filter((r: string) => r !== role) }; } else { return { ...prev, roles: [...currentRoles, role] }; } }); };



  // ... (Keep existing admin sub-views) ...
  // ... (When adminView is 'menu', render cards) ...

  // ... (Keep existing user profile render logic) ...
  if (user) {
      const myWallet = wallets.find(w => String(w.people_id) === String(user.id));
    const renderContent = () => {
        const days = ['週日','週一','週二','週三','週四','週五','週六'];
        if (adminView !== 'menu') {
          // ... (Existing admin views) ...
          if(adminView === 'push_system') {
              // ... (Push system implementation) ...
              if (pushView === 'menu') { return ( <> <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md px-4 pt-4 pb-2 border-b border-white/5"> <Header title="推播系統" onBack={() => setAdminView('menu')} /> </div> <div className="px-4 py-4 pb-28"> <div className="grid grid-cols-2 gap-3"> <MenuCard title="教練公告" icon={<Megaphone/>} onClick={() => setPushView('announcement')} /> <MenuCard title="課程公告" icon={<CalendarDays/>} onClick={() => setPushView('course_automation')} /> <MenuCard title="賽事公告" icon={<Trophy/>} onClick={() => setPushView('race_automation')} /> <MenuCard title="數據公告" icon={<Activity/>} onClick={() => setPushView('data_automation')} /> <MenuCard title="分享設定" icon={<Share2/>} onClick={() => setPushView('share_config')} description="設定分享結尾文字" /> </div> </div> </> ); }
              // ... (Other push views omitted for brevity, but exist in original code) ...
              // [Rest of Push System Code...]
              if (pushView === 'announcement') { return ( <> <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md px-4 pt-4 pb-2 border-b border-white/5"> <Header title="教練公告" onBack={() => setPushView('menu')} /> </div> <div className="px-4 py-4 pb-28 space-y-6"> <div className="glass-card p-6 rounded-3xl space-y-4"> <div className="flex items-center gap-3 mb-2"> <div className="w-10 h-10 rounded-full bg-chiachia-green/10 flex items-center justify-center text-chiachia-green"> <Megaphone size={20} /> </div> <div> <h3 className="text-lg font-black text-white italic">即時推播</h3> <p className="text-[10px] text-zinc-500 font-bold">發送給所有訂閱者</p> </div> </div> <div className="space-y-3"> <div className="space-y-1"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">標題 (留空則隱藏)</label> <input type="text" value={pushMessage.title} onChange={e => setPushMessage({...pushMessage, title: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 text-base" placeholder="標題"/> </div> <div className="space-y-1"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">內容</label> <textarea rows={5} value={pushMessage.body} onChange={e => setPushMessage({...pushMessage, body: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 text-base" placeholder="輸入公告內容..."/> </div> <button onClick={handleSendBroadcast} disabled={isSubmitting || !pushMessage.body} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2"> {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <Send size={18} />} {isSubmitting ? '發送中...' : '發送推播'} </button> </div> </div> </div> </> ); }
              if (pushView === 'course_automation') { return ( <> <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md px-4 pt-4 pb-2 border-b border-white/5"> <Header title="課程公告設定" onBack={() => setPushView('menu')} /> </div> <div className="px-4 py-4 pb-28 space-y-6"> <div className="glass-card p-6 rounded-3xl space-y-6 border border-chiachia-green/20 bg-chiachia-green/5"> <div className="flex items-center justify-between mb-2"> <div className="flex items-center gap-3"> <div className="w-10 h-10 rounded-full bg-chiachia-green/10 flex items-center justify-center text-chiachia-green"><CalendarDays size={20} /></div> <div> <h3 className="text-lg font-black text-white italic">課程自動通知</h3> <p className="text-[10px] text-zinc-500 font-bold">開課、停課與提醒</p> </div> </div> <button onClick={() => setPushTemplates(p => ({ ...p, is_enabled: !p.is_enabled }))} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${pushTemplates.is_enabled ? 'bg-chiachia-green border-chiachia-green text-black' : 'bg-zinc-900 border-white/10 text-zinc-500'}`} > {pushTemplates.is_enabled ? <ToggleRight size={24}/> : <ToggleLeft size={24}/>} <span className="text-[10px] font-black uppercase">{pushTemplates.is_enabled ? 'ON' : 'OFF'}</span> </button> </div> <div className={`space-y-8 transition-opacity ${pushTemplates.is_enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}> <div className="space-y-4"> <TemplateEditor title="確認開課通知" icon={<CheckCircle2 size={12}/>} colorClass="text-chiachia-green" data={pushTemplates} setData={setPushTemplates} fieldPrefix="course_open" timingNote="教練按確認時發送" onTest={handleTestBroadcast} variableType="course" /> <TemplateEditor title="停課通知" icon={<Ban size={12}/>} colorClass="text-chiachia-green" data={pushTemplates} setData={setPushTemplates} fieldPrefix="course_cancelled" timingNote="教練按取消時發送" onTest={handleTestBroadcast} variableType="course" /> <TemplateEditor title="教練確認提醒" icon={<Bell size={12}/>} colorClass="text-chiachia-green" data={pushTemplates} setData={setPushTemplates} fieldPrefix="course_confirm_needed" timingNote="發送給教練 (17:00)" onTest={handleTestBroadcast} variableType="course" /> </div> <div className="pt-4 sticky bottom-0 bg-gradient-to-t from-zinc-950 to-transparent pb-2"> <button onClick={handleSavePushTemplates} disabled={isSavingTemplates} className="w-full py-4 bg-chiachia-green text-black font-black rounded-2xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"> {isSavingTemplates ? <Loader2 size={18} className="animate-spin"/> : <Check size={18} />} {isSavingTemplates ? '儲存中...' : '確認儲存設定'} </button> </div> </div> </div> </div> </> ); }
              if (pushView === 'race_automation') { return ( <> <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md px-4 pt-4 pb-2 border-b border-white/5"> <Header title="賽事公告設定" onBack={() => setPushView('menu')} /> </div> <div className="px-4 py-4 pb-28 space-y-6"> <div className="glass-card p-6 rounded-3xl space-y-6 border border-chiachia-green/20 bg-chiachia-green/5"> <div className="flex items-center justify-between mb-2"> <div className="flex items-center gap-3"> <div className="w-10 h-10 rounded-full bg-chiachia-green/10 flex items-center justify-center text-chiachia-green"><Clock size={20} /></div> <div> <h3 className="text-lg font-black text-white italic">賽事自動通知</h3> <p className="text-[10px] text-zinc-500 font-bold">自動觸發的推播內容</p> </div> </div> <button onClick={() => setPushTemplates(p => ({ ...p, is_enabled: !p.is_enabled }))} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${pushTemplates.is_enabled ? 'bg-chiachia-green border-chiachia-green text-black' : 'bg-zinc-900 border-white/10 text-zinc-500'}`} > {pushTemplates.is_enabled ? <ToggleRight size={24}/> : <ToggleLeft size={24}/>} <span className="text-[10px] font-black uppercase">{pushTemplates.is_enabled ? 'ON' : 'OFF'}</span> </button> </div> <div className={`space-y-8 transition-opacity ${pushTemplates.is_enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}> <div className="space-y-4"> <TemplateEditor title="新增賽事通知" icon={<Plus size={12}/>} colorClass="text-chiachia-green" data={pushTemplates} setData={setPushTemplates} fieldPrefix="new_race" timingNote="即時發送" onTest={handleTestBroadcast} variableType="race" /> <TemplateEditor title="賽前提醒 (前一晚)" icon={<CalendarCheck size={12}/>} colorClass="text-chiachia-green" data={pushTemplates} setData={setPushTemplates} fieldPrefix="reminder_day_before" timingNote="發送時間: 23:00" onTest={handleTestBroadcast} variableType="race" /> <TemplateEditor title="比賽日 (當天開始)" icon={<Flag size={12}/>} colorClass="text-chiachia-green" data={pushTemplates} setData={setPushTemplates} fieldPrefix="reminder_day_start" timingNote="發送時間: 08:00" onTest={handleTestBroadcast} variableType="race" /> <TemplateEditor title="賽事結束 (當天結束)" icon={<CheckCircle2 size={12}/>} colorClass="text-chiachia-green" data={pushTemplates} setData={setPushTemplates} fieldPrefix="reminder_day_end" timingNote="發送時間: 23:00" onTest={handleTestBroadcast} variableType="race" /> </div> <div className="pt-4 sticky bottom-0 bg-gradient-to-t from-zinc-950 to-transparent pb-2"> <button onClick={handleSavePushTemplates} disabled={isSavingTemplates} className="w-full py-4 bg-chiachia-green text-black font-black rounded-2xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"> {isSavingTemplates ? <Loader2 size={18} className="animate-spin"/> : <Check size={18} />} {isSavingTemplates ? '儲存中...' : '確認儲存設定'} </button> </div> </div> </div> </div> </> ); }
              if (pushView === 'data_automation') { return ( <> <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md px-4 pt-4 pb-2 border-b border-white/5"> <Header title="數據公告設定" onBack={() => setPushView('menu')} /> </div> <div className="px-4 py-4 pb-28 space-y-6"> <div className="glass-card p-6 rounded-3xl space-y-6 border border-chiachia-green/20 bg-chiachia-green/5"> <div className="flex items-center justify-between mb-2"> <div className="flex items-center gap-3"> <div className="w-10 h-10 rounded-full bg-chiachia-green/10 flex items-center justify-center text-chiachia-green"><Activity size={20} /></div> <div> <h3 className="text-lg font-black text-white italic">數據自動通知</h3> <p className="text-[10px] text-zinc-500 font-bold">自動觸發的推播內容</p> </div> </div> <button onClick={() => setPushTemplates(p => ({ ...p, is_enabled: !p.is_enabled }))} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${pushTemplates.is_enabled ? 'bg-chiachia-green border-chiachia-green text-black' : 'bg-zinc-900 border-white/10 text-zinc-500'}`} > {pushTemplates.is_enabled ? <ToggleRight size={24}/> : <ToggleLeft size={24}/>} <span className="text-[10px] font-black uppercase">{pushTemplates.is_enabled ? 'ON' : 'OFF'}</span> </button> </div> <div className={`space-y-8 transition-opacity ${pushTemplates.is_enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}> <div className="space-y-4"> <TemplateEditor title="破紀錄通知" icon={<Flame size={12}/>} colorClass="text-chiachia-green" data={pushTemplates} setData={setPushTemplates} fieldPrefix="new_record" timingNote="每日 23:00" onTest={handleTestBroadcast} variableType="data" /> </div> <div className="pt-4 sticky bottom-0 bg-gradient-to-t from-zinc-950 to-transparent pb-2"> <button onClick={handleSavePushTemplates} disabled={isSavingTemplates} className="w-full py-4 bg-chiachia-green text-black font-black rounded-2xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"> {isSavingTemplates ? <Loader2 size={18} className="animate-spin"/> : <Check size={18} />} {isSavingTemplates ? '儲存中...' : '確認儲存設定'} </button> </div> </div> </div> </div> </> ); }
              if (pushView === 'share_config') {
                  return (
                      <>
                          <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md px-4 pt-4 pb-2 border-b border-white/5">
                              <Header title="分享設定" onBack={() => setPushView('menu')} />
                          </div>
                          <div className="px-4 py-4 pb-28 space-y-6">
                              <div className="glass-card p-6 rounded-3xl space-y-6 border border-chiachia-green/20 bg-chiachia-green/5">
                                  
                                  {/* Course Section */}
                                  <div className="space-y-3">
                                      <div className="flex items-center gap-3 mb-2">
                                          <div className="w-8 h-8 rounded-full bg-chiachia-green/10 flex items-center justify-center text-chiachia-green"><CalendarDays size={16} /></div>
                                          <div>
                                              <h3 className="text-sm font-black text-white italic">課程分享結尾</h3>
                                              <p className="text-[10px] text-zinc-500 font-bold">分享課程資訊時的底部文案</p>
                                          </div>
                                      </div>
                                      <textarea 
                                          rows={3} 
                                          value={pushTemplates.share_footer_text_course || ''} 
                                          onChange={e => setPushTemplates({...pushTemplates, share_footer_text_course: e.target.value})} 
                                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-chiachia-green/30 placeholder:text-zinc-700 leading-relaxed"
                                          placeholder="例如：請準時出席，若無法出席請提前請假。"
                                      />
                                  </div>

                                  <div className="h-px bg-white/10 w-full"></div>

                                  {/* Race Section */}
                                  <div className="space-y-3">
                                      <div className="flex items-center gap-3 mb-2">
                                          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500"><Trophy size={16} /></div>
                                          <div>
                                              <h3 className="text-sm font-black text-white italic">賽事分享結尾</h3>
                                              <p className="text-[10px] text-zinc-500 font-bold">分享賽事資訊時的底部文案</p>
                                          </div>
                                      </div>
                                      <textarea 
                                          rows={3} 
                                          value={pushTemplates.share_footer_text_race || ''} 
                                          onChange={e => setPushTemplates({...pushTemplates, share_footer_text_race: e.target.value})} 
                                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-amber-500/30 placeholder:text-zinc-700 leading-relaxed"
                                          placeholder="例如：請穿著隊服，提早 30 分鐘報到。"
                                      />
                                  </div>

                                  <div className="pt-2">
                                      <button onClick={handleSavePushTemplates} disabled={isSavingTemplates} className="w-full py-4 bg-chiachia-green text-black font-black rounded-2xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 text-sm">
                                          {isSavingTemplates ? <Loader2 size={18} className="animate-spin"/> : <Check size={18} />} {isSavingTemplates ? '儲存中...' : '確認儲存設定'}
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </>
                  );
              }
          }
          if(adminView === 'players') { 
              const sortedPeople = people.filter((p: any) => !p.is_hidden && p.roles?.includes(ROLES.RIDER)).sort(sortPeopleByRole); 
              return ( 
                <> 
                    <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md px-4 pt-4 pb-2 border-b border-white/5"> 
                        <Header title="人員管理" onBack={() => setAdminView('menu')} onAdd={() => { setFormData({ roles: [ROLES.RIDER] }); setIsEditMode(false); setModalType('player'); setShowModal(true); }} /> 
                    </div> 
                    <div className="px-4 py-4 pb-28"> 
                        <div className="grid grid-cols-3 gap-3"> 
                            {sortedPeople.map((p: any) => ( 
                                <button key={p.id} onClick={() => { setFormData({...p, is_hidden: !!p.is_hidden }); setIsEditMode(true); setModalType('player'); setShowModal(true); }} className={`glass-card p-3 rounded-2xl flex flex-col items-center gap-2 relative active:scale-95 transition-all ${p.is_hidden ? 'opacity-40 grayscale' : ''}`}> 
                                    <Avatar p={p} size="xl" />
                                    <div className="w-full"> 
                                        <div className={`text-xs font-bold truncate w-full text-center ${p.is_hidden ? 'text-zinc-500' : 'text-white'}`}>{p.full_name || p.name}</div> 
                                        <div className="text-[10px] text-zinc-500 text-center truncate">({p.name})</div> 
                                    </div> 
                                    {!!p.is_hidden && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-zinc-600 shadow-lg"></div>} 
                                </button> 
                            ))} 
                        </div> 
                    </div> 
                </> 
              ); 
          }
          
          if(adminView === 'course_ticket') {
              if (ticketView === 'menu' && !courseCategory) {
                  return (
                      <>
                          <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md px-4 pt-4 pb-2 border-b border-white/5">
                              <Header title="課程票務" onBack={() => setAdminView('menu')} />
                          </div>
                          <div className="px-4 py-4 pb-28 space-y-4">
                              <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${courseSystemEnabled ? 'bg-zinc-900/40 border-white/5' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                  <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${courseSystemEnabled ? 'bg-zinc-800 text-zinc-400' : 'bg-rose-500 text-white'}`}>
                                          {courseSystemEnabled ? <CheckCircle2 size={20}/> : <Lock size={20}/>}
                                      </div>
                                      <div>
                                          <h3 className="text-base font-black text-white italic">系統狀態</h3>
                                          <p className="text-[10px] text-zinc-500 font-bold">{courseSystemEnabled ? '已開啟 (正常運作)' : '已關閉 (暫停操作)'}</p>
                                      </div>
                                  </div>
                                  <button onClick={handleToggleCourseSystem} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${courseSystemEnabled ? 'bg-chiachia-green text-black border-chiachia-green' : 'bg-zinc-800 text-zinc-500 border-white/10'}`}>
                                      {courseSystemEnabled ? <ToggleRight size={24}/> : <ToggleLeft size={24}/>}
                                      <span className="text-[10px] font-black uppercase">{courseSystemEnabled ? 'OPEN' : 'CLOSED'}</span>
                                  </button>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                  <MenuCard title="例行課程" description="自動排課" icon={<Repeat/>} onClick={() => setCourseCategory('ROUTINE')} disabled={!courseSystemEnabled} />
                                  <MenuCard title="專訓課程" description="強化訓練" icon={<Star/>} onClick={() => setCourseCategory('SPECIAL')} disabled={!courseSystemEnabled} />
                                  <MenuCard title="庫存" icon={<InventoryIcon/>} onClick={() => setTicketView('inventory')} description="錢包與儲值" disabled={!courseSystemEnabled} badge={ticketRequests.length} />
                                  <MenuCard title="定價" icon={<Tag/>} onClick={() => setTicketView('pricing')} description="票價與規則" disabled={!courseSystemEnabled} />
                                  <MenuCard title="帳務" icon={<FileBarChart/>} onClick={() => { loadFinancialReport(); setTicketView('report'); }} description="財務報表" disabled={!courseSystemEnabled} />
<MenuCard title="收款帳號" icon={<Banknote/>} onClick={() => { setModalType('bank_account'); setShowModal(true); }} description="設定匯款帳戶" disabled={!courseSystemEnabled} />
                              </div>
                          </div>
                      </>
                  );
              }
          }

          if(adminView === 'tickets' || (adminView === 'course_ticket' && ticketView !== 'menu')) { 
              // ... (Same ticket logic) ...

              // ... (Other ticket views omitted for brevity, logic preserved) ...
              if (ticketView === 'inventory') {
                  const riderWallets = people.filter(p => p.roles && p.roles.includes('RIDER') && !p.roles.includes('DEV')).sort(sortRiders).map(p => {
                      const wallet = wallets.find(w => String(w.people_id) === String(p.id));
                      return wallet || { people_id: p.id, person_name: p.name, regular_balance: 0, racing_balance: 0, batches: [] };
                  });
                  return ( 
                    <> 
                        <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md px-4 pt-4 pb-2 border-b border-white/5"> 
                            <Header title="庫存管理" onBack={() => setTicketView('menu')} onNotificationClick={() => { setAdminView('course_ticket'); setTicketView('inventory'); }} notificationCount={ticketRequests.length} /> 
                        </div> 
                        <div className="px-4 py-4 pb-28 space-y-6"> 
                            {ticketRequests.length > 0 && (
                                <div className="space-y-2 animate-pulse-glow">
                                    <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2">待處理請求</div>
                                    {ticketRequests.map(req => (
                                        <div key={req.id} className="p-4 bg-zinc-900/50 rounded-2xl border border-amber-500/30 flex items-center justify-between shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-xs border border-amber-500/20">REQ</div>
                                                <div>
                                                    <div className="text-sm font-bold text-white">{req.person_name}</div>
                                                    <div className="text-[10px] text-zinc-400 font-mono">
                                                        {req.type === 'REGULAR' ? '一般' : '競速'} × {req.amount} ({req.last_5_digits === 'LINEPAY' ? 'LINEPAY' : `後五碼: ${req.last_5_digits}`})
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => { setRejectModal({ show: true, req }); setRejectReason(''); }} className="w-8 h-8 flex items-center justify-center bg-rose-500/20 text-rose-500 rounded-lg active:scale-95 transition-all border border-rose-500/30">
                                                    <X size={16}/>
                                                </button>
                                                <button onClick={() => handleConfirmRequest(req)} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold active:scale-95 transition-all shadow-glow-gold">
                                                    確認
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="space-y-3"> 
                                {riderWallets.length > 0 ? riderWallets.map(w => {
                                    const isExpanded = expandedWalletId === w.people_id;
                                    const person = people.find((p:any) => String(p.id) === String(w.people_id));
                                    return ( 
                                        <div key={w.people_id} className={`rounded-[28px] overflow-hidden border transition-all ${isExpanded ? 'bg-zinc-900 border-white/10' : 'bg-zinc-950/40 border-white/5 hover:border-white/10'}`}>
                                            <div className="flex gap-4 p-4 pr-5 cursor-pointer" onClick={() => { if(courseSystemEnabled) setExpandedWalletId(isExpanded ? null : w.people_id); }}>
                                                <Avatar p={person} size="xl" />
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <div className="text-lg font-black text-white italic truncate">{w.person_name}</div>
                                                    <div className="flex gap-4 mt-1">
                                                        <div className="flex flex-col"> <span className="text-[9px] text-zinc-500 uppercase font-black">Regular</span> <span className="text-sm font-mono font-black text-blue-400">{w.regular_balance}</span> </div>
                                                        <div className="flex flex-col"> <span className="text-[9px] text-zinc-500 uppercase font-black">Racing</span> <span className="text-sm font-mono font-black text-amber-400">{w.racing_balance}</span> </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end justify-between py-1">
                                                    <button onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        if(courseSystemEnabled) { 
                                                            if (hasPermission(user, PERMISSIONS.TICKET_MANAGE) || hasRole(user, ROLES.DEV)) {
                                                                // Admin: Direct adjustment
                                                                setFormData({ people_id: w.people_id, type: 'REGULAR', amount: 1, expiry_date: format(endOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd') });
                                                                setModalType('manual_ticket');
                                                                setShowModal(true);
                                                            } else {
                                                                // User: Purchase request
                                                                setFormData({ people_id: w.people_id, type: 'REGULAR', amount: 4, expiry_date: format(endOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd') }); 
                                                                setModalType('ticket'); 
                                                                setShowModal(true); 
                                                            }
                                                        } 
                                                    }} className={`w-10 h-10 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors active:scale-95 border border-white/5 ${!courseSystemEnabled ? 'cursor-not-allowed opacity-50' : ''}`}> <Plus size={18}/> </button>
                                                    <div className="text-zinc-600"> {isExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>} </div>
                                                </div>
                                            </div>
                                            {isExpanded && (
                                                <div className="border-t border-white/5 bg-black/20 p-4 space-y-2">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Ticket Batches</div>
                                                        <button onClick={() => { setSelectedHistoryPerson(person || null); loadFinancialHistory(w.people_id); setModalType('history'); setShowModal(true); }} className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-white"> <History size={12} /> 查看紀錄 </button>
                                                    </div>
                                                    {w.batches && w.batches.length > 0 ? w.batches.map((b, idx) => (
                                                        <div key={idx} className={`flex justify-between items-center text-xs px-3 py-2 rounded-xl border ${b.type === 'REGULAR' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>
                                                            <div className="flex items-center gap-2"> <Ticket size={12}/> <span className="font-bold">{b.type === 'REGULAR' ? '一般卷' : '競速卷'} × {b.amount}</span> </div>
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex items-center gap-1 font-mono opacity-80"> <Clock size={10}/> <span>{b.expiry_date}</span> </div>
                                                                <button onClick={(e) => { e.stopPropagation(); setEditingBatch({ ...b }); }} className="p-1 rounded bg-black/20 hover:bg-white/10 active:scale-90 transition-all text-white/50 hover:text-white"> <Edit2 size={10}/> </button>
                                                            </div>
                                                        </div>
                                                    )) : <div className="text-center text-[10px] text-zinc-500 py-2">無有效票卷</div>}
                                                </div>
                                            )}
                                        </div> 
                                    );
                                }) : ( <div className="py-10 text-center text-zinc-500 text-xs font-black tracking-widest uppercase">載入票卷資料中...</div> )} 
                            </div> 
                        </div> 
                    </> 
                  ); 
              }
              if (ticketView === 'pricing') {
                return (
                  <>
                    <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md px-4 pt-4 pb-2 border-b border-white/5">
                       <Header title="定價設定" onBack={() => setTicketView('menu')} />
                    </div>
                    <div className="px-4 py-4 pb-28">
                       <div className="glass-card w-full rounded-3xl p-6 border-white/10 flex flex-col gap-4">
                           <div className="space-y-4">
                               <div className="space-y-1">
                                   <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">一般課程 (每張)</label>
                                   <div className="relative"> <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" /> <input type="number" value={ticketPrices.regular_price} onChange={e => setTicketPrices({...ticketPrices, regular_price: Number(e.target.value)})} className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white font-bold outline-none focus:border-chiachia-green/50"/> </div>
                               </div>
                               <div className="space-y-1">
                                   <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">競速課程 (每張)</label>
                                   <div className="relative"> <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" /> <input type="number" value={ticketPrices.racing_price} onChange={e => setTicketPrices({...ticketPrices, racing_price: Number(e.target.value)})} className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white font-bold outline-none focus:border-chiachia-green/50"/> </div>
                               </div>
                               <div className="space-y-1">
                                   <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">團練單次 (每人)</label>
                                   <div className="relative"> <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" /> <input type="number" value={ticketPrices.group_practice_price || 0} onChange={e => setTicketPrices({...ticketPrices, group_practice_price: Number(e.target.value)})} className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white font-bold outline-none focus:border-chiachia-green/50"/> </div>
                               </div>
                               <div className="pt-2 border-t border-white/5">
                                   <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">特殊課程人頭計費規則</div>
                                   <div className="space-y-2">
                                       {ticketPrices.special_tiers?.map((tier, idx) => (
                                           <div key={idx} className="flex gap-2 items-center">
                                               <input 
                                                   type="number" 
                                                   value={tier.headcount} 
                                                   onChange={(e) => {
                                                       const newTiers = [...ticketPrices.special_tiers];
                                                       newTiers[idx].headcount = Number(e.target.value);
                                                       setTicketPrices({...ticketPrices, special_tiers: newTiers});
                                                   }}
                                                   className="w-16 bg-zinc-900 border border-white/10 rounded-lg px-2 py-2 text-white text-xs font-bold outline-none text-center"
                                               />
                                               <span className="text-xs text-zinc-500 font-bold">人以上</span>
                                               <input 
                                                   type="number" 
                                                   value={tier.price} 
                                                   onChange={(e) => {
                                                       const newTiers = [...ticketPrices.special_tiers];
                                                       newTiers[idx].price = Number(e.target.value);
                                                       setTicketPrices({...ticketPrices, special_tiers: newTiers});
                                                   }}
                                                   className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-2 py-2 text-white text-xs font-bold outline-none"
                                               />
                                               <button onClick={() => handleDeleteTier(idx)} className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-500 hover:text-rose-500 flex items-center justify-center"><Trash2 size={14}/></button>
                                           </div>
                                       ))}
                                       <div className="flex gap-2 items-center mt-2 pt-2 border-t border-white/5">
                                           <input type="number" placeholder="人數" value={newTier.headcount} onChange={e => setNewTier({...newTier, headcount: Number(e.target.value)})} className="w-20 bg-zinc-900 border border-white/10 rounded-lg px-2 py-2 text-white text-xs font-bold outline-none"/>
                                           <input type="number" placeholder="價格" value={newTier.price} onChange={e => setNewTier({...newTier, price: Number(e.target.value)})} className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-2 py-2 text-white text-xs font-bold outline-none"/>
                                           <button onClick={handleAddTier} className="w-8 h-8 rounded-lg bg-chiachia-green text-black flex items-center justify-center shadow-glow-green"><Plus size={16}/></button>
                                       </div>
                                   </div>
                               </div>
                           </div>
                           <button onClick={handleSaveTicketPrices} disabled={isSubmitting} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"> {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <Check size={18}/>} 儲存設定 </button>
                       </div>
                    </div>
                  </>
                );
              }
              if (ticketView === 'report') {
                 // Mock chart data if not available
                 const chartData = financialReport?.daily_stats || [];
                 
                 return (
                     <>
                         <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md px-4 pt-4 pb-2 border-b border-white/5"> <Header title="財務報表" onBack={() => setTicketView('menu')} /> </div>
                         <div className="px-4 py-4 pb-28 space-y-4">
                             {financialReport && (
                                 <>
                                     {/* Date Filter - Moved to Top */}
                                     <div className="flex flex-col items-end gap-2 mb-2">
                                         <div className="flex bg-zinc-900 rounded-lg p-1 border border-white/5 shadow-lg">
                                             {(['1W', '1M', '3M', 'ALL', 'CUSTOM'] as const).map(range => (
                                                 <button 
                                                     key={range}
                                                     onClick={() => {
                                                         setReportDateRange(range);
                                                         if (range !== 'CUSTOM') {
                                                             loadFinancialReport(range);
                                                         }
                                                     }}
                                                     className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${reportDateRange === range ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                 >
                                                     {range}
                                                 </button>
                                             ))}
                                         </div>
                                         {reportDateRange === 'CUSTOM' && (
                                             <div className="flex gap-2 bg-zinc-900 p-2 rounded-xl border border-white/5 shadow-lg animate-fade-in">
                                                 <input type="date" value={customDateStart} onChange={e => setCustomDateStart(e.target.value)} className="bg-zinc-950 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none focus:border-chiachia-green/50 min-w-0"/>
                                                 <span className="text-zinc-500 self-center">-</span>
                                                 <input type="date" value={customDateEnd} onChange={e => setCustomDateEnd(e.target.value)} className="bg-zinc-950 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none focus:border-chiachia-green/50 min-w-0"/>
                                                 <button onClick={() => loadFinancialReport(`CUSTOM:${customDateStart}:${customDateEnd}`)} className="bg-chiachia-green text-black px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-glow-green hover:scale-105 transition-transform"><Check size={14}/></button>
                                             </div>
                                         )}
                                     </div>

                                     <div className="grid grid-cols-2 gap-4">
                                         <div className="glass-card p-5 rounded-3xl col-span-2 border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.3)]"> 
                                            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Banknote size={12} className="text-chiachia-green"/> Total Revenue</div> 
                                            <div className="text-4xl font-black text-white font-mono tracking-tight">${financialReport.total_revenue.toLocaleString()}</div> 
                                         </div>
                                         <div className="glass-card p-5 rounded-3xl border border-white/10"> 
                                            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Sold</div> 
                                            <div className="text-2xl font-black text-blue-400 font-mono">{financialReport.tickets_sold} <span className="text-[10px] text-zinc-600">tickets</span></div> 
                                         </div>
                                         <div className="glass-card p-5 rounded-3xl border border-white/10"> 
                                            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Used</div> 
                                            <div className="text-2xl font-black text-rose-400 font-mono">{financialReport.tickets_used} <span className="text-[10px] text-zinc-600">tickets</span></div> 
                                         </div>
                                     </div>
                                     
                                     {/* Financial Chart */}
                                     {chartData.length > 0 ? (
                                         <div className="glass-card p-5 rounded-3xl border border-white/10 mt-2">
                                             <div className="flex justify-between items-center mb-6">
                                                 <div className="flex items-center gap-2">
                                                    <div className="w-1 h-4 bg-chiachia-green rounded-full"></div>
                                                    <div className="text-xs font-black text-white uppercase tracking-widest">Revenue Trend</div>
                                                 </div>
                                             </div>
                                             <div className="flex flex-col gap-8">
                                                 <div className="h-40 w-full">
                                                     <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 pl-1">Revenue History</div>
                                                     <SimpleAreaChart data={chartData} />
                                                 </div>
                                                 <div className="h-40 w-full border-t border-white/5 pt-6">
                                                     <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 pl-1">Ticket Sales</div>
                                                     <SimpleAreaChart data={chartData} showTickets={true} />
                                                 </div>
                                             </div>
                                         </div>
                                     ) : (
                                         <div className="p-12 text-center text-zinc-500 text-xs font-black uppercase tracking-widest border border-dashed border-white/10 rounded-3xl bg-zinc-900/20">
                                             No Chart Data Available
                                         </div>
                                     )}

                                      {/* Monthly Overview (Last 12 Months) */}
                                      <div className="glass-card p-5 rounded-3xl border border-white/10 mt-6 shadow-xl">
                                          <div className="flex items-center justify-between mb-6">
                                              <div className="flex items-center gap-2">
                                                  <div className="w-1 h-4 bg-blue-400 rounded-full"></div>
                                                  <div className="text-xs font-black text-white uppercase tracking-widest">Annual Overview</div>
                                              </div>
                                              <div className="flex items-center gap-2 bg-zinc-900 px-2 py-1 rounded-md border border-white/5">
                                                  <button onClick={() => setReportYear(y => y - 1)} className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><ChevronLeft size={14}/></button>
                                                  <span className="text-[10px] font-bold text-white font-mono min-w-[30px] text-center">{reportYear}</span>
                                                  <button onClick={() => setReportYear(y => y + 1)} className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><ChevronRight size={14}/></button>
                                              </div>
                                          </div>
                                          
                                          {financialReport.monthly_stats && financialReport.monthly_stats.length > 0 ? (
                                              <>
                                                  <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-950/50">
                                                      <table className="w-full text-left border-collapse">
                                                          <thead>
                                                              <tr className="bg-zinc-900/80 border-b border-white/10">
                                                                  <th className="p-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Month</th>
                                                                  <th className="p-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Revenue</th>
                                                                  <th className="p-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Sold</th>
                                                              </tr>
                                                          </thead>
                                                          <tbody className="divide-y divide-white/5">
                                                              {financialReport.monthly_stats.map((stat: any) => (
                                                                  <tr key={stat.month} className="hover:bg-white/5 transition-colors">
                                                                      <td className="p-3">
                                                                          <div className="flex items-center gap-2">
                                                                              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex flex-col items-center justify-center border border-white/5">
                                                                                  <span className="text-[8px] font-black text-zinc-500 uppercase leading-none">{format(parseISO(stat.month + '-01'), 'MMM')}</span>
                                                                                  <span className="text-[10px] font-black text-white leading-none mt-0.5">{format(parseISO(stat.month + '-01'), 'yy')}</span>
                                                                              </div>
                                                                              <span className="text-xs font-bold text-zinc-400 font-mono">{stat.month}</span>
                                                                          </div>
                                                                      </td>
                                                                      <td className="p-3 text-right">
                                                                          <div className="text-sm font-black text-white font-mono">${stat.revenue.toLocaleString()}</div>
                                                                      </td>
                                                                      <td className="p-3 text-right">
                                                                          <div className="text-sm font-black text-blue-400 font-mono">{stat.sold}</div>
                                                                      </td>
                                                                  </tr>
                                                              ))}
                                                          </tbody>
                                                      </table>
                                                  </div>
                                                  
                                                  <div className="mt-4 p-3 bg-zinc-900/30 rounded-xl border border-white/5 flex justify-between items-center">
                                                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Annual Total</div>
                                                      <div className="flex gap-4">
                                                          <div className="text-right">
                                                              <div className="text-xs font-black text-white font-mono">
                                                                  ${financialReport.monthly_stats.reduce((acc: number, s: any) => acc + s.revenue, 0).toLocaleString()}
                                                              </div>
                                                              <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">Total Revenue</div>
                                                          </div>
                                                          <div className="text-right">
                                                              <div className="text-xs font-black text-blue-400 font-mono">
                                                                  {financialReport.monthly_stats.reduce((acc: number, s: any) => acc + s.sold, 0)}
                                                              </div>
                                                              <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">Total Sold</div>
                                                          </div>
                                                      </div>
                                                  </div>
                                              </>
                                          ) : (
                                              <div className="p-8 text-center text-zinc-500 text-[10px] font-black uppercase tracking-widest border border-dashed border-white/5 rounded-2xl bg-zinc-900/20">
                                                  No Monthly Data Available
                                              </div>
                                          )}
                                      </div>
                                  </>
                              )}
                         </div>
                     </>
                 );
              }
          }
          
          if(adminView === 'courses' || (adminView === 'course_ticket' && courseCategory)) { let displayItems: any[] = []; let categoryTitle = ""; let themeClass = ""; if (courseCategory === 'ROUTINE') { categoryTitle = "例行課程"; themeClass = "bg-zinc-900 border-chiachia-green/30 hover:border-chiachia-green/50"; displayItems = templates.filter(t => t.category === 'ROUTINE' || (!t.category && t.is_auto_scheduled)); } else if (courseCategory === 'SPECIAL') { categoryTitle = "專訓課程"; themeClass = "bg-zinc-900/40 border border-chiachia-green/50 text-chiachia-green shadow-[0_0_10px_rgba(57,231,95,0.2)]"; displayItems = sessions.filter(s => s.category === 'SPECIAL'); } const getPriceDisplay = (item: any) => { if (item.ticket_type === 'GROUP_PRACTICE') return '團滑'; if (item.ticket_type === 'NONE') { if (item.price && item.price > 0) { return `單次 $${item.price}`; } if (ticketPrices.special_tiers && ticketPrices.special_tiers.length > 0) { const minPrice = Math.min(...ticketPrices.special_tiers.map(t => t.price)); const maxPrice = Math.max(...ticketPrices.special_tiers.map(t => t.price)); return ( <div className="flex flex-col"> <span className="font-bold">動態定價</span> <span className="text-[9px] text-zinc-400 font-mono">${minPrice} ~ ${maxPrice}</span> </div> ); } return `單次 $${item.price || 0}`; } return item.ticket_type || '一般'; }; return ( <> <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md px-4 pt-4 pb-2 border-b border-white/5"> <Header title={categoryTitle} onBack={() => setCourseCategory(null)} onAdd={() => { setFormData({ day_of_week: 5, start_time: '19:30', end_time: '21:00', max_students: 20, ticket_type: 'REGULAR', price: 0, location: '萬善同停車場', default_student_ids: [], category: courseCategory, date: format(new Date(), 'yyyy-MM-dd') }); setIsTemplateMode(courseCategory === 'ROUTINE'); setModalType('course_config'); setIsEditMode(false); setShowModal(true); }} /> </div> <div className="px-4 py-4 pb-28"> <div className="space-y-3"> {displayItems.length > 0 ? displayItems.map((item) => ( <div key={item.id} onClick={() => { if (courseCategory === 'ROUTINE') handleEditTemplate(item); if (courseCategory === 'SPECIAL') handleEditSession(item); }} className={`p-4 rounded-2xl relative border transition-all active:scale-[0.98] group ${themeClass}`}> <div className="flex justify-between items-start mb-2"> <div className="flex items-center gap-2"> {courseCategory === 'ROUTINE' ? ( <div className="text-xs font-black text-zinc-400 bg-black/30 px-2 py-0.5 rounded uppercase tracking-wider border border-white/5">{days[item.day_of_week]} {item.start_time}</div> ) : ( <div className="text-xs font-black text-white bg-black/30 px-2 py-0.5 rounded uppercase tracking-wider border border-white/5">{item.date} {item.start_time}</div> )} {item.is_auto_scheduled && <div className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-black uppercase border border-blue-500/30">Auto</div>} </div> {courseCategory === 'ROUTINE' && ( <div className="flex items-center gap-1"> <button onClick={(e) => { e.stopPropagation(); handleManualCreateSession(item); }} className="p-1.5 bg-chiachia-green text-black rounded-lg hover:bg-white transition-colors shadow-glow-green"><Play size={14} fill="black"/></button> <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(item.id!); }} className="text-zinc-600 hover:text-rose-500 p-1 transition-colors"><Trash2 size={16}/></button> </div> )} </div> <h3 className={`text-xl font-black italic ${courseCategory === 'SPECIAL' ? 'text-chiachia-green drop-shadow-sm' : 'text-white'}`}>{item.name}</h3> <div className="grid grid-cols-2 gap-2 mt-3"> <div className="flex items-center gap-1 text-xs text-zinc-400 font-bold"><MapPin size={14} className="text-zinc-500"/> {item.location}</div> <div className="flex items-center gap-1 text-xs text-zinc-400 font-bold"> <Ticket size={14} className="text-zinc-500"/> {item.category === 'SPECIAL' ? getPriceDisplay(item) : (item.ticket_type === 'NONE' ? '單次結算' : item.ticket_type || '一般')} </div> <div className="flex items-center gap-1 text-xs text-zinc-400 font-bold"><Users size={14} className="text-zinc-500"/> Max {item.max_students || item.capacity}</div> </div> {courseCategory === 'ROUTINE' && item.default_student_ids && JSON.parse(item.default_student_ids as any).length > 0 && ( <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2"> <span className="text-[9px] text-zinc-500 font-bold">固定班底:</span> <div className="flex -space-x-1.5"> {JSON.parse(item.default_student_ids as any).slice(0, 5).map((pid: string) => { const p = people.find((pp:any) => String(pp.id) === String(pid)); if(!p) return null; return <div key={pid} className="w-5 h-5 rounded-full border border-black overflow-hidden">{p.s_url && <img src={p.s_url} className="w-full h-full object-cover"/>}</div> })} {JSON.parse(item.default_student_ids as any).length > 5 && <div className="w-5 h-5 rounded-full bg-zinc-800 border border-black flex items-center justify-center text-[8px] text-zinc-400">+{JSON.parse(item.default_student_ids as any).length-5}</div>} </div> </div> )} </div> )) : ( <div className="py-20 text-center flex flex-col items-center gap-2 opacity-50"> <Layers size={40} className="text-zinc-600"/> <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">尚無{categoryTitle}</span> </div> )} </div> </div> {feedbackMsg && ( <div className="fixed inset-0 z-[70000] flex items-center justify-center pointer-events-none"> <div className="bg-black/90 backdrop-blur-md px-6 py-4 rounded-2xl border border-chiachia-green/30 shadow-[0_0_30px_rgba(57,231,95,0.2)] flex flex-col items-center gap-2 animate-scale-in"> <CheckCircle2 size={32} className="text-chiachia-green" /> <span className="text-sm font-black text-white italic">{feedbackMsg}</span> </div> </div> )} </> ); }
          if(adminView === 'training' || adminView === 'series') { const isTraining = adminView === 'training'; const items = isTraining ? trainingTypes : raceGroups; return ( <> <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md px-4 pt-4 pb-2 border-b border-white/5"> <Header title={isTraining ? "訓練項目" : "賽事系列"} onBack={() => setAdminView('menu')} onAdd={() => { setFormData({}); setIsEditMode(false); setModalType('config'); setShowModal(true); }} /> </div> <div className="px-4 py-4 pb-28"> <div className="space-y-2"> {(items || []).map((it: any) => ( <div key={it.id} className="glass-card p-4 rounded-2xl flex justify-between items-center"> <span className={`text-white font-bold ${it.is_default && isTraining ? 'text-chiachia-green font-black drop-shadow-glow' : ''}`}> {isTraining ? it.type_name : it.series_name} {!!it.is_default && isTraining && <span className="ml-2 text-[8px] bg-chiachia-green text-black px-1 py-0.5 rounded uppercase">Default</span>} </span> <button onClick={() => { setFormData({ id: it.id, name: isTraining ? it.type_name : it.series_name, is_default: it.is_default }); setIsEditMode(true); setModalType('config'); setShowModal(true); }} className="p-2 bg-zinc-800 text-zinc-300 hover:text-white rounded-lg transition-colors border border-white/5 active:scale-95"> <Edit2 size={16}/> </button> </div> ))} </div> </div> </> ); }
          return null;
      } else {
          // ... (Keep existing user profile render) ...
          const age = user.birthday ? differenceInYears(new Date(), new Date(user.birthday)) : '--';
          return ( 
             <> 
                <div className="h-full bg-black overflow-y-auto no-scrollbar pb-40 relative"> 
                    <div className="relative w-full aspect-[4/5] shrink-0"> {user.b_url ? ( <img src={user.b_url.split('#')[0]} className="w-full h-full object-cover" /> ) : ( <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-900 gap-2"> <Camera size={32} /> <span className="text-xs font-black uppercase tracking-widest">No Cover Photo</span> </div> )} <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/60 to-transparent"></div> <div className="absolute bottom-6 left-6 flex items-end gap-4 w-full pr-6 z-20"> 
                        <Avatar p={user} size="2xl" />
                        <div className="flex-1 min-w-0 pb-2"> <h2 className="text-3xl font-black text-white italic tracking-tight drop-shadow-lg truncate">{user.name}</h2> <p className="text-sm font-bold text-zinc-300 drop-shadow-md truncate">{user.full_name}</p> </div> </div> </div> 
                    
                    <div className="p-6 space-y-6 bg-black -mt-4 relative z-10 rounded-t-[32px] min-h-[50vh]"> 
                        <div className="glass-card p-5 rounded-2xl flex items-center gap-4 border-white/10"> <div className="flex flex-col items-center pr-4 border-r border-white/10 shrink-0 min-w-[60px]"> <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">AGE</span> <span className="text-2xl font-black text-white font-mono leading-none">{age}</span> </div> <div className="text-sm font-bold text-zinc-300 italic leading-relaxed line-clamp-2"> "{user.myword || '這傢伙很懶，什麼都沒留下...'}" </div> </div> 
                        <div className="grid grid-cols-2 gap-3"> 
                            <MenuCard title="編輯檔案" icon={<Edit2/>} onClick={handleOpenEditModal} /> 
                            {!hasPermission(user, PERMISSIONS.TICKET_MANAGE) && ( <MenuCard title="我的票卷" icon={<Ticket/>} onClick={() => { setModalType('my_tickets'); setShowModal(true); }} /> )}
                            <MenuCard title="修改密碼" icon={<LockKeyhole/>} onClick={() => { setFormData({}); setPasswordError(''); setModalType('change_password'); setShowModal(true); }} /> 
                            <MenuCard title="推播通知" icon={<BellRing/>} onClick={() => { setModalType('settings_menu'); setShowModal(true); }} />
                            <MenuCard title="使用說明書" icon={<BookOpen/>} onClick={() => { setModalType('manual'); setShowModal(true); }} />
                            {(hasPermission(user, PERMISSIONS.PEOPLE_MANAGE) || hasRole(user, ROLES.DEV)) && <MenuCard title="人員管理" icon={<User/>} onClick={() => setAdminView('players')} />}
                            {(hasPermission(user, PERMISSIONS.COURSE_EDIT) || hasPermission(user, PERMISSIONS.TICKET_MANAGE) || hasRole(user, ROLES.DEV)) && <MenuCard title="課程票務" icon={<LayoutGrid/>} onClick={() => { setAdminView('course_ticket'); setCourseCategory(null); setTicketView('menu'); }} badge={ticketRequests.length} />}
                            {(hasPermission(user, PERMISSIONS.CONFIG_MANAGE) || hasRole(user, ROLES.DEV)) && <MenuCard title="訓練項目" icon={<Activity/>} onClick={() => setAdminView('training')} />}
                            {(hasPermission(user, PERMISSIONS.CONFIG_MANAGE) || hasRole(user, ROLES.DEV)) && <MenuCard title="賽事系列" icon={<Flag/>} onClick={() => setAdminView('series')} />}
                            {(hasPermission(user, PERMISSIONS.PUSH_MANAGE) || hasRole(user, ROLES.DEV)) && <MenuCard title="推播系統" icon={<Radio/>} onClick={() => { setAdminView('push_system'); setPushView('menu'); }} />}
                            <MenuCard title="登出帳號" icon={<LogOut/>} onClick={handleLogout} variant="danger" /> 
                        </div> 
                    </div> 
                </div> 
              </>
           );
        }
        return null;
    };

    return (
        <>
            {renderContent()}
            {/* CONFIRM MODAL */}
                  {confirmModal && createPortal(
                      <div className="fixed inset-0 z-[70000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
                          <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-white/10 text-center">
                              <h3 className="text-xl font-black text-white italic mb-2">{confirmModal.title}</h3>
                              <p className="text-zinc-400 text-sm font-bold mb-6">{confirmModal.message}</p>
                              <div className="grid grid-cols-2 gap-3">
                                  <button onClick={() => setConfirmModal(null)} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl active:bg-zinc-700 transition-colors">取消</button>
                                  <button onClick={confirmModal.onConfirm} className="py-3 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center">
                                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : '確認'}
                                  </button>
                              </div>
                          </div>
                      </div>,
                      document.body
                  )}
                  
                  {/* SUCCESS MODAL */}
                  {successModal && successModal.show && createPortal(
                      <div className="fixed inset-0 z-[70000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
                          <div className="glass-card w-full max-w-xs rounded-3xl p-8 border-chiachia-green/20 text-center animate-scale-in flex flex-col items-center gap-4 shadow-[0_0_30px_rgba(57,231,95,0.1)]">
                              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-chiachia-green/30 flex items-center justify-center text-chiachia-green shadow-glow-green mb-2">
                                  <Check size={32} strokeWidth={3} />
                              </div>
                              <div>
                                  <h3 className="text-xl font-black text-white italic mb-2">{successModal.title}</h3>
                                  <p className="text-zinc-400 text-sm font-bold leading-relaxed">{successModal.message}</p>
                              </div>
                              <button onClick={() => setSuccessModal(null)} className="w-full py-3 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all mt-4">
                                  我知道了
                              </button>
                          </div>
                      </div>,
                      document.body
                  )}


                  {/* REJECT MODAL */}
                  {rejectModal.show && createPortal(
                      <div className="fixed inset-0 z-[70000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
                          <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-white/10 text-center">
                              <h3 className="text-xl font-black text-white italic mb-2">退回請求</h3>
                              <div className="space-y-3 mb-4">
                                  <textarea 
                                      rows={3} 
                                      placeholder="退回原因 (選填)" 
                                      value={rejectReason} 
                                      onChange={e => setRejectReason(e.target.value)} 
                                      className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500/50 text-sm"
                                  />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                  <button onClick={() => setRejectModal({ show: false })} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl active:bg-zinc-700 transition-colors">取消</button>
                                  <button onClick={handleRejectRequest} className="py-3 bg-rose-500 text-white font-black rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center">
                                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : '確認退回'}
                                  </button>
                              </div>
                          </div>
                      </div>,
                      document.body
                  )}

                  {/* EDIT PROFILE MODAL */}
                  {showModal && modalType === 'parent_edit' && createPortal( <div className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]" onClick={() => setShowModal(false)}> <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 max-h-[90vh] overflow-y-auto no-scrollbar mb-4 shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}> <div className="flex items-center border-b border-white/5 pb-4 gap-3"> <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button> <h3 className="text-xl font-black text-white italic">編輯檔案</h3> </div> <div className="space-y-4"> <div className="w-full"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 block">檔案照片預覽</label> <div className="relative w-full aspect-[4/5] rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden group"> {user?.b_url ? <img src={user.b_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center flex-col gap-2 text-zinc-600"><ImageIcon size={32}/><span className="text-[10px] font-bold">無封面</span></div>} <label htmlFor="upload-cover-edit" className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"> <Camera size={24} className="text-white drop-shadow-lg mb-1"/> <span className="text-[10px] text-white font-bold bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">更換封面</span> </label> <input type="file" accept="image/*" className="hidden" id="upload-cover-edit" onChange={(e) => handleFileSelect(e, 'b')} /> <div className="absolute bottom-3 left-3 w-20 h-20 rounded-3xl border-2 border-white bg-zinc-950 overflow-hidden shadow-lg z-20 group/avatar"> {user?.s_url ? <img src={user.s_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-zinc-600"><UserCircle2 size={32}/></div>} <label htmlFor="upload-avatar-edit" className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"> <Camera size={20} className="text-white drop-shadow-md"/> </label> <input type="file" accept="image/*" className="hidden" id="upload-avatar-edit" onChange={(e) => handleFileSelect(e, 's')} /> </div> </div> </div> <div className="space-y-1"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">暱稱 (顯示名稱)</label> <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 font-bold"/> </div> <div className="space-y-1"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">全名 (真實姓名)</label> <input type="text" value={formData.full_name || ''} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50"/> </div> <div className="space-y-1"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">生日</label> <input type="date" value={formData.birthday || ''} onChange={e => setFormData({...formData, birthday: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 min-w-0"/> </div> <div className="space-y-1"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">個人宣言</label> <textarea rows={3} value={formData.myword || ''} onChange={e => setFormData({...formData, myword: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 text-sm"/> </div> <button onClick={handleUpdateSelf} disabled={isSubmitting} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"> {isSubmitting && <Loader2 size={18} className="animate-spin" />} {isSubmitting ? '儲存中...' : '儲存變更'} </button> </div> </div> </div> , document.body)}

                  {/* BANK ACCOUNT MODAL */}
      {showModal && modalType === 'bank_account' && createPortal(
        <div className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]" onClick={() => setShowModal(false)}>
          <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center border-b border-white/5 pb-4 gap-3">
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button>
              <h3 className="text-xl font-black text-white italic">設定收款帳號</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">銀行代碼</label>
                  <input type="text" value={bankAccount.bank_code} onChange={e => setBankAccount({...bankAccount, bank_code: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 text-base" placeholder="例如：007"/>
              </div>
              <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">帳號</label>
                  <input type="text" value={bankAccount.account_number} onChange={e => setBankAccount({...bankAccount, account_number: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 text-base" placeholder="請輸入收款帳號"/>
              </div>
              <button onClick={handleSaveBankAccount} disabled={isSubmitting} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <Check size={18} />} {isSubmitting ? '儲存中...' : '儲存設定'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PLAYER MANAGEMENT MODAL */}
                  {showModal && modalType === 'player' && createPortal(
                    <div className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]" onClick={() => setShowModal(false)}>
                        <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 max-h-[90vh] overflow-y-auto no-scrollbar mb-4 shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center border-b border-white/5 pb-4 gap-3">
                                <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button>
                                <h3 className="text-xl font-black text-white italic">{isEditMode ? '編輯選手' : '新增選手'}</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">暱稱 (登入名稱)</label>
                                    <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 font-bold" placeholder="例如: 小明"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">全名 (真實姓名)</label>
                                    <input type="text" value={formData.full_name || ''} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50" placeholder="例如: 王小明"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">生日</label>
                                    <input type="date" value={formData.birthday || ''} onChange={e => setFormData({...formData, birthday: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">角色權限</label>
                                    <div className="flex flex-wrap gap-2">
                                        {[ROLES.RIDER, ROLES.AIDE, ROLES.COACH].map(role => (
                                            <button key={role} onClick={() => handleToggleRole(role)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${formData.roles?.includes(role) ? 'bg-chiachia-green border-chiachia-green text-black' : 'bg-zinc-900 border-white/10 text-zinc-500'}`}>
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {isEditMode && (
                                    <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${formData.is_hidden ? 'bg-zinc-600' : 'bg-chiachia-green'}`}></div>
                                            <span className="text-xs font-bold text-zinc-300">{formData.is_hidden ? '已隱藏 (退休)' : '顯示中 (在役)'}</span>
                                        </div>
                                        <button onClick={() => setFormData({...formData, is_hidden: !formData.is_hidden})} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${formData.is_hidden ? 'bg-chiachia-green border-chiachia-green text-black' : 'bg-zinc-800 border-white/10 text-zinc-500'}`}>
                                            {formData.is_hidden ? '恢復顯示' : '隱藏選手'}
                                        </button>
                                    </div>
                                )}
                                
                                {isEditMode && (
                                    <div className="pt-2 border-t border-white/5">
                                        <button onClick={handleResetPassword} className="w-full py-3 bg-zinc-900 text-zinc-400 font-bold rounded-xl border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs">
                                            {resetStatus === 'success' ? <CheckCircle2 size={14} className="text-chiachia-green" /> : <RotateCcw size={14} />}
                                            {resetStatus === 'success' ? '密碼已重設為 123456' : resetStatus === 'error' ? '重設失敗' : '重設密碼為 123456'}
                                        </button>
                                    </div>
                                )}

                                <button onClick={isEditMode ? handleEditPerson : handleAddPerson} disabled={isSubmitting || !formData.name} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 mt-2">
                                    {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                                    {isSubmitting ? '處理中...' : (isEditMode ? '儲存變更' : '確認新增')}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                  )}

                  {/* CONFIG MODAL (Training Types / Race Series) */}
                  {showModal && modalType === 'config' && createPortal(
                    <div className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]" onClick={() => setShowModal(false)}>
                        <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center border-b border-white/5 pb-4 gap-3">
                                <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button>
                                <h3 className="text-xl font-black text-white italic">{isEditMode ? '編輯項目' : '新增項目'}</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">名稱</label>
                                    <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 font-bold" placeholder="輸入名稱..."/>
                                </div>
                                {adminView === 'training' && (
                                    <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl border border-white/5">
                                        <span className="text-xs font-bold text-zinc-300">設為預設項目</span>
                                        <button onClick={() => setFormData({...formData, is_default: !formData.is_default})} className={`w-12 h-6 rounded-full transition-all relative ${formData.is_default ? 'bg-chiachia-green' : 'bg-zinc-800'}`}>
                                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.is_default ? 'left-7' : 'left-1'}`}></div>
                                        </button>
                                    </div>
                                )}
                                <div className="flex gap-3 mt-2">
                                    {isEditMode && (
                                        <button onClick={() => handleDeleteConfig(adminView === 'training' ? 'training' : 'series', formData.id)} className="flex-1 py-4 bg-rose-500/10 text-rose-500 font-black rounded-xl border border-rose-500/20 active:scale-95 transition-all">
                                            刪除
                                        </button>
                                    )}
                                    <button onClick={() => handleSaveConfig(adminView === 'training' ? 'training' : 'series')} disabled={isSubmitting || !formData.name} className="flex-[2] py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2">
                                        {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                                        {isSubmitting ? '處理中...' : '儲存'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                  )}

                  {showModal && (modalType === 'course_config' || modalType === 'template') && createPortal(
                    <div className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]" onClick={() => setShowModal(false)}>
                        <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 max-h-[90vh] overflow-y-auto no-scrollbar mb-4 shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center border-b border-white/5 pb-4 gap-3">
                                <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button>
                                <h3 className="text-xl font-black text-white italic">{isEditMode ? '編輯課程' : '新增課程'}</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">課程名稱</label>
                                    <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 font-bold" placeholder="例如: 假日進階班"/>
                                </div>
                                
                                {formData.category === 'ROUTINE' ? (
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">重複週期</label>
                                        <select value={formData.day_of_week} onChange={e => setFormData({...formData, day_of_week: Number(e.target.value)})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 font-bold appearance-none">
                                            {['週日','週一','週二','週三','週四','週五','週六'].map((day, i) => (
                                                <option key={i} value={i}>{day}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">日期</label>
                                        <input type="date" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 font-bold min-w-0"/>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">開始時間</label>
                                        <input type="time" value={formData.start_time || ''} onChange={e => setFormData({...formData, start_time: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 font-bold min-w-0"/>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">結束時間</label>
                                        <input type="time" value={formData.end_time || ''} onChange={e => setFormData({...formData, end_time: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 font-bold min-w-0"/>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">上課地點</label>
                                    <input type="text" value={formData.location || ''} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 font-bold" placeholder="例如: 萬善同停車場"/>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">人數上限</label>
                                        <input type="number" value={formData.max_students || ''} onChange={e => setFormData({...formData, max_students: Number(e.target.value)})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 font-bold"/>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">票卷類型</label>
                                        <select value={formData.ticket_type} onChange={e => setFormData({...formData, ticket_type: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 font-bold appearance-none">
                                            <option value="REGULAR">一般課程</option>
                                            <option value="RACING">競速課程</option>
                                            <option value="GROUP_PRACTICE">團練</option>
                                            <option value="NONE">單次</option>
                                        </select>
                                    </div>
                                </div>

                                {formData.ticket_type === 'NONE' && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">單次費用 (0 為動態定價)</label>
                                        <input type="number" value={formData.price || 0} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 font-bold"/>
                                    </div>
                                )}

                                {formData.category === 'ROUTINE' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">固定班底 (自動帶入報名)</label>
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-zinc-900/50 rounded-xl border border-white/5 no-scrollbar">
                                            {people.filter((p:any) => !p.is_hidden && hasRole(p, ROLES.RIDER) && !hasRole(p, ROLES.DEV)).map((p: any) => (
                                                <button key={p.id} onClick={() => toggleFixedStudent(p.id)} className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${formData.default_student_ids?.includes(String(p.id)) ? 'bg-chiachia-green border-chiachia-green text-black' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>
                                                    {p.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button onClick={handleSaveCourse} disabled={isSubmitting || !formData.name} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 mt-2">
                                    {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                                    {createSuccess ? <Check size={18}/> : null}
                                    {isSubmitting ? '處理中...' : createSuccess ? '儲存成功' : '儲存課程'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                  )}

                  {/* MANUAL TICKET MODAL (ADMIN) */}
                  {showModal && modalType === 'manual_ticket' && createPortal( <div className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]" onClick={() => setShowModal(false)}> <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}> <div className="flex items-center border-b border-white/5 pb-4 gap-3"> <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button> <h3 className="text-xl font-black text-white italic">庫存調整</h3> </div> 
                    <div className="space-y-4"> 
                        <div className="space-y-1"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">類型</label> <div className="grid grid-cols-2 gap-3"> <button onClick={() => setFormData({...formData, type: 'REGULAR'})} className={`py-3 rounded-xl font-bold border transition-all ${formData.type === 'REGULAR' ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-500 border-white/10'}`}>一般課</button> <button onClick={() => setFormData({...formData, type: 'RACING'})} className={`py-3 rounded-xl font-bold border transition-all ${formData.type === 'RACING' ? 'bg-amber-500 text-black border-amber-500' : 'bg-zinc-900 text-zinc-500 border-white/10'}`}>競速班</button> </div> </div> 
                        <div className="space-y-1"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">數量 (正數增加，負數減少)</label> <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl font-black outline-none focus:border-chiachia-green/50"/> </div> 
                        <div className="space-y-1"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">金額 (0 為免費/不記帳)</label> <input type="number" value={formData.price || 0} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-xl font-bold outline-none focus:border-chiachia-green/50"/> </div>
                        <div className="space-y-1"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">備註</label> <input type="text" value={formData.note || ''} onChange={e => setFormData({...formData, note: e.target.value})} placeholder="例如：補償、活動贈送" className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none focus:border-chiachia-green/50"/> </div>
                        <div className="space-y-1"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">到期日</label> <input type="date" value={formData.expiry_date} onChange={e => setFormData({...formData, expiry_date: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-sm font-bold outline-none focus:border-chiachia-green/50 min-w-0"/> </div>
                    </div> 
                    <button onClick={async () => {
                        if (!formData.amount || Number(formData.amount) === 0) return alert('請輸入數量');
                        setIsSubmitting(true);
                        try {
                            // Use existing manual add API but adapted
                            await api.manualAddTickets({
                                people_id: formData.people_id,
                                type: formData.type,
                                amount: Number(formData.amount),
                                expiry_date: formData.expiry_date,
                                price: Number(formData.price || 0),
                                note: formData.note || '管理員手動調整'
                            });
                            await loadWallets();
                            setShowModal(false);
                        } catch(e) { alert('調整失敗'); }
                        setIsSubmitting(false);
                    }} disabled={isSubmitting} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"> {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <Check size={18}/>} 確認調整 </button> 
                  </div> </div> , document.body)}

                  {/* MANUAL MODAL */}
                  {showModal && modalType === 'manual' && <ManualModal user={user} onClose={() => setShowModal(false)} />}
                  
                  {/* ... (Other modals like my_tickets, change_password etc. remain) ... */}
                  {/* MY TICKETS MODAL */}
                  {showModal && modalType === 'my_tickets' && createPortal( <div className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]" onClick={() => setShowModal(false)}> <div className="glass-card w-full max-w-sm rounded-t-[32px] p-0 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-0 h-[85vh] overflow-hidden shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}> 
                        <div className="flex items-center justify-between border-b border-white/5 p-6 pb-4 shrink-0"> <div className="flex items-center gap-3"> <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button> <h3 className="text-xl font-black text-white italic">我的票卷</h3> </div> <button onClick={() => { setFormData({ people_id: user.id, type: 'REGULAR', amount: 4, last5: localStorage.getItem('CHIACHIA_LAST5') || '' }); setModalType('ticket'); }} className="px-3 py-1.5 bg-chiachia-green/20 text-chiachia-green rounded-lg text-xs font-bold border border-chiachia-green/30 active:scale-95">購買票卷</button> </div> 
                        <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4"> <div className="grid grid-cols-2 gap-3"> <div className="bg-zinc-900 p-4 rounded-2xl border border-white/10 text-center"> <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1">一般課</span> <span className="text-3xl font-mono font-black text-blue-400">{myWallet?.regular_balance || 0}</span> </div> <div className="bg-zinc-900 p-4 rounded-2xl border border-white/10 text-center"> <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1">競速班</span> <span className="text-3xl font-mono font-black text-amber-400">{myWallet?.racing_balance || 0}</span> </div> </div> <button onClick={() => { setSelectedHistoryPerson(user); loadFinancialHistory(user.id); setModalType('history'); setShowModal(true); }} className="w-full py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl border border-white/5 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs"> <History size={14} /> 查看交易紀錄 </button> <div className="space-y-2"> <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">詳細批次</div> {myWallet && myWallet.batches && myWallet.batches.length > 0 ? myWallet.batches.map((b, idx) => ( <div key={idx} className={`flex justify-between items-center text-xs px-4 py-3 rounded-xl border ${b.type === 'REGULAR' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}> <div className="flex items-center gap-2"> <Ticket size={14}/> <span className="font-bold text-sm">{b.type === 'REGULAR' ? '一般卷' : '競速卷'} × {b.amount}</span> </div> <div className="flex items-center gap-1 font-mono opacity-80"> <Clock size={12}/> <span>{b.expiry_date}</span> </div> </div> )) : <div className="text-center text-xs text-zinc-500 py-4 bg-zinc-900/50 rounded-xl">無有效票卷</div>} </div> </div> </div> </div> , document.body)}
                  {/* CHANGE PASSWORD MODAL */}
                  {showModal && modalType === 'change_password' && createPortal( <div className="fixed inset-0 z-[20000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md" onClick={() => setShowModal(false)}> <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-white/10 text-center" onClick={e => e.stopPropagation()}> <h3 className="text-xl font-black text-white italic mb-4">修改密碼</h3> <div className="space-y-3 mb-6"> <div className="space-y-1"> <input type="password" placeholder="新密碼 (6-12位數字)" maxLength={12} pattern="[0-9]*" inputMode="numeric" value={formData.newPassword || ''} onChange={e => setFormData({...formData, newPassword: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-xl font-bold outline-none focus:border-chiachia-green/50 tracking-widest"/> </div> <div className="space-y-1"> <input type="password" placeholder="確認新密碼" maxLength={12} pattern="[0-9]*" inputMode="numeric" value={formData.confirmPassword || ''} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 text-white text-center text-xl font-bold outline-none tracking-widest ${formData.confirmPassword && formData.newPassword !== formData.confirmPassword ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/10 focus:border-chiachia-green/50'}`}/> </div> {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && <div className="text-[10px] text-rose-500 font-bold">密碼不一致</div>} </div> <div className="grid grid-cols-2 gap-3"> <button onClick={() => setShowModal(false)} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl active:bg-zinc-700 transition-colors">取消</button> <button onClick={handleUpdateSelf} disabled={!formData.newPassword || formData.newPassword.length < 6 || formData.newPassword.length > 12 || formData.newPassword !== formData.confirmPassword || isSubmitting} className="py-3 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:grayscale"> {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : '確認修改'} </button> </div> </div> </div> , document.body)}
                  {/* PUSH NOTIFICATION SETTINGS MODAL */}
                  {showModal && modalType === 'settings_menu' && createPortal( <div className="fixed inset-0 z-[20000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md" onClick={() => setShowModal(false)}> <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-chiachia-green/20 text-center" onClick={e => e.stopPropagation()}> <div className="flex justify-between items-center mb-6"> <div className="flex items-center gap-2"> <Bell size={20} className="text-chiachia-green" /> <h3 className="text-lg font-black text-white italic">推播設定</h3> </div> <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400"><X size={18}/></button> </div> <div className="space-y-4"> <div className={`p-4 rounded-xl border flex items-center justify-between ${pushPermission === 'granted' ? 'bg-chiachia-green/5 border-chiachia-green/30' : 'bg-zinc-900 border-white/10'}`}> <div className="text-left"> <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Status</div> <div className={`text-sm font-bold ${pushPermission === 'granted' ? 'text-chiachia-green' : 'text-zinc-400'}`}> {pushPermission === 'granted' ? '已啟用 (Active)' : pushPermission === 'denied' ? '已封鎖 (Denied)' : '未啟用 (Inactive)'} </div> </div> {pushPermission === 'granted' && <CheckCircle2 size={24} className="text-chiachia-green"/>} </div> {pushPermission === 'granted' ? ( <div className="space-y-3"> <button onClick={handlePushSubscribe} disabled={isSubmitting} className="w-full py-3 bg-zinc-800 text-white font-bold rounded-xl border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"> {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>} 重新同步訂閱 </button> <button onClick={handlePushUnsubscribe} disabled={isSubmitting} className="w-full py-3 bg-rose-500/10 text-rose-500 font-bold rounded-xl border border-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"> <Power size={16}/> 停用通知 </button> </div> ) : ( <button onClick={handlePushSubscribe} disabled={isSubmitting} className="w-full py-3 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"> <ToggleLeft size={20}/> 啟用推播通知 </button> )} </div> </div> </div> , document.body)}
                  {/* LOGOUT CONFIRMATION MODAL */}
                  {showLogoutModal && createPortal( <div className="fixed inset-0 z-[60000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"> <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-white/10 text-center animate-scale-in"> <h3 className="text-xl font-black text-white italic mb-2">登出帳號</h3> <p className="text-zinc-400 text-sm font-bold mb-6">確定要登出嗎？</p> <div className="grid grid-cols-2 gap-3"> <button onClick={() => setShowLogoutModal(false)} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl">取消</button> <button onClick={confirmLogout} className="py-3 bg-rose-600 text-white font-black rounded-xl">登出</button> </div> </div> </div> , document.body)}
                  {/* FINANCIAL HISTORY MODAL */}
      {showModal && modalType === 'history' && createPortal(
        <div className="fixed inset-0 z-[30000] flex items-end justify-center bg-black/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]" onClick={() => setShowModal(false)}>
          <div className="glass-card w-full max-w-sm rounded-t-[32px] p-0 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-0 h-[85vh] overflow-hidden shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/5 p-6 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => { setModalType('my_tickets'); }} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><ArrowLeft size={18}/></button>
                <h3 className="text-xl font-black text-white italic">交易紀錄</h3>
              </div>
            </div>
            <div className="p-4 border-b border-white/5">
                <div className="grid grid-cols-2 gap-2">
                    <select onChange={e => setHistoryFilter({...historyFilter, type: e.target.value})} value={historyFilter.type} className="bg-zinc-800 border border-zinc-700 rounded-lg text-xs px-3 py-2 text-white">
                        <option value="ALL">所有類型</option>
                        <option value="DEPOSIT">儲值</option>
                        <option value="SPEND">花費</option>
                        <option value="REFUND">退款</option>
                    </select>
                    <select onChange={e => { setHistoryFilter({...historyFilter, period: e.target.value}); if(e.target.value !== 'CUSTOM') setIsHistoryDateMenuOpen(false); else setIsHistoryDateMenuOpen(true); }} value={historyFilter.period} className="bg-zinc-800 border border-zinc-700 rounded-lg text-xs px-3 py-2 text-white">
                        <option value="1W">最近一週</option>
                        <option value="1M">最近一個月</option>
                        <option value="3M">最近三個月</option>
                        <option value="ALL">所有時間</option>
                        <option value="CUSTOM">自訂日期</option>
                    </select>
                </div>
                {historyFilter.period === 'CUSTOM' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <input type="date" value={historyCustomRange.start} onChange={e => setHistoryCustomRange({...historyCustomRange, start: e.target.value})} className="bg-zinc-800 border border-zinc-700 rounded-lg text-xs px-3 py-2 text-white min-w-0" />
                        <input type="date" value={historyCustomRange.end} onChange={e => setHistoryCustomRange({...historyCustomRange, end: e.target.value})} className="bg-zinc-800 border border-zinc-700 rounded-lg text-xs px-3 py-2 text-white min-w-0" />
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
              <div className="space-y-2">
                {financialHistory.length > 0 ? (
                  financialHistory.map((record, index) => (
                    <div key={index}>
                      <button onClick={() => setExpandedRecord(expandedRecord === index ? null : index)} className="w-full flex justify-between items-center text-sm px-4 py-3 rounded-xl border bg-zinc-900 border-white/10">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${record.amount > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {record.amount > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          </div>
                          <div>
                            <span className="font-bold text-white text-left block">{record.note}</span>
                            <div className="text-xs text-zinc-400 font-mono text-left">{format(parseISO(record.created_at), 'yyyy-MM-dd HH:mm')}</div>
                          </div>
                        </div>
                        <div className={`font-mono font-bold text-lg ${record.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {record.amount > 0 ? '+' : ''}{record.amount}
                        </div>
                      </button>
                      {expandedRecord === index && (
                        <div className="p-4 bg-zinc-800/50 rounded-b-xl text-xs text-zinc-400 space-y-2 border-t border-white/5">
                          <div className="flex justify-between"><span>交易ID:</span> <span className="font-mono text-white">#{record.id}</span></div>
                          <div className="flex justify-between"><span>類型:</span> <span className="text-white">{record.transaction_type}</span></div>
                          {record.ticket_type && <div className="flex justify-between"><span>票卷種類:</span> <span className="text-white">{record.ticket_type}</span></div>}
                          {record.amount_cash !== 0 && <div className="flex justify-between"><span>現金金額:</span> <span className="font-mono text-white">${record.amount_cash}</span></div>}
                          {record.related_session_id && <div className="flex justify-between"><span>關聯課程ID:</span> <span className="font-mono text-white">#{record.related_session_id}</span></div>}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-sm text-zinc-600 py-10 bg-zinc-900/50 rounded-xl">無交易紀錄</div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CROP MODAL */}
                  {cropImageSrc && createPortal( <div className="fixed inset-0 z-[99999] bg-black flex flex-col"> <div className="flex-none px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] flex justify-between items-center bg-black z-10 border-b border-white/10"> <button onClick={() => setCropImageSrc(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:bg-zinc-800 transition-all"><X size={20} /></button> <span className="text-sm font-black text-white italic tracking-wider">ADJUST PHOTO</span> <button onClick={handleCropSave} className="h-10 px-5 bg-chiachia-green text-black font-black rounded-full flex items-center gap-2 shadow-glow-green active:scale-95 transition-all text-xs"> {uploading ? <Loader2 className="animate-spin" size={14}/> : <Check size={14} />} SAVE </button> </div> <div className="flex-1 relative bg-zinc-900 w-full overflow-hidden"> <SimpleImageCropper image={cropImageSrc} crop={crop} zoom={zoom} aspect={cropAspect} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} showGrid={true} style={{ containerStyle: { background: '#000' } }} /> </div> <div className="flex-none px-6 py-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] bg-black flex items-center gap-4 border-t border-white/10"> <ZoomIn size={20} className="text-zinc-500" /> <input type="range" value={zoom} min={1} max={3} step={0.1} aria-labelledby="Zoom" onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-chiachia-green" /> </div> </div> , document.body)}
                  {/* TICKET PURCHASE MODAL */}
                  {showModal && modalType === 'ticket' && createPortal( <div className="fixed inset-0 z-[20000] flex items-end justify-center bg-black/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]" onClick={() => setShowModal(false)}> <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}> <div className="flex items-center border-b border-white/5 pb-4 gap-3"> <button onClick={() => { setModalType('my_tickets'); }} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><ArrowLeft size={18}/></button> <h3 className="text-xl font-black text-white italic">購買票卷</h3> </div> 
                    <div className="space-y-4"> <div className="space-y-1"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">類型</label> <div className="grid grid-cols-2 gap-3"> <button onClick={() => setFormData({...formData, type: 'REGULAR'})} className={`py-3 rounded-xl font-bold border transition-all ${formData.type === 'REGULAR' ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-500 border-white/10'}`}>一般課 (${ticketPrices.regular_price})</button> <button onClick={() => setFormData({...formData, type: 'RACING'})} className={`py-3 rounded-xl font-bold border transition-all ${formData.type === 'RACING' ? 'bg-amber-500 text-black border-amber-500' : 'bg-zinc-900 text-zinc-500 border-white/10'}`}>競速班 (${ticketPrices.racing_price})</button> </div> </div> <div className="space-y-1"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">數量</label> <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl font-black outline-none focus:border-chiachia-green/50"/> </div> <div className="p-4 bg-zinc-900 rounded-xl border border-white/10 flex justify-between items-center"> <span className="text-xs font-bold text-zinc-400">預估金額</span> <span className="text-2xl font-black text-chiachia-green font-mono"> ${((formData.type === 'REGULAR' ? ticketPrices.regular_price : ticketPrices.racing_price) * (Number(formData.amount) || 0)).toLocaleString()} </span> </div> <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">付款方式</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setPaymentMethod('TRANSFER')} className={`py-3 rounded-xl font-bold border transition-all ${paymentMethod === 'TRANSFER' ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-500 border-white/10'}`}>轉帳</button>
                            <button onClick={() => setPaymentMethod('LINEPAY')} className={`py-3 rounded-xl font-bold border transition-all ${paymentMethod === 'LINEPAY' ? 'bg-green-500 text-white border-green-500' : 'bg-zinc-900 text-zinc-500 border-white/10'}`}>LINE PAY</button>
                        </div>
                    </div>
                    {paymentMethod === 'TRANSFER' && (
                        <>
                            <div className="p-4 bg-zinc-900/50 rounded-xl border border-white/5 space-y-2">
                                <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">匯款資訊</div>
                                <div className="flex justify-between items-center text-sm font-bold text-zinc-300">
                                    <span>銀行代碼</span>
                                    <span className="font-mono text-white">{bankAccount.bank_code || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-bold text-zinc-300">
                                    <span>銀行帳號</span>
                                    <span className="font-mono text-white">{bankAccount.account_number || 'N/A'}</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">您的帳號後五碼</label>
                                <input type="tel" maxLength={5} value={formData.last5} onChange={e => setFormData({...formData, last5: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-xl font-mono font-bold outline-none focus:border-chiachia-green/50 tracking-widest" placeholder="12345"/>
                            </div>
                        </>
                    )} <button onClick={handleRequestPurchase} disabled={isSubmitting || !formData.amount || !formData.last5} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"> {isSubmitting && <Loader2 size={18} className="animate-spin" />} 確認送出 </button> </div> </div> </div> , document.body)}
                  {/* ... (Other existing modals) ... */}
              </>
          );
  }

  // ... (Keep existing login screen) ...
  if (!user) {
      if (step === 'selectPerson') { 
          return ( 
            <div className="h-full flex flex-col p-6 pb-24"> 
                <div className="flex items-center justify-between mb-6"> <div className="flex flex-col"> <h2 className="text-2xl font-black text-white italic">SELECT RIDER</h2> <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Login to Access</p> </div> </div> 
                <div className="grid grid-cols-2 gap-4 overflow-y-auto no-scrollbar pb-20 p-1"> {targetList.map((p: any) => ( <button key={p.id} onClick={() => handleSelectPerson(p)} className="flex flex-col items-center gap-3 p-4 rounded-3xl bg-zinc-900/40 border border-white/5 active:scale-95 transition-all hover:bg-zinc-800"> <Avatar p={p} size="xl" /> <span className="text-lg font-black text-white truncate w-full text-center">{p.name}</span> </button> ))} </div> 
            </div> 
          ); 
      }
      if (step === 'password') { 
          return ( 
            <div className="h-full flex flex-col items-center justify-center p-8 space-y-6 pb-24"> 
                <button onClick={() => setStep('selectPerson')} className="absolute top-6 left-6 w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 active:bg-zinc-800 transition-all border border-white/5"><ArrowLeft size={20}/></button> 
                <div className="flex flex-col items-center gap-4 mb-4"> <Avatar p={selectedPerson} size="2xl" /> <h2 className="text-2xl font-black text-white italic">{selectedPerson?.name}</h2> </div>
                <div className="w-full max-w-xs space-y-4"> <div className="space-y-1"> <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest text-center block">Enter Password</label> <input ref={passwordInputRef} type="password" inputMode="numeric" pattern="[0-9]*" maxLength={12} value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-4 text-white text-center text-2xl font-bold outline-none focus:border-chiachia-green/50 tracking-[0.5em] placeholder:text-zinc-800 transition-colors" placeholder="••••••" /> </div> {errorMsg && <div className="text-rose-500 text-xs font-bold text-center animate-pulse bg-rose-500/10 py-2 rounded-xl border border-rose-500/20">{errorMsg}</div>} <button onClick={handleLogin} disabled={isLoggingIn || !loginPass} className="w-full h-14 bg-chiachia-green text-black font-black text-lg rounded-2xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale mt-2"> {isLoggingIn ? <Loader2 size={20} className="animate-spin" /> : <KeyRound size={20} />} {isLoggingIn ? 'VERIFYING...' : 'LOGIN'} </button> </div>
            </div> 
          ); 
      }
  }
  return null;
};

export default Settings;
