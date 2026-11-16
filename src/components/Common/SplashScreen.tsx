import React, { useEffect, useState } from 'react';
import { Car, ShieldCheck, Sparkles } from 'lucide-react';

interface SplashScreenProps {
  durationMs?: number;
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  durationMs = 2500,
  onFinish,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        onFinish();
      }
    }, 30);

    return () => clearInterval(interval);
  }, [durationMs, onFinish]);

  return (
    <div className="relative w-full h-full flex flex-col justify-between items-center bg-gradient-to-b from-[#073619] via-[#0E7C3A] to-[#052611] text-white p-8 select-none overflow-hidden animate-fadeIn">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />

      {/* Top University Pilot Badge */}
      <div className="pt-6 flex items-center justify-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold tracking-wide text-emerald-100 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
          <span>FUTMINNA CAMPUS TRANSIT</span>
        </div>
      </div>

      {/* Center Branding & Logo */}
      <div className="flex flex-col items-center justify-center my-auto text-center">
        {/* Animated Brand Emblem */}
        <div className="relative mb-6">
          <div className="absolute -inset-4 rounded-3xl bg-emerald-400/20 blur-xl animate-pulse" />
          <div className="relative w-24 h-24 rounded-3xl bg-white flex items-center justify-center shadow-2xl shadow-black/30 border border-white/20">
            <div className="w-20 h-20 rounded-2xl bg-[#0E7C3A] flex items-center justify-center text-white">
              <Car className="w-10 h-10 text-white animate-bounce" style={{ animationDuration: '2s' }} />
            </div>
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-3xl font-black tracking-tight text-white mb-1.5 drop-shadow-sm flex items-center gap-2">
          <span>ZYLIFT</span>
          <span className="text-xs font-black uppercase px-2 py-0.5 bg-white/20 rounded-md tracking-wider text-emerald-100">
            Pilot
          </span>
        </h1>

        <p className="text-xs font-medium text-emerald-100/90 tracking-wide max-w-[240px] leading-relaxed">
          Fast, safe & fixed-price rides across Gidan Kwano & Bosso
        </p>
      </div>

      {/* Bottom Loading Indicator & Campus Tag */}
      <div className="w-full max-w-[280px] pb-6 flex flex-col items-center gap-3">
        {/* Sleek Progress Bar */}
        <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
          <div
            className="h-full bg-white rounded-full transition-all duration-75 ease-out shadow-sm"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between w-full text-[10px] font-semibold text-emerald-200/80 px-1">
          <span>Loading campus map...</span>
          <span>{progress}%</span>
        </div>

        {/* Skip button for returning users */}
        <button
          type="button"
          onClick={onFinish}
          className="text-[11px] font-bold text-white/70 hover:text-white transition-colors pt-2 tracking-wide underline underline-offset-4"
        >
          Skip intro &rarr;
        </button>
      </div>
    </div>
  );
};
