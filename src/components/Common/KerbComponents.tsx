import React from 'react';

// Web Audio API Synthesizer (Works without external mp3 files!)
export const playKerbSound = (type: 'offer' | 'sos' | 'success' | 'tap') => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'tap') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'offer') {
      // Urgent double high chime
      [0, 0.15].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(idx === 0 ? 587.33 : 880, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.12);
      });
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } else if (type === 'sos') {
      // Pulsing siren alarm
      for (let i = 0; i < 3; i++) {
        const delay = i * 0.3;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(750, ctx.currentTime + delay);
        osc.frequency.linearRampToValueAtTime(950, ctx.currentTime + delay + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.28);
      }
      if (navigator.vibrate) {
        navigator.vibrate([400, 150, 400]);
      }
    } else if (type === 'success') {
      // Pleasant resolving chord
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.06);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.06 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.06);
        osc.stop(ctx.currentTime + idx * 0.06 + 0.25);
      });
    }
  } catch (e) {
    // Audio context may require user interaction gesture
  }
};

// 1. Primary Bottom Action Button (Rule: One main action per screen, 56dp height)
export interface KerbButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export const KerbButton: React.FC<KerbButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  className = '',
  disabled,
  onClick,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    playKerbSound('tap');
    if (onClick) onClick(e);
  };

  const baseStyle =
    variant === 'primary'
      ? 'kerb-btn-primary'
      : variant === 'secondary'
      ? 'kerb-btn-secondary'
      : 'kerb-btn-danger';

  return (
    <button
      className={`${baseStyle} ${className}`}
      disabled={disabled || isLoading}
      onClick={handleClick}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Please wait...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

// 2. Card Container (Radius 16)
export const KerbCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`kerb-card ${className}`} {...props}>
      {children}
    </div>
  );
};

// 3. Bottom Sheet (Radius 24 with 40x4 handle)
export const KerbBottomSheet: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`kerb-sheet ${className}`}>
      <div className="kerb-sheet-handle" />
      {children}
    </div>
  );
};

// 4. Status Chip
export const KerbStatusChip: React.FC<{
  status: 'waiting' | 'active' | 'completed' | 'cancelled' | 'danger';
  label: string;
}> = ({ status, label }) => {
  const chipClass =
    status === 'waiting'
      ? 'kerb-chip-waiting'
      : status === 'active'
      ? 'kerb-chip-active'
      : status === 'completed'
      ? 'kerb-chip-completed'
      : 'kerb-chip-danger';

  return <span className={`kerb-chip ${chipClass}`}>{label}</span>;
};

// 5. Bordered License Plate
export const KerbPlateBadge: React.FC<{ plate: string }> = ({ plate }) => {
  return <span className="license-plate-badge">{plate}</span>;
};

// 6. Large 4-Digit Safety PIN Display
export const KerbPinDisplay: React.FC<{ pin: string }> = ({ pin }) => {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs uppercase font-bold tracking-wider text-emerald-800 mb-1">
        Rider Safety PIN
      </span>
      <div className="safety-pin-display">
        {pin.split('').map((char, i) => (
          <span key={i} className="inline-block w-6 text-center">
            {char}
          </span>
        ))}
      </div>
      <span className="text-xs text-neutral-500 mt-1">Give this to your driver to start</span>
    </div>
  );
};

// 7. Responsive Clean App Frame (edge-to-edge on mobile, clean centered column on desktop)
export const KerbMobileFrame: React.FC<{
  children: React.ReactNode;
  headerTitle?: string;
  onBack?: () => void;
}> = ({ children }) => {
  return (
    <div className="w-full min-h-screen bg-neutral-100 flex justify-center items-stretch">
      <div className="relative bg-white text-neutral-900 flex flex-col w-full min-h-screen sm:max-w-md md:max-w-lg lg:max-w-xl shadow-md overflow-x-hidden">
        <div className="flex-1 flex flex-col relative w-full h-full">{children}</div>
      </div>
    </div>
  );
};
