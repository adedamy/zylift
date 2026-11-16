import React, { useState, useEffect } from 'react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onInstallSuccess?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallSuccess,
  onToggleFullscreen,
  isFullscreen = false,
}) => {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [isStandalone, setIsStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Detect platform
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    const isAndroidDevice = /android/.test(ua);

    if (isIOSDevice) {
      setPlatform('ios');
    } else if (isAndroidDevice) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // Check if app is already running standalone
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If no beforeinstallprompt, guide user to browser menu
      alert("To install Zylift:\nOpen your browser menu (⋮ or ...) and tap 'Install app' or 'Add to Home screen'.");
      return;
    }

    try {
      setInstalling(true);
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        if (onInstallSuccess) onInstallSuccess();
        onClose();
      }
    } catch (err) {
      console.error('Error during PWA install:', err);
    } finally {
      setInstalling(false);
    }
  };

  const handleToggleFs = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-modal-title"
    >
      {/* Backdrop click dismiss */}
      <button
        onClick={onClose}
        className="absolute inset-0 w-full h-full cursor-default border-0 bg-transparent focus:outline-none"
        aria-label="Close modal backdrop"
      />

      <div className="relative z-10 w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in slide-in-from-bottom duration-250">
        {/* Top Header Pill / Close Bar */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0E7C3A] text-white flex items-center justify-center font-extrabold text-xl shadow-md shadow-emerald-900/20">
                Z
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#0E7C3A] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Mobile PWA Experience
                </span>
                <h2 id="install-modal-title" className="text-lg font-bold text-slate-900 mt-1">
                  Use Like a Mobile App
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <p className="text-xs text-slate-600 mt-3 leading-relaxed">
            Experience <strong>Zylift Campus Rides</strong> without browser address bars, tabs, or desktop borders—with smooth gestures, instant launch, and native GPS tracking on FUTMINNA campus.
          </p>

          {/* Standalone Status Badge */}
          {isStandalone && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>Zylift is currently running in standalone app mode.</span>
            </div>
          )}

          {/* Android / Chromium 1-Tap Install */}
          {(platform === 'android' || (platform === 'desktop' && deferredPrompt)) && (
            <div className="mt-5 space-y-3">
              <button
                onClick={handleInstallClick}
                disabled={installing}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white font-bold text-sm shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                <span>{installing ? 'Preparing Install...' : 'Install App to Home Screen'}</span>
              </button>
              <p className="text-[11px] text-center text-slate-500">
                Installs directly to your home screen or app drawer without taking up phone storage.
              </p>
            </div>
          )}

          {/* iOS Safari Instructions */}
          {platform === 'ios' && (
            <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs text-slate-700">
              <div className="font-semibold text-slate-900 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                <span>Install on iPhone / iPad (Safari)</span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed font-medium">
                <strong>Why can't this be directly downloaded on iPhone?</strong><br />
                Apple iOS strictly prohibits direct app installer downloads (.ipa) from websites outside the Apple App Store. On iOS, <strong>"Add to Home Screen"</strong> is Apple's official, secure, and only method to install a web app on your device.
              </div>
              <ol className="list-decimal list-inside space-y-2 text-[11px] text-slate-600 leading-normal pl-1">
                <li>
                  Tap the <strong className="text-slate-900">Share</strong> button at the bottom of Safari (<span className="text-xs font-mono font-bold">Share</span> icon with upward arrow).
                </li>
                <li>
                  Scroll down the share sheet and tap <strong className="text-slate-900">Add to Home Screen</strong> (<span className="font-bold text-slate-800">+</span>).
                </li>
                <li>
                  Tap <strong className="text-emerald-700">Add</strong> in the top right corner.
                </li>
              </ol>
              <p className="text-[10px] text-emerald-700 font-medium pt-1 border-t border-slate-200">
                Once added, tap the Zylift icon on your home screen for full-screen edge-to-edge mode with zero browser bars and full offline cache.
              </p>
            </div>
          )}

          {/* Desktop Fullscreen & Mobile Mode Toggle */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-2.5">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-center justify-between">
              <div>
                <strong className="block text-emerald-900">Desktop View: Automatic Full Viewport</strong>
                <span className="text-[10px] text-emerald-700">Fills your entire browser window automatically</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">Active</span>
            </div>

            <button
              onClick={handleToggleFs}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 active:scale-98 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              <span>{isFullscreen ? 'Exit Browser Fullscreen (Show Tabs)' : 'Toggle Browser Fullscreen (Hide Tabs/Taskbar)'}</span>
            </button>

            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>Automatic edge-to-edge responsive</span>
              <span className="text-emerald-700 font-semibold">100dvh Safe-Area Aware</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
