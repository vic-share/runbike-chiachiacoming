
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LayoutDashboard, Trophy, Settings as SettingsIcon, ContactRound, CalendarDays, BookOpen, Zap, Bell, X, Check, ExternalLink, CheckCheck } from 'lucide-react';
import { api } from '../services/api';
import { hasPermission, PERMISSIONS } from '../utils/auth';
import { format, formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  title?: string;
  subtitle?: string;
  courseSystemEnabled?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate, title = "Chia Chia Coming!", subtitle, courseSystemEnabled = true }) => {
  const [user, setUser] = useState(api.getUser());
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const stopPollingRef = useRef(false); // Ref to stop polling on persistent error

  // =========================================================
  // 🟢 SRE 最終修正：使用「實體螢幕高度」無視軟體限制
  // =========================================================
  useEffect(() => {
    const fixIOSHeight = () => {
      // @ts-ignore
      const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (isStandalone && isIOS) {
        const screenHeight = window.screen.height;
        document.documentElement.style.height = `${screenHeight}px`;
        document.body.style.height = `${screenHeight}px`;
        const root = document.getElementById('root');
        if (root) {
            root.style.height = `${screenHeight}px`;
        }
        window.scrollTo(0, 0);
      }
    };

    fixIOSHeight();
    const t1 = setTimeout(fixIOSHeight, 100);
    const t2 = setTimeout(fixIOSHeight, 300);
    window.addEventListener('resize', fixIOSHeight);
    window.addEventListener('orientationchange', fixIOSHeight);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', fixIOSHeight);
      window.removeEventListener('orientationchange', fixIOSHeight);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
        const u = api.getUser();
        if (JSON.stringify(u) !== JSON.stringify(user)) setUser(u);
    }, 1000);
    return () => clearInterval(interval);
  }, [user]);

  // Poll for unread count
  useEffect(() => {
      stopPollingRef.current = false; // Reset on user change
      const checkCount = async () => {
          if (user && !stopPollingRef.current) {
              try {
                  const res = await api.fetchUnreadCount(user.id);
                  setUnreadCount(res.count);
              } catch (e: any) {
                  // If endpoint missing (404), stop polling to prevent spam
                  if (e.message.includes('404')) {
                      console.warn('Notification API not found, stopping poll.');
                      stopPollingRef.current = true;
                  } else {
                      console.error('Fetch count error', e);
                  }
              }
          }
      };
      
      checkCount();
      const interval = setInterval(checkCount, 30000); // Poll every 30s
      return () => clearInterval(interval);
  }, [user]);

  const handleOpenNotifications = async () => {
      setShowNotifications(true);
      if (user) {
          setLoadingNotifs(true);
          try {
              const list = await api.fetchNotifications(user.id);
              setNotifications(list);
          } catch(e) {
              console.error(e);
          } finally {
              setLoadingNotifs(false);
          }
      }
  };

  const handleMarkAllRead = async () => {
      if (!user) return;
      try {
          await api.markAllNotificationsRead(user.id);
          setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
          setUnreadCount(0);
      } catch (e) {
          console.error("Mark all read failed", e);
      }
  };

  const handleNotificationClick = async (n: any) => {
      if (!user) return;
      if (!n.is_read) {
          try {
              await api.markNotificationRead(n.id, user.id);
              // Optimistic update
              setNotifications(prev => prev.map(x => x.id === n.id ? {...x, is_read: 1} : x));
              setUnreadCount(prev => Math.max(0, prev - 1));
          } catch(e) {}
      }
      
      if (n.action_link) {
          setShowNotifications(false);
          
          let page = n.action_link;
          
          // Handle /?page=settings&target=coach_requests format
          if (page.includes('?page=')) {
              const urlParams = new URLSearchParams(page.split('?')[1]);
              const pageParam = urlParams.get('page');
              const targetParam = urlParams.get('target');
              
              if (pageParam) {
                  page = targetParam ? `${pageParam}/${targetParam}` : pageParam;
              }
          }
          
          // Remove leading slash if present
          page = page.replace(/^\//, '');
          
          onNavigate(page || 'dashboard');
      }
  };

  // Show Courses if system enabled OR user has permission to see it
  const showCoursesNav = courseSystemEnabled || hasPermission(user, PERMISSIONS.COURSE_VIEW_ALL);

  return (
    <div className="relative w-full h-full flex flex-col bg-black text-white overflow-hidden">
      <style>{`
        @keyframes glitchLine {
          0% { left: -10%; width: 5%; opacity: 0; }
          2% { opacity: 1; }
          5% { left: 10%; width: 10%; opacity: 1; }
          6% { opacity: 0; } /* Glitch Off */
          8% { left: 20%; width: 15%; opacity: 1; } /* Glitch On */
          12% { left: 40%; width: 5%; }
          13% { left: 38%; opacity: 0.5; } /* Jitter Back */
          15% { left: 50%; opacity: 1; width: 20%; }
          20% { left: 90%; opacity: 1; }
          21% { opacity: 0; }
          23% { left: 95%; opacity: 1; width: 5%; }
          30% { left: 110%; opacity: 0; }
          100% { left: 110%; opacity: 0; }
        }
        .animate-glitch-current {
          animation: glitchLine 10s linear infinite;
        }
      `}</style>
      
      {/* Header */}
      {/* Height optimized to h-[56px] for a tighter HUD feel */}
      <header className="flex-none z-40 pt-[calc(env(safe-area-inset-top)+4px)] pb-1 border-b border-white/5 bg-black/90 backdrop-blur-md">
        <div className="max-w-md mx-auto px-4 flex flex-col justify-end h-[56px]">
            
            {/* Title Row */}
            <div className="flex justify-between items-end px-1 pb-1.5">
                {/* Left: Title */}
                <div className="relative z-10 flex flex-col leading-none -space-y-1">
                  <span className="text-[22px] font-russo italic text-chiachia-green tracking-tight transform -skew-x-12 inline-block drop-shadow-[2px_2px_0_rgba(0,0,0,1)] filter brightness-110" style={{ WebkitTextStroke: '0.5px rgba(255,255,255,0.2)' }}>
                    CHIA CHIA
                  </span>
                  <span className="text-[14px] font-russo italic text-white tracking-[0.1em] transform -skew-x-12 inline-block opacity-90">
                      COMING<span className="text-chiachia-green animate-pulse">_</span>
                  </span>
                </div>

                {/* Right: Notification Bell */}
                {user && (
                    <button 
                        onClick={handleOpenNotifications}
                        className="relative p-2 -mr-2 active:scale-95 transition-all group flex items-center justify-center outline-none"
                    >
                        <Bell 
                            size={22} 
                            className={`transition-all duration-300 ${
                                unreadCount > 0 
                                ? 'text-zinc-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' 
                                : 'text-zinc-600 group-hover:text-zinc-400'
                            }`} 
                        />
                        
                        {unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 flex flex-col items-center justify-center pointer-events-none">
                                {/* The "Green Lines" - Glitch effect border/lines */}
                                <div className="relative flex items-center justify-center">
                                    <div className="absolute inset-0 border border-chiachia-green rounded-[4px] animate-ping opacity-50"></div>
                                    <span className="relative z-10 text-[9px] font-black text-chiachia-green bg-black/90 px-1.5 rounded-[4px] border border-chiachia-green shadow-[0_0_10px_rgba(57,231,95,0.6)] leading-none py-0.5 font-mono">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                </div>
                            </div>
                        )}
                    </button>
                )}
            </div>
            
            {/* Bottom: The Circuit Line */}
            <div className="w-full h-[2px] bg-zinc-900 relative overflow-hidden flex items-center">
                {/* Static Background Trace */}
                <div className="w-full h-full bg-zinc-800/30"></div>

                {/* The Glitch Electric Current */}
                {/* Gradient: Transparent -> White (Core) -> Green (Glow) -> Transparent */}
                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-transparent via-white to-chiachia-green animate-glitch-current z-20 shadow-[0_0_8px_#39e75f] opacity-80" style={{ mixBlendMode: 'screen' }}></div>
                
                {/* End Point Dot */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-zinc-700 rounded-full"></div>
            </div>

        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md mx-auto overflow-y-auto no-scrollbar relative pb-24">
        <div className="min-h-full pt-2">
            {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full bg-black border-t border-white/10 shadow-[0_-15px_30px_rgba(0,0,0,0.8)] z-[10000]" style={{ paddingBottom: 'max(0px, calc(env(safe-area-inset-bottom) - 6px))' }}>
        <div className="max-w-md mx-auto w-full">
          <div className={`grid ${showCoursesNav ? 'grid-cols-5' : 'grid-cols-4'} items-center px-2 h-[60px]`}>
            <NavButton active={currentPage === 'dashboard'} onClick={() => onNavigate('dashboard')} icon={<LayoutDashboard />} label="總覽" />
            <NavButton active={currentPage === 'training'} onClick={() => onNavigate('training')} icon={<ContactRound />} label="數據" />
            {showCoursesNav && (
                <NavButton active={currentPage === 'courses'} onClick={() => onNavigate('courses')} icon={<CalendarDays />} label="課程" />
            )}
            <NavButton active={currentPage === 'races'} onClick={() => onNavigate('races')} icon={<Trophy />} label="賽事" />
            <NavButton active={currentPage === 'settings'} onClick={() => onNavigate('settings')} icon={<SettingsIcon />} label={user ? (hasPermission(user, PERMISSIONS.CONSOLE_ACCESS) ? "設定" : "選手") : "登入"} />
          </div>
        </div>
      </nav>

      {/* Notification Modal */}
      {showNotifications && createPortal(
          <div className="fixed inset-0 z-[60000] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowNotifications(false)}>
              <div className="w-full h-full max-w-sm bg-zinc-950 flex flex-col animate-slide-up shadow-2xl relative" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-4 border-b border-white/10 bg-zinc-900/50 pt-[calc(env(safe-area-inset-top)+16px)]">
                      <h3 className="text-xl font-black text-white italic tracking-tight">通知中心</h3>
                      <div className="flex items-center gap-2">
                          {unreadCount > 0 && (
                              <button onClick={handleMarkAllRead} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-chiachia-green active:scale-95 border border-white/5 hover:bg-zinc-700 transition-colors">
                                  <CheckCheck size={16} />
                              </button>
                          )}
                          <button onClick={() => setShowNotifications(false)} className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400 active:scale-95"><X size={18}/></button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-2 pb-24">
                      {loadingNotifs ? (
                          <div className="py-10 text-center text-zinc-500 text-xs font-black uppercase tracking-widest animate-pulse">Loading...</div>
                      ) : notifications.length > 0 ? (
                          notifications.map(n => (
                              <button 
                                  key={n.id} 
                                  onClick={() => handleNotificationClick(n)}
                                  className={`w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.98] ${n.is_read ? 'bg-zinc-900/20 border-white/5 opacity-60' : 'bg-zinc-900 border-chiachia-green/20 shadow-[0_0_15px_rgba(57,231,95,0.05)]'}`}
                              >
                                  <div className="flex justify-between items-start mb-1">
                                      <span className={`text-sm font-bold ${n.is_read ? 'text-zinc-400' : 'text-white'}`}>{n.title}</span>
                                      {!n.is_read && <div className="w-2 h-2 rounded-full bg-chiachia-green shadow-[0_0_5px_#39e75f]"></div>}
                                  </div>
                                  <div className="flex justify-between items-end">
                                      <span className="text-[10px] text-zinc-500 font-mono">
                                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: zhTW })}
                                      </span>
                                      {n.action_link && <ExternalLink size={12} className="text-zinc-600" />}
                                  </div>
                              </button>
                          ))
                      ) : (
                          <div className="py-20 text-center flex flex-col items-center gap-3 opacity-30">
                              <Bell size={40} />
                              <span className="text-xs font-black uppercase tracking-widest">No Notifications</span>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      , document.body)}
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactElement, label: string }) => (
  <button onClick={onClick} className="w-full h-full flex flex-col items-center justify-center gap-0.5 active:bg-white/5 transition-all rounded-xl cursor-pointer">
    <div className={`transition-all duration-200 ${active ? 'text-chiachia-green drop-shadow-[0_0_8px_rgba(57,231,95,0.5)] scale-110' : 'text-zinc-500'}`}>
       {React.cloneElement(icon as React.ReactElement<any>, { 
           size: 24, 
           strokeWidth: active ? 2.5 : 2,
       })}
    </div>
    <span className={`text-[9px] font-black tracking-tighter ${active ? 'text-chiachia-green' : 'text-zinc-600'}`}>
        {label}
    </span>
  </button>
);

export default Layout;
