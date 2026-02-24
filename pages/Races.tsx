
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { uploadImage } from '../services/supabase';
import { RaceEvent, RaceParticipant, LookupItem } from '../types';
import { MapPin, Loader2, Plus, Search, UserPlus, CalendarDays, CheckCircle2, X, ChevronDown, ChevronUp, Trophy, ArrowRight, Image as ImageIcon, UploadCloud, Trash2, Edit2, LogOut, ExternalLink, Map, AlertTriangle, Users, ZoomIn, Check, AlertCircle, Camera, MessageCircle, Medal, Zap, Clock, Flame, SlidersHorizontal, Share2 } from 'lucide-react';
import { format, subDays, addDays, subMonths, addMonths, isAfter, parseISO, isWithinInterval, startOfDay, endOfDay, isValid, differenceInDays } from 'date-fns';
import { SimpleImageCropper } from '../components/SimpleImageCropper';
import { hasRole, hasPermission, ROLES, PERMISSIONS } from '../utils/auth';

// Canvas Crop Utility
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
  const [loading, setLoading] = useState(false); // Kept for async operations like uploading
  const [search, setSearch] = useState('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  
  const [expandedEventId, setExpandedEventId] = useState<string | number | null>(initialExpandedEventId);
  const [noteModal, setNoteModal] = useState<{show: boolean, text: string}>({ show: false, text: '' });
  
  // Date Range State
  const [dateRangeMode, setDateRangeMode] = useState<'1W' | '1M' | '3M' | 'ALL' | 'PICK'>('1M');
  const [customDateRange, setCustomDateRange] = useState<{start: string, end: string}>({
      start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
      end: format(addMonths(new Date(), 3), 'yyyy-MM-dd')
  });
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);

  const [tab, setTab] = useState<'all' | 'joined' | 'open' | 'finished'>('all');
  const [selectedSeries, setSelectedSeries] = useState<string>('all');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState<{show: boolean, event?: RaceEvent, participant?: RaceParticipant}>({ show: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id?: string|number, count?: number}>({ show: false });
  const [exitConfirm, setExitConfirm] = useState<{show: boolean, eventId?: string|number, peopleId?: string|number}>({ show: false });
  
  const [personalHonorConfirm, setPersonalHonorConfirm] = useState<{show: boolean, event?: RaceEvent, participant?: RaceParticipant}>({ show: false });
  const [globalHonorConfirm, setGlobalHonorConfirm] = useState<{show: boolean, event?: RaceEvent, participant?: RaceParticipant}>({ show: false });
  
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  
  const [activeUploadEventId, setActiveUploadEventId] = useState<string|number|null>(null);
  const [activeUploadPeopleId, setActiveUploadPeopleId] = useState<string|number|null>(null);

  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  const user = api.getUser();
  const canManage = hasPermission(user, PERMISSIONS.RACE_MANAGE) || user?.role === 'admin' || hasRole(user, ROLES.DEV);

  const [createForm, setCreateForm] = useState({
    id: '',
    name: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    location: '',
    series_id: '',
    url: ''
  });

  const [joinForm, setJoinForm] = useState({
    people_id: '',
    ranking: '',
    note: ''
  });

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
      if (initialExpandedEventId && raceEvents.length > 0) {
          setTab('all');
          setDateRangeMode('ALL');
          setExpandedEventId(initialExpandedEventId);
          
          setTimeout(() => {
              const el = document.getElementById(`race-card-${initialExpandedEventId}`);
              if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('animate-pulse');
                  setTimeout(() => el.classList.remove('animate-pulse'), 1500);
              }
          }, 500);
      }
  }, [initialExpandedEventId, raceEvents.length]);

  const handleCreate = async () => {
      if (!createForm.name || !createForm.date) return;
      setSubmitting(true);
      try {
          await api.manageRaceEvent('create', createForm);
          await refreshData();
          setShowCreateModal(false);
          resetCreateForm();
      } catch (e: any) {
          alert(`操作失敗: ${e.message}`);
      } finally {
          setSubmitting(false);
      }
  };
  
  const confirmDeleteEvent = async () => {
      if (!deleteConfirm.id) return;
      setSubmitting(true);
      try {
          await api.manageRaceEvent('delete', { id: deleteConfirm.id });
          await refreshData();
          setShowCreateModal(false);
          setDeleteConfirm({ show: false });
      } catch (e: any) {
          alert(`刪除失敗: ${e.message}`);
      } finally {
          setSubmitting(false);
      }
  };
  
  const handleExitRace = async (eventId: string|number, peopleId: string|number) => {
      setExitConfirm({ show: true, eventId, peopleId });
  };

  const confirmExitRace = async () => {
      if (!exitConfirm.eventId || !exitConfirm.peopleId) return;
      setSubmitting(true);
      try {
          await api.exitRace(exitConfirm.eventId, exitConfirm.peopleId);
          await refreshData();
          setShowJoinModal({ show: false });
          setExitConfirm({ show: false });
      } catch (e: any) {
          alert(`退出失敗: ${e.message}`);
      } finally {
          setSubmitting(false);
      }
  };

  const resetCreateForm = () => {
      const defaultSeries = raceGroups.filter((g: any) => g.name !== '(None)' && g.series_name !== '(None)')[0];
      setCreateForm({
          id: '',
          name: '',
          date: format(new Date(), 'yyyy-MM-dd'),
          location: '',
          series_id: defaultSeries ? String(defaultSeries.id) : '',
          url: ''
      });
      setIsEditMode(false);
  };

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
          resetCreateForm();
      }
      setShowCreateModal(true);
  };

  const handleCoverUploadStart = (e: React.ChangeEvent<HTMLInputElement>, eventId?: string|number, peopleId?: string|number) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      if (eventId && peopleId) {
          setActiveUploadEventId(eventId);
          setActiveUploadPeopleId(peopleId);
      } else {
          setActiveUploadEventId(null);
          setActiveUploadPeopleId(null);
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => {
          setCropImageSrc(reader.result?.toString() || null);
          setZoom(1);
          setCrop({ x: 0, y: 0 });
      });
      reader.readAsDataURL(file);
      e.target.value = '';
  };
  
  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropSave = async () => {
      if (!cropImageSrc || !croppedAreaPixels) return;
      setUploading(true);
      try {
          const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);
          const file = new File([croppedBlob], `race_cover_${Date.now()}.jpg`, { type: 'image/jpeg' });
          
          if (activeUploadEventId && activeUploadPeopleId) {
              const res = await uploadImage(file, 'race', { raceName: 'user_upload' });
              if (res.url) {
                   const evt = raceEvents.find(e => String(e.id) === String(activeUploadEventId));
                   const p = evt?.participants.find(p => String(p.id) === String(activeUploadPeopleId));
                   
                   await api.joinOrUpdateRace(
                       activeUploadEventId, 
                       activeUploadPeopleId, 
                       undefined, 
                       p?.race_group, 
                       p?.note, 
                       res.url,
                       p?.is_personal_honor
                   );
                   await refreshData();
                   setCropImageSrc(null);
                   setShowJoinModal({ show: false });
              } else {
                   alert('上傳失敗: ' + res.error);
              }
          } else {
              const res = await uploadImage(file, 'race', { raceName: createForm.name, raceDate: createForm.date });
              if (res.url) {
                  setCreateForm({ ...createForm, url: res.url });
                  setCropImageSrc(null);
              } else {
                  alert('上傳失敗: ' + res.error);
              }
          }
      } catch (error) {
          console.error(error);
          alert('上傳發生錯誤');
      } finally {
          setUploading(false);
      }
  };

  const openJoinModal = (event: RaceEvent, participant?: RaceParticipant) => {
      let defaultPid = '';
      if (!participant && user && !canManage) defaultPid = String(user.id);
      else if (participant) defaultPid = String(participant.people_id || participant.id);

      setJoinForm({
          people_id: defaultPid,
          ranking: participant?.race_group || '',
          note: participant?.note || ''
      });
      
      if (participant) {
          setBulkSelectedIds([String(participant.people_id || participant.id)]);
      } else {
          setBulkSelectedIds([]);
      }
      
      setShowJoinModal({ show: true, event, participant });
  };

  const handleJoinOrUpdate = async () => {
      if (!showJoinModal.event) return;
      const eDate = parseISO(showJoinModal.event.date);
      const isPast = !isAfter(eDate, subDays(new Date(), 1));
      
      if (canManage) {
          if (bulkSelectedIds.length === 0 && !joinForm.people_id) {
              alert("請選擇至少一位選手");
              return;
          }
      } else {
          if (!joinForm.people_id) {
              alert("請選擇選手");
              return;
          }
      }

      setSubmitting(true);
      try {
          if (canManage && !showJoinModal.participant && !isPast) {
              await Promise.all(bulkSelectedIds.map(pid => 
                  api.joinOrUpdateRace(showJoinModal.event!.id, pid, '', '', '')
              ));
          } else {
              const pid = canManage && !showJoinModal.participant ? bulkSelectedIds[0] : joinForm.people_id;
              await api.joinOrUpdateRace(showJoinModal.event!.id, pid, '', joinForm.ranking, joinForm.note);
          }
          await refreshData();
          setShowJoinModal({ show: false });
      } catch (e: any) {
          alert(`登記失敗: ${e.message}`);
      } finally {
          setSubmitting(false);
      }
  };

  const toggleBulkSelect = (id: string, isSingleMode: boolean) => {
      if (isSingleMode) {
          setBulkSelectedIds([id]);
          setJoinForm(prev => ({ ...prev, people_id: id }));
      } else {
          setBulkSelectedIds(prev => 
              prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
          );
      }
  };

  const handleLocationClick = (e: React.MouseEvent, location: string) => {
      e.stopPropagation();
      e.preventDefault();
      if (!location) return;
      if (location.startsWith('http')) {
          window.open(location, '_blank');
      } else {
          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank');
      }
  };

  const handleTogglePersonalHonor = async () => {
      if (!personalHonorConfirm.event || !personalHonorConfirm.participant) return;
      
      setSubmitting(true);
      const p = personalHonorConfirm.participant;
      const newStatus = !p.is_personal_honor;
      
      const targetPeopleId = p.people_id || user?.id;

      if (!targetPeopleId) {
          alert("錯誤：找不到選手 ID");
          setSubmitting(false);
          return;
      }

      try {
          await api.joinOrUpdateRace(
              personalHonorConfirm.event.id, 
              targetPeopleId,
              p.value || '', 
              p.race_group || '', 
              p.note || '', 
              p.photo_url || undefined, 
              newStatus
          );
          await refreshData();
          setPersonalHonorConfirm({ show: false });
      } catch (e) {
          console.error("Personal Honor Toggle Failed", e);
          alert('更新失敗，請檢查網路連線');
      } finally {
          setSubmitting(false);
      }
  };

  const handleToggleGlobalHonor = async () => {
      if (!globalHonorConfirm.event || !globalHonorConfirm.participant) return;
      
      setSubmitting(true);
      const p = globalHonorConfirm.participant;
      // @ts-ignore
      const isGlobalActive = p.global_honor_expires_at > now;
      
      try {
          await api.setGlobalHonor(p.id, isGlobalActive ? -1 : 43200);
          await refreshData();
          setGlobalHonorConfirm({ show: false });
      } catch (e) {
          alert('更新失敗');
      } finally {
          setSubmitting(false);
      }
  };

  const handleShareEvent = async (event: RaceEvent) => {
      // 1. Get Footer
      let footerText = "";
      try {
          const templates = await api.fetchPushTemplates();
          footerText = templates.share_footer_text_race || templates.share_footer_text || "";
      } catch (e) {
          console.error("Failed to fetch share footer", e);
      }

      // 2. Check Past
      const eDate = parseISO(event.date);
      const isPast = !isAfter(eDate, subDays(new Date(), 1));

      // 3. Build Text
      let text = `🏆 ${event.name}\n`;
      text += `📅 ${event.date} 📍 ${event.location || 'TBA'}\n\n`;
      
      const participants = event.participants || [];
      text += `參加名單(${participants.length})\n`;

      participants.forEach((p, idx) => {
          text += `${idx + 1}. ${p.name}`;
          if (isPast) {
              const rank = p.race_group ? `🏆 ${p.race_group}` : '';
              const score = p.value ? `⏱ ${p.value}` : '';
              // Only add parentheses if there is rank or score
              if (rank || score) {
                  // trim ensures space management if one is missing
                  text += ` (${rank} ${score})`.replace('  ', ' '); 
              }
          }
          text += `\n`;
      });

      if (footerText) {
          text += `\n${footerText}`;
      }

      // 4. Share
      if (navigator.share) {
          try {
              await navigator.share({
                  title: `賽事分享：${event.name}`,
                  text: text,
              });
          } catch (error) {
              console.log('Error sharing', error);
          }
      } else {
          try {
              await navigator.clipboard.writeText(text);
              alert("賽事資訊已複製到剪貼簿");
          } catch (err) {
              alert("無法複製內容");
          }
      }
  };

  const getRangeLabel = () => {
      if (dateRangeMode === 'PICK') {
          try {
              return `${format(parseISO(customDateRange.start), 'MM/dd')} - ${format(parseISO(customDateRange.end), 'MM/dd')}`;
          } catch(e) { return '自訂範圍'; }
      }
      switch(dateRangeMode) {
          case '1W': return '前後 1 週';
          case '1M': return '前後 1 月';
          case '3M': return '前後 3 月';
          case 'ALL': return '全部時間';
          default: return '日期範圍';
      }
  };

  const filteredEvents = useMemo(() => {
      const today = new Date();
      today.setHours(0,0,0,0);
      const currentUserId = user ? String(user.id) : null;
      
      const filtered = raceEvents.filter(e => {
          if (!e.date) return false;
          const eDate = parseISO(e.date);
          if (!isValid(eDate)) return false; 

          if (dateRangeMode === 'PICK') {
              const start = parseISO(customDateRange.start);
              const end = parseISO(customDateRange.end);
              if (isValid(start) && isValid(end)) {
                  return isWithinInterval(eDate, { start: startOfDay(start), end: endOfDay(end) });
              }
              return true;
          } else if (dateRangeMode !== 'ALL') {
              const now = new Date();
              let start = subDays(now, 3650); 
              let end = addDays(now, 3650);

              if (dateRangeMode === '1W') {
                  start = subDays(now, 7);
                  end = addDays(now, 7);
              } else if (dateRangeMode === '1M') {
                  start = subMonths(now, 1);
                  end = addMonths(now, 1);
              } else if (dateRangeMode === '3M') {
                  start = subMonths(now, 3);
                  end = addMonths(now, 3);
              }
              return isWithinInterval(eDate, { start: startOfDay(start), end: endOfDay(end) });
          }

          return true;
      });

      return filtered.filter(e => {
          const eDate = parseISO(e.date);
          const isPast = !isAfter(eDate, subDays(today, 1));
          const personId = (p:any) => String(p.people_id || p.id);
          const hasJoinedSafe = e.participants?.some(p => personId(p) === currentUserId);

          if (tab === 'joined' && !hasJoinedSafe) return false;
          if (tab === 'open' && (isPast || hasJoinedSafe)) return false;
          if (tab === 'finished' && !isPast) return false;
          if (selectedSeries !== 'all' && String(e.series_id) !== String(selectedSeries)) return false;
          if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;

          return true;
      }).sort((a, b) => {
          if (tab === 'finished') {
              return parseISO(b.date).getTime() - parseISO(a.date).getTime();
          }
          if (tab === 'open') {
              return parseISO(a.date).getTime() - parseISO(b.date).getTime();
          }

          const cutoff = subDays(today, 1);
          const isAPast = !isAfter(parseISO(a.date), cutoff);
          const isBPast = !isAfter(parseISO(b.date), cutoff);
          
          if (isAPast && !isBPast) return 1; 
          if (!isAPast && isBPast) return -1;
          
          if (!isAPast) return parseISO(a.date).getTime() - parseISO(b.date).getTime(); 
          return parseISO(b.date).getTime() - parseISO(a.date).getTime(); 
      });
  }, [raceEvents, tab, dateRangeMode, search, selectedSeries, user, customDateRange]);

  const isRiderMode = !canManage;
  const selectablePeople = useMemo(() => {
      return people.filter((p: any) => !p.is_hidden && p.role !== 'admin' && (p.roles?.includes(ROLES.RIDER) || p.roles?.includes(ROLES.AIDE))).sort((a:any, b:any) => a.name.localeCompare(b.name));
  }, [people]);

  const isModalEventPast = useMemo(() => {
      if (!showJoinModal.event) return false;
      const eDate = parseISO(showJoinModal.event.date);
      return !isAfter(eDate, subDays(new Date(), 1));
  }, [showJoinModal.event]);



  useEffect(() => {
    const fetchTitles = async () => {
      const newTitles = {};
      for (const event of filteredEvents) {
        if (event.location && event.location.startsWith('http') && !urlTitles[event.location]) {
          try {
            const response = await fetch(`/api/url-title?url=${encodeURIComponent(event.location)}`);
            if (response.ok) {
              const data = await response.json();
              newTitles[event.location] = data.title || new URL(event.location).hostname.replace('www.', '');
            } else {
              newTitles[event.location] = new URL(event.location).hostname.replace('www.', '');
            }
          } catch (error) {
            console.error('Error fetching URL title:', error);
            newTitles[event.location] = new URL(event.location).hostname.replace('www.', '');
          }
        }
      }
      if (Object.keys(newTitles).length > 0) {
        setUrlTitles(prev => ({ ...prev, ...newTitles }));
      }
    };

    if (filteredEvents.length > 0) {
      fetchTitles();
    }
  }, [filteredEvents]);

  const paddingTopClass = isFilterExpanded ? 'pt-[270px]' : 'pt-[110px]';

  const [urlTitles, setUrlTitles] = useState({});

  const formatLocation = (loc: string) => {
      if (!loc) return '';
      if (loc.startsWith('http')) {
          if (urlTitles[loc]) return urlTitles[loc];
          return 'Loading...';
      }
      return loc;
  };

  return (
    <>
      <div className="h-full bg-black relative">
        {/* HUD Header */}
        <div className="absolute top-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-3xl border-b border-white/5 shadow-2xl transition-all">
           <div className="px-4 py-4 space-y-3 max-w-md mx-auto">
               <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <h2 className="text-[10px] font-black text-zinc-600 tracking-[0.4em] uppercase">Race Events</h2>
                    <div className="text-xl font-black text-white italic tracking-tighter flex items-center gap-2">
                        賽事資訊
                    </div>
                  </div>
                  
                  {/* Toggle Button */}
                  <div className="flex items-center gap-2">
                      {canManage && (
                          <button onClick={() => openCreateModal()} className="w-10 h-10 rounded-xl bg-chiachia-green text-black flex items-center justify-center shadow-glow-green active:scale-90 transition-all">
                              <Plus size={20} strokeWidth={3}/>
                          </button>
                      )}
                      <button 
                          onClick={() => setIsFilterExpanded(!isFilterExpanded)} 
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isFilterExpanded ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-zinc-500'}`}
                      >
                          <SlidersHorizontal size={20} />
                      </button>
                  </div>
               </div>
               
               {/* Collapsible Filter Section */}
               <div className={`transition-all duration-300 ease-in-out space-y-3 ${isFilterExpanded ? 'max-h-[300px] pb-2 opacity-100' : 'max-h-0 pb-0 opacity-0 overflow-hidden'} ${isDateMenuOpen ? 'overflow-visible' : 'overflow-hidden'}`}>
                   {/* Search Input */}
                   <div className="bg-zinc-900/40 rounded-xl flex items-center px-3 border border-white/5 focus-within:border-chiachia-green/40 transition-all h-10">
                       <Search size={14} className="text-zinc-600 shrink-0"/>
                       <input type="text" placeholder="搜尋賽事..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-transparent border-none text-white text-[13px] outline-none placeholder:text-zinc-700 ml-2"/>
                   </div>

                   {/* Filters Row */}
                   <div className="grid grid-cols-2 gap-2">
                       {/* Series Select */}
                       <div className="relative flex items-center px-3 bg-zinc-900/40 rounded-xl border border-white/5 h-10">
                          <select 
                              value={selectedSeries} 
                              onChange={e => setSelectedSeries(e.target.value)} 
                              className={`w-full bg-transparent text-[11px] font-black uppercase tracking-widest outline-none border-none appearance-none pr-5 truncate transition-colors ${selectedSeries !== 'all' ? 'text-chiachia-green drop-shadow-glow' : 'text-zinc-400'}`}
                          >
                              <option value="all">所有系列</option>
                              {raceGroups.map((g: any) => <option key={g.id} value={g.id}>{g.name || g.series_name}</option>)}
                          </select>
                          <ChevronDown size={12} className={`absolute right-3 pointer-events-none transition-colors ${selectedSeries !== 'all' ? 'text-chiachia-green' : 'text-zinc-600'}`} />
                       </div>

                       {/* Date Range Select */}
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
                               <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-2 z-[60] flex flex-col gap-1 animate-scale-in origin-top-right">
                                   <div className="grid grid-cols-2 gap-1 mb-1">
                                       {(['1W', '1M', '3M', 'ALL'] as const).map(opt => (
                                           <button 
                                               key={opt}
                                               onClick={() => { setDateRangeMode(opt); setIsDateMenuOpen(false); }}
                                               className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider ${dateRangeMode === opt ? 'bg-chiachia-green text-black' : 'bg-black/40 text-zinc-400 hover:text-white'}`}
                                           >
                                               {opt === '1W' ? '1 週' : opt === '1M' ? '1 月' : opt === '3M' ? '3 月' : '全部'}
                                           </button>
                                       ))}
                                   </div>
                                   <button 
                                       onClick={() => setDateRangeMode('PICK')}
                                       className={`py-2 px-3 rounded-lg text-left text-xs font-bold transition-all ${dateRangeMode === 'PICK' ? 'bg-zinc-800 text-chiachia-green border border-chiachia-green/30' : 'text-zinc-400 hover:bg-white/5'}`}
                                   >
                                       自訂範圍...
                                   </button>
                                   
                                   {dateRangeMode === 'PICK' && (
                                       <div className="flex flex-col gap-2 p-2 bg-black/40 rounded-xl mt-1 border border-white/5">
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
                           )}
                       </div>
                   </div>

                   {/* Tabs */}
                   <div className="flex bg-zinc-900/60 p-1 rounded-xl h-9 w-full">
                       {(['all', 'joined', 'open', 'finished'] as const).map(t => (
                           <button 
                               key={t} 
                               onClick={() => setTab(t)} 
                               className={`flex-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${tab === t ? 'bg-zinc-800 text-chiachia-green shadow-inner' : 'text-zinc-600'}`}
                           >
                               {t === 'all' ? '全部' : t === 'joined' ? '已報名' : t === 'open' ? '可報名' : '結束'}
                           </button>
                       ))}
                   </div>
               </div>
           </div>
        </div>

        {/* Scrollable Content */}
        <div className={`h-full overflow-y-auto px-4 ${paddingTopClass} pb-32 space-y-4 no-scrollbar transition-all duration-300`}>
           {loading ? (
               <div className="flex flex-col items-center py-24 text-zinc-800 gap-3">
                   <Loader2 className="animate-spin text-chiachia-green/40" size={24} />
                   <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700">Syncing Arena</span>
               </div>
           ) : filteredEvents.length > 0 ? (
               filteredEvents.map(event => {
                   const eDate = parseISO(event.date);
                   const isPast = !isAfter(eDate, subDays(new Date(), 1));
                   const hasJoined = user && event.participants?.some(p => String(p.people_id || p.id) === String(user.id));
                   const selfParticipant = hasJoined ? event.participants?.find(p => String(p.people_id || p.id) === String(user.id)) : undefined;
                   const isExpanded = expandedEventId === event.id;

                   // [NEW] Visual state: if expanded, treat as active for colors
                   const visualIsPast = isPast && !isExpanded;

                   const publicPhoto = event.url;
                   const userPhoto = selfParticipant?.photo_url;
                   const images = userPhoto ? [userPhoto, publicPhoto].filter(Boolean) : [publicPhoto].filter(Boolean);
                   
                   const seriesName = raceGroups.find((g: any) => String(g.id) === String(event.series_id))?.name || 'Standard';

                   // [Updated Style Logic] - Uses visualIsPast instead of isPast
                   const cardBorderClass = visualIsPast 
                        ? 'border-white/5 bg-zinc-950/20' 
                        : hasJoined 
                            ? 'border-chiachia-green/30 bg-chiachia-green/5' 
                            : 'border-white/5 bg-zinc-950/40';
                   
                   const grayscaleClass = visualIsPast ? 'opacity-60 grayscale' : '';

                   return (
                      <div key={event.id} id={`race-card-${event.id}`} className="relative group animate-fade-in">
                          <div className={`relative glass-card rounded-[28px] overflow-hidden border backdrop-blur-xl transition-all ${cardBorderClass} ${grayscaleClass} active:scale-[0.98] active:bg-zinc-800/50`} onClick={() => setExpandedEventId(isExpanded ? null : event.id)}>
                              {/* ... (Images) ... */}
                              {(images.length > 0) && (
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
                                              <MapPin size={10}/> <span className="underline decoration-zinc-700 underline-offset-2">{formatLocation(event.location)}</span>
                                          </button>
                                      </div>
                                  </div>
                                  {(!isPast || hasJoined || canManage) && (
                                      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
                                          <button onClick={(e) => { e.stopPropagation(); if (isRiderMode && hasJoined) { handleExitRace(event.id, user.id); } else { openJoinModal(event, selfParticipant); } }} className={`p-3 rounded-xl transition-all shadow-lg border active:scale-95 ${hasJoined ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-white/10 border-white/20 text-white'}`}>
                                              {hasJoined ? <LogOut size={20} /> : <UserPlus size={20} />}
                                          </button>
                                      </div>
                                  )}
                              </div>
                              
                              {/* Participants List */}
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
                                              
                                              // @ts-ignore
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
                                                      
                                                      {/* 1. Rider Honor Button */}
                                                      {isPast && isSelf && p.race_group && !canManage && (
                                                          <button 
                                                              onClick={() => setPersonalHonorConfirm({ show: true, event, participant: p })}
                                                              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all border active:scale-95 ${isPersonalHonor ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-glow-gold' : 'bg-zinc-800 text-zinc-500 border-white/5'}`}
                                                          >
                                                              <Flame size={14} className={isPersonalHonor ? 'fill-amber-500' : ''} />
                                                          </button>
                                                      )}

                                                      {/* 2. Coach/Admin Global Honor Button */}
                                                      {isPast && canManage && p.race_group && (
                                                          <button 
                                                              onClick={() => setGlobalHonorConfirm({ show: true, event, participant: p })}
                                                              className={`h-8 px-2 flex items-center justify-center rounded-full transition-all border active:scale-95 gap-1 ${isGlobalHonorActive ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-zinc-800 text-zinc-500 border-white/5'}`}
                                                          >
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
                                          {(event.participants && event.participants.length > 0) ? (
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
               })
           ) : (
               <div className="flex flex-col items-center py-32 opacity-20 grayscale">
                   <Trophy size={64}/>
                   <span className="text-[10px] font-black tracking-widest uppercase mt-4">No Race Events Found</span>
               </div>
           )}
           <div className="h-12 w-full"></div>
        </div>
      </div>

      {/* Note Modal */}
      {noteModal.show && createPortal(
          <div className="fixed inset-0 z-[30000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setNoteModal({show: false, text: ''})}>
              <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-chiachia-green/20 text-center animate-scale-in" onClick={e => e.stopPropagation()}>
                  <div className="text-zinc-300 text-sm font-bold bg-zinc-900/50 p-4 rounded-xl border border-white/5">{noteModal.text}</div>
                  <div className="mt-6"><button onClick={() => setNoteModal({show: false, text: ''})} className="w-full py-3 bg-zinc-800 text-white font-bold rounded-xl">關閉</button></div>
              </div>
          </div>
      , document.body)}

      {/* Personal Honor Confirm Modal */}
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
          </div>
      , document.body)}

      {/* Global Honor Confirm Modal (Coach) */}
      {globalHonorConfirm.show && createPortal(
          <div className="fixed inset-0 z-[30000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
              <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-amber-500/20 text-center animate-scale-in shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4"><Flame size={32} className="fill-amber-500" /></div>
                  <h3 className="text-xl font-black text-white italic mb-2">全域榮譽榜 (教練)</h3>
                  {/* @ts-ignore */}
                  <p className="text-zinc-400 text-sm font-bold mb-6">{(globalHonorConfirm.participant?.global_honor_expires_at > now ? '要將此成績從全域榮譽榜移除嗎？' : '要將此成績加入全域榮譽榜嗎？(全站可見)')}</p>
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setGlobalHonorConfirm({ show: false })} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl">取消</button>
                      <button onClick={handleToggleGlobalHonor} disabled={submitting} className="py-3 bg-amber-600 text-white font-black rounded-xl flex items-center justify-center">{submitting ? <Loader2 size={16} className="animate-spin" /> : '確認'}</button>
                  </div>
              </div>
          </div>
      , document.body)}

      {/* Create/Edit Modal */}
      {showCreateModal && createPortal(
          <div className="fixed inset-0 z-[60000] flex items-end justify-center bg-black/90 backdrop-blur-md animate-fade-in pb-[env(safe-area-inset-bottom)]" onClick={() => setShowCreateModal(false)}>
              <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar mb-4 shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center border-b border-white/5 pb-4 gap-3">
                      <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button>
                      <h3 className="text-xl font-black text-white italic">{isEditMode ? '編輯賽事' : '新增賽事'}</h3>
                  </div>
                  
                  <div className="space-y-4">
                      {/* Cover Photo Upload */}
                      <div className="w-full">
                          <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 block">賽事封面</label>
                          <div className="relative w-full aspect-video rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden group">
                              {createForm.url ? <img src={createForm.url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center flex-col gap-2 text-zinc-600"><ImageIcon size={32}/><span className="text-[10px] font-bold">無封面</span></div>}
                              <label htmlFor="upload-race-cover" className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                                  <Camera size={24} className="text-white drop-shadow-lg mb-1"/>
                                  <span className="text-[10px] text-white font-bold bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">上傳封面</span>
                              </label>
                              <input type="file" accept="image/*" className="hidden" id="upload-race-cover" onChange={(e) => handleCoverUploadStart(e)} />
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
                              <select 
                                  value={createForm.series_id} 
                                  onChange={e => setCreateForm({...createForm, series_id: e.target.value})} 
                                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none appearance-none focus:border-chiachia-green/50"
                              >
                                  {raceGroups.filter((g: any) => g.name !== '(None)' && g.series_name !== '(None)').map((g: any) => <option key={g.id} value={g.id}>{g.name || g.series_name}</option>)}
                              </select>
                              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                          </div>
                      </div>

                      <button onClick={handleCreate} disabled={submitting} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 mt-2">
                          {submitting ? <Loader2 size={18} className="animate-spin" /> : '儲存賽事'}
                      </button>
                      
                      {isEditMode && (
                          <button onClick={() => setDeleteConfirm({ show: true, id: createForm.id })} className="w-full py-3 bg-zinc-900 text-rose-500 font-bold rounded-xl border border-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                              <Trash2 size={16}/> 刪除賽事
                          </button>
                      )}
                  </div>
              </div>
          </div>
      , document.body)}

      {/* Delete Confirm Modal */}
      {deleteConfirm.show && createPortal(
          <div className="fixed inset-0 z-[70000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
              <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-chiachia-green/20 text-center animate-scale-in shadow-[0_0_20px_rgba(57,231,95,0.15)]">
                  <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                      <AlertTriangle size={32} />
                  </div>
                  <h3 className="text-xl font-black text-white italic mb-2">刪除賽事</h3>
                  <p className="text-zinc-400 text-sm font-bold mb-6">確定要刪除此賽事嗎？所有相關紀錄也會一併刪除且無法復原。</p>
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setDeleteConfirm({ show: false })} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl active:bg-zinc-700 transition-colors">取消</button>
                      <button onClick={confirmDeleteEvent} disabled={submitting} className="py-3 bg-rose-600 text-white font-black rounded-xl shadow-glow-rose active:scale-95 transition-all flex items-center justify-center">
                          {submitting ? <Loader2 size={16} className="animate-spin" /> : '確認刪除'}
                      </button>
                  </div>
              </div>
          </div>
      , document.body)}

      {/* Join/Update Modal */}
      {showJoinModal.show && createPortal(
          <div className="fixed inset-0 z-[60000] flex items-end justify-center bg-black/90 backdrop-blur-md animate-fade-in pb-[env(safe-area-inset-bottom)]" onClick={() => setShowJoinModal({show: false})}>
              <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center border-b border-white/5 pb-4 gap-3">
                      <button onClick={() => setShowJoinModal({show: false})} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button>
                      <h3 className="text-xl font-black text-white italic">{showJoinModal.participant ? '更新成績' : '報名賽事'}</h3>
                  </div>

                  {/* Rider Photo Upload (Only for existing participants) */}
                  {showJoinModal.participant && (
                      <div className="w-full mb-2">
                          <div className="relative w-full aspect-square max-w-[120px] mx-auto rounded-full bg-zinc-900 border-2 border-white/10 overflow-hidden group">
                              {showJoinModal.participant.photo_url ? <img src={showJoinModal.participant.photo_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center flex-col gap-1 text-zinc-600"><Camera size={24}/><span className="text-[8px] font-bold">比賽照片</span></div>}
                              <label htmlFor="upload-race-participant-photo" className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                                  <Camera size={20} className="text-white drop-shadow-lg mb-1"/>
                                  <span className="text-[8px] text-white font-bold bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">更換</span>
                              </label>
                              <input type="file" accept="image/*" className="hidden" id="upload-race-participant-photo" onChange={(e) => handleCoverUploadStart(e, showJoinModal.event?.id, showJoinModal.participant?.people_id || showJoinModal.participant?.id)} />
                          </div>
                      </div>
                  )}

                  <div className="space-y-4">
                      <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">選手</label>
                          {canManage && !showJoinModal.participant ? (
                              <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1 bg-zinc-900/50 rounded-xl border border-white/5">
                                  {selectablePeople.map((p: any) => {
                                      const isAlreadyJoined = showJoinModal.event?.participants?.some(part => String(part.people_id || part.id) === String(p.id));
                                      const isSelected = bulkSelectedIds.includes(String(p.id));
                                      return (
                                          <button 
                                              key={p.id} 
                                              onClick={() => !isAlreadyJoined && toggleBulkSelect(String(p.id), isModalEventPast)}
                                              className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${isAlreadyJoined ? 'bg-chiachia-green/10 border-chiachia-green cursor-not-allowed' : isSelected ? 'bg-chiachia-green/10 border-chiachia-green' : 'bg-zinc-800 border-white/5 opacity-60'}`}
                                              disabled={isAlreadyJoined}
                                          >
                                              <div className={`w-8 h-8 rounded-full overflow-hidden ${isAlreadyJoined ? 'ring-2 ring-chiachia-green' : isSelected ? 'ring-2 ring-chiachia-green' : ''}`}>
                                                  {p.s_url ? <img src={p.s_url} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-black flex items-center justify-center text-[8px]">{p.name[0]}</div>}
                                              </div>
                                              <span className={`text-[9px] font-bold truncate w-full text-center ${isAlreadyJoined || isSelected ? 'text-white' : 'text-zinc-500'}`}>{p.name}</span>
                                          </button>
                                      );
                                  })}
                              </div>
                          ) : (
                              <div className="relative">
                                  <select 
                                      value={joinForm.people_id} 
                                      onChange={e => setJoinForm({...joinForm, people_id: e.target.value})} 
                                      disabled={!canManage || !!showJoinModal.participant} 
                                      className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none appearance-none disabled:opacity-50"
                                  >
                                      <option value="">請選擇選手...</option>
                                      {selectablePeople.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                  {(!showJoinModal.participant && canManage) && <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>}
                              </div>
                          )}
                      </div>

                      {isModalEventPast && (
                          <>
                              <div className="space-y-1">
                                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">分組/名次 (Ranking)</label>
                                  <input type="text" value={joinForm.ranking} onChange={e => setJoinForm({...joinForm, ranking: e.target.value})} placeholder="例如: 分組第一, 完賽..." className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50"/>
                              </div>
                              <div className="space-y-1">
                                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">備註 (Note)</label>
                                  <textarea rows={2} value={joinForm.note} onChange={e => setJoinForm({...joinForm, note: e.target.value})} placeholder="心得或補充..." className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-chiachia-green/50 text-sm"/>
                              </div>
                          </>
                      )}

                      <button onClick={handleJoinOrUpdate} disabled={submitting} className="w-full py-4 bg-chiachia-green text-black font-black rounded-xl shadow-glow-green active:scale-95 transition-all flex items-center justify-center gap-2 mt-2">
                          {submitting ? <Loader2 size={18} className="animate-spin" /> : (showJoinModal.participant ? '更新資料' : `確認${isModalEventPast ? '補登' : '報名'}`)}
                      </button>
                      
                      {/* Delete Button inside Join Modal (For self or admin) */}
                      {showJoinModal.participant && (canManage || String(showJoinModal.participant.people_id) === String(user?.id)) && (
                          <button onClick={() => { setShowJoinModal({show: false}); handleExitRace(showJoinModal.event!.id, showJoinModal.participant!.people_id || showJoinModal.participant!.id); }} className="w-full py-3 bg-zinc-900 text-rose-500 font-bold rounded-xl border border-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                              <Trash2 size={16}/> 刪除/取消報名
                          </button>
                      )}
                  </div>
              </div>
          </div>
      , document.body)}

      {/* Exit Confirm Modal */}
      {exitConfirm.show && createPortal(
          <div className="fixed inset-0 z-[70000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
              <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-chiachia-green/20 text-center animate-scale-in shadow-[0_0_20px_rgba(57,231,95,0.15)]">
                  <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                      <LogOut size={32} />
                  </div>
                  <h3 className="text-xl font-black text-white italic mb-2">取消報名</h3>
                  <p className="text-zinc-400 text-sm font-bold mb-6">確定要取消此賽事的報名嗎？相關成績也會一併移除。</p>
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setExitConfirm({ show: false })} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl active:bg-zinc-700 transition-colors">保留</button>
                      <button onClick={confirmExitRace} disabled={submitting} className="py-3 bg-rose-600 text-white font-black rounded-xl shadow-glow-rose active:scale-95 transition-all flex items-center justify-center">
                          {submitting ? <Loader2 size={16} className="animate-spin" /> : '確認取消'}
                      </button>
                  </div>
              </div>
          </div>
      , document.body)}

      {/* Crop Modal */}
      {cropImageSrc && createPortal(
          <div className="fixed inset-0 z-[99999] bg-black flex flex-col animate-fade-in">
              <div className="flex-none px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] flex justify-between items-center bg-black z-10 border-b border-white/10">
                  <button onClick={() => setCropImageSrc(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:bg-zinc-800 transition-all"><X size={20} /></button>
                  <span className="text-sm font-black text-white italic tracking-wider">ADJUST PHOTO</span>
                  <button onClick={handleCropSave} className="h-10 px-5 bg-chiachia-green text-black font-black rounded-full flex items-center gap-2 shadow-glow-green active:scale-95 transition-all text-xs">
                      {uploading ? <Loader2 className="animate-spin" size={14}/> : <Check size={14} />} SAVE
                  </button>
              </div>
              <div className="flex-1 relative bg-zinc-900 w-full overflow-hidden">
                  <SimpleImageCropper
                      image={cropImageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={activeUploadEventId ? 4/5 : 16/9} // Portrait for user race photo, Landscape for event cover
                      onCropChange={setCrop}
                      onCropComplete={onCropComplete}
                      onZoomChange={setZoom}
                      showGrid={true}
                      style={{ containerStyle: { background: '#000' } }}
                  />
              </div>
              <div className="flex-none px-6 py-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] bg-black flex items-center gap-4 border-t border-white/10">
                  <ZoomIn size={20} className="text-zinc-500" />
                  <input 
                      type="range" 
                      value={zoom} 
                      min={1} 
                      max={3} 
                      step={0.1} 
                      aria-labelledby="Zoom" 
                      onChange={(e) => setZoom(Number(e.target.value))} 
                      className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-chiachia-green" 
                  />
              </div>
          </div>
      , document.body)}
    </>
  );
};

export default Races;
