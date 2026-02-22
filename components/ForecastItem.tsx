import React from 'react';
import { format } from 'date-fns';
import { MapPin, ChevronRight } from 'lucide-react';
import { LookupItem } from '../types';

export const ForecastItem: React.FC<{ race: any, raceGroups: LookupItem[], onNavigate: (id: string|number) => void }> = ({ race, raceGroups, onNavigate }) => {
    if (!race) return null;
    const seriesName = raceGroups.find(g => String(g.id) === String(race.series_id))?.name || '公開賽';
    return (
        <button onClick={() => onNavigate(race.id!)} className="h-20 flex items-center px-5 gap-4 relative shrink-0 w-full text-left active:bg-white/5 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/10"></div>
            <div className="flex flex-col items-center justify-center w-12 shrink-0 border-r border-white/5 pr-4">
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">{format(new Date(race.date), 'MMM')}</span>
                <span className="text-2xl font-black text-chiachia-green leading-none">{format(new Date(race.date), 'dd')}</span>
            </div>
            <div className="flex-1 min-w-0 flex justify-between items-center">
                <div className="flex flex-col min-w-0 gap-1">
                    <h3 className="text-base font-bold text-white truncate">{race.name}</h3>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-zinc-500 font-bold uppercase truncate max-w-[120px]">
                            <MapPin size={10} /> {race.location || '比賽會場'}
                        </div>
                        <div className="text-[9px] text-zinc-400 bg-zinc-800 border border-white/5 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider whitespace-nowrap">
                            {seriesName}
                        </div>
                    </div>
                </div>
                <ChevronRight size={20} className="text-zinc-700 group-hover:text-white transition-colors" />
            </div>
        </button>
    );
};
