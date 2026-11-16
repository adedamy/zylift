import React, { useState, useEffect, Suspense, lazy } from 'react';
import { KerbMobileFrame } from './components/Common/KerbComponents';
import { RiderOnboarding, RiderUserProfile } from './components/Rider/RiderOnboarding';
import { RiderExperience } from './components/Rider/RiderExperience';
import {
  RiderSideMenu,
  RiderTripsScreen,
  RiderSafetyScreen,
  RiderWalletScreen,
  RiderSettingsScreen,
  RiderHelpScreen,
  RiderNotificationsScreen,
  RiderReportScreen,
  RiderSurveyScreen,
  RiderInviteScreen,
} from './components/Rider/RiderSecondaryScreens';
import { InstallAppModal } from './components/Modals/InstallAppModal';
import { RoleSelectionScreen } from './components/Auth/RoleSelectionScreen';
import { Smartphone, Car, LayoutDashboard, Share2, Download, UserCheck, X as CloseIcon } from 'lucide-react';

// Lazy-loaded role applications for optimized initial bundle load
const DriverAppView = lazy(() => import('./components/Driver/DriverAppView').then(m => ({ default: m.DriverAppView })));
const DriverSignUpFlow = lazy(() => import('./components/Driver/DriverSignUpFlow').then(m => ({ default: m.DriverSignUpFlow })));
const DriverSignInFlow = lazy(() => import('./components/Driver/DriverSignInFlow').then(m => ({ default: m.DriverSignInFlow })));
const AdminApp = lazy(() => import('./components/Admin/AdminApp').then(m => ({ default: m.AdminApp })));
const TripShareView = lazy(() => import('./components/Rider/TripShareView').then(m => ({ default: m.TripShareView })));

export type AppRole =
  | 'role_select'
  | 'rider'
  | 'driver'
  | 'driver_signin'
  | 'driver_signup'
  | 'admin'
  | 'trip_share';

export default function App() {
  // Capture referral code synchronously from URL parameters (?ref=ZYLIFT-... or ?ref=DRV-...) before routing
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref && ref.trim()) {
      localStorage.setItem('zylift_referral_code', ref.trim().toUpperCase());
    }
  } catch (e) {}

  // Determine initial role from URL path or hash
  const getInitialRole = (): AppRole => {
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.startsWith('/trip-share/')) {
      return 'trip_share';
    }
    const hash = window.location.hash.toLowerCase();
    if (hash === '#role_select' || hash === '#welcome') return 'role_select';
    if (hash === '#driver') return 'driver';
    if (hash === '#driver_signin' || hash === '#driver-login') return 'driver_signin';
    if (hash === '#driver_signup' || hash === '#drive') return 'driver_signup';
    if (hash === '#admin' || hash === '#ops') return 'admin';
    if (hash.startsWith('#trip-share') || hash.startsWith('#share')) return 'trip_share';

    if (pathname === '/driver' || pathname === '/drive' || pathname === '/driver-signup') {
      return 'driver_signup';
    }
    if (pathname === '/join' || pathname === '/rider') {
      return 'rider';
    }

    // Check if user has an active rider session in localStorage
    try {
      const saved = localStorage.getItem('zylift_rider_user');
      if (saved) return 'rider';
    } catch (e) {}

    return 'role_select';
  };

  const initialShareToken = window.location.pathname.startsWith('/trip-share/')
    ? window.location.pathname.replace('/trip-share/', '')
    : null;

  const [activeRole, setActiveRole] = useState<AppRole>(getInitialRole);
  const [shareToken, setShareToken] = useState<string>(initialShareToken || 'sh_hbrrklvv');

  // Rider User Profile - clean start from localStorage
  const [riderUser, setRiderUser] = useState<RiderUserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('zylift_rider_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [riderSideMenuOpen, setRiderSideMenuOpen] = useState(false);
  const [riderSecondaryScreen, setRiderSecondaryScreen] = useState<string | null>(null);
  const [reportedTripId, setReportedTripId] = useState<string | undefined>(undefined);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  // Validate rider session with backend: if user was deleted from DB, immediately clear local storage and log out
  useEffect(() => {
    if (!riderUser?.id && !riderUser?.phone) return;
    const identifier = riderUser.id || riderUser.phone;
    let isCancelled = false;

    fetch(`/api/users/${encodeURIComponent(identifier)}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404 && !isCancelled) {
            console.warn('[Session] Rider account not found in database (deleted). Clearing session.');
            try {
              localStorage.removeItem('zylift_rider_user');
              localStorage.removeItem('zylift_rider_token');
            } catch (e) {}
            setRiderUser(null);
            setActiveRole((curr) => (curr === 'rider' ? 'role_select' : curr));
          }
          return;
        }
        const data = await res.json();
        if (data?.success && data.user && !isCancelled) {
          setRiderUser((prev) => {
            if (!prev) return prev;
            const merged = {
              ...prev,
              id: data.user.id || prev.id,
              name: data.user.name || prev.name,
              phone: data.user.phone || prev.phone,
              role: (data.user.role === 'staff' || data.user.role === 'visitor') ? data.user.role : prev.role,
              department: data.user.department || prev.department,
              matricOrStaffId: data.user.matricOrStaffId ?? prev.matricOrStaffId,
              emergencyContactPhone: data.user.emergencyContactPhone ?? prev.emergencyContactPhone,
              avatarUrl: data.user.avatarUrl ?? prev.avatarUrl,
              referralCode: data.user.referralCode ?? prev.referralCode,
            };
            try {
              localStorage.setItem('zylift_rider_user', JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });
        }
      })
      .catch((err) => {
        console.warn('[Session] User verification error:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [riderUser?.id, riderUser?.phone]);

  // Sync hash routing on window location change
  useEffect(() => {
    const handleHashChange = () => {
      setActiveRole(getInitialRole());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Listen for PWA beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Update role and update hash
  const handleRoleChange = (role: AppRole) => {
    setActiveRole(role);
    setRiderSecondaryScreen(null);
    setRiderSideMenuOpen(false);

    const hash =
      role === 'role_select' ? '#welcome' :
      role === 'driver' ? '#driver' :
      role === 'driver_signin' ? '#driver_signin' :
      role === 'driver_signup' ? '#driver_signup' :
      role === 'admin' ? '#admin' :
      role === 'trip_share' ? '#trip-share' : '';

    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
  };

  // User state setter synced with localStorage
  const handleSetRiderUser = (user: RiderUserProfile | null) => {
    setRiderUser(user);
    if (user) {
      try {
        localStorage.setItem('zylift_rider_user', JSON.stringify(user));
      } catch (e) {}
    } else {
      try {
        localStorage.removeItem('zylift_rider_user');
      } catch (e) {}
    }
  };

  // Dedicated Rider Sign Out handler: clears user and routes back to Role Selection
  const handleRiderSignOut = () => {
    try {
      localStorage.removeItem('zylift_rider_token');
    } catch (e) {}
    handleSetRiderUser(null);
    setRiderSecondaryScreen(null);
    setRiderSideMenuOpen(false);
    handleRoleChange('role_select');
  };

  return (
    <div className="min-h-screen bg-[#0D1612] flex flex-col font-sans select-none">
      {/* Main Role Viewport Container */}
      <div className="flex-1 flex flex-col">
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center p-8 text-white min-h-[300px]">
            <div className="w-8 h-8 border-2 border-[#1B9E4B] border-t-transparent rounded-full animate-spin" />
          </div>
        }>
        {/* ============================================================== */}
        {/* 0. ROLE SELECTION SCREEN (PASSENGER OR DRIVER) */}
        {/* ============================================================== */}
        {activeRole === 'role_select' && (
          <KerbMobileFrame>
            <RoleSelectionScreen
              onSelectPassenger={() => handleRoleChange('rider')}
              onSelectDriverRegister={() => handleRoleChange('driver_signup')}
              onSelectDriverSignIn={() => handleRoleChange('driver_signin')}
            />
          </KerbMobileFrame>
        )}

        {/* ============================================================== */}
        {/* 1. RIDER APP (Mobile 360 x 800 Frame on Desktop, Edge-to-Edge on Mobile) */}
        {/* ============================================================== */}
        {activeRole === 'rider' && (
          <KerbMobileFrame>
            {!riderUser ? (
              /* Onboarding (R1 to R6, E1, E2) */
              <RiderOnboarding
                onComplete={(u) => handleSetRiderUser(u)}
                onDriveWithUs={() => handleRoleChange('driver_signup')}
                onBackToRoleSelect={() => handleRoleChange('role_select')}
                initialStep="signin"
              />
            ) : riderSecondaryScreen === 'trips' ? (
              <RiderTripsScreen
                user={riderUser || undefined}
                onBack={() => setRiderSecondaryScreen(null)}
                onBookImmediate={() => setRiderSecondaryScreen(null)}
                onTrackActiveTrip={() => setRiderSecondaryScreen(null)}
                onSelectTrip={(t) => {
                  setReportedTripId(t.id);
                  setRiderSecondaryScreen('report');
                }}
              />
            ) : riderSecondaryScreen === 'wallet' ? (
              <RiderWalletScreen onBack={() => setRiderSecondaryScreen(null)} user={riderUser} />
            ) : riderSecondaryScreen === 'settings' ? (
              <RiderSettingsScreen
                user={riderUser}
                onUpdateUser={(updated) => handleSetRiderUser(updated)}
                onBack={() => setRiderSecondaryScreen(null)}
                onSignOut={handleRiderSignOut}
              />
            ) : riderSecondaryScreen === 'help' ? (
              <RiderHelpScreen onBack={() => setRiderSecondaryScreen(null)} />
            ) : riderSecondaryScreen === 'notifications' ? (
              <RiderNotificationsScreen onBack={() => setRiderSecondaryScreen(null)} />
            ) : riderSecondaryScreen === 'report' ? (
              <RiderReportScreen
                tripId={reportedTripId}
                user={riderUser}
                onBack={() => setRiderSecondaryScreen(null)}
              />
            ) : riderSecondaryScreen === 'survey' ? (
              <RiderSurveyScreen onBack={() => setRiderSecondaryScreen(null)} user={riderUser} />
            ) : riderSecondaryScreen === 'invite' ? (
              <RiderInviteScreen onBack={() => setRiderSecondaryScreen(null)} user={riderUser} />
            ) : (
              /* Core Experience (R7 to R15) */
              <>
                <RiderExperience
                  user={riderUser}
                  onOpenMenu={() => setRiderSideMenuOpen(true)}
                  onOpenNotifications={() => setRiderSecondaryScreen('notifications')}
                  onOpenTrips={() => setRiderSecondaryScreen('trips')}
                  onReportProblem={(id) => {
                    setReportedTripId(id);
                    setRiderSecondaryScreen('report');
                  }}
                  onTripCompleted={() => setRiderSecondaryScreen('survey')}
                />

                {/* Left Side Menu (R21) */}
                <RiderSideMenu
                  isOpen={riderSideMenuOpen}
                  onClose={() => setRiderSideMenuOpen(false)}
                  user={riderUser}
                  onNavigate={(screen) => setRiderSecondaryScreen(screen)}
                  onSignOut={handleRiderSignOut}
                  onDriveWithUs={() => {
                    setRiderSideMenuOpen(false);
                    handleRoleChange('driver_signup');
                  }}
                />
              </>
            )}
          </KerbMobileFrame>
        )}

        {/* ============================================================== */}
        {/* 2. DRIVER TERMINAL (D1 to D10) & SIGN-UP / SIGN-IN */}
        {/* ============================================================== */}
        {activeRole === 'driver_signin' && (
          <KerbMobileFrame>
            <DriverSignInFlow
              onBackToRoleSelect={() => handleRoleChange('role_select')}
              onDriverSignedIn={() => handleRoleChange('driver')}
              onGoToDriverRegistration={() => handleRoleChange('driver_signup')}
            />
          </KerbMobileFrame>
        )}

        {activeRole === 'driver' && (
          <KerbMobileFrame>
            {localStorage.getItem('zylift_driver_user') ? (
              <DriverAppView
                onSignOut={() => {
                  try {
                    localStorage.removeItem('zylift_driver_user');
                    localStorage.removeItem('zylift_driver_token');
                  } catch (e) {}
                  handleRoleChange('driver_signin');
                }}
              />
            ) : (
              <DriverSignInFlow
                onBackToRoleSelect={() => handleRoleChange('role_select')}
                onDriverSignedIn={() => handleRoleChange('driver')}
                onGoToDriverRegistration={() => handleRoleChange('driver_signup')}
              />
            )}
          </KerbMobileFrame>
        )}

        {activeRole === 'driver_signup' && (
          <KerbMobileFrame>
            <DriverSignUpFlow
              onBackToRider={() => handleRoleChange('role_select')}
              onApplicationCompleted={(driverData) => {
                if (driverData) {
                  try {
                    localStorage.setItem('zylift_driver_user', JSON.stringify(driverData));
                  } catch (e) {}
                }
                handleRoleChange('driver');
              }}
            />
          </KerbMobileFrame>
        )}


        {/* ============================================================== */}
        {/* 4. OPERATIONS ADMIN HQ (A1 to A15) */}
        {/* ============================================================== */}
        {activeRole === 'admin' && (
          <AdminApp onBackToMain={() => handleRoleChange('rider')} />
        )}

        {/* ============================================================== */}
        {/* 5. PUBLIC TRIP SHARE (E5) */}
        {/* ============================================================== */}
        {activeRole === 'trip_share' && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-md h-[720px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-neutral-800">
              <TripShareView
                token={shareToken}
                onClose={() => handleRoleChange('rider')}
              />
            </div>
          </div>
        )}

        </Suspense>
      </div>

      {/* PWA Install App Modal */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
      />
    </div>
  );
}
