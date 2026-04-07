
import React, { useState, useMemo } from 'react';
import { api } from '../services/api';
import { uploadImage } from '../services/supabase';
import { DataRecord, LookupItem } from '../types';
import { User, Award, Activity, Camera, UploadCloud, Loader2, ChevronRight, Trophy, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { hasRole, ROLES } from '../utils/auth';

const Personal: React.FC<any> = ({ data, people, trainingTypes, raceGroups, refreshData, activePersonId, onSelectPerson, onNavigateToTraining }) => {
  const [uploading, setUploading] = useState(false);

  const person = useMemo(() => people.find((p: any) => String(p.id) === String(activePersonId)), [people, activePersonId]);
  
  const personalData = useMemo(() => data.filter((d: any) => String(d.people_id) === String(activePersonId)), [data, activePersonId]);

  // [Fix] Corrected handleFileSelect scope and implementation
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
      {/* Profile Header */}
      <section className="relative">
         <div className="aspect-[4/5] rounded-[32px] bg-zinc-900 overflow-hidden relative border border-white/5">
            {person?.b_url ? (
              <img src={person.b_url.split('#')[0]} className="w-full h-full object-cover opacity-60" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-black" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
            
            <div className="absolute bottom-6 left-6 flex items-end gap-4 pr-6">
               <div className="w-24 h-24 rounded-3xl border-2 border-chiachia-green bg-zinc-950 shadow-glow-green overflow-hidden relative shrink-0">
                  {person?.s_url ? (
                    <img src={person.s_url.split('#')[0]} className="w-full h-full object-contain p-1" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-600"><User size={40}/></div>
                  )}
               </div>
               <div className="pb-1 min-w-0 flex-1">
                  <h2 className="text-3xl font-black text-white italic pr-6 truncate"> {/* pr-2 改為 pr-4，移除 tracking-tight */}
                      {person?.full_name || person?.name || '---'}
                   </h2>
                   <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                      {person?.birthday || 'RIDER'}
                   </p>
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

      {/* Rider Selector */}
      <section className="space-y-4">
          <div className="text-[10px] font-black text-zinc-600 tracking-[0.3em] uppercase">Switch Rider</div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
                            {people.filter((p:any) => !p.is_hidden && !hasRole(p, ROLES.DEV)).map((p: any) => (
                  <button 
                    key={p.id} 
                    onClick={() => onSelectPerson(p.id)}
                    className={`shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${String(p.id) === String(activePersonId) ? 'bg-chiachia-green border-chiachia-green text-black shadow-glow-green scale-105' : 'bg-zinc-900 border-white/5 text-white'}`}
                  >
                      <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${String(p.id) === String(activePersonId) ? 'border-black' : 'border-zinc-800'}`}>
                          {p.s_url ? <img src={p.s_url.split('#')[0]} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-zinc-800" />}
                      </div>
                      <span className="text-[10px] font-black">{p.name}</span>
                  </button>
              ))}
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
