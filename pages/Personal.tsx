import React, { useState, useMemo } from 'react';
import { api } from '../services/api';
import { uploadImage } from '../services/supabase';
import { DataRecord, LookupItem } from '../types';
import { User, Award, Activity, Camera, UploadCloud, Loader2, ChevronRight, Trophy, MapPin, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { hasRole, ROLES } from '../utils/auth';

const Personal: React.FC<any> = ({ data, people, trainingTypes, raceGroups, refreshData, activePersonId, onSelectPerson, onNavigateToTraining }) => {
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // 搜尋關鍵字狀態

  const person = useMemo(() => people.find((p: any) => String(p.id) === String(activePersonId)), [people, activePersonId]);
  
  const personalData = useMemo(() => data.filter((d: any) => String(d.people_id) === String(activePersonId)), [data, activePersonId]);

  // 動態搜尋邏輯
  const filteredRiders = useMemo(() => {
    const riders = people.filter((p: any) => !p.is_hidden && !hasRole(p, ROLES.DEV));
    if (!searchTerm.trim()) return riders;
    return riders.filter((p: any) => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.full_name && p.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [people, searchTerm]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, typeSuffix: 's' | 'b') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadImage(file, 'people', {
          personId: activePersonId,
          typeSuffix: typeSuffix
      });
      
      if (result.url) {
          const person = people.find((p: any) => String(p.id) === String(activePersonId));
          await api.manageLookup('people', person?.name || '', activePersonId, false, false, {
              [typeSuffix === 's' ? 's_url' : 'b_url']: result.url
          });
          refreshData();
          alert('照片上傳成功');
      } else {
          alert(result.error);
      }
    } catch (err) {
      console.error('Personal image upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 space-y-8 no-scrollbar pb-28">
      {/* Profile Header - 名稱不截斷 + AGE 極致右推 */}
      <section className="relative">
         <div className="aspect-[4/5] rounded-[32px] bg-zinc-900 overflow-hidden relative border border-white/5">
            {person?.b_url ? (
              <img src={person.b_url.split('#')[0]} className="w-full h-full object-cover opacity-60" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-black" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
            
            <div className="absolute bottom-6 left-6 right-6 flex items-end gap-4">
               {/* 大頭貼 */}
               <div className="w-24 h-24 rounded-3xl border-2 border-chiachia-green bg-zinc-950 shadow-glow-green overflow-hidden relative shrink-0">
                  {person?.s_url ? (
                    <img src={person.s_url.split('#')[0]} className="w-full h-full object-contain p-1" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-600"><User size={40}/></div>
                  )}
               </div>

               {/* 資訊區塊：使用 w-full 撐開 */}
               <div className="pb-1 min-w-0 flex-1">
                  <div className="flex justify-between items-center w-full">
                    {/* 名字區塊：移除 truncate 確保完整顯示，使用 break-words 預防超長名字 */}
                    <div className="flex-1 min-w-0 pr-2">
                        <h2 className="text-3xl font-black text-white italic leading-tight break-words">
                        {person?.full_name || person?.name || '---'}
                        </h2>
                    </div>
                    
                    {/* AGE 標籤：使用 shrink-0 防止被擠壓，並靠右顯示 */}
                    <div className="bg-zinc-800/90 backdrop-blur-sm border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xl shrink-0 ml-auto">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">AGE</span>
                        <span className="text-sm font-black text-white font-mono leading-none">
                            {person?.birthday || '-'}
                        </span>
                    </div>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4">
          <div className="glass-card p-5 rounded-3xl space-y-1">
              <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Activity size={12} className="text-chiachia-green"/> Training</div>
              <div className="text-2xl font-black text-white font-mono">
                {personalData.filter(d => d.item === 'training').length} <span className="text-[10px] text-zinc-600">runs</span>
              </div>
          </div>
          <div className="glass-card p-5 rounded-3xl space-y-1">
              <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Award size={12} className="text-amber-400"/> Races</div>
              <div className="text-2xl font-black text-white font-mono">
                {personalData.filter(d => d.item === 'race').length} <span className="text-[10px] text-zinc-600">events</span>
              </div>
          </div>
      </div>

      {/* 選手選擇與搜尋區塊 */}
      <section className="space-y-4">
          <div className="text-[10px] font-black text-zinc-600 tracking-[0.3em] uppercase px-1">選擇</div>
          
          {/* 動態搜尋框 */}
          <div className="relative group mx-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-chiachia-green transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="搜尋姓名 (例如: 睿)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-12 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-chiachia-green/30 focus:bg-zinc-900 transition-all"
              />
              {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
              )}
          </div>

          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 py-2">
              {filteredRiders.map((p: any) => (
                  <button 
                    key={p.id} 
                    onClick={() => onSelectPerson(p.id)}
                    className={`shrink-0 flex flex-col items-center gap-2.5 p-3.5 rounded-2xl border transition-all ${String(p.id) === String(activePersonId) ? 'bg-chiachia-green border-chiachia-green text-black shadow-glow-green scale-105' : 'bg-zinc-900 border-white/5 text-white hover:bg-zinc-800'}`}
                  >
                      <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${String(p.id) === String(activePersonId) ? 'border-black/20' : 'border-zinc-800'}`}>
                          {p.s_url ? <img src={p.s_url.split('#')[0]} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-zinc-800" />}
                      </div>
                      <span className="text-[10px] font-black tracking-wider">{p.name}</span>
                  </button>
              ))}
              {filteredRiders.length === 0 && (
                  <div className="w-full text-center py-6 text-zinc-600 text-xs font-bold italic tracking-widest bg-zinc-900/20 rounded-2xl border border-dashed border-white/5">
                      找不到符合 "{searchTerm}" 的選手
                  </div>
              )}
          </div>
      </section>

      {/* Recent Activity Mini List */}
      <section className="space-y-4">
          <div className="text-[10px] font-black text-zinc-600 tracking-[0.3em] uppercase">Recent Records</div>
          <div className="space-y-2">
              {personalData.slice(0, 5).map((rec: any, i: number) => (
                  <div key={i} className="glass-card p-4 rounded-2xl flex justify-between items-center border-white/5">
                      <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${rec.item === 'training' ? 'bg-chiachia-green/10 text-chiachia-green' : 'bg-amber-400/10 text-amber-400'}`}>
                             {rec.item === 'training' ? <Activity size={16}/> : <Trophy size={16}/>}
                          </div>
                          <div>
                              <div className="text-xs font-bold text-white">{rec.name || (rec.item === 'training' ? 'Training' : 'Race')}</div>
                              <div className="text-[10px] text-zinc-500 font-mono">{rec.date}</div>
                          </div>
                      </div>
                      <div className="text-right">
                          <div className="text-sm font-black text-white font-mono">{rec.value}s</div>
                      </div>
                  </div>
              ))}
          </div>
      </section>
    </div>
  );
};

export default Personal;
