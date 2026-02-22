
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Races from './pages/Races';
import Training from './pages/Training';
import Settings from './pages/Settings';
import Personal from './pages/Personal';
import Courses from './pages/Courses';
import { InstallPwaModal } from './components/InstallPwaModal';
import { api } from './services/api';
import { DataRecord, LookupItem, TeamInfo, RaceEvent } from './types';
import { LockKeyhole, Loader2 } from 'lucide-react';

const DEFAULT_NAME = '睿睿';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [data, setData] = useState<DataRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const hasInitialized = useRef(false);
  
  // Redirect Logic State
  const [returnPage, setReturnPage] = useState<string | null>(null);
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  
  const [trainingTypes, setTrainingTypes] = useState<LookupItem[]>([]);
  const [raceGroups, setRaceGroups] = useState<LookupItem[]>([]);
  const [people, setPeople] = useState<LookupItem[]>([]);
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [raceEvents, setRaceEvents] = useState<RaceEvent[]>([]);
  const [legends, setLegends] = useState<LegendRecord[]>([]);
  const [forecast, setForecast] = useState<DataRecord[]>([]);
  
  const [defaultTrainingType, setDefaultTrainingType] = useState<string>('');
  const [selectedPersonId, setSelectedPersonId] = useState<string | number>('');
  const [pinnedPeopleIds, setPinnedPeopleIds] = useState<string[]>([]);
  
  // Course System Status
  const [courseSystemEnabled, setCourseSystemEnabled] = useState(true);

  // Deep Linking States
  const [jumpDate, setJumpDate] = useState<string | null>(null); // For Training
  const [targetRaceId, setTargetRaceId] = useState<string | number | null>(null); // For Races
  const [settingsTarget, setSettingsTarget] = useState<string | null>(null); // For Settings (New)

  // 1. Silent Push Sync on App Load
  useEffect(() => {
      const syncPush = async () => {
          if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
          if (Notification.permission !== 'granted') return;

          const userStr = localStorage.getItem('CHIACHIA_USER');
          let userId = null;
          if (userStr) {
              try {
                  const u = JSON.parse(userStr);
                  if (u && u.id) userId = String(u.id);
              } catch (e) {}
          }

          if (!userId) return;

          try {
              const reg = await navigator.serviceWorker.ready;
              const sub = await reg.pushManager.getSubscription();
              
              if (sub) {
                  const payload = {
                      ...JSON.parse(JSON.stringify(sub)),
                      people_id: userId
                  };
                  const meta = import.meta as any;
                  const WORKER_URL = (meta.env && meta.env.VITE_WORKER_URL) || (typeof window !== 'undefined' && (window as any).ENV && (window as any).ENV.VITE_WORKER_URL) || '/api';
                  await fetch(`${WORKER_URL}/subscribe`, {
                      method: 'POST',
                      body: JSON.stringify(payload),
                      headers: { 'Content-Type': 'application/json' }
                  });
                  console.log('[Push] Silent sync successful');
              }
          } catch (e) {
              console.warn('[Push] Silent sync failed', e);
          }
      };
      setTimeout(syncPush, 5000);
  }, []);

  // [NEW] Handle URL Query Params for Deep Linking
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const page = params.get('page');
      const target = params.get('target');

      if (page) {
          handleNavigation(page);
          if (page === 'settings' && target) {
              setSettingsTarget(target);
          }
          // Clean URL
          window.history.replaceState({}, '', '/');
      }
  }, []);

  useEffect(() => {
    if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(e => console.error('Clear badge failed:', e));
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!hasInitialized.current) setIsLoading(true);
    console.log('[App] Fetching data...');
    
    const apiPromise = api.fetchAppData();
    const systemStatusPromise = api.fetchCourseSystemStatus().catch(() => ({ enabled: true }));

    const [{ records, trainingTypes: tTypes, races: rGroups, people: pList, teamInfo: tInfo, raceEvents: rEvents, legends: lData, forecast: fData }, sysStatus] = await Promise.all([apiPromise, systemStatusPromise]);
    
    setCourseSystemEnabled(sysStatus.enabled);

    if (pList && pList.length > 0) {
        setPeople(pList);
    } 

    setData(records);
    setTrainingTypes(tTypes);
    setRaceGroups(rGroups);
    setTeamInfo(tInfo);
    setRaceEvents(rEvents || []);
    setLegends(lData || []);
    setForecast(fData || []);
    
    const serverDefault = tTypes.find(t => t.is_default)?.name;
    if (serverDefault) {
      setDefaultTrainingType(serverDefault);
    } else if (tTypes.length > 0) {
      const savedDefault = localStorage.getItem('louie_default_type');
      if (savedDefault && tTypes.some(t => t.name === savedDefault)) {
        setDefaultTrainingType(savedDefault);
      } else {
        setDefaultTrainingType(tTypes[0].name);
      }
    }

    hasInitialized.current = true;
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!hasInitialized.current || 
        currentPage === 'dashboard' || 
        currentPage === 'races' || 
        currentPage === 'personal' || 
        currentPage === 'settings'
    ) {
      fetchData();
    }
  }, [currentPage, fetchData]);

  const handleUpdateActivePerson = (id: string | number) => {
    setSelectedPersonId(id);
  };

  const handleTogglePinnedPerson = (id: string) => {
    setPinnedPeopleIds(prev => {
      const next = prev.includes(id) 
        ? prev.filter(pId => pId !== id) 
        : [...prev, id];
      return next;
    });
  };

  const handleNavigateToPerson = (personName: string) => {
    const person = people.find(p => p.name === personName);
    if (person) {
        handleUpdateActivePerson(person.id);
        setCurrentPage('personal');
    }
  };

  const handleDeepLinkToTraining = (riderId: string | number, date?: string) => {
      if (riderId) handleUpdateActivePerson(riderId);
      if (date) setJumpDate(date);
      setCurrentPage('training');
  };

  const handleDeepLinkToRace = (raceId: string | number) => {
      setTargetRaceId(raceId);
      handleNavigation('races');
  };

  // New handler to clear jump state
  const handleClearJumpDate = () => {
      setJumpDate(null);
  };

  const activePeople = useMemo(() => people.filter(p => !p.is_hidden), [people]);
  const activeData = useMemo(() => {
    const hiddenIds = people.filter(p => p.is_hidden).map(p => String(p.id));
    return data.filter(d => !hiddenIds.includes(String(d.people_id)));
  }, [data, people]);

  const activePersonName = activePeople.find(p => String(p.id) === String(selectedPersonId))?.name || DEFAULT_NAME;

  const handleNavigation = (page: string) => {
    if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(() => {});
    }

    // Require Login for Races AND Courses
    if (page === 'races' || page === 'courses') {
        const user = api.getUser();
        if (!user || !user.id) {
            setShowRedirectModal(true);
            setTimeout(() => {
                setReturnPage(page);
                setCurrentPage('settings');
                setShowRedirectModal(false);
            }, 1500);
            return;
        }
    }

    if (page === 'personal') {
      let foundAuthId: string | null = null;
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('louie_p_auth_')) {
              const expiry = Number(localStorage.getItem(key));
              if (Date.now() < expiry) {
                  foundAuthId = key.replace('louie_p_auth_', '');
                  break; 
              }
          }
      }

      if (foundAuthId) {
          setSelectedPersonId(foundAuthId);
      } else if (activePeople.length > 0 && !selectedPersonId) {
          const randomIndex = Math.floor(Math.random() * activePeople.length);
          setSelectedPersonId(activePeople[activePeople.length - 1].id);
      }
    }
    setCurrentPage(page);
  };

  const handleLoginSuccess = () => {
      if (returnPage) {
          setCurrentPage(returnPage);
          setReturnPage(null);
      }
  };

  const renderPage = () => {
    if (isLoading && !hasInitialized.current) {
       return (
        <div className="fixed inset-0 z-[20000] flex flex-col items-center justify-center space-y-8 bg-black">
          <div className="relative w-80 h-80 flex items-center justify-center">
             <div className="absolute inset-0 rounded-full border-[4px] border-transparent border-t-chiachia-green border-r-chiachia-green/30 animate-[spin_0.6s_linear_infinite] shadow-[0_0_20px_rgba(57,231,95,0.2)]"></div>
             <div className="absolute inset-3 rounded-full bg-black flex items-center justify-center overflow-hidden z-10 border border-white/5">
                <img 
                  src="https://pyltlobngdnoqjnrxefn.supabase.co/storage/v1/object/public/runbike/title/cccm_word.png" 
                  alt="Loading" 
                  className="w-full h-full object-contain p-10" 
                />
             </div>
          </div>
          <div className="flex flex-col items-center gap-2">
             <div className="text-[10px] text-zinc-600 font-mono tracking-[0.5em] uppercase">SYSTEM LOADING</div>
          </div>
        </div>
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard 
            data={activeData} 
            trainingTypes={trainingTypes}
            raceGroups={raceGroups} // Pass raceGroups for forecast
            refreshData={fetchData}
            onNavigateToRaces={handleDeepLinkToRace} 
            onNavigateToPerson={handleNavigateToPerson}
            onNavigateToTraining={handleDeepLinkToTraining}
            defaultTrainingType={defaultTrainingType}
            people={people} 
            legends={legends}
            forecast={forecast}
          />
        );
      case 'courses':
        return <Courses courseSystemEnabled={courseSystemEnabled} people={people} />;
      case 'personal':
        return (
          <Personal 
            data={activeData}
            people={people} 
            trainingTypes={trainingTypes}
            raceGroups={raceGroups}
            refreshData={fetchData}
            activePersonId={selectedPersonId}
            onSelectPerson={handleUpdateActivePerson}
            onNavigateToTraining={() => setCurrentPage('training')} 
          />
        );
      case 'races':
        return (
          <Races 
            data={data}
            raceEvents={raceEvents} 
            people={people} 
            refreshData={fetchData} 
            raceGroups={raceGroups} 
            initialExpandedEventId={targetRaceId} // Pass target ID
          />
        );
      case 'training':
        return (
          <Training 
            trainingTypes={trainingTypes} 
            defaultType={defaultTrainingType}
            refreshData={fetchData} 
            data={activeData}
            people={activePeople}
            activePersonId={selectedPersonId}
            onSelectPerson={handleUpdateActivePerson}
            pinnedPeopleIds={pinnedPeopleIds}
            onTogglePinned={handleTogglePinnedPerson}
            raceEvents={raceEvents} 
            initialExpandedDate={jumpDate} // Pass date prop
            onClearJumpDate={handleClearJumpDate} // Pass clearing handler
          />
        );
      case 'settings':
        return (
          <Settings 
            data={data}
            trainingTypes={trainingTypes} 
            raceGroups={raceGroups}
            defaultType={defaultTrainingType}
            personName={activePersonName}
            people={people} 
            refreshData={fetchData}
            onUpdateDefault={(val: string) => {
              setDefaultTrainingType(val);
              localStorage.setItem('louie_default_type', val);
            }}
            onLoginSuccess={handleLoginSuccess}
            onUpdateName={() => {}} 
            initialView={settingsTarget} // [NEW] Pass the deep link target
          />
        );
      default:
        return <Dashboard data={activeData} trainingTypes={trainingTypes} raceGroups={raceGroups} people={people} refreshData={fetchData} onNavigateToRaces={() => handleNavigation('races')} defaultTrainingType={defaultTrainingType} onNavigateToPerson={handleNavigateToPerson} onNavigateToTraining={() => setCurrentPage('training')} legends={legends} forecast={forecast} />;
    }
  };

  return (
    <Layout 
      currentPage={currentPage} 
      onNavigate={handleNavigation}
      title="嘉嘉來了"
      subtitle="Chia Chia Coming!"
      courseSystemEnabled={courseSystemEnabled}
    >
      {renderPage()}
      
      {/* PWA Install Prompt */}
      <InstallPwaModal />
      
      {/* 轉場提示 Modal */}
      {showRedirectModal && (
          <div className="fixed inset-0 z-[50000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-fade-in">
              <div className="glass-card w-full max-w-xs rounded-3xl p-8 border-white/10 text-center animate-scale-in flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-chiachia-green shadow-glow-green mb-2">
                      <LockKeyhole size={32} />
                  </div>
                  <div>
                      <h3 className="text-xl font-black text-white italic mb-1">Access Restricted</h3>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">需要登入權限</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-2">
                      <Loader2 size={14} className="animate-spin" />
                      Redirecting to Login...
                  </div>
              </div>
          </div>
      )}
    </Layout>
  );
};

export default App;
