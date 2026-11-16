import React, { useState, useRef, useEffect } from 'react';
import {
  Car,
  Bike,
  Bus,
  Shield,
  Clock,
  Phone,
  CheckCircle,
  FileText,
  Check,
  AlertCircle,
  Banknote,
  Zap,
  Upload,
  Camera,
  Image as ImageIcon,
  RotateCcw,
  CheckCircle2,
  FileCheck,
  ChevronRight,
  Lock,
  Smartphone,
  Copy,
} from 'lucide-react';
import { KerbButton, KerbCard } from '../Common/KerbComponents';
import { compressImageFile } from '../../utils/imageCompress';

export type SignUpStep =
  | 'intro' // V1
  | 'phone' // V2
  | 'phone_otp' // New OTP verification step
  | 'personal' // V3
  | 'vehicle' // V4
  | 'documents' // V5 (real document uploads)
  | 'rules' // V6
  | 'review'; // V7

interface DriverSignUpFlowProps {
  onBackToRider: () => void;
  onApplicationCompleted: (app: any) => void;
}

interface UploadedDoc {
  url: string;
  name: string;
  size?: string;
  type?: string;
  uploadedAt: string;
}

export const DriverSignUpFlow: React.FC<DriverSignUpFlowProps> = ({
  onBackToRider,
  onApplicationCompleted,
}) => {
  const [step, setStep] = useState<SignUpStep>('intro');

  // Form Fields
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [debugOtpHint, setDebugOtpHint] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(30);
  const [otpSent, setOtpSent] = useState(false);

  const [name, setName] = useState('');
  const [dob, setDob] = useState('1994-06-12');
  const [homeArea, setHomeArea] = useState('');
  const [secondPhone, setSecondPhone] = useState('');
  const [hasSmartphone, setHasSmartphone] = useState(true);
  const [ninNumber, setNinNumber] = useState('');
  const [parkLeaderName, setParkLeaderName] = useState('');
  const [parkLeaderPhone, setParkLeaderPhone] = useState('');
  const [referralCode, setReferralCode] = useState<string>(() => {
    try {
      return localStorage.getItem('zylift_referral_code') || '';
    } catch {
      return '';
    }
  });

  // Vehicle - 5 campus vehicle categories
  const [category, setCategory] = useState<'keke' | 'okada' | 'cab_go' | 'small_bus' | 'big_bus'>('keke');
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('Yellow');

  // Documents state - real file attachments (supports files up to 20MB)
  // Initially null: driver must upload their real documents
  const [facePhoto, setFacePhoto] = useState<UploadedDoc | null>(null);
  const [idCardDoc, setIdCardDoc] = useState<UploadedDoc | null>(null);
  const [parkCardDoc, setParkCardDoc] = useState<UploadedDoc | null>(null);
  const [vehiclePhotoDoc, setVehiclePhotoDoc] = useState<UploadedDoc | null>(null);
  const [vehiclePapersDoc, setVehiclePapersDoc] = useState<UploadedDoc | null>(null);

  // Hidden File Inputs
  const faceInputRef = useRef<HTMLInputElement>(null);
  const idCardInputRef = useRef<HTMLInputElement>(null);
  const parkCardInputRef = useRef<HTMLInputElement>(null);
  const vehiclePhotoInputRef = useRef<HTMLInputElement>(null);
  const vehiclePapersInputRef = useRef<HTMLInputElement>(null);

  // Rules agreement
  const [agreedRules, setAgreedRules] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedApp, setSubmittedApp] = useState<any>(null);

  // Training slide gate in V7
  const [trainingSlide, setTrainingSlide] = useState(0);
  const [trainingCompleted, setTrainingCompleted] = useState(false);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: any;
    if (step === 'phone_otp' && otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, otpCountdown]);

  const getCleanPhone = () => {
    const raw = phone.replace(/\D/g, '');
    const stripped = raw.startsWith('234') ? raw.slice(3) : raw.startsWith('0') ? raw.slice(1) : raw;
    return `+234 ${stripped}`;
  };

  const handleSendOtp = async () => {
    const formatted = getCleanPhone();
    setOtpSending(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formatted, role: 'driver' }),
      });
      const data = await res.json();
      if (data.sandboxCode || data.code || data.debugCode) {
        setDebugOtpHint(String(data.sandboxCode || data.code || data.debugCode));
      }
      setOtpCode('');
      if (data.success || res.ok) {
        setOtpSent(true);
        setOtpCountdown(30);
        setStep('phone_otp');
      } else {
        setOtpError(data.error || 'Failed to send OTP. Please check phone number.');
      }
    } catch {
      // Offline fallback: allow continuation in demo mode
      setOtpSent(true);
      setOtpCountdown(30);
      setStep('phone_otp');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (overrideCode?: string | React.MouseEvent) => {
    const formatted = getCleanPhone();
    const cleanCode = (typeof overrideCode === 'string' ? overrideCode : otpCode).trim();

    if (!cleanCode || cleanCode.length < 4) {
      setOtpError('Please enter the 4-digit verification code.');
      return;
    }

    setOtpVerifying(true);
    setOtpError(null);

    // Accept standard test code 1234 or verify via server
    const isMock = cleanCode === '1234';

    try {
      let verified = isMock;
      if (!isMock) {
        const res = await fetch('/api/auth/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formatted, code: cleanCode, role: 'driver' }),
        });
        const data = await res.json();
        if (data.success) {
          verified = true;
          if (data.token) {
            localStorage.setItem('zylift_driver_token', data.token);
          }
        } else {
          setOtpError(data.error || 'Invalid OTP code. Try entering 1234 for demo verification.');
          setOtpVerifying(false);
          return;
        }
      }

      if (verified) {
        // Direct Dashboard Routing: Check if driver is already registered!
        try {
          const lookupRes = await fetch('/api/auth/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: formatted, role: 'driver' }),
          });
          const lookupData = await lookupRes.json();
          if (lookupData.success && lookupData.exists && lookupData.driver) {
            localStorage.setItem('zylift_driver_user', JSON.stringify(lookupData.driver));
            onApplicationCompleted(lookupData.driver);
            return;
          }
        } catch {}

        setStep('personal');
      }
    } catch {
      if (cleanCode === '1234') {
        setStep('personal');
      } else {
        setOtpError('Verification failed. For testing, enter 1234.');
      }
    } finally {
      setOtpVerifying(false);
    }
  };

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (doc: UploadedDoc) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert(`File "${file.name}" exceeds the 20MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB). Please select an image or document under 20MB.`);
      e.target.value = '';
      return;
    }

    const sizeKb = Math.round(file.size / 1024);
    const sizeStr = sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

    if (file.type.startsWith('image/')) {
      try {
        const url = await compressImageFile(file, 900, 0.72);
        setter({
          url,
          name: file.name,
          size: sizeStr,
          type: 'image/jpeg',
          uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        return;
      } catch {
        // Fallback to raw FileReader below
      }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setter({
        url,
        name: file.name,
        size: sizeStr,
        type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const formatted = getCleanPhone();
      const effectiveName = name.trim() || 'Campus Driver';
      const effectivePlate = plate.trim() || `MNA-${Math.floor(100 + Math.random() * 899)}-KW`;

      const res = await fetch('/api/drivers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName: effectiveName,
          phone: formatted,
          referralCode: referralCode.trim().toUpperCase() || localStorage.getItem('zylift_referral_code') || undefined,
          dob,
          homeArea: homeArea.trim() || 'Gidan Kwanu Village',
          secondPhone,
          hasSmartphone,
          parkLeaderName,
          parkLeaderPhone,
          vehicleCategory: category,
          vehiclePlate: effectivePlate,
          vehicleModel: model.trim() || (category === 'keke' ? 'TVS King 200cc' : category === 'okada' ? 'Bajaj Boxer 150' : category === 'cab_go' ? 'Toyota Corolla' : category === 'small_bus' ? 'Suzuki Every Korope' : 'Toyota Coaster Bus'),
          vehicleColor: color,
          ninNumber,
          facePhotoUrl: facePhoto?.url,
          idCardPhotoUrl: idCardDoc?.url,
          licenseOrParkCardUrl: parkCardDoc?.url,
          vehiclePhotoUrl: vehiclePhotoDoc?.url,
          vehiclePapersUrl: vehiclePapersDoc?.url,
          documentsMeta: {
            facePhoto: facePhoto ? { name: facePhoto.name, size: facePhoto.size, type: facePhoto.type } : undefined,
            idCard: idCardDoc ? { name: idCardDoc.name, size: idCardDoc.size, type: idCardDoc.type } : undefined,
            license: parkCardDoc ? { name: parkCardDoc.name, size: parkCardDoc.size, type: parkCardDoc.type } : undefined,
            parkCard: parkCardDoc ? { name: parkCardDoc.name, size: parkCardDoc.size, type: parkCardDoc.type } : undefined,
            vehiclePhoto: vehiclePhotoDoc ? { name: vehiclePhotoDoc.name, size: vehiclePhotoDoc.size, type: vehiclePhotoDoc.type } : undefined,
            vehiclePapers: vehiclePapersDoc ? { name: vehiclePapersDoc.name, size: vehiclePapersDoc.size, type: vehiclePapersDoc.type } : undefined,
          },
          agreedToRules: agreedRules,
        }),
      });
      const data = await res.json();
      if (data.success && (data.application || data.driver)) {
        const appRecord = data.application || data.driver;
        const driverRecord = data.driver || (data.application && data.application.driver) || appRecord;
        setSubmittedApp({
          ...appRecord,
          driver: driverRecord,
        });
        if (data.token) {
          localStorage.setItem('zylift_driver_token', data.token);
        }
        if (driverRecord) {
          localStorage.setItem('zylift_driver_user', JSON.stringify(driverRecord));
        }
        setStep('review');
      } else {
        alert(data.error || 'Failed to submit driver application. Please check your information and try again.');
      }
    } catch (e: any) {
      console.error('Submit application failed:', e);
      alert(e?.message || 'Network error submitting driver application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- V1: INTRO ---
  if (step === 'intro') {
    return (
      <div className="flex-1 flex flex-col justify-between bg-white animate-fadeIn">
        {/* Green top half */}
        <div className="bg-[#0E7C3A] p-6 text-white text-center pb-10">
          <div className="flex justify-start mb-4">
            <button
              onClick={onBackToRider}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-white hover:bg-white/30 transition-all"
            >
              &larr;
            </button>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/20 mx-auto flex items-center justify-center mb-3 shadow">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black mb-1">Drive with Zylift</h1>
          <p className="text-xs text-white/80">Earn steady income on FUTMINNA campus</p>
        </div>

        {/* 3 Value Propositions */}
        <div className="p-6 -mt-6 bg-white rounded-t-3xl flex-1 flex flex-col justify-between shadow-lg">
          <div className="space-y-4">
            <div className="flex items-start gap-3.5 p-3.5 bg-[#F3F6F4] rounded-2xl">
              <div className="p-2 bg-[#E6F4EC] rounded-xl text-[#0E7C3A]">
                <Banknote className="w-5 h-5 text-[#0E7C3A]" />
              </div>
              <div>
                <p className="font-bold text-sm text-[#14201A]">0% Platform Commission</p>
                <p className="text-xs text-[#7A857F]">Keep 100% of all cash fares you collect during the pilot period.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 bg-[#F3F6F4] rounded-2xl">
              <div className="p-2 bg-[#E6F4EC] rounded-xl text-[#0E7C3A]">
                <Shield className="w-5 h-5 text-[#0E7C3A]" />
              </div>
              <div>
                <p className="font-bold text-sm text-[#14201A]">Fixed Campus Fares</p>
                <p className="text-xs text-[#7A857F]">No bargaining or price arguments. Students know the price upfront.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 bg-[#F3F6F4] rounded-2xl">
              <div className="p-2 bg-[#E6F4EC] rounded-xl text-[#0E7C3A]">
                <Zap className="w-5 h-5 text-[#0E7C3A]" />
              </div>
              <div>
                <p className="font-bold text-sm text-[#14201A]">Short 5-Min Trips</p>
                <p className="text-xs text-[#7A857F]">Quick hops between Gate, Hostels, SEET, and Library mean more daily trips.</p>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <KerbButton onClick={() => setStep('phone')}>
              Start Registration &rarr;
            </KerbButton>
          </div>
        </div>
      </div>
    );
  }

  // --- V2: PHONE INPUT ---
  if (step === 'phone') {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn">
        <div>
          <button
            onClick={() => setStep('intro')}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold mb-6 text-[#14201A]"
          >
            &larr;
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Phone className="w-6 h-6 text-[#0E7C3A]" />
            <h2 className="text-2xl font-bold text-[#14201A]">Driver Phone Number</h2>
          </div>
          <p className="text-sm text-[#7A857F] mb-6">
            Enter the active phone number you use while driving on campus. We will send an SMS OTP to verify ownership.
          </p>

          <div className="flex items-center gap-3 p-3.5 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] focus-within:border-[#0E7C3A] transition-all">
            <span className="font-bold text-xs bg-[#E6F4EC] text-[#0E7C3A] px-2.5 py-1.5 rounded-lg">NG +234</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="803 123 4567"
              className="flex-1 bg-transparent font-bold text-base outline-none text-[#14201A]"
            />
          </div>

          {otpError && (
            <div className="mt-4 p-3 bg-[#FDE8E8] border border-[#D93A3A]/30 rounded-xl flex items-center gap-2 text-xs text-[#D93A3A] font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{otpError}</span>
            </div>
          )}

          <div className="mt-4 p-3 bg-[#E6F4EC]/60 rounded-xl border border-[#0E7C3A]/20 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#0E7C3A] shrink-0" />
            <p className="text-[11px] text-[#3E4A43]">
              Security Rule: Driver phone must match your registered FUTMINNA Motor Park union record.
            </p>
          </div>
        </div>

        <div className="pt-6">
          <KerbButton isLoading={otpSending} onClick={handleSendOtp}>
            Send Verification Code &rarr;
          </KerbButton>
        </div>
      </div>
    );
  }

  // --- V2.5: PHONE OTP VERIFICATION ---
  if (step === 'phone_otp') {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn">
        <div>
          <button
            onClick={() => setStep('phone')}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold mb-6 text-[#14201A]"
          >
            &larr;
          </button>

          <div className="w-12 h-12 rounded-2xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center mb-3">
            <Lock className="w-6 h-6 text-[#0E7C3A]" />
          </div>

          <h2 className="text-2xl font-bold text-[#14201A] mb-2">Verify Driver Phone</h2>
          <p className="text-sm text-[#7A857F] mb-4">
            Enter the verification code sent to <strong className="text-[#14201A]">{getCleanPhone()}</strong>
          </p>

          {/* Amber Sandbox Dev Banner */}
          {(debugOtpHint || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) && (
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
                      Driver code: <strong className="font-mono text-sm tracking-widest text-[#8A5A00] font-black">{debugOtpHint || '123456'}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const code = debugOtpHint || '123456';
                    setOtpCode(code);
                  }}
                  className="px-3.5 py-2 bg-[#E69500] hover:bg-[#cf8300] active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs shrink-0 transition-all cursor-pointer"
                >
                  ⚡ 1-Tap Autofill
                </button>
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-bold uppercase text-[#7A857F] mb-2">
              Verification OTP
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

          {otpError && (
            <div className="mb-4 p-3 bg-[#FDE8E8] border border-[#D93A3A]/30 rounded-xl flex items-center gap-2 text-xs text-[#D93A3A] font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{otpError}</span>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-[#F3F6F4] rounded-xl text-xs mb-4">
            <span className="text-[#7A857F]">Didn't get code?</span>
            {otpCountdown > 0 ? (
              <span className="font-semibold text-[#7A857F]">Resend in {otpCountdown}s</span>
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
          <KerbButton isLoading={otpVerifying} onClick={() => handleVerifyOtp()}>
            Verify Phone & Continue &rarr;
          </KerbButton>
        </div>
      </div>
    );
  }

  // --- V3: PERSONAL DETAILS ---
  if (step === 'personal') {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn overflow-y-auto">
        <div>
          <button
            onClick={() => setStep('phone_otp')}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold mb-4 text-[#14201A]"
          >
            &larr;
          </button>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-5 h-5 text-[#0E7C3A]" />
            <h2 className="text-2xl font-bold text-[#14201A]">Personal Details</h2>
          </div>
          <p className="text-xs text-[#7A857F] mb-6">Required for campus security vetting and marshal clearance</p>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Full Legal Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-sm font-semibold text-[#14201A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Residential Area in Minna</label>
              <input
                type="text"
                value={homeArea}
                onChange={(e) => setHomeArea(e.target.value)}
                placeholder="e.g. Gidan Kwanu Village / Bosso / Maitumbi"
                className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-sm font-semibold text-[#14201A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Second Phone (Emergency / Guarantor)</label>
              <input
                type="tel"
                value={secondPhone}
                onChange={(e) => setSecondPhone(e.target.value)}
                className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-sm font-semibold text-[#14201A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">National Identification Number (NIN)</label>
              <input
                type="text"
                value={ninNumber}
                maxLength={11}
                onChange={(e) => setNinNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="11-digit NIN (e.g. 74920194821)"
                className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-sm font-mono font-bold text-[#14201A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Park Leader / Union Representative</label>
              <input
                type="text"
                value={parkLeaderName}
                onChange={(e) => setParkLeaderName(e.target.value)}
                className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-sm font-semibold text-[#14201A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Referral Code (Optional)</label>
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
                placeholder="e.g. DRV-XXXXXX or ZYLIFT-XXXXXX"
                className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-sm font-mono font-bold uppercase text-[#14201A]"
              />
            </div>
          </div>
        </div>

        <div className="pt-6">
          <KerbButton onClick={() => setStep('vehicle')}>Next: Vehicle Info &rarr;</KerbButton>
        </div>
      </div>
    );
  }

  // --- V4: VEHICLE ---
  if (step === 'vehicle') {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn">
        <div>
          <button
            onClick={() => setStep('personal')}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold mb-4 text-[#14201A]"
          >
            &larr;
          </button>
          <h2 className="text-2xl font-bold text-[#14201A] mb-1">Your Vehicle</h2>
          <p className="text-xs text-[#7A857F] mb-6">Select your vehicle category and plate</p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-2">Category</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(
                  [
                    { id: 'keke', label: 'Keke (Tricycle)' },
                    { id: 'okada', label: 'Okada (Motorbike)' },
                    { id: 'cab_go', label: 'Campus Cab (Car)' },
                    { id: 'small_bus', label: 'Small Bus (Korope)' },
                    { id: 'big_bus', label: 'Big Bus (Coaster)' },
                  ] as const
                ).map((item) => {
                  const isSelected = category === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCategory(item.id)}
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
                      className="py-3 px-2 rounded-2xl text-xs font-bold transition-all text-center border-2 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Vehicle License Plate</label>
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="MNA-123-KW"
                className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-sm font-mono font-bold text-[#14201A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Make & Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. TVS King Deluxe / Bajaj Boxer / Toyota Coaster"
                className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-sm font-semibold text-[#14201A]"
              />
            </div>
          </div>
        </div>

        <div className="pt-6">
          <KerbButton
            onClick={() => {
              if (!plate.trim()) {
                setPlate(`MNA-${Math.floor(100 + Math.random() * 899)}-KW`);
              }
              setStep('documents');
            }}
          >
            Next: Documents &rarr;
          </KerbButton>
        </div>
      </div>
    );
  }

  // --- V5: REAL WORKING DOCUMENT & PHOTO UPLOADS ---
  if (step === 'documents') {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn overflow-y-auto">
        <div>
          <button
            onClick={() => setStep('vehicle')}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold mb-4 text-[#14201A]"
          >
            &larr;
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Upload className="w-5 h-5 text-[#0E7C3A]" />
            <h2 className="text-2xl font-bold text-[#14201A]">Upload Documents</h2>
          </div>
          <p className="text-xs text-[#7A857F] mb-5">
            Photographs of your credentials for campus marshal verification
          </p>

          {/* Hidden HTML File Inputs */}
          <input
            type="file"
            ref={faceInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e, setFacePhoto)}
          />
          <input
            type="file"
            ref={idCardInputRef}
            accept="image/*,application/pdf,.pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => handleFileSelect(e, setIdCardDoc)}
          />
          <input
            type="file"
            ref={parkCardInputRef}
            accept="image/*,application/pdf,.pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => handleFileSelect(e, setParkCardDoc)}
          />
          <input
            type="file"
            ref={vehiclePhotoInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e, setVehiclePhotoDoc)}
          />
          <input
            type="file"
            ref={vehiclePapersInputRef}
            accept="image/*,application/pdf,.pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => handleFileSelect(e, setVehiclePapersDoc)}
          />

          <div className="space-y-3">
            {/* 1. Driver Face Photo */}
            <div
              onClick={() => !facePhoto && faceInputRef.current?.click()}
              className={`p-3.5 rounded-2xl flex items-center justify-between transition-all ${
                facePhoto
                  ? 'bg-[#FAFCFA] border-2 border-[#1B9E4B] shadow-xs'
                  : 'bg-[#F3F6F4] border-2 border-dashed border-[#DDE3DF] hover:border-[#0E7C3A] cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#DDE3DF] overflow-hidden flex items-center justify-center shrink-0">
                  {facePhoto?.url ? (
                    <img src={facePhoto.url} alt="Face Photo" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-5 h-5 text-[#7A857F]" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm text-[#14201A]">1. Driver Profile Photo</p>
                  {facePhoto ? (
                    <div className="mt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#1B9E4B] flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-[#1B9E4B]" /> Photo Attached
                        </span>
                        {facePhoto.size && <span className="text-[10px] text-[#7A857F] bg-[#E6F4EC] px-1.5 py-0.2 rounded font-mono font-bold text-[#0E7C3A]">({facePhoto.size})</span>}
                      </div>
                      <p className="text-[11px] text-[#3E4A43] truncate max-w-[170px] mt-0.5 font-medium">{facePhoto.name}</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#7A857F]">Clear front-facing passport photo (up to 20MB)</p>
                  )}
                </div>
              </div>
              {facePhoto ? (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => faceInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#0E7C3A] font-bold text-xs rounded-xl shadow-xs"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFacePhoto(null);
                      if (faceInputRef.current) faceInputRef.current.value = '';
                    }}
                    className="px-2.5 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#D93A3A] text-[#D93A3A] font-bold text-xs rounded-xl shadow-xs"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => faceInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#0E7C3A] font-bold text-xs rounded-xl shadow-xs"
                >
                  Upload
                </button>
              )}
            </div>

            {/* 2. NIN / National ID */}
            <div
              onClick={() => !idCardDoc && idCardInputRef.current?.click()}
              className={`p-3.5 rounded-2xl flex items-center justify-between transition-all ${
                idCardDoc
                  ? 'bg-[#FAFCFA] border-2 border-[#1B9E4B] shadow-xs'
                  : 'bg-[#F3F6F4] border-2 border-dashed border-[#DDE3DF] hover:border-[#0E7C3A] cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#DDE3DF] overflow-hidden flex items-center justify-center shrink-0">
                  {idCardDoc?.url ? (
                    <FileCheck className="w-6 h-6 text-[#1B9E4B]" />
                  ) : (
                    <FileText className="w-5 h-5 text-[#7A857F]" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm text-[#14201A]">2. NIN Document / Slip</p>
                  {idCardDoc ? (
                    <div className="mt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#1B9E4B] flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-[#1B9E4B]" /> Document Attached
                        </span>
                        {idCardDoc.size && <span className="text-[10px] text-[#7A857F] bg-[#E6F4EC] px-1.5 py-0.2 rounded font-mono font-bold text-[#0E7C3A]">({idCardDoc.size})</span>}
                      </div>
                      <p className="text-[11px] text-[#3E4A43] truncate max-w-[170px] mt-0.5 font-medium">{idCardDoc.name}</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#7A857F]">NIMC slip or card (Image or PDF up to 20MB)</p>
                  )}
                </div>
              </div>
              {idCardDoc ? (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => idCardInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#0E7C3A] font-bold text-xs rounded-xl shadow-xs"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIdCardDoc(null);
                      if (idCardInputRef.current) idCardInputRef.current.value = '';
                    }}
                    className="px-2.5 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#D93A3A] text-[#D93A3A] font-bold text-xs rounded-xl shadow-xs"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => idCardInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#0E7C3A] font-bold text-xs rounded-xl shadow-xs"
                >
                  Upload
                </button>
              )}
            </div>

            {/* 3. Driver's License or Park Union Card */}
            <div
              onClick={() => !parkCardDoc && parkCardInputRef.current?.click()}
              className={`p-3.5 rounded-2xl flex items-center justify-between transition-all ${
                parkCardDoc
                  ? 'bg-[#FAFCFA] border-2 border-[#1B9E4B] shadow-xs'
                  : 'bg-[#F3F6F4] border-2 border-dashed border-[#DDE3DF] hover:border-[#0E7C3A] cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#DDE3DF] overflow-hidden flex items-center justify-center shrink-0">
                  {parkCardDoc?.url ? (
                    <FileCheck className="w-6 h-6 text-[#1B9E4B]" />
                  ) : (
                    <Shield className="w-5 h-5 text-[#7A857F]" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm text-[#14201A]">3. Driver License / Park Union Card</p>
                  {parkCardDoc ? (
                    <div className="mt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#1B9E4B] flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-[#1B9E4B]" /> Document Attached
                        </span>
                        {parkCardDoc.size && <span className="text-[10px] text-[#7A857F] bg-[#E6F4EC] px-1.5 py-0.2 rounded font-mono font-bold text-[#0E7C3A]">({parkCardDoc.size})</span>}
                      </div>
                      <p className="text-[11px] text-[#3E4A43] truncate max-w-[170px] mt-0.5 font-medium">{parkCardDoc.name}</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#7A857F]">Official license or union clearance (up to 20MB)</p>
                  )}
                </div>
              </div>
              {parkCardDoc ? (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => parkCardInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#0E7C3A] font-bold text-xs rounded-xl shadow-xs"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParkCardDoc(null);
                      if (parkCardInputRef.current) parkCardInputRef.current.value = '';
                    }}
                    className="px-2.5 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#D93A3A] text-[#D93A3A] font-bold text-xs rounded-xl shadow-xs"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => parkCardInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#0E7C3A] font-bold text-xs rounded-xl shadow-xs"
                >
                  Upload
                </button>
              )}
            </div>

            {/* 4. Vehicle Exterior Photo */}
            <div
              onClick={() => !vehiclePhotoDoc && vehiclePhotoInputRef.current?.click()}
              className={`p-3.5 rounded-2xl flex items-center justify-between transition-all ${
                vehiclePhotoDoc
                  ? 'bg-[#FAFCFA] border-2 border-[#1B9E4B] shadow-xs'
                  : 'bg-[#F3F6F4] border-2 border-dashed border-[#DDE3DF] hover:border-[#0E7C3A] cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#DDE3DF] overflow-hidden flex items-center justify-center shrink-0">
                  {vehiclePhotoDoc?.url ? (
                    <img src={vehiclePhotoDoc.url} alt="Vehicle Exterior" className="w-full h-full object-cover" />
                  ) : (
                    <Car className="w-5 h-5 text-[#7A857F]" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm text-[#14201A]">4. Vehicle Photo (Plate Visible)</p>
                  {vehiclePhotoDoc ? (
                    <div className="mt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#1B9E4B] flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-[#1B9E4B]" /> Photo Attached
                        </span>
                        {vehiclePhotoDoc.size && <span className="text-[10px] text-[#7A857F] bg-[#E6F4EC] px-1.5 py-0.2 rounded font-mono font-bold text-[#0E7C3A]">({vehiclePhotoDoc.size})</span>}
                      </div>
                      <p className="text-[11px] text-[#3E4A43] truncate max-w-[170px] mt-0.5 font-medium">{vehiclePhotoDoc.name}</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#7A857F]">Full photo of your vehicle with plate (up to 20MB)</p>
                  )}
                </div>
              </div>
              {vehiclePhotoDoc ? (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => vehiclePhotoInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#0E7C3A] font-bold text-xs rounded-xl shadow-xs"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVehiclePhotoDoc(null);
                      if (vehiclePhotoInputRef.current) vehiclePhotoInputRef.current.value = '';
                    }}
                    className="px-2.5 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#D93A3A] text-[#D93A3A] font-bold text-xs rounded-xl shadow-xs"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => vehiclePhotoInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#0E7C3A] font-bold text-xs rounded-xl shadow-xs"
                >
                  Upload
                </button>
              )}
            </div>

            {/* 5. Vehicle Papers / Particulars */}
            <div
              onClick={() => !vehiclePapersDoc && vehiclePapersInputRef.current?.click()}
              className={`p-3.5 rounded-2xl flex items-center justify-between transition-all ${
                vehiclePapersDoc
                  ? 'bg-[#FAFCFA] border-2 border-[#1B9E4B] shadow-xs'
                  : 'bg-[#F3F6F4] border-2 border-dashed border-[#DDE3DF] hover:border-[#0E7C3A] cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#DDE3DF] overflow-hidden flex items-center justify-center shrink-0">
                  {vehiclePapersDoc?.url ? (
                    <FileCheck className="w-6 h-6 text-[#1B9E4B]" />
                  ) : (
                    <FileText className="w-5 h-5 text-[#7A857F]" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm text-[#14201A]">5. Vehicle Papers / Particulars</p>
                  {vehiclePapersDoc ? (
                    <div className="mt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#1B9E4B] flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-[#1B9E4B]" /> Document Attached
                        </span>
                        {vehiclePapersDoc.size && <span className="text-[10px] text-[#7A857F] bg-[#E6F4EC] px-1.5 py-0.2 rounded font-mono font-bold text-[#0E7C3A]">({vehiclePapersDoc.size})</span>}
                      </div>
                      <p className="text-[11px] text-[#3E4A43] truncate max-w-[170px] mt-0.5 font-medium">{vehiclePapersDoc.name}</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#7A857F]">Registration, insurance or receipt (Image or PDF up to 20MB)</p>
                  )}
                </div>
              </div>
              {vehiclePapersDoc ? (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => vehiclePapersInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#0E7C3A] font-bold text-xs rounded-xl shadow-xs"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVehiclePapersDoc(null);
                      if (vehiclePapersInputRef.current) vehiclePapersInputRef.current.value = '';
                    }}
                    className="px-2.5 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#D93A3A] text-[#D93A3A] font-bold text-xs rounded-xl shadow-xs"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => vehiclePapersInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#0E7C3A] font-bold text-xs rounded-xl shadow-xs"
                >
                  Upload
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 p-3 bg-[#E6F4EC] rounded-xl flex items-center gap-2 border border-[#0E7C3A]/20">
            <CheckCircle className="w-4 h-4 text-[#0E7C3A] shrink-0" />
            <p className="text-[11px] text-[#14201A] font-semibold">
              Supports high-resolution camera photos and PDF documents up to 20MB per file.
            </p>
          </div>
        </div>

        <div className="pt-6">
          <KerbButton onClick={() => setStep('rules')}>Review Code of Conduct &rarr;</KerbButton>
        </div>
      </div>
    );
  }

  // --- V6: RULES & CODE OF CONDUCT ---
  if (step === 'rules') {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn">
        <div>
          <button
            onClick={() => setStep('documents')}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold mb-4 text-[#14201A]"
          >
            &larr;
          </button>
          <h2 className="text-2xl font-bold text-[#14201A] mb-2">Driver Code of Conduct</h2>

          <div className="p-4 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] text-xs text-[#3E4A43] space-y-2.5 max-h-72 overflow-y-auto mb-4">
            <p className="font-bold text-[#14201A]">1. Safety PIN Enforcement</p>
            <p>You must never begin a trip without entering the rider's 4-digit PIN.</p>
            <p className="font-bold text-[#14201A]">2. Strict Flat Fares</p>
            <p>Do not demand extra cash or tip above the app-fixed price.</p>
            <p className="font-bold text-[#14201A]">3. Campus Speed Limit</p>
            <p>Maximum speed on FUTMINNA campus ring roads is 35 km/h.</p>
            <p className="font-bold text-[#14201A]">4. Courtesy & Respect</p>
            <p>Treat all students, lecturers, and visitors with utmost dignity.</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="rulesAgree"
              checked={agreedRules}
              onChange={(e) => setAgreedRules(e.target.checked)}
              className="w-5 h-5 text-[#0E7C3A] rounded accent-[#0E7C3A]"
            />
            <label htmlFor="rulesAgree" className="text-xs font-bold text-[#14201A]">
              I agree to abide by all FUTMINNA Campus Ride safety regulations
            </label>
          </div>
        </div>

        <div className="pt-6">
          <KerbButton isLoading={isSubmitting} disabled={!agreedRules} onClick={handleSubmit}>
            Submit Application
          </KerbButton>
        </div>
      </div>
    );
  }

  // --- V7: UNDER REVIEW & MANDATORY TRAINING GATE ---
  const trainingSlides = [
    {
      title: 'Slide 1: In-Person Verification Check',
      desc: 'All drivers must bring their vehicle and physical ID to School Motor Park for inspection by the Park Marshal before receiving approval.',
      icon: <Shield className="w-5 h-5 text-[#0E7C3A]" />,
    },
    {
      title: 'Slide 2: 15-Second Exclusivity',
      desc: 'When a new ride offer chimes on your screen, you have exactly 15 seconds to Accept or Decline before it cascades to the next nearby driver.',
      icon: <Clock className="w-5 h-5 text-[#0E7C3A]" />,
    },
    {
      title: 'Slide 3: Ask for the 4-Digit PIN',
      desc: 'Always say: "Welcome, please tell me your 4-digit PIN." Enter it to unlock the ride navigation and guarantee your payment record.',
      icon: <FileText className="w-5 h-5 text-[#0E7C3A]" />,
    },
  ];

  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn text-center">
      <div>
        <div className="w-16 h-16 rounded-full bg-[#FFF8E6] text-[#E69500] flex items-center justify-center mx-auto mb-3 shadow-inner">
          <Clock className="w-8 h-8 text-[#E69500]" />
        </div>
        <h2 className="text-xl font-bold text-[#14201A] mb-1">Application Under Review</h2>
        <p className="text-xs text-[#7A857F] max-w-xs mx-auto mb-6">
          Application ID: <strong>{submittedApp?.id || 'app_fut_101'}</strong>. You are currently strictly <strong>OFFLINE</strong> until approved by an admin or marshal.
        </p>

        {/* 3-Slide Training Component */}
        <div className="p-4 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] text-left mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase text-[#0E7C3A]">
              Driver Pilot Training ({trainingSlide + 1}/3)
            </span>
            <span>{trainingSlides[trainingSlide].icon}</span>
          </div>
          <p className="font-bold text-sm text-[#14201A] mb-1">
            {trainingSlides[trainingSlide].title}
          </p>
          <p className="text-xs text-[#3E4A43] leading-relaxed">
            {trainingSlides[trainingSlide].desc}
          </p>

          <div className="mt-3 flex justify-between items-center pt-2 border-t border-[#DDE3DF]">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    trainingSlide === idx ? 'w-4 bg-[#0E7C3A]' : 'w-1.5 bg-[#DDE3DF]'
                  }`}
                />
              ))}
            </div>
            {trainingSlide < 2 ? (
              <button
                onClick={() => setTrainingSlide((s) => s + 1)}
                className="text-xs font-bold text-[#0E7C3A]"
              >
                Next &rarr;
              </button>
            ) : (
              <button
                onClick={() => setTrainingCompleted(true)}
                className="text-xs font-bold text-[#1B9E4B]"
              >
                Complete Training
              </button>
            )}
          </div>
        </div>

        {trainingCompleted && (
          <div className="p-2.5 bg-[#E6F4EC] rounded-xl text-xs font-bold text-[#0E7C3A] mb-4">
            Orientation training completed! Ready for physical inspection.
          </div>
        )}
      </div>

      <div className="space-y-3 pt-4">
        <a
          href="tel:08147479777"
          className="w-full py-3.5 bg-[#F3F6F4] text-[#14201A] font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-[#DDE3DF]"
        >
          <Phone className="w-4 h-4 text-[#14201A]" />
          <span>Call Park Marshal: 08147479777</span>
        </a>
        <KerbButton
          onClick={() => {
            const driverData = submittedApp?.driver || submittedApp;
            if (driverData) {
              try {
                localStorage.setItem('zylift_driver_user', JSON.stringify(driverData));
              } catch (e) {}
            }
            onApplicationCompleted(driverData);
          }}
        >
          Go to Driver Terminal
        </KerbButton>
      </div>
    </div>
  );
};
