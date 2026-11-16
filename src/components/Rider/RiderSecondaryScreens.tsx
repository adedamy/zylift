import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Shield,
  CreditCard,
  HelpCircle,
  Star,
  Gift,
  Settings,
  Car,
  AlertTriangle,
  Phone,
  Building2,
  Banknote,
  CheckCircle,
  ChevronLeft,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Calendar,
  CalendarDays,
  MapPin,
  X,
  ChevronRight,
  ArrowRight,
  Camera,
  Upload,
  Edit3,
  Save,
  UserCheck,
  Mail,
  FileText,
  Send,
  Award,
  Zap,
  Crown,
  Users,
  Share2,
  Search,
  Navigation,
} from 'lucide-react';
import { FUTMINNA_KEY_LOCATIONS } from '../../data/futminnaLocations';
import { KerbButton, KerbCard, KerbStatusChip } from '../Common/KerbComponents';
import { RiderUserProfile } from './RiderOnboarding';
import { RealLiveMap } from '../Map/RealLiveMap';
import { compressImageFile } from '../../utils/imageCompress';

// --- R21: SIDE MENU ---
export const RiderSideMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  user: RiderUserProfile;
  onNavigate: (screen: string) => void;
  onSignOut: () => void;
  onDriveWithUs?: () => void;
}> = ({ isOpen, onClose, user, onNavigate, onSignOut }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
      />

      {/* Slide Drawer (80% width) */}
      <div className="relative w-[80%] max-w-[300px] h-full bg-white shadow-2xl flex flex-col justify-between z-10 animate-slideRight">
        <div>
          {/* Green Header */}
          <div className="bg-[#0E7C3A] p-5 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white flex items-center justify-center text-2xl font-black overflow-hidden shrink-0 shadow-sm relative">
                <span>{user.name.charAt(0)}</span>
                {user.avatarUrl && (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-base leading-snug truncate">{user.name}</p>
                <p className="text-xs text-white/80 truncate">{user.phone}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/20 text-white">
                  {user.category || user.role}
                </span>
              </div>
            </div>
            {user.matricOrStaffId && (
              <p className="text-xs text-white/80 font-mono">ID: {user.matricOrStaffId}</p>
            )}
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1">
            <button
              onClick={() => {
                onNavigate('trips');
                onClose();
              }}
              className="w-full p-3 rounded-xl flex items-center gap-3.5 hover:bg-[#F3F6F4] text-[#14201A] font-semibold text-sm transition-all"
            >
              <Clock className="w-5 h-5 text-[#0E7C3A]" />
              <span>Your Trips</span>
            </button>

            <button
              onClick={() => {
                onNavigate('wallet');
                onClose();
              }}
              className="w-full p-3 rounded-xl flex items-center gap-3.5 hover:bg-[#F3F6F4] text-[#14201A] font-semibold text-sm transition-all"
            >
              <CreditCard className="w-5 h-5 text-[#0E7C3A]" />
              <span>Payment & Rates</span>
            </button>

            <button
              onClick={() => {
                onNavigate('help');
                onClose();
              }}
              className="w-full p-3 rounded-xl flex items-center gap-3.5 hover:bg-[#F3F6F4] text-[#14201A] font-semibold text-sm transition-all"
            >
              <HelpCircle className="w-5 h-5 text-[#0E7C3A]" />
              <span>Help & Support</span>
            </button>

            <button
              onClick={() => {
                onNavigate('survey');
                onClose();
              }}
              className="w-full p-3 rounded-xl flex items-center gap-3.5 hover:bg-[#F3F6F4] text-[#14201A] font-semibold text-sm transition-all"
            >
              <Star className="w-5 h-5 text-[#0E7C3A]" />
              <span>Pilot Feedback Survey</span>
            </button>

            <button
              onClick={() => {
                onNavigate('invite');
                onClose();
              }}
              className="w-full p-3 rounded-xl flex items-center gap-3.5 hover:bg-[#F3F6F4] text-[#14201A] font-semibold text-sm transition-all"
            >
              <Gift className="w-5 h-5 text-[#0E7C3A]" />
              <span>Invite a Friend</span>
            </button>

            <button
              onClick={() => {
                onNavigate('settings');
                onClose();
              }}
              className="w-full p-3 rounded-xl flex items-center gap-3.5 hover:bg-[#F3F6F4] text-[#14201A] font-semibold text-sm transition-all"
            >
              <Settings className="w-5 h-5 text-[#0E7C3A]" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Bottom Sign Out */}
        <div className="p-4 border-t border-[#DDE3DF] space-y-2">
          <button
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="w-full py-2.5 px-3 bg-[#FDE8E8] text-[#D93A3A] font-bold text-xs rounded-xl flex items-center justify-center hover:bg-[#fed7d7] transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

const SCHEDULE_VEHICLE_META: Record<string, { name: string; desc: string }> = {
  okada: { name: 'Okada Bike', desc: '1–2 passengers · Fast solo/duo' },
  keke: { name: 'Keke Napep', desc: '1–5 passengers · Classic tricycle' },
  cab_go: { name: 'Cab Go (Car)', desc: '1–10 passengers · Sedan / Shuttle' },
  small_bus: { name: 'Small Bus (18-Seater)', desc: '8–18 passengers · Group commute' },
  big_bus: { name: 'Big Bus (Campus Coaster)', desc: '19–80 passengers · Mass transit' },
};

// --- R16: TRIPS LIST & ADVANCE TRIP BOOKING ENGINE ---
export const RiderTripsScreen: React.FC<{
  user?: RiderUserProfile;
  onBack: () => void;
  onSelectTrip: (trip: any) => void;
  onBookImmediate?: () => void;
  onTrackActiveTrip?: () => void;
}> = ({ user, onBack, onSelectTrip, onBookImmediate, onTrackActiveTrip }) => {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'history'>('scheduled');
  const [trips, setTrips] = useState<any[]>([]);
  const [scheduledTrips, setScheduledTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states for booking in advance
  const [timingPreset, setTimingPreset] = useState<'1hr' | '3hr' | 'tomorrow_am' | 'tomorrow_pm' | '2days' | '1week' | 'custom'>('1hr');
  const [customDate, setCustomDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [customTime, setCustomTime] = useState('08:00');
  const [pickupPoint, setPickupPoint] = useState(() => ({
    name: FUTMINNA_KEY_LOCATIONS[4]?.name || 'Student Hostels',
    address: FUTMINNA_KEY_LOCATIONS[4]?.address || 'Hostel Village, Gidan Kwanu',
    lat: FUTMINNA_KEY_LOCATIONS[4]?.lat ?? 9.5265,
    lng: FUTMINNA_KEY_LOCATIONS[4]?.lng ?? 6.4430,
  }));
  const [destPoint, setDestPoint] = useState(() => ({
    name: FUTMINNA_KEY_LOCATIONS[0]?.name || 'Main Campus Gate',
    address: FUTMINNA_KEY_LOCATIONS[0]?.address || 'Minna-Bida Road, Gidan Kwanu Entrance',
    lat: FUTMINNA_KEY_LOCATIONS[0]?.lat ?? 9.5375,
    lng: FUTMINNA_KEY_LOCATIONS[0]?.lng ?? 6.4520,
  }));
  const [activeLocPicker, setActiveLocPicker] = useState<'pickup' | 'dropoff' | null>(null);
  const [locSearchQuery, setLocSearchQuery] = useState('');
  const [geocodeResults, setGeocodeResults] = useState<any[]>([]);
  const [isSearchingGeocode, setIsSearchingGeocode] = useState(false);
  const [mapPickerTarget, setMapPickerTarget] = useState<'pickup' | 'dropoff' | null>(null);

  const [vehicleType, setVehicleType] = useState<'keke' | 'okada' | 'cab_go' | 'small_bus' | 'big_bus'>('keke');
  const [scheduledPassengers, setScheduledPassengers] = useState(1);
  const [scheduleQuoteData, setScheduleQuoteData] = useState<{
    distanceKm?: number;
    durationMinutes?: number;
    approximate?: boolean;
    isCampusFlatFare?: boolean;
    quoteToken?: string;
    options?: { category: string; label: string; fareNaira: number; perSeatFare?: number; maxSeats: number }[];
    unavailable?: { category: string; label: string; reason: string }[];
    requiresManualQuote?: boolean;
    error?: string;
  } | null>(null);
  const [isScheduleQuoting, setIsScheduleQuoting] = useState(false);
  const [showScheduleUnavailable, setShowScheduleUnavailable] = useState(false);
  
  // Passenger contact & "Book for a Friend" states
  const [isBookingForFriend, setIsBookingForFriend] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [tripNotes, setTripNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounced geocoding search for Schedule Pickup/Destination
  useEffect(() => {
    const q = locSearchQuery.trim();
    if (!activeLocPicker || q.length < 2) {
      setGeocodeResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setIsSearchingGeocode(true);
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data && Array.isArray(data.results)) {
          setGeocodeResults(data.results);
        }
      } catch {
        // silent
      } finally {
        setIsSearchingGeocode(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [locSearchQuery, activeLocPicker]);

  // Live pricing & eligibility quote for scheduled ride (supports campus flat fares + off-campus coordinates)
  useEffect(() => {
    if (!showScheduleModal) return;
    let isCancelled = false;
    const fetchQuote = async () => {
      setIsScheduleQuoting(true);
      try {
        const res = await fetch('/api/pricing/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pickupName: pickupPoint.name,
            dropoffName: destPoint.name,
            pickupCoords: [pickupPoint.lat, pickupPoint.lng],
            dropoffCoords: [destPoint.lat, destPoint.lng],
            passengers: scheduledPassengers,
          }),
        });
        const data = await res.json();
        if (isCancelled) return;
        setScheduleQuoteData({
          distanceKm: data.distanceKm,
          durationMinutes: data.durationMinutes,
          approximate: data.approximate,
          isCampusFlatFare: data.isCampusFlatFare,
          quoteToken: data.quoteToken,
          options: Array.isArray(data.options) ? data.options : [],
          unavailable: Array.isArray(data.unavailable) ? data.unavailable : [],
          requiresManualQuote: data.requiresManualQuote,
          error: data.error,
        });
        if (Array.isArray(data.options) && data.options.length > 0) {
          setVehicleType((current) =>
            data.options.some((opt: any) => opt.category === current)
              ? current
              : (data.options[0].category as any)
          );
        }
      } catch {
        // silent
      } finally {
        if (!isCancelled) setIsScheduleQuoting(false);
      }
    };
    fetchQuote();
    return () => { isCancelled = true; };
  }, [showScheduleModal, pickupPoint, destPoint, scheduledPassengers]);

  const fetchTripsData = (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    Promise.all([
      fetch('/api/admin/rides').then((r) => r.json()),
      fetch('/api/trips/scheduled').then((r) => r.json()),
    ])
      .then(([ridesData, scheduledData]) => {
        if (ridesData.trips) setTrips(ridesData.trips);
        if (scheduledData.scheduledTrips) setScheduledTrips(scheduledData.scheduledTrips);
      })
      .catch((err) => console.warn('Failed to load trips:', err))
      .finally(() => {
        if (showSpinner) setLoading(false);
      });
  };

  useEffect(() => {
    fetchTripsData(true);
  }, []);

  // Poll scheduled & active trip status so rider sees driver acceptance / PIN immediately if driver starts trip
  useEffect(() => {
    const riderIdentifier = user?.phone || user?.id;
    const interval = setInterval(async () => {
      try {
        fetchTripsData(false);
        if (riderIdentifier && !showScheduleModal && onTrackActiveTrip) {
          const res = await fetch(`/api/trips/active?riderPhone=${encodeURIComponent(riderIdentifier)}`);
          const data = await res.json();
          if (
            data?.activeTrip &&
            ['accepted', 'arriving', 'in_progress', 'arrived_destination'].includes(data.activeTrip.status)
          ) {
            onTrackActiveTrip();
          }
        }
      } catch {
        // silent
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [user?.phone, user?.id, showScheduleModal, onTrackActiveTrip]);

  const getTimingLabel = () => {
    if (timingPreset === '1hr') return 'Today in 1 Hour';
    if (timingPreset === '3hr') return 'Today in 3 Hours';
    if (timingPreset === 'tomorrow_am') return 'Tomorrow at 08:00 AM';
    if (timingPreset === 'tomorrow_pm') return 'Tomorrow at 02:30 PM';
    if (timingPreset === '2days') return 'In 2 Days at 09:00 AM';
    if (timingPreset === '1week') return 'In 1 Week';
    return `${customDate} at ${customTime}`;
  };

  const getVehicleFare = (category?: string) => {
    const cat = category || vehicleType;
    const opt = scheduleQuoteData?.options?.find((o) => o.category === cat);
    if (opt) return opt.fareNaira;
    return 0;
  };

  const filteredScheduleLocations = (() => {
    const q = locSearchQuery.toLowerCase().trim();
    const local = FUTMINNA_KEY_LOCATIONS.filter((loc) =>
      !q ||
      loc.name.toLowerCase().includes(q) ||
      loc.address.toLowerCase().includes(q) ||
      (loc.area && loc.area.toLowerCase().includes(q)) ||
      (loc.lga && loc.lga.toLowerCase().includes(q))
    );
    if (geocodeResults.length === 0) return local;
    const existingNames = new Set(local.map((l) => l.name.toLowerCase()));
    const additional = geocodeResults.filter((sl) => !existingNames.has((sl.name || '').toLowerCase()));
    return [...local, ...additional];
  })();

  const handleCreateScheduledBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scheduleQuoteData?.requiresManualQuote || !(scheduleQuoteData?.options?.length)) {
      alert(scheduleQuoteData?.error || 'Please choose a valid route and eligible vehicle before confirming.');
      return;
    }
    setIsSubmitting(true);

    const timingLabel = getTimingLabel();
    const fare = getVehicleFare();

    const finalRiderName = isBookingForFriend && friendName.trim()
      ? friendName.trim()
      : (user?.name || 'Campus Passenger');

    const finalRiderPhone = isBookingForFriend && friendPhone.trim()
      ? friendPhone.trim()
      : (user?.phone || '+234 816 772 0192');

    const finalNotes = isBookingForFriend && friendName.trim()
      ? `[Booked by ${user?.name || 'Account Holder'} for ${friendName.trim()}] ${tripNotes}`.trim()
      : tripNotes;

    try {
      const token = localStorage.getItem('zylift_rider_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/trips/schedule', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          riderId: user?.id,
          riderName: finalRiderName,
          riderPhone: finalRiderPhone,
          pickupName: pickupPoint.name,
          pickupCoords: [pickupPoint.lat, pickupPoint.lng],
          dropoffName: destPoint.name,
          dropoffCoords: [destPoint.lat, destPoint.lng],
          vehicleCategory: vehicleType,
          passengers: scheduledPassengers,
          fareNaira: fare,
          quoteToken: scheduleQuoteData?.quoteToken || undefined,
          scheduledTime: timingLabel,
          scheduledDate: timingPreset === 'custom' ? customDate : new Date().toISOString().split('T')[0],
          notes: finalNotes,
        }),
      });

      const data = await res.json();
      if (data.success && data.trip) {
        setScheduledTrips((prev) => [data.trip, ...prev]);
        setShowScheduleModal(false);
        setActiveLocPicker(null);
        setMapPickerTarget(null);
        setIsBookingForFriend(false);
        setFriendName('');
        setFriendPhone('');
        setTripNotes('');
        setActiveTab('scheduled');
        setToastMessage(`✓ Ride scheduled for ${timingLabel}! Drivers can now view and claim your trip.`);
        setTimeout(() => setToastMessage(null), 6000);
      } else {
        alert(data.error || 'Could not schedule booking');
      }
    } catch (err: any) {
      alert('Error scheduling trip: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelScheduled = async (tripId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled ride?')) return;
    try {
      const res = await fetch(`/api/trips/${tripId}/cancel-scheduled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by passenger' }),
      });
      const data = await res.json();
      if (data.success) {
        setScheduledTrips((prev) => prev.filter((t) => t.id !== tripId));
        setToastMessage('Trip booking cancelled');
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err: any) {
      alert('Could not cancel trip: ' + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white p-4 animate-fadeIn overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold text-[#14201A] hover:bg-[#E6F4EC] transition-all"
          >
            &larr;
          </button>
          <div>
            <h2 className="text-lg font-bold text-[#14201A]">Your Trips</h2>
            <p className="text-[11px] text-[#7A857F]">Advance bookings & ride history</p>
          </div>
        </div>

        {/* Schedule CTA in header */}
        <button
          onClick={() => setShowScheduleModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0E7C3A] text-white rounded-full text-xs font-bold hover:bg-[#0B6B45] transition-all shadow-sm"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>+ Book Ahead</span>
        </button>
      </div>

      {/* Confirmation Toast */}
      {toastMessage && (
        <div className="mb-3 p-3 bg-[#0E7C3A] text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 shrink-0 text-white" />
          <span className="flex-1">{toastMessage}</span>
        </div>
      )}

      {/* Tabs Switcher: Scheduled vs History */}
      <div className="flex items-center p-1 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] mb-3">
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'scheduled'
              ? 'bg-white text-[#0E7C3A] shadow-sm border border-[#DDE3DF]'
              : 'text-[#7A857F] hover:text-[#14201A]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Scheduled Rides ({scheduledTrips.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-white text-[#0E7C3A] shadow-sm border border-[#DDE3DF]'
              : 'text-[#7A857F] hover:text-[#14201A]'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          <span>Past Trips ({trips.length})</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {loading ? (
          <p className="text-center text-sm text-[#7A857F] py-8">Loading trips...</p>
        ) : activeTab === 'scheduled' ? (
          /* ============================================================== */
          /* SCHEDULED / ADVANCE BOOKINGS TAB */
          /* ============================================================== */
          <div className="space-y-3">
            {/* Advance Booking Hero Banner */}
            <div className="p-3.5 bg-gradient-to-r from-[#0E7C3A] to-[#1B9E4B] text-white rounded-2xl shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white/90 uppercase tracking-wide mb-1">
                    <CalendarDays className="w-4 h-4 text-white" />
                    <span>Advance Campus Rides</span>
                  </div>
                  <h3 className="text-sm font-bold">Book an hour, a day, or a week ahead</h3>
                  <p className="text-[11px] text-white/80 mt-0.5">
                    Drivers see your booking in advance, ensuring on-time pickup with fixed campus pricing.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="mt-3 w-full py-2 bg-white text-[#0E7C3A] rounded-xl text-xs font-bold hover:bg-[#F3F6F4] transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>+ Schedule a New Trip Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {scheduledTrips.length === 0 ? (
              <div className="text-center py-10 px-4 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF]">
                <Calendar className="w-12 h-12 text-[#7A857F] mx-auto mb-2 opacity-80" />
                <p className="text-base font-bold text-[#14201A]">No scheduled trips yet</p>
                <p className="text-xs text-[#7A857F] max-w-[260px] mx-auto mt-1 mb-4">
                  Planning to travel to the park tomorrow, catch morning lectures, or head to the airport? Book in advance!
                </p>
                <div className="flex flex-col gap-2 max-w-[240px] mx-auto">
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="py-2.5 px-4 bg-[#0E7C3A] text-white rounded-xl text-xs font-bold hover:bg-[#0B6B45] transition-all shadow-sm"
                  >
                    + Book a Trip in Advance
                  </button>
                  {onBookImmediate && (
                    <button
                      onClick={onBookImmediate}
                      className="py-2.5 px-4 bg-white text-[#14201A] border border-[#DDE3DF] rounded-xl text-xs font-bold hover:bg-[#F3F6F4] transition-all"
                    >
                      Book Immediate Ride Now
                    </button>
                  )}
                </div>
              </div>
            ) : (
              scheduledTrips.map((sTrip) => (
                <div
                  key={sTrip.id}
                  className="p-3.5 bg-white rounded-2xl border border-[#DDE3DF] shadow-xs hover:border-[#0E7C3A] transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-[#7A857F]">{sTrip.id}</span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                        ['accepted', 'arriving', 'in_progress'].includes(sTrip.status)
                          ? 'bg-[#0E7C3A] text-white border border-[#0E7C3A]'
                          : sTrip.claimedByDriver
                          ? 'bg-[#E6F4EC] text-[#0E7C3A] border border-[#0E7C3A]/30'
                          : 'bg-[#FFF8E6] text-[#E69500] border border-[#E69500]/30'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {sTrip.status === 'accepted'
                        ? 'DRIVER EN ROUTE'
                        : sTrip.status === 'arriving'
                        ? 'DRIVER ARRIVED AT PICK-UP'
                        : sTrip.status === 'in_progress'
                        ? 'TRIP IN PROGRESS'
                        : sTrip.claimedByDriver
                        ? 'DRIVER ASSIGNED'
                        : 'OPEN TO DRIVERS'}
                    </span>
                  </div>

                  {/* Safety PIN + Live Track CTA once driver has started the scheduled ride */}
                  {['accepted', 'arriving', 'in_progress', 'arrived_destination'].includes(sTrip.status) && (
                    <div className="mb-2.5 p-2.5 bg-[#E6F4EC] border border-[#0E7C3A] rounded-xl flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[#0E7C3A] block">
                          Safety Verification PIN
                        </span>
                        <span className="text-lg font-black tracking-widest text-[#14201A]">
                          {sTrip.safetyPin || '----'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => (onTrackActiveTrip ? onTrackActiveTrip() : onBack())}
                        className="px-3 py-2 bg-[#0E7C3A] text-white rounded-xl text-xs font-bold hover:bg-[#0B6B45] shadow-sm cursor-pointer"
                      >
                        Track Live Ride &rarr;
                      </button>
                    </div>
                  )}

                  {/* Timing badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F3F6F4] rounded-lg text-xs font-bold text-[#14201A] mb-2.5">
                    <Clock className="w-3.5 h-3.5 text-[#0E7C3A]" />
                    <span>{sTrip.scheduledTime || 'Scheduled Trip'}</span>
                  </div>

                  {/* Route */}
                  <div className="space-y-1 mb-2">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0E7C3A] shrink-0" />
                      <p className="font-semibold text-[#14201A] truncate">{sTrip.pickupName}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-sm bg-[#111F18] shrink-0" />
                      <p className="font-semibold text-[#14201A] truncate">{sTrip.dropoffName}</p>
                    </div>
                  </div>

                  {sTrip.notes && (
                    <p className="text-[11px] text-[#7A857F] bg-[#F3F6F4] p-2 rounded-lg italic mb-2">
                      &ldquo;{sTrip.notes}&rdquo;
                    </p>
                  )}

                  {/* Driver Assignment details */}
                  {sTrip.claimedByDriver ? (
                    <div className="p-2 bg-[#E6F4EC] rounded-xl flex items-center justify-between mb-2 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#0E7C3A]">Assigned Driver</span>
                        <p className="font-bold text-[#14201A]">{sTrip.claimedByDriver.name}</p>
                      </div>
                      <a
                        href={`tel:${sTrip.claimedByDriver.phone}`}
                        className="px-2.5 py-1 bg-[#0E7C3A] text-white rounded-lg text-xs font-bold hover:bg-[#0B6B45]"
                      >
                        Call Driver
                      </a>
                    </div>
                  ) : (
                    <div className="p-2 bg-[#FFF8E6] rounded-xl text-[11px] text-[#E69500] font-semibold mb-2">
                      Visible on Driver Pre-Booking boards. Auto-dispatches 20 mins before pickup.
                    </div>
                  )}

                  {/* Bottom bar with price & cancel */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#DDE3DF]/60 text-xs">
                    <div>
                      <span className="text-[#7A857F] uppercase text-[10px] font-bold block">
                        {sTrip.vehicleCategory?.toUpperCase()} FARE
                      </span>
                      <span className="font-black text-[#0E7C3A] text-sm">₦{sTrip.fareNaira} Fixed</span>
                    </div>

                    <button
                      onClick={() => handleCancelScheduled(sTrip.id)}
                      className="px-2.5 py-1 text-xs text-[#D93A3A] hover:bg-[#FDE8E8] rounded-lg font-semibold transition-all"
                    >
                      Cancel Booking
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* ============================================================== */
          /* PAST TRIPS HISTORY TAB */
          /* ============================================================== */
          <div className="space-y-3">
            {trips.length === 0 ? (
              <div className="text-center py-12">
                <Car className="w-12 h-12 text-[#7A857F] mx-auto mb-2" />
                <p className="text-base font-bold text-[#14201A]">No past trips yet</p>
                <p className="text-xs text-[#7A857F] mb-3">Book your first campus ride on Zylift</p>
                {onBookImmediate && (
                  <button
                    onClick={onBookImmediate}
                    className="py-2 px-4 bg-[#0E7C3A] text-white rounded-xl text-xs font-bold"
                  >
                    Book a Ride Now
                  </button>
                )}
              </div>
            ) : (
              trips.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => onSelectTrip(trip)}
                  className="p-3.5 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] cursor-pointer hover:border-[#0E7C3A] transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-[#7A857F]">{trip.id}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        trip.status === 'completed'
                          ? 'bg-[#E6F4EC] text-[#1B9E4B]'
                          : trip.status === 'cancelled'
                          ? 'bg-[#FDE8E8] text-[#D93A3A]'
                          : 'bg-[#FFF8E6] text-[#E69500]'
                      }`}
                    >
                      {trip.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#14201A] truncate">
                    {trip.pickupName} &rarr; {trip.dropoffName}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#DDE3DF]/60 text-xs">
                    <span className="text-[#7A857F]">{new Date(trip.createdAt).toLocaleDateString()}</span>
                    <span className="font-extrabold text-[#0E7C3A]">₦{trip.fareNaira}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* INTERACTIVE MODAL: BOOK A RIDE IN ADVANCE */}
      {/* ============================================================== */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-[#DDE3DF]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#DDE3DF] flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#14201A]">Schedule a Ride</h3>
                  <p className="text-xs text-[#7A857F]">Book 1 hr, 1 day, or 1 week ahead</p>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="w-8 h-8 rounded-full bg-[#F3F6F4] flex items-center justify-center text-[#7A857F] hover:bg-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleCreateScheduledBooking} className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 1. Timing Options */}
              <div>
                <label className="text-xs font-bold text-[#14201A] uppercase tracking-wide block mb-1.5">
                  1. When do you need the ride?
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[
                    { id: '1hr', label: 'In 1 Hour' },
                    { id: '3hr', label: 'In 3 Hours' },
                    { id: 'tomorrow_am', label: 'Tomorrow 08:00 AM' },
                    { id: 'tomorrow_pm', label: 'Tomorrow 02:30 PM' },
                    { id: '2days', label: 'In 2 Days' },
                    { id: '1week', label: 'In 1 Week' },
                  ].map((preset) => {
                    const isSelected = timingPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setTimingPreset(preset.id as any)}
                        style={{
                          backgroundColor: isSelected ? '#0E7C3A' : '#F3F6F4',
                          color: isSelected ? '#FFFFFF' : '#14201A',
                          border: isSelected ? '2px solid #0E7C3A' : '1.5px solid #DDE3DF',
                          boxShadow: isSelected ? '0 4px 12px rgba(14, 124, 58, 0.35)' : 'none',
                        }}
                        className="p-3 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer"
                      >
                        <span className="font-bold">{preset.label}</span>
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-white text-[#0E7C3A] flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                            ✓
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-[#DDE3DF]" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setTimingPreset('custom')}
                  style={{
                    backgroundColor: timingPreset === 'custom' ? '#0E7C3A' : '#FFFFFF',
                    color: timingPreset === 'custom' ? '#FFFFFF' : '#3E4A43',
                    border: timingPreset === 'custom' ? '2px solid #0E7C3A' : '1.5px solid #DDE3DF',
                    boxShadow: timingPreset === 'custom' ? '0 4px 12px rgba(14, 124, 58, 0.35)' : 'none',
                  }}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Pick Custom Date & Time</span>
                  {timingPreset === 'custom' && (
                    <span className="w-4 h-4 rounded-full bg-white text-[#0E7C3A] flex items-center justify-center font-bold text-[10px] ml-1">
                      ✓
                    </span>
                  )}
                </button>

                {timingPreset === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 mt-2 p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF]">
                    <div>
                      <span className="text-[10px] font-bold text-[#7A857F] block mb-1">Date:</span>
                      <input
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="w-full p-2 bg-white rounded-lg border border-[#DDE3DF] text-xs font-bold text-[#14201A]"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-[#7A857F] block mb-1">Time:</span>
                      <input
                        type="time"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        className="w-full p-2 bg-white rounded-lg border border-[#DDE3DF] text-xs font-bold text-[#14201A]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Pick-up Point (Search any address OR Pick on Map) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#14201A] uppercase tracking-wide">
                    2. Pick-up Point
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveLocPicker(null);
                      setMapPickerTarget('pickup');
                    }}
                    className="text-[11px] font-bold text-[#0E7C3A] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Pick on Map</span>
                  </button>
                </div>

                <div
                  onClick={() => {
                    if (activeLocPicker === 'pickup') {
                      setActiveLocPicker(null);
                    } else {
                      setLocSearchQuery('');
                      setGeocodeResults([]);
                      setActiveLocPicker('pickup');
                    }
                  }}
                  className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] flex items-center justify-between cursor-pointer hover:border-[#0E7C3A] transition-all"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-[#14201A] truncate">{pickupPoint.name}</p>
                    <p className="text-[10px] text-[#7A857F] truncate">
                      {pickupPoint.address || `${pickupPoint.lat.toFixed(4)}, ${pickupPoint.lng.toFixed(4)}`}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-[#0E7C3A] shrink-0">
                    {activeLocPicker === 'pickup' ? 'Close' : 'Search / Change'}
                  </span>
                </div>

                {activeLocPicker === 'pickup' && (
                  <div className="mt-2 p-2.5 bg-white rounded-xl border-2 border-[#0E7C3A]/30 shadow-sm space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#7A857F] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        autoFocus
                        value={locSearchQuery}
                        onChange={(e) => setLocSearchQuery(e.target.value)}
                        placeholder="Search campus gate, Bosso, Chanchaga, Minna, or any place..."
                        className="w-full p-2 pl-8 bg-[#F3F6F4] rounded-lg border border-[#DDE3DF] text-xs text-[#14201A] outline-none focus:border-[#0E7C3A]"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-[#F3F6F4]">
                      {isSearchingGeocode && (
                        <p className="text-[11px] text-[#7A857F] py-2 px-1">Searching places...</p>
                      )}
                      {filteredScheduleLocations.length === 0 && !isSearchingGeocode ? (
                        <p className="text-[11px] text-[#7A857F] py-2 px-1">
                          No match found. Try another name or tap &ldquo;Pick on Map&rdquo;.
                        </p>
                      ) : (
                        filteredScheduleLocations.map((loc: any) => (
                          <button
                            key={loc.id || loc.name}
                            type="button"
                            onClick={() => {
                              setPickupPoint({
                                name: loc.name,
                                address: loc.address || loc.area || 'Minna',
                                lat: loc.lat,
                                lng: loc.lng,
                              });
                              setActiveLocPicker(null);
                              setLocSearchQuery('');
                            }}
                            className="w-full py-2 px-1.5 text-left flex items-center gap-2 hover:bg-[#F3F6F4] rounded-lg cursor-pointer"
                          >
                            <Navigation className="w-3.5 h-3.5 text-[#0E7C3A] shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#14201A] truncate">{loc.name}</p>
                              <p className="text-[10px] text-[#7A857F] truncate">
                                {loc.address || loc.area || loc.lga || 'Minna'}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Destination (Search any address OR Pick on Map) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#14201A] uppercase tracking-wide">
                    3. Destination
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveLocPicker(null);
                      setMapPickerTarget('dropoff');
                    }}
                    className="text-[11px] font-bold text-[#0E7C3A] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Pick on Map</span>
                  </button>
                </div>

                <div
                  onClick={() => {
                    if (activeLocPicker === 'dropoff') {
                      setActiveLocPicker(null);
                    } else {
                      setLocSearchQuery('');
                      setGeocodeResults([]);
                      setActiveLocPicker('dropoff');
                    }
                  }}
                  className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] flex items-center justify-between cursor-pointer hover:border-[#0E7C3A] transition-all"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-[#14201A] truncate">{destPoint.name}</p>
                    <p className="text-[10px] text-[#7A857F] truncate">
                      {destPoint.address || `${destPoint.lat.toFixed(4)}, ${destPoint.lng.toFixed(4)}`}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-[#0E7C3A] shrink-0">
                    {activeLocPicker === 'dropoff' ? 'Close' : 'Search / Change'}
                  </span>
                </div>

                {activeLocPicker === 'dropoff' && (
                  <div className="mt-2 p-2.5 bg-white rounded-xl border-2 border-[#0E7C3A]/30 shadow-sm space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#7A857F] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        autoFocus
                        value={locSearchQuery}
                        onChange={(e) => setLocSearchQuery(e.target.value)}
                        placeholder="Search off-campus or campus destination..."
                        className="w-full p-2 pl-8 bg-[#F3F6F4] rounded-lg border border-[#DDE3DF] text-xs text-[#14201A] outline-none focus:border-[#0E7C3A]"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-[#F3F6F4]">
                      {isSearchingGeocode && (
                        <p className="text-[11px] text-[#7A857F] py-2 px-1">Searching places...</p>
                      )}
                      {filteredScheduleLocations.length === 0 && !isSearchingGeocode ? (
                        <p className="text-[11px] text-[#7A857F] py-2 px-1">
                          No match found. Try another name or tap &ldquo;Pick on Map&rdquo;.
                        </p>
                      ) : (
                        filteredScheduleLocations.map((loc: any) => (
                          <button
                            key={loc.id || loc.name}
                            type="button"
                            onClick={() => {
                              setDestPoint({
                                name: loc.name,
                                address: loc.address || loc.area || 'Minna',
                                lat: loc.lat,
                                lng: loc.lng,
                              });
                              setActiveLocPicker(null);
                              setLocSearchQuery('');
                            }}
                            className="w-full py-2 px-1.5 text-left flex items-center gap-2 hover:bg-[#F3F6F4] rounded-lg cursor-pointer"
                          >
                            <Navigation className="w-3.5 h-3.5 text-[#0E7C3A] shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#14201A] truncate">{loc.name}</p>
                              <p className="text-[10px] text-[#7A857F] truncate">
                                {loc.address || loc.area || loc.lga || 'Minna'}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Passenger Seats Counter (supports direct typed input + +/-) */}
              <div className="p-3 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-[#14201A] block">
                    4. Passenger Seats (Per Head Shuttle)
                  </span>
                  <span className="text-[10px] text-[#7A857F]">
                    {scheduledPassengers} seat{scheduledPassengers > 1 ? 's' : ''} requested (1–80, excluding driver)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setScheduledPassengers((p) => Math.max(1, p - 1))}
                    disabled={scheduledPassengers <= 1}
                    className="w-8 h-8 rounded-xl bg-white border border-[#DDE3DF] text-[#14201A] font-bold text-sm flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={80}
                    inputMode="numeric"
                    value={scheduledPassengers}
                    onChange={(e) => {
                      const raw = parseInt(e.target.value, 10);
                      if (Number.isNaN(raw)) {
                        setScheduledPassengers(1);
                      } else {
                        setScheduledPassengers(Math.max(1, Math.min(80, raw)));
                      }
                    }}
                    className="w-12 h-8 text-center text-sm font-black text-[#0E7C3A] bg-white border border-[#DDE3DF] rounded-xl outline-none focus:border-[#0E7C3A]"
                    aria-label="Scheduled passenger seat count"
                  />
                  <button
                    type="button"
                    onClick={() => setScheduledPassengers((p) => Math.min(80, p + 1))}
                    disabled={scheduledPassengers >= 80}
                    className="w-8 h-8 rounded-xl bg-white border border-[#DDE3DF] text-[#14201A] font-bold text-sm flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 5. Dynamic Eligible Vehicle Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#14201A] uppercase tracking-wide">
                    5. Available Vehicles
                  </label>
                  {scheduleQuoteData && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F4EC] text-[#0E7C3A]">
                      {scheduleQuoteData.isCampusFlatFare
                        ? 'Campus Fixed Fare'
                        : scheduleQuoteData.distanceKm !== undefined
                        ? `${scheduleQuoteData.approximate ? '~' : ''}${scheduleQuoteData.distanceKm} km · ~${scheduleQuoteData.durationMinutes} min`
                        : 'Distance Pricing'}
                    </span>
                  )}
                </div>

                {isScheduleQuoting ? (
                  <div className="p-4 bg-[#F3F6F4] rounded-xl text-center text-xs text-[#7A857F]">
                    Calculating live route pricing & eligible vehicles...
                  </div>
                ) : scheduleQuoteData?.requiresManualQuote ? (
                  <div className="p-3 bg-[#FFF8E6] border border-[#E69500]/40 rounded-xl text-xs text-[#8A5A00] font-semibold">
                    {scheduleQuoteData.error || 'This route exceeds the automatic distance limit. Please pick a closer location.'}
                  </div>
                ) : (scheduleQuoteData?.options?.length || 0) === 0 ? (
                  <div className="p-3 bg-[#FDE8E8] border border-[#D93A3A]/30 rounded-xl text-xs text-[#D93A3A] font-semibold">
                    {scheduleQuoteData?.error || `No single vehicle supports ${scheduledPassengers} seats on this route.`}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {(scheduleQuoteData?.options || []).map((opt) => {
                      const isSelected = vehicleType === opt.category;
                      const meta = SCHEDULE_VEHICLE_META[opt.category] || {
                        name: opt.label,
                        desc: `Up to ${opt.maxSeats} seats`,
                      };
                      const fare = opt.fareNaira;
                      const perSeat = opt.perSeatFare ?? Math.round(fare / Math.max(1, scheduledPassengers));
                      return (
                        <button
                          key={opt.category}
                          type="button"
                          onClick={() => setVehicleType(opt.category as any)}
                          style={{
                            backgroundColor: isSelected ? '#0E7C3A' : '#F3F6F4',
                            color: isSelected ? '#FFFFFF' : '#14201A',
                            border: isSelected ? '2px solid #0E7C3A' : '1.5px solid #DDE3DF',
                            boxShadow: isSelected ? '0 4px 12px rgba(14, 124, 58, 0.35)' : 'none',
                          }}
                          className="p-3 rounded-xl transition-all text-left flex flex-col justify-between cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold">{meta.name}</span>
                            {isSelected ? (
                              <div className="w-4 h-4 rounded-full bg-white text-[#0E7C3A] flex items-center justify-center font-bold text-[10px] shadow-sm">
                                ✓
                              </div>
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-[#DDE3DF]" />
                            )}
                          </div>
                          <p className={`text-[10px] ${isSelected ? 'text-white/90' : 'text-[#7A857F]'}`}>
                            {meta.desc}
                          </p>
                          <div className="mt-1.5">
                            <span className={`text-xs font-extrabold block ${isSelected ? 'text-white' : 'text-[#0E7C3A]'}`}>
                              ₦{fare.toLocaleString()}
                            </span>
                            {scheduledPassengers > 1 && (
                              <span className={`text-[9px] block ${isSelected ? 'text-white/80' : 'text-[#7A857F]'}`}>
                                ₦{perSeat.toLocaleString()}/seat × {scheduledPassengers}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {scheduleQuoteData?.unavailable && scheduleQuoteData.unavailable.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setShowScheduleUnavailable((v) => !v)}
                      className="text-[11px] font-semibold text-[#7A857F] hover:text-[#14201A] underline cursor-pointer"
                    >
                      {showScheduleUnavailable
                        ? 'Hide unavailable vehicles'
                        : `Why are ${scheduleQuoteData.unavailable.length} vehicle(s) hidden?`}
                    </button>
                    {showScheduleUnavailable && (
                      <div className="mt-1.5 p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] space-y-1">
                        {scheduleQuoteData.unavailable.map((u) => (
                          <p key={u.category} className="text-[10px] text-[#3E4A43]">
                            <span className="font-bold">{u.label}:</span> {u.reason}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 6. Passenger Contact & Luggage Notes */}
              <div>
                <label className="text-xs font-bold text-[#14201A] uppercase tracking-wide block mb-1">
                  6. Contact & Trip Notes
                </label>

                {/* Verified Account Phone Badge (Zero Typing) */}
                {!isBookingForFriend ? (
                  <div className="p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center font-bold text-xs shrink-0">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#14201A]">{user?.name || 'Campus Passenger'}</span>
                          <span className="text-[10px] bg-[#E6F4EC] text-[#0E7C3A] font-bold px-1.5 py-0.5 rounded-full">
                            Verified
                          </span>
                        </div>
                        <p className="text-[11px] text-[#7A857F] font-mono">
                          {user?.phone || '+234 816 772 0192'} &bull; Driver will call this number
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBookingForFriend(true)}
                      className="text-[11px] font-bold text-[#0E7C3A] hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Book for friend</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-[#F9FAF9] rounded-xl border-2 border-[#0E7C3A]/30 mb-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0E7C3A] flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" />
                        Booking for a friend / alternate contact
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsBookingForFriend(false);
                          setFriendName('');
                          setFriendPhone('');
                        }}
                        className="text-[11px] font-bold text-[#7A857F] hover:text-[#D93A3A] cursor-pointer"
                      >
                        Cancel & Use my number
                      </button>
                    </div>
                    <input
                      type="text"
                      value={friendName}
                      onChange={(e) => setFriendName(e.target.value)}
                      placeholder="Friend's full name (e.g. Samuel Okafor)"
                      className="w-full p-2.5 bg-white rounded-lg border border-[#DDE3DF] text-xs font-medium text-[#14201A] outline-none focus:border-[#0E7C3A]"
                      required
                    />
                    <input
                      type="tel"
                      value={friendPhone}
                      onChange={(e) => setFriendPhone(e.target.value)}
                      placeholder="Friend's phone number (+234 800 000 0000)"
                      className="w-full p-2.5 bg-white rounded-lg border border-[#DDE3DF] text-xs font-medium text-[#14201A] outline-none focus:border-[#0E7C3A]"
                      required
                    />
                  </div>
                )}

                <input
                  type="text"
                  value={tripNotes}
                  onChange={(e) => setTripNotes(e.target.value)}
                  placeholder="Optional notes: e.g. Traveling with 2 heavy travel bags"
                  className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs text-[#14201A] outline-none focus:border-[#0E7C3A]"
                />
              </div>

              {/* Guarantee & Fare Summary */}
              <div className="p-3 bg-[#E6F4EC] rounded-2xl border border-[#0E7C3A]/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#0E7C3A] block">
                    {scheduleQuoteData?.isCampusFlatFare
                      ? scheduledPassengers > 1
                        ? `Campus Shuttle (${scheduledPassengers} Seats)`
                        : 'Fixed Campus Fare'
                      : `Route Fare (${scheduledPassengers} Seat${scheduledPassengers > 1 ? 's' : ''})`}
                  </span>
                  <span className="text-base font-black text-[#0E7C3A]">
                    {isScheduleQuoting ? 'Calculating...' : `₦${getVehicleFare().toLocaleString()}`}
                  </span>
                  <span className="text-[10px] text-[#3E4A43] block">
                    {scheduledPassengers > 1 && getVehicleFare() > 0
                      ? `₦${Math.round(getVehicleFare() / scheduledPassengers).toLocaleString()} per seat · 0% surge`
                      : 'Guaranteed arrival & 0% surge'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#7A857F] block">Pickup Time</span>
                  <span className="text-xs font-bold text-[#14201A]">{getTimingLabel()}</span>
                </div>
              </div>

              {/* Confirm Button */}
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  isScheduleQuoting ||
                  Boolean(scheduleQuoteData?.requiresManualQuote) ||
                  !(scheduleQuoteData?.options?.length)
                }
                className="w-full py-3.5 bg-[#0E7C3A] text-white rounded-2xl font-bold text-sm hover:bg-[#0B6B45] transition-all shadow-md disabled:opacity-50"
              >
                {isSubmitting ? 'Confirming Booking...' : 'Confirm Advance Booking →'}
              </button>
            </form>
          </div>

          {/* Interactive Map Picker Overlay for Schedule Modal */}
          {mapPickerTarget && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
              <div className="w-full max-w-[420px] h-[82vh] bg-white rounded-3xl overflow-hidden flex flex-col shadow-2xl">
                <div className="p-3 bg-[#0E7C3A] text-white flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide">
                      Select {mapPickerTarget === 'pickup' ? 'Pick-up Point' : 'Destination'} on Map
                    </p>
                    <p className="text-[11px] text-white/90">
                      Tap anywhere on the map, then tap &ldquo;Set as {mapPickerTarget === 'pickup' ? 'Pick-up Point' : 'Destination'}&rdquo;
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMapPickerTarget(null)}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
                <div className="flex-1 relative">
                  <RealLiveMap
                    pickup={{ name: pickupPoint.name, lat: pickupPoint.lat, lng: pickupPoint.lng }}
                    destination={{ name: destPoint.name, lat: destPoint.lat, lng: destPoint.lng }}
                    stage="choose"
                    onSelectPickup={(loc) => {
                      setPickupPoint({
                        name: loc.title,
                        address: loc.detail || 'Pinned Pick-up Point',
                        lat: loc.lat,
                        lng: loc.lng,
                      });
                      if (mapPickerTarget === 'pickup') setMapPickerTarget(null);
                    }}
                    onSelectDestination={(loc) => {
                      setDestPoint({
                        name: loc.title,
                        address: loc.detail || 'Pinned Destination',
                        lat: loc.lat,
                        lng: loc.lng,
                      });
                      if (mapPickerTarget === 'dropoff') setMapPickerTarget(null);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- R17: SAFETY CENTRE ---
export const RiderSafetyScreen: React.FC<{
  onBack: () => void;
}> = ({ onBack }) => {
  return (
    <div className="flex-1 flex flex-col bg-white p-4 animate-fadeIn">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold"
        >
          &larr;
        </button>
        <h2 className="text-lg font-bold text-[#14201A]">Safety Centre</h2>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {/* Emergency Alert Card */}
        <div className="p-4 bg-[#FDE8E8] border border-[#D93A3A]/30 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#D93A3A]" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#D93A3A]">Campus Emergency Line</p>
              <p className="text-xs text-[#7A857F]">Direct contact with FUTMINNA Security Cadets</p>
            </div>
          </div>
          <a
            href="tel:+2348036120041"
            className="w-full mt-2 py-3 bg-[#D93A3A] hover:bg-[#b52b2b] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow"
          >
            <Phone className="w-4 h-4 text-white" />
            <span>Call Security: +234 803 612 0041</span>
          </a>
        </div>

        {/* University Clinic */}
        <div className="p-4 bg-[#F3F6F4] border border-[#DDE3DF] rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-[#DDE3DF]">
              <Building2 className="w-6 h-6 text-[#0E7C3A]" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#14201A]">FUTMINNA Health Clinic</p>
              <p className="text-xs text-[#7A857F]">University Medical Centre, Gidan Kwanu</p>
            </div>
          </div>
          <a
            href="tel:+2348059182234"
            className="w-full mt-2 py-2.5 bg-white text-[#14201A] border border-[#DDE3DF] rounded-xl font-bold text-xs flex items-center justify-center gap-2"
          >
            <span>Call Clinic: +234 805 918 2234</span>
          </a>
        </div>

        {/* 4 Safety Guarantees */}
        <div className="p-4 bg-[#E6F4EC]/50 border border-[#0E7C3A]/20 rounded-2xl space-y-2">
          <p className="text-xs font-bold uppercase text-[#0E7C3A]">Pilot Safety Standards</p>
          <ul className="text-xs text-[#3E4A43] space-y-1.5 list-disc pl-4">
            <li>Every driver is verified in-person by Park Marshals.</li>
            <li>Rides must be started with your secret 4-digit PIN.</li>
            <li>Live GPS tracking enabled across campus ring road.</li>
            <li>Fixed pricing avoids road disputes.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// --- R18: PASSENGER PAYMENT METHODS & CAMPUS FARES (ZERO CUSTODIAL RISK) ---
export const RiderWalletScreen: React.FC<{
  onBack: () => void;
  user?: RiderUserProfile;
}> = ({ onBack }) => {
  return (
    <div className="flex-1 flex flex-col bg-white p-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold text-[#14201A] hover:bg-[#DDE3DF] transition-colors"
          >
            &larr;
          </button>
          <div>
            <h2 className="text-lg font-bold text-[#14201A]">Payment Methods & Rates</h2>
            <p className="text-[11px] text-[#7A857F]">Transparent, zero-wallet campus transit</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* Compliance & Student Fund Protection Card */}
        <div className="p-5 bg-gradient-to-br from-[#0E7C3A] to-[#0A5D2C] text-white rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#A3E5B9]">
              Student Fund Protection
            </span>
            <span className="flex items-center gap-1 text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
              <Shield className="w-3 h-3 text-[#A3E5B9]" />
              CBN Compliant
            </span>
          </div>

          <h3 className="text-xl font-black tracking-tight my-1">No In-App Deposit Required</h3>
          <p className="text-xs text-[#E6F4EC] leading-relaxed mb-3">
            In compliance with Central Bank of Nigeria regulations, Zylift does NOT operate a custodial prepaid wallet. Your money never stays locked in an app balance. You pay exactly what each ride costs when you travel.
          </p>

          <div className="flex items-center justify-between pt-2.5 border-t border-white/20 text-xs">
            <span className="text-[#A3E5B9] font-medium">Platform Custodial Fee</span>
            <span className="font-bold text-white">₦0 (Exact Fare Only)</span>
          </div>
        </div>

        {/* Two Transparent Payment Options */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase text-[#7A857F] block">How You Pay for Rides</span>

          {/* Option 1: Cash */}
          <div className="p-4 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-[#E6F4EC] flex items-center justify-center text-[#0E7C3A]">
                <Banknote className="w-5 h-5 text-[#0E7C3A]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#14201A]">Exact Cash to Driver</h4>
                <span className="text-[10px] text-[#0E7C3A] font-semibold bg-[#E6F4EC] px-2 py-0.5 rounded-full">Primary Campus Option</span>
              </div>
            </div>
            <p className="text-xs text-[#7A857F] leading-relaxed">
              Hand physical cash directly to your Keke or Okada driver at drop-off. The driver confirms receipt on their device before completing your ride.
            </p>
          </div>

          {/* Option 2: Paystack Split */}
          <div className="p-4 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-[#E6F4EC] flex items-center justify-center text-[#0E7C3A]">
                <CreditCard className="w-5 h-5 text-[#0E7C3A]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#14201A]">Paystack Instant Pay</h4>
                <span className="text-[10px] text-[#0E7C3A] font-semibold bg-[#E6F4EC] px-2 py-0.5 rounded-full">Cards · Bank Transfers · USSD</span>
              </div>
            </div>
            <p className="text-xs text-[#7A857F] leading-relaxed">
              Pay the exact ride fare using your Debit Card, Bank App Transfer, or USSD code. Powered by Paystack Subaccounts, 100% of the driver's fare is automatically split and deposited straight into your driver's verified Nigerian bank account.
            </p>
          </div>
        </div>

        {/* Standard Campus Flat Fares Matrix */}
        <div className="p-4 bg-white border border-[#DDE3DF] rounded-2xl">
          <span className="text-xs font-bold uppercase text-[#7A857F] block mb-2.5">
            FUTMINNA Official Campus Fare Matrix
          </span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-[#F3F6F4]">
              <span className="font-semibold text-[#14201A]">GK Main Gate ↔ Hostels / Blocks</span>
              <span className="font-black text-[#0E7C3A]">₦200</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-[#F3F6F4]">
              <span className="font-semibold text-[#14201A]">Hostels ↔ SEET / School of Eng.</span>
              <span className="font-black text-[#0E7C3A]">₦200</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-[#F3F6F4]">
              <span className="font-semibold text-[#14201A]">SAAT ↔ Student Affairs / Clinic</span>
              <span className="font-black text-[#0E7C3A]">₦250</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-[#F3F6F4]">
              <span className="font-semibold text-[#14201A]">Bosso Campus ↔ Gidan Kwano</span>
              <span className="font-black text-[#0E7C3A]">₦500</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="font-semibold text-[#14201A]">Town & Intercity (Distance Formula)</span>
              <span className="font-bold text-[#7A857F]">Locked upfront quote</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- R19: SETTINGS & PROFILE (WITH PROFILE PICTURE UPLOAD & INFO UPDATING) ---
export const RiderSettingsScreen: React.FC<{
  user: RiderUserProfile;
  onUpdateUser?: (updated: RiderUserProfile) => void;
  onBack: () => void;
  onSignOut: () => void;
}> = ({ user, onUpdateUser, onBack, onSignOut }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<RiderUserProfile>({
    ...user,
    email: user.email || 'student@futminna.edu.ng',
    category: user.category || (user.role === 'staff' ? 'academic_staff' : 'student'),
    faculty: user.faculty || 'SEET (School of Engineering)',
    department: user.department || 'Mechanical Engineering',
    emergencyContactName: user.emergencyContactName || 'Parent / Guardian',
    emergencyContactPhone: user.emergencyContactPhone || '+234 803 000 0000',
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Profile Picture Upload Handler
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Photo must be less than 10MB');
      return;
    }

    try {
      const base64 = await compressImageFile(file, 600, 0.78);
      setFormData((prev) => ({ ...prev, avatarUrl: base64 }));
      setToastMessage('Photo selected! Tap "Save Changes" to save to your profile.');
      setTimeout(() => setToastMessage(null), 4000);
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setFormData((prev) => ({ ...prev, avatarUrl: base64 }));
        setToastMessage('Photo selected! Tap "Save Changes" to save to your profile.');
        setTimeout(() => setToastMessage(null), 4000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setFormData((prev) => ({ ...prev, avatarUrl: undefined }));
    setToastMessage('Profile picture removed');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let savedProfile: RiderUserProfile = formData;
      const token = localStorage.getItem('zylift_rider_token') || '';
      if (formData.id && token) {
        const res = await fetch(`/api/users/${encodeURIComponent(formData.id)}/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: formData.name,
            department: formData.department,
            matricOrStaffId: formData.matricOrStaffId,
            emergencyContactPhone: formData.emergencyContactPhone,
            avatarUrl: formData.avatarUrl || '',
            language: formData.language,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to save profile to server');
        }
        if (data.user) {
          savedProfile = {
            ...formData,
            id: data.user.id || formData.id,
            name: data.user.name || formData.name,
            department: data.user.department || formData.department,
            matricOrStaffId: data.user.matricOrStaffId ?? formData.matricOrStaffId,
            emergencyContactPhone: data.user.emergencyContactPhone ?? formData.emergencyContactPhone,
            avatarUrl: data.user.avatarUrl || undefined,
            referralCode: data.user.referralCode ?? formData.referralCode,
          };
          setFormData(savedProfile);
        }
      }

      if (onUpdateUser) {
        onUpdateUser(savedProfile);
      } else {
        localStorage.setItem('zylift_rider_user', JSON.stringify(savedProfile));
      }
      setToastMessage('✓ Profile information & photo saved!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      alert('Could not update profile: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white p-4 animate-fadeIn overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3 border-b border-[#DDE3DF] pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold text-[#14201A] hover:bg-[#E6F4EC] transition-all"
          >
            &larr;
          </button>
          <div>
            <h2 className="text-lg font-bold text-[#14201A]">Profile & Settings</h2>
            <p className="text-[11px] text-[#7A857F]">Edit info and upload profile photo</p>
          </div>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0E7C3A] text-white rounded-full text-xs font-bold hover:bg-[#0B6B45] transition-all shadow-sm disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? 'Saving...' : 'Save'}</span>
        </button>
      </div>

      {/* Confirmation Toast */}
      {toastMessage && (
        <div className="mb-3 p-3 bg-[#0E7C3A] text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 shrink-0 text-white" />
          <span className="flex-1">{toastMessage}</span>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto space-y-4 pb-6">
        {/* Profile Picture Upload Card */}
        <div className="p-4 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] flex flex-col items-center text-center">
          <div className="relative mb-2">
            <div className="w-24 h-24 rounded-full bg-[#0E7C3A] text-white flex items-center justify-center text-3xl font-black overflow-hidden border-3 border-white shadow-md">
              {formData.avatarUrl ? (
                <img src={formData.avatarUrl} alt={formData.name} className="w-full h-full object-cover" />
              ) : (
                formData.name.charAt(0)
              )}
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {/* Upload Button overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#0E7C3A] text-white flex items-center justify-center border-2 border-white shadow-md hover:bg-[#0B6B45] transition-transform hover:scale-110"
              title="Upload profile picture"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm font-bold text-[#14201A]">{formData.name}</p>
          <p className="text-xs text-[#7A857F] mb-2">{formData.phone}</p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 bg-white text-[#0E7C3A] rounded-xl text-xs font-bold border border-[#DDE3DF] hover:bg-[#E6F4EC] transition-all flex items-center gap-1 shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{formData.avatarUrl ? 'Change Picture' : 'Upload Picture'}</span>
            </button>

            {formData.avatarUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="px-2.5 py-1 bg-white text-[#D93A3A] rounded-xl text-xs font-bold border border-[#DDE3DF] hover:bg-[#FDE8E8] transition-all"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Section 1: Basic Information */}
        <div className="p-3.5 bg-white rounded-2xl border border-[#DDE3DF] space-y-3">
          <span className="text-[11px] font-bold uppercase text-[#0E7C3A] tracking-wider block">
            1. Personal Information
          </span>

          <div>
            <label className="text-[10px] font-bold uppercase text-[#7A857F] block mb-1">Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#14201A] outline-none focus:border-[#0E7C3A]"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-[#7A857F] block mb-1">Phone Number</label>
            <div className="relative">
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#14201A] outline-none focus:border-[#0E7C3A]"
                required
              />
              <span className="absolute right-3 top-2.5 text-[10px] font-bold text-[#0E7C3A] bg-[#E6F4EC] px-2 py-0.5 rounded-full">
                VERIFIED
              </span>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-[#7A857F] block mb-1">Email Address</label>
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. yourname@futminna.edu.ng"
              className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#14201A] outline-none focus:border-[#0E7C3A]"
            />
          </div>
        </div>

        {/* Section 2: Campus Category & Academic Info */}
        <div className="p-3.5 bg-white rounded-2xl border border-[#DDE3DF] space-y-3">
          <span className="text-[11px] font-bold uppercase text-[#0E7C3A] tracking-wider block">
            2. Campus & Identity
          </span>

          <div>
            <label className="text-[10px] font-bold uppercase text-[#7A857F] block mb-1">Campus Category</label>
            <select
              value={formData.category || 'student'}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as any, role: e.target.value.includes('staff') ? 'staff' : e.target.value === 'visitor' ? 'visitor' : 'student' })}
              className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#14201A] outline-none focus:border-[#0E7C3A]"
            >
              <option value="student">Undergraduate Student</option>
              <option value="postgrad">Postgraduate Student (PGD/MSc/PhD)</option>
              <option value="academic_staff">Academic Staff (Lecturer)</option>
              <option value="non_academic_staff">Non-Academic Staff</option>
              <option value="visitor">Campus Visitor / Guest</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-[#7A857F] block mb-1">School / Faculty</label>
            <select
              value={formData.faculty || 'SEET (School of Engineering)'}
              onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
              className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#14201A] outline-none focus:border-[#0E7C3A]"
            >
              <option value="SEET (School of Engineering)">SEET - Engineering & Engineering Tech</option>
              <option value="SAAT (School of Agriculture)">SAAT - Agriculture & Agricultural Tech</option>
              <option value="SICT (School of ICT)">SICT - Information & Communication Tech</option>
              <option value="SET (School of Environmental Tech)">SET - Environmental Technology</option>
              <option value="SLS (School of Life Sciences)">SLS - Life Sciences</option>
              <option value="SPS (School of Physical Sciences)">SPS - Physical Sciences</option>
              <option value="SSTE (School of Science & Tech Education)">SSTE - Science & Tech Education</option>
              <option value="Postgraduate School">Postgraduate School (SPS)</option>
              <option value="University Administration">University Administration / Central Registry</option>
              <option value="Visitor / External">External Guest / Parent / Visitor</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-[#7A857F] block mb-1">Department</label>
            <input
              type="text"
              value={formData.department || ''}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              placeholder="e.g. Mechanical Engineering, Cyber Security"
              className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#14201A] outline-none focus:border-[#0E7C3A]"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-[#7A857F] block mb-1">
              Matric / Staff ID Number
            </label>
            <input
              type="text"
              value={formData.matricOrStaffId || ''}
              onChange={(e) => setFormData({ ...formData, matricOrStaffId: e.target.value })}
              placeholder="e.g. 2021/1/84920ME or STF-1049"
              className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#14201A] outline-none focus:border-[#0E7C3A]"
            />
          </div>
        </div>

        {/* Section 3: Safety & Emergency Contact */}
        <div className="p-3.5 bg-white rounded-2xl border border-[#DDE3DF] space-y-3">
          <span className="text-[11px] font-bold uppercase text-[#0E7C3A] tracking-wider block">
            3. Safety & Emergency Contact
          </span>
          <p className="text-[10px] text-[#7A857F]">
            This person receives SMS alert notifications when you trigger an emergency SOS alert.
          </p>

          <div>
            <label className="text-[10px] font-bold uppercase text-[#7A857F] block mb-1">Contact Name</label>
            <input
              type="text"
              value={formData.emergencyContactName || ''}
              onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
              placeholder="e.g. Father, Mother, Guardian, Roommate"
              className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#14201A] outline-none focus:border-[#0E7C3A]"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-[#7A857F] block mb-1">Emergency Phone Number</label>
            <input
              type="tel"
              value={formData.emergencyContactPhone || ''}
              onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
              placeholder="+234..."
              className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#14201A] outline-none focus:border-[#0E7C3A]"
            />
          </div>
        </div>

        {/* Section 4: Preferences */}
        <div className="p-3.5 bg-white rounded-2xl border border-[#DDE3DF] space-y-3">
          <span className="text-[11px] font-bold uppercase text-[#0E7C3A] tracking-wider block">
            4. Preferences
          </span>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#14201A]">App Language</span>
            <select
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value as any })}
              className="p-1.5 bg-[#F3F6F4] rounded-lg border border-[#DDE3DF] text-xs font-bold text-[#0E7C3A]"
            >
              <option value="en">English</option>
              <option value="ha">Hausa (Harshen Hausa)</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#14201A]">Push Notifications</span>
            <span className="text-xs font-bold text-[#1B9E4B] bg-[#E6F4EC] px-2 py-0.5 rounded-full">
              Enabled
            </span>
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3.5 bg-[#0E7C3A] text-white rounded-2xl font-bold text-sm hover:bg-[#0B6B45] transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving Changes...' : 'Save & Update Profile'}</span>
        </button>

        {/* Sign out */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onSignOut}
            className="w-full py-3 bg-[#FDE8E8] text-[#D93A3A] font-bold text-xs rounded-2xl border border-[#D93A3A]/30 hover:bg-[#FBD5D5] transition-all"
          >
            Sign Out of Zylift
          </button>
        </div>
      </form>
    </div>
  );
};

// --- R20: HELP & FAQ ---
export const RiderHelpScreen: React.FC<{
  onBack: () => void;
}> = ({ onBack }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How do flat campus fares work?',
      a: 'All routes on FUTMINNA Gidan Kwanu have predefined fixed prices (e.g. Main Gate to Hostels is ₦200 by Keke). Drivers cannot add extra charges.',
    },
    {
      q: 'What is the 4-digit Safety PIN for?',
      a: 'Your PIN protects your ride. Give it to your driver when you board. They enter it into their app to verify the booking.',
    },
    {
      q: 'How do I reach Bosso Campus?',
      a: 'Select Campus Shuttle (Car) for inter-campus trips from Gidan Kwanu to Bosso town rank.',
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-white p-4 animate-fadeIn">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold"
        >
          &larr;
        </button>
        <h2 className="text-lg font-bold text-[#14201A]">Help & Support</h2>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        <div className="p-4 bg-[#E6F4EC] rounded-2xl flex items-center justify-between">
          <div>
            <p className="font-bold text-sm text-[#0E7C3A]">Need live assistance?</p>
            <p className="text-xs text-[#7A857F]">WhatsApp our pilot support desk</p>
          </div>
          <a
            href="https://wa.me/message/2ZWD6T2KUU5PK1"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-[#0E7C3A] hover:bg-[#0b632e] text-white text-xs font-bold rounded-xl transition-all"
          >
            Chat &rarr;
          </a>
        </div>

        <div className="divide-y divide-[#DDE3DF]">
          {faqs.map((faq, i) => (
            <div key={i} className="py-3">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left font-bold text-sm text-[#14201A] flex items-center justify-between"
              >
                <span>{faq.q}</span>
                <span>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && (
                <p className="text-xs text-[#7A857F] mt-2 leading-relaxed">{faq.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- R22: NOTIFICATIONS INBOX ---
export const RiderNotificationsScreen: React.FC<{
  onBack: () => void;
}> = ({ onBack }) => {
  const [liveAnnouncements, setLiveAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/announcements?audience=riders')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.announcements)) {
          setLiveAnnouncements(d.announcements);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const defaultAlerts = [
    {
      title: 'Welcome to Zylift Pilot',
      body: 'Campus rides across FUTMINNA are live with ₦0 platform fees.',
      time: 'Just now',
      unread: false,
    },
    {
      title: 'Safety Tip',
      body: 'Always check that the vehicle plate matches your app before boarding.',
      time: 'Campus Safety',
      unread: false,
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-white p-4 animate-fadeIn">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold cursor-pointer hover:bg-[#EAEFEA]"
        >
          &larr;
        </button>
        <div>
          <h2 className="text-lg font-bold text-[#14201A]">Notifications & Broadcasts</h2>
          <p className="text-[11px] text-[#7A857F]">Official campus notices and transit alerts</p>
        </div>
      </div>

      <div className="space-y-2.5 flex-1 overflow-y-auto">
        {/* Live Admin Broadcasts */}
        {liveAnnouncements.map((ann) => (
          <div
            key={ann.id}
            className="p-3.5 rounded-2xl border border-[#0E7C3A]/40 bg-[#E6F4EC]/60 shadow-xs transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0E7C3A] animate-pulse" />
                <p className="font-black text-sm text-[#0E7C3A]">{ann.title}</p>
              </div>
              <span className="text-[10px] font-mono text-[#7A857F]">
                {ann.sentAt ? new Date(ann.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
              </span>
            </div>
            <p className="text-xs text-[#14201A] font-medium leading-relaxed">{ann.body}</p>
            <div className="mt-2 flex items-center justify-between text-[10px] text-[#7A857F]">
              <span className="font-bold uppercase tracking-wider text-[#0E7C3A]">Campus Broadcast</span>
              <span>{ann.sentBy ? `Sent by ${ann.sentBy}` : 'Admin HQ'}</span>
            </div>
          </div>
        ))}

        {/* Fallback default alerts if no live announcements */}
        {defaultAlerts.map((al, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-2xl border border-[#DDE3DF] bg-[#F8FAF9] shadow-2xs"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="font-bold text-sm text-[#14201A]">{al.title}</p>
              <span className="text-[10px] text-[#7A857F]">{al.time}</span>
            </div>
            <p className="text-xs text-[#3E4A43]">{al.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- E3 & E4: REPORT PROBLEM / LOST ITEM ---
export const RiderReportScreen: React.FC<{
  tripId?: string;
  user?: RiderUserProfile | null;
  onBack: () => void;
}> = ({ tripId, user, onBack }) => {
  const [category, setCategory] = useState<'lost_item' | 'wrong_price' | 'driver_no_show' | 'other'>('wrong_price');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    try {
      await fetch('/api/admin/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          riderName: user?.name || 'Passenger',
          riderPhone: user?.phone || '',
          category,
          subject: `Report on trip ${tripId || 'campus hop'}`,
          description,
        }),
      });
    } catch (e) {
      // fallback
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white text-center">
        <div className="pt-16">
          <div className="w-16 h-16 rounded-full bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center text-3xl mx-auto mb-4">
            ✓
          </div>
          <h2 className="text-xl font-bold text-[#14201A] mb-2">Report Received</h2>
          <p className="text-xs text-[#7A857F] max-w-xs mx-auto">
            Our campus dispatch marshals have received your report and will reach out if necessary.
          </p>
        </div>
        <KerbButton onClick={onBack}>Done</KerbButton>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between p-4 bg-white animate-fadeIn">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold"
          >
            &larr;
          </button>
          <h2 className="text-lg font-bold text-[#14201A]">Report a Problem</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Issue Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-sm text-[#14201A] font-semibold"
            >
              <option value="wrong_price">Driver asked for more cash</option>
              <option value="lost_item">Lost item left in vehicle</option>
              <option value="driver_no_show">Driver did not arrive</option>
              <option value="other">Other issue</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us what happened..."
              className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-sm text-[#14201A] outline-none h-32 resize-none"
            />
          </div>
        </div>
      </div>

      <div className="pt-4">
        <KerbButton disabled={!description.trim()} onClick={handleSubmit}>
          Submit Report
        </KerbButton>
      </div>
    </div>
  );
};

// --- E6: PILOT FEEDBACK SURVEY ---
export const RiderSurveyScreen: React.FC<{
  onBack: () => void;
  user?: RiderUserProfile;
}> = ({ onBack, user }) => {
  const [fairness, setFairness] = useState<'too_cheap' | 'fair' | 'too_expensive'>('fair');
  const [safety, setSafety] = useState<'very_safe' | 'safe' | 'unsafe'>('very_safe');
  const [wouldUseAgain, setWouldUseAgain] = useState<boolean>(true);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.name ? `${user.name} (${user.phone})` : 'Student (Campus Rider)',
          priceFairness: fairness,
          safetyFeeling: safety,
          wouldUseAgain,
          comments: comments.trim() || undefined,
        }),
      });
    } catch (e) {
      console.warn('Survey submission fallback:', e);
    } finally {
      setIsSubmitting(false);
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-white text-center animate-fadeIn">
        <div className="pt-16">
          <div className="w-16 h-16 rounded-full bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center mx-auto mb-4 border border-[#0E7C3A]/30 shadow-sm">
            <CheckCircle className="w-9 h-9 text-[#0E7C3A]" />
          </div>
          <h2 className="text-xl font-bold text-[#14201A] mb-2">Thank you!</h2>
          <p className="text-xs text-[#7A857F] max-w-xs mx-auto leading-relaxed">
            Your feedback has been received by the Campus Transit Admin and shapes the future of rides at FUTMINNA.
          </p>
        </div>
        <KerbButton onClick={onBack}>Back to Home &rarr;</KerbButton>
      </div>
    );
  }

  const fairnessOptions: { value: 'too_cheap' | 'fair' | 'too_expensive'; label: string }[] = [
    { value: 'too_cheap', label: 'Too Cheap' },
    { value: 'fair', label: 'Fair' },
    { value: 'too_expensive', label: 'Too Expensive' },
  ];

  const safetyOptions: { value: 'very_safe' | 'safe' | 'unsafe'; label: string }[] = [
    { value: 'very_safe', label: 'Very Safe' },
    { value: 'safe', label: 'Safe' },
    { value: 'unsafe', label: 'Unsafe' },
  ];

  return (
    <div className="flex-1 flex flex-col justify-between p-4 bg-white animate-fadeIn overflow-y-auto">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold hover:bg-[#E6F4EC] transition-colors"
          >
            &larr;
          </button>
          <h2 className="text-lg font-bold text-[#14201A]">Pilot Feedback Survey</h2>
        </div>

        <div className="space-y-5">
          {/* Question 1: Campus Fares */}
          <div>
            <p className="text-xs font-bold uppercase text-[#7A857F] mb-2">1. How fair were the campus fares?</p>
            <div className="grid grid-cols-3 gap-2">
              {fairnessOptions.map((opt) => {
                const isSelected = fairness === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFairness(opt.value)}
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
                    className="min-h-[48px] py-2.5 px-2 text-xs font-bold rounded-2xl border-2 transition-all flex items-center justify-center text-center cursor-pointer active:scale-95"
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white mr-1 shrink-0" />}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 2: Safety Feeling */}
          <div>
            <p className="text-xs font-bold uppercase text-[#7A857F] mb-2">2. How safe did you feel?</p>
            <div className="grid grid-cols-3 gap-2">
              {safetyOptions.map((opt) => {
                const isSelected = safety === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSafety(opt.value)}
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
                    className="min-h-[48px] py-2.5 px-2 text-xs font-bold rounded-2xl border-2 transition-all flex items-center justify-center text-center cursor-pointer active:scale-95"
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white mr-1 shrink-0" />}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 3: Would Use Again */}
          <div>
            <p className="text-xs font-bold uppercase text-[#7A857F] mb-2">3. Would you use FUTMINNA Ride again?</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: true, label: 'Yes, definitely' },
                { value: false, label: 'Not sure / No' },
              ].map((opt) => {
                const isSelected = wouldUseAgain === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setWouldUseAgain(opt.value)}
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
                    className="min-h-[48px] py-2.5 px-3 text-xs font-bold rounded-2xl border-2 transition-all flex items-center justify-center text-center cursor-pointer active:scale-95"
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white mr-1 shrink-0" />}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 4: Suggestions */}
          <div>
            <p className="text-xs font-bold uppercase text-[#7A857F] mb-1.5">4. Any suggestions for improvement?</p>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="What could be better?"
              className="w-full p-3 bg-[#F3F6F4] rounded-2xl border-2 border-[#DDE3DF] text-xs text-[#14201A] outline-none focus:border-[#0E7C3A] h-24 resize-none font-medium leading-relaxed"
            />
          </div>
        </div>
      </div>

      <div className="pt-6">
        <KerbButton isLoading={isSubmitting} onClick={handleSubmit}>
          Submit Survey &rarr;
        </KerbButton>
      </div>
    </div>
  );
};

// --- E7: INVITE & PIONEER REFERRALS (ZERO-COST REWARD MODEL) ---
export const RiderInviteScreen: React.FC<{
  onBack: () => void;
  user?: RiderUserProfile | null;
}> = ({ onBack, user }) => {
  const [inviteTarget, setInviteTarget] = useState<'rider' | 'driver'>('rider');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [stats, setStats] = useState<{
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
  const [loadingStats, setLoadingStats] = useState(false);

  // Use canonical stored referral code when available, with legacy fallback
  const rawCode = (user?.name?.replace(/[^a-zA-Z0-9]/g, '') || user?.phone?.replace(/\D/g, '').slice(-4) || 'PIONEER').toUpperCase();
  const referralCode = (user?.referralCode || `ZYLIFT-${rawCode.slice(0, 8)}`).toUpperCase();

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const queryParam = user?.id || referralCode;
        const res = await fetch(`/api/referrals/stats?code=${encodeURIComponent(queryParam)}&phone=${encodeURIComponent(user?.phone || '')}`);
        const data = await res.json();
        if (isMounted && data.success && data.stats) {
          setStats({
            totalReferrals: data.stats.totalReferrals ?? data.stats.totalReferred ?? 0,
            completedReferrals: data.stats.completedReferrals ?? data.stats.completedCount ?? 0,
            pendingReferrals: data.stats.pendingReferrals ?? data.stats.pendingCount ?? 0,
            unlockedPerks: data.stats.unlockedPerks || [],
            referrals: data.stats.referrals || [],
          });
        }
      } catch (err) {
        // silent fail
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    };
    fetchStats();
    return () => { isMounted = false; };
  }, [referralCode, user?.id, user?.phone]);

  // Dynamic deep-links using live deployment origin
  const appOrigin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://zylift.futminna.edu.ng';
  const riderShareUrl = `${appOrigin}/join?ref=${referralCode}`;
  const driverShareUrl = `${appOrigin}/driver?ref=${referralCode}`;
  const currentUrl = inviteTarget === 'rider' ? riderShareUrl : driverShareUrl;

  // Pre-written WhatsApp share messages
  const riderWhatsAppText = encodeURIComponent(
    `Hey! I use Zylift for fast, flat-rate campus rides (₦200 Keke/Okada) at FUTMINNA Gidan Kwanu. Skip the park queues and get priority pickup with my link: ${riderShareUrl} (Code: ${referralCode})`
  );
  const driverWhatsAppText = encodeURIComponent(
    `Assalamu Alaikum! Drive on campus with Zylift at FUTMINNA Gidan Kwanu. Keep 100% of your earnings with 0% platform commission lock-in, steady student requests & no queue fighting. Register your Keke, Bike or Car here: ${driverShareUrl} (Referral: ${referralCode})`
  );

  const whatsAppUrl = `https://wa.me/?text=${inviteTarget === 'rider' ? riderWhatsAppText : driverWhatsAppText}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: inviteTarget === 'rider' ? 'Join Zylift FUTMINNA' : 'Drive with Zylift Campus Fleet',
          text: inviteTarget === 'rider'
            ? 'Skip the queue and ride flat-rate ₦200 Keke/Okada at FUTMINNA Gidan Kwanu with Zylift!'
            : 'Drive with Zylift at FUTMINNA. Keep 100% of earnings with 0% commission lock-in.',
          url: currentUrl,
        });
      } catch (err) {
        // User cancelled or unsupported
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-4 bg-white animate-fadeIn overflow-y-auto">
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center font-bold text-[#14201A]"
          >
            &larr;
          </button>
          <div>
            <h2 className="text-lg font-bold text-[#14201A]">Invite & Campus Rewards</h2>
            <p className="text-[11px] text-[#7A857F]">Earn non-cash VIP perks & priority matching</p>
          </div>
        </div>

        {/* Audience Toggle (Riders vs Drivers) */}
        <div className="p-1 bg-[#F3F6F4] rounded-2xl flex items-center mb-5 border border-[#DDE3DF]">
          <button
            onClick={() => setInviteTarget('rider')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              inviteTarget === 'rider'
                ? 'bg-white text-[#0E7C3A] shadow-sm'
                : 'text-[#7A857F] hover:text-[#14201A]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Classmates (Riders)</span>
          </button>
          <button
            onClick={() => setInviteTarget('driver')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              inviteTarget === 'driver'
                ? 'bg-white text-[#0E7C3A] shadow-sm'
                : 'text-[#7A857F] hover:text-[#14201A]'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Campus Drivers</span>
          </button>
        </div>

        {/* Hero Card */}
        <div className="text-center mb-5">
          <div className="w-16 h-16 rounded-3xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center mx-auto mb-3 shadow-inner">
            {inviteTarget === 'rider' ? (
              <Gift className="w-8 h-8 text-[#0E7C3A]" />
            ) : (
              <Car className="w-8 h-8 text-[#0E7C3A]" />
            )}
          </div>
          <h3 className="text-lg font-black text-[#14201A] mb-1">
            {inviteTarget === 'rider' ? 'Share Zylift with Classmates' : 'Recruit a Campus Driver'}
          </h3>
          <p className="text-xs text-[#7A857F] max-w-xs mx-auto leading-relaxed">
            {inviteTarget === 'rider'
              ? 'Help friends skip the motor park queue and get flat-rate ₦200 Keke/Okada rides across Gidan Kwanu.'
              : 'Know someone with a Keke, Bike or Car? They keep 100% of fares with 0% platform commission lock-in.'}
          </p>
        </div>

        {/* Referral Code & Deep-Link Card */}
        <div className="bg-[#F8FAF9] border border-[#DDE3DF] rounded-2xl p-3.5 mb-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#7A857F] font-semibold">Your Referral Code</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-[#0E7C3A] bg-[#E6F4EC] px-2.5 py-1 rounded-lg">
                {referralCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="px-2.5 py-1 text-xs font-bold bg-white text-[#14201A] rounded-lg border border-[#DDE3DF] hover:bg-[#F3F6F4] flex items-center gap-1 transition-all"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-[#1B9E4B]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="p-2.5 bg-white border border-[#DDE3DF] rounded-xl flex items-center justify-between font-mono text-[11px] text-[#7A857F] break-all">
            <span className="truncate pr-2">{currentUrl}</span>
            <button
              onClick={handleCopyLink}
              className="shrink-0 px-2.5 py-1 bg-[#0E7C3A] text-white text-[11px] font-bold rounded-lg hover:bg-[#0b632e] transition-all flex items-center gap-1"
            >
              {copiedLink ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3 text-white" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Live Referral Stats */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="p-3 bg-[#F8FAF9] border border-[#DDE3DF] rounded-2xl text-center">
            <span className="text-[10px] uppercase font-bold text-[#7A857F] block">Invited</span>
            <span className="text-xl font-black text-[#14201A]">{loadingStats ? '...' : stats.totalReferrals}</span>
            <span className="text-[9px] text-[#7A857F] block">friends</span>
          </div>
          <div className="p-3 bg-[#E6F4EC] border border-[#0E7C3A]/20 rounded-2xl text-center">
            <span className="text-[10px] uppercase font-bold text-[#0E7C3A] block">Completed</span>
            <span className="text-xl font-black text-[#0E7C3A]">{loadingStats ? '...' : stats.completedReferrals}</span>
            <span className="text-[9px] text-[#0E7C3A] block">1st rides done</span>
          </div>
          <div className="p-3 bg-[#F8FAF9] border border-[#DDE3DF] rounded-2xl text-center">
            <span className="text-[10px] uppercase font-bold text-[#7A857F] block">Pending</span>
            <span className="text-xl font-black text-amber-700">{loadingStats ? '...' : stats.pendingReferrals}</span>
            <span className="text-[9px] text-[#7A857F] block">signed up</span>
          </div>
        </div>

        {/* Zero-Cost Rewards Milestones Tracker */}
        <div className="mb-5 text-left">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0E7C3A]">
              {inviteTarget === 'rider' ? 'Pioneer Rewards (Zero-Cost Perks)' : 'Driver Program Benefits'}
            </h4>
            <span className="text-[10px] bg-[#E6F4EC] text-[#0E7C3A] font-bold px-2 py-0.5 rounded-full">
              Non-Cash Rewards
            </span>
          </div>

          {inviteTarget === 'rider' ? (
            <div className="space-y-2">
              <div className="p-3 bg-[#F3F6F4] rounded-2xl flex items-center gap-3 border border-[#DDE3DF]">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#14201A]">Founding Rider Badge 🏅</p>
                    <span className="text-[10px] font-semibold text-[#0E7C3A]">1 Friend</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F]">Permanent Founding status displayed on your campus profile</p>
                </div>
              </div>

              <div className="p-3 bg-[#F3F6F4] rounded-2xl flex items-center gap-3 border border-[#DDE3DF]">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#0E7C3A] flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#14201A]">Peak Hour Priority Matching ⚡</p>
                    <span className="text-[10px] font-semibold text-[#0E7C3A]">3 Friends</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F]">Fast-track dispatch queue when leaving classes or Main Gate</p>
                </div>
              </div>

              <div className="p-3 bg-[#F3F6F4] rounded-2xl flex items-center gap-3 border border-[#DDE3DF]">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#14201A]">Campus Ambassador Circle 👑</p>
                    <span className="text-[10px] font-semibold text-[#0E7C3A]">5 Friends</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F]">Direct input on new campus routes & VIP pilot access</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="p-3 bg-[#F3F6F4] rounded-2xl flex items-center gap-3 border border-[#DDE3DF]">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#0E7C3A] flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#14201A]">0% Commission Lock-In 🛡️</p>
                    <span className="text-[10px] font-semibold text-[#0E7C3A]">For Drivers</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F]">Referred drivers keep 100% of earnings without platform cut</p>
                </div>
              </div>

              <div className="p-3 bg-[#F3F6F4] rounded-2xl flex items-center gap-3 border border-[#DDE3DF]">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#14201A]">Founding Driver Badge 🎖️</p>
                    <span className="text-[10px] font-semibold text-[#0E7C3A]">Profile Badge</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F]">Permanent verified pioneer status on their vehicle card</p>
                </div>
              </div>

              <div className="p-3 bg-[#F3F6F4] rounded-2xl flex items-center gap-3 border border-[#DDE3DF]">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#14201A]">Priority Park Dispatch ⚡</p>
                    <span className="text-[10px] font-semibold text-[#0E7C3A]">Park Queues</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F]">Instant matching for ride requests at School Motor Park & Gates</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Abuse-Proof Community Rules */}
        <div className="p-3 bg-[#E6F4EC]/60 border border-[#0E7C3A]/20 rounded-2xl text-left mb-4">
          <p className="text-[11px] font-bold text-[#0E7C3A] mb-1">FUTMINNA Community Guidelines</p>
          <ul className="text-[10px] text-[#14201A] space-y-0.5 list-disc pl-3.5">
            <li>Rewards unlock when your invited friend completes their first ride.</li>
            <li>Limited to 1 referral reward per verified student phone number.</li>
            <li>100% community-powered — zero hidden charges or commissions.</li>
          </ul>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-2 pb-1">
        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-13 py-3.5 bg-[#1B9E4B] hover:bg-[#15803d] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all"
        >
          <span>Share on WhatsApp</span>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
            {inviteTarget === 'rider' ? 'Classmates' : 'Drivers'}
          </span>
        </a>

        {typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function' && (
          <button
            onClick={handleNativeShare}
            className="w-full py-2.5 bg-[#F3F6F4] hover:bg-[#DDE3DF] text-[#14201A] font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <Share2 className="w-3.5 h-3.5 text-[#0E7C3A]" />
            <span>More Sharing Options (SMS, Telegram, Copy)</span>
          </button>
        )}
      </div>
    </div>
  );
};
