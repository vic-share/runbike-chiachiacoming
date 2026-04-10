import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { DataRecord, LegendRecord, LookupItem } from '../types';
import { ChevronRight, Trophy, MapPin, Zap, CalendarDays, ChevronDown, Activity, UserCircle2, X, Maximize2, Flame, Download, Share2 } from 'lucide-react';
import { SimpleComposedChart } from '../components/SimpleComposedChart';
import { ForecastItem } from '../components/ForecastItem';
import { format, parseISO, isAfter, subDays, subMonths, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';

// 1. Hall of Fame Ticker (Rhythmic Switch)
const HallOfFameTicker = ({ items }: { items: LegendRecord[] }) => {
    if (items.length === 0) return null;

    const [currentIndex, setCurrentIndex] = useState(0);
    const [fadeState, setFadeState] = useState<'in' | 'out'>('in');

    useEffect(() => {
        if (items.length <= 1) return;
        const interval = setInterval(() => {
            setFadeState('out');
            setTimeout(() => {
                setCurrentIndex(prev => (prev + 1) % items.length);
                setFadeState('in');
            }, 500); // 0.5s fade out duration
        }, 4000);
        return () => clearInterval(interval);
    }, [items.length]);

    const item = items[currentIndex];
    if (!item) return null;

    return (
        <div className="w-full h-24 relative flex items-center">
            <div 
                className={`w-full flex items-center gap-4 transition-all duration-500 ease-in-out ${fadeState === 'in' ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-95 blur-sm'}`}
            >
                {/* Avatar */}
                <div className="w-16 h-16 rounded-full border-2 border-amber-500/50 overflow-hidden flex-shrink-0 bg-black shadow-glow-gold relative z-10">
                    {item.avatar_url ? <img src={item.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-zinc-800"/>}
                </div>
                
                {/* Content Grid */}
                <div className="flex-1 min-w-0 flex items-center gap-4">
                    <div className="flex flex-col justify-center min-w-0">
                        <span className="text-xl font-black text-white truncate italic tracking-tight">{item.name}</span>
                        <span className="text-xs font-bold text-zinc-500 truncate mt-0.5 flex items-center gap-1">
                            {item.type_name}
                        </span>
                    </div>

                    {/* Ranking (Moved to Far Right & Prominent) */}
                    <div className="ml-auto flex items-center">
                        {item.ranking && (
                            <span className="text-3xl font-black text-amber-500 italic tracking-tighter drop-shadow-glow flex items-center gap-1">
                                <Trophy size={18} className="mb-1" />
                                {item.ranking}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// 2. Forecast Ticker (Updated Location & Styles)
const ForecastTicker = ({ items, onNavigate, raceGroups }: { items: any[], onNavigate: (id: string|number) => void, raceGroups: LookupItem[] }) => {
    const limitedItems = useMemo(() => items.slice(0, 3), [items]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(true);
    
    const displayList = useMemo(() => limitedItems.length > 1 ? [...limitedItems, limitedItems[0]] : limitedItems, [limitedItems]);

    useEffect(() => {
        if (limitedItems.length <= 1) return;
        const interval = setInterval(() => {
            setIsTransitioning(true);
            setCurrentIndex(prev => prev + 1);
        }, 4000);
        return () => clearInterval(interval);
    }, [limitedItems.length]);

    useEffect(() => {
        if (currentIndex >= limitedItems.length && limitedItems.length > 0) {
            const timer = setTimeout(() => {
                setIsTransitioning(false);
                setCurrentIndex(0);
            }, 500); // Match transition duration
            return () => clearTimeout(timer);
        }
    }, [currentIndex, limitedItems.length]);

    if (items.length === 0) {
        return (
            <div className="w-full glass-card rounded-2xl p-8 text-center text-zinc-600 text-xs font-bold uppercase tracking-widest border-dashed">
                No Upcoming Races
            </div>
        );
    }

    return (
        <div className="h-20 overflow-hidden relative glass-card rounded-2xl border-white/5 group">
            <div 
                className="flex flex-col"
                style={{ 
                    transform: `translateY(-${currentIndex * 80}px)`,
                    transition: isTransitioning ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
                }}
            >
                {displayList.map((race, idx) => (
                    <ForecastItem key={idx} race={race} raceGroups={raceGroups} onNavigate={onNavigate} />
                ))}
            </div>
        </div>
    );
};

const Dashboard: React.FC<any> = ({ onNavigateToRaces, data, trainingTypes, raceGroups, onNavigateToTraining, defaultTrainingType, people, legends = [], forecast = [] }) => {
  // Trend State
  const [trendType, setTrendType] = useState<string | number>(defaultTrainingType);
  const [trendDateRange, setTrendDateRange] = useState<'1W' | '1M' | '3M' | 'ALL' | 'PICK'>('1M');
  const [customDateRange, setCustomDateRange] = useState<{start: string, end: string}>({
      start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd')
  });
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  
  // 🟢 分頁狀態：預設顯示 20 筆
  const [displayCount, setDisplayCount] = useState(20);
  
  // Modal State for Trend Analysis
  const [trendModal, setTrendModal] = useState<{ show: boolean, data: any | null }>({ show: false, data: null });

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
      return Math.max(0, Math.min(100, (100 - (cv * 700)) * 0.6 + (100 - (range * 50)) * 0.4));
  };

  useEffect(() => {
      if (trainingTypes.length > 0 && !trendType) {
          setTrendType(trainingTypes[0].id);
      }
  }, [trainingTypes]);

  // 🟢 當篩選條件改變時，重置顯示數量
  useEffect(() => {
      setDisplayCount(20);
  }, [trendType, trendDateRange, customDateRange]);

  // Process Trend Data
  const trendData = useMemo(() => {
      let typeId = trendType;
      if (typeof trendType === 'string') {
          const t = trainingTypes.find((t: any) => t.name === trendType || t.type_name === trendType || String(t.id) === trendType);
          if (t) typeId = t.id;
      }

      const now = new Date();
      const filtered = data.filter((d: any) => {
          if (String(d.training_type_id) !== String(typeId)) return false;
          if (d.item !== 'training') return false;
          const dDate = parseISO(d.date);
          if (!isValid(dDate)) return false;

          if (trendDateRange === 'PICK') {
              const start = parseISO(customDateRange.start);
              const end = parseISO(customDateRange.end);
              if (isValid(start) && isValid(end)) {
                  return isWithinInterval(dDate, { start: startOfDay(start), end: endOfDay(end) });
              }
              return true;
          }

          if (trendDateRange === '1W') return isAfter(dDate, subDays(now, 7));
          if (trendDateRange === '1M') return isAfter(dDate, subMonths(now, 1));
          if (trendDateRange === '3M') return isAfter(dDate, subMonths(now, 3));
          return true;
      });

      const groupedByDate: Record<string, any[]> = {};
      filtered.forEach((d: any) => {
          if (!groupedByDate[d.date]) groupedByDate[d.date] = [];
          groupedByDate[d.date].push(d);
      });

      const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      return sortedDates.map(date => {
          const dailyRecords = groupedByDate[date];
          const personStats: Record<string, number[]> = {};
          dailyRecords.forEach((r: any) => {
              if (!personStats[r.people_id]) personStats[r.people_id] = [];
              const val = parseFloat(r.value);
              if (!isNaN(val)) personStats[r.people_id].push(val);
          });

          const riders = Object.keys(personStats).map(pid => {
              const values = personStats[pid];
              const best = Math.min(...values);
              const sum = values.reduce((a, b) => a + b, 0);
              const avg = sum / values.length;
              const stability = calculateStability(values);

              const person = people.find((p:any) => String(p.id) === String(pid));

              return {
                  id: pid,
                  name: person?.name || 'Unknown',
                  avatar: person?.s_url,
                  avg: parseFloat(avg.toFixed(3)),
                  best: parseFloat(best.toFixed(3)),
                  stability: Math.round(stability),
                  rawScores: values
              };
          }).sort((a, b) => a.best - b.best); 

          return { date, riders };
      });
  }, [data, trendType, trendDateRange, customDateRange, trainingTypes, people]);

  // 🟢 取得分頁後的資料
  const visibleTrendData = useMemo(() => trendData.slice(0, displayCount), [trendData, displayCount]);

  const handleJumpToRider = (riderId: string, date: string) => {
      setTrendModal({ show: false, data: null }); // Close modal
      if (onNavigateToTraining) {
          onNavigateToTraining(riderId, date);
      }
  };

  const openTrendModal = (dayData: any) => {
      setTrendModal({ show: true, data: dayData });
  };

  const handleShareText = async () => {
      if (!trendModal.data) return;
      const { date, riders } = trendModal.data;
      const dateStr = format(parseISO(date), 'yyyy-MM-dd');
      let text = `📅 ${dateStr} 訓練日報\n\n`;

      riders.forEach((r: any, i: number) => {
          text += `${i + 1}. ${r.name}\n`;
          text += `   🏆 Best: ${r.best}s | 📊 Avg: ${r.avg}s | ⚡ Stab: ${r.stability}%\n\n`;
      });

      text += `Generated by Chia Chia Coming`;

      if (navigator.share) {
          try {
              await navigator.share({
                  title: `${dateStr} 訓練日報`,
                  text: text,
              });
          } catch (error) {
              console.log('Error sharing', error);
          }
      } else {
          try {
              await navigator.clipboard.writeText(text);
              alert('報表已複製到剪貼簿！');
          } catch (err) {
              alert('無法複製內容');
          }
      }
  };

  const handleDownloadCSV = () => {
      if (!trendModal.data) return;

      // Find Item Name
      let typeName = 'Training';
      if (trainingTypes && trendType) {
          const t = trainingTypes.find((t: any) => String(t.id) === String(trendType) || t.name === trendType || t.type_name === trendType);
          if (t) typeName = t.name || t.type_name;
      }

      // Max columns needed
      let maxScores = 0;
      trendModal.data.riders.forEach((r: any) => {
          if (r.rawScores && r.rawScores.length > maxScores) maxScores = r.rawScores.length;
      });

      // Headers
      const headers = ['Date', 'Name', 'null', 'null'];
      for (let i = 1; i <= maxScores; i++) headers.push(`Score${i}`);

      // Rows
      const rows = trendModal.data.riders.map((r: any) => {
          const row = [
              trendModal.data.date,
              r.name,
              '',
              '',
              ...(r.rawScores || [])
          ];
          return row.join(',');
      });

      const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
      
      // Filename: YYYYMMDD_ItemName_report.csv
      const dateStr = trendModal.data.date.replace(/-/g, '');
      const safeName = typeName.replace(/[\/\\:*?"<>|]/g, '_');
      const filename = `${dateStr}_${safeName}_report.csv`;

      // Trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const getRangeLabel = () => {
      if (trendDateRange === 'PICK') {
          if (!customDateRange.start || !customDateRange.end) return '自訂範圍';
          try {
              return `${format(parseISO(customDateRange.start), 'MM/dd')} - ${format(parseISO(customDateRange.end), 'MM/dd')}`;
          } catch(e) { return 'Invalid Date'; }
      }
      switch(trendDateRange) {
          case '1W': return '最近 1 週';
          case '1M': return '最近 1 月';
          case '3M': return '最近 3 月';
          case 'ALL': return '全部時間';
          default: return '日期範圍';
      }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 space-y-8 animate-fade-in no-scrollbar pb-28">
      {/* 賽事預報 */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <h2 className="text-xs font-black text-zinc-600 tracking-[0.3em] uppercase">Upcoming Races</h2>
            <div className="text-2xl font-black text-white italic tracking-tight">近期賽事預報</div>
          </div>
          <button onClick={() => onNavigateToRaces(null)} className="text-xs font-bold text-zinc-600 flex items-center gap-0.5 hover:text-zinc-400 transition-colors">VIEW ALL <ChevronRight size={14}/></button>
        </div>
        
        <ForecastTicker items={forecast} onNavigate={onNavigateToRaces} raceGroups={raceGroups} />
      </section>

      {/* Global Hall of Fame */}
      <section className="relative">
         <div className="flex flex-col mb-4">
            <h2 className="text-xs font-black text-zinc-600 tracking-[0.3em] uppercase">Hall of Fame</h2>
            <div className="text-2xl font-black text-white italic tracking-tight flex items-center gap-2">
                榮譽榜
            </div>
         </div>
         <div className="relative py-2 px-1">
             {legends.length > 0 ? (
                 <HallOfFameTicker items={legends} />
             ) : (
                 <div className="flex items-center justify-center w-full h-20 text-zinc-700 text-xs font-black uppercase tracking-widest gap-2 bg-zinc-900/30 rounded-2xl border border-dashed border-white/5">
                     <Trophy size={16} className="text-zinc-800" />
                     Waiting for Coach Selection
                 </div>
             )}
         </div>
      </section>

      {/* 訓練趨勢分析 (Trend Analysis) */}
      <section className="space-y-4">
         <div className="flex flex-col">
            <h2 className="text-xs font-black text-zinc-600 tracking-[0.3em] uppercase">Training Insights</h2>
            <div className="text-2xl font-black text-white italic tracking-tight">訓練趨勢分析</div>
         </div>

         {/* Filters */}
         <div className="flex justify-between items-center gap-2">
             <div className="relative flex-1">
                 <select value={trendType} onChange={e => setTrendType(e.target.value)} className="w-full bg-zinc-900 border border-white/10 text-white text-xs font-black uppercase tracking-wider rounded-xl px-3 py-2.5 pr-8 outline-none appearance-none h-10"> 
                    {trainingTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name || t.type_name}</option>)} 
                 </select>
                 <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
             </div>
             
             {/* New Collapsible Date Filter */}
             <div className="relative flex-1 max-w-[160px] z-50">
                 <button 
                     onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
                     className={`relative flex items-center justify-between px-3 h-10 w-full rounded-xl border transition-all ${isDateMenuOpen ? 'bg-zinc-800 border-white/20 text-white' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}
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
                                     onClick={() => { setTrendDateRange(opt); setIsDateMenuOpen(false); }}
                                     className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider ${trendDateRange === opt ? 'bg-chiachia-green text-black' : 'bg-black/40 text-zinc-400 hover:text-white'}`}
                                 >
                                     {opt === '1W' ? '1 週' : opt === '1M' ? '1 月' : opt === '3M' ? '3 月' : '全部'}
                                 </button>
                             ))}
                         </div>
                         <button 
                             onClick={() => setTrendDateRange('PICK')}
                             className={`py-2 px-3 rounded-lg text-left text-xs font-bold transition-all ${trendDateRange === 'PICK' ? 'bg-zinc-800 text-chiachia-green border border-chiachia-green/30' : 'text-zinc-400 hover:bg-white/5'}`}
                         >
                             自訂範圍...
                         </button>
                         
                         {trendDateRange === 'PICK' && (
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

         {/* Daily Cards */}
         <div className="space-y-6">
             {visibleTrendData.map((dayData, idx) => (
                 <button 
                    key={dayData.date} 
                    onClick={() => openTrendModal(dayData)}
                    className="w-full text-left glass-card rounded-[24px] p-5 border-white/5 relative overflow-hidden group transition-all active:scale-[0.98] focus:outline-none"
                 >
                     {/* Date Header */}
                     <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                         <div className="flex items-center gap-3">
                             <div className="w-1.5 h-10 bg-chiachia-green rounded-full shadow-glow-green"></div>
                             <div>
                                 <div className="text-2xl font-black text-white font-mono leading-none">{format(parseISO(dayData.date), 'yyyy.MM.dd')}</div>
                                 <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{format(parseISO(dayData.date), 'EEEE')}</div>
                             </div>
                         </div>
                         <div className="flex items-center gap-2">
                             <div className="text-xs font-black bg-zinc-800 px-2.5 py-1 rounded-lg text-zinc-400">{dayData.riders.length} Riders</div>
                             <Maximize2 size={16} className="text-zinc-600 group-hover:text-chiachia-green transition-colors"/>
                         </div>
                     </div>

                     {/* Chart Preview */}
                     <div className="h-44 w-full mb-2 bg-black/20 rounded-xl border border-white/5 p-2 pointer-events-none">
                         <SimpleComposedChart 
                             data={dayData.riders} 
                             xKey="name" 
                             areaKey="avg" 
                             lineKeys={[
                                 { key: 'best', color: '#fbbf24' },
                                 { key: 'stability', color: '#3b82f6', strokeDasharray: '4 4' }
                             ]}
                             showXAxis={true}
                             xAxisFormatter={(val: any) => String(val)}
                         />
                     </div>
                 </button>
             ))}

             {/* 🟢 載入更多按鈕 */}
             {trendData.length > displayCount && (
                 <button 
                    onClick={() => setDisplayCount(prev => prev + 20)}
                    className="w-full py-4 rounded-2xl border border-white/10 bg-zinc-900/50 text-zinc-400 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-zinc-800 hover:text-white"
                 >
                    載入更多日期 ({trendData.length - displayCount}) <ChevronDown size={14}/>
                 </button>
             )}

             {trendData.length === 0 && (
                 <div className="py-12 flex flex-col items-center opacity-30">
                     <Activity size={48} className="text-zinc-500 mb-2"/>
                     <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">No Data in Range</span>
                 </div>
             )}
         </div>
      </section>

      {/* Trend Detail Modal */}
      {trendModal.show && trendModal.data && createPortal(
          <div className="fixed inset-0 z-[60000] flex flex-col bg-zinc-950 animate-slide-up">
              {/* Header - Increased top padding and reordered elements */}
              <div className="flex-none flex items-center justify-between px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] border-b border-white/5 bg-zinc-950/90 backdrop-blur-md relative z-10 shadow-2xl">
                  
                  {/* Left: Close Button (Primary Action for navigation) */}
                  <button onClick={() => setTrendModal({ show: false, data: null })} className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 active:bg-zinc-800 transition-all border border-white/5 shadow-lg active:scale-95 hover:text-white">
                      <X size={20}/>
                  </button>

                  {/* Center: Title */}
                  <div className="flex flex-col items-center">
                      <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{format(parseISO(trendModal.data.date), 'yyyy.MM.dd')}</div>
                      <h3 className="text-lg font-black text-white italic tracking-wider">DAILY REPORT</h3>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2">
                      <button onClick={handleShareText} className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 active:bg-zinc-800 transition-all border border-white/5 shadow-lg active:scale-95 hover:text-white">
                          <Share2 size={20}/>
                      </button>
                      <button onClick={handleDownloadCSV} className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 active:bg-zinc-800 transition-all border border-white/5 shadow-lg active:scale-95 hover:text-chiachia-green">
                          <Download size={20}/>
                      </button>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pb-[env(safe-area-inset-bottom)]">
                  {/* Scrollable Chart Area */}
                  <div className="p-4 border-b border-white/5 bg-zinc-900/30">
                      <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2 flex justify-between">
                          <span>Performance Overview</span>
                          <span className="text-chiachia-green flex items-center gap-1"><Maximize2 size={12}/> Scroll to Move</span>
                      </div>
                      {/* Horizontal Scroll Container for Chart */}
                      <div className="w-full overflow-x-auto no-scrollbar pb-2">
                          {/* Force width calculation to ensure scroll capability */}
                          {(() => {
                              const chartWidth = Math.max(window.innerWidth - 48, trendModal.data.riders.length * 80);
                              return (
                                  <div style={{ width: chartWidth, height: '280px' }}>
                                     <SimpleComposedChart 
                                         data={trendModal.data.riders} 
                                         xKey="name" 
                                         areaKey="avg" 
                                         lineKeys={[
                                             { key: 'best', color: '#fbbf24' },
                                             { key: 'stability', color: '#3b82f6', strokeDasharray: '4 4' }
                                         ]}
                                         height={280}
                                         showXAxis={true}
                                         xAxisFormatter={(val: any) => String(val)}
                                     />
                                  </div>
                              );
                          })()}
                      </div>
                  </div>

                  {/* Rider Data Cards */}
                  <div className="p-4 space-y-3 pb-24">
                      <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-1">Rider Details ({trendModal.data.riders.length})</div>
                      {trendModal.data.riders.map((rider: any) => (
                         <button 
                            key={rider.id} 
                            onClick={() => handleJumpToRider(rider.id, trendModal.data.date)}
                            className="w-full flex items-center justify-between p-4 rounded-2xl bg-zinc-900 border border-white/5 active:scale-[0.98] transition-all hover:border-chiachia-green/30 group"
                         >
                             <div className="flex items-center gap-4 min-w-0 flex-1">
                                 <div className="w-12 h-12 rounded-full bg-black overflow-hidden border border-white/10 shrink-0 shadow-lg flex items-center justify-center">
                                     {rider.avatar ? (
                                         <img src={rider.avatar} className="w-full h-full object-cover"/>
                                     ) : (
                                         <span className="text-xl font-black text-zinc-600">{rider.name?.[0]}</span>
                                     )}
                                 </div>
                                 <div className="text-left min-w-0">
                                     <div className="text-base font-black text-white truncate">{rider.name}</div>
                                 </div>
                             </div>
                             
                             <div className="flex items-center gap-3 shrink-0">
                                 <div className="flex flex-col items-end w-16">
                                     <div className="text-[10px] text-zinc-500 font-black uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                        <Activity size={10} className="text-chiachia-green"/> AVG
                                     </div>
                                     <div className="text-sm font-mono font-bold text-zinc-300">{rider.avg}</div>
                                 </div>
                                 <div className="flex flex-col items-end w-16">
                                     <div className="text-[10px] text-zinc-500 font-black uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                        <Trophy size={10} className="text-amber-400"/> BEST
                                     </div>
                                     <div className="text-base font-mono font-black text-amber-400 leading-none">{rider.best}</div>
                                 </div>
                                 <div className="flex flex-col items-end w-20">
                                     <div className="text-[10px] text-zinc-500 font-black uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                        <Zap size={10} className="text-blue-400"/> STABILITY
                                     </div>
                                     <div className="text-sm font-mono font-bold text-blue-400 leading-none">{rider.stability}%</div>
                                 </div>
                                 <ChevronRight size={18} className="text-zinc-700 group-hover:text-chiachia-green transition-colors ml-1"/>
                             </div>
                         </button>
                      ))}
                  </div>
              </div>
          </div>
      , document.body)}
    </div>
  );
};

export default Dashboard;