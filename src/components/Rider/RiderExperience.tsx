import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Clock,
  Shield,
  Phone,
  MessageSquare,
  Share2,
  CreditCard,
  Banknote,
  AlertTriangle,
  User,
  Star,
  CheckCircle,
  Navigation,
  Bus,
  Bike,
  Car,
  ArrowLeft,
  ArrowRight,
  Lock,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Wallet,
  MapPin,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { RealLiveMap } from '../Map/RealLiveMap';
import {
  FUTMINNA_KEY_LOCATIONS,
  findNearestLocation,
  calculateDynamicRouteFare,
} from '../../data/futminnaLocations';
import {
  KerbButton,
  KerbCard,
  KerbBottomSheet,
  KerbPlateBadge,
  KerbPinDisplay,
  playKerbSound,
} from '../Common/KerbComponents';
import { RiderUserProfile } from './RiderOnboarding';

export type RiderScreenState =
  | 'home' // R7
  | 'pickup_dropoff' // R8
  | 'choose_ride' // R9
  | 'finding_driver' // R10
  | 'driver_found' // R11
  | 'driver_arriving' // R12
  | 'in_ride' // R13
  | 'arrived_pay' // R14
  | 'rate_ride'; // R15

interface RiderExperienceProps {
  user: RiderUserProfile;
  onOpenMenu: () => void;
  onOpenNotifications: () => void;
  onOpenTrips: () => void;
  onReportProblem: (tripId?: string) => void;
  onTripCompleted: () => void;
}

export const RiderExperience: React.FC<RiderExperienceProps> = ({
  user,
  onOpenMenu,
  onOpenNotifications,
  onOpenTrips,
  onReportProblem,
  onTripCompleted,
}) => {
  const [screen, setScreen] = useState<RiderScreenState>('home');
  const [activeBroadcast, setActiveBroadcast] = useState<any>(null);
  const [dismissedBroadcastId, setDismissedBroadcastId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBroadcast = () => {
      fetch('/api/announcements?audience=riders')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.announcements)) {
            setActiveBroadcast(d.announcements[0] || null);
          }
        })
        .catch(() => {});
    };
    fetchBroadcast();
    const interval = setInterval(fetchBroadcast, 5000);
    return () => clearInterval(interval);
  }, []);

  // Route state
  const [pickup, setPickup] = useState(FUTMINNA_KEY_LOCATIONS[0]); // Main Gate
  const [destination, setDestination] = useState(FUTMINNA_KEY_LOCATIONS[4]); // Hostels
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLgaFilter, setSelectedLgaFilter] = useState<'all' | 'campus' | 'chanchaga' | 'bosso'>('all');
  const [activeSelector, setActiveSelector] = useState<'pickup' | 'dropoff'>('dropoff');

  // Ride selection - 5 campus vehicle categories
  const [selectedCategory, setSelectedCategory] = useState<'keke' | 'okada' | 'cab_go' | 'small_bus' | 'big_bus'>('keke');
  const [farePrices, setFarePrices] = useState({ keke: 200, okada: 250, cab_go: 500, small_bus: 150, big_bus: 100 });
  const [passengers, setPassengers] = useState(1);
  const [quoteToken, setQuoteToken] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState<{
    distanceKm?: number;
    durationMinutes?: number;
    approximate?: boolean;
    isCampusFlatFare?: boolean;
    options?: { category: string; label: string; fareNaira: number; maxSeats: number }[];
    unavailable?: { category: string; label: string; reason: string }[];
    requiresManualQuote?: boolean;
    error?: string;
  } | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [activeTrip, setActiveTrip] = useState<any>(null);

  // Finding timer & progress
  const [findingSeconds, setFindingSeconds] = useState(0);

  // SOS Emergency Modal
  const [showSosModal, setShowSosModal] = useState(false);
  const [sosAlertActive, setSosAlertActive] = useState(false);

  // Rating State
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingTags, setRatingTags] = useState<string[]>([]);
  const [ratingComment, setRatingComment] = useState('');
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Online drivers status
  const [onlineDriverCount, setOnlineDriverCount] = useState(4);

  // Geocode Search State (Universal Search for Wushishi, Bida, Zungeru, any address)
  const [serverLocations, setServerLocations] = useState<any[]>([]);
  const [isSearchingGeocode, setIsSearchingGeocode] = useState(false);

  // Per-Trip Payment States (Option B: Cash or Paystack Split)
  const [paymentTab, setPaymentTab] = useState<'cash' | 'paystack'>('cash');
  const [paystackLoading, setPaystackLoading] = useState(false);
  const [paystackRef, setPaystackRef] = useState<string | null>(null);
  const [paystackAuthUrl, setPaystackAuthUrl] = useState<string | null>(null);
  const [paystackIsSimulation, setPaystackIsSimulation] = useState(false);
  const [paystackChannel, setPaystackChannel] = useState<'card' | 'bank_transfer' | 'ussd'>('card');
  const [paystackError, setPaystackError] = useState<string | null>(null);
  const [paystackPaid, setPaystackPaid] = useState(false);
  const [lastCompletedTripId, setLastCompletedTripId] = useState<string | null>(null);
  const [pickupFeedback, setPickupFeedback] = useState<string | null>(null);

  // Universal Geocoding Lookup whenever searchQuery changes
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setServerLocations([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingGeocode(true);
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data && Array.isArray(data.results)) {
          setServerLocations(data.results);
        }
      } catch (err) {
        console.warn('Geocode lookup failed:', err);
      } finally {
        setIsSearchingGeocode(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Authenticated rider fetch helper
  const riderFetch = (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('zylift_rider_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
  };

  // Paystack Per-Trip Checkout Trigger
  const handleInitiatePaystack = async () => {
    if (!activeTrip) return;
    if (activeTrip.driverHasBank === false) {
      setPaystackError(`${activeTrip.driverName || 'Driver'} has not connected a bank account yet. Please pay with Cash directly to the driver.`);
      return;
    }
    setPaystackLoading(true);
    setPaystackError(null);
    try {
      const res = await fetch('/api/payments/paystack/initialize-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: activeTrip.id,
          riderEmail: user.email || `${user.phone?.replace(/\D/g, '') || 'rider'}@zyliftcampus.ng`,
        }),
      });
      const data = await res.json();
      if (data.status && data.data) {
        setPaystackRef(data.data.reference);
        setPaystackAuthUrl(data.data.authorization_url || null);
        setPaystackIsSimulation(Boolean(data.data.isSimulation));
        const authUrl = data.data.authorization_url;
        // Only auto-open external Paystack URLs; sandbox checkout renders inline + has explicit link
        if (authUrl && !data.data.isSimulation) {
          window.open(authUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        setPaystackError(data.error || 'Failed to initialize Paystack per-trip payment');
      }
    } catch (err: any) {
      setPaystackError(err.message || 'Payment network failure');
    } finally {
      setPaystackLoading(false);
    }
  };

  const getCompletedRiderTrips = (): string[] => {
    try {
      const raw = localStorage.getItem('zylift_completed_rider_trips');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const markRiderTripFinished = (tripId?: string | null) => {
    if (!tripId) return;
    try {
      const current = getCompletedRiderTrips();
      if (!current.includes(tripId)) {
        localStorage.setItem('zylift_completed_rider_trips', JSON.stringify([tripId, ...current].slice(0, 50)));
      }
    } catch {}
  };

  // Manual Paystack verify check
  const handleVerifyPaystackNow = async () => {
    if (!activeTrip) return;
    const refToCheck = paystackRef || activeTrip.pendingPaystackReference;
    setPaystackLoading(true);
    setPaystackError(null);
    try {
      const verifyRes = refToCheck
        ? await fetch(`/api/payments/paystack/verify/${encodeURIComponent(refToCheck)}`)
        : await fetch(`/api/trips/${activeTrip.id}/check-paystack`, { method: 'POST' });
      const vData = await verifyRes.json();
      if (vData.success) {
        setPaystackPaid(true);
        markRiderTripFinished(activeTrip.id);
        playKerbSound('success');
        setLastCompletedTripId(activeTrip.id);
        setScreen('rate_ride');
      } else {
        setPaystackError(vData.error || 'Payment not confirmed yet. Complete checkout first.');
      }
    } catch (err: any) {
      setPaystackError(err.message || 'Could not verify payment');
    } finally {
      setPaystackLoading(false);
    }
  };

  // Sandbox Checkout Completion (only when server returned isSimulation=true)
  const handleCompleteSandboxPaystack = async () => {
    if (!paystackRef || !activeTrip) return;
    setPaystackLoading(true);
    setPaystackError(null);
    try {
      const res = await fetch('/api/payments/paystack/dev-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: paystackRef, channel: paystackChannel }),
      });
      const data = await res.json();
      if (data.success) {
        setPaystackPaid(true);
        markRiderTripFinished(activeTrip.id);
        playKerbSound('success');
        setLastCompletedTripId(activeTrip.id);
        setScreen('rate_ride');
      } else {
        setPaystackError(data.error || 'Sandbox payment failed');
      }
    } catch (err: any) {
      setPaystackError(err.message || 'Sandbox payment network error');
    } finally {
      setPaystackLoading(false);
    }
  };

  // Poll for trip payment completion (either driver confirmed cash, or Paystack payment settled)
  useEffect(() => {
    if (screen !== 'arrived_pay' || !activeTrip) return;

    const interval = setInterval(async () => {
      try {
        // If we have a paystack reference, check verify endpoint
        const refToCheck = paystackRef || activeTrip.pendingPaystackReference;
        if (refToCheck && !paystackPaid) {
          const verifyRes = await fetch(`/api/payments/paystack/verify/${encodeURIComponent(refToCheck)}`);
          const vData = await verifyRes.json();
          if (vData.success) {
            setPaystackPaid(true);
            markRiderTripFinished(activeTrip.id);
            playKerbSound('success');
            setLastCompletedTripId(activeTrip.id);
            setScreen('rate_ride');
            return;
          }
        }

        const res = await fetch(`/api/trips/${activeTrip.id}`);
        const data = await res.json();
        if (data.trip) {
          if (
            data.trip.paymentStatus === 'cash_collected' ||
            data.trip.paymentStatus === 'paystack_paid' ||
            data.trip.paymentStatus === 'transfer_confirmed' ||
            data.trip.status === 'completed'
          ) {
            markRiderTripFinished(activeTrip.id);
            playKerbSound('success');
            setLastCompletedTripId(activeTrip.id);
            setScreen('rate_ride');
          }
        }
      } catch (err) {
        // silent
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [screen, activeTrip, paystackRef, paystackPaid]);

  // Fetch distance-based route quote & vehicle options (/api/pricing/quote)
  useEffect(() => {
    let isCancelled = false;
    const fetchQuote = async () => {
      const pCoords: [number, number] = [pickup.lat, pickup.lng];
      const dCoords: [number, number] = [destination.lat, destination.lng];
      setIsQuoting(true);

      const fallbackKeke = calculateDynamicRouteFare(pickup.name, destination.name, 'keke', pCoords, dCoords) * passengers;
      const fallbackOkada = calculateDynamicRouteFare(pickup.name, destination.name, 'okada', pCoords, dCoords) * passengers;
      const fallbackCar = calculateDynamicRouteFare(pickup.name, destination.name, 'cab_go', pCoords, dCoords) * passengers;
      const fallbackSmallBus = calculateDynamicRouteFare(pickup.name, destination.name, 'small_bus', pCoords, dCoords) * passengers;
      const fallbackBigBus = calculateDynamicRouteFare(pickup.name, destination.name, 'big_bus', pCoords, dCoords) * passengers;

      try {
        const res = await fetch('/api/pricing/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pickupName: pickup.name,
            dropoffName: destination.name,
            pickupCoords: pCoords,
            dropoffCoords: dCoords,
            passengers,
          }),
        });
        const data = await res.json();
        if (isCancelled) return;

        if (data.success) {
          setQuoteData(data);
          if (data.quoteToken) setQuoteToken(data.quoteToken);

          const newFares: any = { ...farePrices };
          if (Array.isArray(data.options)) {
            data.options.forEach((opt: any) => {
              newFares[opt.category] = opt.fareNaira;
            });
            setFarePrices(newFares);

            // Auto-select first available option if current selectedCategory is ineligible
            const availableCats = data.options.map((o: any) => o.category);
            if (!availableCats.includes(selectedCategory) && availableCats.length > 0) {
              setSelectedCategory(availableCats[0]);
            }
          }
        } else {
          setQuoteData({
            requiresManualQuote: data.requiresManualQuote,
            distanceKm: data.distanceKm,
            error: data.error || 'Could not calculate route price',
          });
        }
      } catch (e) {
        if (!isCancelled) {
          setFarePrices({
            keke: fallbackKeke,
            okada: fallbackOkada,
            cab_go: fallbackCar,
            small_bus: fallbackSmallBus,
            big_bus: fallbackBigBus,
          });
        }
      } finally {
        if (!isCancelled) setIsQuoting(false);
      }
    };

    fetchQuote();
    return () => { isCancelled = true; };
  }, [pickup, destination, passengers]);

  // Sync Rider UI state, coordinates, and screen transitions from any active/started trip
  const applyTripState = (trip: any, currentScreen: RiderScreenState) => {
    if (!trip) return;

    if (Array.isArray(trip.pickupCoords) && trip.pickupCoords.length === 2) {
      const [plat, plng] = trip.pickupCoords;
      if (Number.isFinite(plat) && Number.isFinite(plng)) {
        setPickup((prev) =>
          prev.name === trip.pickupName && prev.lat === plat && prev.lng === plng
            ? prev
            : {
                ...prev,
                id: `trip_pickup_${trip.id}`,
                name: trip.pickupName || prev.name,
                address: trip.pickupName || prev.address,
                lat: plat,
                lng: plng,
              }
        );
      }
    }

    if (Array.isArray(trip.dropoffCoords) && trip.dropoffCoords.length === 2) {
      const [dlat, dlng] = trip.dropoffCoords;
      if (Number.isFinite(dlat) && Number.isFinite(dlng)) {
        setDestination((prev) =>
          prev.name === trip.dropoffName && prev.lat === dlat && prev.lng === dlng
            ? prev
            : {
                ...prev,
                id: `trip_dropoff_${trip.id}`,
                name: trip.dropoffName || prev.name,
                address: trip.dropoffName || prev.address,
                lat: dlat,
                lng: dlng,
              }
        );
      }
    }

    if (
      trip.vehicleCategory &&
      ['keke', 'okada', 'cab_go', 'small_bus', 'big_bus'].includes(trip.vehicleCategory)
    ) {
      setSelectedCategory(trip.vehicleCategory);
    }

    if (
      (trip.status === 'requested' || trip.status === 'matching') &&
      currentScreen !== 'finding_driver' &&
      currentScreen !== 'rate_ride'
    ) {
      setScreen('finding_driver');
    } else if (
      trip.status === 'accepted' &&
      currentScreen !== 'driver_found' &&
      currentScreen !== 'driver_arriving' &&
      currentScreen !== 'in_ride' &&
      currentScreen !== 'arrived_pay' &&
      currentScreen !== 'rate_ride'
    ) {
      playKerbSound('success');
      setScreen('driver_found');
    } else if (
      trip.status === 'arriving' &&
      currentScreen !== 'driver_arriving' &&
      currentScreen !== 'in_ride' &&
      currentScreen !== 'arrived_pay' &&
      currentScreen !== 'rate_ride'
    ) {
      playKerbSound('tap');
      setScreen('driver_arriving');
    } else if (
      trip.status === 'in_progress' &&
      currentScreen !== 'in_ride' &&
      currentScreen !== 'arrived_pay' &&
      currentScreen !== 'rate_ride'
    ) {
      playKerbSound('success');
      setScreen('in_ride');
    } else if (trip.status === 'arrived_destination' || trip.status === 'completed') {
      const isPaid = ['paystack_paid', 'cash_collected', 'transfer_confirmed'].includes(
        trip.paymentStatus
      );
      const isFinished =
        trip.status === 'completed' ||
        isPaid ||
        Boolean(trip.riderRating) ||
        getCompletedRiderTrips().includes(trip.id);

      if (isFinished) {
        if (currentScreen === 'arrived_pay') {
          playKerbSound('success');
          setLastCompletedTripId(trip.id);
          setScreen('rate_ride');
        } else if (currentScreen !== 'rate_ride') {
          setActiveTrip(null);
          // Never kick back to home if user is actively booking (on finding_driver, choose_ride, or pickup_dropoff)
          if (['driver_found', 'driver_arriving', 'in_ride', 'arrived_pay'].includes(currentScreen)) {
            setScreen('home');
          }
        }
      } else if (currentScreen !== 'arrived_pay' && currentScreen !== 'rate_ride') {
        playKerbSound('success');
        setScreen('arrived_pay');
      }
    } else if (trip.status === 'no_drivers_available') {
      if (currentScreen !== 'finding_driver') {
        setScreen('finding_driver');
      }
    } else if (trip.status === 'cancelled') {
      setActiveTrip(null);
      if (['driver_found', 'driver_arriving', 'in_ride', 'arrived_pay'].includes(currentScreen)) {
        setScreen('home');
      }
    }
  };

  // Discover live/started trips (including scheduled trips when driver taps "Start Trip")
  useEffect(() => {
    const riderIdentifier = user?.phone || user?.id;
    if (activeTrip?.id || !riderIdentifier || screen === 'rate_ride') return;

    let cancelled = false;
    const checkActiveTrip = async () => {
      try {
        const res = await fetch(
          `/api/trips/active?riderPhone=${encodeURIComponent(riderIdentifier)}`
        );
        const data = await res.json();
        if (!cancelled && data?.activeTrip) {
          const t = data.activeTrip;
          const isPaidOrFinished =
            t.status === 'completed' ||
            ['paystack_paid', 'cash_collected', 'transfer_confirmed'].includes(t.paymentStatus) ||
            Boolean(t.riderRating) ||
            getCompletedRiderTrips().includes(t.id);
          if (isPaidOrFinished) return;
          setActiveTrip(t);
          applyTripState(t, screen);
        }
      } catch {
        // silent
      }
    };

    checkActiveTrip();
    const interval = setInterval(checkActiveTrip, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeTrip?.id, user?.phone, user?.id, screen]);

  // Poll active trip state from backend
  useEffect(() => {
    if (!activeTrip?.id) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/trips/${activeTrip.id}`);
        const data = await res.json();
        if (data.trip) {
          setActiveTrip(data.trip);
          applyTripState(data.trip, screen);
        }
      } catch (e) {
        // silent
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTrip?.id, screen]);

  // Finding pulse timer
  useEffect(() => {
    let timer: any;
    if (screen === 'finding_driver') {
      timer = setInterval(() => {
        setFindingSeconds((s) => s + 1);
      }, 1000);
    } else {
      setFindingSeconds(0);
    }
    return () => clearInterval(timer);
  }, [screen]);

  // Request Ride
  const handleRequestRide = async () => {
    setBookingError(null);
    setFindingSeconds(0);
    setScreen('finding_driver');
    try {
      const res = await riderFetch('/api/trips/request', {
        method: 'POST',
        body: JSON.stringify({
          riderId: user.id,
          riderName: user.name,
          riderPhone: user.phone,
          pickupName: pickup.name,
          pickupCoords: [pickup.lat, pickup.lng],
          dropoffName: destination.name,
          dropoffCoords: [destination.lat, destination.lng],
          vehicleCategory: selectedCategory,
          fareNaira: farePrices[selectedCategory],
          paymentMethod: 'cash',
          passengers,
          quoteToken: quoteToken || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.trip) {
        setActiveTrip(data.trip);
      } else {
        const errMsg = data.error || 'Could not request ride. Please try again.';
        setBookingError(errMsg);
        setActiveTrip(null);
        setScreen('choose_ride');
      }
    } catch (e: any) {
      console.error('Request ride failed:', e);
      setBookingError(e.message || 'Network connection failed. Please check your internet connection.');
      setActiveTrip(null);
      setScreen('choose_ride');
    }
  };

  // Trigger SOS Alert
  const handleTriggerSos = async () => {
    playKerbSound('sos');
    setSosAlertActive(true);
    try {
      await riderFetch('/api/safety/sos', {
        method: 'POST',
        body: JSON.stringify({
          tripId: activeTrip?.id,
          reporterType: 'rider',
          reporterName: user.name,
          reporterPhone: user.phone,
          emergencyContactPhone: user.emergencyContactPhone,
          vehiclePlate: activeTrip?.vehiclePlate,
          driverName: activeTrip?.driverName,
          locationName: activeTrip?.dropoffName || pickup.name,
          coords: [pickup.lat, pickup.lng],
          description: 'Emergency SOS button triggered from mobile Rider screen.',
        }),
      });
    } catch (e) {
      console.warn('SOS call fallback');
    }
  };

  // Submit Rating
  const handleSubmitRating = async () => {
    const tripId = activeTrip?.id || lastCompletedTripId;
    if (tripId) {
      markRiderTripFinished(tripId);
      try {
        await fetch(`/api/trips/${tripId}/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stars: ratingStars,
            tags: ratingTags,
            comment: ratingComment,
          }),
        });
      } catch (e) {
        console.warn('Rate sync fallback');
      }
    }
    onTripCompleted();
    setScreen('home');
    setActiveTrip(null);
    setPaystackRef(null);
    setPaystackAuthUrl(null);
    setPaystackIsSimulation(false);
    setPaystackError(null);
    setPaystackPaid(false);
    setPaymentTab('cash');
  };

  // Filter and merge locations (curated local points + live geocoded results like Wushishi, Bida, etc.)
  const filteredLocations = (() => {
    const q = searchQuery.toLowerCase().trim();
    const local = FUTMINNA_KEY_LOCATIONS.filter((loc) => {
      const matchesSearch =
        !q ||
        loc.name.toLowerCase().includes(q) ||
        loc.address.toLowerCase().includes(q) ||
        (loc.area && loc.area.toLowerCase().includes(q)) ||
        (loc.lga && loc.lga.toLowerCase().includes(q)) ||
        (loc.category && loc.category.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (selectedLgaFilter === 'campus') {
        return loc.category === 'Campus' || (loc.area && loc.area.toLowerCase().includes('futminna'));
      }
      if (selectedLgaFilter === 'chanchaga') {
        return loc.lga === 'Chanchaga';
      }
      if (selectedLgaFilter === 'bosso') {
        return loc.lga === 'Bosso';
      }
      return true;
    });

    if (serverLocations.length === 0) return local;

    // Merge server geocoded locations without duplicate names
    const existingNames = new Set(local.map((l) => l.name.toLowerCase()));
    const additional = serverLocations.filter((sl) => !existingNames.has(sl.name.toLowerCase()));
    return [...local, ...additional];
  })();

  return (
    <div className="flex-1 flex flex-col relative bg-white overflow-hidden select-none">
      {/* ============================================================== */}
      {/* R7. HOME SCREEN (MAIN SCREEN) */}
      {/* ============================================================== */}
      {screen === 'home' && (
        <div className="flex-1 flex flex-col relative h-full">
          {/* Map Section */}
          <div className="absolute inset-0 z-0">
            <RealLiveMap
              pickup={{ name: pickup.name, lat: pickup.lat, lng: pickup.lng }}
              destination={{ name: destination.name, lat: destination.lat, lng: destination.lng }}
              stage="idle"
              selectedRide={selectedCategory}
              onAutoLocated={(coords) => {
                const nearest = findNearestLocation(coords.lat, coords.lng);
                const isNearCampus = Math.abs(coords.lat - 9.5330) < 0.035 && Math.abs(coords.lng - 6.4475) < 0.035;
                const displayName = nearest
                  ? `Current Location (${nearest.name})`
                  : isNearCampus
                  ? 'Campus Pick-up (GPS)'
                  : 'My Current Location';
                const detail = nearest ? `Near ${nearest.name} (${nearest.area || 'Minna'})` : `GPS (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
                setPickup({
                  id: 'live_user_gps',
                  name: displayName,
                  address: detail,
                  city: 'Minna',
                  area: nearest?.area || (isNearCampus ? 'FUTMINNA Gidan Kwanu' : 'Current Location'),
                  lat: coords.lat,
                  lng: coords.lng,
                });
              }}
              onSelectPickup={(loc) => {
                setPickup({
                  id: `custom_pickup_${Date.now()}`,
                  name: loc.title,
                  address: loc.detail || 'Pinned Pick-up Point',
                  city: 'Minna',
                  area: 'Pinned Point',
                  lat: loc.lat,
                  lng: loc.lng,
                });
                setPickupFeedback(`Pick-up set to "${loc.title}". Now choose your destination!`);
                setTimeout(() => setPickupFeedback(null), 6000);
              }}
              onSelectDestination={(loc) => {
                setDestination({
                  id: `custom_dest_${Date.now()}`,
                  name: loc.title,
                  address: loc.detail || 'Pinned Destination',
                  city: 'Minna',
                  area: 'Pinned Point',
                  lat: loc.lat,
                  lng: loc.lng,
                });
                setScreen('choose_ride');
              }}
            />
          </div>

          {/* Top Controls Bar */}
          <div className="relative z-10 flex items-center justify-between p-4 pointer-events-auto">
            {/* 44dp Hamburger Menu / Profile Avatar */}
            <button
              onClick={onOpenMenu}
              className="w-11 h-11 bg-white rounded-full shadow-md flex items-center justify-center text-[#14201A] border-2 border-[#DDE3DF] hover:bg-[#F3F6F4] overflow-hidden transition-all"
              aria-label="Menu"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {/* Logo Badge */}
            <div className="px-3.5 py-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-md border border-[#DDE3DF] flex items-center gap-1.5 font-bold text-sm text-[#0E7C3A]">
              <span>Zylift</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#1B9E4B]" />
              <span className="text-xs text-[#7A857F] font-normal">FUTMINNA</span>
            </div>

            {/* 44dp Notification Bell with unread dot */}
            <button
              onClick={onOpenNotifications}
              className="relative w-11 h-11 bg-white rounded-full shadow-md flex items-center justify-center text-[#14201A] border border-[#DDE3DF] hover:bg-[#F3F6F4]"
              aria-label="Notifications"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-[#D93A3A] rounded-full border-2 border-white" />
            </button>
          </div>

          {/* Active Campus Broadcast Banner */}
          {activeBroadcast && activeBroadcast.id !== dismissedBroadcastId && (
            <div className="relative z-20 mx-4 mb-2 p-3 bg-[#E6F4EC] border border-[#0E7C3A] rounded-2xl shadow-md flex items-start justify-between gap-2 animate-fadeIn">
              <div className="flex items-start gap-2 text-xs min-w-0 pr-1">
                <span className="text-base leading-none">📢</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-[#0E7C3A] text-xs">{activeBroadcast.title}</span>
                    <span className="text-[9px] font-bold bg-[#0E7C3A] text-white px-1.5 py-0.2 rounded-full uppercase">Broadcast</span>
                  </div>
                  <p className="text-[11px] text-[#14201A] font-medium mt-0.5 leading-snug">{activeBroadcast.body}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissedBroadcastId(activeBroadcast.id)}
                className="text-slate-400 hover:text-slate-600 p-1 text-xs font-bold shrink-0 cursor-pointer"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {/* Active Pick-up Set Toast Notification */}
          {pickupFeedback && (
            <div className="relative z-20 mx-4 mb-2 p-3 bg-[#0E7C3A] text-white rounded-2xl shadow-xl flex items-center justify-between border border-[#1B9E4B] animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-semibold min-w-0 pr-2">
                <CheckCircle className="w-4 h-4 text-white shrink-0" />
                <span className="truncate">{pickupFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveSelector('dropoff');
                  setScreen('pickup_dropoff');
                }}
                className="px-2.5 py-1 bg-white text-[#0E7C3A] rounded-xl text-xs font-bold hover:bg-[#E6F4EC] shrink-0 shadow-sm transition-all"
              >
                Where to? →
              </button>
            </div>
          )}

          {/* Yellow warning banner if low drivers */}
          {onlineDriverCount <= 1 && (
            <div className="relative z-10 mx-4 mb-2 p-3 bg-[#FFF8E6] border border-[#E69500] rounded-xl flex items-center gap-2 text-xs text-[#E69500] font-semibold">
              <AlertTriangle className="w-4 h-4 text-[#E69500] shrink-0" />
              <span>Few drivers online right now. Peak waiting time may be longer.</span>
            </div>
          )}

          {/* Spacer pushing bottom sheet down */}
          <div className="flex-1 pointer-events-none" />

          {/* Bottom Sheet (38% height) */}
          <KerbBottomSheet className="relative z-10 p-4 max-h-[50%] flex flex-col justify-between">
            <div>
              {/* Pick-up Point Indicator Card */}
              <div className="flex items-center justify-between p-2.5 mb-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#0E7C3A] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 text-left">
                    <span className="text-[10px] uppercase font-bold text-[#7A857F] tracking-wide block">Pick-up Location</span>
                    <p className="text-xs font-bold text-[#14201A] truncate">{pickup.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSelector('pickup');
                    setScreen('pickup_dropoff');
                  }}
                  className="text-xs font-bold text-[#0E7C3A] hover:bg-[#E6F4EC] px-2.5 py-1 bg-white rounded-lg border border-[#DDE3DF] shrink-0 transition-all shadow-2xs"
                >
                  Change
                </button>
              </div>

              {/* 56dp "Where to?" Search Bar */}
              <div
                onClick={() => {
                  setActiveSelector('dropoff');
                  setScreen('pickup_dropoff');
                }}
                className="w-full h-14 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] px-4 flex items-center gap-3 cursor-pointer hover:border-[#0E7C3A] transition-all shadow-sm"
              >
                <div className="w-8 h-8 rounded-full bg-[#E6F4EC] flex items-center justify-center text-[#0E7C3A]">
                  <Search className="w-4 h-4 text-[#0E7C3A]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-base font-semibold text-[#14201A]">Where to?</p>
                  <p className="text-xs text-[#7A857F]">Hostels, Library, SEET, Gate...</p>
                </div>
                <span className="text-xs font-bold px-2 py-1 bg-white rounded-md border border-[#DDE3DF] text-[#0E7C3A]">
                  Fixed Price
                </span>
              </div>

              {/* Quick Chips Row */}
              <div className="flex items-center gap-2 overflow-x-auto py-3 no-scrollbar">
                {[
                  { label: 'Hostels', loc: FUTMINNA_KEY_LOCATIONS[4] },
                  { label: 'Library', loc: FUTMINNA_KEY_LOCATIONS[3] },
                  { label: 'SEET Complex', loc: FUTMINNA_KEY_LOCATIONS[5] },
                  { label: 'Main Gate', loc: FUTMINNA_KEY_LOCATIONS[0] },
                  { label: 'Motor Park', loc: FUTMINNA_KEY_LOCATIONS[1] },
                  { label: 'Bosso Campus', loc: FUTMINNA_KEY_LOCATIONS[10] },
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setDestination(chip.loc);
                      setScreen('choose_ride');
                    }}
                    className="flex-shrink-0 px-3 py-1.5 bg-[#F3F6F4] hover:bg-[#E6F4EC] hover:text-[#0E7C3A] rounded-full text-xs font-semibold text-[#3E4A43] border border-[#DDE3DF] transition-all"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Places List */}
            <div className="border-t border-[#DDE3DF] pt-2">
              <div
                onClick={() => {
                  setDestination(FUTMINNA_KEY_LOCATIONS[4]);
                  setScreen('choose_ride');
                }}
                className="flex items-center gap-3 py-2 cursor-pointer hover:bg-[#F3F6F4] rounded-xl px-2"
              >
                <div className="w-8 h-8 rounded-full bg-[#F3F6F4] flex items-center justify-center text-sm">
                  <Clock className="w-4 h-4 text-[#7A857F]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-[#14201A]">Student Hostels (Block B)</p>
                  <p className="text-xs text-[#7A857F]">Hostel Village · ₦200 by Keke</p>
                </div>
                <span className="text-xs text-[#0E7C3A] font-bold">&rarr;</span>
              </div>
            </div>
          </KerbBottomSheet>
        </div>
      )}

      {/* ============================================================== */}
      {/* R8. PICK-UP AND DESTINATION SELECTION */}
      {/* ============================================================== */}
      {screen === 'pickup_dropoff' && (
        <div className="flex-1 flex flex-col bg-white p-4 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setScreen('home')}
              className="w-10 h-10 rounded-full bg-[#F3F6F4] flex items-center justify-center text-[#14201A] font-bold"
            >
              &larr;
            </button>
            <h2 className="text-lg font-bold text-[#14201A]">Choose your route</h2>
          </div>

          {/* Dotted Route Box */}
          <div className="bg-[#F3F6F4] rounded-2xl p-3 border border-[#DDE3DF] mb-4">
            {/* Pickup */}
            <div
              onClick={() => setActiveSelector('pickup')}
              className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                activeSelector === 'pickup' ? 'bg-white border border-[#0E7C3A] shadow-sm' : ''
              }`}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-[#0E7C3A] border-2 border-white shadow flex-shrink-0" />
              <div className="flex-1">
                <span className="text-[10px] font-bold uppercase text-[#7A857F]">Pick-up</span>
                <p className="text-sm font-bold text-[#14201A] truncate">{pickup.name}</p>
              </div>
            </div>

            {/* Dotted connector */}
            <div className="ml-4 my-1 border-l-2 border-dashed border-[#7A857F] h-4" />

            {/* Destination */}
            <div
              onClick={() => setActiveSelector('dropoff')}
              className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                activeSelector === 'dropoff' ? 'bg-white border border-[#0E7C3A] shadow-sm' : ''
              }`}
            >
              <div className="w-3.5 h-3.5 bg-[#D93A3A] rounded-sm border border-white shadow flex-shrink-0" />
              <div className="flex-1">
                <span className="text-[10px] font-bold uppercase text-[#7A857F]">Destination</span>
                <p className="text-sm font-bold text-[#14201A] truncate">{destination.name}</p>
              </div>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeSelector === 'pickup' ? 'pickup point' : 'destination'}...`}
              className="w-full p-3 pl-10 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-sm text-[#14201A] outline-none focus:border-[#0E7C3A]"
            />
            <span className="absolute left-3.5 top-3 text-neutral-400">
              <Search className="w-4 h-4 text-[#7A857F]" />
            </span>
          </div>

          {/* LGA & Area Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1 no-scrollbar">
            {[
              { id: 'all', label: 'All Minna' },
              { id: 'campus', label: 'FUTMINNA Campus' },
              { id: 'chanchaga', label: 'Chanchaga LGA (City Core)' },
              { id: 'bosso', label: 'Bosso LGA & Airport' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedLgaFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all border ${
                  selectedLgaFilter === tab.id
                    ? 'bg-[#0E7C3A] text-white border-[#0E7C3A]'
                    : 'bg-[#F3F6F4] text-[#3E4A43] border-[#DDE3DF] hover:bg-[#E6F4EC]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Location Results List */}
          <div className="flex-1 overflow-y-auto space-y-1 divide-y divide-[#F3F6F4]">
            {filteredLocations.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#7A857F]">
                No places found matching &ldquo;{searchQuery}&rdquo;. Try another name or tap the map to pin any custom point.
              </div>
            ) : (
              filteredLocations.map((loc) => (
                <div
                  key={loc.id}
                  onClick={() => {
                    if (activeSelector === 'pickup') {
                      setPickup(loc);
                      setActiveSelector('dropoff');
                    } else {
                      setDestination(loc);
                      setScreen('choose_ride');
                    }
                  }}
                  className="pt-2.5 pb-2.5 px-2 flex items-center justify-between cursor-pointer hover:bg-[#F3F6F4] rounded-xl transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center font-bold text-xs flex-shrink-0">
                      <Navigation className="w-3.5 h-3.5 text-[#0E7C3A]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold text-[#14201A] truncate">{loc.name}</p>
                        {loc.lga && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              loc.lga === 'Chanchaga'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {loc.lga} LGA
                          </span>
                        )}
                        {loc.category && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {loc.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#7A857F] truncate">{loc.address}</p>
                    </div>
                  </div>
                  <span className="text-xs text-[#0E7C3A] font-semibold flex-shrink-0 ml-2">Select</span>
                </div>
              ))
            )}
          </div>

          {/* Done Button */}
          <div className="pt-3 border-t border-[#DDE3DF]">
            <KerbButton onClick={() => setScreen('choose_ride')}>
              Confirm Route &rarr;
            </KerbButton>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* R9. CHOOSE A RIDE & FIXED PRICE (5 CAMPUS VEHICLES) */}
      {/* ============================================================== */}
      {screen === 'choose_ride' && (
        <div className="flex-1 flex flex-col relative h-full">
          {/* Top 35% Map */}
          <div className="h-[32%] w-full relative z-0">
            <RealLiveMap
              pickup={{ name: pickup.name, lat: pickup.lat, lng: pickup.lng }}
              destination={{ name: destination.name, lat: destination.lat, lng: destination.lng }}
              stage="choose"
              selectedRide={selectedCategory}
            />
            <button
              onClick={() => setScreen('pickup_dropoff')}
              className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-[#14201A] font-bold"
            >
              &larr;
            </button>
          </div>

          {/* Bottom Sheet */}
          <KerbBottomSheet className="flex-1 p-4 flex flex-col justify-between overflow-y-auto">
            <div>
              {/* Header with Green Lock Badge */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-xl font-bold text-[#14201A]">Choose a ride</h2>
                  <p className="text-xs text-[#7A857F] truncate max-w-[220px]">
                    {pickup.name} &rarr; {destination.name}
                  </p>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 bg-[#E6F4EC] rounded-full text-xs font-bold text-[#0E7C3A] border border-[#0E7C3A]/20 shadow-sm">
                  <Lock className="w-3 h-3 text-[#0E7C3A]" />
                  <span>{quoteData?.isCampusFlatFare ? 'Campus flat fare' : 'Locked price (10 min)'}</span>
                </div>
              </div>

              {/* Road Distance & Duration Metrics */}
              {quoteData && quoteData.distanceKm && !quoteData.isCampusFlatFare && (
                <div className="mb-2.5 px-3 py-2 bg-[#EBF3FF] rounded-xl border border-[#2563EB]/20 flex items-center justify-between text-xs font-semibold text-[#1E40AF]">
                  <span className="flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>{quoteData.distanceKm} km · ~{quoteData.durationMinutes} mins</span>
                  </span>
                  {quoteData.approximate ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white px-2 py-0.5 rounded-md text-[#B45309] border border-[#F59E0B]/30">
                      Approx. road estimate
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white px-2 py-0.5 rounded-md text-[#2563EB]">
                      OpenRouteService
                    </span>
                  )}
                </div>
              )}

              {/* Passenger Group Selector */}
              <div className="mb-3 p-2.5 bg-[#F8FAF9] rounded-2xl border border-[#DDE3DF] flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center font-bold shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#14201A] block">
                      {passengers === 1 ? '1 Passenger Seat' : `${passengers} Passenger Seats`}
                    </span>
                    <span className="text-[10px] text-[#7A857F]">
                      {passengers <= 2
                        ? 'Okada (1–2), Keke (1–5) & Car (1–10) eligible'
                        : passengers <= 5
                        ? 'Keke (1–5) & Car (1–10) eligible'
                        : passengers <= 10
                        ? 'Car (1–10) & Small Bus (8–18) eligible'
                        : passengers <= 18
                        ? 'Small Bus (8–18) eligible'
                        : 'Big Bus (19–80 seats) eligible'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded-xl border-2 border-[#DDE3DF] focus-within:border-[#0E7C3A] shadow-2xs transition-colors">
                  <button
                    type="button"
                    onClick={() => setPassengers((p) => Math.max(1, (p || 1) - 1))}
                    disabled={passengers <= 1}
                    className="w-7 h-7 rounded-lg bg-[#F3F6F4] hover:bg-[#E6F4EC] text-[#14201A] font-black text-base flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
                    title="Decrease seats"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={80}
                    value={passengers || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (isNaN(val) || val <= 0) {
                        setPassengers(1);
                      } else {
                        setPassengers(Math.max(1, Math.min(80, val)));
                      }
                    }}
                    className="w-9 text-center font-black text-sm text-[#0E7C3A] bg-transparent outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    title="Type number of passenger seats"
                  />
                  <button
                    type="button"
                    onClick={() => setPassengers((p) => Math.min(80, (p || 1) + 1))}
                    disabled={passengers >= 80}
                    className="w-7 h-7 rounded-lg bg-[#F3F6F4] hover:bg-[#E6F4EC] text-[#14201A] font-black text-base flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
                    title="Increase seats"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Dynamic Vehicle Cards from Distance / Campus Pricing Engine */}
              <div className="space-y-2">
                {isQuoting ? (
                  <div className="p-6 text-center text-xs text-[#7A857F] flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#0E7C3A]" />
                    <span>Calculating road distance & fares...</span>
                  </div>
                ) : quoteData?.requiresManualQuote ? (
                  <div className="p-4 bg-[#FFF8E6] border border-[#E69500]/30 rounded-2xl text-left">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-[#E69500] shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-xs text-[#8A5A00]">Intercity Route Quote Required</h4>
                        <p className="text-[11px] text-[#8A5A00]/90 mt-1 leading-relaxed">
                          This trip is {quoteData.distanceKm} km. Long-distance trips over 250 km require driver confirmation.
                        </p>
                        <a
                          href={`https://wa.me/message/2ZWD6T2KUU5PK1?text=${encodeURIComponent(
                            `Hello Zylift Support, I want to book an intercity trip from ${pickup.name} to ${destination.name} (${passengers} passengers, ~${quoteData.distanceKm} km). Please provide a quote.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 px-3.5 py-2 bg-[#0E7C3A] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 inline-flex"
                        >
                          <MessageSquare className="w-4 h-4" /> Request Custom Intercity Quote
                        </a>
                      </div>
                    </div>
                  </div>
                ) : quoteData?.options && quoteData.options.length > 0 ? (
                  quoteData.options.map((opt) => {
                    const isSelected = selectedCategory === opt.category;
                    return (
                      <div
                        key={opt.category}
                        onClick={() => setSelectedCategory(opt.category as any)}
                        className={`p-3 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#0E7C3A] bg-[#E6F4EC]/30 shadow-md scale-[1.01]'
                            : 'border-[#DDE3DF] bg-white hover:border-[#0E7C3A]/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {opt.category === 'okada' ? (
                            <div className="w-11 h-11 rounded-2xl bg-[#FFF1EB] border border-[#F26A1B] flex items-center justify-center shadow-inner">
                              <Bike className="w-5 h-5 text-[#F26A1B]" />
                            </div>
                          ) : opt.category === 'cab_go' ? (
                            <div className="w-11 h-11 rounded-2xl bg-[#EBF3FF] border border-[#2563EB] flex items-center justify-center shadow-inner">
                              <Car className="w-5 h-5 text-[#2563EB]" />
                            </div>
                          ) : opt.category === 'small_bus' ? (
                            <div className="w-11 h-11 rounded-2xl bg-[#E6F4EC] border border-[#0E7C3A] flex items-center justify-center shadow-inner">
                              <Bus className="w-5 h-5 text-[#0E7C3A]" />
                            </div>
                          ) : opt.category === 'big_bus' ? (
                            <div className="w-11 h-11 rounded-2xl bg-[#F5F3FF] border border-[#7C3AED] flex items-center justify-center shadow-inner">
                              <Bus className="w-5 h-5 text-[#7C3AED]" />
                            </div>
                          ) : (
                            <div className="w-11 h-11 rounded-2xl bg-[#FFF8E6] border border-[#F5B800] flex items-center justify-center shadow-inner text-[#F5B800]">
                              <Car className="w-5 h-5 text-[#B45309]" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-sm text-[#14201A] flex items-center gap-1.5">
                              <span>{opt.label}</span>
                              {isSelected && (
                                <span className="w-4 h-4 rounded-full bg-[#0E7C3A] text-white flex items-center justify-center text-[10px]">✓</span>
                              )}
                            </p>
                            <p className="text-xs text-[#7A857F]">
                              {opt.category === 'okada'
                                ? '1–2 seats (+1 Driver · 2–3 people)'
                                : opt.category === 'keke'
                                ? '4–5 seats (+1 Driver · 5–6 people)'
                                : opt.category === 'cab_go'
                                ? '4–10 seats (+1 Driver · 5–11 people)'
                                : opt.category === 'small_bus'
                                ? '8–18 seats (+1 Driver · 9–19 people)'
                                : '19–80 seats (+1 Driver · 20–81 people)'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-[#0E7C3A]">₦{opt.fareNaira.toLocaleString()}</p>
                          <p className="text-[10px] text-[#7A857F]">
                            {passengers > 1 ? (
                              <>₦{((opt as any).perSeatFare || Math.round(opt.fareNaira / passengers)).toLocaleString()}/seat × {passengers} seats</>
                            ) : (
                              quoteData?.isCampusFlatFare ? 'Fixed flat rate (1 seat)' : 'Per seat (1 passenger)'
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  /* Fallback display */
                  <div className="space-y-2">
                    <div
                      onClick={() => setSelectedCategory('keke')}
                      className={`p-3 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                        selectedCategory === 'keke' ? 'border-[#0E7C3A] bg-[#E6F4EC]/30 shadow-md scale-[1.01]' : 'border-[#DDE3DF] bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-[#FFF8E6] border border-[#F5B800] flex items-center justify-center shadow-inner text-[#F5B800]">
                          <Car className="w-5 h-5 text-[#B45309]" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#14201A]">Keke (Tricycle)</p>
                          <p className="text-xs text-[#7A857F]">Up to 4-5 seats · Quick hop</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-[#0E7C3A]">₦{farePrices.keke}</p>
                        <p className="text-[10px] text-[#7A857F]">Exact cash</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Unavailable Vehicles for this Route or Passenger Count */}
              {quoteData?.unavailable && quoteData.unavailable.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-[#DDE3DF]">
                  <button
                    type="button"
                    onClick={() => setShowUnavailable((prev) => !prev)}
                    className="w-full flex items-center justify-between text-[11px] font-bold text-[#7A857F] hover:text-[#14201A] py-1 cursor-pointer"
                  >
                    <span>{quoteData.unavailable.length} vehicle(s) not eligible for this trip</span>
                    {showUnavailable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {showUnavailable && (
                    <div className="space-y-1.5 mt-1.5 animate-fadeIn">
                      {quoteData.unavailable.map((u: any, idx: number) => (
                        <div key={idx} className="p-2.5 bg-[#F8FAF9] rounded-xl flex items-center justify-between text-xs border border-[#DDE3DF]/60">
                          <div>
                            <span className="font-semibold text-[#3E4A43] block">{u.label}</span>
                            <span className="text-[10px] text-[#7A857F]">
                              {u.category === 'okada'
                                ? '1–2 seats (+1 Driver · 2–3 people)'
                                : u.category === 'keke'
                                ? '4–5 seats (+1 Driver · 5–6 people)'
                                : u.category === 'cab_go'
                                ? '4–10 seats (+1 Driver · 5–11 people)'
                                : u.category === 'small_bus'
                                ? '8–18 seats (+1 Driver · 9–19 people)'
                                : '19–80 seats (+1 Driver · 20–81 people)'}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#8A5A00] bg-[#FFF8E6] px-2.5 py-1 rounded-lg border border-[#E69500]/25 font-semibold text-right">
                            {u.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Cash Payment Method Row */}
              <div className="mt-3 p-2.5 bg-[#F3F6F4] rounded-xl flex items-center justify-between border border-[#DDE3DF]">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-[#0E7C3A]" />
                  <span className="text-xs font-bold text-[#14201A]">Cash or Transfer at drop-off</span>
                </div>
                <span className="text-[11px] font-semibold text-[#0E7C3A]">
                  {quoteData?.isCampusFlatFare
                    ? passengers > 1
                      ? `Campus shuttle (${passengers} seats)`
                      : 'Fixed campus rate'
                    : 'Formula rate'}
                </span>
              </div>
            </div>

            {/* Error Banner if booking failed */}
            {bookingError && (
              <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="flex-1 font-medium">{bookingError}</span>
                <button
                  type="button"
                  onClick={() => setBookingError(null)}
                  className="text-red-500 font-bold hover:text-red-800 text-sm leading-none"
                >
                  &times;
                </button>
              </div>
            )}

            {/* 56dp Primary Button */}
            <div className="pt-1">
              <KerbButton
                disabled={Boolean(quoteData?.requiresManualQuote) || isQuoting}
                onClick={handleRequestRide}
              >
                {isQuoting
                  ? 'Calculating fare...'
                  : `Request ${
                      selectedCategory === 'keke'
                        ? 'Keke'
                        : selectedCategory === 'okada'
                        ? 'Okada'
                        : selectedCategory === 'cab_go'
                        ? 'Cab'
                        : selectedCategory === 'small_bus'
                        ? 'Small Bus'
                        : 'Big Bus'
                    } · ₦${(farePrices[selectedCategory] || 200).toLocaleString()}`}
              </KerbButton>
            </div>
          </KerbBottomSheet>
        </div>
      )}

      {/* ============================================================== */}
      {/* R10. FINDING YOUR DRIVER */}
      {/* ============================================================== */}
      {screen === 'finding_driver' && (
        <div className="flex-1 flex flex-col relative h-full">
          {/* Top 55% Map with pulse */}
          <div className="h-[55%] w-full relative z-0">
            <RealLiveMap
              pickup={{ name: pickup.name, lat: pickup.lat, lng: pickup.lng }}
              destination={{ name: destination.name, lat: destination.lat, lng: destination.lng }}
              stage="finding"
              selectedRide={selectedCategory}
            />
            {/* Visual Pulse Wave */}
            {activeTrip?.status !== 'no_drivers_available' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-36 h-36 rounded-full bg-[#0E7C3A]/20 animate-ping" />
              </div>
            )}
          </div>

          {/* Bottom Sheet */}
          <KerbBottomSheet className="flex-1 p-6 flex flex-col justify-between">
            {activeTrip?.status === 'no_drivers_available' ? (
              <div className="text-center py-1">
                <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-3 shadow-sm">
                  <AlertCircle className="w-7 h-7 text-amber-600" />
                </div>
                <h2 className="text-xl font-bold text-[#14201A] mb-1">
                  No Drivers Available
                </h2>
                <p className="text-sm text-[#7A857F] mb-4 leading-relaxed">
                  {activeTrip?.cancellationReason || `All ${selectedCategory === 'cab_go' ? 'cabs' : selectedCategory} are currently occupied or offline right now. Tap retry or select another vehicle.`}
                </p>

                <div className="p-3 bg-[#F3F6F4] rounded-xl text-xs text-[#3E4A43] flex items-center justify-between mb-4">
                  <span>Target fare locked:</span>
                  <span className="font-bold text-[#0E7C3A] text-sm">₦{farePrices[selectedCategory]} cash</span>
                </div>

                <div className="space-y-2.5 pt-1">
                  <KerbButton
                    onClick={() => handleRequestRide()}
                  >
                    Retry Search
                  </KerbButton>
                  <KerbButton
                    variant="secondary"
                    onClick={() => {
                      setActiveTrip(null);
                      setScreen('choose_ride');
                    }}
                  >
                    Choose Different Vehicle
                  </KerbButton>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#E6F4EC] flex items-center justify-center text-[#0E7C3A] mb-3">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0E7C3A]" />
                </div>
                <h2 className="text-xl font-bold text-[#14201A] mb-1">
                  Finding your driver...
                </h2>
                <p className="text-sm text-[#7A857F] mb-4">
                  Connecting with nearest {selectedCategory === 'cab_go' ? 'Cab' : selectedCategory} at School Park ({findingSeconds}s)
                </p>

                {/* Thin green progress bar */}
                <div className="w-full bg-[#F3F6F4] h-2 rounded-full overflow-hidden border border-[#DDE3DF] mb-6">
                  <div
                    className="bg-[#0E7C3A] h-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (findingSeconds / 15) * 100)}%` }}
                  />
                </div>

                <div className="p-3 bg-[#F3F6F4] rounded-xl text-xs text-[#3E4A43] flex items-center justify-between">
                  <span>Fixed fare locked:</span>
                  <span className="font-bold text-[#0E7C3A] text-sm">₦{farePrices[selectedCategory]} cash</span>
                </div>
              </div>
            )}

            {/* Cancel Button */}
            {activeTrip?.status !== 'no_drivers_available' && (
              <div className="pt-4">
                <KerbButton
                  variant="secondary"
                  onClick={async () => {
                    if (activeTrip?.id) {
                      await fetch(`/api/trips/${activeTrip.id}/cancel`, { method: 'POST' });
                    }
                    setActiveTrip(null);
                    setScreen('choose_ride');
                  }}
                >
                  Cancel Search
                </KerbButton>
              </div>
            )}
          </KerbBottomSheet>
        </div>
      )}

      {/* ============================================================== */}
      {/* R11. DRIVER FOUND & R12. DRIVER ARRIVING */}
      {/* ============================================================== */}
      {(screen === 'driver_found' || screen === 'driver_arriving') && activeTrip && (
        <div className="flex-1 flex flex-col relative h-full animate-fadeIn">
          {/* Top 50% Map */}
          <div className="h-[48%] w-full relative z-0">
            <RealLiveMap
              pickup={{ name: pickup.name, lat: pickup.lat, lng: pickup.lng }}
              destination={{ name: destination.name, lat: destination.lat, lng: destination.lng }}
              stage="matched"
              selectedRide={selectedCategory}
            />
          </div>

          {/* Bottom Sheet */}
          <KerbBottomSheet className="flex-1 p-5 flex flex-col justify-between overflow-y-auto">
            <div>
              {/* Green status banner */}
              <div className="bg-[#E6F4EC] border border-[#1B9E4B] rounded-xl p-2.5 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1B9E4B] animate-ping" />
                  <span className="text-xs font-bold text-[#0E7C3A]">
                    {screen === 'driver_arriving'
                      ? 'Your driver has arrived at pickup!'
                      : 'Driver accepted · Arriving in 2-3 mins'}
                  </span>
                </div>
                <span className="text-xs font-black text-[#0E7C3A]">₦{activeTrip.fareNaira}</span>
              </div>

              {/* Driver Details & Vehicle Plate */}
              <div className="flex items-center justify-between p-3 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-[#DDE3DF] overflow-hidden flex items-center justify-center text-[#0E7C3A] shadow-sm relative shrink-0">
                    <User className="w-7 h-7 text-[#7A857F]" />
                    {activeTrip.driverAvatarUrl && !String(activeTrip.driverAvatarUrl).includes('driver_avatar_keke_1790847258442') && (
                      <img
                        src={activeTrip.driverAvatarUrl}
                        alt={activeTrip.driverName || 'Campus Driver'}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-base text-[#14201A]">{activeTrip.driverName || 'Campus Driver'}</p>
                      <span className="text-xs font-bold text-[#E69500]">★ 4.92</span>
                    </div>
                    <p className="text-xs text-[#7A857F] mb-1">{activeTrip.vehicleModel || 'Campus Vehicle'}</p>
                    <KerbPlateBadge plate={activeTrip.vehiclePlate || 'CAMPUS RIDE'} />
                  </div>
                </div>
              </div>

              {/* Safety PIN Box */}
              <div className="p-4 bg-white border-2 border-[#0E7C3A] rounded-2xl shadow-sm text-center mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A857F] block mb-1">
                  Safety Verification PIN
                </span>
                <KerbPinDisplay pin={activeTrip.safetyPin || '4821'} />
                <p className="text-xs font-semibold text-[#14201A] mt-2">
                  Tell this 4-digit PIN to your driver to start the trip
                </p>
              </div>

              {/* Action Buttons: Call, Message, Share */}
              {(() => {
                const driverDisplayName = activeTrip.driverName || 'Driver';
                const cleanPhone = (activeTrip.driverPhone || '').replace(/[\s-]/g, '');
                return (
                  <div className="grid grid-cols-3 gap-2">
                    <a
                      href={cleanPhone ? `tel:${cleanPhone}` : '#'}
                      onClick={(e) => {
                        if (!cleanPhone) {
                          e.preventDefault();
                          alert('Driver contact number is not available yet.');
                        }
                      }}
                      className="py-2.5 px-3 bg-[#F3F6F4] hover:bg-[#E6F4EC] rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-[#14201A] border border-[#DDE3DF]"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#14201A]" />
                      <span>Call</span>
                    </a>
                    <a
                      href={cleanPhone ? `sms:${cleanPhone}?body=${encodeURIComponent(`Hello ${driverDisplayName}, I am at ${activeTrip.pickupName || 'the pickup point'}.`)}` : '#'}
                      onClick={(e) => {
                        if (!cleanPhone) {
                          e.preventDefault();
                          alert('Driver contact number is not available yet.');
                        }
                      }}
                      className="py-2.5 px-3 bg-[#F3F6F4] hover:bg-[#E6F4EC] rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-[#14201A] border border-[#DDE3DF]"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#14201A]" />
                      <span>Message</span>
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/trip-share/${activeTrip.shareToken}`
                        );
                        alert('Trip share link copied to clipboard!');
                      }}
                      className="py-2.5 px-3 bg-[#F3F6F4] hover:bg-[#E6F4EC] rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-[#14201A] border border-[#DDE3DF]"
                    >
                      <Share2 className="w-3.5 h-3.5 text-[#14201A]" />
                      <span>Share</span>
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Waiting for Driver to Enter PIN Status Banner */}
            <div className="pt-3">
              <div className="p-3.5 bg-[#E6F4EC] rounded-2xl border border-[#0E7C3A] flex items-center justify-center gap-2.5 shadow-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1B9E4B] animate-ping" />
                <span className="text-xs font-bold text-[#0E7C3A]">
                  Waiting for driver to verify your PIN...
                </span>
              </div>
            </div>
          </KerbBottomSheet>
        </div>
      )}

      {/* ============================================================== */}
      {/* R13. IN RIDE (TRIP IN PROGRESS) */}
      {/* ============================================================== */}
      {screen === 'in_ride' && activeTrip && (
        <div className="flex-1 flex flex-col relative h-full">
          {/* Top Destination & Fare Bar */}
          <div className="relative z-10 p-3 bg-white shadow-md border-b border-[#DDE3DF] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-[#7A857F]">In Trip</span>
              <p className="text-sm font-bold text-[#14201A] truncate max-w-[200px]">
                To {activeTrip.dropoffName}
              </p>
            </div>
            <div className="text-right">
              <span className="text-base font-extrabold text-[#0E7C3A]">₦{activeTrip.fareNaira}</span>
              <span className="block text-[10px] text-[#7A857F]">Cash</span>
            </div>
          </div>

          {/* Full Screen Map */}
          <div className="flex-1 w-full relative z-0">
            <RealLiveMap
              pickup={{ name: pickup.name, lat: pickup.lat, lng: pickup.lng }}
              destination={{ name: destination.name, lat: destination.lat, lng: destination.lng }}
              stage="dispatch"
              selectedRide={selectedCategory}
            />
          </div>

          {/* Bottom Card with Red Safety Shield */}
          <KerbBottomSheet className="relative z-10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E6F4EC] flex items-center justify-center font-bold text-[#0E7C3A] overflow-hidden relative shrink-0 border border-[#DDE3DF]">
                  <Car className="w-5 h-5 text-[#0E7C3A]" />
                  {activeTrip.driverAvatarUrl && !String(activeTrip.driverAvatarUrl).includes('driver_avatar_keke_1790847258442') && (
                    <img
                      src={activeTrip.driverAvatarUrl}
                      alt={activeTrip.driverName || 'Driver'}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#14201A]">{activeTrip.driverName}</p>
                  <p className="text-xs text-[#7A857F]">{activeTrip.vehiclePlate}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/trip-share/${activeTrip.shareToken}`
                  );
                  alert('Live trip share link copied!');
                }}
                className="text-xs font-bold text-[#0E7C3A] px-2.5 py-1.5 bg-[#E6F4EC] rounded-lg flex items-center gap-1"
              >
                <Share2 className="w-3 h-3 text-[#0E7C3A]" />
                <span>Share</span>
              </button>
            </div>

            {/* Red Shield Emergency Action Button (56dp, #D93A3A) */}
            <button
              onClick={() => setShowSosModal(true)}
              className="w-full h-14 bg-[#D93A3A] hover:bg-[#b52b2b] text-white rounded-2xl flex items-center justify-center gap-2 font-bold text-base shadow-lg transition-all"
            >
              <Shield className="w-6 h-6 text-white" />
              <span>Emergency SOS</span>
            </button>

            {/* Ride Status Indicator */}
            <div className="mt-3 p-3 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] text-center">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#0E7C3A]">
                <span className="w-2 h-2 rounded-full bg-[#1B9E4B] animate-ping" />
                <span>Trip in progress · Heading to {activeTrip.dropoffName}</span>
              </div>
            </div>
          </KerbBottomSheet>
        </div>
      )}

      {/* ============================================================== */}
      {/* R14. ARRIVED AND PAY (CASH & BANK TRANSFER / PAYSTACK) */}
      {/* ============================================================== */}
      {screen === 'arrived_pay' && activeTrip && (
        <div className="flex-1 flex flex-col justify-between p-5 bg-white animate-fadeIn text-center overflow-y-auto">
          <div className="pt-4">
            <div className="w-16 h-16 rounded-full bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center mx-auto mb-2 shadow-sm">
              <Check className="w-8 h-8 text-[#0E7C3A]" />
            </div>
            <h2 className="text-xl font-bold text-[#14201A] mb-0.5">You have arrived!</h2>
            <p className="text-xs text-[#7A857F] mb-4">{activeTrip.dropoffName}</p>

            {/* Payment Method Switcher (2 Options: Cash to Driver or Paystack Split) */}
            <div className="grid grid-cols-2 p-1 bg-[#F3F6F4] rounded-2xl border border-[#DDE3DF] mb-2">
              <button
                type="button"
                onClick={() => setPaymentTab('cash')}
                className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  paymentTab === 'cash' ? 'bg-white shadow text-[#0E7C3A]' : 'text-[#7A857F]'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Cash to Driver</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeTrip?.driverHasBank === false) {
                    alert(`${activeTrip.driverName || 'Driver'} has not connected a bank account yet. Online transfer is unavailable for this ride. Please pay with Cash.`);
                    return;
                  }
                  setPaymentTab('paystack');
                }}
                disabled={activeTrip?.driverHasBank === false}
                className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeTrip?.driverHasBank === false
                    ? 'opacity-40 cursor-not-allowed text-[#7A857F]'
                    : paymentTab === 'paystack'
                    ? 'bg-white shadow text-[#0E7C3A] cursor-pointer'
                    : 'text-[#7A857F] cursor-pointer'
                }`}
                title={activeTrip?.driverHasBank === false ? 'Driver has not connected a bank account' : ''}
              >
                <CreditCard className="w-4 h-4" />
                <span>Paystack (Card/Transfer)</span>
              </button>
            </div>

            {activeTrip?.driverHasBank === false && (
              <div className="mb-3 p-2.5 bg-[#FFF8E6] border border-[#E69500]/30 rounded-2xl text-[11px] text-[#8A5A00] flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-[#E69500] shrink-0" />
                <span><strong>Cash Only:</strong> {activeTrip.driverName || 'Driver'} has not connected a settlement bank account yet.</span>
              </div>
            )}

            {/* TAB 1: EXACT CASH TO DRIVER */}
            {paymentTab === 'cash' && (
              <div className="animate-fadeIn space-y-3">
                <div className="p-5 bg-[#F3F6F4] rounded-3xl border border-[#DDE3DF] text-center">
                  <span className="text-[10px] font-bold uppercase text-[#7A857F] block">Exact Fare Due</span>
                  <p className="text-4xl font-black text-[#0E7C3A] my-1">₦{activeTrip.fareNaira}</p>
                  <p className="text-xs font-semibold text-[#14201A]">
                    Hand physical cash directly to {activeTrip.driverName}
                  </p>
                  <p className="text-[11px] text-[#7A857F] mt-1">
                    Your driver will confirm receipt on their device at drop-off.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-[11px] text-[#7A857F]">
                  <Shield className="w-3.5 h-3.5 text-[#0E7C3A]" />
                  <span>Exact trip pricing · No hidden deductions</span>
                </div>
              </div>
            )}

            {/* TAB 2: PAYSTACK AUTOMATED SPLIT (CARD / TRANSFER / USSD) */}
            {paymentTab === 'paystack' && (
              <div className="animate-fadeIn space-y-3">
                <div className="p-4 bg-[#F3F6F4] rounded-3xl border border-[#DDE3DF] text-left">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase text-[#0E7C3A] bg-[#E6F4EC] px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Shield className="w-3 h-3 text-[#0E7C3A]" />
                      Paystack Split Payment
                    </span>
                    <span className="text-sm font-black text-[#0E7C3A]">₦{activeTrip.fareNaira}</span>
                  </div>

                  <p className="text-xs text-[#14201A] font-semibold mb-1">
                    Pay ₦{activeTrip.fareNaira} securely for this ride
                  </p>
                  <p className="text-[11px] text-[#7A857F] leading-relaxed">
                    Pay with Debit Card, Bank Transfer, or USSD. Fares are automatically split and settled directly to {activeTrip.driverName}&apos;s registered Nigerian bank account upon payment.
                  </p>

                  {paystackError && (
                    <div className="mt-3 p-2.5 bg-[#FDE8E8] border border-[#D93A3A]/30 rounded-xl text-xs font-semibold text-[#D93A3A]">
                      {paystackError}
                    </div>
                  )}

                  {paystackRef && (
                    <div className="mt-3 p-3 bg-white rounded-xl border border-[#DDE3DF] space-y-2.5">
                      <div className="text-center">
                        <p className="text-[10px] text-[#7A857F] uppercase font-bold">Transaction Reference</p>
                        <p className="text-xs font-mono font-bold text-[#0E7C3A] break-all">{paystackRef}</p>
                      </div>

                      {paystackIsSimulation ? (
                        <div className="space-y-2 pt-1 border-t border-[#F3F6F4]">
                          <p className="text-[11px] font-bold text-[#8A5A00] bg-[#FFF8E6] px-2.5 py-1.5 rounded-lg text-center">
                            Sandbox Checkout · Choose payment method below
                          </p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { id: 'card', label: 'Card' },
                              { id: 'bank_transfer', label: 'Transfer' },
                              { id: 'ussd', label: 'USSD' },
                            ].map((ch) => (
                              <button
                                key={ch.id}
                                type="button"
                                onClick={() => setPaystackChannel(ch.id as any)}
                                className={`py-2 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                                  paystackChannel === ch.id
                                    ? 'bg-[#0E7C3A] text-white border-[#0E7C3A]'
                                    : 'bg-[#F3F6F4] text-[#14201A] border-[#DDE3DF]'
                                }`}
                              >
                                {ch.label}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={handleCompleteSandboxPaystack}
                            disabled={paystackLoading}
                            className="w-full py-2.5 bg-[#0E7C3A] hover:bg-[#0B6B45] text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            {paystackLoading
                              ? 'Confirming Payment...'
                              : `Authorize ₦${activeTrip.fareNaira} (${paystackChannel === 'bank_transfer' ? 'Bank Transfer' : paystackChannel.toUpperCase()}) ✓`}
                          </button>
                          {paystackAuthUrl && (
                            <a
                              href={paystackAuthUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full py-2 text-center text-[11px] font-bold text-[#0E7C3A] bg-[#E6F4EC] rounded-xl hover:bg-[#d5ecdf]"
                            >
                              Or Open Full Sandbox Checkout Page &nearr;
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1 border-t border-[#F3F6F4]">
                          {paystackAuthUrl && (
                            <a
                              href={paystackAuthUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full py-2.5 text-center bg-[#0B1C2C] hover:bg-[#132c45] text-white font-bold text-xs rounded-xl shadow-sm"
                            >
                              Open Paystack Checkout Page (₦{activeTrip.fareNaira}) &nearr;
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={handleVerifyPaystackNow}
                            disabled={paystackLoading}
                            className="w-full py-2 bg-[#E6F4EC] hover:bg-[#d5ecdf] text-[#0E7C3A] font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
                          >
                            {paystackLoading ? 'Checking Payment...' : 'I Have Completed Payment · Verify Now'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <KerbButton
                  onClick={handleInitiatePaystack}
                  isLoading={paystackLoading}
                  disabled={paystackLoading}
                >
                  <span className="flex items-center justify-center gap-2">
                    <CreditCard className="w-5 h-5 text-white" />
                    <span>
                      {paystackLoading
                        ? 'Initializing Checkout...'
                        : paystackRef
                        ? `Generate New Payment Link (₦${activeTrip.fareNaira})`
                        : `Pay ₦${activeTrip.fareNaira} via Paystack →`}
                    </span>
                  </span>
                </KerbButton>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4">
            <KerbButton
              onClick={async () => {
                const refToVerify = paystackRef || activeTrip.pendingPaystackReference;
                if (paymentTab === 'paystack' && refToVerify && !paystackPaid) {
                  // Sync any completed Paystack payment immediately before advancing
                  try {
                    await fetch(`/api/payments/paystack/verify/${encodeURIComponent(refToVerify)}`);
                  } catch {}
                }
                markRiderTripFinished(activeTrip.id);
                setLastCompletedTripId(activeTrip.id);
                setScreen('rate_ride');
              }}
            >
              {paymentTab === 'cash' ? 'Done, I Have Paid Cash →' : 'Proceed to Rate Ride →'}
            </KerbButton>

            <button
              type="button"
              onClick={() => onReportProblem(activeTrip.id)}
              className="w-full h-12 bg-white hover:bg-[#FEE2E2] text-[#D93A3A] border-2 border-[#FCA5A5] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-98"
            >
              <AlertTriangle className="w-4 h-4 text-[#D93A3A]" />
              <span>Report a Problem with this Ride</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* R15. RATE YOUR RIDE (INTERACTIVE FEEDBACK FORM & ADMIN DELIVERY) */}
      {/* ============================================================== */}
      {screen === 'rate_ride' && (
        <div className="flex-1 flex flex-col justify-between p-6 bg-white animate-fadeIn text-center overflow-y-auto">
          <div>
            <div className="w-20 h-20 rounded-full bg-[#E6F4EC] flex items-center justify-center text-3xl mx-auto mb-4 border-2 border-[#0E7C3A]">
              <User className="w-10 h-10 text-[#0E7C3A]" />
            </div>
            <h2 className="text-2xl font-bold text-[#14201A] mb-1">
              How was your ride with {activeTrip?.driverName?.split(' ')[0] || 'your driver'}?
            </h2>
            <p className="text-sm text-[#7A857F] mb-6">Your rating keeps FUTMINNA campus rides safe</p>

            {/* 5 Large 44dp Stars */}
            <div className="flex justify-center gap-3 my-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingStars(star)}
                  className="w-11 h-11 text-4xl leading-none transition-transform active:scale-125 focus:outline-none"
                >
                  <span className={star <= ratingStars ? 'text-[#F5B800]' : 'text-[#DDE3DF]'}>
                    ★
                  </span>
                </button>
              ))}
            </div>

            {/* Interactive Rating Tag Chips with Checkmarks */}
            <div className="flex flex-wrap justify-center gap-2 my-4">
              {[
                'Safe driving',
                'Clean vehicle',
                'Polite & respectful',
                'On time',
                'Fair price',
                'Smooth ride',
                'Knows campus routes',
              ].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (ratingTags.includes(tag)) {
                      setRatingTags(ratingTags.filter((t) => t !== tag));
                    } else {
                      setRatingTags([...ratingTags, tag]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    ratingTags.includes(tag)
                      ? 'bg-[#0E7C3A] text-white border-[#0E7C3A] shadow-sm'
                      : 'bg-[#F3F6F4] text-[#3E4A43] border-[#DDE3DF] hover:bg-[#E6F4EC]'
                  }`}
                >
                  {ratingTags.includes(tag) && <Check className="w-3 h-3 text-white" />}
                  <span>{tag}</span>
                </button>
              ))}
            </div>

            {/* Optional Comment */}
            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Leave an optional note..."
              className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-sm text-[#14201A] outline-none focus:border-[#0E7C3A] resize-none h-20"
            />
          </div>

          <div className="space-y-3 pt-6">
            <KerbButton onClick={handleSubmitRating}>
              Submit Rating
            </KerbButton>
            <button
              onClick={() => {
                onTripCompleted();
                setScreen('home');
                setActiveTrip(null);
              }}
              className="text-sm font-semibold text-[#7A857F] hover:text-[#14201A]"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* EMERGENCY SOS MODAL DIALOG */}
      {/* ============================================================== */}
      {showSosModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-slideUp text-center">
            <div className="w-16 h-16 rounded-full bg-[#FDE8E8] text-[#D93A3A] flex items-center justify-center text-3xl mx-auto mb-3">
              <Shield className="w-8 h-8 text-[#D93A3A]" />
            </div>
            <h3 className="text-xl font-extrabold text-[#14201A] mb-1">Emergency SOS</h3>
            <p className="text-xs text-[#7A857F] mb-6">
              Instant contact with campus security & medical services
            </p>

            <div className="space-y-3 mb-6">
              {/* Call Campus Cadets */}
              <a
                href="tel:+2348036120041"
                className="w-full py-3.5 px-4 bg-[#D93A3A] hover:bg-[#b52b2b] text-white font-bold text-sm rounded-xl flex items-center justify-between shadow-md"
              >
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-white" />
                  <span>Call Security Cadets</span>
                </span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono">0803 612 0041</span>
              </a>

              {/* Call Campus Clinic */}
              <a
                href="tel:+2348059182234"
                className="w-full py-3 px-4 bg-[#F3F6F4] hover:bg-[#DDE3DF] text-[#14201A] font-bold text-sm rounded-xl flex items-center justify-between border border-[#DDE3DF]"
              >
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-[#14201A]" />
                  <span>University Clinic</span>
                </span>
                <span className="text-xs font-mono text-[#7A857F]">0805 918 2234</span>
              </a>

              {/* Broadcast Live Incident Alert to Ops HQ */}
              <button
                onClick={handleTriggerSos}
                className="w-full py-2.5 px-4 bg-[#FDE8E8] text-[#D93A3A] font-bold text-xs rounded-xl border border-[#D93A3A]/40"
              >
                {sosAlertActive ? '✓ SOS Beacon Dispatched to Admin HQ' : 'Broadcast Silent SOS to Patrol HQ'}
              </button>
            </div>

            <button
              onClick={() => setShowSosModal(false)}
              className="w-full py-2.5 text-sm font-semibold text-[#7A857F] hover:text-[#14201A]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
