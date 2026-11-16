import React from 'react';
import { User, Car, ArrowRight, ShieldCheck, CheckCircle2, ChevronRight } from 'lucide-react';

interface RoleSelectionScreenProps {
  onSelectPassenger: () => void;
  onSelectDriverRegister: () => void;
  onSelectDriverSignIn: () => void;
}

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({
  onSelectPassenger,
  onSelectDriverRegister,
  onSelectDriverSignIn,
}) => {
  return (
    <div className="flex-1 flex flex-col justify-between bg-[#FAFCFA] text-[#14201A] p-6 animate-fadeIn select-none overflow-y-auto">
      {/* Brand Header */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#0E7C3A] flex items-center justify-center text-white shadow-md shadow-[#0E7C3A]/20">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-tight text-[#14201A]">ZYLIFT</span>
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 bg-[#E6F4EC] text-[#0E7C3A] rounded-md tracking-wider">
                  Transit
                </span>
              </div>
              <p className="text-[11px] text-[#7A857F] font-semibold">Campus & Minna Metropolitan</p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-bold text-[#0E7C3A] bg-[#E6F4EC] px-2.5 py-1 rounded-full border border-[#0E7C3A]/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>FUT Minna</span>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#14201A] tracking-tight leading-tight mb-1.5">
            Choose your account
          </h1>
          <p className="text-xs text-[#7A857F] font-medium leading-relaxed">
            Select how you would like to travel or earn across campus corridors and Minna city today.
          </p>
        </div>

        {/* Role Options */}
        <div className="space-y-4">
          {/* 1. Passenger Option */}
          <div
            onClick={onSelectPassenger}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectPassenger();
            }}
            className="group relative bg-white border-2 border-[#DDE3DF] hover:border-[#0E7C3A] rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99] focus:outline-none focus:border-[#0E7C3A]"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-2xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center group-hover:bg-[#0E7C3A] group-hover:text-white transition-colors">
                <User className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold text-[#0E7C3A] bg-[#E6F4EC] px-2.5 py-1 rounded-full">
                Rider
              </span>
            </div>

            <div className="mb-3">
              <h2 className="text-lg font-black text-[#14201A] group-hover:text-[#0E7C3A] transition-colors">
                I am a Passenger
              </h2>
              <p className="text-xs text-[#7A857F] mt-1 leading-relaxed">
                Book Keke, Okada, Cab, or Bus. Enjoy transparent fixed fares, live GPS route directions, and digital wallet payments.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F0F3F1] mb-4 text-[11px] text-[#4F5B54] font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E7C3A] shrink-0" />
                <span>Instant campus rides</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E7C3A] shrink-0" />
                <span>4-digit security PIN</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E7C3A] shrink-0" />
                <span>Paystack & Wallet</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E7C3A] shrink-0" />
                <span>Student / Staff rates</span>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectPassenger();
              }}
              className="w-full py-3 bg-[#0E7C3A] hover:bg-[#0A5C2B] text-white text-xs font-black rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <span>Continue as Passenger</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Driver Option */}
          <div
            className="group relative bg-white border-2 border-[#DDE3DF] hover:border-[#0E7C3A] rounded-3xl p-5 shadow-sm hover:shadow-md transition-all focus:outline-none"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-2xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center group-hover:bg-[#0E7C3A] group-hover:text-white transition-colors">
                <Car className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold text-[#14201A] bg-[#F3F6F4] px-2.5 py-1 rounded-full border border-[#DDE3DF]">
                Fleet Operator
              </span>
            </div>

            <div className="mb-3">
              <h2 className="text-lg font-black text-[#14201A] group-hover:text-[#0E7C3A] transition-colors">
                I am a Driver
              </h2>
              <p className="text-xs text-[#7A857F] mt-1 leading-relaxed">
                Accept trips from students & staff. Keep 100% of cash fares during the pilot, with automated Paystack wallet payouts.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F0F3F1] mb-4 text-[11px] text-[#4F5B54] font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E7C3A] shrink-0" />
                <span>0% Commission waiver</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E7C3A] shrink-0" />
                <span>Marshal verified fleet</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E7C3A] shrink-0" />
                <span>Direct bank payout</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E7C3A] shrink-0" />
                <span>Keke, Okada, Cab, Bus</span>
              </div>
            </div>

            {/* Driver Actions: Register vs Sign In */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onSelectDriverRegister}
                className="w-full py-3 bg-[#14201A] hover:bg-black text-white text-xs font-black rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <span>Register as Driver (Onboarding)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onSelectDriverSignIn}
                className="w-full py-2.5 bg-[#F3F6F4] hover:bg-[#E6F4EC] text-[#0E7C3A] text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 border border-[#DDE3DF] hover:border-[#0E7C3A]/30 transition-all"
              >
                <span>Already Registered? Sign In to Terminal</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Campus Security & Safety Footnote */}
      <div className="pt-6 pb-2 text-center border-t border-[#E8ECE9] mt-6">
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#7A857F] font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0E7C3A]" />
          <span>FUT Minna Campus Transit Directorate</span>
        </div>
        <p className="text-[10px] text-[#9EA8A2] mt-0.5">
          Gidan Kwanu • Bosso Campus • Minna City Corridors
        </p>
      </div>
    </div>
  );
};
