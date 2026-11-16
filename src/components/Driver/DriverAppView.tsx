import React, { useState, useEffect, useRef } from 'react';
import {
  Car,
  Bike,
  Bus,
  Shield,
  Clock,
  Phone,
  MessageSquare,
  CheckCircle,
  FileText,
  Check,
  AlertCircle,
  Banknote,
  Zap,
  Moon,
  User,
  Bell,
  Wallet,
  ArrowUpRight,
  TrendingUp,
  CreditCard,
  Building2,
  X,
  AlertTriangle,
  Upload,
  Camera,
  FileCheck,
  Edit3,
  Save,
  CheckCircle2,
  ChevronRight,
  Calendar,
  CalendarDays,
  RefreshCw,
  Users,
  Menu,
  Gift,
  Award,
  Copy,
  Share2,
  HelpCircle,
  LogOut,
  Star,
} from 'lucide-react';
import { RealLiveMap } from '../Map/RealLiveMap';
import {
  KerbButton,
  KerbCard,
  KerbPlateBadge,
  playKerbSound,
} from '../Common/KerbComponents';
import { compressImageFile } from '../../utils/imageCompress';

interface DriverAppViewProps {
  onSignOut: () => void;
}

export const DriverAppView: React.FC<DriverAppViewProps> = ({ onSignOut }) => {
  // Active Tab
  const [activeTab, setActiveTab] = useState<'home' | 'bookings' | 'earnings' | 'wallet' | 'profile' | 'invite'>('home');
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  // Driver Identity - initialize strictly from localStorage (no fake demo driver fallback)
  const [driver, setDriver] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('zylift_driver_user');
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });

  // Verify driver session with backend database: if driver was deleted, immediately clear session and sign out
  useEffect(() => {
    if (!driver?.id && !driver?.phone) {
      if (onSignOut) onSignOut();
      return;
    }

    const identifier = driver.id || driver.phone;
    let isCancelled = false;

    fetch(`/api/drivers/${encodeURIComponent(identifier)}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404 && !isCancelled) {
            console.warn('[DriverSession] Driver account not found in database (deleted). Signing out.');
            try {
              localStorage.removeItem('zylift_driver_user');
              localStorage.removeItem('zylift_driver_token');
            } catch (e) {}
            if (onSignOut) onSignOut();
          }
        } else {
          return res.json();
        }
      })
      .then((data) => {
        if (data?.success && data?.driver && !isCancelled) {
          setDriver((prev: any) => ({ ...(prev || {}), ...data.driver }));
          try {
            localStorage.setItem('zylift_driver_user', JSON.stringify(data.driver));
            if (data.token) {
              localStorage.setItem('zylift_driver_token', data.token);
            }
          } catch (e) {}
          if (data.driver.isApproved) {
            setShowApprovalNotice(false);
          }
        }
      })
      .catch((err) => {
        console.warn('[DriverSession] Driver verification error:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [driver?.id, driver?.phone]);

  // Dedicated Driver Referral State
  const [copiedDriverCode, setCopiedDriverCode] = useState(false);
  const [copiedDriverLink, setCopiedDriverLink] = useState(false);
  const driverReferralCode = driver
    ? (driver.referralCode || `DRV-${(driver.name || 'PILOT').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`).toUpperCase()
    : '';
  const appOrigin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://zylift.futminna.edu.ng';
  const driverReferralLink = `${appOrigin}/driver?ref=${driverReferralCode}`;
  const driverWhatsAppInviteUrl = `https://wa.me/?text=${encodeURIComponent(
    `Assalamu Alaikum! Drive on campus with Zylift at FUTMINNA Gidan Kwanu. Keep 100% of your earnings with 0% platform commission lock-in, steady student ride requests & no queue fighting. Register your Keke, Bike or Car here: ${driverReferralLink} (Referral: ${driverReferralCode})`
  )}`;

  // Edit Profile & Upload Documents state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(() => (driver ? { ...driver } : {}));
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  // Hidden File input refs for Edit modal
  const editFaceRef = useRef<HTMLInputElement>(null);
  const editIdCardRef = useRef<HTMLInputElement>(null);
  const editParkCardRef = useRef<HTMLInputElement>(null);
  const editVehiclePapersRef = useRef<HTMLInputElement>(null);

  // Document & Profile status check (exclude dead placeholder image path)
  const rawDriverPhoto = [driver?.facePhotoUrl, driver?.avatarUrl].find(
    (u) => Boolean(u && !String(u).includes('driver_avatar_keke_1790847258442'))
  );
  const hasFacePhoto = Boolean(rawDriverPhoto || driver?.documentsMeta?.facePhoto);
  const hasIdCard = Boolean(driver?.idCardPhotoUrl || driver?.documentsMeta?.idCard);
  const hasParkCard = Boolean(driver?.licenseOrParkCardUrl || driver?.documentsMeta?.license || driver?.documentsMeta?.parkCard);
  const hasVehiclePapers = Boolean(driver?.vehiclePapersUrl || driver?.documentsMeta?.vehiclePapers || driver?.vehiclePhotoUrl || driver?.documentsMeta?.vehiclePhoto);
  const hasUploadedDocuments = hasIdCard || hasParkCard || hasVehiclePapers;

  // Wallet & Transfers State
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(typeof driver?.walletBalance === 'number' ? driver.walletBalance : 0);

  // Bank & Paystack Subaccount State (Option B: Automated Direct Payouts)
  const [banksList, setBanksList] = useState<Array<{ name: string; code: string }>>([]);
  const [selectedBankCode, setSelectedBankCode] = useState(driver?.bankCode || '058');
  const [bankAccountNum, setBankAccountNum] = useState(driver?.accountNumber || '');
  const [resolvedAccountName, setResolvedAccountName] = useState(driver?.accountName || '');
  const [isResolvingBank, setIsResolvingBank] = useState(false);
  const [isLinkingSubaccount, setIsLinkingSubaccount] = useState(false);
  const [subaccountStatusMsg, setSubaccountStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [driverEarnings, setDriverEarnings] = useState<{
    todayEarnings: number;
    todayTripsCount: number;
    weekEarnings: number;
    weekTripsCount: number;
    totalEarnings: number;
    totalTripsCount: number;
    completedTrips: Array<{
      id: string;
      pickupName: string;
      dropoffName: string;
      fareNaira: number;
      completedAt: string;
      timeFormatted: string;
      isToday?: boolean;
      isThisWeek?: boolean;
      paymentMethod?: string;
    }>;
  }>({
    todayEarnings: 0,
    todayTripsCount: 0,
    weekEarnings: 0,
    weekTripsCount: 0,
    totalEarnings: 0,
    totalTripsCount: 0,
    completedTrips: [],
  });
  const [driverReferralStats, setDriverReferralStats] = useState<{
    totalReferrals: number;
    completedReferrals: number;
    pendingReferrals: number;
    unlockedPerks: string[];
    referrals: any[];
  }>({
    totalReferrals: 0,
    completedReferrals: 0,
    pendingReferrals: 0,
    unlockedPerks: [],
    referrals: [],
  });
  const [loadingReferralStats, setLoadingReferralStats] = useState(false);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showApprovalNotice, setShowApprovalNotice] = useState(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);

  // Sync latest driver status from server (including admin approvals)
  const syncDriverStatus = async () => {
    try {
      const activeDriver = driver || (() => {
        try {
          const cached = localStorage.getItem('zylift_driver_user');
          return cached ? JSON.parse(cached) : null;
        } catch { return null; }
      })();

      if (!activeDriver) return null;
      const identifier = activeDriver.id || activeDriver.phone;
      if (!identifier) return null;

      const res = await fetch(`/api/drivers/${encodeURIComponent(identifier)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.driver) {
          const updated = data.driver;
          if (data.token) {
            try {
              localStorage.setItem('zylift_driver_token', data.token);
            } catch (e) {}
          }
          setDriver((prev: any) => {
            const merged = { ...(prev || {}), ...updated };
            try {
              localStorage.setItem('zylift_driver_user', JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });
          if (updated.isApproved) {
            setShowApprovalNotice(false);
          }
          return updated;
        }
      }
    } catch (e) {
      console.warn('[DriverStatus] Sync error:', e);
    }
    return null;
  };

  useEffect(() => {
    syncDriverStatus();

    // If driver is not approved yet, poll every 3.5s so approval from Admin reflects immediately
    let pollTimer: any;
    if (driver && !driver.isApproved) {
      pollTimer = setInterval(syncDriverStatus, 3500);
    }
    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [driver?.id, driver?.phone, driver?.isApproved]);

  // State Machine
  const [isOnline, setIsOnline] = useState(false); // Starts in D2 (Offline)
  const [incomingOffer, setIncomingOffer] = useState<any>(null); // D4
  const [secondsRemaining, setSecondsRemaining] = useState(15);
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [tripState, setTripState] = useState<'idle' | 'going_pickup' | 'verifying_pin' | 'in_trip' | 'collect_cash'>('idle');
  const paystackChimedRef = useRef<boolean>(false);
  const [checkingPaystack, setCheckingPaystack] = useState(false);
  const [paystackCheckMsg, setPaystackCheckMsg] = useState<string | null>(null);
  const [driverBroadcast, setDriverBroadcast] = useState<any>(null);
  const [dismissedDriverBroadcastId, setDismissedDriverBroadcastId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDriverBroadcast = () => {
      fetch('/api/announcements?audience=drivers')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.announcements)) {
            setDriverBroadcast(d.announcements[0] || null);
          }
        })
        .catch(() => {});
    };
    fetchDriverBroadcast();
    const interval = setInterval(fetchDriverBroadcast, 5000);
    return () => clearInterval(interval);
  }, []);

  // PIN verification state
  const [enteredPin, setEnteredPin] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState(false);
  const [failedPinAttempts, setFailedPinAttempts] = useState(0);

  // Ensure PIN inputs always start fresh and blank on entering verification or changing trip
  useEffect(() => {
    if (tripState === 'verifying_pin') {
      setEnteredPin(['', '', '', '']);
      setPinError(false);
    }
  }, [tripState, activeTrip?.id]);

  // Real-time Driver GPS Tracking
  const [driverCoords, setDriverCoords] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDriverCoords([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        console.warn('[DriverAppView] GPS tracking warning:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Safe trip coordinates parser
  const parseTripCoords = (coords: any, fallback: [number, number]): [number, number] => {
    if (Array.isArray(coords) && coords.length >= 2) {
      const lat = Number(coords[0]);
      const lng = Number(coords[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
    }
    if (coords && typeof coords === 'object') {
      const lat = Number(coords.lat ?? coords.latitude);
      const lng = Number(coords.lng ?? coords.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
    }
    return fallback;
  };

  const tripPickupCoords: [number, number] = activeTrip
    ? parseTripCoords(activeTrip.pickupCoords, [9.5375, 6.4520])
    : [9.5375, 6.4520];

  const tripDropoffCoords: [number, number] = activeTrip
    ? parseTripCoords(activeTrip.dropoffCoords, [9.5265, 6.4430])
    : [9.5265, 6.4430];

  // Transfer alert audio tracker
  const transferChimedRef = useRef(false);

  // Authenticated driver fetch helper
  const driverFetch = (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('zylift_driver_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
  };

  // Advance Scheduled Bookings State & Handlers
  const [scheduledTrips, setScheduledTrips] = useState<any[]>([]);
  const [bookingSubTab, setBookingSubTab] = useState<'available' | 'my_claimed'>('available');

  const matchesDriverVehicle = (tripCategory?: string) => {
    const d = (driver?.vehicleCategory || 'keke').toLowerCase().trim();
    const t = (tripCategory || 'keke').toLowerCase().trim();
    if (d === t) return true;
    if (['car', 'cab', 'cab_go', 'cab_xl'].includes(d) && ['car', 'cab', 'cab_go', 'cab_xl'].includes(t)) {
      return true;
    }
    return false;
  };

  const fetchScheduledTrips = async () => {
    try {
      const catParam = driver?.vehicleCategory ? `?vehicleCategory=${encodeURIComponent(driver.vehicleCategory)}` : '';
      const res = await fetch(`/api/trips/scheduled${catParam}`);
      const data = await res.json();
      if (data.scheduledTrips) {
        setScheduledTrips(data.scheduledTrips);
      }
    } catch (err) {
      // silent
    }
  };

  useEffect(() => {
    fetchScheduledTrips();
    const interval = setInterval(fetchScheduledTrips, 4000);
    return () => clearInterval(interval);
  }, [driver?.vehicleCategory]);

  const availableBookings = scheduledTrips.filter((t) => {
    const isAvailable = (!t.claimedByDriver || t.status === 'scheduled') && !t.driverId;
    return isAvailable && matchesDriverVehicle(t.vehicleCategory);
  });

  const myClaimedBookings = scheduledTrips.filter(
    (t) => t.claimedByDriver?.id === driver.id || t.driverId === driver.id
  );

  const handleClaimScheduledTrip = async (tripId: string) => {
    try {
      const res = await driverFetch(`/api/trips/${tripId}/claim-scheduled`, {
        method: 'POST',
        body: JSON.stringify({
          driverId: driver.id,
          driverName: driver.name,
          driverPhone: driver.phone,
          vehicleCategory: driver.vehicleCategory,
          plateNumber: driver.vehiclePlate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        playKerbSound('success');
        fetchScheduledTrips();
        setBookingSubTab('my_claimed');
      } else {
        alert(data.error || 'Could not claim trip');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleStartScheduledTrip = async (trip: any) => {
    try {
      const res = await driverFetch(`/api/trips/${trip.id}/start-scheduled`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Could not start scheduled trip');
        return;
      }
      setActiveTrip(data.trip || trip);
      setTripState('going_pickup');
      setActiveTab('home');
      playKerbSound('success');
    } catch (err: any) {
      alert('Error starting trip: ' + err.message);
    }
  };

  // Poll for incoming bank transfer OR Paystack online payment notification when collecting fare (D8)
  useEffect(() => {
    if (tripState !== 'collect_cash' || !activeTrip?.id) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/trips/${activeTrip.id}`);
        const data = await res.json();
        let latest = data?.trip;

        // If rider initiated an online Paystack payment that hasn't settled locally yet, verify it
        if (latest?.pendingPaystackReference && latest.paymentStatus !== 'paystack_paid') {
          try {
            const checkRes = await fetch(`/api/trips/${activeTrip.id}/check-paystack`, { method: 'POST' });
            const checkData = await checkRes.json();
            if (checkData?.trip) latest = checkData.trip;
          } catch {}
        }

        if (latest) {
          if (latest.paymentStatus === 'transfer_pending' && !transferChimedRef.current) {
            playKerbSound('offer');
            transferChimedRef.current = true;
          }
          if (latest.paymentStatus === 'paystack_paid' && !paystackChimedRef.current) {
            playKerbSound('success');
            paystackChimedRef.current = true;
            setPaystackCheckMsg(null);
          }
          if (
            latest.paymentStatus !== activeTrip.paymentStatus ||
            latest.status !== activeTrip.status ||
            latest.pendingPaystackReference !== activeTrip.pendingPaystackReference
          ) {
            setActiveTrip(latest);
          }
        }
      } catch (e) {
        // silent
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [tripState, activeTrip?.id, activeTrip?.paymentStatus, activeTrip?.status, activeTrip?.pendingPaystackReference]);

  // Earnings tab period
  const [earningsPeriod, setEarningsPeriod] = useState<'today' | 'week'>('today');

  // Cancel trip modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Rider not at pickup');

  // Poll for incoming offers when online and idle
  useEffect(() => {
    if (!isOnline || tripState !== 'idle') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/drivers/${driver.id}/incoming-offer`);
        const data = await res.json();
        if (data.offer) {
          setIncomingOffer(data.offer);
          setSecondsRemaining(data.secondsRemaining || 15);
          playKerbSound('offer');
        } else {
          setIncomingOffer(null);
        }
      } catch (e) {
        // silent
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isOnline, tripState, driver?.id]);

  // Countdown timer for offer (15s)
  useEffect(() => {
    if (!incomingOffer) return;

    const timer = setInterval(() => {
      setSecondsRemaining((s) => {
        if (s <= 1) {
          clearInterval(timer);
          setIncomingOffer(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [incomingOffer]);

  // Accept offer
  const handleAcceptOffer = async () => {
    if (!incomingOffer) return;
    try {
      const res = await driverFetch(`/api/trips/${incomingOffer.id}/accept`, {
        method: 'POST',
        body: JSON.stringify({ driverId: driver.id }),
      });
      const data = await res.json();
      if (data.success && data.trip) {
        playKerbSound('success');
        setActiveTrip(data.trip);
        setIncomingOffer(null);
        setEnteredPin(['', '', '', '']);
        setPinError(false);
        setTripState('going_pickup'); // Enters D5
      }
    } catch (e) {
      console.error('Accept offer error:', e);
    }
  };

  // Decline offer
  const handleDeclineOffer = async () => {
    if (!incomingOffer) return;
    try {
      await driverFetch(`/api/trips/${incomingOffer.id}/decline`, {
        method: 'POST',
        body: JSON.stringify({ driverId: driver.id }),
      });
    } catch (e) {
      // silent
    }
    setIncomingOffer(null);
  };

  // Arrived at pickup
  const handleArrivedAtPickup = async () => {
    if (!activeTrip) return;
    await driverFetch(`/api/trips/${activeTrip.id}/arriving`, { method: 'POST' });
    setEnteredPin(['', '', '', '']);
    setPinError(false);
    setTripState('verifying_pin'); // Enters D6
  };

  // Verify PIN (D6)
  const handleVerifyPin = async () => {
    const pinStr = enteredPin.join('');
    if (pinStr.length < 4) return;

    try {
      const res = await driverFetch(`/api/trips/${activeTrip.id}/verify-pin`, {
        method: 'POST',
        body: JSON.stringify({ pin: pinStr }),
      });
      const data = await res.json();
      if (data.success) {
        playKerbSound('success');
        setPinError(false);
        setEnteredPin(['', '', '', '']);
        setTripState('in_trip'); // Enters D7
      } else {
        playKerbSound('sos');
        setPinError(true);
        setFailedPinAttempts((a) => a + 1);
        setEnteredPin(['', '', '', '']);
      }
    } catch (e) {
      console.error('Verify pin error:', e);
    }
  };

  // Finish trip -> Arrived at Destination -> Collect Cash / Paystack (D8)
  const handleFinishTrip = async () => {
    transferChimedRef.current = false;
    paystackChimedRef.current = false;
    setPaystackCheckMsg(null);
    setTripState('collect_cash');
    if (activeTrip) {
      try {
        await driverFetch(`/api/trips/${activeTrip.id}/arrived-destination`, { method: 'POST' });
      } catch (e) {
        // silent
      }
    }
  };

  // Actively check if rider has completed Paystack online payment
  const handleCheckPaystackPayment = async () => {
    if (!activeTrip) return;
    setCheckingPaystack(true);
    setPaystackCheckMsg(null);
    try {
      const res = await driverFetch(`/api/trips/${activeTrip.id}/check-paystack`, { method: 'POST' });
      const data = await res.json();
      if (data.trip) {
        setActiveTrip(data.trip);
      }
      if (data.paid || data.trip?.paymentStatus === 'paystack_paid') {
        if (!paystackChimedRef.current) {
          playKerbSound('success');
          paystackChimedRef.current = true;
        }
      } else {
        setPaystackCheckMsg(data.message || data.error || 'No online Paystack payment confirmed yet.');
      }
    } catch {
      setPaystackCheckMsg('Could not reach payment server. Try again.');
    } finally {
      setCheckingPaystack(false);
    }
  };

  // Finish trip after online Paystack payment is confirmed (preserves paystack_paid status)
  const handleFinishPaystackTrip = async () => {
    playKerbSound('success');
    setTripState('idle');
    setActiveTrip(null);
    setEnteredPin(['', '', '', '']);
    setPaystackCheckMsg(null);
    syncDriverStatus();
    fetchDriverEarnings();
  };

  // Confirm physical cash collected by driver at drop-off
  const handleConfirmCashCollected = async () => {
    if (activeTrip?.paymentStatus === 'paystack_paid') {
      return handleFinishPaystackTrip();
    }
    if (activeTrip) {
      try {
        await driverFetch(`/api/trips/${activeTrip.id}/payment/cash`, {
          method: 'POST',
          body: JSON.stringify({ driverId: driver.id }),
        });
      } catch (e) {
        // Fallback to legacy complete if offline
        try {
          await driverFetch(`/api/trips/${activeTrip.id}/complete`, { method: 'POST' });
        } catch (e2) {}
      }
    }
    playKerbSound('success');
    setTripState('idle');
    setActiveTrip(null);
    setEnteredPin(['', '', '', '']);
    setDriver((d: any) => ({
      ...d,
      totalTrips: (d.totalTrips || 0) + 1,
    }));
    fetchDriverEarnings();
  };

  // Confirm digital bank transfer received (Legacy fallback alias)
  const handleConfirmTransferReceived = async () => {
    if (!activeTrip) return;
    try {
      await driverFetch(`/api/trips/${activeTrip.id}/payment/cash`, {
        method: 'POST',
        body: JSON.stringify({ driverId: driver.id }),
      });
      playKerbSound('success');
      setTripState('idle');
      setActiveTrip(null);
      setEnteredPin(['', '', '', '']);
      setDriver((d: any) => ({
        ...d,
        totalTrips: (d.totalTrips || 0) + 1,
      }));
      fetchDriverEarnings();
    } catch (e) {
      console.error('Confirm transfer error:', e);
    }
  };

  // Fetch available Nigerian banks from Paystack
  const fetchBanksList = async () => {
    try {
      const res = await driverFetch('/api/paystack/banks');
      const data = await res.json();
      if (data.success && Array.isArray(data.banks)) {
        setBanksList(data.banks);
      }
    } catch (e) {
      // fallback handled server-side
    }
  };

  // Verify Driver NUBAN Account Name with CBN via Paystack
  const handleResolveBankAccount = async () => {
    const cleanAccount = bankAccountNum.replace(/\D/g, '').trim();
    if (cleanAccount.length !== 10) {
      setSubaccountStatusMsg({ type: 'error', text: 'Account number must be exactly 10 digits' });
      return;
    }
    setIsResolvingBank(true);
    setSubaccountStatusMsg(null);
    try {
      const res = await driverFetch('/api/driver/bank/resolve', {
        method: 'POST',
        body: JSON.stringify({
          accountNumber: cleanAccount,
          bankCode: selectedBankCode,
        }),
      });
      const data = await res.json();
      if (data.success && data.accountName) {
        setResolvedAccountName(data.accountName);
        setSubaccountStatusMsg({ type: 'success', text: `Verified Account: ${data.accountName}` });
      } else {
        setSubaccountStatusMsg({ type: 'error', text: data.error || 'Could not verify account name' });
      }
    } catch (e: any) {
      setSubaccountStatusMsg({ type: 'error', text: e.message || 'Verification network failure' });
    } finally {
      setIsResolvingBank(false);
    }
  };

  // Link Paystack Subaccount for Automated Split Payouts
  const handleLinkPaystackSubaccount = async () => {
    const cleanAccount = bankAccountNum.replace(/\D/g, '').trim();
    if (cleanAccount.length !== 10) {
      setSubaccountStatusMsg({ type: 'error', text: 'Enter a valid 10-digit account number' });
      return;
    }

    const bankObj = banksList.find((b) => b.code === selectedBankCode);
    const bankName = bankObj ? bankObj.name : driver.bankName || 'Commercial Bank';

    setIsLinkingSubaccount(true);
    setSubaccountStatusMsg(null);
    try {
      const res = await driverFetch('/api/driver/bank-subaccount', {
        method: 'POST',
        body: JSON.stringify({
          driverId: driver.id,
          bankCode: selectedBankCode,
          accountNumber: cleanAccount,
          bankName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubaccountStatusMsg({
          type: 'success',
          text: `Linked successfully! Subaccount: ${data.subaccountCode}. All card/transfer fares will deposit directly to ${data.accountName}.`,
        });
        setDriver((d: any) => ({
          ...d,
          bankName,
          bankCode: selectedBankCode,
          accountNumber: cleanAccount,
          accountName: data.accountName,
          paystackSubaccountCode: data.subaccountCode,
        }));
        setTimeout(() => setShowBankModal(false), 2200);
      } else {
        setSubaccountStatusMsg({ type: 'error', text: data.error || 'Failed to link subaccount' });
      }
    } catch (e: any) {
      setSubaccountStatusMsg({ type: 'error', text: e.message || 'Network error linking subaccount' });
    } finally {
      setIsLinkingSubaccount(false);
    }
  };

  // Fetch driver wallet data (fallback)
  const fetchDriverWallet = async () => {
    try {
      const res = await driverFetch(`/api/drivers/${driver.id}/wallet`);
      const data = await res.json();
      if (data.success && data.wallet) {
        setWalletBalance(data.wallet.balance ?? 0);
        setWalletTransactions(data.wallet.transactions || []);
      }
    } catch (e) {
      // silent
    }
  };

  // Fetch driver real earnings and completed trips
  const fetchDriverEarnings = async (silent = false) => {
    try {
      if (!silent) setLoadingEarnings(true);
      const res = await driverFetch(`/api/drivers/${driver.id}/earnings`);
      const data = await res.json();
      if (data.success) {
        setDriverEarnings({
          todayEarnings: data.todayEarnings || 0,
          todayTripsCount: data.todayTripsCount || 0,
          weekEarnings: data.weekEarnings || 0,
          weekTripsCount: data.weekTripsCount || 0,
          totalEarnings: data.totalEarnings || 0,
          totalTripsCount: data.totalTripsCount || 0,
          completedTrips: data.completedTrips || [],
        });
      }
    } catch (e) {
      // silent
    } finally {
      if (!silent) setLoadingEarnings(false);
    }
  };

  // Fetch driver referral statistics
  const fetchDriverReferralStats = async () => {
    try {
      setLoadingReferralStats(true);
      const res = await driverFetch(`/api/referrals/stats?code=${encodeURIComponent(driver?.id || driverReferralCode)}&phone=${encodeURIComponent(driver.phone || '')}`);
      const data = await res.json();
      if (data.success && data.stats) {
        setDriverReferralStats(data.stats);
      }
    } catch (e) {
      // silent
    } finally {
      setLoadingReferralStats(false);
    }
  };

  useEffect(() => {
    fetchDriverWallet();
    fetchDriverEarnings();
    fetchBanksList();
    if (activeTab === 'invite') {
      fetchDriverReferralStats();
    }
  }, [driver.id, activeTab]);

  // Real-time daily earnings & trip counter polling every 5 seconds
  useEffect(() => {
    if (!driver?.id) return;
    const interval = setInterval(() => {
      fetchDriverEarnings(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [driver?.id]);

  // Handle Online Toggle with Admin Approval Gate
  const handleToggleOnline = async (targetState: boolean) => {
    let currentApproved = Boolean(driver.isApproved);

    // If attempting to go online, always check server in real-time first in case admin just approved
    if (targetState && !currentApproved) {
      setIsCheckingApproval(true);
      const latest = await syncDriverStatus();
      setIsCheckingApproval(false);
      if (latest && latest.isApproved) {
        currentApproved = true;
      }
    }

    if (targetState && !currentApproved) {
      setShowApprovalNotice(true);
      setIsOnline(false);
      return;
    }

    try {
      const res = await driverFetch(`/api/drivers/${driver.id}/toggle-online`, {
        method: 'POST',
        body: JSON.stringify({ isOnline: targetState }),
      });
      const data = await res.json();

      if (data.token) {
        try {
          localStorage.setItem('zylift_driver_token', data.token);
        } catch (e) {}
      }

      if (data.driver) {
        setDriver((prev: any) => ({ ...(prev || {}), ...data.driver }));
        try {
          localStorage.setItem('zylift_driver_user', JSON.stringify({ ...(driver || {}), ...data.driver }));
        } catch (e) {}
      }

      // Strictly check if the server flagged unverified / pending approval
      if (data.needsVerification || (!data.success && data.error?.toLowerCase().includes('unverified'))) {
        setShowApprovalNotice(true);
        setIsOnline(false);
        return;
      }

      if (!data.success) {
        console.warn('[DriverToggleOnline] Toggle failed:', data.error);
        return;
      }

      setIsOnline(targetState);
      if (targetState) {
        setShowApprovalNotice(false);
      }
    } catch (err) {
      console.warn('[DriverToggleOnline] Network error:', err);
      if (targetState && !driver?.isApproved) {
        setShowApprovalNotice(true);
        setIsOnline(false);
        return;
      }
      setIsOnline(targetState);
    }
  };

  // Handle Edit Profile file uploads
  const handleEditDocSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldKey: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      try {
        const url = await compressImageFile(file, 900, 0.72);
        setEditFormData((prev: any) => ({ ...prev, [fieldKey]: url }));
        return;
      } catch {
        // Fallback to raw FileReader
      }
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setEditFormData((prev: any) => ({ ...prev, [fieldKey]: url }));
    };
    reader.readAsDataURL(file);
  };

  // Handle Saving Driver Profile & Documents
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setProfileSaveSuccess(false);
    try {
      const res = await driverFetch(`/api/drivers/${driver.id}/update`, {
        method: 'POST',
        body: JSON.stringify(editFormData),
      });
      const data = await res.json();
      if (data.success && data.driver) {
        setDriver(data.driver);
        localStorage.setItem('zylift_driver_user', JSON.stringify(data.driver));
        setProfileSaveSuccess(true);
        setTimeout(() => {
          setProfileSaveSuccess(false);
          setShowEditProfileModal(false);
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to update driver profile:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Withdrawal from Driver Wallet
  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      setWithdrawMsg({ type: 'error', text: 'Enter a valid amount to withdraw.' });
      return;
    }
    if (amount > walletBalance) {
      setWithdrawMsg({ type: 'error', text: `Insufficient balance. Available: ₦${walletBalance.toLocaleString()}` });
      return;
    }

    setWithdrawLoading(true);
    setWithdrawMsg(null);
    try {
      const res = await driverFetch(`/api/drivers/${driver.id}/wallet/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (data.success) {
        setWithdrawMsg({
          type: 'success',
          text: `₦${amount.toLocaleString()} withdrawn successfully to ${driver.bankName} (${driver.accountNumber})!`,
        });
        setWithdrawAmount('');
        fetchDriverWallet();
        setTimeout(() => {
          setShowWithdrawModal(false);
          setWithdrawMsg(null);
        }, 1600);
      } else {
        setWithdrawMsg({ type: 'error', text: data.error || 'Withdrawal failed' });
      }
    } catch (err: any) {
      setWithdrawMsg({ type: 'error', text: err.message || 'Withdrawal failed' });
    } finally {
      setWithdrawLoading(false);
    }
  };

  // Cancel active trip
  const handleCancelActiveTrip = async () => {
    if (activeTrip) {
      await driverFetch(`/api/trips/${activeTrip.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      });
    }
    setShowCancelModal(false);
    setTripState('idle');
    setActiveTrip(null);
  };

  if (!driver) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#14201A] text-white text-center">
        <p className="text-sm font-semibold text-[#A3B899]">Checking driver credentials...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#14201A] text-white relative select-none">
      {/* ============================================================== */}
      {/* SCREEN TAB: HOME (D2 Offline / D3 Online / D5 / D6 / D7 / D8) */}
      {/* ============================================================== */}
      {activeTab === 'home' && (
        <div className="flex-1 flex flex-col relative h-full bg-white text-neutral-900">
          {/* Top Bar with Online/Offline Status & Hamburger Menu */}
          <div className="relative z-10 p-3 bg-white border-b border-[#DDE3DF] shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsSideMenuOpen(true)}
                className="w-9 h-9 rounded-full bg-[#F3F6F4] hover:bg-[#DDE3DF] flex items-center justify-center text-[#14201A] transition-all"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5 text-[#14201A]" />
              </button>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isOnline ? 'bg-[#1B9E4B] animate-pulse' : 'bg-[#7A857F]'
                  }`}
                />
                <span className="font-bold text-sm text-[#14201A]">
                  {isOnline ? 'You are Online' : 'You are Offline'}
                </span>
              </div>
            </div>

            <button
              onClick={() => handleToggleOnline(!isOnline)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                isOnline
                  ? 'border-[#D93A3A] text-[#D93A3A] hover:bg-[#FDE8E8]'
                  : !driver.isApproved
                  ? 'border-[#E69500] text-[#E69500] hover:bg-[#FEF3C7]'
                  : 'border-[#0E7C3A] text-[#0E7C3A] hover:bg-[#E6F4EC]'
              }`}
            >
              {isOnline ? 'Go Offline' : !driver.isApproved ? 'Go Online (Pending Approval)' : 'Go Online'}
            </button>
          </div>

          {/* Action Required Notification Banner: ONLY shown when driver is NOT approved yet */}
          {!driver.isApproved && (
            <div className="m-3 p-3.5 bg-[#FFF8E6] border border-[#E69500]/50 rounded-2xl shadow-xs animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-[#E69500] shrink-0 mt-0.5" />
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[#8A5A00]">
                      {hasUploadedDocuments
                        ? 'Pending Admin Verification'
                        : 'Action Required: Upload Credentials'}
                    </h4>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#8A5A00]">
                      {hasUploadedDocuments ? 'Under Review' : 'Strictly Offline'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8A5A00]/90 mt-1 leading-snug">
                    {hasUploadedDocuments
                      ? 'Your credentials have been submitted and are awaiting in-person marshal inspection at the School Motor Park.'
                      : 'You haven’t uploaded your credentials (NIN slip, Park union card, Vehicle papers). Upload them to get verified.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditFormData({ ...driver });
                      setShowEditProfileModal(true);
                    }}
                    className="mt-2.5 px-3 py-1.5 bg-[#E69500] hover:bg-[#c98200] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{hasUploadedDocuments ? 'View / Update Uploaded Documents' : 'Upload Documents'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Campus Broadcast Banner for Drivers */}
          {driverBroadcast && driverBroadcast.id !== dismissedDriverBroadcastId && (
            <div className="mx-4 mt-3 mb-1 p-3 bg-[#E6F4EC] border border-[#0E7C3A] rounded-2xl shadow-md flex items-start justify-between gap-2 animate-fadeIn z-20">
              <div className="flex items-start gap-2 text-xs min-w-0 pr-1">
                <span className="text-base leading-none">📢</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-[#0E7C3A] text-xs">{driverBroadcast.title}</span>
                    <span className="text-[9px] font-bold bg-[#0E7C3A] text-white px-1.5 py-0.2 rounded-full uppercase">Broadcast</span>
                  </div>
                  <p className="text-[11px] text-[#14201A] font-medium mt-0.5 leading-snug">{driverBroadcast.body}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissedDriverBroadcastId(driverBroadcast.id)}
                className="text-slate-400 hover:text-slate-600 p-1 text-xs font-bold shrink-0 cursor-pointer"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {/* D2. HOME OFFLINE */}
          {!isOnline && tripState === 'idle' && (
            <div className="flex-1 flex flex-col justify-between p-6 bg-[#F3F6F4] text-center">
              <div className="pt-12">
                <div className="w-20 h-20 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center mx-auto mb-4">
                  <Moon className="w-10 h-10 text-neutral-500" />
                </div>
                <h2 className="text-2xl font-black text-[#14201A] mb-1">You Are Offline</h2>
                <p className="text-sm text-[#7A857F] max-w-xs mx-auto mb-8">
                  Tap below to start receiving fixed-price ride requests across FUTMINNA campus.
                </p>

                {/* Today Summary */}
                <div className="p-4 bg-white rounded-2xl border border-[#DDE3DF] max-w-xs mx-auto shadow-sm flex items-center justify-around">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#7A857F]">Today</span>
                    <p className="text-xl font-black text-[#0E7C3A]">
                      ₦{(driverEarnings.todayEarnings || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-[#DDE3DF]" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#7A857F]">Today's Trips</span>
                    <p className="text-xl font-black text-[#14201A]">
                      {driverEarnings.todayTripsCount || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* 96dp Round Power Button */}
              <div className="pb-8">
                <button
                  onClick={() => handleToggleOnline(true)}
                  className={`w-24 h-24 rounded-full flex flex-col items-center justify-center mx-auto shadow-xl active:scale-95 transition-transform ${
                    !driver.isApproved
                      ? 'bg-[#E69500] hover:bg-[#c98200] text-white'
                      : 'bg-[#0E7C3A] hover:bg-[#0A5C2B] text-white'
                  }`}
                >
                  {!driver.isApproved ? (
                    <>
                      <AlertCircle className="w-7 h-7 mb-0.5 text-white" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Unverified</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-7 h-7 mb-0.5 text-white" />
                      <span className="text-xs font-bold uppercase tracking-wider">Online</span>
                    </>
                  )}
                </button>
                {!driver.isApproved && (
                  <p className="text-[11px] font-semibold text-[#8A5A00] mt-2">
                    Offline: Admin verification required before going online
                  </p>
                )}
              </div>
            </div>
          )}

          {/* D3. HOME ONLINE (WAITING) */}
          {isOnline && tripState === 'idle' && !incomingOffer && (
            <div className="flex-1 flex flex-col relative h-full">
              {/* Full Color Map */}
              <div className="flex-1 w-full relative z-0">
                <RealLiveMap stage="idle" selectedRide="keke" />
              </div>

              {/* Bottom Sheet */}
              <div className="p-5 bg-white border-t border-[#DDE3DF] rounded-t-3xl shadow-xl z-10 text-center">
                <div className="w-3 h-3 rounded-full bg-[#1B9E4B] animate-ping mx-auto mb-2" />
                <h3 className="text-base font-bold text-[#14201A] mb-1">
                  Waiting for ride requests...
                </h3>
                <p className="text-xs text-[#7A857F] mb-3">
                  Keep your phone awake and volume up for incoming offers
                </p>

                {/* Advance Pre-Bookings Available Card for Driver */}
                {availableBookings.length > 0 && (
                  <div
                    onClick={() => setActiveTab('bookings')}
                    className="mb-3 p-3 bg-gradient-to-r from-[#111F18] to-[#1E3328] text-white rounded-2xl shadow-md cursor-pointer hover:border-[#0E7C3A] border border-neutral-700 flex items-center justify-between text-left transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#0E7C3A] text-white flex items-center justify-center font-bold">
                        <Calendar className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold">Advance Bookings Hub</span>
                          <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
                        </div>
                        <p className="text-[11px] text-neutral-300">
                          {availableBookings.length} passenger trips booked ahead · Tap to claim
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  </div>
                )}

                <div className="p-3 bg-[#E6F4EC] rounded-2xl flex items-center justify-between text-xs">
                  <span className="text-[#3E4A43] font-semibold">Today's Earnings (0% Fee):</span>
                  <span className="font-extrabold text-[#0E7C3A] text-sm">
                    ₦{(driverEarnings.todayEarnings || 0).toLocaleString()} · {driverEarnings.todayTripsCount || 0} {driverEarnings.todayTripsCount === 1 ? 'trip' : 'trips'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* D4. 15-SECOND COUNTDOWN OFFER OVERLAY */}
          {incomingOffer && (
            <div className="fixed inset-0 z-50 bg-[#0E7C3A] flex flex-col justify-between text-white animate-fadeIn">
              {/* Top Half */}
              <div className="p-6 text-center">
                <div className="w-24 h-24 rounded-full border-4 border-white mx-auto flex items-center justify-center text-3xl font-black mb-3 shadow-lg bg-[#0A5C2B]">
                  {secondsRemaining}s
                </div>
                <h2 className="text-2xl font-black mb-1">New Ride Offer!</h2>
                <p className="text-xs text-white/80">Campus Zone: {incomingOffer.vehicleCategory?.toUpperCase()}</p>
              </div>

              {/* Center Details Card */}
              <div className="mx-4 p-5 bg-white rounded-3xl text-neutral-900 shadow-2xl">
                <div className="flex items-center justify-between mb-4 border-b border-[#DDE3DF] pb-3">
                  <div>
                    <span className="text-xs font-bold uppercase text-[#7A857F]">Fixed Cash Fare</span>
                    <p className="text-3xl font-black text-[#0E7C3A]">₦{incomingOffer.fareNaira}</p>
                  </div>
                  <div className="flex items-center gap-2.5 justify-end">
                    <div className="text-right">
                      <span className="text-xs font-bold text-[#7A857F]">Passenger</span>
                      <p className="font-bold text-base text-[#14201A]">{incomingOffer.riderName}</p>
                      <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#0E7C3A] border border-emerald-200">
                        👥 {incomingOffer.passengers ? `${incomingOffer.passengers} Passenger Seat${incomingOffer.passengers > 1 ? 's' : ''}` : '1 Passenger Seat'}
                      </span>
                    </div>
                    <div className="w-11 h-11 rounded-full bg-[#E6F4EC] border border-[#DDE3DF] flex items-center justify-center relative overflow-hidden shrink-0">
                      <User className="w-5 h-5 text-[#0E7C3A]" />
                      {incomingOffer.riderAvatarUrl && (
                        <img
                          src={incomingOffer.riderAvatarUrl}
                          alt={incomingOffer.riderName || 'Passenger'}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-[#0E7C3A] flex-shrink-0" />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#7A857F]">Pick-up (2 mins)</span>
                      <p className="text-sm font-bold text-[#14201A] truncate">{incomingOffer.pickupName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-sm bg-[#D93A3A] flex-shrink-0" />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#7A857F]">Destination</span>
                      <p className="text-sm font-bold text-[#14201A] truncate">{incomingOffer.dropoffName}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Side-by-Side Accept & Decline Buttons */}
              <div className="p-4 grid grid-cols-2 gap-3 bg-[#0A5C2B]">
                <button
                  onClick={handleDeclineOffer}
                  className="h-14 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold text-base flex items-center justify-center border border-white/40"
                >
                  Decline
                </button>
                <button
                  onClick={handleAcceptOffer}
                  className="h-14 rounded-2xl bg-white text-[#0E7C3A] font-black text-lg flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  Accept Offer
                </button>
              </div>
            </div>
          )}

          {/* D5. GOING TO PICK-UP */}
          {tripState === 'going_pickup' && activeTrip && (
            <div className="flex-1 flex flex-col relative h-full">
              <div className="flex-1 w-full relative z-0">
                <RealLiveMap
                  pickup={{
                    name: 'Driver (You)',
                    lat: driverCoords ? driverCoords[0] : (tripPickupCoords[0] + 0.0025),
                    lng: driverCoords ? driverCoords[1] : (tripPickupCoords[1] - 0.0025),
                  }}
                  destination={{
                    name: activeTrip.pickupName || 'Rider Pick-up Point',
                    lat: tripPickupCoords[0],
                    lng: tripPickupCoords[1],
                  }}
                  stage="dispatch"
                  selectedRide={activeTrip.vehicleCategory || 'keke'}
                />
              </div>

              <div className="p-5 bg-white border-t border-[#DDE3DF] rounded-t-3xl shadow-xl z-10">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#0E7C3A]">Heading to Rider</span>
                    <h3 className="text-base font-bold text-[#14201A]">{activeTrip.pickupName}</h3>
                  </div>
                  <span className="text-base font-black text-[#0E7C3A]">₦{activeTrip.fareNaira}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center border border-[#DDE3DF] relative overflow-hidden shrink-0">
                      <User className="w-4 h-4 text-[#0E7C3A]" />
                      {activeTrip.riderAvatarUrl && (
                        <img
                          src={activeTrip.riderAvatarUrl}
                          alt={activeTrip.riderName || 'Passenger'}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-[#14201A]">{activeTrip.riderName || 'Campus Passenger'}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-[#0E7C3A] border border-emerald-200">
                          {activeTrip.passengers || 1} seat{(activeTrip.passengers || 1) > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-xs text-[#7A857F]">{activeTrip.riderPhone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${activeTrip.riderPhone}`}
                      className="px-2.5 py-2 bg-white rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#0E7C3A] flex items-center gap-1 shadow-sm"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#0E7C3A]" />
                      Call
                    </a>
                    <a
                      href={`sms:${activeTrip.riderPhone}?body=${encodeURIComponent(`Hello ${activeTrip.riderName || 'Rider'}, I am your Zylift driver heading to pick you up at ${activeTrip.pickupName}`)}`}
                      className="px-2.5 py-2 bg-white rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#0E7C3A] flex items-center gap-1 shadow-sm"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#0E7C3A]" />
                      SMS
                    </a>
                  </div>
                </div>

                <div className="space-y-2">
                  <KerbButton onClick={handleArrivedAtPickup}>
                    I Have Arrived at Pick-up
                  </KerbButton>

                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="w-full py-2 text-xs font-bold text-[#D93A3A] hover:underline"
                  >
                    Cancel Trip
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* D6. START WITH PIN */}
          {tripState === 'verifying_pin' && activeTrip && (
            <div className="flex-1 flex flex-col relative h-full bg-[#F3F6F4]">
              {/* Map header showing exact rider pick-up location */}
              <div className="h-44 w-full relative z-0 border-b border-[#DDE3DF]">
                <RealLiveMap
                  pickup={{
                    name: 'Driver Arrived',
                    lat: driverCoords ? driverCoords[0] : tripPickupCoords[0],
                    lng: driverCoords ? driverCoords[1] : tripPickupCoords[1],
                  }}
                  destination={{
                    name: activeTrip.pickupName || 'Rider Pick-up Point',
                    lat: tripPickupCoords[0],
                    lng: tripPickupCoords[1],
                  }}
                  stage="dispatch"
                  selectedRide={activeTrip.vehicleCategory || 'keke'}
                />
              </div>

              <div className="flex-1 flex flex-col justify-between p-5 bg-white text-center overflow-y-auto">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E7C3A]">
                    Step 2: Security Verification · Arrived at Pick-up
                  </span>
                  <h2 className="text-xl font-black text-[#14201A] mt-1 mb-1">
                    Ask Rider for 4-Digit PIN
                  </h2>
                  <p className="text-xs text-[#7A857F] mb-4">
                    Rider {activeTrip.riderName || 'Passenger'} at <strong className="text-[#14201A]">{activeTrip.pickupName}</strong> must read the 4 numbers displayed on their screen
                  </p>

                  {/* 4 Large PIN boxes */}
                  <div
                    className={`flex justify-center gap-3 my-2 transition-transform ${
                      pinError ? 'animate-shake' : ''
                    }`}
                  >
                    {enteredPin.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`pin-box-${idx}`}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => {
                          const val = e.target.value.slice(-1);
                          const next = [...enteredPin];
                          next[idx] = val;
                          setEnteredPin(next);
                          if (val && idx < 3) {
                            document.getElementById(`pin-box-${idx + 1}`)?.focus();
                          }
                        }}
                        className="w-13 h-14 text-center text-2xl font-mono font-bold bg-[#F3F6F4] border-2 border-[#DDE3DF] rounded-2xl focus:border-[#0E7C3A] outline-none"
                      />
                    ))}
                  </div>

                  {pinError && (
                    <p className="text-xs font-bold text-[#D93A3A] mt-2">
                      Incorrect PIN. Please re-check rider's screen ({failedPinAttempts}/3)
                    </p>
                  )}
                </div>

                {/* Number Keypad */}
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto w-full my-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        const firstEmpty = enteredPin.findIndex((p) => p === '');
                        if (firstEmpty !== -1) {
                          const next = [...enteredPin];
                          next[firstEmpty] = String(n);
                          setEnteredPin(next);
                        }
                      }}
                      className="h-11 bg-[#F3F6F4] hover:bg-[#DDE3DF] text-[#14201A] font-bold text-lg rounded-xl active:scale-95 transition-transform"
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEnteredPin(['', '', '', ''])}
                    className="h-11 bg-[#F3F6F4] text-xs font-bold text-[#7A857F] rounded-xl active:scale-95"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const firstEmpty = enteredPin.findIndex((p) => p === '');
                      if (firstEmpty !== -1) {
                        const next = [...enteredPin];
                        next[firstEmpty] = '0';
                        setEnteredPin(next);
                      }
                    }}
                    className="h-11 bg-[#F3F6F4] hover:bg-[#DDE3DF] text-[#14201A] font-bold text-lg rounded-xl active:scale-95 transition-transform"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const lastFilled = enteredPin.map((p) => p !== '').lastIndexOf(true);
                      if (lastFilled !== -1) {
                        const next = [...enteredPin];
                        next[lastFilled] = '';
                        setEnteredPin(next);
                      }
                    }}
                    className="h-11 bg-[#F3F6F4] text-sm font-bold text-[#7A857F] rounded-xl active:scale-95"
                  >
                    ⌫
                  </button>
                </div>

                <div className="pt-2">
                  <KerbButton onClick={handleVerifyPin}>
                    Verify PIN & Start Trip &rarr;
                  </KerbButton>
                </div>
              </div>
            </div>
          )}

          {/* D7. TRIP IN PROGRESS */}
          {tripState === 'in_trip' && activeTrip && (
            <div className="flex-1 flex flex-col relative h-full">
              <div className="p-3 bg-white border-b border-[#DDE3DF] shadow-sm flex items-center justify-between z-10">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#0E7C3A]">In Transit</span>
                  <p className="text-sm font-bold text-[#14201A]">{activeTrip.dropoffName}</p>
                </div>
                <span className="text-base font-extrabold text-[#0E7C3A]">₦{activeTrip.fareNaira}</span>
              </div>

              <div className="flex-1 w-full relative z-0">
                <RealLiveMap
                  pickup={{
                    name: activeTrip.pickupName || 'Pick-up',
                    lat: tripPickupCoords[0],
                    lng: tripPickupCoords[1],
                  }}
                  destination={{
                    name: activeTrip.dropoffName || 'Destination',
                    lat: tripDropoffCoords[0],
                    lng: tripDropoffCoords[1],
                  }}
                  stage="dispatch"
                  selectedRide={activeTrip.vehicleCategory || 'keke'}
                />
              </div>

              <div className="p-4 bg-white border-t border-[#DDE3DF] rounded-t-3xl shadow-xl z-10 space-y-3">
                <div className="flex items-center justify-between text-xs text-[#7A857F]">
                  <span className="truncate max-w-[200px]">{activeTrip.pickupName} &rarr; {activeTrip.dropoffName}</span>
                  <span>Max speed: 35 km/h</span>
                </div>

                <KerbButton onClick={handleFinishTrip}>
                  I Have Arrived at Destination &rarr;
                </KerbButton>
              </div>
            </div>
          )}

          {/* D8. COLLECT CASH / BANK TRANSFER */}
          {tripState === 'collect_cash' && activeTrip && (
            <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn text-center overflow-y-auto">
              <div className="pt-6">
                <div className="w-16 h-16 rounded-full bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center mx-auto mb-2 shadow-sm">
                  {activeTrip.paymentStatus === 'transfer_pending' ? (
                    <Bell className="w-8 h-8 text-[#0E7C3A] animate-bounce" />
                  ) : (
                    <Banknote className="w-8 h-8 text-[#0E7C3A]" />
                  )}
                </div>
                <span className="text-xs font-bold uppercase text-[#7A857F]">Trip Finished</span>
                <h2 className="text-xl font-bold text-[#14201A] mt-1 mb-0.5">
                  Collect Payment from Rider
                </h2>
                <p className="text-xs text-[#7A857F] mb-4">
                  {activeTrip.riderName} ({activeTrip.vehicleCategory})
                </p>

                {/* Amount Display */}
                <div className="p-4 bg-[#F3F6F4] rounded-3xl border border-[#DDE3DF] max-w-xs mx-auto mb-4">
                  <span className="text-[10px] font-bold uppercase text-[#7A857F]">
                    {activeTrip.passengers && activeTrip.passengers > 1
                      ? `Total Fare (${activeTrip.passengers} Seats)`
                      : 'Total Fare'}
                  </span>
                  <p className="text-3xl font-black text-[#0E7C3A] my-0.5">₦{activeTrip.fareNaira}</p>
                  {activeTrip.passengers && activeTrip.passengers > 1 && (
                    <p className="text-[11px] text-[#0E7C3A] font-bold">
                      ₦{Math.round(activeTrip.fareNaira / activeTrip.passengers)} per passenger seat
                    </p>
                  )}
                  <p className="text-[10px] text-[#14201A] font-semibold">0% platform commission retained</p>
                </div>

                {/* Real-time Paystack / Transfer Alert Banner */}
                {activeTrip.paymentStatus === 'paystack_paid' ? (
                  <div className="p-4 bg-[#E6F4EC] border-2 border-[#1B9E4B] rounded-2xl mb-4 text-center shadow-md animate-fadeIn">
                    <div className="flex items-center justify-center gap-2 text-[#0E7C3A] font-black text-sm">
                      <CheckCircle className="w-5 h-5 text-[#0E7C3A]" />
                      <span>₦{activeTrip.fareNaira} Paid Online via Paystack!</span>
                    </div>
                    <p className="text-xs text-[#14201A] mt-1 font-semibold">
                      Passenger payment verified &amp; scheduled for settlement to your {driver.bankName || 'registered'} bank account.
                    </p>
                    {activeTrip.paystackReference && (
                      <span className="inline-block mt-1.5 text-[10px] bg-white px-2 py-0.5 rounded font-mono text-[#7A857F]">
                        Ref: {activeTrip.paystackReference}
                      </span>
                    )}
                  </div>
                ) : activeTrip.paymentStatus === 'transfer_pending' ? (
                  <div className="p-4 bg-[#E6F4EC] border-2 border-[#1B9E4B] rounded-2xl mb-4 animate-pulse text-center shadow-md">
                    <div className="flex items-center justify-center gap-2 text-[#0E7C3A] font-extrabold text-sm">
                      <CreditCard className="w-4 h-4 text-[#0E7C3A]" />
                      <span>₦{activeTrip.fareNaira} Transfer Sent by Rider!</span>
                    </div>
                    <p className="text-xs text-[#14201A] mt-1 font-semibold">
                      Please verify your {driver.bankName} alert / SMS, then tap confirm below:
                    </p>
                    {activeTrip.transferReference && (
                      <span className="inline-block mt-1 text-[10px] bg-white px-2 py-0.5 rounded font-mono text-[#7A857F]">
                        Ref: {activeTrip.transferReference}
                      </span>
                    )}
                  </div>
                ) : (
                  /* Option B: Paystack Split Payout Notification or Cash Settlement */
                  <div className="p-3 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] text-xs max-w-xs mx-auto mb-4 text-left">
                    <span className="text-[10px] font-bold uppercase text-[#7A857F] block mb-1">
                      Direct Payout Settlement Account
                    </span>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#14201A]">{driver.bankName || 'Not Connected'}</span>
                      <span className="font-mono font-extrabold text-[#0E7C3A]">
                        {driver.accountNumber ? `******${driver.accountNumber.slice(-4)}` : 'No NUBAN'}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#7A857F] block mt-0.5">{driver.accountName || driver.name}</span>
                    {activeTrip.pendingPaystackReference && (
                      <p className="text-[10px] text-[#0E7C3A] font-bold mt-1.5">
                        Rider opened Paystack online checkout · waiting for confirmation...
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2.5 pt-4">
                {activeTrip.paymentStatus === 'paystack_paid' ? (
                  <div className="space-y-3">
                    <KerbButton onClick={handleFinishPaystackTrip}>
                      ✓ Confirm Online Payment &amp; Go Online →
                    </KerbButton>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCheckPaystackPayment}
                      disabled={checkingPaystack}
                      className="w-full py-2.5 px-3 bg-[#0B1C2C] hover:bg-[#132c45] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${checkingPaystack ? 'animate-spin' : ''}`} />
                      <span>
                        {checkingPaystack
                          ? 'Checking Paystack Status...'
                          : 'Check / Confirm Online Paystack Payment'}
                      </span>
                    </button>
                    {paystackCheckMsg && (
                      <p className="text-[11px] font-semibold text-[#8A5A00] bg-[#FFF8E6] border border-[#F5B800]/40 rounded-lg px-2.5 py-1.5">
                        {paystackCheckMsg}
                      </p>
                    )}
                    <KerbButton onClick={handleConfirmCashCollected}>
                      ✓ Confirm ₦{activeTrip.fareNaira} Physical Cash Received
                    </KerbButton>
                    <button
                      onClick={handleConfirmCashCollected}
                      className="w-full py-2.5 bg-[#E6F4EC] text-[#0E7C3A] font-bold text-xs rounded-xl hover:bg-[#d4edd1] transition-all"
                    >
                      ✓ Mark Completed (Fare Collected)
                    </button>
                    <button
                      onClick={handleConfirmCashCollected}
                      className="text-xs font-bold text-[#D93A3A] hover:underline block mx-auto"
                    >
                      Report: Rider did not pay
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SCREEN TAB: PRE-BOOKINGS / ADVANCE SCHEDULED RIDES */}
      {/* ============================================================== */}
      {activeTab === 'bookings' && (
        <div className="flex-1 flex flex-col bg-white text-neutral-900 p-4 animate-fadeIn overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsSideMenuOpen(true)}
                className="w-9 h-9 rounded-full bg-[#F3F6F4] hover:bg-[#DDE3DF] flex items-center justify-center text-[#14201A] transition-all"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5 text-[#14201A]" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-[#14201A]">Pre-Bookings</h2>
                <p className="text-xs text-[#7A857F]">Advance reservations for {driver.vehicleCategory?.toUpperCase() || 'KEKE'}</p>
              </div>
            </div>
            <button
              onClick={fetchScheduledTrips}
              className="p-2 bg-[#F3F6F4] rounded-full hover:bg-[#E6F4EC] transition-all text-[#0E7C3A]"
              title="Refresh pre-bookings"
            >
              <Zap className="w-4 h-4" />
            </button>
          </div>

          {/* Subtabs: Available vs Claimed */}
          <div className="flex items-center p-1 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] mb-3">
            <button
              onClick={() => setBookingSubTab('available')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                bookingSubTab === 'available'
                  ? 'bg-white text-[#0E7C3A] shadow-sm border border-[#DDE3DF]'
                  : 'text-[#7A857F] hover:text-[#14201A]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Available ({availableBookings.length})</span>
            </button>
            <button
              onClick={() => setBookingSubTab('my_claimed')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                bookingSubTab === 'my_claimed'
                  ? 'bg-white text-[#0E7C3A] shadow-sm border border-[#DDE3DF]'
                  : 'text-[#7A857F] hover:text-[#14201A]'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>My Claimed ({myClaimedBookings.length})</span>
            </button>
          </div>

          {/* Content List */}
          <div className="flex-1 overflow-y-auto space-y-3 pb-4">
            {bookingSubTab === 'available' ? (
              availableBookings.length === 0 ? (
                <div className="text-center py-12 px-4 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF]">
                  <Calendar className="w-12 h-12 text-[#7A857F] mx-auto mb-2 opacity-75" />
                  <p className="text-base font-bold text-[#14201A]">No {driver.vehicleCategory?.toUpperCase() || 'KEKE'} pre-bookings available</p>
                  <p className="text-xs text-[#7A857F] mt-1">
                    When passengers schedule a {driver.vehicleCategory?.toUpperCase() || 'Keke'} ahead, they appear here for you to claim in advance!
                  </p>
                </div>
              ) : (
                availableBookings.map((trip) => (
                  <div
                    key={trip.id}
                    className="p-3.5 bg-white rounded-2xl border border-[#DDE3DF] shadow-xs hover:border-[#0E7C3A] transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold text-[#7A857F]">{trip.id}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F4EC] text-[#0E7C3A] border border-[#0E7C3A]/20">
                        OPEN TO CLAIM
                      </span>
                    </div>

                    {/* Time Pill */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F3F6F4] rounded-lg text-xs font-bold text-[#14201A] mb-2">
                      <Clock className="w-3.5 h-3.5 text-[#0E7C3A]" />
                      <span>{trip.scheduledTime || 'Scheduled Trip'}</span>
                    </div>

                    {/* Route */}
                    <div className="space-y-1 mb-2">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#0E7C3A] shrink-0" />
                        <p className="font-semibold text-[#14201A] truncate">{trip.pickupName}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-sm bg-[#111F18] shrink-0" />
                        <p className="font-semibold text-[#14201A] truncate">{trip.dropoffName}</p>
                      </div>
                    </div>

                    {trip.notes && (
                      <p className="text-[11px] text-[#7A857F] bg-[#F3F6F4] p-2 rounded-lg italic mb-2">
                        &ldquo;{trip.notes}&rdquo;
                      </p>
                    )}

                    <div className="p-2.5 bg-[#F3F6F4] rounded-xl flex items-center justify-between mb-2 text-xs">
                      <div>
                        <span className="text-[10px] text-[#7A857F] font-bold uppercase block">Passenger</span>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-[#14201A]">{trip.riderName}</p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-[#0E7C3A] border border-emerald-200">
                            👥 {trip.passengers || 1} seat{(trip.passengers || 1) > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-[#3E4A43]">{trip.riderPhone}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#DDE3DF]/60 text-xs">
                      <div>
                        <span className="text-[#7A857F] uppercase text-[10px] font-bold block">
                          {trip.vehicleCategory?.toUpperCase()} FARE {trip.passengers && trip.passengers > 1 ? `(${trip.passengers} SEATS)` : ''}
                        </span>
                        <span className="font-black text-[#0E7C3A] text-sm">₦{trip.fareNaira} (100% Yours)</span>
                      </div>

                      <button
                        onClick={() => handleClaimScheduledTrip(trip.id)}
                        className="py-2 px-3.5 bg-[#0E7C3A] text-white rounded-xl text-xs font-bold hover:bg-[#0B6B45] transition-all shadow-sm flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Claim & Accept</span>
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : (
              myClaimedBookings.length === 0 ? (
                <div className="text-center py-12 px-4 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF]">
                  <CheckCircle className="w-12 h-12 text-[#7A857F] mx-auto mb-2 opacity-75" />
                  <p className="text-base font-bold text-[#14201A]">No claimed rides yet</p>
                  <p className="text-xs text-[#7A857F] mt-1">
                    Claim advance bookings from the &ldquo;Available&rdquo; tab to secure guaranteed trips in your schedule.
                  </p>
                </div>
              ) : (
                myClaimedBookings.map((trip) => (
                  <div
                    key={trip.id}
                    className="p-3.5 bg-white rounded-2xl border-2 border-[#0E7C3A] shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold text-[#7A857F]">{trip.id}</span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#0E7C3A] text-white">
                        LOCKED IN YOUR SCHEDULE
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#E6F4EC] rounded-lg text-xs font-bold text-[#0E7C3A] mb-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{trip.scheduledTime || 'Scheduled Trip'}</span>
                    </div>

                    <div className="space-y-1 mb-2">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#0E7C3A] shrink-0" />
                        <p className="font-semibold text-[#14201A] truncate">{trip.pickupName}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-sm bg-[#111F18] shrink-0" />
                        <p className="font-semibold text-[#14201A] truncate">{trip.dropoffName}</p>
                      </div>
                    </div>

                    <div className="p-2.5 bg-[#F3F6F4] rounded-xl flex items-center justify-between mb-3 text-xs">
                      <div>
                        <span className="text-[10px] text-[#7A857F] font-bold uppercase block">Passenger</span>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-[#14201A]">{trip.riderName}</p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-[#0E7C3A] border border-emerald-200">
                            👥 {trip.passengers || 1} seat{(trip.passengers || 1) > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <a
                        href={`tel:${trip.riderPhone}`}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg border border-[#DDE3DF] text-xs font-bold text-[#0E7C3A]"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call</span>
                      </a>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#DDE3DF] text-xs">
                      <span className="font-black text-[#0E7C3A] text-sm">₦{trip.fareNaira}</span>
                      <button
                        onClick={() => handleStartScheduledTrip(trip)}
                        className="py-2 px-4 bg-[#0E7C3A] text-white rounded-xl text-xs font-bold hover:bg-[#0B6B45] transition-all shadow-md flex items-center gap-1.5"
                      >
                        <span>Start Trip to Pick-up →</span>
                      </button>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SCREEN TAB: D9. EARNINGS */}
      {/* ============================================================== */}
      {activeTab === 'earnings' && (
        <div className="flex-1 flex flex-col bg-white text-neutral-900 p-4 animate-fadeIn overflow-y-auto">
          <div className="flex items-center gap-2.5 mb-4">
            <button
              onClick={() => setIsSideMenuOpen(true)}
              className="w-9 h-9 rounded-full bg-[#F3F6F4] hover:bg-[#DDE3DF] flex items-center justify-center text-[#14201A] transition-all"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-[#14201A]" />
            </button>
            <h2 className="text-xl font-bold text-[#14201A]">Driver Earnings</h2>
          </div>

          {/* Segmented Control */}
          <div className="grid grid-cols-2 p-1 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] mb-4">
            <button
              onClick={() => setEarningsPeriod('today')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                earningsPeriod === 'today' ? 'bg-white shadow text-[#0E7C3A]' : 'text-[#7A857F]'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setEarningsPeriod('week')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                earningsPeriod === 'week' ? 'bg-white shadow text-[#0E7C3A]' : 'text-[#7A857F]'
              }`}
            >
              This Week
            </button>
          </div>

          {/* Big Amount Card */}
          <div className="p-6 bg-[#0E7C3A] text-white rounded-3xl mb-4 text-center shadow-md">
            <span className="text-xs uppercase font-bold text-white/80">
              {earningsPeriod === 'today' ? "Today's Total Earned" : "This Week's Total Earned"}
            </span>
            <p className="text-4xl font-black my-1">
              ₦{(earningsPeriod === 'today' ? driverEarnings.todayEarnings : driverEarnings.weekEarnings).toLocaleString()}
            </p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold text-white">
                {(earningsPeriod === 'today' ? driverEarnings.todayTripsCount : driverEarnings.weekTripsCount) || 0} {(earningsPeriod === 'today' ? driverEarnings.todayTripsCount : driverEarnings.weekTripsCount) === 1 ? 'Trip' : 'Trips'}
              </span>
              <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold text-white">
                0% Fee
              </span>
            </div>
          </div>

          {/* Trips Breakdown List */}
          {(() => {
            const periodTrips = driverEarnings.completedTrips.filter((t) => {
              if (earningsPeriod === 'today') {
                if (typeof t.isToday === 'boolean') return t.isToday;
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);
                return new Date(t.completedAt).getTime() >= startOfToday.getTime();
              }
              if (typeof t.isThisWeek === 'boolean') return t.isThisWeek;
              return true;
            });
            return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase text-[#7A857F]">
                    {earningsPeriod === 'today' ? "Today's Completed Trips" : 'This Week Completed Trips'}
                  </h3>
                  <span className="text-[11px] font-bold text-[#0E7C3A]">
                    {periodTrips.length} {earningsPeriod === 'today' ? 'Today' : 'This Week'}
                  </span>
                </div>

                <div className="space-y-2 flex-1">
                  {periodTrips.length === 0 ? (
                    <div className="p-8 text-center bg-[#F8FAF9] rounded-2xl border border-dashed border-[#DDE3DF]">
                      <p className="text-sm font-bold text-[#14201A]">
                        {earningsPeriod === 'today' ? 'No completed trips today yet' : 'No completed trips this week yet'}
                      </p>
                      <p className="text-xs text-[#7A857F] mt-1 max-w-xs mx-auto">
                        When you accept campus rides and complete them, your fares and trip count update here in real time.
                      </p>
                    </div>
                  ) : (
                    periodTrips.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 bg-[#F3F6F4] rounded-xl flex items-center justify-between border border-[#DDE3DF]"
                      >
                        <div>
                          <p className="text-xs font-bold text-[#14201A]">
                            {t.pickupName} &rarr; {t.dropoffName}
                          </p>
                          <span className="text-[10px] text-[#7A857F]">
                            {t.timeFormatted}{t.paymentMethod === 'paystack' ? ' · Paystack Online' : t.paymentMethod === 'cash' ? ' · Cash' : ''}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-[#0E7C3A]">₦{t.fareNaira}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ============================================================== */}
      {/* SCREEN TAB: BANK & DIRECT PAYSTACK PAYOUTS (OPTION B) */}
      {/* ============================================================== */}
      {activeTab === 'wallet' && (
        <div className="flex-1 flex flex-col bg-white text-neutral-900 p-4 animate-fadeIn overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsSideMenuOpen(true)}
                className="w-9 h-9 rounded-full bg-[#F3F6F4] hover:bg-[#DDE3DF] flex items-center justify-center text-[#14201A] transition-all"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5 text-[#14201A]" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-[#14201A]">Bank & Payouts</h2>
                <p className="text-xs text-[#7A857F]">Automated Paystack Split Settlements</p>
              </div>
            </div>
            <button
              onClick={() => {
                fetchBanksList();
                fetchDriverEarnings();
              }}
              className="px-3 py-1.5 bg-[#F3F6F4] border border-[#DDE3DF] rounded-xl text-xs font-bold text-[#0E7C3A] hover:bg-[#E6F4EC]"
            >
              Refresh
            </button>
          </div>

          {/* Option B Architecture Explainer Card */}
          <div className="p-5 bg-gradient-to-br from-[#0E7C3A] to-[#14201A] text-white rounded-3xl mb-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-bold text-white/80">Direct Payouts Active</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold text-[#A3E635] flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-[#A3E635]" /> Paystack Subaccount
              </span>
            </div>
            <h3 className="text-lg font-black my-1">Direct Bank Settlements</h3>
            <p className="text-xs text-white/90 leading-relaxed mb-3">
              Fares paid by riders through Paystack (cards & bank transfers) are automatically split and deposited straight into your Nigerian bank account. No in-app wallet balance to request or withdraw!
            </p>
            <div className="flex items-center justify-between pt-2.5 border-t border-white/20 text-xs">
              <span className="text-white/80">Physical Cash Fares</span>
              <span className="font-bold text-[#A3E635]">100% in your hand</span>
            </div>
          </div>

          {/* Linked Settlement Bank Account Card */}
          <div className="p-4 bg-[#F3F6F4] border border-[#DDE3DF] rounded-2xl mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase text-[#7A857F]">Registered Settlement Bank</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                driver.paystackSubaccountCode ? 'text-[#0E7C3A] bg-[#E6F4EC]' : 'text-[#E69500] bg-[#FFF8E6]'
              }`}>
                {driver.paystackSubaccountCode ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {driver.paystackSubaccountCode ? 'Subaccount Active' : 'Setup Required'}
              </span>
            </div>

            <div className="space-y-1 mb-3">
              <p className="text-sm font-bold text-[#14201A]">{driver.bankName || 'No Bank Linked'}</p>
              <p className="text-xs font-mono font-bold text-[#0E7C3A]">
                {driver.accountNumber ? `******${driver.accountNumber.slice(-4)}` : 'No NUBAN account'}
              </p>
              <p className="text-[11px] text-[#7A857F]">{driver.accountName || driver.name}</p>
              {driver.paystackSubaccountCode && (
                <p className="text-[10px] font-mono text-[#7A857F]">Code: {driver.paystackSubaccountCode}</p>
              )}
            </div>

            <button
              onClick={() => {
                setBankAccountNum(driver.accountNumber || '');
                setSelectedBankCode(driver.bankCode || '058');
                setResolvedAccountName(driver.accountName || '');
                setSubaccountStatusMsg(null);
                setShowBankModal(true);
              }}
              className="w-full py-2.5 bg-[#0E7C3A] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-[#0c6b32] transition-colors flex items-center justify-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{driver.paystackSubaccountCode ? 'Update Settlement Bank Account' : 'Connect Bank for Direct Paystack Payouts'}</span>
            </button>
          </div>

          {/* Settlement Guidelines */}
          <div className="p-4 bg-white border border-[#DDE3DF] rounded-2xl mb-4 space-y-2.5">
            <h4 className="text-xs font-bold uppercase text-[#7A857F]">How Payouts Work</h4>
            <div className="flex items-start gap-2.5 text-xs text-[#14201A]">
              <Banknote className="w-4 h-4 text-[#0E7C3A] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Cash Trips</p>
                <p className="text-[11px] text-[#7A857F]">The rider hands you physical naira notes at drop-off. You tap Confirm Cash on arrival.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#14201A]">
              <CreditCard className="w-4 h-4 text-[#0E7C3A] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Paystack Card & Transfer Trips</p>
                <p className="text-[11px] text-[#7A857F]">Paystack automatically splits the money and pays it directly to your bank account on standard Paystack settlement schedule.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SCREEN TAB: D10. DRIVER PROFILE */}
      {/* ============================================================== */}
      {activeTab === 'profile' && (
        <div className="flex-1 flex flex-col justify-between bg-white text-neutral-900 p-4 animate-fadeIn overflow-y-auto">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <button
                onClick={() => setIsSideMenuOpen(true)}
                className="w-9 h-9 rounded-full bg-[#F3F6F4] hover:bg-[#DDE3DF] flex items-center justify-center text-[#14201A] transition-all"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5 text-[#14201A]" />
              </button>
              <h2 className="text-xl font-bold text-[#14201A]">Driver Profile</h2>
            </div>

            <div className="p-4 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] flex items-center gap-3.5 mb-3">
              <div className="w-14 h-14 rounded-full bg-[#0E7C3A] text-white flex items-center justify-center overflow-hidden shrink-0 border-2 border-white shadow-sm relative">
                <User className="w-7 h-7 text-white" />
                {rawDriverPhoto && (
                  <img
                    src={rawDriverPhoto}
                    alt={driver.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-base font-bold text-[#14201A]">{driver.name}</p>
                  <span className="text-xs font-bold text-[#E69500]">★ {driver.rating}</span>
                </div>
                <p className="text-xs text-[#7A857F]">{driver.phone}</p>
                <div className="mt-1 flex items-center gap-2">
                  <KerbPlateBadge plate={driver.vehiclePlate} />
                  <span className="text-[11px] font-bold text-[#7A857F]">{driver.vehicleModel}</span>
                </div>
              </div>
            </div>

            {/* Edit Profile & Upload Documents Button */}
            <button
              type="button"
              onClick={() => {
                setEditFormData({ ...driver });
                setShowEditProfileModal(true);
              }}
              className="w-full py-3 mb-4 bg-[#0E7C3A] text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm hover:bg-[#0c6b32] transition-colors"
            >
              <Edit3 className="w-4 h-4" /> Edit Profile & Upload Documents
            </button>

            {/* Verification Status & Credentials Checklist */}
            <div className="mb-4">
              <h3 className="text-xs font-bold uppercase text-[#7A857F] mb-2">Credentials & Documents</h3>
              <div className="space-y-2">
                <div className="p-3 bg-[#F3F6F4] rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#0E7C3A]" />
                    <span className="font-semibold text-[#14201A]">Driver Face Photo</span>
                  </div>
                  {hasFacePhoto ? (
                    <span className="text-[11px] font-bold text-[#1B9E4B] flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Uploaded
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-[#D93A3A]">Missing</span>
                  )}
                </div>

                <div className="p-3 bg-[#F3F6F4] rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-[#0E7C3A]" />
                    <span className="font-semibold text-[#14201A]">NIN / Driver License</span>
                  </div>
                  {hasIdCard ? (
                    <span className="text-[11px] font-bold text-[#1B9E4B] flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Uploaded
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-[#D93A3A]">Missing</span>
                  )}
                </div>

                <div className="p-3 bg-[#F3F6F4] rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#0E7C3A]" />
                    <span className="font-semibold text-[#14201A]">Park Membership Card</span>
                  </div>
                  {hasParkCard ? (
                    <span className="text-[11px] font-bold text-[#1B9E4B] flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Uploaded
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-[#D93A3A]">Missing</span>
                  )}
                </div>

                <div className="p-3 bg-[#F3F6F4] rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-[#0E7C3A]" />
                    <span className="font-semibold text-[#14201A]">Vehicle Papers / Photo</span>
                  </div>
                  {hasVehiclePapers ? (
                    <span className="text-[11px] font-bold text-[#1B9E4B] flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Uploaded
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-[#D93A3A]">Missing</span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="p-3.5 bg-white border border-[#DDE3DF] rounded-xl flex items-center justify-between">
                <span className="text-sm font-semibold">Campus Verification</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  driver.isApproved ? 'text-[#1B9E4B] bg-[#E6F4EC]' : 'text-[#E69500] bg-[#FEF3C7]'
                }`}>
                  <CheckCircle className="w-3 h-3" />
                  {driver.isApproved ? 'Verified by Marshal' : 'Pending Verification'}
                </span>
              </div>

              <div className="p-3.5 bg-white border border-[#DDE3DF] rounded-xl flex items-center justify-between">
                <span className="text-sm font-semibold">Residential Area</span>
                <span className="text-xs font-bold text-[#14201A]">
                  {driver.homeArea || 'Gidan Kwanu Village'}
                </span>
              </div>

              <div className="p-3.5 bg-white border border-[#DDE3DF] rounded-xl flex items-center justify-between">
                <span className="text-sm font-semibold">Guarantor / 2nd Phone</span>
                <span className="text-xs font-bold text-[#14201A]">
                  {driver.secondPhone || '+234 812 334 9901'}
                </span>
              </div>

              <div className="p-3.5 bg-white border border-[#DDE3DF] rounded-xl flex items-center justify-between">
                <span className="text-sm font-semibold">Orientation Training</span>
                <span className="text-xs font-bold text-[#1B9E4B] bg-[#E6F4EC] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Passed
                </span>
              </div>

              <div className="p-3.5 bg-white border border-[#DDE3DF] rounded-xl flex items-center justify-between">
                <span className="text-sm font-semibold">Platform Commission</span>
                <span className="text-xs font-bold text-[#0E7C3A]">0% (Pilot Waiver)</span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={onSignOut}
              className="w-full h-14 bg-[#FDE8E8] text-[#D93A3A] font-bold text-sm rounded-2xl border border-[#D93A3A]/30"
            >
              Sign Out of Terminal
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SCREEN TAB: DEDICATED DRIVER INVITE SCREEN */}
      {/* ============================================================== */}
      {activeTab === 'invite' && (
        <div className="flex-1 flex flex-col justify-between bg-white text-neutral-900 p-4 animate-fadeIn overflow-y-auto">
          <div>
            {/* Top Bar with Hamburger & Title */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setIsSideMenuOpen(true)}
                className="w-10 h-10 rounded-full bg-[#F3F6F4] hover:bg-[#DDE3DF] flex items-center justify-center text-[#14201A] transition-all"
                aria-label="Open Menu"
              >
                <Menu className="w-5 h-5 text-[#14201A]" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-[#14201A]">Invite Fellow Drivers</h2>
                <p className="text-[11px] text-[#7A857F]">Grow the FUTMINNA Campus Fleet</p>
              </div>
            </div>

            {/* Hero Card */}
            <div className="text-center mb-5">
              <div className="w-16 h-16 rounded-3xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Car className="w-8 h-8 text-[#0E7C3A]" />
              </div>
              <h3 className="text-lg font-black text-[#14201A] mb-1">
                Recruit Drivers & Lock 0% Commission
              </h3>
              <p className="text-xs text-[#7A857F] max-w-xs mx-auto leading-relaxed">
                Know someone who drives a Keke, Okada, or Cab on campus? Invite them so they keep 100% of student fares without park extortion.
              </p>
            </div>

            {/* Referral Code & Share Link Card */}
            <div className="bg-[#F8FAF9] border border-[#DDE3DF] rounded-2xl p-3.5 mb-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#7A857F] font-semibold">Driver Invite Code</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-[#0E7C3A] bg-[#E6F4EC] px-2.5 py-1 rounded-lg">
                    {driverReferralCode}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(driverReferralCode);
                      setCopiedDriverCode(true);
                      setTimeout(() => setCopiedDriverCode(false), 2500);
                    }}
                    className="px-2.5 py-1 text-xs font-bold bg-white text-[#14201A] rounded-lg border border-[#DDE3DF] hover:bg-[#F3F6F4] flex items-center gap-1 transition-all"
                  >
                    {copiedDriverCode ? <Check className="w-3.5 h-3.5 text-[#1B9E4B]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDriverCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="p-2.5 bg-white border border-[#DDE3DF] rounded-xl flex items-center justify-between font-mono text-[11px] text-[#7A857F] break-all">
                <span className="truncate pr-2">{driverReferralLink}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(driverReferralLink);
                    setCopiedDriverLink(true);
                    setTimeout(() => setCopiedDriverLink(false), 2500);
                  }}
                  className="shrink-0 px-2.5 py-1 bg-[#0E7C3A] text-white text-[11px] font-bold rounded-lg hover:bg-[#0b632e] transition-all flex items-center gap-1"
                >
                  {copiedDriverLink ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3 text-white" />}
                  <span>{copiedDriverLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Live Driver Referral Stats */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="p-3 bg-[#F8FAF9] border border-[#DDE3DF] rounded-2xl text-center">
                <span className="text-[10px] uppercase font-bold text-[#7A857F] block">Invited</span>
                <span className="text-xl font-black text-[#14201A]">
                  {loadingReferralStats ? '...' : driverReferralStats.totalReferrals}
                </span>
                <span className="text-[9px] text-[#7A857F] block">drivers</span>
              </div>
              <div className="p-3 bg-[#E6F4EC] border border-[#0E7C3A]/20 rounded-2xl text-center">
                <span className="text-[10px] uppercase font-bold text-[#0E7C3A] block">Active</span>
                <span className="text-xl font-black text-[#0E7C3A]">
                  {loadingReferralStats ? '...' : driverReferralStats.completedReferrals}
                </span>
                <span className="text-[9px] text-[#0E7C3A] block">first trip done</span>
              </div>
              <div className="p-3 bg-[#F8FAF9] border border-[#DDE3DF] rounded-2xl text-center">
                <span className="text-[10px] uppercase font-bold text-[#7A857F] block">Pending</span>
                <span className="text-xl font-black text-amber-700">
                  {loadingReferralStats ? '...' : driverReferralStats.pendingReferrals}
                </span>
                <span className="text-[9px] text-[#7A857F] block">registered</span>
              </div>
            </div>

            {/* Zero-Cost Rewards & Benefits */}
            <div className="mb-5 text-left">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0E7C3A]">
                  Pioneer Fleet Rewards (Zero-Cost)
                </h4>
                <span className="text-[10px] bg-[#E6F4EC] text-[#0E7C3A] font-bold px-2 py-0.5 rounded-full">
                  100% Earnings
                </span>
              </div>

              <div className="space-y-2">
                <div className="p-3 bg-[#F3F6F4] rounded-2xl flex items-center gap-3 border border-[#DDE3DF]">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#0E7C3A] flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#14201A]">0% Commission Lock-In 🛡️</p>
                      <span className="text-[10px] font-semibold text-[#0E7C3A]">Lifetime Waiver</span>
                    </div>
                    <p className="text-[11px] text-[#7A857F]">You and your referred driver keep 100% of all ride fares</p>
                  </div>
                </div>

                <div className="p-3 bg-[#F3F6F4] rounded-2xl flex items-center gap-3 border border-[#DDE3DF]">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#14201A]">Founding Driver Badge 🎖️</p>
                      <span className="text-[10px] font-semibold text-[#0E7C3A]">Pioneer Badge</span>
                    </div>
                    <p className="text-[11px] text-[#7A857F]">Permanent verified badge displayed on your vehicle card</p>
                  </div>
                </div>

                <div className="p-3 bg-[#F3F6F4] rounded-2xl flex items-center gap-3 border border-[#DDE3DF]">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#14201A]">Priority Park Dispatch ⚡</p>
                      <span className="text-[10px] font-semibold text-[#0E7C3A]">Instant Matching</span>
                    </div>
                    <p className="text-[11px] text-[#7A857F]">Fast-track matching for trip requests at Campus Gates & Motor Park</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality & Safety Protection */}
            <div className="p-3 bg-[#E6F4EC]/60 border border-[#0E7C3A]/20 rounded-2xl text-left mb-4">
              <p className="text-[11px] font-bold text-[#0E7C3A] mb-1">FUTMINNA Driver Verification Rules</p>
              <ul className="text-[10px] text-[#14201A] space-y-0.5 list-disc pl-3.5">
                <li>All referred drivers must pass vehicle and credential inspection at School Motor Park.</li>
                <li>Pioneer perks unlock after the driver completes their first 5 verified trips.</li>
                <li>Zero-cost to you: no cash fees or deductions ever.</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2 pb-1">
            <a
              href={driverWhatsAppInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-13 py-3.5 bg-[#1B9E4B] hover:bg-[#15803d] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <span>Share Driver Invite on WhatsApp</span>
            </a>

            {typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function' && (
              <button
                onClick={async () => {
                  try {
                    await navigator.share({
                      title: 'Drive with Zylift Campus Fleet',
                      text: 'Join Zylift at FUTMINNA Gidan Kwanu. Keep 100% of earnings with 0% commission lock-in.',
                      url: driverReferralLink,
                    });
                  } catch (e) {}
                }}
                className="w-full py-2.5 bg-[#F3F6F4] hover:bg-[#DDE3DF] text-[#14201A] font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                <Share2 className="w-3.5 h-3.5 text-[#0E7C3A]" />
                <span>More Sharing Options (SMS, Telegram)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DRIVER COLLAPSIBLE LEFT-HAND NAVIGATION DRAWER */}
      {/* ============================================================== */}
      {isSideMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            onClick={() => setIsSideMenuOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          />

          {/* Slide Drawer (80% width) */}
          <div className="relative w-[82%] max-w-[310px] h-full bg-white text-neutral-900 shadow-2xl flex flex-col justify-between z-10 animate-slideRight">
            <div>
              {/* Green Header */}
              <div className="bg-[#0E7C3A] p-5 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white flex items-center justify-center text-2xl font-black overflow-hidden shrink-0 shadow-sm relative">
                      <span>{driver.name?.charAt(0)?.toUpperCase() || 'D'}</span>
                      {rawDriverPhoto && (
                        <img
                          src={rawDriverPhoto}
                          alt={driver.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-white truncate leading-tight">
                        {driver.name || 'Campus Driver'}
                      </h3>
                      <p className="text-xs text-white/80 font-mono">
                        {driver.vehiclePlate || 'FUTMINNA FLEET'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSideMenuOpen(false)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                    <span>{driver.rating || 5.0}</span>
                  </span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold capitalize">
                    {driver.vehicleCategory || 'keke'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    isOnline ? 'bg-[#1B9E4B] text-white' : 'bg-white/30 text-white'
                  }`}>
                    {isOnline ? '● Online' : '○ Offline'}
                  </span>
                </div>
              </div>

              {/* Navigation Links */}
              <div className="p-3 space-y-1">
                <button
                  onClick={() => {
                    setActiveTab('home');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl flex items-center gap-3.5 font-semibold text-sm transition-all ${
                    activeTab === 'home'
                      ? 'bg-[#E6F4EC] text-[#0E7C3A] font-bold'
                      : 'hover:bg-[#F3F6F4] text-[#14201A]'
                  }`}
                >
                  <Car className="w-5 h-5 text-[#0E7C3A]" />
                  <span>Terminal (Live Map)</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('bookings');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl flex items-center justify-between font-semibold text-sm transition-all ${
                    activeTab === 'bookings'
                      ? 'bg-[#E6F4EC] text-[#0E7C3A] font-bold'
                      : 'hover:bg-[#F3F6F4] text-[#14201A]'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <Calendar className="w-5 h-5 text-[#0E7C3A]" />
                    <span>Advance Bookings</span>
                  </div>
                  {availableBookings.length > 0 && (
                    <span className="text-[10px] bg-[#0E7C3A] text-white font-bold px-2 py-0.5 rounded-full">
                      {availableBookings.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setActiveTab('earnings');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl flex items-center gap-3.5 font-semibold text-sm transition-all ${
                    activeTab === 'earnings'
                      ? 'bg-[#E6F4EC] text-[#0E7C3A] font-bold'
                      : 'hover:bg-[#F3F6F4] text-[#14201A]'
                  }`}
                >
                  <TrendingUp className="w-5 h-5 text-[#0E7C3A]" />
                  <span>Driver Earnings</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('wallet');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl flex items-center gap-3.5 font-semibold text-sm transition-all ${
                    activeTab === 'wallet'
                      ? 'bg-[#E6F4EC] text-[#0E7C3A] font-bold'
                      : 'hover:bg-[#F3F6F4] text-[#14201A]'
                  }`}
                >
                  <Building2 className="w-5 h-5 text-[#0E7C3A]" />
                  <span>Bank & Payouts</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('profile');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl flex items-center gap-3.5 font-semibold text-sm transition-all ${
                    activeTab === 'profile'
                      ? 'bg-[#E6F4EC] text-[#0E7C3A] font-bold'
                      : 'hover:bg-[#F3F6F4] text-[#14201A]'
                  }`}
                >
                  <User className="w-5 h-5 text-[#0E7C3A]" />
                  <span>Profile & Documents</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('invite');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl flex items-center justify-between font-semibold text-sm transition-all ${
                    activeTab === 'invite'
                      ? 'bg-[#E6F4EC] text-[#0E7C3A] font-bold'
                      : 'hover:bg-[#F3F6F4] text-[#14201A]'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <Gift className="w-5 h-5 text-[#0E7C3A]" />
                    <span>Invite Fellow Drivers</span>
                  </div>
                  <span className="text-[10px] bg-[#E6F4EC] text-[#0E7C3A] font-bold px-2 py-0.5 rounded-full border border-[#0E7C3A]/30">
                    Pioneer
                  </span>
                </button>

                <a
                  href="https://wa.me/message/2ZWD6T2KUU5PK1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full p-3 rounded-xl flex items-center gap-3.5 hover:bg-[#F3F6F4] text-[#14201A] font-semibold text-sm transition-all"
                >
                  <HelpCircle className="w-5 h-5 text-[#0E7C3A]" />
                  <span>Support Desk (WhatsApp)</span>
                </a>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-[#DDE3DF] space-y-2">
              <button
                onClick={() => {
                  setIsSideMenuOpen(false);
                  onSignOut();
                }}
                className="w-full py-3 bg-[#FDE8E8] hover:bg-[#fbd5d5] text-[#D93A3A] text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Terminal</span>
              </button>
              <p className="text-[10px] text-center text-[#7A857F] font-mono">
                Zylift Driver Terminal · FUTMINNA Pilot
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-5 max-w-xs w-full shadow-2xl">
            <h3 className="text-base font-bold mb-2">Cancel Trip</h3>
            <p className="text-xs text-[#7A857F] mb-4">Please select a mandatory reason:</p>

            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-semibold mb-4"
            >
              <option value="Rider not at pickup">Rider not at pickup point</option>
              <option value="Vehicle technical problem">Vehicle technical problem</option>
              <option value="Road blocked on campus">Road blocked on campus</option>
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 bg-[#F3F6F4] text-xs font-bold rounded-xl"
              >
                Back
              </button>
              <button
                onClick={handleCancelActiveTrip}
                className="flex-1 py-2.5 bg-[#D93A3A] text-white text-xs font-bold rounded-xl"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect / Update Bank Account Modal for Paystack Subaccount Split Settlements */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white text-neutral-900 rounded-3xl p-5 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-[#14201A]">Settlement Bank Account</h3>
                <p className="text-[11px] text-[#7A857F]">Direct Paystack Split Payouts</p>
              </div>
              <button
                onClick={() => {
                  setShowBankModal(false);
                  setSubaccountStatusMsg(null);
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              {/* Select Bank */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-[#7A857F] mb-1">
                  Nigerian Commercial or Microfinance Bank
                </label>
                <select
                  value={selectedBankCode}
                  onChange={(e) => {
                    setSelectedBankCode(e.target.value);
                    setResolvedAccountName('');
                    setSubaccountStatusMsg(null);
                  }}
                  className="w-full py-2.5 px-3 bg-[#F3F6F4] border border-[#DDE3DF] rounded-xl text-xs font-bold text-[#14201A] outline-none focus:border-[#0E7C3A]"
                >
                  {banksList.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 10-digit NUBAN */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-[#7A857F] mb-1">
                  10-Digit Account Number (NUBAN)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="0123456789"
                    value={bankAccountNum}
                    onChange={(e) => {
                      setBankAccountNum(e.target.value.replace(/\D/g, '').slice(0, 10));
                      setResolvedAccountName('');
                      setSubaccountStatusMsg(null);
                    }}
                    className="flex-1 py-2.5 px-3 bg-[#F3F6F4] border border-[#DDE3DF] rounded-xl text-sm font-mono font-bold text-[#14201A] outline-none focus:border-[#0E7C3A]"
                  />
                  <button
                    type="button"
                    onClick={handleResolveBankAccount}
                    disabled={isResolvingBank || bankAccountNum.length !== 10}
                    className="px-3 py-2.5 bg-[#E6F4EC] text-[#0E7C3A] hover:bg-[#d2ecd9] disabled:opacity-50 text-xs font-bold rounded-xl transition-all"
                  >
                    {isResolvingBank ? 'Checking...' : 'Verify'}
                  </button>
                </div>
              </div>

              {/* Resolved Name Preview */}
              {resolvedAccountName && (
                <div className="p-2.5 bg-[#E6F4EC] border border-[#1B9E4B] rounded-xl text-left">
                  <span className="text-[10px] font-bold uppercase text-[#0E7C3A] block">Verified Account Name</span>
                  <p className="text-xs font-bold text-[#14201A]">{resolvedAccountName}</p>
                </div>
              )}

              {/* Status Message */}
              {subaccountStatusMsg && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-semibold ${
                    subaccountStatusMsg.type === 'success'
                      ? 'bg-[#E6F4EC] text-[#0E7C3A]'
                      : 'bg-[#FEE2E2] text-[#D93A3A]'
                  }`}
                >
                  {subaccountStatusMsg.text}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowBankModal(false);
                  setSubaccountStatusMsg(null);
                }}
                className="flex-1 py-3 bg-[#F3F6F4] text-xs font-bold text-[#7A857F] rounded-xl hover:bg-[#DDE3DF]"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkPaystackSubaccount}
                disabled={isLinkingSubaccount || bankAccountNum.length !== 10}
                className="flex-1 py-3 bg-[#0E7C3A] text-white text-xs font-bold rounded-xl hover:bg-[#0c6b32] disabled:bg-neutral-300"
              >
                {isLinkingSubaccount ? 'Saving...' : 'Save & Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Gate / Approval Notice Modal */}
      {showApprovalNotice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-[#FEF3C7] text-[#E69500] flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-8 h-8 text-[#E69500]" />
            </div>
            <h3 className="text-lg font-black text-[#14201A] mb-1">Strictly Offline: Approval Required</h3>
            <p className="text-xs text-[#7A857F] mb-4">
              Unverified drivers cannot go online. You will remain strictly offline until an admin or campus marshal approves your credentials.
            </p>
            <div className="p-3.5 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] text-xs text-left mb-4">
              <p className="font-bold text-[#14201A] mb-1.5">Mandatory 4-Box Verification:</p>
              <ul className="text-[11px] text-[#3E4A43] space-y-1.5">
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[#0E7C3A] shrink-0" /> Met in person at School Motor Park
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[#0E7C3A] shrink-0" /> Face matches NIN / Driver's License
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[#0E7C3A] shrink-0" /> Plate matches physical vehicle
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[#0E7C3A] shrink-0" /> Known and cleared by Park Union Leader
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                disabled={isCheckingApproval}
                onClick={async () => {
                  setIsCheckingApproval(true);
                  const latest = await syncDriverStatus();
                  setIsCheckingApproval(false);
                  if (latest && latest.isApproved) {
                    setShowApprovalNotice(false);
                    await handleToggleOnline(true);
                  } else {
                    alert('Your application is currently awaiting in-person review by an Admin or Park Marshal at School Motor Park.');
                  }
                }}
                className="w-full py-3 bg-[#0E7C3A] hover:bg-[#0c6b32] text-white text-xs font-bold rounded-xl shadow flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingApproval ? 'animate-spin' : ''}`} />
                {isCheckingApproval ? 'Checking with Admin...' : 'Check Approval Status & Go Online'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowApprovalNotice(false);
                  setEditFormData({ ...driver });
                  setShowEditProfileModal(true);
                }}
                className="w-full py-2.5 bg-[#F3F6F4] hover:bg-[#DDE3DF] text-[#14201A] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Profile & Upload Documents
              </button>
              <button
                type="button"
                onClick={() => setShowApprovalNotice(false)}
                className="w-full py-2.5 bg-[#F3F6F4] text-[#7A857F] text-xs font-bold rounded-xl hover:bg-[#DDE3DF]"
              >
                Close & Stay Offline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile & Upload Documents Full Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white text-neutral-900 rounded-3xl p-5 max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#DDE3DF]">
              <div>
                <h3 className="text-base font-bold text-[#14201A]">Edit Profile & Credentials</h3>
                <p className="text-[11px] text-[#7A857F]">Update information and re-upload documents for review</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-[#F3F6F4]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hidden File Inputs */}
            <input
              type="file"
              ref={editFaceRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => handleEditDocSelect(e, 'facePhotoUrl')}
            />
            <input
              type="file"
              ref={editIdCardRef}
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => handleEditDocSelect(e, 'idCardPhotoUrl')}
            />
            <input
              type="file"
              ref={editParkCardRef}
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => handleEditDocSelect(e, 'licenseOrParkCardUrl')}
            />
            <input
              type="file"
              ref={editVehiclePapersRef}
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => handleEditDocSelect(e, 'vehiclePapersUrl')}
            />

            {/* Form Fields */}
            <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
              {/* Personal Details */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-bold uppercase text-[#0E7C3A] tracking-wider block">
                  1. Personal Details
                </span>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#7A857F] mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    value={editFormData.name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full p-2.5 bg-[#F3F6F4] border border-[#DDE3DF] rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#7A857F] mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={editFormData.phone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full p-2.5 bg-[#F3F6F4] border border-[#DDE3DF] rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#7A857F] mb-1">Residential Area in Minna</label>
                  <input
                    type="text"
                    value={editFormData.homeArea || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, homeArea: e.target.value })}
                    placeholder="e.g. Gidan Kwanu Village / Bosso / Maitumbi"
                    className="w-full p-2.5 bg-[#F3F6F4] border border-[#DDE3DF] rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#7A857F] mb-1">Guarantor / 2nd Phone</label>
                  <input
                    type="tel"
                    value={editFormData.secondPhone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, secondPhone: e.target.value })}
                    className="w-full p-2.5 bg-[#F3F6F4] border border-[#DDE3DF] rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#7A857F] mb-1">Park Leader / Representative</label>
                  <input
                    type="text"
                    value={editFormData.parkLeaderName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, parkLeaderName: e.target.value })}
                    className="w-full p-2.5 bg-[#F3F6F4] border border-[#DDE3DF] rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Vehicle Information */}
              <div className="space-y-2.5 pt-2 border-t border-[#DDE3DF]">
                <span className="text-[11px] font-bold uppercase text-[#0E7C3A] tracking-wider block">
                  2. Vehicle Information
                </span>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#7A857F] mb-1.5">Category</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['keke', 'okada', 'cab_go', 'small_bus', 'big_bus'] as const).map((cat) => {
                      const isSelected = editFormData.vehicleCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setEditFormData({ ...editFormData, vehicleCategory: cat })}
                          style={
                            isSelected
                              ? {
                                  backgroundColor: '#0E7C3A',
                                  color: '#FFFFFF',
                                  borderColor: '#0E7C3A',
                                  boxShadow: '0 4px 12px rgba(14, 124, 58, 0.35)',
                                }
                              : {
                                  backgroundColor: '#F3F6F4',
                                  color: '#14201A',
                                  borderColor: '#DDE3DF',
                                }
                          }
                          className="py-2 px-2 rounded-xl text-[11px] font-bold capitalize transition-all border-2 flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                        >
                          {isSelected && <Check className="w-3 h-3 text-white shrink-0" />}
                          <span>{cat.replace('_', ' ')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#7A857F] mb-1">License Plate</label>
                    <input
                      type="text"
                      value={editFormData.vehiclePlate || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, vehiclePlate: e.target.value.toUpperCase() })}
                      className="w-full p-2.5 bg-[#F3F6F4] border border-[#DDE3DF] rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#7A857F] mb-1">Make & Model</label>
                    <input
                      type="text"
                      value={editFormData.vehicleModel || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, vehicleModel: e.target.value })}
                      className="w-full p-2.5 bg-[#F3F6F4] border border-[#DDE3DF] rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Uploaded Documents & Credentials */}
              <div className="space-y-2.5 pt-2 border-t border-[#DDE3DF]">
                <span className="text-[11px] font-bold uppercase text-[#0E7C3A] tracking-wider block">
                  3. Uploaded Credentials & Photos
                </span>

                {/* 1. Face Photo */}
                <div
                  onClick={() => editFaceRef.current?.click()}
                  className="p-3 bg-[#F3F6F4] border border-dashed border-[#DDE3DF] hover:border-[#0E7C3A] rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg bg-white overflow-hidden flex items-center justify-center shrink-0 border border-[#DDE3DF] relative">
                      <Camera className="w-4 h-4 text-[#7A857F]" />
                      {editFormData.facePhotoUrl && !String(editFormData.facePhotoUrl).includes('driver_avatar_keke_1790847258442') && (
                        <img
                          src={editFormData.facePhotoUrl}
                          alt="Face Photo"
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-[#14201A]">Driver Face Photo</p>
                      <p className="text-[10px] text-[#1B9E4B]">
                        {editFormData.facePhotoUrl && !String(editFormData.facePhotoUrl).includes('driver_avatar_keke_1790847258442') ? 'Photo attached' : 'Click to upload'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#0E7C3A]">
                    {editFormData.facePhotoUrl && !String(editFormData.facePhotoUrl).includes('driver_avatar_keke_1790847258442') ? 'Replace' : 'Upload'}
                  </span>
                </div>

                {/* 2. NIN / Driver License */}
                <div
                  onClick={() => editIdCardRef.current?.click()}
                  className="p-3 bg-[#F3F6F4] border border-dashed border-[#DDE3DF] hover:border-[#0E7C3A] rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg bg-white overflow-hidden flex items-center justify-center shrink-0 border border-[#DDE3DF]">
                      {editFormData.idCardPhotoUrl ? (
                        <FileCheck className="w-5 h-5 text-[#1B9E4B]" />
                      ) : (
                        <FileText className="w-4 h-4 text-[#7A857F]" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-[#14201A]">NIN / Driver's License</p>
                      <p className="text-[10px] text-[#1B9E4B]">
                        {editFormData.idCardPhotoUrl ? 'Document attached' : 'Click to upload'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#0E7C3A]">
                    {editFormData.idCardPhotoUrl ? 'Replace' : 'Upload'}
                  </span>
                </div>

                {/* 3. Park Membership Card */}
                <div
                  onClick={() => editParkCardRef.current?.click()}
                  className="p-3 bg-[#F3F6F4] border border-dashed border-[#DDE3DF] hover:border-[#0E7C3A] rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg bg-white overflow-hidden flex items-center justify-center shrink-0 border border-[#DDE3DF]">
                      {editFormData.licenseOrParkCardUrl ? (
                        <FileCheck className="w-5 h-5 text-[#1B9E4B]" />
                      ) : (
                        <Shield className="w-4 h-4 text-[#7A857F]" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-[#14201A]">Park Membership Card</p>
                      <p className="text-[10px] text-[#1B9E4B]">
                        {editFormData.licenseOrParkCardUrl ? 'Document attached' : 'Click to upload'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#0E7C3A]">
                    {editFormData.licenseOrParkCardUrl ? 'Replace' : 'Upload'}
                  </span>
                </div>

                {/* 4. Vehicle Papers / Photo */}
                <div
                  onClick={() => editVehiclePapersRef.current?.click()}
                  className="p-3 bg-[#F3F6F4] border border-dashed border-[#DDE3DF] hover:border-[#0E7C3A] rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg bg-white overflow-hidden flex items-center justify-center shrink-0 border border-[#DDE3DF]">
                      {editFormData.vehiclePapersUrl ? (
                        <FileCheck className="w-5 h-5 text-[#1B9E4B]" />
                      ) : (
                        <Car className="w-4 h-4 text-[#7A857F]" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-[#14201A]">Vehicle Papers / Photo</p>
                      <p className="text-[10px] text-[#1B9E4B]">
                        {editFormData.vehiclePapersUrl ? 'Document attached' : 'Click to upload'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#0E7C3A]">
                    {editFormData.vehiclePapersUrl ? 'Replace' : 'Upload'}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[#DDE3DF] space-y-2">
              {profileSaveSuccess && (
                <div className="p-2.5 bg-[#E6F4EC] border border-[#0E7C3A]/30 rounded-xl text-xs font-bold text-[#0E7C3A] flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Profile & credentials saved successfully!
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="flex-1 py-3 bg-[#F3F6F4] text-xs font-bold text-[#7A857F] rounded-xl hover:bg-[#DDE3DF]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="flex-1 py-3 bg-[#0E7C3A] text-white text-xs font-bold rounded-xl hover:bg-[#0c6b32] flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingProfile ? 'Saving Changes...' : 'Save & Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
