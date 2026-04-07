import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { SimpleComposedChart } from '../components/SimpleComposedChart';
import { UserCircle2, ChevronDown, Plus, X, Trophy, History, Trash2, Edit2, CheckCircle2, AlertTriangle, MessageCircle, Lock, KeyRound, Loader2, Users, UserPlus, Check, Camera, Play, ChevronLeft, CalendarDays, Delete, Save, ChevronUp, ChevronRight, Activity, Zap, RefreshCw, Quote, Medal, Flame } from 'lucide-react';
import { format, differenceInYears, parseISO, isSameDay, subDays, subMonths, isAfter, isValid, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { hasRole, ROLES } from '../utils/auth';
import { useTrainingSync } from '../hooks/useTrainingSync';

const Training: React.FC<any> = ({ trainingTypes, defaultType, refreshData, data, people, activePersonId, onSelectPerson, pinnedPeopleIds, onTogglePinned, raceEvents, initialExpandedDate, onClearJumpDate }) => {
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [selectedType, setSelectedType] = useState<string | number>(defaultType);
  const [dateRange, setDateRange] = useState<'1W' | '1M' | '3M' | 'ALL' | 'PICK'>('1M');
  const [customDateRange, setCustomDateRange] = useState<{start: string, end: string}>({
      start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd')
  });
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);

  const [randomRider, setRandomRider] = useState<any>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [participatingRiderIds, setParticipatingRiderIds] = useState<string[]>([]);
  const [currentRiderId, setCurrentRiderId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [editingHistoryId, setEditingHistoryId] = useState<string | number | null>(null);
  const [editHistoryValue, setEditHistoryValue] = useState('');
  const [showRiderSelectModal, setShowRiderSelectModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState<{show: boolean, record?: any}>({ show: false });
  const [showBioModal, setShowBioModal] = useState(false); 
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id?: string|number}>({ show: false });
  const [submitting, setSubmitting] = useState(false);
  const [localLastValue, setLocalLastValue] = useState<string | null>(null);
  const [localCountOffset, setLocalCountOffset] = useState(0);
  const lastSavedClientId = useRef<string | null>(null);
  
  const { saveRecord } = useTrainingSync();
  
  const currentUser = api.getUser();
  const canRecord = currentUser && (hasRole(currentUser, ROLES.COACH) || hasRole(currentUser, ROLES.AIDE) || hasRole(currentUser, ROLES.DEV));
  const isAdmin = hasRole(currentUser, ROLES.COACH) || hasRole(currentUser, ROLES.DEV);

  const filteredPeople = useMemo(() => {
    return people.filter((p: any) => hasRole(p, ROLES.RIDER) && !hasRole(p, ROLES.DEV));
  }, [people]);

  // Deep Link Handling
  useEffect(() => {
      if (initialExpandedDate) {
          setDateRange('ALL');
          setExpandedDate(initialExpandedDate);
          setTimeout(() => {
              const el = document.getElementById(`date-card-${initialExpandedDate}`);
              if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('animate-pulse');
                  setTimeout(() => el.classList.remove('animate-pulse'), 1500);
              }
              if (onClearJumpDate) {
                  onClearJumpDate();
              }
          }, 800);
      }
  }, [initialExpandedDate]);

  useEffect(() => {
      const KEY = 'TRAINING_LAST_RIDER_TIME';
      const lastTime = localStorage.getItem(KEY);
      const now = Date.now();
      const TIMEOUT = 60 * 1000; 
      const validPeople = filteredPeople.filter((p: any) => !p.is_hidden);
      if (validPeople.length === 0) return;
      const shouldRandomize = !activePersonId && (!lastTime || (now - parseInt(lastTime) > TIMEOUT));
      if (shouldRandomize) {
          const random = validPeople[Math.floor(Math.random() * validPeople.length)];
          if (random) {
              onSelectPerson(random.id);
              localStorage.setItem(KEY, String(now));
          }
      }
  }, [filteredPeople]);

  // 【修復點 1】 將初始化邏輯與樂觀狀態清除邏輯分開
  useEffect(() => {
      if (trainingTypes.length > 0 && !selectedType) {
          setSelectedType(trainingTypes[0].id);
      }
      if (activePersonId) {
          const pid = String(activePersonId);
          setParticipatingRiderIds(prev => prev.includes(pid) ? prev : [...prev, pid]);
          setCurrentRiderId(prev => prev ? prev : pid);
      }
      if (!activePersonId && filteredPeople.length > 0 && !randomRider) {
          const rand = filteredPeople.filter((p:any) => !p.is_hidden)[Math.floor(Math.random() * filteredPeople.filter((p:any) => !p.is_hidden).length)];
          if (rand) setRandomRider(rand);
      }
  }, [trainingTypes, activePersonId, filteredPeople]);

  // 【修復點 2】 確保本地樂觀更新只在切換人員或切換訓練類型時才重置
  useEffect(() => {
      setLocalLastValue(null);
      setLocalCountOffset(0);
      lastSavedClientId.current = null;
  }, [currentRiderId, activePersonId, selectedType]);

  const activeRider = useMemo(() => {
      if (!isRecordingMode) {
          const specific = filteredPeople.find((p: any) => String(p.id) === String(activePersonId));
          return specific || randomRider || (filteredPeople.length > 0 ? filteredPeople[0] : null);
      }
      if (currentRiderId) return filteredPeople.find((p: any) => String(p.id) === String(currentRiderId));
      if (activePersonId) return filteredPeople.find((p: any) => String(p.id) === String(activePersonId));
      return null;
  }, [filteredPeople, currentRiderId, activePersonId, isRecordingMode, randomRider]);

  const validRiders = useMemo(() => {
       return participatingRiderIds
           .map(id => filteredPeople.find((p: any) => String(p.id) === String(id)))
           .filter((p: any) => !!p);
  }, [participatingRiderIds, filteredPeople]);

  const getSelectedTypeId = () => {
      let typeId = selectedType;
      if (typeof selectedType === 'string') {
          const t = trainingTypes.find((t: any) => t.name === selectedType || t.type_name === selectedType || String(t.id) === selectedType);
          if (t) typeId = t.id;
      }
      return typeId;
  };

  const calculateStability = (values: number[]) => {
      if (values.length === 0) return 0;
      if (values.length === 1) return 100; 
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const squareDiffs = values.map(v => Math.pow(v - avg, 2));
      const stdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
      const cv = avg === 0 ? 0 : stdDev / avg;
      const best = Math.min(...values);
      const max = Math.max(...values);
      const range = max - best;
      const score = Math.max(0, Math.min(100, 
          (100 - (cv * 700)) * 0.6 + 
          (100 - (range * 50)) * 0.4
      ));
      return score;
  };

  const personalBestRecord = useMemo(() => {
    if (!activeRider) return null;
    const typeId = getSelectedTypeId();
    const typeRecords = data.filter((d: any) => 
        String(d.training_type_id) === String(typeId) && 
        String(d.people_id) === String(activeRider.id) &&
        d.item === 'training' &&
        !isNaN(parseFloat(d.value))
    );
    if (typeRecords.length === 0) return null;
    return typeRecords.sort((a: any, b: any) => parseFloat(a.value) - parseFloat(b.value))[0];
  }, [data, selectedType, trainingTypes, activeRider]);

  const overviewRecords = useMemo(() => {
      if (!activeRider) return [];
      const typeId = getSelectedTypeId();
      const target = data.filter((d: any) => 
          String(d.people_id) === String(activeRider.id) && 
          String(d.training_type_id) === String(typeId) &&
          d.item === 'training'
      );
      const now = new Date();
      return target.filter((d: any) => {
          const dDate = parseISO(d.date);
          if (!isValid(dDate)) return false;
          if (dateRange === 'PICK') {
              const start = parseISO(customDateRange.start);
              const end = parseISO(customDateRange.end);
              if (isValid(start) && isValid(end)) {
                  return isWithinInterval(dDate, { start: startOfDay(start), end: endOfDay(end) });
              }
              return true;
          }
          if (dateRange === '1W') return isAfter(dDate, subDays(now, 7));
          if (dateRange === '1M') return isAfter(dDate, subMonths(now, 1));
          if (dateRange === '3M') return isAfter(dDate, subMonths(now, 3));
          return true;
      }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data, activeRider, selectedType, trainingTypes, dateRange, customDateRange]);

  const groupedRecords = useMemo(() => {
      const groups: Record<string, any[]> = {};
      overviewRecords.forEach((r: any) => {
          const day = r.date; 
          if(!groups[day]) groups[day] = [];
          groups[day].push(r);
      });
      return Object.entries(groups).map(([date, runs]) => {
          const values = runs.map(r => parseFloat(r.value));
          const min = Math.min(...values);
          const sum = values.reduce((a, b) => a + b, 0);
          const avg = sum / values.length;
          const stability = calculateStability(values);
          return { 
              date, 
              runs: runs.sort((a,b) => b.id - a.id), 
              best: min, 
              avg, 
              stability, 
              count: runs.length 
          };
      }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [overviewRecords]);

  const chartData = useMemo(() => {
      return [...groupedRecords].reverse().map(g => ({
          date: format(parseISO(g.date), 'MM/dd'),
          avg: parseFloat(g.avg.toFixed(3)),
          best: parseFloat(g.best.toFixed(3)),
          stability: parseFloat(g.stability.toFixed(1))
      }));
  }, [groupedRecords]);

  const sessionRecords = useMemo(() => {
      const targetId = currentRiderId || (activePersonId ? String(activePersonId) : null);
      if (!targetId) return [];
      const typeId = getSelectedTypeId();
      return data.filter((d: any) => 
          String(d.people_id) === String(targetId) && 
          String(d.training_type_id) === String(typeId) &&
          d.item === 'training'
      ).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data, currentRiderId, activePersonId, selectedType, trainingTypes]);

  const todaySessionRecords = useMemo(() => {
     const todayStr = format(new Date(), 'yyyy-MM-dd');
     return sessionRecords.filter((r: any) => r.date === todayStr);
  }, [sessionRecords]);

  const todayBestScore = useMemo(() => {
      if (todaySessionRecords.length === 0) return null;
      const scores = todaySessionRecords.map((r: any) => parseFloat(r.value)).filter((v: number) => !isNaN(v));
      if (scores.length === 0) return null;
      return Math.min(...scores);
  }, [todaySessionRecords]);

  const lastRecordValue = useMemo(() => {
      return sessionRecords.length > 0 ? sessionRecords[0].value : null;
  }, [sessionRecords]);

  const todayCount = todaySessionRecords.length;

  // 【新功能】計算當前訓練項目下，每位選手今日的 Total
  const todayCountsByRider = useMemo(() => {
      const counts: Record<string, number> = {};
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const typeId = getSelectedTypeId();

      data.forEach((d: any) => {
          if (d.date === todayStr && String(d.training_type_id) === String(typeId) && d.item === 'training') {
              const pid = String(d.people_id);
              counts[pid] = (counts[pid] || 0) + 1;
          }
      });
      return counts;
  }, [data, selectedType]);

  const sortedPeople = useMemo(() => {
      return filteredPeople
        .filter((p: any) => !p.is_hidden)
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [filteredPeople]);

  const honorList = useMemo(() => {
      if (!raceEvents || !activeRider) return [];
      return raceEvents.filter((e: any) => {
          const p = e.participants.find((part: any) => String(part.people_id || part.id) === String(activeRider.id));
          return p && !!p.is_personal_honor;
      }).map((e: any) => {
          const p = e.participants.find((part: any) => String(part.people_id || part.id) === String(activeRider.id));
          return {
              id: e.id,
              date: e.date,
              name: e.name,
              rank: p.race_group || '完賽'
          };
      }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [raceEvents, activeRider]);

  const handleStartRecordClick = () => {
      setIsRecordingMode(true);
  };

  const handleDigitPress = (digit: string) => {
      if (inputValue.length >= 8) return; 
      if (digit === '.' && inputValue.includes('.')) return;
      if (inputValue.includes('.')) { const [_, decimalPart] = inputValue.split('.'); if (decimalPart && decimalPart.length >= 3) return; }
      setInputValue(prev => prev + digit);
  };

  // 對帳：確保真正的資料回來後，再清掉樂觀狀態
  useEffect(() => {
      if (lastSavedClientId.current && sessionRecords.length > 0) {
          const isSynced = sessionRecords.some((r: any) => r.client_id === lastSavedClientId.current);
          if (isSynced) {
              setLocalLastValue(null);
              setLocalCountOffset(0);
              lastSavedClientId.current = null;
          }
      }
  }, [sessionRecords]);

  const handleRecordSubmit = async () => {
      if (!inputValue || parseFloat(inputValue) <= 0) return;
      const targetId = currentRiderId || (activePersonId ? String(activePersonId) : null);
      if (!targetId) { setShowRiderSelectModal(true); return; }
      
      setSubmitting(true);
      try {
          const typeId = getSelectedTypeId();
          const valStr = parseFloat(inputValue).toFixed(3);
          const recordData = { 
              date: format(new Date(), 'yyyy-MM-dd'), 
              item: 'training', 
              people_id: targetId, 
              value: valStr, 
              training_type_id: typeId 
          };

          const clientId = await saveRecord(recordData);
          lastSavedClientId.current = clientId;

          setLocalLastValue(valStr);
          setLocalCountOffset(prev => prev + 1);
          
          setInputValue('');
          setFeedbackMsg('SAVED');
          setSubmitting(false); 

          localStorage.setItem('TRAINING_LAST_RIDER_TIME', String(Date.now()));
          
          refreshData();
          setTimeout(() => setFeedbackMsg(null), 1500);
      } catch (e) { 
          alert('紀錄失敗'); 
          setSubmitting(false); 
      }
  };

  const handleRiderSelection = (id: string) => {
      if (isRecordingMode) {
          setParticipatingRiderIds(prev => { if (prev.includes(id)) { const next = prev.filter(pid => pid !== id); if (currentRiderId === id) setCurrentRiderId(next.length > 0 ? next[0] : null); return next; } else { const next = [...prev, id]; if (!currentRiderId) setCurrentRiderId(id); return next; } });
      } else { onSelectPerson(id); localStorage.setItem('TRAINING_LAST_RIDER_TIME', String(Date.now())); setShowRiderSelectModal(false); }
  };
  const handleDeleteRecord = async () => {
      if (!deleteConfirm.id) return;
      setSubmitting(true);
      try { await api.manageTrainingRecord('delete', { id: deleteConfirm.id }); await refreshData(); setDeleteConfirm({ show: false }); setShowHistoryModal({ show: false }); } catch(e) { alert('刪除失敗'); }
      setSubmitting(false);
  };
  const startEditingHistory = (record: any) => { setEditingHistoryId(record.id); setEditHistoryValue(record.value); };
  const handleSaveEdit = async (record: any) => {
      if (!record || !editHistoryValue || isNaN(parseFloat(editHistoryValue))) return;
      setSubmitting(true);
      try { await api.manageTrainingRecord('update', { id: record.id, score: parseFloat(editHistoryValue).toFixed(3), date: record.date, training_type_id: record.training_type_id }); await refreshData(); setEditingHistoryId(null); } catch(e) { alert('更新失敗'); console.error(e); }
      setSubmitting(false);
  };
  const handleJumpToLegend = () => {
    if (!personalBestRecord) return;
    const r = personalBestRecord;
    setDateRange('ALL'); setExpandedDate(r.date);
    setTimeout(() => { const el = document.getElementById(`record-${r.id}`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('bg-amber-500/20'); setTimeout(() => el.classList.remove('bg-amber-500/20'), 1500); } else { alert('該紀錄可能已超出顯示範圍 (Limit 300)'); } }, 600);
  };

  const getRangeLabel = () => {
      if (dateRange === 'PICK') {
          if (!customDateRange.start || !customDateRange.end) return '自訂範圍';
          try {
              return `${format(parseISO(customDateRange.start), 'MM/dd')} - ${format(parseISO(customDateRange.end), 'MM/dd')}`;
          } catch(e) { return 'Invalid Date'; }
      }
      switch(dateRange) {
          case '1W': return '最近 1 週';
          case '1M': return '最近 1 月';
          case '3M': return '最近 3 月';
          case 'ALL': return '全部時間';
          default: return '日期範圍';
      }
  };

  const renderOverview = () => (
      <div className="flex flex-col relative pb-32">
           {canRecord && (
               <div className="px-4 py-6 mt-4 relative z-50">
                   <button onClick={handleStartRecordClick} className="w-full bg-gradient-to-r from-chiachia-green to-emerald-600 text-black h-14 rounded-2xl shadow-[0_0_20px_rgba(57,231,95,0.4)] flex items-center justify-center gap-3 active:scale-[0.98] transition-all group cursor-pointer">
                       <Play size={20} fill="black" className="group-hover:scale-110 transition-transform" />
                       <span className="text-xl font-black italic tracking-wider">START TRAINING</span>
                   </button>
               </div>
           )}

           <div className="relative w-full h-[55vh] shrink-0 mx-auto px-4 z-0">
               <div className="w-full h-full rounded-[32px] overflow-hidden relative border border-white/5 bg-zinc-900">
                   {activeRider?.b_url ? ( <img src={activeRider.b_url.split('#')[0]} className="w-full h-full object-cover" /> ) : ( <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-zinc-900 gap-2"> <Camera size={32} /> <span className="text-xs font-black uppercase tracking-widest">No Cover Photo</span> </div> )}
                   <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                   
                   <button onClick={() => setShowRiderSelectModal(true)} className="absolute bottom-6 right-5 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white z-50 border border-white/20 active:scale-95 transition-all shadow-lg hover:bg-white/20"> 
                       <Users size={20} /> 
                   </button>
                   
                   <div className="absolute bottom-6 left-5 right-16 flex items-end gap-4 z-20">
                       <div className="w-20 h-20 rounded-full border-2 border-white bg-zinc-950 shadow-2xl overflow-hidden shrink-0 flex items-center justify-center"> {activeRider?.s_url ? ( <img src={activeRider.s_url.split('#')[0]} className="w-full h-full object-cover" /> ) : ( <span className="font-black text-4xl text-white"> {activeRider?.name?.[0] || '?'} </span> )} </div>
                       <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center gap-2"> <h2 className="text-2xl font-black text-white italic tracking-tight drop-shadow-lg truncate">{activeRider?.name || '---'}</h2> {activeRider && <span className="text-xs bg-white/20 backdrop-blur-md text-white px-2 py-0.5 rounded font-black font-mono shadow-sm">AGE {activeRider.birthday ? differenceInYears(new Date(), new Date(activeRider.birthday)) : '-'}</span>} </div>
                            {activeRider?.myword && ( <button onClick={() => setShowBioModal(true)} className="text-left w-full group focus:outline-none relative z-40"> <p className="text-sm font-bold text-zinc-300 drop-shadow-md italic mt-1 group-active:scale-95 transition-all group-hover:text-white truncate"> "{activeRider.myword}" </p> </button> )}
                       </div>
                   </div>
               </div>
           </div>

           <div className="px-4 -mt-4 relative z-30">
               <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center shadow-2xl overflow-hidden">
                   <button onClick={handleJumpToLegend} className="flex items-center gap-3 px-4 py-3 pr-5 border-r border-white/10 hover:bg-white/5 transition-colors group text-left min-w-[120px]">
                       <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 group-active:scale-90 transition-transform"> <Trophy size={14} /> </div>
                       <div className="flex flex-col"> <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Personal Best</span> {personalBestRecord ? ( <span className="text-base font-black font-mono text-white leading-none">{parseFloat(personalBestRecord.value).toFixed(3)}s</span> ) : ( <span className="text-sm font-bold text-zinc-600 leading-none">--.--</span> )} </div>
                   </button>
                   <div className="flex-1 overflow-hidden h-[54px] relative px-4 flex items-center">
                       {honorList.length > 0 ? ( <HonorTicker items={honorList} /> ) : ( <div className="flex items-center gap-2 opacity-30 w-full justify-center"> <Flame size={14} className="text-zinc-500" /> <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Hall of Fame</span> </div> )}
                   </div>
               </div>
           </div>

           <div className="px-4 py-4 space-y-4 relative z-10 mt-2">
               <div className="flex justify-between items-center gap-2">
                   <div className="relative flex-1">
                       <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="w-full bg-zinc-900 border border-white/10 text-white text-sm font-black uppercase tracking-wider rounded-xl px-3 py-2 pr-8 outline-none appearance-none h-10"> {trainingTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name || t.type_name}</option>)} </select>
                       <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                   </div>
                   
                   <div className="relative flex-1 max-w-[160px] z-50">
                       <button 
                           onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
                           className={`relative flex items-center justify-between px-3 h-10 w-full rounded-xl border transition-all ${isDateMenuOpen ? 'bg-zinc-800 border-white/20 text-white' : 'bg-zinc-900/60 border-white/5 text-zinc-500'}`}
                       >
                           <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                               <CalendarDays size={14} className="shrink-0" />
                               <span className="text-xs font-black uppercase tracking-wider truncate">
                                   {getRangeLabel()}
                               </span>
                           </div>
                           <ChevronDown size={12} className={`shrink-0 transition-transform ${isDateMenuOpen ? 'rotate-180' : ''}`} />
                       </button>

                       {isDateMenuOpen && (
                           <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-2 z-[60] flex flex-col gap-1 animate-scale-in origin-top-right">
                               <div className="grid grid-cols-2 gap-1 mb-1">
                                   {(['1W', '1M', '3M', 'ALL'] as const).map(opt => (
                                       <button 
                                           key={opt}
                                           onClick={() => { setDateRange(opt); setIsDateMenuOpen(false); }}
                                           className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider ${dateRange === opt ? 'bg-chiachia-green text-black' : 'bg-black/40 text-zinc-400 hover:text-white'}`}
                                       >
                                           {opt === '1W' ? '1 週' : opt === '1M' ? '1 月' : opt === '3M' ? '3 月' : '全部'}
                                       </button>
                                   ))}
                               </div>
                               <button 
                                   onClick={() => setDateRange('PICK')}
                                   className={`py-2 px-3 rounded-lg text-left text-xs font-bold transition-all ${dateRange === 'PICK' ? 'bg-zinc-800 text-chiachia-green border border-chiachia-green/30' : 'text-zinc-400 hover:bg-white/5'}`}
                               >
                                   自訂範圍...
                               </button>
                               
                               {dateRange === 'PICK' && (
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

               <div className="h-44 w-full shrink-0">
                    <SimpleComposedChart 
                        data={chartData} 
                        xKey="date" 
                        areaKey="avg" 
                        lineKeys={[
                            { key: 'best', color: '#fbbf24' },
                            { key: 'stability', color: '#3b82f6', strokeDasharray: '4 4' }
                        ]}
                        showXAxis={true}
                        xAxisFormatter={(val: any) => String(val)}
                    />
               </div>
               
               <div className="space-y-3">
                   {groupedRecords.map((group) => {
                       const isExpanded = expandedDate === group.date;
                       const dDate = parseISO(group.date);
                       return (
                           <div key={group.date} id={`date-card-${group.date}`} className="rounded-2xl bg-zinc-950/40 border border-white/5 overflow-hidden transition-all backdrop-blur-sm">
                               <button onClick={() => setExpandedDate(isExpanded ? null : group.date)} className={`w-full flex items-stretch text-left ${isExpanded ? 'bg-zinc-900/50' : ''}`}>
                                   <div className={`w-20 flex flex-col items-center justify-center p-2 border-r border-white/5 transition-colors ${isExpanded ? 'bg-chiachia-green/10 text-chiachia-green' : 'bg-zinc-900 text-zinc-500'}`}> <span className="text-[10px] font-black uppercase tracking-wider">{format(dDate, 'MMM')}</span> <span className="text-2xl font-black font-mono leading-none">{format(dDate, 'dd')}</span> </div>
                                   <div className="flex-1 flex items-center p-2 gap-4 min-w-0 overflow-x-auto no-scrollbar">
                                       <div className="flex-1 min-w-[70px] flex flex-col items-center justify-center gap-0.5"> <div className="flex items-center gap-1 text-[10px] font-black text-zinc-600 uppercase tracking-wider"><Activity size={10} className="text-chiachia-green"/> Avg</div> <div className="text-base font-black text-white font-mono leading-none">{group.avg.toFixed(3)}s</div> </div>
                                       <div className="flex-1 min-w-[70px] flex flex-col items-center justify-center gap-0.5"> <div className="flex items-center gap-1 text-[10px] font-black text-zinc-600 uppercase tracking-wider"><Trophy size={10} className="text-amber-400"/> Best</div> <div className="text-base font-black text-white font-mono leading-none">{group.best.toFixed(3)}s</div> </div>
                                       <div className="flex-1 min-w-[70px] flex flex-col items-center justify-center gap-0.5"> <div className="flex items-center gap-1 text-[10px] font-black text-zinc-600 uppercase tracking-wider"><Zap size={10} className="text-blue-400"/> Stability</div> <div className="text-base font-black text-white font-mono leading-none">{group.stability.toFixed(0)}</div> </div>
                                   </div>
                                   <div className="w-8 flex items-center justify-center text-zinc-600"> {isExpanded ? <ChevronUp size={20}/> : <ChevronRight size={20}/>} </div>
                               </button>
                               {isExpanded && (
                                   <div className="border-t border-white/5 bg-black/20 p-2 space-y-1 max-h-60 overflow-y-auto no-scrollbar">
                                       {group.runs.map((r: any, idx: number) => {
                                           const isEditing = editingHistoryId === r.id;
                                           const runNumber = group.runs.length - idx; 
                                           return (
                                               <div key={r.id} id={`record-${r.id}`} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors">
                                                   <div className="flex items-center gap-3"> <span className="text-[10px] font-mono text-zinc-600 w-6 text-center">#{runNumber}</span> {isEditing ? ( <input type="number" autoFocus value={editHistoryValue} onChange={(e) => { const val = e.target.value; if (val.includes('.')) { const parts = val.split('.'); if (parts[1] && parts[1].length > 3) return; } setEditHistoryValue(val); }} className="w-20 bg-black border border-white/20 rounded-lg px-2 py-1 text-white font-mono font-bold text-sm text-center outline-none focus:border-chiachia-green" /> ) : ( <span className={`text-base font-mono font-black ${parseFloat(r.value) === group.best ? 'text-amber-400' : 'text-zinc-300'}`}> {parseFloat(r.value).toFixed(3)}s </span> )} </div>
                                                   {isAdmin && ( <div className="flex items-center gap-1"> {isEditing ? ( <> <button onClick={() => handleSaveEdit(r)} className="p-1.5 bg-chiachia-green text-black rounded-lg shadow-glow-green active:scale-95"><Save size={14}/></button> <button onClick={() => setEditingHistoryId(null)} className="p-1.5 bg-zinc-700 text-zinc-400 rounded-lg active:scale-95"><X size={14}/></button> </> ) : ( <> <button onClick={() => startEditingHistory(r)} className="p-1.5 text-zinc-500 hover:text-white transition-colors"><Edit2 size={14}/></button> <button onClick={() => setDeleteConfirm({show: true, id: r.id})} className="p-1.5 text-zinc-500 hover:text-rose-500 transition-colors"><Trash2 size={14}/></button> </> )} </div> )}
                                               </div>
                                           );
                                       })}
                                   </div>
                               )}
                           </div>
                       );
                   })}
                   {overviewRecords.length === 0 && <div className="text-center py-4 text-zinc-600 text-xs font-black uppercase">No Data Found</div>}
               </div>
           </div>
      </div>
  );

  return (
    <div className="relative w-full">
       {renderOverview()}
       {isRecordingMode && createPortal(
          <div className="fixed inset-0 z-[50000] bg-zinc-950 flex flex-col pb-[env(safe-area-inset-bottom)] pt-[calc(env(safe-area-inset-top)+10px)]">
               <div className="flex items-center justify-between p-4 z-20 shrink-0 h-16 bg-gradient-to-b from-black to-zinc-950 relative">
                    <button onClick={() => setIsRecordingMode(false)} className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 active:bg-zinc-800 transition-all border border-white/5"> <ChevronLeft size={20} /> </button>
                    <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-full border border-white/5 absolute left-1/2 -translate-x-1/2"> <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_red]"></div> <span className="text-white text-xs font-black italic tracking-widest">REC</span> </div>
                    <div className="flex items-center gap-2"> <button onClick={() => setShowHistoryModal({show: true})} className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 active:bg-zinc-800 transition-all border border-white/5"> <History size={18} /> </button> </div>
               </div>
               <div className="shrink-0 flex flex-col items-center justify-start pb-2 border-b border-white/5 bg-zinc-950 relative z-10">
                   <div className="relative inline-block z-20 mb-1"> <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="appearance-none bg-zinc-900/50 border border-white/10 text-zinc-400 text-sm font-black uppercase tracking-widest py-1.5 pl-3 pr-6 rounded-full outline-none text-center"> {trainingTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name || t.type_name}</option>)} </select> <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" size={14} /> </div>
                   
                   {dateRange !== 'PICK' && (
                       <div className="flex items-center gap-4 mb-1"> 
                           {(localLastValue || lastRecordValue) && ( 
                               <div className="text-xs font-black text-zinc-600 font-mono flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-transparent"> 
                                   <span>PREV</span> 
                                   <span className="text-zinc-400">{parseFloat(localLastValue || lastRecordValue || '0').toFixed(3)}s</span> 
                               </div> 
                           )} 
                           <div className="text-xs font-black text-zinc-600 font-mono flex items-center gap-1.5 bg-zinc-900/40 px-2 py-0.5 rounded-lg border border-white/5"> 
                               <span>TODAY</span> 
                               <span className="text-chiachia-green">{todayCount + localCountOffset}</span> 
                           </div> 
                       </div>
                   )}

                   <div className="relative w-full text-center px-4"> <span className={`font-mono font-black tracking-tighter leading-none text-white drop-shadow-[0_0_30px_rgba(57,231,95,0.1)] transition-all ${inputValue.length > 4 ? 'text-6xl' : 'text-7xl'}`}> {inputValue || '0.00'} </span> <span className="text-2xl font-black text-zinc-700 ml-1 italic absolute bottom-4">s</span> </div>
                   <div className="h-6 flex flex-col items-center justify-center w-full mt-1"> {feedbackMsg && ( <div className="bg-chiachia-green text-black px-4 py-1 rounded-full text-[10px] font-black tracking-widest shadow-glow-green animate-scale-in"> {feedbackMsg} </div> )} </div>
               </div>
               <div className="flex-1 min-h-0 bg-black relative w-full overflow-y-auto no-scrollbar flex flex-col">
                   <div className="flex-grow w-full flex flex-col p-2 min-h-0">
                       {validRiders.length === 0 ? (
                           <div className="flex-1 flex items-center justify-center"> <button onClick={() => setShowRiderSelectModal(true)} className="w-32 h-32 rounded-full bg-zinc-900 border border-white/10 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all group hover:border-chiachia-green/50"> <Users size={32} className="text-zinc-500 group-hover:text-chiachia-green transition-colors"/> <span className="text-xs font-black text-zinc-500 uppercase tracking-widest group-hover:text-white transition-colors">Select Rider</span> <div className="w-8 h-8 rounded-full bg-chiachia-green flex items-center justify-center text-black shadow-glow-green mt-1"> <Plus size={20} strokeWidth={3} /> </div> </button> </div>
                       ) : (
                           <div className="grid grid-cols-4 gap-x-1 gap-y-2 content-start py-2">
                               {validRiders.map((p: any) => { 
                                    const pid = String(p.id); 
                                    const isActive = currentRiderId === pid; 
                                    // 【新功能】取得該選手今日次數，加上樂觀更新邏輯
                                    const baseCount = todayCountsByRider[pid] || 0;
                                    const displayCount = isActive ? baseCount + localCountOffset : baseCount;

                                    return ( 
                                        <button key={pid} onClick={() => setCurrentRiderId(pid)} className={`relative group transition-all flex flex-col items-center gap-1.5 ${isActive ? 'scale-105 z-10' : 'opacity-60 scale-95'}`}> 
                                            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 bg-zinc-900 transition-all relative flex items-center justify-center mx-auto ${isActive ? 'border-chiachia-green shadow-[0_0_15px_rgba(57,231,95,0.6)]' : 'border-zinc-800'}`}> 
                                                {p.s_url ? ( <img src={p.s_url.split('#')[0]} className="w-full h-full object-cover" /> ) : ( <span className={`text-xl font-black ${isActive ? 'text-chiachia-green' : 'text-zinc-600'}`}> {p.name?.[0]} </span> )} 
                                            </div> 
                                            <div className="flex items-center justify-center gap-1 max-w-full px-1">
                                                <span className={`text-[10px] font-black truncate ${isActive ? 'text-chiachia-green' : 'text-zinc-500'}`}> {p.name} </span> 
                                                {displayCount > 0 && (
                                                    <span className={`text-[9px] font-black px-1 rounded shadow-sm ${isActive ? 'bg-chiachia-green text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                                                        {displayCount}
                                                    </span>
                                                )}
                                            </div>
                                        </button> 
                                    ); 
                               })}
                               <button onClick={() => setShowRiderSelectModal(true)} className="relative group transition-all flex flex-col items-center gap-1.5 active:scale-95"> <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-zinc-700 bg-zinc-900/50 flex items-center justify-center hover:border-zinc-500 hover:bg-zinc-800 transition-colors mx-auto"> <Plus size={24} className="text-zinc-500 group-hover:text-white transition-colors" strokeWidth={3} /> </div> <span className="text-[10px] font-black px-1 opacity-0 select-none">ADD</span> </button>
                           </div>
                       )}
                   </div>
               </div>
               <div className="flex-none bg-zinc-950 border-t border-white/10 relative z-30 pb-4 pt-2 shadow-[0_-10px_40px_rgba(0,0,0,1)]">
                   <div className="grid grid-cols-3 gap-1 px-4"> {[1,2,3,4,5,6,7,8,9,'.',0].map(n => ( <button key={n} onClick={() => handleDigitPress(String(n))} className="h-14 bg-zinc-900 rounded-xl text-3xl font-black text-white active:bg-zinc-800 active:scale-95 transition-all flex items-center justify-center shadow-inner border border-white/5"> {n} </button> ))} <button onClick={() => setInputValue(prev => prev.slice(0, -1))} className="h-14 bg-zinc-900/50 rounded-xl text-xl font-black text-rose-500 active:bg-rose-500/20 active:scale-95 transition-all flex items-center justify-center border border-white/5 uppercase tracking-widest"> <Delete size={28} /> </button> </div>
                   <div className="px-4 pt-2"> <button onClick={handleRecordSubmit} disabled={submitting || !inputValue} className="w-full h-14 bg-gradient-to-r from-chiachia-green to-emerald-600 text-black font-black text-2xl italic tracking-widest rounded-xl shadow-[0_0_20px_rgba(57,231,95,0.4)] active:scale-[0.98] transition-all uppercase flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale disabled:shadow-none"> {submitting ? <Loader2 className="animate-spin" /> : <span className="drop-shadow-sm">ENTER RECORD</span>} </button> </div>
               </div>
          </div>
       , document.body)}

       {deleteConfirm.show && createPortal(
          <div className="fixed inset-0 z-[70000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
              <div className="glass-card w-full max-w-xs rounded-3xl p-6 border-chiachia-green/20 text-center animate-scale-in shadow-[0_0_20px_rgba(57,231,95,0.15)]">
                  <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4"> <AlertTriangle size={32} /> </div>
                  <h3 className="text-xl font-black text-white italic mb-2">刪除紀錄</h3>
                  <p className="text-zinc-400 text-sm font-bold mb-6">確定要刪除此筆訓練紀錄嗎？此動作無法復原。</p>
                  <div className="grid grid-cols-2 gap-3"> <button onClick={() => setDeleteConfirm({ show: false })} className="py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl active:bg-zinc-700 transition-colors">取消</button> <button onClick={handleDeleteRecord} disabled={submitting} className="py-3 bg-rose-600 text-white font-black rounded-xl shadow-glow-rose active:scale-95 transition-all flex items-center justify-center"> {submitting ? <Loader2 size={16} className="animate-spin" /> : '確認刪除'} </button> </div>
              </div>
          </div>
       , document.body)}
       {showBioModal && createPortal( <div className="fixed inset-0 z-[60000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-fade-in" onClick={() => setShowBioModal(false)}> <div className="glass-card w-full max-w-sm rounded-3xl p-6 border-white/10 flex flex-col gap-4 animate-scale-in relative shadow-xl" onClick={e => e.stopPropagation()}> <button onClick={() => setShowBioModal(false)} className="absolute top-4 left-4 text-zinc-500 hover:text-white p-1"><X size={20}/></button> <div className="flex flex-col items-center gap-3"> <div className="w-14 h-14 rounded-full border-2 border-white bg-zinc-950 overflow-hidden shadow-lg"> {activeRider?.s_url ? <img src={activeRider.s_url.split('#')[0]} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-zinc-600"><UserCircle2 size={32}/></div>} </div> <div className="text-center"> <h3 className="text-xl font-black text-white italic">{activeRider?.name}</h3> <div className="text-xs text-zinc-500 font-bold uppercase tracking-widest">About Me</div> </div> </div> <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 relative mt-2"> <Quote size={20} className="absolute top-4 left-4 text-chiachia-green/20" /> <p className="text-base font-bold text-zinc-300 leading-relaxed whitespace-pre-wrap relative z-10 text-center"> {activeRider?.myword || 'No bio available.'} </p> <Quote size={20} className="absolute bottom-4 right-4 text-chiachia-green/20 rotate-180" /> </div> </div> </div> , document.body)}
       {showRiderSelectModal && createPortal( <div className="fixed inset-0 z-[60000] flex items-end justify-center bg-black/90 backdrop-blur-md animate-fade-in pb-[env(safe-area-inset-bottom)]" onClick={() => setShowRiderSelectModal(false)}> <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 animate-slide-up max-h-[85vh] overflow-hidden shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}> <div className="flex items-center justify-between border-b border-white/5 pb-4"> <button onClick={() => setShowRiderSelectModal(false)} className="w-10 h-10 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400 active:scale-95 transition-all"><X size={20}/></button> <h3 className="text-xl font-black text-white italic pr-2">{isRecordingMode ? 'Select Riders' : 'Switch Rider'}</h3> <div className="w-8"></div> </div> <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-2 gap-4 p-1"> {sortedPeople.map((p: any) => { const isSelected = isRecordingMode ? participatingRiderIds.includes(String(p.id)) : String(p.id) === String(activeRider?.id); return ( <button key={p.id} onClick={() => handleRiderSelection(String(p.id))} className={`relative flex flex-col items-center gap-3 p-4 rounded-3xl border transition-all ${isSelected ? 'bg-chiachia-green/10 border-chiachia-green' : 'bg-zinc-900 border-white/5 hover:bg-zinc-800'}`}> <div className={`w-20 h-20 rounded-full overflow-hidden border-2 bg-black ${isSelected ? 'border-chiachia-green shadow-glow-green' : 'border-zinc-700'}`}> {p.s_url ? <img src={p.s_url.split('#')[0]} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-zinc-600"><UserPlus size={28}/></div>} </div> <span className={`text-sm font-black truncate w-full text-center ${isSelected ? 'text-white' : 'text-zinc-500'}`}>{p.name}</span> {isSelected && <div className="absolute top-3 right-3 w-6 h-6 bg-chiachia-green rounded-full flex items-center justify-center text-black shadow-sm"><Check size={14} strokeWidth={4}/></div>} </button> ); })} </div> {isRecordingMode && <button onClick={() => setShowRiderSelectModal(false)} className="w-full py-4 bg-zinc-800 text-white font-bold rounded-xl active:scale-95 transition-all">Done ({participatingRiderIds.length})</button>} </div> </div> , document.body)}
       {showHistoryModal.show && createPortal( <div className="fixed inset-0 z-[60000] flex items-end justify-center bg-black/90 backdrop-blur-md animate-fade-in pb-[env(safe-area-inset-bottom)]" onClick={() => setShowHistoryModal({ show: false })}> <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-4 animate-slide-up max-h-[80vh] overflow-hidden shadow-[0_0_20px_rgba(57,231,95,0.15)]" onClick={e => e.stopPropagation()}> <div className="flex justify-between items-center border-b border-white/5 pb-4"> <h3 className="text-2xl font-black text-white italic">Record History</h3> <button onClick={() => setShowHistoryModal({ show: false })} className="p-2 bg-zinc-800 rounded-full text-zinc-400"><X size={18}/></button> </div> <div className="flex-1 overflow-y-auto no-scrollbar space-y-2"> {todaySessionRecords.map((r: any, idx: number) => { const runNumber = todaySessionRecords.length - idx; const isEditing = editingHistoryId === r.id; const isBest = todayBestScore !== null && Math.abs(parseFloat(r.value) - todayBestScore) < 0.0001; return ( <div key={r.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-colors group ${isEditing ? 'bg-zinc-800 border-chiachia-green/30' : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-900'}`}> <div className="flex items-center gap-3"> <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs font-mono border ${isBest ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-zinc-950 text-zinc-500 border-white/5'}`}> #{runNumber} </div> <div> {isEditing ? ( <div className="text-[10px] text-chiachia-green font-bold uppercase tracking-wider">Editing...</div> ) : ( <div className="flex items-baseline gap-2"> <div className="text-2xl font-black text-white font-mono leading-none"> {parseFloat(r.value).toFixed(3)}<span className="text-xs text-zinc-600 ml-0.5">s</span> </div> {isBest && ( <div className="text-[10px] font-black text-amber-400 italic tracking-wider flex items-center gap-1 animate-pulse"> <Trophy size={10} strokeWidth={3} /> BEST </div> )} </div> )} </div> </div> <div className="flex items-center gap-2"> {isEditing ? ( <> <input type="number" autoFocus value={editHistoryValue} onChange={(e) => { const val = e.target.value; if (val.includes('.')) { const parts = val.split('.'); if (parts[1] && parts[1].length > 3) return; } setEditHistoryValue(val); }} className="w-20 bg-black border border-white/20 rounded-lg px-2 py-2 text-white font-mono font-bold text-lg text-center outline-none focus:border-chiachia-green" /> <button onClick={() => handleSaveEdit(r)} className="p-2 bg-chiachia-green text-black rounded-lg shadow-glow-green active:scale-95"><Save size={16}/></button> <button onClick={() => setEditingHistoryId(null)} className="p-2 bg-zinc-700 text-zinc-400 rounded-lg active:scale-95"><X size={16}/></button> </> ) : ( <> <button onClick={() => startEditingHistory(r)} className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:text-white active:scale-95 transition-all"> <Edit2 size={16}/> </button> <button onClick={() => setDeleteConfirm({show: true, id: r.id})} className="p-2 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500/20 active:scale-95 transition-all"> <Trash2 size={16}/> </button> </> )} </div> </div> ); })} {todaySessionRecords.length === 0 && <div className="text-center py-8 text-zinc-600 text-xs">No records for today</div>} </div> </div> </div> , document.body)}
    </div>
  );
};

// Vertical Slide Ticker Component
const HonorTicker = ({ items }: { items: any[] }) => {
    if (!items || items.length === 0) return null;
    
    if (items.length === 1) {
        return (
            <div className="flex items-center gap-2 w-full h-full">
                <span className="text-[10px] text-zinc-500 font-mono shrink-0">{format(parseISO(items[0].date), 'MM/dd')}</span>
                <span className="text-xs font-bold text-white truncate min-w-0">{items[0].name}</span>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1 ml-auto">
                    <Flame size={10} className="fill-amber-400" /> {items[0].rank}
                </span>
            </div>
        );
    }

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(true);
    const totalItems = items.length;
    
    const stableItems = useMemo(() => items, [JSON.stringify(items)]);
    const displayList = useMemo(() => [...stableItems, stableItems[0]], [stableItems]);

    useEffect(() => {
        if (totalItems <= 1) return;
        
        const interval = setInterval(() => {
            setIsTransitioning(true);
            setCurrentIndex((prev) => prev + 1);
        }, 3000);

        return () => clearInterval(interval);
    }, [totalItems]);

    useEffect(() => {
        if (currentIndex >= totalItems && totalItems > 0) {
            const timer = setTimeout(() => {
                setIsTransitioning(false);
                setCurrentIndex(0);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentIndex, totalItems]);

    return (
        <div className="relative w-full h-full overflow-hidden">
            <div 
                className="flex flex-col w-full h-full"
                style={{ 
                    transform: `translateY(-${currentIndex * 100}%)`,
                    transition: isTransitioning ? 'transform 0.5s ease-in-out' : 'none' 
                }}
            >
                {displayList.map((item, i) => {
                    if (!item) return null;
                    return (
                        <div key={i} className="w-full h-full flex-shrink-0 flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">{format(parseISO(item.date), 'MM/dd')}</span>
                        <span className="text-xs font-bold text-white truncate min-w-0">{item.name}</span>
                        <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1 ml-auto">
                            <Flame size={10} className="fill-amber-400" /> {item.rank}
                        </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Training;
