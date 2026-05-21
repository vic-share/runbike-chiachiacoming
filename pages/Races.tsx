import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { uploadImage } from '../services/supabase';
import { RaceEvent, RaceParticipant, LookupItem } from '../types';
import { MapPin, Loader2, Plus, Search, UserPlus, CalendarDays, CheckCircle2, X, ChevronDown, ChevronUp, Trophy, ArrowRight, Image as ImageIcon, UploadCloud, Trash2, Edit2, LogOut, ExternalLink, Map, AlertTriangle, Users, ZoomIn, Check, AlertCircle, Camera, MessageCircle, Medal, Zap, Clock, Flame, SlidersHorizontal, Share2 } from 'lucide-react';
import { format, subDays, addDays, subMonths, addMonths, isAfter, parseISO, isWithinInterval, startOfDay, endOfDay, isValid, differenceInDays } from 'date-fns';
import { SimpleImageCropper } from '../components/SimpleImageCropper';
import { hasRole, hasPermission, ROLES, PERMISSIONS } from '../utils/auth';

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
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
    }, 'image/jpeg', 0.95);
  });
}

interface RacesProps {
  data: any[];
  people: LookupItem[];
  refreshData: () => void;
  raceGroups: LookupItem[];
  initialExpandedEventId: string | number | null;
  raceEvents?: RaceEvent[];
}

const Races: React.FC<RacesProps> = ({ people, raceGroups, refreshData, initialExpandedEventId, raceEvents = [] }) => {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | number | null>(initialExpandedEventId);
  const [noteModal, setNoteModal] = useState<{show: boolean, text: string}>({ show: false, text: '' });
  const [dateRangeMode, setDateRangeMode] = useState<'1W' | '1M' | '3M' | 'ALL' | 'PICK'>('1M');
  const [customDateRange, setCustomDateRange] = useState<{start: string, end: string}>({
    start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    end: format(addMonths(new Date(), 3), 'yyyy-MM-dd')
  });
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [tab, setTab] = useState<'all' | 'joined' | 'open' | 'finished'>('all');
  const [selectedSeries, setSelectedSeries] = useState<string>('all');
  
  // 前端分頁狀態
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // 🟢 修正選定報名對象與事件的狀態結構
  const [showJoinModal, setShowJoinModal] = useState<{show: boolean, event?: RaceEvent, participant?: any}>({ show: false });
  const [selectedPeopleId, setSelectedPeopleId] = useState<string>('');
  
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id?: string|number, count?: number}>({ show: false });
  const [exitConfirm, setExitConfirm] = useState<{show: boolean, eventId?: string|number, peopleId?: string|number}>({ show: false });
  const [personalHonorConfirm, setPersonalHonorConfirm] = useState<{show: boolean, event?: RaceEvent, participant?: RaceParticipant}>({ show: false });
  const [globalHonorConfirm, setGlobalHonorConfirm] = useState<{show: boolean, event?: RaceEvent, participant?: RaceParticipant}>({ show: false });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form State
  const [createForm, setCreateForm] = useState({ id: '', name: '', date: format(new Date(), 'yyyy-MM-dd'), location: '', series_id: '', url: '' });
  const [joinForm, setJoinForm] = useState({ value: '', race_group: '', note: '', photo_url: '' });

  // Crop State
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropAspect, setCropAspect] = useState(16 / 9);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [uploadTarget, setUploadTarget] = useState<'cover' | 'participant'>('cover');

  // User & Permission Checks
  const user = api.getUser();
  const isRiderMode = user && !hasPermission(user, PERMISSIONS.RACE_MANAGE) && hasRole(user, ROLES.RIDER);
  const canManage = hasPermission(user, PERMISSIONS.RACE_MANAGE) || hasRole(user, ROLES.DEV);

  const now = Math.floor(Date.now() / 1000);

  useEffect(() => {
    setCurrentPage(1);
  }, [tab, search, selectedSeries, dateRangeMode, customDateRange]);

  useEffect(() => {
    if (initialExpandedEventId) {
      setExpandedEventId(initialExpandedEventId);
      setTimeout(() => {
        const el = document.getElementById(`race-card-${initialExpandedEventId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    }
  }, [initialExpandedEventId]);

  const handleLocationClick = (e: React.MouseEvent, location: string) => {
    e.stopPropagation();
    if (!location) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    window.open(url, '_blank');
  };

  const formatLocation = (loc?: string) => {
    if (!loc) return '未定地點';
    return loc.length > 12 ? loc.slice(0, 12) + '...' : loc;
  };

  const filteredEvents = useMemo(() => {
    const today = startOfDay(new Date());
    return raceEvents.filter(event => {
      const eDate = parseISO(event.date);
      if (!isValid(eDate)) return false;

      if (dateRangeMode === '1W') {
        if (!isWithinInterval(eDate, { start: subDays(today, 3), end: addDays(today, 7) })) return false;
      } else if (dateRangeMode === '1M') {
        if (!isWithinInterval(eDate, { start: subMonths(today, 1), end: addMonths(today, 2) })) return false;
      } else if (dateRangeMode === '3M') {
        if (!isWithinInterval(eDate, { start: subMonths(today, 3), end: addMonths(today, 3) })) return false;
      } else if (dateRangeMode === 'PICK') {
        const s = startOfDay(parseISO(customDateRange.start));
        const e = endOfDay(parseISO(customDateRange.end));
        if (isValid(s) && isValid(e)) {
          if (!isWithinInterval(eDate, { start: s, end: e })) return false;
        }
      }

      if (selectedSeries !== 'all' && String(event.series_id) !== selectedSeries) return false;

      const isPast = !isAfter(eDate, subDays(new Date(), 1));
      const hasJoined = user && event.participants?.some(p => String(p.people_id || p.id) === String(user.id));
      if (tab === 'joined' && !hasJoined) return false;
      if (tab === 'open' && isPast) return false;
      if (tab === 'finished' && !isPast) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const nameMatch = event.name.toLowerCase().includes(query);
        const locMatch = event.location?.toLowerCase().includes(query);
        const partMatch = event.participants?.some(p => p.name.toLowerCase().includes(query));
        if (!nameMatch && !locMatch && !partMatch) return false;
      }

      return true;
    });
  }, [raceEvents, dateRangeMode, customDateRange, selectedSeries, tab, search, user]);

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredEvents]);

  const totalPages = Math.ceil(sortedEvents.length / pageSize);

  const visibleEvents = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    return sortedEvents.slice(startIdx, endIdx);
  }, [sortedEvents, currentPage]);

  const openCreateModal = (event?: RaceEvent) => {
    if (event) {
      setCreateForm({
        id: String(event.id),
        name: event.name,
        date: event.date,
        location: event.location || '',
        series_id: event.series_id ? String(event.series_id) : '',
        url: event.url || ''
      });
      setIsEditMode(true);
    } else {
      setCreateForm({ id: '', name: '', date: format(new Date(), 'yyyy-MM-dd'), location: '', series_id: '', url: '' });
      setIsEditMode(false);
    }
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!createForm.name || !createForm.date) return;
    setSubmitting(true);
    try {
      const res = await api.createRaceEvent({
        id: createForm.id ? Number(createForm.id) : undefined,
        name: createForm.name,
        date: createForm.date,
        location: createForm.location,
        series_id: createForm.series_id ? Number(createForm.series_id) : null,
        url: createForm.url || null
      });
      if (res.success) {
        refreshData();
        setShowCreateModal(false);
      }
    } catch (e) {
      alert('儲存賽事失敗');
    } finally {
      setSubmitting(false);
    }
  };

  // 🟢 修正：完美確保一般選手報名與管理員代報名的狀態對接
  const openJoinModal = (event: RaceEvent, participant?: any) => {
    if (participant) {
      setJoinForm({
        value: participant.value || '',
        race_group: participant.race_group || '',
        note: participant.note || '',
        photo_url: participant.photo_url || ''
      });
      setSelectedPeopleId(String(participant.people_id || participant.id));
    } else {
      setJoinForm({ value: '', race_group: '', note: '', photo_url: '' });
      setSelectedPeopleId(user ? String(user.id) : '');
    }
    setShowJoinModal({ show: true, event, participant });
  };

  // 🟢 修正：防禦型參數綁定，絕對不允許發送 undefined 導致前端死機
  const handleJoin = async () => {
    const { event } = showJoinModal;
    if (!event) return;
    
    const targetPeopleId = selectedPeopleId || (user ? String(user.id) : '');
    if (!targetPeopleId) {
      alert('無法取得有效的報名隊員身分');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitRaceRecord({
        event_id: Number(event.id),
        people_id: Number(targetPeopleId),
        value: joinForm.value,
        race_group: joinForm.race_group,
        note: joinForm.note,
        photo_url: joinForm.photo_url || null
      });
      if (res.success) {
        refreshData();
        setShowJoinModal({ show: false });
      }
    } catch (e) {
      alert('登記參賽失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExitRace = async (eventId: string|number, peopleId: string|number) => {
    setExitConfirm({ show: true, eventId, peopleId });
  };

  const confirmExitRace = async () => {
    const { eventId, peopleId } = exitConfirm;
    if (!eventId || !peopleId) return;
    setSubmitting(true);
    try {
      const res = await api.deleteRaceRecord(Number(eventId), Number(peopleId));
      if (res.success) {
        refreshData();
        setExitConfirm({ show: false });
        if (showJoinModal.show) setShowJoinModal({ show: false });
      }
    } catch(e) {
      alert('退賽失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRaceEvent = async () => {
    const id = createForm.id;
    if (!id) return;
    const count = showJoinModal.event?.participants?.length || 0;
    setDeleteConfirm({ show: true, id, count });
  };

  const confirmDeleteRaceEvent = async () => {
    if (!deleteConfirm.id) return;
    setSubmitting(true);
    try {
      const res = await api.deleteRaceEvent(Number(deleteConfirm.id));
      if (res.success) {
        refreshData();
        setDeleteConfirm({ show: false });
        setShowCreateModal(false);
      }
    } catch (e) {
      alert('刪除失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePersonalHonor = async () => {
    const { event, participant } = personalHonorConfirm;
    if (!event || !participant) return;
    setSubmitting(true);
    try {
      const nextStatus = !participant.is_personal_honor;
      const res = await api.submitRaceRecord({
        event_id: Number(event.id),
        people_id: Number(participant.people_id || participant.id),
        value: participant.value || '',
        race_group: participant.race_group || '',
        note: participant.note || '',
        photo_url: participant.photo_url || null,
        is_personal_honor: nextStatus
      });
      if (res.success) {
        refreshData();
        setPersonalHonorConfirm({ show: false });
      }
    } catch(e) {
      alert('榮譽榜操作失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleGlobalHonor = async () => {
    const { participant } = globalHonorConfirm;
    if (!participant) return;
    setSubmitting(true);
    try {
      // 🟢 修正時間比對邏輯，相容 Unix 戳記與日期格式
      const expiryTime = participant.global_honor_expires_at || 0;
      const isActive = expiryTime > now;
      const duration = isActive ? 0 : 43200; 
      const res = await api.toggleGlobalHonor(Number(participant.id || participant.people_id), duration);
      if (res.success) {
        refreshData();
        setGlobalHonorConfirm({ show: false });
      }
    } catch (e) {
      alert('全域榮譽榜更新失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCoverUploadStart = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadTarget('cover');
    setCropAspect(16 / 9);
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setCropImageSrc(reader.result as string);
    });
    reader.readAsDataURL(file);
  };

  const handleParticipantUploadStart = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadTarget('participant');
    setCropAspect(4 / 5);
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setCropImageSrc(reader.result as string);
    });
    reader.readAsDataURL(file);
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropSave = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      const file = new File([croppedBlob], `cropped_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const folder = uploadTarget === 'cover' ? 'races' : 'records';
      const result = await uploadImage(file, folder);
      
      if (result.url) {
        if (uploadTarget === 'cover') {
          setCreateForm(prev => ({ ...prev, url: result.url! }));
        } else {
          setJoinForm(prev => ({ ...prev, photo_url: result.url! }));
        }
        setCropImageSrc(null);
      } else {
        alert(result.error || '圖片裁剪上傳失敗');
      }
    } catch (err) {
      alert('裁剪過程發生錯誤');
    } finally {
      setUploading(false);
    }
  };

  const handleShareEvent = async (event: RaceEvent) => {
    const templates = await api.fetchPushTemplates();
    const footerText = templates.share_footer_text_race || templates.share_footer_text || "衝吧！前進頒獎台！";
    
    let text = `🏆 賽事分享：${event.name}\n`;
    text += `📅 日期：${event.date}\n`;
    if (event.location) text += `📍 地點：${event.location}\n`;
    
    const activeParts = event.participants || [];
    if (activeParts.length > 0) {
      text += `\n參賽隊員 (${activeParts.length}人):\n`;
      activeParts.forEach((p, idx) => {
        text += `${idx + 1}. ${p.name}${p.race_group ? ` (RANK: ${p.race_group})` : ''}\n`;
      });
    }
    text += `\n${footerText}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: event.name, text });
      } catch (e) {
        console.log(e);
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        alert('賽事與參賽名單資訊已複製到剪貼簿');
      } catch (err) {
        alert('複製失敗');
      }
    }
  };

  const dateLabels: Record<string, string> = { '1W': '3天~1週', '1M': '本月前後', '3M': '三個月內', 'ALL': '全部日子', 'PICK': '自訂區間' };
  const paddingTopClass = isFilterExpanded ? 'pt-44' : 'pt-24';

  return (
    <div className="h-full w-full relative bg-black select-none">
      {/* Sticky Header */}
      <div className="absolute top-0 left-0 right-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-2xl font-russo text-white tracking-tight italic transform -skew-x-12 leading-none">ARENA</h2>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-1">Race Tracking System</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsDateMenuOpen(!isDateMenuOpen)} className="h-10 px-4 rounded-xl border border-white/5 bg-zinc-900/60 text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2 active:scale-95 transition-all">
              <CalendarDays size={14}/>
              <span>{dateLabels[dateRangeMode]}</span>
            </button>
            <button onClick={() => setIsFilterExpanded(!isFilterExpanded)} className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all active:scale-95 ${isFilterExpanded ? 'bg-chiachia-green border-chiachia-green text-black shadow-glow-green' : 'bg-zinc-900/60 border-white/5 text-zinc-400'}`}>
              <SlidersHorizontal size={16}/>
            </button>
            {canManage && (
              <button onClick={() => openCreateModal()} className="w-10 h-10 rounded-xl bg-chiachia-green text-black flex items-center justify-center shadow-glow-green active:scale-90 transition-transform">
                <Plus size={20} strokeWidth={3}/>
              </button>
            )}
          </div>
        </div>

        <div className={`grid transition-all duration-300 ease-in-out overflow-hidden ${isFilterExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
          <div className="min-h-0 space-y-3 pb-1">
            <div className="flex gap-3">
              <div className="relative group flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-chiachia-green transition-colors" size={14} />
                <input type="text" placeholder="搜尋賽事或參賽隊員..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-zinc-900/40 border border-white/5 rounded-xl py-2 pl-9 pr-9 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-chiachia-green/30 focus:bg-zinc-900 transition-all font-bold" />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs">✕</button>}
              </div>
              <div className="relative shrink-0 w-32">
                <select value={selectedSeries} onChange={e => setSelectedSeries(e.target.value)} className="w-full appearance-none bg-zinc-900/40 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-zinc-400 outline-none focus:border-chiachia-green/30">
                  <option value="all">所有系列</option>
                  <option value="">獨立賽事</option>
                  {raceGroups.map((g: any) => <option key={g.id} value={String(g.id)}>{g.name || g.series_name}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"/>
              </div>
            </div>

            <div className="relative w-full">
              {isDateMenuOpen && (
                <div className="absolute top-0 left-0 right-0 mt-1 bg-zinc-950 border border-white/10 rounded-2xl p-2 shadow-2xl z-50 grid grid-cols-5 gap-1.5 animate-scale-in">
                  {(['1W', '1M', '3M', 'ALL', 'PICK'] as const).map(m => (
                    <button key={m} onClick={() => { setDateRangeMode(m); setIsDateMenuOpen(false); }} className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${dateRangeMode === m ? 'bg-white text-black border-white' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}>
                      {m === 'PICK' ? '自訂' : m === '1W' ? '1週' : m === '1M' ? '1月' : m === '3M' ? '3月' : '全部'}
                    </button>
                  ))}
                </div>
              )}
              {dateRangeMode === 'PICK' && (
                <div className="grid grid-cols-2 gap-3 bg-zinc-900/30 border border-white/5 rounded-xl p-2.5 animate-slide-down">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-zinc-500 font-bold w-6">Start</span>
                    <input type="date" value={customDateRange.start} onChange={e => setCustomDateRange({...customDateRange, start: e.target.value})} className="bg-zinc-800 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white w-full outline-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-zinc-500 font-bold w-6">End</span>
                    <input type="date" value={customDateRange.end} onChange={e => setCustomDateRange({...customDateRange, end: e.target.value})} className="bg-zinc-800 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white w-full outline-none" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex bg-zinc-900/60 p-1 rounded-xl h-9 w-full">
              {(['all', 'joined', 'open', 'finished'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${tab === t ? 'bg-zinc-800 text-chiachia-green shadow-inner' : 'text-zinc-600'}`}>
                  {t === 'all' ? '全部' : t === 'joined' ? '已報名' : t === 'open' ? '可報名' : '結束'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`h-full overflow-y-auto px-4 ${paddingTopClass} pb-32 space-y-4 no-scrollbar transition-all duration-300`}>
        {loading ? (
          <div className="flex flex-col items-center py-24 text-zinc-800 gap-3">
            <Loader2 className="animate-spin text-chiachia-green/40" size={24} />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700">Syncing Arena</span>
          </div>
        ) : sortedEvents.length > 0 ? (
          <>
            {visibleEvents.map(event => {
              const eDate = parseISO(event.date);
              const isPast = !isAfter(eDate, subDays(new Date(), 1));
              const hasJoined = user && event.participants?.some(p => String(p.people_id || p.id) === String(user.id));
              const selfParticipant = hasJoined ? event.participants?.find(p => String(p.people_id || p.id) === String(user.id)) : undefined;
              const isExpanded = expandedEventId === event.id;
              const visualIsPast = isPast && !isExpanded;
              const publicPhoto = event.url;
              const userPhoto = selfParticipant?.photo_url;
              const images = userPhoto ? [userPhoto, publicPhoto].filter(Boolean) : [publicPhoto].filter(Boolean);
              const seriesName = raceGroups.find((g: any) => String(g.id) === String(event.series_id))?.name || 'Standard';
              const cardBorderClass = visualIsPast ? 'border-white/5 bg-zinc-950/20' : hasJoined ? 'border-chiachia-green/30 bg-chiachia-green/5' : 'border-white/5 bg-zinc-950/40';
              const grayscaleClass = visualIsPast ? 'opacity-60 grayscale' : '';

              return (
                <div key={event.id} id={`race-card-${event.id}`} className="relative group animate-fade-in">
                  <div className={`relative glass-card rounded-[28px] overflow-hidden border backdrop-blur-xl transition-all ${cardBorderClass} ${grayscaleClass} active:scale-[0.98] active:bg-zinc-800/50`} onClick={() => setExpandedEventId(isExpanded ? null : event.id)}>
                    {images.length > 0 && (
                      <div className="absolute inset-0 z-0 flex overflow-x-auto snap-x snap-mandatory no-scrollbar">
                        {images.map((img, idx) => (
                          <div key={idx} className="w-full h-full shrink-0 snap-center relative">
                            <img src={img} className={`w-full h-full object-cover mask-gradient-to-t ${visualIsPast ? 'opacity-20' : 'opacity-60 brightness-110'}`} />
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent"></div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-4 p-5 relative z-10 pr-12 pl-5 pointer-events-none">
                      <div className={`w-14 h-16 rounded-2xl flex flex-col items-center justify-center border transition-colors shrink-0 ${visualIsPast ? 'bg-zinc-900 border-white/5' : hasJoined ? 'bg-chiachia-green/10 border-chiachia-green/30' : 'bg-zinc-900 border-amber-500/20'}`}>
                        <span className={`text-[9px] font-black uppercase tracking-tighter ${visualIsPast ? 'text-zinc-600' : hasJoined ? 'text-chiachia-green' : 'text-amber-500'}`}>{format(eDate, 'MMM')}</span>
                        <span className="text-xl font-black text-white leading-none">{format(eDate, 'dd')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${hasJoined ? 'bg-chiachia-green text-black shadow-glow-green' : 'bg-zinc-800 text-zinc-500'}`}>
                            {hasJoined ? 'JOINED' : isPast ? 'FINISHED' : 'OPEN'}
                          </span>
                          <span className="text-[9px] text-zinc-600 font-bold truncate tracking-widest uppercase">{seriesName}</span>
                        </div>
                        <h3 className="text-md font-black text-white italic truncate tracking-tight">{event.name}</h3>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-bold mt-1.5 relative z-20">
                          <button onClick={(e) => handleLocationClick(e, event.location || '')} className="flex items-center gap-1 hover:text-chiachia-green cursor-pointer pointer-events-auto">
                            <MapPin size={10}/>
                            <span className="underline decoration-zinc-700 underline-offset-2">{formatLocation(event.location)}</span>
                          </button>
                        </div>
                      </div>
                      
                      {/* 🟢 修正報名點擊：完美相容 Riders 與教練代報名模式 */}
                      {(!isPast || hasJoined || canManage) && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (isRiderMode && hasJoined) { 
                                handleExitRace(event.id, user.id); 
                              } else { 
                                openJoinModal(event, selfParticipant); 
                              } 
                            }} 
                            className={`p-3 rounded-xl transition-all shadow-lg border active:scale-95 ${hasJoined ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-white/10 border-white/20 text-white'}`}
                          >
                            {hasJoined ? <LogOut size={20} /> : <UserPlus size={20} />}
                          </button>
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-white/5 bg-zinc-900/30 backdrop-blur-sm px-4 py-4 space-y-3 relative z-20 animate-slide-down" onClick={(e) => e.stopPropagation()}>
                        <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 flex items-center justify-between">
                          <span>Participants ({event.participants?.length || 0})</span>
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); handleShareEvent(event); }} className="flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded-lg text-zinc-400 text-[9px] font-bold active:scale-95 transition-all hover:text-white">
                              <Share2 size={10} /> 分享
                            </button>
                            {canManage && <button onClick={() => openCreateModal(event)} className="flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded-lg text-zinc-400 text-[9px] font-bold active:scale-95 transition-all hover:text-white"><Edit2 size={10} /> 編輯</button>}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {event.participants && event.participants.map((p) => {
                            const pid = String(p.people_id || p.id);
                            const isSelf = pid === String(user?.id);
                            const canEdit = canManage || isSelf;
                            const isPersonalHonor = !!p.is_personal_honor;
                            const globalHonorExpiry = p.global_honor_expires_at || 0;
                            const isGlobalHonorActive = globalHonorExpiry > now;
                            const timeLeftSeconds = globalHonorExpiry - now;
                            const daysLeft = Math.floor(timeLeftSeconds / 86400);

                            return (
                              <div key={pid} id={isSelf ? `self-row-${event.id}` : undefined} className={`flex items-center gap-3 p-2 rounded-xl border ${isSelf ? 'bg-zinc-800/50 border-chiachia-green/30' : 'bg-black/20 border-white/5'}`}>
                                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 overflow-hidden flex-shrink-0 relative">
                                  {p.s_url ? <img src={p.s_url.split('#')[0]} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-zinc-600"><UserPlus size={16}/></div>}
                                  {isPersonalHonor && <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[8px] p-0.5 rounded-full border border-black"><Flame size={8} fill="black"/></div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm font-bold truncate ${isSelf ? 'text-white' : 'text-zinc-400'}`}>{p.name} {isSelf && '(Me)'}</div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {p.race_group ? <div className="text-[10px] text-amber-400 font-black uppercase flex items-center gap-1 shrink-0"><Trophy size={10}/> RANK: {p.race_group}</div> : <div className="text-[9px] text-zinc-600 font-bold uppercase">尚未登錄成績</div>}
                                    {(isSelf && p.note) && <button onClick={() => setNoteModal({show: true, text: p.note || ''})} className="text-[10px] text-chiachia-green font-bold truncate max-w-[100px]"><MessageCircle size={8} className="inline mr-1"/>{p.note}</button>}
                                  </div>
                                </div>
                                
                                {isPast && isSelf && p.race_group && !canManage && (
                                  <button onClick={() => setPersonalHonorConfirm({ show: true, event, participant: p })} className={`w-8 h-8 flex items-center justify-center rounded-full transition-all border active:scale-95 ${isPersonalHonor ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-glow-gold' : 'bg-zinc-800 text-zinc-500 border-white/5'}`}>
                                    <Flame size={14} className={isPersonalHonor ? 'fill-amber-500' : ''} />
                                  </button>
                                )}
                                
                                {isPast && canManage && p.race_group && (
                                  <button onClick={() => setGlobalHonorConfirm({ show: true, event, participant: p })} className={`h-8 px-2 flex items-center justify-center rounded-full transition-all border active:scale-95 gap-1 ${isGlobalHonorActive ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-zinc-800 text-zinc-500 border-white/5'}`}>
                                    <Flame size={14} className={isGlobalHonorActive ? 'fill-black' : ''} />
                                    {isGlobalHonorActive && (
                                      <span className="text-[9px] font-black font-mono">
                                        {daysLeft > 0 ? `${daysLeft}D` : `${Math.floor(timeLeftSeconds/60)}m`}
                                      </span>
                                    )}
                                  </button>
                                )}
                                {canEdit && (
                                  <button onClick={() => openJoinModal(event, p)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-white"><Edit2 size={14}/></button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {!isExpanded && (
                      <div className="px-5 pb-4 pt-2 flex items-center justify-between border-t border-white/5 relative z-10 cursor-pointer pointer-events-none">
                        <div className="flex items-center gap-3">
                          {event.participants && event.participants.length > 0 ? (
                            <div className="flex -space-x-1.5">
                              {event.participants.slice(0, 5).map((p) => (
                                <div key={String(p.id || p.people_id)} className="w-5 h-5 rounded-full border border-black bg-zinc-800 overflow-hidden flex-shrink-0">
                                  {p.s_url ? (
                                    <img src={p.s_url.split('#')[0]} className="w-full h-full object-cover"/>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[8px] text-zinc-500 font-bold">{p.name?.[0]}</div>
                                  )}
                                </div>
                              ))}
                              {event.participants.length > 5 && (
                                <div className="w-5 h-5 rounded-full border border-black bg-zinc-800 flex items-center justify-center text-[8px] text-zinc-500 font-black">
                                  +{event.participants.length - 5}
                                </div>
                              )}
                            </div>
                          ) : null}
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                            {event.participants?.length ? `${event.participants.length} 人參加` : '尚無選手'}
                          </span>
                        </div>
                        <div className="text-zinc-600 p-2"><ChevronDown size={20} /></div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-zinc-950/60 border border-white/5 rounded-2xl p-3 mx-1 mt-6 animate-fade-in backdrop-blur-md">
                <button
                  onClick={() => {
                    setCurrentPage(prev => Math.max(prev - 1, 1));
                    const listEl = document.querySelector('.overflow-y-auto');
                    if (listEl) listEl.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all bg-zinc-900 border-white/5 text-zinc-400 active:scale-95 disabled:opacity-20 disabled:pointer-events-none"
                >
                  ← 往左翻
                </button>
                
                <div className="flex flex-col items-center justify-center font-mono">
                  <span className="text-xs font-black text-chiachia-green leading-none">{currentPage}</span>
                  <span className="text-[9px] text-zinc-600 font-bold uppercase mt-1">OF {totalPages} PAGES</span>
                </div>

                <button
                  onClick={() => {
                    setCurrentPage(prev => Math.min(prev + 1, totalPages));
                    const listEl = document.querySelector('.overflow-y-auto');
                    if (listEl) listEl.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all bg-zinc-900 border-white/5 text-zinc-400 active:scale-95 disabled:opacity-20 disabled:pointer-events-none"
                >
                  往右翻 →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center py-32 opacity-20 grayscale">
            <Trophy size={64}/>
            <span className="text-[10px] font-black tracking-widest uppercase mt-4">No Race Events Found</span>
          </div>
        )}
        <div className="h-12 w-full"></div>
      </div>

      {/* Note Modal */}
      {noteModal.show && createPortal(
        <div className="fixed inset-0 z-[30000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setNoteModal({show: false, text: ''})}>
          <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-chiachia-green/20 text-center animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="text-zinc-300 text-sm font-bold bg-zinc-900/50 p-4 rounded-xl border border-white/5">{noteModal.text}</div>
            <div className="mt-6"><button onClick={() => setNoteModal({show: false, text: ''})} className="w-full py-3 bg-zinc-800 text-white font-bold rounded-xl">關閉</button></div>
          </div>
        </div>,
        document.body
      )}

      {/* Personal Honor Modal */}
      {personalHonorConfirm.show && createPortal(
        <div className="fixed inset-0 z-[30000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-amber-500/20 text-center animate-scale-in shadow-glow-gold">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4"><Flame size={32} className="fill-amber-500"/></div>
            <h3 className="text-xl font-black text-white italic mb-2">個人榮譽榜</h3>
            <p className="text-zinc-400 text-sm font-bold mb-6">{personalHonorConfirm.participant?.is_personal_honor ? '要將此賽事從您的個人榮譽榜移除嗎？' : '要將此賽事加入個人榮譽榜嗎？(顯示於數據頁面)'}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPersonalHonorConfirm({ show: false })} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl">取消</button>
              <button onClick={handleTogglePersonalHonor} disabled={submitting} className="py-3 bg-amber-600 text-white font-black rounded-xl flex items-center justify-center">{submitting ? <Loader2 size={16} className="animate-spin" /> : '確認'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Global Honor Modal */}
      {globalHonorConfirm.show && createPortal(
        <div className="fixed inset-0 z-[30000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-amber-500/20 text-center animate-scale-in shadow-xl">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4"><Flame size={32} className="fill-amber-500" /></div>
            <h3 className="text-xl font-black text-white italic mb-2">全域榮譽榜 (教練)</h3>
            <p className="text-zinc-400 text-sm font-bold mb-6">{(globalHonorConfirm.participant?.global_honor_expires_at || 0) > now ? '要將此成績從全域榮譽榜移除嗎？' : '要將此成績加入全域榮譽榜嗎？(全站可見)'}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setGlobalHonorConfirm({ show: false })} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl">取消</button>
              <button onClick={handleToggleGlobalHonor} disabled={submitting} className="py-3 bg-amber-600 text-white font-black rounded-xl flex items-center justify-center">{submitting ? <Loader2 size={16} className="animate-spin" /> : '確認'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create/Edit Event Modal */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 z-[60000] flex items-end justify-center bg-black/90 backdrop-blur-md animate-fade-in pb-[env(safe-area-inset-bottom)]" onClick={() => setShowCreateModal(false)}>
          <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar mb-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center border-b border-white/5 pb-4 gap-3">
              <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button>
              <h3 className="text-xl font-black text-white italic">{isEditMode ? '編輯賽事' : '新增賽事'}</h3>
            </div>
            <div className="space-y-4">
              <div className="w-full">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 block">賽事封面</label>
                <div className="relative w-full aspect-video rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden group">
                  {createForm.url ? <img src={createForm.url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center flex-col gap-2 text-zinc-600"><ImageIcon size={32}/><span className="text-[10px] font-bold">無封面</span></div>}
                  <label htmlFor="upload-race-cover" className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                    <Camera size={24} className="text-white drop-shadow-lg mb-1"/>
                    <span className="text-[10px] text-white font-bold bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">上傳封面</span>
                  </label>
                  <input type="file" accept="image/*" className="hidden" id="upload-race-cover" onChange={handleCoverUploadStart} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">賽事名稱</label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 font-bold"/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">日期</label>
                <input type="date" value={createForm.date} onChange={e => setCreateForm({...createForm, date: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50"/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">地點</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                  <input type="text" value={createForm.location} onChange={e => setCreateForm({...createForm, location: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:border-chiachia-green/50"/>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">系列賽</label>
                <div className="relative">
                  <select value={createForm.series_id} onChange={e => setCreateForm({...createForm, series_id: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none appearance-none focus:border-chiachia-green/50">
                    <option value="">(無)</option>
                    {raceGroups.map((g: any) => <option key={g.id} value={g.id}>{g.name || g.series_name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                </div>
              </div>
              <button onClick={handleCreate} disabled={submitting} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 mt-2">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : '儲存賽事'}
              </button>
              {isEditMode && (
                <button onClick={handleDeleteRaceEvent} disabled={submitting} className="w-full py-3 bg-zinc-900 text-rose-500 font-bold rounded-xl border border-white/5 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs mt-1">
                  <Trash2 size={14}/> 刪除此場賽事
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Join Race / Edit Record Modal */}
      {showJoinModal.show && createPortal(
        <div className="fixed inset-0 z-[60000] flex items-end justify-center bg-black/90 backdrop-blur-md animate-fade-in pb-[env(safe-area-inset-bottom)]" onClick={() => setShowJoinModal({show: false})}>
          <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar mb-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center border-b border-white/5 pb-4 justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowJoinModal({show: false})} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button>
                <h3 className="text-xl font-black text-white italic">{showJoinModal.participant ? '編輯選手成績' : '報名賽事'}</h3>
              </div>
              {showJoinModal.participant && canManage && (
                <button onClick={() => handleExitRace(showJoinModal.event!.id, showJoinModal.participant.people_id || showJoinModal.participant.id)} className="px-3 py-1.5 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20 text-xs font-bold active:scale-95 flex items-center gap-1"><Trash2 size={12}/> 移除名單</button>
              )}
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-zinc-900/60 rounded-2xl border border-white/5 flex flex-col gap-1">
                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Target Arena</span>
                <span className="text-sm font-black text-white truncate">{showJoinModal.event?.name}</span>
                <span className="text-[10px] text-zinc-400 font-mono font-bold">{showJoinModal.event?.date} · {showJoinModal.event?.location || '未定地點'}</span>
              </div>
              
              {/* 🟢 核心修正：不管是教練代辦還是選手自己報名，selectedPeopleId 都有牢固的基礎值，不再噴 undefined */}
              {canManage ? (
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">指定報名選手</label>
                  <div className="relative">
                    <select value={selectedPeopleId} onChange={e => setSelectedPeopleId(e.target.value)} className="w-full appearance-none bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none font-bold focus:border-chiachia-green/50">
                      {people.filter(p => !p.is_hidden && !hasRole(p, ROLES.DEV)).map(p => <option key={p.id} value={p.id}>{p.full_name || p.name} ({p.name})</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                  </div>
                </div>
              ) : (
                <input type="hidden" value={selectedPeopleId} />
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">秒數紀錄</label>
                  <input type="text" placeholder="例如: 12.345" value={joinForm.value} onChange={e => setJoinForm({...joinForm, value: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white font-mono font-bold text-center text-lg outline-none focus:border-chiachia-green/50 placeholder:text-zinc-700"/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">分組 / 名次</label>
                  <input type="text" placeholder="例如: 冠軍" value={joinForm.race_group} onChange={e => setJoinForm({...joinForm, race_group: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-center text-sm outline-none focus:border-chiachia-green/50 placeholder:text-zinc-700"/>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">個人參賽備註</label>
                <input type="text" placeholder="板選賽道或當日心得..." value={joinForm.note} onChange={e => setJoinForm({...joinForm, note: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 placeholder:text-zinc-700 font-bold text-xs"/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">選手個人完賽照片</label>
                <div className="relative w-full aspect-[4/5] max-h-48 rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden group">
                  {joinForm.photo_url ? <img src={joinForm.photo_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center flex-col gap-2 text-zinc-600"><ImageIcon size={24}/><span className="text-[9px] font-bold">無個人紀錄照</span></div>}
                  <label htmlFor="upload-participant-photo" className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                    <Camera size={20} className="text-white drop-shadow-lg mb-1"/>
                    <span className="text-[9px] text-white font-bold bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">上傳照片</span>
                  </label>
                  <input type="file" accept="image/*" className="hidden" id="upload-participant-photo" onChange={handleParticipantUploadStart} />
                </div>
              </div>
              <button onClick={handleJoin} disabled={submitting} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 mt-2">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : showJoinModal.participant ? '儲存成績變更' : '確認登記參賽'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Event Safety Confirm Modal */}
      {deleteConfirm.show && createPortal(
        <div className="fixed inset-0 z-[70000] flex items-center justify-center p-6 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-rose-500/20 text-center animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20"><AlertTriangle size={32}/></div>
            <h3 className="text-xl font-black text-white italic mb-2">危險操作確認</h3>
            <p className="text-zinc-400 text-sm font-bold mb-6">您確定要永久刪除此賽事嗎？此動作將連同已登記的 <span className="text-rose-500 font-mono font-black">{deleteConfirm.count} 名選手成績</span> 一併洗掉且無法復原！</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteConfirm({ show: false })} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl">取消</button>
              <button onClick={confirmDeleteRaceEvent} disabled={submitting} className="py-3 bg-rose-600 text-white font-black rounded-xl flex items-center justify-center">{submitting ? <Loader2 size={16} className="animate-spin" /> : '確認強迫刪除'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Exit Race Confirm Modal */}
      {exitConfirm.show && createPortal(
        <div className="fixed inset-0 z-[70000] flex items-center justify-center p-6 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-rose-500/20 text-center animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20"><AlertCircle size={32}/></div>
            <h3 className="text-xl font-black text-white italic mb-2">確認取消參賽</h3>
            <p className="text-zinc-400 text-sm font-bold mb-6">您確定要移除該名選手的參賽紀錄嗎？</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setExitConfirm({ show: false })} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl">取消</button>
              <button onClick={confirmExitRace} disabled={submitting} className="py-3 bg-rose-600 text-white font-black rounded-xl flex items-center justify-center">{submitting ? <Loader2 size={16} className="animate-spin" /> : '確認退賽'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Image Cropper Modal Layer */}
      {cropImageSrc && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black flex flex-col">
          <div className="flex-none px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] flex justify-between items-center bg-black z-10 border-b border-white/10">
            <button onClick={() => setCropImageSrc(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:bg-zinc-800 transition-all"><X size={20} /></button>
            <span className="text-sm font-black text-white italic tracking-wider">ADJUST PHOTO</span>
            <button onClick={handleCropSave} className="h-10 px-5 bg-chiachia-green text-black font-black rounded-full flex items-center gap-2 shadow-glow-green active:scale-95 transition-all text-xs">
              {uploading ? <Loader2 className="animate-spin" size={14}/> : <Check size={14} />} SAVE
            </button>
          </div>
          <div className="flex-1 relative bg-zinc-900 w-full overflow-hidden">
            <SimpleImageCropper image={cropImageSrc} crop={crop} zoom={zoom} aspect={cropAspect} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} showGrid={true} style={{ containerStyle: { background: '#000' } }} />
          </div>
          <div className="flex-none px-6 py-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] bg-black flex items-center gap-4 border-t border-white/10">
            <ZoomIn size={20} className="text-zinc-500" />
            <input type="range" value={zoom} min={1} max={3} step={0.1} aria-labelledby="Zoom" onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-chiachia-green" />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Races;
