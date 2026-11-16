import React, { useState, useEffect } from 'react';
import { Navigation, Banknote, Lock, Car, Shield, UserCheck, ArrowLeft, Check, Copy, KeyRound, MessageSquare } from 'lucide-react';
import { KerbButton, KerbCard } from '../Common/KerbComponents';

export type OnboardingStep =
  | 'splash'
  | 'language'
  | 'signin'
  | 'otp'
  | 'pin'
  | 'profile'
  | 'permissions'
  | 'tutorial'
  | 'terms';

export interface RiderUserProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'student' | 'staff' | 'visitor';
  category?: 'student' | 'postgrad' | 'academic_staff' | 'non_academic_staff' | 'visitor';
  faculty?: string;
  department?: string;
  matricOrStaffId?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  language: 'en' | 'ha';
  avatarUrl?: string;
  referralCode?: string;
}

interface RiderOnboardingProps {
  onComplete: (user: RiderUserProfile) => void;
  onDriveWithUs: () => void;
  onBackToRoleSelect?: () => void;
  initialStep?: OnboardingStep;
}

export const RiderOnboarding: React.FC<RiderOnboardingProps> = ({
  onComplete,
  onDriveWithUs,
  onBackToRoleSelect,
  initialStep = 'signin',
}) => {
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [language, setLanguage] = useState<'en' | 'ha'>('en');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [sandboxCode, setSandboxCode] = useState<string | null>(null);
  const [securityPin, setSecurityPin] = useState('');
  const [existingUserName, setExistingUserName] = useState('');
  const [isSigningInWithPin, setIsSigningInWithPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(30);

  // Profile fields
  const [name, setName] = useState('');
  const [role, setRole] = useState<'student' | 'staff' | 'visitor'>('student');
  const [matricNumber, setMatricNumber] = useState('');
  const [department, setDepartment] = useState('Computer Engineering');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [referralCode, setReferralCode] = useState<string>(() => {
    try {
      return localStorage.getItem('zylift_referral_code') || '';
    } catch {
      return '';
    }
  });

  // Tutorial slide
  const [tutorialSlide, setTutorialSlide] = useState(0);

  // Terms agreement
  const [agreedTerms, setAgreedTerms] = useState(true);

  // Auto skip splash after 1.5s
  useEffect(() => {
    if (step === 'splash') {
      const timer = setTimeout(() => {
        setStep('language');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Resend OTP countdown
  useEffect(() => {
    if (step === 'otp' && resendSeconds > 0) {
      const interval = setInterval(() => {
        setResendSeconds((s) => s - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, resendSeconds]);

  const handleSendOtp = async () => {
    let cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.startsWith('234')) cleanDigits = cleanDigits.slice(3);
    if (cleanDigits.startsWith('0')) cleanDigits = cleanDigits.slice(1);
    const sub10 = cleanDigits.slice(-10);
    if (sub10.length < 7) {
      setOtpError('Please enter a valid 10-11 digit phone number');
      return;
    }
    setIsSendingOtp(true);
    setOtpError('');
    try {
      const formatted = `+234 ${sub10}`;
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formatted }),
      });
      const data = await res.json();
      if (data.success) {
        setOtp(['', '', '', '', '', '']);
        setResendSeconds(60);
        if (data.sandboxCode) {
          setSandboxCode(String(data.sandboxCode));
        }
        setStep('otp');
      } else {
        setOtpError(data.error || 'Failed to send OTP code');
      }
    } catch (e) {
      setStep('otp');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (overrideCode?: string | React.MouseEvent) => {
    const code = (typeof overrideCode === 'string' ? overrideCode : otp.join('')).trim();
    if (code.length < 4) {
      setOtpError(language === 'en' ? 'Please enter the verification code' : 'Shigar da lambar');
      return;
    }
    setIsVerifyingOtp(true);
    setOtpError('');

    let cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.startsWith('234')) cleanDigits = cleanDigits.slice(3);
    if (cleanDigits.startsWith('0')) cleanDigits = cleanDigits.slice(1);
    const sub10 = cleanDigits.slice(-10);
    const formatted = `+234 ${sub10}`;

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formatted, code, role: 'passenger' }),
      });
      const data = await res.json();

      if (!data.success) {
        setOtpError(data.error || 'Invalid or expired OTP code');
        setIsVerifyingOtp(false);
        return;
      }

      // If user exists and requires PIN
      if (data.requiresPin) {
        setExistingUserName(data.name || 'Campus Passenger');
        setSecurityPin('');
        setPinError(null);
        setStep('pin');
        setIsVerifyingOtp(false);
        return;
      }

      // If user exists and logged in directly
      if (data.exists && data.user) {
        if (data.token) {
          localStorage.setItem('zylift_rider_token', data.token);
        }
        localStorage.setItem('zylift_rider_user', JSON.stringify(data.user));
        onComplete(data.user);
        return;
      }

      // Brand new user: pre-populate name if available, proceed to profile setup
      if (data.token) {
        localStorage.setItem('zylift_rider_token', data.token);
      }
      if (data.user?.name && data.user.name !== 'Campus Passenger') {
        setName(data.user.name);
      }
      setStep('profile');
    } catch (err) {
      setOtpError('Network error verifying code. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSignInWithPin = async () => {
    if (securityPin.length < 4) {
      setPinError(language === 'en' ? 'Please enter your 4-digit Account Security PIN' : 'Shigar da lambar sirri mai lamba 4');
      return;
    }

    setIsSigningInWithPin(true);
    setPinError(null);

    let cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.startsWith('234')) cleanDigits = cleanDigits.slice(3);
    if (cleanDigits.startsWith('0')) cleanDigits = cleanDigits.slice(1);
    const sub10 = cleanDigits.slice(-10);
    const formatted = `+234 ${sub10}`;

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formatted,
          pin: securityPin.trim(),
          role: 'student',
        }),
      });
      const data = await res.json();

      if (data.success && data.user) {
        if (data.token) {
          localStorage.setItem('zylift_rider_token', data.token);
        }
        const profile: RiderUserProfile = {
          id: data.user.id || `usr_${Date.now()}`,
          name: data.user.name || 'FUTMINNA Passenger',
          phone: data.user.phone || formatted,
          role: (data.user.role === 'staff' || data.user.role === 'visitor') ? data.user.role : 'student',
          matricOrStaffId: data.user.matricOrStaffId || '',
          department: data.user.department || 'General Academic',
          emergencyContactPhone: data.user.emergencyContactPhone || '',
          language: language || 'en',
          avatarUrl: data.user.avatarUrl || undefined,
          referralCode: data.user.referralCode || undefined,
        };
        try {
          localStorage.setItem('zylift_rider_user', JSON.stringify(profile));
        } catch (e) {}
        onComplete(profile);
      } else {
        setPinError(data.error || 'Incorrect PIN or account temporarily locked.');
      }
    } catch (err: any) {
      setPinError(err.message || 'Network error signing in. Please try again.');
    } finally {
      setIsSigningInWithPin(false);
    }
  };

  const handleFinishProfile = async () => {
    if (!name.trim()) {
      setProfileError('Please enter your full name');
      return;
    }
    setProfileError(null);

    let cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.startsWith('234')) cleanDigits = cleanDigits.slice(3);
    if (cleanDigits.startsWith('0')) cleanDigits = cleanDigits.slice(1);
    const sub10 = cleanDigits.slice(-10);
    const formatted = `+234 ${sub10}`;

    const profile: RiderUserProfile = {
      id: `usr_${Date.now().toString().slice(-6)}`,
      name: name.trim(),
      phone: formatted,
      role,
      department: role === 'visitor' ? 'Visitor' : department,
      matricOrStaffId: matricNumber,
      emergencyContactPhone: emergencyPhone.trim(),
      language,
    };

    // Save profile to backend immediately
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formatted,
          name: profile.name,
          role: profile.role,
          matricOrStaffId: profile.matricOrStaffId,
          department: profile.department,
          emergencyContactPhone: profile.emergencyContactPhone,
          referralCode: referralCode.trim().toUpperCase() || localStorage.getItem('zylift_referral_code') || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        profile.id = data.user.id;
        profile.avatarUrl = data.user.avatarUrl || undefined;
        profile.referralCode = data.user.referralCode || undefined;
        if (data.token) {
          localStorage.setItem('zylift_rider_token', data.token);
        }
      } else if (!data.success) {
        setProfileError(data.error || 'Failed to create profile');
        return;
      }
    } catch (e) {
      console.warn('Backend profile sync error:', e);
    }

    try {
      localStorage.setItem('zylift_rider_user', JSON.stringify(profile));
    } catch (e) {}

    setStep('permissions');
  };

  const handleFinishPermissions = () => {
    setStep('tutorial');
  };

  const handleFinishTutorial = () => {
    setStep('terms');
  };

  const handleAcceptTerms = async () => {
    let cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.startsWith('234')) cleanDigits = cleanDigits.slice(3);
    if (cleanDigits.startsWith('0')) cleanDigits = cleanDigits.slice(1);
    const sub10 = cleanDigits.slice(-10);
    const formatted = `+234 ${sub10}`;

    const userProfile: RiderUserProfile = {
      id: `usr_${Date.now().toString().slice(-6)}`,
      name: name || 'FUTMINNA Passenger',
      phone: formatted,
      role,
      department: role === 'visitor' ? 'Visitor' : department,
      matricOrStaffId: matricNumber,
      emergencyContactPhone: emergencyPhone,
      language,
    };

    // Save to backend DB
    try {
      const signinRes = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formatted,
          name: userProfile.name,
          role: userProfile.role,
          matricOrStaffId: matricNumber,
          department: role === 'visitor' ? 'Visitor' : department,
          pin: securityPin.trim() || '1234',
          referralCode: referralCode.trim().toUpperCase() || localStorage.getItem('zylift_referral_code') || undefined,
        }),
      });
      const signinData = await signinRes.json();
      if (signinData.success && signinData.user) {
        userProfile.id = signinData.user.id;
        userProfile.avatarUrl = signinData.user.avatarUrl || undefined;
        userProfile.referralCode = signinData.user.referralCode || undefined;
        if (signinData.token) {
          localStorage.setItem('zylift_rider_token', signinData.token);
        }
      }
    } catch (e) {
      console.warn('Backend signin sync fallback', e);
    }

    try {
      localStorage.setItem('zylift_rider_user', JSON.stringify(userProfile));
    } catch (e) {}

    onComplete(userProfile);
  };

  // --- R1: SPLASH SCREEN ---
  if (step === 'splash') {
    return (
      <div className="flex-1 bg-[#0E7C3A] flex flex-col items-center justify-center p-6 text-white text-center select-none animate-fadeIn">
        <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center mb-6 shadow-lg backdrop-blur-sm">
          <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Zylift</h1>
        <p className="text-sm font-medium text-white/90">FUTMINNA Campus Rides · Fixed Price</p>
        <div className="mt-12 flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-white/40 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-white/70 animate-pulse delay-150" />
          <div className="w-2 h-2 rounded-full bg-white animate-pulse delay-300" />
        </div>
      </div>
    );
  }

  // --- R2: LANGUAGE SELECT ---
  if (step === 'language') {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn">
        <div>
          <div className="flex items-center justify-between mb-8">
            <div className="w-10 h-10 rounded-full bg-[#E6F4EC] flex items-center justify-center text-[#0E7C3A] font-bold text-lg">
              K
            </div>
            <button
              onClick={onDriveWithUs}
              className="text-xs font-semibold text-[#0E7C3A] hover:underline"
            >
              Drive with us &rarr;
            </button>
          </div>

          <h2 className="text-2xl font-bold text-[#14201A] mb-2">Choose your language</h2>
          <p className="text-[#7A857F] text-base mb-8">Zaɓi yaren da ka fi so don yin amfani da manhajar</p>

          <div className="flex flex-col gap-4">
            <div
              onClick={() => setLanguage('en')}
              className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                language === 'en'
                  ? 'border-[#0E7C3A] bg-[#E6F4EC]/40 shadow-sm'
                  : 'border-[#DDE3DF] bg-white'
              }`}
            >
              <div>
                <p className="font-bold text-lg text-[#14201A]">English</p>
                <p className="text-sm text-[#7A857F]">Default campus language</p>
              </div>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                  language === 'en' ? 'border-[#0E7C3A] bg-[#0E7C3A]' : 'border-[#DDE3DF]'
                }`}
              >
                {language === 'en' && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>

            <div
              onClick={() => setLanguage('ha')}
              className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                language === 'ha'
                  ? 'border-[#0E7C3A] bg-[#E6F4EC]/40 shadow-sm'
                  : 'border-[#DDE3DF] bg-white'
              }`}
            >
              <div>
                <p className="font-bold text-lg text-[#14201A]">Hausa</p>
                <p className="text-sm text-[#7A857F]">Harshen Hausa na sauƙi</p>
              </div>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                  language === 'ha' ? 'border-[#0E7C3A] bg-[#0E7C3A]' : 'border-[#DDE3DF]'
                }`}
              >
                {language === 'ha' && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6">
          <KerbButton onClick={() => setStep('signin')}>
            {language === 'en' ? 'Continue' : 'Ci gaba'}
          </KerbButton>
        </div>
      </div>
    );
  }

  // --- R3: SIGN IN ---
  if (step === 'signin') {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn">
        <div>
          <button
            type="button"
            onClick={() => {
              if (onBackToRoleSelect) {
                onBackToRoleSelect();
              } else {
                setStep('language');
              }
            }}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] hover:bg-[#E6F4EC] flex items-center justify-center text-[#14201A] mb-6 transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-[#14201A]" />
          </button>

          <h2 className="text-2xl font-bold text-[#14201A] mb-2">
            {language === 'en' ? 'Enter your mobile number' : 'Shigar da lambar wayarka'}
          </h2>
          <p className="text-[#7A857F] text-base mb-8">
            {language === 'en'
              ? 'We will send a 6-digit confirmation code via SMS'
              : 'Za mu tura maka lambar sirri ta saƙon waya'}
          </p>

          <div className="flex items-center gap-3 p-3.5 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] focus-within:border-[#0E7C3A] focus-within:bg-white transition-all">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-[#DDE3DF] font-bold text-[#14201A] text-xs">
              <span className="text-[10px] bg-[#E6F4EC] text-[#0E7C3A] px-1 py-0.5 rounded font-black">NG</span>
              <span>+234</span>
            </div>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="803 000 0000"
              className="flex-1 bg-transparent text-lg font-semibold text-[#14201A] outline-none"
            />
          </div>

          {otpError && (
            <p className="mt-3 text-xs text-[#D93A3A] font-semibold bg-[#FEE2E2] p-2.5 rounded-xl border border-[#D93A3A]/20">
              {otpError}
            </p>
          )}
        </div>

        <div className="pt-6">
          <KerbButton onClick={handleSendOtp} isLoading={isSendingOtp}>
            {language === 'en' ? 'Send Code' : 'Aika Lambar'}
          </KerbButton>
        </div>
      </div>
    );
  }

  // --- R4: OTP VERIFICATION ---
  if (step === 'otp') {
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const effectiveSandboxCode = sandboxCode || (isLocalhost ? '123456' : null);

    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn">
        <div>
          <button
            onClick={() => setStep('signin')}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center text-[#14201A] mb-6"
          >
            &larr;
          </button>

          <h2 className="text-2xl font-bold text-[#14201A] mb-2">
            {language === 'en' ? 'Enter 6-digit code' : 'Shigar da lambar sirri'}
          </h2>
          <p className="text-[#7A857F] text-base mb-3">
            {language === 'en' ? 'Code sent to' : 'An aika lambar zuwa'} <span className="font-semibold text-[#14201A]">+234 {phone}</span>
          </p>

          {/* Amber Sandbox Dev Banner */}
          {effectiveSandboxCode && (
            <div className="my-3 p-3.5 bg-[#FFF8E6] border border-[#E69500]/40 rounded-2xl text-left animate-fadeIn shadow-xs">
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
                      Your code: <strong className="font-mono text-sm tracking-widest text-[#8A5A00] font-black">{effectiveSandboxCode}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const digits = effectiveSandboxCode.slice(0, 6).split('');
                    while (digits.length < 6) digits.push('');
                    setOtp(digits);
                  }}
                  className="px-3.5 py-2 bg-[#E69500] hover:bg-[#cf8300] active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs shrink-0 transition-all cursor-pointer"
                >
                  ⚡ 1-Tap Autofill
                </button>
              </div>
            </div>
          )}

          {/* WhatsApp Support fallback button */}
          <a
            href={`https://wa.me/message/2ZWD6T2KUU5PK1?text=${encodeURIComponent(
              `Hello Zylift Support, I am registering on the campus app with phone +234 ${phone}. Please assist with my verification code.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-3 bg-[#E6F4EC] hover:bg-[#D4EEDE] text-[#0E7C3A] rounded-xl text-xs font-bold transition-all border border-[#0E7C3A]/20 my-3"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{language === 'en' ? "Didn't receive SMS? Get Code on WhatsApp" : "Ba ku sami SMS ba? Nemi lambar a WhatsApp"}</span>
          </a>

          {/* 6 separate boxes with paste and SMS autofill support */}
          <div className="flex justify-between gap-2 my-4">
            {otp.map((digit, idx) => (
              <input
                key={idx}
                type="text"
                inputMode="numeric"
                autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                maxLength={6}
                value={digit}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                  if (pasted) {
                    const nextOtp = pasted.split('');
                    while (nextOtp.length < 6) nextOtp.push('');
                    setOtp(nextOtp);
                    const lastIdx = Math.min(pasted.length - 1, 5);
                    document.getElementById(`otp-box-${lastIdx}`)?.focus();
                  }
                }}
                onChange={(e) => {
                  const rawVal = e.target.value.replace(/\D/g, '');
                  if (rawVal.length > 1) {
                    // Full OTP entered or autofilled
                    const nextOtp = rawVal.slice(0, 6).split('');
                    while (nextOtp.length < 6) nextOtp.push('');
                    setOtp(nextOtp);
                    document.getElementById(`otp-box-${Math.min(rawVal.length - 1, 5)}`)?.focus();
                    return;
                  }
                  const val = rawVal.slice(-1);
                  const nextOtp = [...otp];
                  nextOtp[idx] = val;
                  setOtp(nextOtp);
                  // Focus next box if filled
                  if (val && idx < 5) {
                    const nextInput = document.getElementById(`otp-box-${idx + 1}`);
                    nextInput?.focus();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !digit && idx > 0) {
                    const prevInput = document.getElementById(`otp-box-${idx - 1}`);
                    prevInput?.focus();
                  }
                }}
                id={`otp-box-${idx}`}
                className="w-12 h-14 text-center text-2xl font-bold bg-[#F3F6F4] border border-[#DDE3DF] rounded-xl focus:border-[#0E7C3A] focus:bg-white outline-none"
              />
            ))}
          </div>

          {otpError && <p className="text-sm text-[#D93A3A] font-semibold mt-2">{otpError}</p>}

          <div className="mt-8 text-center">
            {resendSeconds > 0 ? (
              <p className="text-sm text-[#7A857F]">
                {language === 'en' ? 'Resend code in' : 'Sake tura lambar a'} {resendSeconds}s
              </p>
            ) : (
              <button
                onClick={handleSendOtp}
                className="text-sm font-semibold text-[#0E7C3A]"
              >
                {language === 'en' ? 'Resend code now' : 'Sake aika lambar yanzu'}
              </button>
            )}
          </div>
        </div>

        <div className="pt-6">
          <KerbButton onClick={() => handleVerifyOtp()} isLoading={isVerifyingOtp}>
            {language === 'en' ? 'Verify Code' : 'Tabbatar da Lambar'}
          </KerbButton>
        </div>
      </div>
    );
  }

  // --- R4.5: ACCOUNT SECURITY PIN VERIFICATION (FOR RETURNING USERS) ---
  if (step === 'pin') {
    let cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.startsWith('234')) cleanDigits = cleanDigits.slice(3);
    if (cleanDigits.startsWith('0')) cleanDigits = cleanDigits.slice(1);
    const sub10 = cleanDigits.slice(-10);
    const formatted = `+234 ${sub10}`;

    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn text-[#14201A]">
        <div>
          <button
            onClick={() => {
              setStep('otp');
              setPinError(null);
            }}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold mb-6 text-[#14201A]"
          >
            &larr;
          </button>

          <div className="w-14 h-14 rounded-2xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center mb-4 shadow-xs">
            <KeyRound className="w-7 h-7 text-[#0E7C3A]" />
          </div>

          <h2 className="text-2xl font-black text-[#14201A] tracking-tight mb-1">
            {language === 'en' ? 'Enter Security PIN' : 'Shigar da Lambar Tsaro'}
          </h2>
          <p className="text-sm text-[#7A857F] mb-6">
            {language === 'en' ? 'Welcome back,' : 'Barka da dawowa,'}{' '}
            <strong className="text-[#14201A]">{existingUserName || 'Passenger'}</strong>!{' '}
            {language === 'en'
              ? 'Enter your 4-digit Account Security PIN to sign in.'
              : 'Shigar da lambar sirri ta asusunka mai lamba 4 domin shiga.'}
          </p>

          <div className="mb-4">
            <label className="block text-xs font-bold uppercase text-[#7A857F] mb-2">
              {language === 'en' ? '4-Digit PIN' : 'Lambar Tsaro (PIN)'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={securityPin}
              onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full h-14 text-center tracking-[0.5em] font-mono text-3xl font-bold bg-[#F3F6F4] border-2 border-[#DDE3DF] focus:border-[#0E7C3A] rounded-2xl outline-none text-[#14201A]"
              autoFocus
            />
          </div>

          {pinError && (
            <div className="mb-4 p-3 bg-[#FDE8E8] border border-[#D93A3A]/30 rounded-xl flex items-center gap-2 text-xs text-[#D93A3A] font-semibold">
              <span>{pinError}</span>
            </div>
          )}

          <div className="mt-4 p-3.5 bg-[#F8FAF9] rounded-2xl border border-[#DDE3DF] text-xs text-[#4F5B54] flex items-center justify-between">
            <span>{language === 'en' ? 'Forgot your PIN?' : 'Ka manta lambarka?'}</span>
            <a
              href={`https://wa.me/message/2ZWD6T2KUU5PK1?text=${encodeURIComponent(
                `Hello Zylift Support, I am passenger ${existingUserName || ''} (${formatted}) and need assistance resetting my 4-digit PIN.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#0E7C3A] hover:underline flex items-center gap-1"
            >
              <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Support
            </a>
          </div>
        </div>

        <div className="pt-6">
          <KerbButton isLoading={isSigningInWithPin} onClick={handleSignInWithPin}>
            {language === 'en' ? 'Unlock Account & Sign In →' : 'Bude Asusu & Shiga →'}
          </KerbButton>
        </div>
      </div>
    );
  }

  // --- R5: PROFILE SETUP ---
  if (step === 'profile') {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn overflow-y-auto">
        <div>
          <h2 className="text-2xl font-bold text-[#14201A] mb-1">
            {language === 'en' ? 'Set up your profile' : 'Saita bayanan ka'}
          </h2>
          <p className="text-[#7A857F] text-base mb-6">
            {language === 'en' ? 'Ensure your campus identification is accurate' : 'Tabbatar da sahihancin bayananka'}
          </p>

          {/* Photo Placeholder */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-[#E6F4EC] border-2 border-[#0E7C3A] flex items-center justify-center text-3xl font-extrabold text-[#0E7C3A]">
                {name.charAt(0) || 'F'}
              </div>
              <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#0E7C3A] text-white flex items-center justify-center border-2 border-white shadow">
                +
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">
                {language === 'en' ? 'Full Name' : 'Cikakken Suna'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-[#14201A] font-medium outline-none focus:border-[#0E7C3A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">
                {language === 'en' ? 'Campus Category' : 'Rukuni a Haraba'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['student', 'staff', 'visitor'] as const).map((cat) => {
                  const isSelected = role === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setRole(cat)}
                      style={
                        isSelected
                          ? {
                              backgroundColor: '#0E7C3A',
                              color: '#FFFFFF',
                              borderColor: '#0E7C3A',
                              boxShadow: '0 4px 14px rgba(14, 124, 58, 0.35)',
                            }
                          : {
                              backgroundColor: '#F3F6F4',
                              color: '#14201A',
                              borderColor: '#DDE3DF',
                            }
                      }
                      className="min-h-[46px] py-2.5 px-2 rounded-2xl text-sm font-bold capitalize transition-all border-2 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">
                {role === 'student' ? 'Matriculation Number' : role === 'staff' ? 'Staff ID' : 'ID / Visitor Pass'}
              </label>
              <input
                type="text"
                value={matricNumber}
                onChange={(e) => setMatricNumber(e.target.value)}
                placeholder="2019/1/74921EE"
                className="w-full p-3.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-[#14201A] font-medium outline-none focus:border-[#0E7C3A]"
              />
            </div>

            {role !== 'visitor' && (
              <div>
                <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">
                  {language === 'en' ? 'Department / School' : 'Sashe / Sashen Karatu'}
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full p-3.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-[#14201A] font-medium outline-none focus:border-[#0E7C3A] cursor-pointer"
                >
                  <option value="Computer Engineering">Computer Engineering (SEET)</option>
                  <option value="Electrical & Electronics Engineering">Electrical & Electronics Engineering (SEET)</option>
                  <option value="Mechanical Engineering">Mechanical Engineering (SEET)</option>
                  <option value="Civil Engineering">Civil Engineering (SEET)</option>
                  <option value="Chemical Engineering">Chemical Engineering (SEET)</option>
                  <option value="Telecommunication Engineering">Telecommunication Engineering (SEET)</option>
                  <option value="Mechatronics Engineering">Mechatronics Engineering (SEET)</option>
                  <option value="Computer Science">Computer Science (SICT)</option>
                  <option value="Cyber Security Science">Cyber Security Science (SICT)</option>
                  <option value="Information Technology">Information Technology (SICT)</option>
                  <option value="Architecture">Architecture (SET)</option>
                  <option value="Estate Management">Estate Management (SET)</option>
                  <option value="Urban & Regional Planning">Urban & Regional Planning (SET)</option>
                  <option value="Biochemistry">Biochemistry (SLS)</option>
                  <option value="Microbiology">Microbiology (SLS)</option>
                  <option value="Physics">Physics (SPS)</option>
                  <option value="Mathematics">Mathematics (SPS)</option>
                  <option value="Agricultural Economics">Agricultural Economics (SAAT)</option>
                  <option value="Other Department">Other Department</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">
                {language === 'en' ? 'Emergency Contact Phone' : 'Lambar Gaggawa'}
              </label>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder={language === 'en' ? 'e.g. 08012345678 (Parent / Guardian)' : 'misali 08012345678'}
                className="w-full p-3.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-[#14201A] font-medium outline-none focus:border-[#0E7C3A]"
              />
              <p className="text-[11px] text-[#7A857F] mt-1">
                {language === 'en'
                  ? 'Used only if you trigger SOS or campus security needs to reach your guardian.'
                  : 'Za a yi amfani da wannan ne kawai idan ka danna SOS na gaggawa.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">
                {language === 'en' ? 'Referral Code (Optional)' : 'Lambar Gayyata (Ba dole ba)'}
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setReferralCode(val);
                  try {
                    if (val.trim()) localStorage.setItem('zylift_referral_code', val.trim());
                    else localStorage.removeItem('zylift_referral_code');
                  } catch {}
                }}
                placeholder="e.g. ZYLIFT-XXXXXX or DRV-XXXXXX"
                className="w-full p-3.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-[#14201A] font-mono font-bold uppercase outline-none focus:border-[#0E7C3A]"
              />
            </div>
          </div>
        </div>

        {profileError && (
          <div className="mt-4 p-3 bg-[#FDE8E8] border border-[#D93A3A]/30 rounded-xl text-xs text-[#D93A3A] font-semibold text-center">
            {profileError}
          </div>
        )}

        <div className="pt-6">
          <KerbButton onClick={handleFinishProfile}>
            {language === 'en' ? 'Continue' : 'Ci gaba'}
          </KerbButton>
        </div>
      </div>
    );
  }

  // --- R6: PERMISSIONS ---
  if (step === 'permissions') {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn text-center">
        <div className="flex flex-col items-center pt-8">
          <div className="w-28 h-28 rounded-full bg-[#E6F4EC] flex items-center justify-center text-[#0E7C3A] mb-6 shadow-sm">
            <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-[#14201A] mb-3">Allow Location Access</h2>
          <p className="text-[#7A857F] text-base leading-relaxed px-2">
            Zylift needs your GPS location to pinpoint your pickup point across FUTMINNA Gidan Kwanu campus and match nearby Keke & Okada riders.
          </p>
        </div>

        <div className="space-y-3 pt-6">
          <KerbButton onClick={handleFinishPermissions}>
            Allow Location Access
          </KerbButton>
          <button
            onClick={handleFinishPermissions}
            className="w-full py-3 text-sm font-semibold text-[#7A857F] hover:text-[#14201A]"
          >
            Not Now (Manual Search)
          </button>
        </div>
      </div>
    );
  }

  // --- E1: TUTORIAL ---
  if (step === 'tutorial') {
    const slides = [
      {
        title: '1. Pick a place on campus',
        body: 'Tap any building, hostel, or lecture complex at FUTMINNA Gidan Kwanu to see your route.',
        icon: <Navigation className="w-10 h-10 text-[#0E7C3A]" />,
      },
      {
        title: '2. See your fixed price',
        body: 'Never haggle! All campus fares are fixed with ₦0 commission. You pay exact cash to your driver.',
        icon: <Banknote className="w-10 h-10 text-[#0E7C3A]" />,
      },
      {
        title: '3. Give driver your PIN',
        body: 'Every ride generates a private 4-digit PIN. Your driver must enter it before starting the trip.',
        icon: <Lock className="w-10 h-10 text-[#0E7C3A]" />,
      },
    ];

    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn text-center">
        <div className="flex justify-end">
          <button
            onClick={handleFinishTutorial}
            className="text-sm font-bold text-[#0E7C3A]"
          >
            Skip
          </button>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-3xl bg-[#E6F4EC] flex items-center justify-center mb-6 shadow-inner">
            {slides[tutorialSlide].icon}
          </div>
          <h2 className="text-2xl font-bold text-[#14201A] mb-3">
            {slides[tutorialSlide].title}
          </h2>
          <p className="text-[#7A857F] text-base leading-relaxed px-4">
            {slides[tutorialSlide].body}
          </p>

          {/* Dots Indicator */}
          <div className="flex gap-2 mt-8">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  tutorialSlide === i ? 'w-6 bg-[#0E7C3A]' : 'w-2 bg-[#DDE3DF]'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="pt-6">
          <KerbButton
            onClick={() => {
              if (tutorialSlide < slides.length - 1) {
                setTutorialSlide((s) => s + 1);
              } else {
                handleFinishTutorial();
              }
            }}
          >
            {tutorialSlide < slides.length - 1 ? 'Next' : 'Got it'}
          </KerbButton>
        </div>
      </div>
    );
  }

  // --- E2: TERMS & CONDITIONS ---
  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold text-[#14201A] mb-2">Terms & Safety Rules</h2>
        <p className="text-[#7A857F] text-sm mb-4">FUTMINNA Campus Rides Pilot Agreement</p>

        <div className="p-4 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] text-xs text-[#3E4A43] leading-relaxed max-h-72 overflow-y-auto space-y-2.5">
          <p className="font-semibold text-[#14201A]">1. Campus Pilot Rules</p>
          <p>This service operates inside FUTMINNA Gidan Kwanu Campus and connecting routes to Bosso. All rides adhere to campus security guidelines.</p>
          <p className="font-semibold text-[#14201A]">2. Fixed Cash Fares</p>
          <p>Fares are fixed in advance. Drivers cannot request higher cash amounts than shown on the screen.</p>
          <p className="font-semibold text-[#14201A]">3. Safety PIN Requirement</p>
          <p>Never enter a vehicle without providing your 4-digit Safety PIN. If the driver does not have the app, cancel and alert campus security.</p>
          <p className="font-semibold text-[#14201A]">4. Emergency Protocol</p>
          <p>In any emergency, tap the red Safety Shield to call FUTMINNA Security Cadets immediately (+234 803 612 0041).</p>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <input
            type="checkbox"
            id="terms"
            checked={agreedTerms}
            onChange={(e) => setAgreedTerms(e.target.checked)}
            className="w-5 h-5 rounded text-[#0E7C3A] focus:ring-[#0E7C3A]"
          />
          <label htmlFor="terms" className="text-sm font-semibold text-[#14201A]">
            I agree to the campus ride terms and safety rules
          </label>
        </div>
      </div>

      <div className="pt-6">
        <KerbButton disabled={!agreedTerms} onClick={handleAcceptTerms}>
          Accept & Start Riding
        </KerbButton>
      </div>
    </div>
  );
};
