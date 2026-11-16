import React, { useState, useEffect } from 'react';
import {
  Car,
  ShieldCheck,
  Lock,
  ArrowRight,
  AlertCircle,
  RotateCcw,
  UserPlus,
  MessageSquare,
} from 'lucide-react';
import { KerbButton } from '../Common/KerbComponents';

interface DriverSignInFlowProps {
  onBackToRoleSelect: () => void;
  onDriverSignedIn: (driver: any) => void;
  onGoToDriverRegistration: (phone?: string) => void;
}

export const DriverSignInFlow: React.FC<DriverSignInFlowProps> = ({
  onBackToRoleSelect,
  onDriverSignedIn,
  onGoToDriverRegistration,
}) => {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [sandboxCode, setSandboxCode] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(30);
  const [lookupResult, setLookupResult] = useState<{ exists: boolean; driver?: any } | null>(null);
  const [foundDriver, setFoundDriver] = useState<{ id: string; name: string } | null>(null);

  // Resend OTP Countdown
  useEffect(() => {
    let timer: any;
    if (step === 'otp' && resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCountdown]);

  const getCleanPhone = () => {
    const raw = phone.replace(/\D/g, '');
    const stripped = raw.startsWith('234') ? raw.slice(3) : raw.startsWith('0') ? raw.slice(1) : raw;
    return `+234 ${stripped}`;
  };

  const handleSendOtp = async () => {
    const formatted = getCleanPhone();
    if (formatted.replace(/\D/g, '').length < 10) {
      setErrorMsg('Please enter a valid 10-11 digit phone number');
      return;
    }

    setIsSendingOtp(true);
    setErrorMsg(null);

    try {
      // 1. Send OTP via backend
      const otpRes = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formatted, role: 'driver' }),
      });
      const otpData = await otpRes.json();
      if (otpData.sandboxCode) {
        setSandboxCode(String(otpData.sandboxCode));
      }
      setOtpCode('');

      // 2. Lookup driver record
      try {
        const lookupRes = await fetch('/api/auth/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formatted, role: 'driver' }),
        });
        const lookupData = await lookupRes.json();
        if (lookupData.success) {
          setLookupResult({ exists: lookupData.exists, driver: lookupData.driver });
          if (lookupData.driver) {
            setFoundDriver({ id: lookupData.driver.id, name: lookupData.driver.name });
          }
        }
      } catch {}

      setResendCountdown(30);
      setStep('otp');
    } catch {
      setResendCountdown(30);
      setStep('otp');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (overrideCode?: string | React.MouseEvent) => {
    const cleanCode = (typeof overrideCode === 'string' ? overrideCode : otpCode).trim();
    if (cleanCode.length < 4) {
      setErrorMsg('Please enter the 4-6 digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    setErrorMsg(null);
    const formatted = getCleanPhone();

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formatted, code: cleanCode, role: 'driver' }),
      });
      const data = await res.json();

      if (!data.success) {
        setErrorMsg(data.error || 'Invalid or expired OTP code.');
        setIsVerifyingOtp(false);
        return;
      }

      if (data.token && data.driver) {
        localStorage.setItem('zylift_driver_token', data.token);
        localStorage.setItem('zylift_driver_user', JSON.stringify(data.driver));
        localStorage.setItem('zylift_last_role', 'driver');
        onDriverSignedIn(data.driver);
        return;
      }

      // If driver account exists without a token, sign in directly without PIN
      if (data.exists) {
        const signInRes = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'driver',
            phone: formatted,
            driverId: data.driverId || data.driver?.id || foundDriver?.id,
          }),
        });
        const signInData = await signInRes.json();
        if (signInData.success && signInData.driver) {
          if (signInData.token) {
            localStorage.setItem('zylift_driver_token', signInData.token);
          }
          localStorage.setItem('zylift_driver_user', JSON.stringify(signInData.driver));
          localStorage.setItem('zylift_last_role', 'driver');
          onDriverSignedIn(signInData.driver);
          return;
        }
        setErrorMsg(signInData.error || 'Unable to unlock driver terminal.');
        return;
      }

      // If driver is not registered
      setLookupResult({ exists: false });
    } catch (e: any) {
      setErrorMsg('Verification failed. Please check your internet connection.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // --- STEP 1: PHONE INPUT ---
  if (step === 'phone') {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn text-[#14201A]">
        <div>
          <button
            onClick={onBackToRoleSelect}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold mb-6 text-[#14201A] hover:bg-[#E6F4EC] transition-colors"
          >
            &larr;
          </button>

          <div className="w-14 h-14 rounded-2xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center mb-4 shadow-xs">
            <Car className="w-7 h-7 text-[#0E7C3A]" />
          </div>

          <h2 className="text-2xl font-black text-[#14201A] tracking-tight mb-2">
            Driver Terminal Sign In
          </h2>
          <p className="text-sm text-[#7A857F] mb-6 leading-relaxed">
            Enter your registered driver phone number. We will verify your identity with a one-time verification code (OTP).
          </p>

          <label className="block text-xs font-bold uppercase text-[#7A857F] mb-2">
            Driver Phone Number
          </label>
          <div className="flex items-center gap-3 p-3.5 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] focus-within:border-[#0E7C3A] transition-all">
            <span className="font-bold text-xs bg-[#E6F4EC] text-[#0E7C3A] px-2.5 py-1.5 rounded-lg">
              NG +234
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="803 000 0000"
              className="flex-1 bg-transparent font-bold text-base outline-none text-[#14201A]"
              autoFocus
            />
          </div>

          {errorMsg && (
            <div className="mt-4 p-3 bg-[#FDE8E8] border border-[#D93A3A]/30 rounded-xl flex items-center gap-2 text-xs text-[#D93A3A] font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="mt-5 p-3.5 bg-[#F8FAF9] rounded-2xl border border-[#DDE3DF] flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#0E7C3A] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#4F5B54] leading-relaxed">
              Your driver terminal is secured with instant one-time phone verification (OTP) and verified campus driver approval.
            </p>
          </div>
        </div>

        <div className="pt-6 space-y-3">
          <KerbButton isLoading={isSendingOtp} onClick={handleSendOtp}>
            Continue & Send OTP &rarr;
          </KerbButton>

          <button
            type="button"
            onClick={() => onGoToDriverRegistration(phone)}
            className="w-full py-2.5 text-xs font-bold text-[#0E7C3A] hover:underline text-center"
          >
            Not registered yet? Register as Driver &rarr;
          </button>
        </div>
      </div>
    );
  }

  // --- STEP 2: OTP VERIFICATION ---
  if (step === 'otp') {
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const effectiveSandboxCode = sandboxCode || (isLocalhost ? '123456' : null);

    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn text-[#14201A]">
        <div>
          <button
            onClick={() => {
              setStep('phone');
              setErrorMsg(null);
              setLookupResult(null);
            }}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold mb-6 text-[#14201A]"
          >
            &larr;
          </button>

          <div className="w-14 h-14 rounded-2xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-[#0E7C3A]" />
          </div>

          <h2 className="text-2xl font-black text-[#14201A] tracking-tight mb-2">
            Verify Driver OTP
          </h2>
          <p className="text-sm text-[#7A857F] mb-4">
            Enter the verification code sent via SMS to <strong className="text-[#14201A]">{getCleanPhone()}</strong>
          </p>

          {/* Amber Sandbox Dev Banner */}
          {effectiveSandboxCode && (
            <div className="mb-4 p-3.5 bg-[#FFF8E6] border border-[#E69500]/40 rounded-2xl text-left animate-fadeIn shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#E69500]/20 text-[#E69500] flex items-center justify-center shrink-0 font-black text-sm">
                    ⚡
                  </div>
                  <div>
                    <h4 className="font-bold text-[11px] text-[#8A5A00] uppercase tracking-wide">
                      Local Dev Sandbox Mode
                    </h4>
                    <p className="text-xs text-[#8A5A00]/90 mt-0.5">
                      Driver code: <strong className="font-mono text-sm tracking-widest text-[#8A5A00] font-black">{effectiveSandboxCode}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOtpCode(effectiveSandboxCode);
                  }}
                  className="px-3.5 py-2 bg-[#E69500] hover:bg-[#cf8300] active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs shrink-0 transition-all cursor-pointer"
                >
                  ⚡ 1-Tap Autofill
                </button>
              </div>
            </div>
          )}

          {/* Not Registered Notice */}
          {lookupResult && !lookupResult.exists && (
            <div className="mb-4 p-4 bg-[#FFF8E6] border border-[#E69500]/40 rounded-2xl text-left animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-[#E69500] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-[#8A5A00]">
                    No Driver Profile Found
                  </h4>
                  <p className="text-[11px] text-[#8A5A00]/90 mt-1 leading-snug">
                    This phone number is verified, but no active driver account is registered with it yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => onGoToDriverRegistration(phone)}
                    className="mt-3 px-3.5 py-2 bg-[#0E7C3A] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs"
                  >
                    <UserPlus className="w-4 h-4" /> Start Driver Registration Now &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* OTP Input */}
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase text-[#7A857F] mb-2">
              Verification Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full h-14 text-center tracking-[0.4em] font-mono text-2xl font-bold bg-[#F3F6F4] border-2 border-[#DDE3DF] focus:border-[#0E7C3A] rounded-2xl outline-none text-[#14201A]"
              autoFocus
            />
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-[#FDE8E8] border border-[#D93A3A]/30 rounded-xl flex items-center gap-2 text-xs text-[#D93A3A] font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* WhatsApp Support fallback button */}
          <a
            href={`https://wa.me/message/2ZWD6T2KUU5PK1?text=${encodeURIComponent(
              `Hello Zylift Support, I am logging in to the Driver Terminal with phone ${getCleanPhone()}. Please assist with my OTP verification.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-3 bg-[#E6F4EC] hover:bg-[#D4EEDE] text-[#0E7C3A] rounded-xl text-xs font-bold transition-all border border-[#0E7C3A]/20 mb-4"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Didn't receive SMS? Get Code on WhatsApp</span>
          </a>

          <div className="flex items-center justify-between p-3 bg-[#F3F6F4] rounded-xl text-xs mb-4">
            <span className="text-[#7A857F]">Didn't get code?</span>
            {resendCountdown > 0 ? (
              <span className="font-semibold text-[#7A857F]">Resend in {resendCountdown}s</span>
            ) : (
              <button
                type="button"
                onClick={handleSendOtp}
                className="font-bold text-[#0E7C3A] hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Resend Code
              </button>
            )}
          </div>
        </div>

        <div className="pt-6">
          <KerbButton isLoading={isVerifyingOtp} onClick={() => handleVerifyOtp()}>
            Verify Code & Sign In &rarr;
          </KerbButton>
        </div>
      </div>
    );
  }

  return null;
};
