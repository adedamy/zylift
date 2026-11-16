import React, { useState, useEffect } from 'react';
import { ClipboardList, Phone, Car, Bike, Bus } from 'lucide-react';
import { FUTMINNA_KEY_LOCATIONS } from '../../data/futminnaLocations';
import { KerbButton, KerbCard, KerbPlateBadge } from '../Common/KerbComponents';

interface DispatcherAppProps {
  onBackToMain?: () => void;
}

export const DispatcherApp: React.FC<DispatcherAppProps> = ({ onBackToMain }) => {
  // P1. Authentication State
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('zylift_dispatcher_token');
    } catch (e) {
      return null;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem('zylift_dispatcher_token');
    } catch (e) {
      return false;
    }
  });
  const [phone, setPhone] = useState('0814 747 9777');
  const [pin, setPin] = useState('1234');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // P2. Board State
  const [activeTab, setActiveTab] = useState<'waiting' | 'assigned' | 'drivers' | 'summary'>('waiting');
  const [boardData, setBoardData] = useState<{
    waitingRides: any[];
    assignedRides: any[];
    drivers: any[];
  }>({
    waitingRides: [],
    assignedRides: [],
    drivers: [],
  });
  const [loading, setLoading] = useState(true);

  // P3. New Ride Form Modal
  const [showNewRideModal, setShowNewRideModal] = useState(false);
  const [newRiderName, setNewRiderName] = useState('Walk-in Student');
  const [newRiderPhone, setNewRiderPhone] = useState('0812 345 6789');
  const [newPickup, setNewPickup] = useState(FUTMINNA_KEY_LOCATIONS[1]); // School Motor Park
  const [newDropoff, setNewDropoff] = useState(FUTMINNA_KEY_LOCATIONS[4]); // Hostels
  const [newCategory, setNewCategory] = useState<'keke' | 'okada' | 'cab_go'>('keke');
  const [calculatedFare, setCalculatedFare] = useState(200);

  // P4. Assign Driver Modal
  const [selectedRideForAssign, setSelectedRideForAssign] = useState<any>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [smsTemplate, setSmsTemplate] = useState('');
  const [smsCopied, setSmsCopied] = useState(false);

  // Calculate fare when new ride form inputs change
  useEffect(() => {
    fetch('/api/pricing/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickupName: newPickup.name,
        dropoffName: newDropoff.name,
        category: newCategory,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.breakdown?.totalFareNaira) {
          setCalculatedFare(d.breakdown.totalFareNaira);
        }
      })
      .catch(() => setCalculatedFare(200));
  }, [newPickup, newDropoff, newCategory]);

  // Fetch Board Data
  const fetchBoard = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/dispatcher/board', { headers });
      if (res.status === 401) {
        setIsAuthenticated(false);
        setToken(null);
        try {
          localStorage.removeItem('zylift_dispatcher_token');
        } catch (e) {}
        return;
      }
      const data = await res.json();
      if (data.success) {
        setBoardData({
          waitingRides: data.waitingRides || [],
          assignedRides: data.assignedRides || [],
          drivers: data.drivers || [],
        });
      }
    } catch (e) {
      console.warn('Board fetch fallback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchBoard();
      const interval = setInterval(fetchBoard, 4000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, token]);

  // Handle Login (P1)
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError('');
    try {
      const res = await fetch('/api/dispatcher/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        setToken(data.token);
        setIsAuthenticated(true);
        try {
          localStorage.setItem('zylift_dispatcher_token', data.token);
        } catch (e) {}
      } else {
        setAuthError(data.error || 'Incorrect Dispatcher PIN');
      }
    } catch (e) {
      setAuthError('Connection error logging in');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('zylift_dispatcher_token');
    } catch (e) {}
    setToken(null);
    setIsAuthenticated(false);
  };

  // Create Walk-in / Phone-call Ride (P3)
  const handleCreateRide = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch('/api/dispatcher/trips', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          riderName: newRiderName,
          riderPhone: newRiderPhone,
          pickupName: newPickup.name,
          pickupCoords: [newPickup.lat, newPickup.lng],
          dropoffName: newDropoff.name,
          dropoffCoords: [newDropoff.lat, newDropoff.lng],
          vehicleCategory: newCategory,
          driverId: selectedDriverId || boardData.drivers[0]?.id || '',
          dispatcherName: 'School Park Marshal',
        }),
      });

      setShowNewRideModal(false);
      fetchBoard();
    } catch (e) {
      console.error('Create dispatch trip failed:', e);
    }
  };

  // Open Assign Modal and generate SMS Template (P4)
  const handleOpenAssignModal = (ride: any) => {
    setSelectedRideForAssign(ride);
    const candidate = boardData.drivers.find((d) => d.isOnline) || boardData.drivers[0];
    if (candidate) {
      setSelectedDriverId(candidate.id);
      const text = `Zylift: Ride ${ride.pickupName} to ${ride.dropoffName}, ₦${ride.fareNaira} cash. Rider: ${ride.riderName} ${ride.riderPhone}.`;
      setSmsTemplate(text);
    }
  };

  // Confirm manual assignment
  const handleConfirmAssignment = async () => {
    if (!selectedRideForAssign || !selectedDriverId) return;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(`/api/admin/rides/${selectedRideForAssign.id}/reassign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          newDriverId: selectedDriverId,
          reason: 'Manual dispatcher assignment via Park Marshal SMS',
        }),
      });
      setSelectedRideForAssign(null);
      fetchBoard();
    } catch (e) {
      console.error('Assign failed:', e);
    }
  };

  // ==============================================================
  // P1. DISPATCHER LOGIN SCREEN
  // ==============================================================
  if (!isAuthenticated) {
    return (
      <div className="flex-1 min-h-screen bg-[#F3F6F4] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl border border-[#DDE3DF]">
          <div className="flex justify-between items-center mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-[#0E7C3A]" />
            </div>
            {onBackToMain && (
              <button onClick={onBackToMain} className="text-xs text-[#7A857F] hover:underline">
                &larr; Switch Role
              </button>
            )}
          </div>

          <h2 className="text-2xl font-black text-[#14201A] mb-1">Campus Dispatcher</h2>
          <p className="text-xs text-[#7A857F] mb-6">School Motor Park & Gate Terminal</p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] font-bold text-sm text-[#14201A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">4-Digit Marshal PIN</label>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="1234"
                className="w-full p-3.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] font-mono text-center text-xl font-bold tracking-widest text-[#14201A]"
              />
            </div>

            {authError && <p className="text-xs font-bold text-[#D93A3A]">{authError}</p>}

            <div className="pt-2">
              <KerbButton onClick={handleLogin} isLoading={isLoggingIn}>Unlock Dispatch Board &rarr;</KerbButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==============================================================
  // P2. DISPATCH BOARD
  // ==============================================================
  return (
    <div className="flex-1 min-h-screen bg-[#F3F6F4] flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-[#DDE3DF] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0E7C3A] text-white flex items-center justify-center font-black text-lg">
            K
          </div>
          <div>
            <h1 className="text-base font-black text-[#14201A]">FUTMINNA Dispatch Board</h1>
            <p className="text-xs text-[#7A857F]">Motor Park Marshal: Active</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewRideModal(true)}
            className="px-3.5 py-2 bg-[#0E7C3A] text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
          >
            <span>+</span>
            <span>New Ride</span>
          </button>
          <button
            onClick={handleLogout}
            className="p-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            Sign Out
          </button>
          {onBackToMain && (
            <button
              onClick={onBackToMain}
              className="p-2 text-xs font-bold text-[#7A857F] hover:text-[#14201A]"
            >
              Exit
            </button>
          )}
        </div>
      </header>

      {/* Tabs Row */}
      <div className="bg-white border-b border-[#DDE3DF] px-4 flex items-center gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('waiting')}
          className={`py-3 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'waiting'
              ? 'border-[#0E7C3A] text-[#0E7C3A]'
              : 'border-transparent text-[#7A857F]'
          }`}
        >
          <span>Waiting</span>
          <span className="px-1.5 py-0.5 rounded-full bg-[#FFF8E6] text-[#E69500] font-mono">
            {boardData.waitingRides.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('assigned')}
          className={`py-3 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'assigned'
              ? 'border-[#0E7C3A] text-[#0E7C3A]'
              : 'border-transparent text-[#7A857F]'
          }`}
        >
          <span>Assigned / Active</span>
          <span className="px-1.5 py-0.5 rounded-full bg-[#EBF3FF] text-[#2563EB] font-mono">
            {boardData.assignedRides.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('drivers')}
          className={`py-3 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'drivers'
              ? 'border-[#0E7C3A] text-[#0E7C3A]'
              : 'border-transparent text-[#7A857F]'
          }`}
        >
          <span>Drivers</span>
          <span className="px-1.5 py-0.5 rounded-full bg-[#E6F4EC] text-[#1B9E4B] font-mono">
            {boardData.drivers.filter((d) => d.isOnline).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('summary')}
          className={`py-3 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'summary'
              ? 'border-[#0E7C3A] text-[#0E7C3A]'
              : 'border-transparent text-[#7A857F]'
          }`}
        >
          <span>Shift Summary</span>
        </button>
      </div>

      {/* Content Area */}
      <main className="flex-1 p-4 max-w-4xl w-full mx-auto">
        {/* --- TAB: WAITING RIDES --- */}
        {activeTab === 'waiting' && (
          <div className="space-y-3">
            {boardData.waitingRides.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-[#DDE3DF]">
                <span className="text-3xl block mb-2">✓</span>
                <p className="font-bold text-sm text-[#14201A]">No Waiting Rides</p>
                <p className="text-xs text-[#7A857F]">All requested campus rides have been assigned to drivers.</p>
              </div>
            ) : (
              boardData.waitingRides.map((ride) => (
                <div
                  key={ride.id}
                  className={`p-4 bg-white rounded-2xl border-l-4 shadow-sm transition-all ${
                    ride.isOver3Minutes
                      ? 'border-l-[#D93A3A] bg-[#FDE8E8]/10'
                      : 'border-l-[#E69500]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#7A857F]">{ride.id}</span>
                      <span className="text-xs font-bold text-[#14201A]">· {ride.riderName}</span>
                    </div>

                    {/* Wait Timer (Red if > 3 min) */}
                    <div
                      className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1 ${
                        ride.isOver3Minutes
                          ? 'bg-[#FDE8E8] text-[#D93A3A] animate-pulse'
                          : 'bg-[#FFF8E6] text-[#E69500]'
                      }`}
                    >
                      <span>⏱️</span>
                      <span>{Math.floor(ride.waitSeconds / 60)}m {ride.waitSeconds % 60}s</span>
                    </div>
                  </div>

                  <p className="text-sm font-bold text-[#14201A] mb-1">
                    {ride.pickupName} &rarr; {ride.dropoffName}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-[#DDE3DF] mt-2 text-xs">
                    <span className="font-extrabold text-[#0E7C3A]">₦{ride.fareNaira} Cash</span>
                    <button
                      onClick={() => handleOpenAssignModal(ride)}
                      className="px-3 py-1.5 bg-[#0E7C3A] text-white font-bold rounded-xl text-xs shadow-sm"
                    >
                      Assign Driver &rarr;
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* --- TAB: ASSIGNED RIDES --- */}
        {activeTab === 'assigned' && (
          <div className="space-y-3">
            {boardData.assignedRides.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-[#DDE3DF]">
                <p className="font-bold text-sm text-[#14201A]">No Active Trips</p>
                <p className="text-xs text-[#7A857F]">Assigned trips will appear here in real-time.</p>
              </div>
            ) : (
              boardData.assignedRides.map((ride) => (
                <div
                  key={ride.id}
                  className="p-4 bg-white rounded-2xl border-l-4 border-l-[#2563EB] shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-[#7A857F]">{ride.id}</span>
                    <span className="text-xs font-bold text-[#2563EB] px-2 py-0.5 rounded-full bg-[#EBF3FF]">
                      {ride.status.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-[#14201A]">
                    {ride.pickupName} &rarr; {ride.dropoffName}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-[#DDE3DF] mt-2 text-xs">
                    <div>
                      <span className="text-[#7A857F]">Driver: </span>
                      <strong className="text-[#14201A]">{ride.driverName}</strong>
                      <span className="ml-2 font-mono text-[10px] bg-[#F3F6F4] px-1.5 py-0.5 rounded border">
                        {ride.vehiclePlate}
                      </span>
                    </div>
                    <span className="font-extrabold text-[#0E7C3A]">₦{ride.fareNaira}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* --- TAB: DRIVERS --- */}
        {activeTab === 'drivers' && (
          <div className="space-y-3">
            {boardData.drivers.map((drv) => (
              <div
                key={drv.id}
                className="p-3.5 bg-white rounded-2xl border border-[#DDE3DF] shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-11 h-11 rounded-full bg-[#E6F4EC] flex items-center justify-center font-bold">
                      {drv.vehicleCategory === 'okada' ? (
                        <Bike className="w-5 h-5 text-[#0E7C3A]" />
                      ) : drv.vehicleCategory === 'small_bus' || drv.vehicleCategory === 'big_bus' ? (
                        <Bus className="w-5 h-5 text-[#0E7C3A]" />
                      ) : (
                        <Car className="w-5 h-5 text-[#0E7C3A]" />
                      )}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                        drv.isOnline ? 'bg-[#1B9E4B]' : 'bg-[#7A857F]'
                      }`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-sm text-[#14201A]">{drv.name}</p>
                      <span className="text-xs font-bold text-[#E69500]">★ {drv.rating}</span>
                    </div>
                    <p className="text-xs text-[#7A857F]">{drv.phone}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <KerbPlateBadge plate={drv.vehiclePlate} />
                      <span className="text-[10px] text-[#7A857F]">{drv.stationName || 'Motor Park'}</span>
                    </div>
                  </div>
                </div>

                {/* Direct Call Button (P2) */}
                <a
                  href={`tel:${drv.phone}`}
                  className="w-11 h-11 rounded-full bg-[#E6F4EC] hover:bg-[#0E7C3A] text-[#0E7C3A] hover:text-white flex items-center justify-center transition-all shadow-sm"
                  title="Call Driver"
                >
                  <Phone className="w-5 h-5" />
                </a>
              </div>
            ))}
          </div>
        )}

        {/* --- TAB: P5. SHIFT SUMMARY --- */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 bg-white rounded-2xl border border-[#DDE3DF] text-center shadow-sm">
                <span className="text-xs text-[#7A857F]">Rides Handled</span>
                <p className="text-2xl font-black text-[#0E7C3A] mt-1">28</p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-[#DDE3DF] text-center shadow-sm">
                <span className="text-xs text-[#7A857F]">Avg Assignment</span>
                <p className="text-2xl font-black text-[#14201A] mt-1">1.8 min</p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-[#DDE3DF] text-center shadow-sm">
                <span className="text-xs text-[#7A857F]">Unassigned</span>
                <p className="text-2xl font-black text-[#1B9E4B] mt-1">0</p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-[#DDE3DF] text-center shadow-sm">
                <span className="text-xs text-[#7A857F]">Driver Compliance</span>
                <p className="text-2xl font-black text-[#0E7C3A] mt-1">100%</p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#DDE3DF]">
              <h3 className="font-bold text-sm text-[#14201A] mb-2">Marshal Duty Log</h3>
              <p className="text-xs text-[#7A857F] leading-relaxed">
                Station: School Motor Park Terminal (Gate Link) · Shift: Morning (07:00 – 15:00) · Feature-phone drivers Haruna Danladi and Tanko Idris dispatched via direct voice call. All campus fares adhered to ₦200 gate-to-hostels matrix.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* P3. NEW RIDE MODAL */}
      {/* ============================================================== */}
      {showNewRideModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-black text-[#14201A] mb-1">Create Walk-in / Phone Ride</h3>
            <p className="text-xs text-[#7A857F] mb-4">Assign directly from School Motor Park or Gate</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Passenger Name</label>
                <input
                  type="text"
                  value={newRiderName}
                  onChange={(e) => setNewRiderName(e.target.value)}
                  className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Passenger Phone</label>
                <input
                  type="tel"
                  value={newRiderPhone}
                  onChange={(e) => setNewRiderPhone(e.target.value)}
                  className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Pick-up</label>
                  <select
                    value={newPickup.id}
                    onChange={(e) => {
                      const loc = FUTMINNA_KEY_LOCATIONS.find((l) => l.id === e.target.value);
                      if (loc) setNewPickup(loc);
                    }}
                    className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-semibold"
                  >
                    {FUTMINNA_KEY_LOCATIONS.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Destination</label>
                  <select
                    value={newDropoff.id}
                    onChange={(e) => {
                      const loc = FUTMINNA_KEY_LOCATIONS.find((l) => l.id === e.target.value);
                      if (loc) setNewDropoff(loc);
                    }}
                    className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-semibold"
                  >
                    {FUTMINNA_KEY_LOCATIONS.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Automatic Fixed Price */}
              <div className="p-3 bg-[#E6F4EC] rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#0E7C3A]">Fixed Campus Fare</span>
                  <p className="text-xs text-[#3E4A43]">Cash collected by driver</p>
                </div>
                <span className="text-xl font-black text-[#0E7C3A]">₦{calculatedFare}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowNewRideModal(false)}
                className="flex-1 py-3 bg-[#F3F6F4] text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRide}
                className="flex-1 py-3 bg-[#0E7C3A] text-white text-xs font-bold rounded-xl shadow"
              >
                Create Ride &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* P4. ASSIGN DRIVER WITH READY-TO-SEND SMS TEMPLATE */}
      {/* ============================================================== */}
      {selectedRideForAssign && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-black text-[#14201A] mb-1">Assign Driver</h3>
            <p className="text-xs text-[#7A857F] mb-4">
              Ride: {selectedRideForAssign.pickupName} &rarr; {selectedRideForAssign.dropoffName}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Select Driver</label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => {
                    setSelectedDriverId(e.target.value);
                    const drv = boardData.drivers.find((d) => d.id === e.target.value);
                    if (drv) {
                      const text = `Zylift: Ride ${selectedRideForAssign.pickupName} to ${selectedRideForAssign.dropoffName}, ₦${selectedRideForAssign.fareNaira} cash. Rider: ${selectedRideForAssign.riderName} ${selectedRideForAssign.riderPhone}.`;
                      setSmsTemplate(text);
                    }
                  }}
                  className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold"
                >
                  {boardData.drivers.map((drv) => (
                    <option key={drv.id} value={drv.id}>
                      {drv.name} ({drv.vehiclePlate} · {drv.vehicleCategory})
                    </option>
                  ))}
                </select>
              </div>

              {/* Ready-to-Send SMS Preview Box (P4) */}
              <div>
                <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">
                  Ready-to-Send SMS Template
                </label>
                <div className="p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] font-mono text-xs text-[#14201A] leading-relaxed">
                  {smsTemplate}
                </div>
                <div className="flex justify-end mt-1.5">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(smsTemplate);
                      setSmsCopied(true);
                      setTimeout(() => setSmsCopied(false), 2000);
                    }}
                    className="text-xs font-bold text-[#0E7C3A] hover:underline"
                  >
                    {smsCopied ? '✓ Copied to clipboard' : 'Copy SMS Text'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setSelectedRideForAssign(null)}
                className="flex-1 py-3 bg-[#F3F6F4] text-xs font-bold rounded-xl"
              >
                Close
              </button>
              <button
                onClick={handleConfirmAssignment}
                className="flex-1 py-3 bg-[#0E7C3A] text-white text-xs font-bold rounded-xl shadow"
              >
                Confirm Assignment &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
