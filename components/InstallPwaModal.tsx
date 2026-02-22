
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Share, PlusSquare, MoreVertical, X, Smartphone, Download, CheckCircle2 } from 'lucide-react';

export const InstallPwaModal = () => {
    const [show, setShow] = useState(false);
    const [platform, setPlatform] = useState<'ios' | 'android'>('ios');
    const [isChrome, setIsChrome] = useState(false);

    useEffect(() => {
        // 1. Check if running in standalone mode (PWA)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        
        if (!isStandalone) {
            // 2. Detect User Agent
            const ua = navigator.userAgent.toLowerCase();
            const isIOS = /iphone|ipad|ipod/.test(ua);
            const isAndroid = /android/.test(ua);
            const isChromeBrowser = /crios|chrome/.test(ua);

            setIsChrome(isChromeBrowser);

            if (isIOS) {
                setPlatform('ios');
            } else if (isAndroid) {
                setPlatform('android');
            }
            
            // 3. Show modal after a short delay
            // We use sessionStorage to prevent showing it immediately after closing if the user navigates within the same tab,
            // but the request implies showing it "when entering", so let's keep it simple.
            // To prevent extreme annoyance, let's say if they closed it, don't show for this session.
            const hasSeen = sessionStorage.getItem('PWA_PROMPT_SEEN');
            if (!hasSeen) {
                const timer = setTimeout(() => setShow(true), 1500);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    const handleClose = () => {
        setShow(false);
        sessionStorage.setItem('PWA_PROMPT_SEEN', 'true');
    };

    if (!show) return null;

    return createPortal(
        <div className="fixed inset-0 z-[80000] flex items-end justify-center bg-black/80 backdrop-blur-md animate-fade-in pb-[env(safe-area-inset-bottom)]" onClick={handleClose}>
            <div className="glass-card w-full max-w-sm rounded-t-[32px] p-6 bg-zinc-950 border-chiachia-green/20 flex flex-col gap-5 animate-slide-up shadow-[0_0_40px_rgba(57,231,95,0.15)] relative" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-xl font-black text-white italic tracking-tight">安裝 APP</h3>
                        <p className="text-xs text-zinc-400 font-bold">獲得最佳體驗，請將應用程式加入主畫面</p>
                    </div>
                    <button onClick={handleClose} className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 active:scale-95 border border-white/10">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-zinc-900/60 p-1 rounded-xl">
                    <button 
                        onClick={() => setPlatform('ios')} 
                        className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${platform === 'ios' ? 'bg-zinc-800 text-white shadow-inner' : 'text-zinc-600'}`}
                    >
                        <Smartphone size={14} /> iOS
                    </button>
                    <button 
                        onClick={() => setPlatform('android')} 
                        className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${platform === 'android' ? 'bg-zinc-800 text-white shadow-inner' : 'text-zinc-600'}`}
                    >
                        <Smartphone size={14} /> Android
                    </button>
                </div>

                {/* iOS Instructions */}
                {platform === 'ios' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex items-center gap-4 p-3 rounded-2xl bg-zinc-900 border border-white/5">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                                <Share size={20} />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-bold text-white mb-0.5">1. 點擊「分享」按鈕</div>
                                <div className="text-[10px] text-zinc-500 font-medium">
                                    {isChrome ? 'Chrome: 通常位於網址列右側或上方' : 'Safari: 位於螢幕底部中間'}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center text-zinc-600">
                            <div className="h-4 w-0.5 bg-zinc-800"></div>
                        </div>
                        <div className="flex items-center gap-4 p-3 rounded-2xl bg-zinc-900 border border-white/5">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-white shrink-0 border border-white/10">
                                <PlusSquare size={20} />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-bold text-white mb-0.5">2. 選擇「加入主畫面」</div>
                                <div className="text-[10px] text-zinc-500 font-medium">需往下滑動選單尋找</div>
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center text-zinc-600">
                            <div className="h-4 w-0.5 bg-zinc-800"></div>
                        </div>
                        <div className="flex items-center gap-4 p-3 rounded-2xl bg-zinc-900 border border-white/5">
                            <div className="w-10 h-10 rounded-full bg-chiachia-green/10 flex items-center justify-center text-chiachia-green shrink-0">
                                <CheckCircle2 size={20} />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-bold text-white mb-0.5">3. 點擊右上角「加入」</div>
                                <div className="text-[10px] text-zinc-500 font-medium">即可像 APP 一樣使用</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Android Instructions */}
                {platform === 'android' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex items-center gap-4 p-3 rounded-2xl bg-zinc-900 border border-white/5">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-white shrink-0 border border-white/10">
                                <MoreVertical size={20} />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-bold text-white mb-0.5">1. 點擊瀏覽器選單</div>
                                <div className="text-[10px] text-zinc-500 font-medium">通常是右上角的三個點</div>
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center text-zinc-600">
                            <div className="h-4 w-0.5 bg-zinc-800"></div>
                        </div>
                        <div className="flex items-center gap-4 p-3 rounded-2xl bg-zinc-900 border border-white/5">
                            <div className="w-10 h-10 rounded-full bg-chiachia-green/10 flex items-center justify-center text-chiachia-green shrink-0">
                                <Download size={20} />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-bold text-white mb-0.5">2. 安裝應用程式</div>
                                <div className="text-[10px] text-zinc-500 font-medium">或選擇「加入主畫面」</div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-2 text-center">
                    <button onClick={handleClose} className="text-[10px] text-zinc-600 font-bold underline decoration-zinc-800 underline-offset-4 active:text-white transition-colors">
                        稍後再說
                    </button>
                </div>
            </div>
        </div>
    , document.body);
};
