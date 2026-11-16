import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Map,
  Car,
  UserCheck,
  Users,
  Tag,
  Banknote,
  AlertTriangle,
  MessageSquare,
  Megaphone,
  TrendingUp,
  Settings,
  Search,
  Phone,
  Building2,
  Shield,
  X as CloseIcon,
  Download,
  Eye,
  FileText,
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Menu,
  ChevronRight,
  Clock,
  LogOut,
  RefreshCw,
  SlidersHorizontal,
  Activity,
  Check,
  Lock,
  Filter,
  ArrowUpRight,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Save,
  Undo2,
  Bus,
  Gift,
  Award
} from 'lucide-react';
import { RealLiveMap } from '../Map/RealLiveMap';
import { KerbButton, KerbPlateBadge, playKerbSound } from '../Common/KerbComponents';
import { FUTMINNA_KEY_LOCATIONS } from '../../data/futminnaLocations';

export type AdminTab =
  | 'dashboard' // A2
  | 'live_map' // A3
  | 'rides' // A4 & A5
  | 'drivers' // A6 & A7
  | 'riders' // A8
  | 'referrals' // Campus Ambassador & Referrals
  | 'fares' // A9
  | 'cash' // A10
  | 'safety' // A11
  | 'support' // A12
  | 'announcements' // A13
  | 'reports' // A14
  | 'staff' // Staff Management (Super Admin)
  | 'settings'; // A15

export type StaffRole =
  | 'pilot_lead'
  | 'operations'
  | 'school_security'
  | 'support'
  | 'viewer';

interface AdminAppProps {
  onBackToMain?: () => void;
}

export const AdminApp: React.FC<AdminAppProps> = ({ onBackToMain }) => {
  // Mobile drawer state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [rideStatusFilter, setRideStatusFilter] = useState<'all' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [driverTabFilter, setDriverTabFilter] = useState<'all' | 'pending' | 'active'>('all');
  // A1. Authentication & 2FA State
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('zylift_admin_token');
    } catch (e) {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('zylift_admin_staff');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Authenticated fetch wrapper for all admin API endpoints
  const adminFetch = (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as any),
    };
    const token = adminToken || localStorage.getItem('zylift_admin_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
  };

  const handleLogout = () => {
    if (adminToken) {
      fetch('/api/admin/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      }).catch(() => {});
    }
    try {
      localStorage.removeItem('zylift_admin_token');
      localStorage.removeItem('zylift_admin_staff');
    } catch (e) {}
    setAdminToken(null);
    setCurrentUser(null);
  };

  // Active Navigation Tab
  const [currentTab, setCurrentTab] = useState<AdminTab>('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');

  // Dashboard & Telemetry State
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [rides, setRides] = useState<any[]>([]);
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedDriverApp, setSelectedDriverApp] = useState<any>(null);

  // Unified Pending Driver Applications and Unapproved Drivers
  const pendingDriversList = [
    ...applications.filter((a) => a.status === 'pending'),
    ...drivers
      .filter((d) => !d.isApproved)
      .filter(
        (d) =>
          !applications.some(
            (a) => a.status === 'pending' && (a.driverId === d.id || (d.phone && a.phone?.replace(/\D/g, '') === d.phone?.replace(/\D/g, '')))
          )
      )
      .map((d) => ({
        ...d,
        applicantName: d.name,
        status: 'pending',
        verificationChecklist: d.verificationChecklist || {
          metInPerson: false,
          faceMatchesId: false,
          plateMatchesVehicle: false,
          parkLeaderKnown: false,
        },
      })),
  ];
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [fareRules, setFareRules] = useState<any[]>([]);
  const [faresSubTab, setFaresSubTab] = useState<'matrix' | 'vehicle_rules'>('matrix');
  const [vehicleRules, setVehicleRules] = useState<Record<string, any>>({
    okada:     { id: 'okada',     label: 'Okada',     minSeats: 1,  maxSeats: 2,  minPassengersToOffer: 1,  maxKm: 15,   baseFare: 150,  perKm: 60,  perMinute: 5,  minimumFare: 250 },
    keke:      { id: 'keke',      label: 'Keke',      minSeats: 4,  maxSeats: 5,  minPassengersToOffer: 1,  maxKm: 25,   baseFare: 200,  perKm: 80,  perMinute: 8,  minimumFare: 300 },
    cab_go:    { id: 'cab_go',    label: 'Car',       minSeats: 6,  maxSeats: 10, minPassengersToOffer: 1,  maxKm: null, baseFare: 500,  perKm: 150, perMinute: 15, minimumFare: 1000 },
    small_bus: { id: 'small_bus', label: 'Small bus', minSeats: 18, maxSeats: 18, minPassengersToOffer: 8,  maxKm: null, baseFare: 2500, perKm: 300, perMinute: 25, minimumFare: 5000 },
    big_bus:   { id: 'big_bus',   label: 'Big bus',   minSeats: 45, maxSeats: 80, minPassengersToOffer: 19, maxKm: null, baseFare: 8000, perKm: 600, perMinute: 50, minimumFare: 15000 },
  });
  const [isSavingVehicleRules, setIsSavingVehicleRules] = useState(false);
  const [hasUnsavedVehicleRules, setHasUnsavedVehicleRules] = useState(false);
  const vehicleRulesDirtyRef = useRef(false);
  const [vehicleRulesSavedNotice, setVehicleRulesSavedNotice] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [ridersList, setRidersList] = useState<any[]>([]);
  const [riderRoleFilter, setRiderRoleFilter] = useState<'all' | 'student' | 'staff' | 'visitor'>('all');
  const [riderSearchQuery, setRiderSearchQuery] = useState('');
  const [referralsData, setReferralsData] = useState<{
    totalReferrals: number;
    completedReferrals: number;
    pendingReferrals: number;
    leaderboard: Array<{ code: string; name: string; role: string; total: number; completed: number; pending: number }>;
    referrals: any[];
  }>({
    totalReferrals: 0,
    completedReferrals: 0,
    pendingReferrals: 0,
    leaderboard: [],
    referrals: [],
  });
  const [referralsSearchQuery, setReferralsSearchQuery] = useState('');
  const [blockingRider, setBlockingRider] = useState<any>(null);
  const [blockReasonInput, setBlockReasonInput] = useState('');
  const [cashLedgerData, setCashLedgerData] = useState<any>(null);
  const [cashSearchQuery, setCashSearchQuery] = useState('');
  const [reconcilingDriver, setReconcilingDriver] = useState<any>(null);
  const [reconcileNotesInput, setReconcileNotesInput] = useState('');
  const [reportsData, setReportsData] = useState<any>(null);
  const [editingFareRule, setEditingFareRule] = useState<any>(null);
  const [isNewRouteModal, setIsNewRouteModal] = useState(false);
  const [fareEditFromZone, setFareEditFromZone] = useState('');
  const [fareEditToZone, setFareEditToZone] = useState('');
  const [fareEditKeke, setFareEditKeke] = useState('');
  const [fareEditOkada, setFareEditOkada] = useState('');
  const [fareEditCar, setFareEditCar] = useState('');
  const [fareEditSmallBus, setFareEditSmallBus] = useState('');
  const [fareEditBigBus, setFareEditBigBus] = useState('');
  const [isEditingWholeTable, setIsEditingWholeTable] = useState(false);
  const [tableDraftFares, setTableDraftFares] = useState<any[]>([]);
  const [isSavingTable, setIsSavingTable] = useState(false);
  const [resolvingTicket, setResolvingTicket] = useState<any>(null);
  const [ticketResolutionInput, setTicketResolutionInput] = useState('');
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);

  // Staff Management State (Super Admin / Pilot Lead only)
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isCreateStaffModalOpen, setIsCreateStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('operations');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [staffActionError, setStaffActionError] = useState('');
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffActionError('');
    if (!newStaffName.trim() || !newStaffEmail.trim() || !newStaffPassword.trim() || !newStaffPin.trim()) {
      setStaffActionError('Name, email, password, and 6-digit PIN are required.');
      return;
    }
    if (!/^\d{6}$/.test(newStaffPin.trim())) {
      setStaffActionError('Security PIN must be exactly 6 numeric digits.');
      return;
    }
    setIsSubmittingStaff(true);
    try {
      const res = await adminFetch('/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          name: newStaffName.trim(),
          email: newStaffEmail.trim(),
          phone: newStaffPhone.trim(),
          role: newStaffRole,
          password: newStaffPassword.trim(),
          pin2fa: newStaffPin.trim(),
        }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { success: false, error: `Server response error (${res.status}): ${text || res.statusText || 'Empty response'}` };
      }
      if (res.ok && data.success) {
        setIsCreateStaffModalOpen(false);
        setNewStaffName('');
        setNewStaffEmail('');
        setNewStaffPhone('');
        setNewStaffRole('operations');
        setNewStaffPassword('');
        setNewStaffPin('');
        playKerbSound('success');
        refreshAllData();
      } else {
        setStaffActionError(data.error || `Failed to create staff account (${res.status})`);
      }
    } catch (err: any) {
      setStaffActionError(err.message || 'Network error occurred');
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (staffId === currentUser?.id) {
      alert('You cannot delete your own account as Super Admin.');
      return;
    }
    const targetMember = staffList.find((s) => s.id === staffId);
    if (targetMember?.role === 'pilot_lead') {
      alert('The Super Admin account cannot be deleted.');
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete staff account "${staffName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await adminFetch(`/api/admin/staff/${staffId}`, { method: 'DELETE' });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { success: false, error: `Server response error (${res.status}): ${text || res.statusText || 'Empty response'}` };
      }
      if (res.ok && data.success) {
        setStaffList((prev) => prev.filter((s) => s.id !== staffId));
        playKerbSound('success');
        refreshAllData();
      } else {
        alert(data.error || `Failed to delete staff member (${res.status})`);
      }
    } catch (err: any) {
      alert(err.message || 'Network error occurred');
    }
  };

  // Deletion and Maintenance Handlers
  const handleDeleteRide = async (rideId: string) => {
    if (!confirm(`Are you sure you want to permanently delete ride ${rideId}? This will remove it from the system.`)) return;
    try {
      const res = await adminFetch(`/api/admin/rides/${rideId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setRides(prev => prev.filter(r => r.id !== rideId));
        if (selectedRide?.id === rideId) setSelectedRide(null);
        playKerbSound('success');
        refreshAllData();
      } else {
        alert(data.error || 'Failed to delete ride');
      }
    } catch (e: any) {
      alert(e.message || 'Error deleting ride');
    }
  };

  const handleClearTestRides = async () => {
    if (!confirm('Are you sure you want to clear all completed and cancelled test rides? Only active ongoing rides (if any) will remain. This action cannot be undone.')) return;
    try {
      const res = await adminFetch('/api/admin/rides/clear-test-data', {
        method: 'POST',
        body: JSON.stringify({ onlyFinished: true }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully cleared ${data.count} test ride records!`);
        playKerbSound('success');
        refreshAllData();
      } else {
        alert(data.error || 'Failed to clear rides');
      }
    } catch (e: any) {
      alert(e.message || 'Error clearing rides');
    }
  };

  const handleDeleteSupportTicket = async (ticketId: string) => {
    if (!confirm(`Are you sure you want to delete support ticket ${ticketId}?`)) return;
    try {
      const res = await adminFetch(`/api/admin/support/tickets/${ticketId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSupportTickets(prev => prev.filter(t => t.id !== ticketId));
        if (selectedTicket?.id === ticketId) setSelectedTicket(null);
        playKerbSound('success');
      } else {
        alert(data.error || 'Failed to delete ticket');
      }
    } catch (e: any) {
      alert(e.message || 'Error deleting ticket');
    }
  };

  const handleClearAllSupportTickets = async () => {
    if (!confirm('Are you sure you want to delete ALL support tickets? This will clear the helpdesk inbox.')) return;
    try {
      const res = await adminFetch('/api/admin/support/tickets/clear', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSupportTickets([]);
        setSelectedTicket(null);
        playKerbSound('success');
      } else {
        alert(data.error || 'Failed to clear tickets');
      }
    } catch (e: any) {
      alert(e.message || 'Error clearing tickets');
    }
  };

  const handleDeleteAnnouncement = async (annId: string) => {
    if (!confirm('Are you sure you want to remove this broadcast announcement?')) return;
    try {
      const res = await adminFetch(`/api/admin/announcements/${annId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAnnouncementsList(prev => prev.filter(a => a.id !== annId));
        playKerbSound('success');
      } else {
        alert(data.error || 'Failed to delete announcement');
      }
    } catch (e: any) {
      alert(e.message || 'Error deleting announcement');
    }
  };

  const handleDeleteSurvey = async (surveyId: string) => {
    if (!confirm('Are you sure you want to permanently delete this passenger feedback entry?')) return;
    try {
      const res = await adminFetch(`/api/admin/surveys/${surveyId}`, { method: 'DELETE' });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { success: false, error: `Server response error (${res.status}): ${text || res.statusText || 'Empty response'}` };
      }
      if (res.ok && data.success) {
        setSurveys(prev => prev.filter(s => s.id !== surveyId));
        playKerbSound('success');
      } else {
        alert(data.error || `Failed to delete feedback entry (${res.status})`);
      }
    } catch (e: any) {
      alert(e.message || 'Error deleting feedback entry');
    }
  };

  const handleClearAllSurveys = async () => {
    if (!confirm('Are you sure you want to delete ALL passenger feedback and ratings? This will permanently wipe the feedback table.')) return;
    try {
      const res = await adminFetch('/api/admin/surveys/clear', { method: 'POST' });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { success: false, error: `Server response error (${res.status}): ${text || res.statusText || 'Empty response'}` };
      }
      if (res.ok && data.success) {
        setSurveys([]);
        playKerbSound('success');
      } else {
        alert(data.error || `Failed to clear feedback (${res.status})`);
      }
    } catch (e: any) {
      alert(e.message || 'Error clearing feedback');
    }
  };

  const handleClearAuditLogs = async () => {
    if (!confirm('Are you sure you want to permanently clear all security audit logs? This action cannot be undone.')) return;
    try {
      const res = await adminFetch('/api/admin/audit-logs/clear', { method: 'POST' });
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { success: false, error: 'Failed to clear logs' }; }
      if (res.ok && data.success) {
        setAuditLogs([]);
        playKerbSound('success');
      } else {
        alert(data.error || 'Failed to clear audit logs');
      }
    } catch (e: any) {
      alert(e.message || 'Error clearing audit logs');
    }
  };

  const handleSaveVehicleRules = async () => {
    setIsSavingVehicleRules(true);
    setVehicleRulesSavedNotice(null);
    try {
      const sanitizedRules: Record<string, any> = {};
      Object.entries(vehicleRules).forEach(([key, val]) => {
        if (!val || typeof val !== 'object') return;
        const numOr = (v: any, fallback: number) =>
          v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? fallback : Number(v);
        sanitizedRules[key] = {
          ...val,
          maxKm:
            val.maxKm === null || val.maxKm === '' || val.maxKm === undefined || Number(val.maxKm) <= 0
              ? null
              : Number(val.maxKm),
          minPassengersToOffer: Math.max(1, numOr(val.minPassengersToOffer, 1)),
          minSeats: Math.max(1, numOr(val.minSeats, 1)),
          maxSeats: Math.max(1, numOr(val.maxSeats, 4)),
          baseFare: Math.max(0, numOr(val.baseFare, 0)),
          perKm: Math.max(0, numOr(val.perKm, 0)),
          perMinute: Math.max(0, numOr(val.perMinute, 0)),
          minimumFare: Math.max(0, numOr(val.minimumFare, 0)),
        };
      });

      const res = await adminFetch('/api/admin/fare-rules/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: sanitizedRules }),
      });
      const data = await res.json();
      if (data.success) {
        vehicleRulesDirtyRef.current = false;
        setHasUnsavedVehicleRules(false);
        setVehicleRules(data.rules || sanitizedRules);
        setVehicleRulesSavedNotice('Vehicle pricing rules and distance cutoffs updated successfully!');
        playKerbSound('success');
        setTimeout(() => setVehicleRulesSavedNotice(null), 4000);
      } else {
        alert(data.error || 'Failed to update vehicle rules');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update vehicle rules');
    } finally {
      setIsSavingVehicleRules(false);
    }
  };

  // CSV Data Exporter helper
  const exportToCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    handleDownloadDocument(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  // 4-box verification checklist state for driver approvals (A7)
  const [verificationChecklist, setVerificationChecklist] = useState({
    metInPerson: false,
    faceMatchesId: false,
    plateMatchesVehicle: false,
    parkLeaderKnown: false,
  });

  // Document Viewer & Lightbox State
  const [previewDocModal, setPreviewDocModal] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
    filename: string;
    fileType?: string;
    fileSize?: string;
  } | null>(null);

  const [deletingReferralId, setDeletingReferralId] = useState<string | null>(null);
  const [isClearingAllReferrals, setIsClearingAllReferrals] = useState(false);

  const handleDeleteReferral = async (id: string, refereeName: string) => {
    if (!confirm(`Permanently delete referral record for "${refereeName || 'this user'}"? This action cannot be undone.`)) {
      return;
    }
    setDeletingReferralId(id);
    try {
      const res = await adminFetch(`/api/admin/referrals/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to delete referral record.');
        return;
      }
      playKerbSound('success');
      setReferralsData((prev) => ({
        ...prev,
        totalReferrals: Math.max(0, prev.totalReferrals - 1),
        referrals: prev.referrals.filter((r) => r.id !== id),
      }));
      await refreshAllData();
    } catch {
      alert('Network error while deleting referral record.');
    } finally {
      setDeletingReferralId(null);
    }
  };

  const handleClearAllReferrals = async () => {
    if (!confirm('CAUTION: Are you sure you want to permanently delete ALL referral records? All tracked invite links and referral history will be completely erased.')) {
      return;
    }
    setIsClearingAllReferrals(true);
    try {
      const res = await adminFetch('/api/admin/referrals/clear', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to clear referral records.');
        return;
      }
      playKerbSound('success');
      setReferralsData({
        totalReferrals: 0,
        completedReferrals: 0,
        pendingReferrals: 0,
        leaderboard: [],
        referrals: [],
      });
      await refreshAllData();
    } catch {
      alert('Network error while clearing referrals.');
    } finally {
      setIsClearingAllReferrals(false);
    }
  };

  const handleDownloadDocument = (url: string, filename: string) => {
    if (!url) return;
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Failed to trigger download', e);
    }
  };

  const handleDownloadAllDossier = (driverOrApp: any) => {
    if (!driverOrApp) return;
    const name = driverOrApp.applicantName || driverOrApp.name || 'Driver';
    const cleanName = name.replace(/[^a-zA-Z0-9_-]/g, '_');

    // 1. Text Summary Report
    const summary = `=====================================================
FUTMINNA CAMPUS RIDE PILOT - DRIVER DOSSIER ARCHIVE
=====================================================
Generated at: ${new Date().toLocaleString()}
Application / Driver ID: ${driverOrApp.id}
Status: ${driverOrApp.status || (driverOrApp.isApproved ? 'Approved' : 'Pending')}

[PERSONAL INFORMATION]
Full Name: ${name}
Phone: ${driverOrApp.phone}
Secondary Phone: ${driverOrApp.secondPhone || 'None'}
National Identity Number (NIN): ${driverOrApp.ninNumber || 'Not provided'}
Date of Birth: ${driverOrApp.dob || 'Not provided'}
Residential Area: ${driverOrApp.homeArea || 'Not provided'}

[VEHICLE SPECIFICATIONS]
Category: ${driverOrApp.vehicleCategory}
Registration Plate: ${driverOrApp.vehiclePlate}
Make / Model: ${driverOrApp.vehicleModel}
Color: ${driverOrApp.vehicleColor}
Terminal / Base Station: ${driverOrApp.stationName || 'School Motor Park'}

[PARK LEADER & UNION SPONSOR]
Park Leader Name: ${driverOrApp.parkLeaderName || 'Not specified'}
Park Leader Phone: ${driverOrApp.parkLeaderPhone || 'Not specified'}

[DOCUMENTS SUBMITTED]
1. Profile Photo: ${driverOrApp.facePhotoUrl ? 'Present' : 'Not attached'} (${driverOrApp.documentsMeta?.facePhoto?.name || 'profile_photo.jpg'}, ${driverOrApp.documentsMeta?.facePhoto?.size || 'N/A'})
2. NIN Document: ${driverOrApp.idCardPhotoUrl ? 'Present' : 'Not attached'} (${driverOrApp.documentsMeta?.idCard?.name || 'nin_document'}, ${driverOrApp.documentsMeta?.idCard?.size || 'N/A'})
3. Driver License / Park Card: ${driverOrApp.licenseOrParkCardUrl ? 'Present' : 'Not attached'} (${driverOrApp.documentsMeta?.license?.name || 'license_or_card'}, ${driverOrApp.documentsMeta?.license?.size || 'N/A'})
4. Vehicle Exterior Photo: ${driverOrApp.vehiclePhotoUrl ? 'Present' : 'Not attached'} (${driverOrApp.documentsMeta?.vehiclePhoto?.name || 'vehicle_exterior.jpg'}, ${driverOrApp.documentsMeta?.vehiclePhoto?.size || 'N/A'})
5. Vehicle Papers / Particulars: ${driverOrApp.vehiclePapersUrl ? 'Present' : 'Not attached'} (${driverOrApp.documentsMeta?.vehiclePapers?.name || 'vehicle_papers'}, ${driverOrApp.documentsMeta?.vehiclePapers?.size || 'N/A'})

=====================================================`;

    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
    const summaryUrl = URL.createObjectURL(blob);
    handleDownloadDocument(summaryUrl, `${cleanName}_Dossier_Summary.txt`);
    setTimeout(() => URL.revokeObjectURL(summaryUrl), 4000);

    // 2. Download all files
    const docs = [
      { url: driverOrApp.facePhotoUrl, meta: driverOrApp.documentsMeta?.facePhoto, defaultName: `${cleanName}_Profile_Photo` },
      { url: driverOrApp.idCardPhotoUrl, meta: driverOrApp.documentsMeta?.idCard, defaultName: `${cleanName}_NIN_Document` },
      { url: driverOrApp.licenseOrParkCardUrl, meta: driverOrApp.documentsMeta?.license, defaultName: `${cleanName}_Driver_License_Park_Card` },
      { url: driverOrApp.vehiclePhotoUrl, meta: driverOrApp.documentsMeta?.vehiclePhoto, defaultName: `${cleanName}_Vehicle_Exterior` },
      { url: driverOrApp.vehiclePapersUrl, meta: driverOrApp.documentsMeta?.vehiclePapers, defaultName: `${cleanName}_Vehicle_Papers` },
    ];

    docs.forEach((item, index) => {
      if (item.url) {
        setTimeout(() => {
          let ext = '';
          if (item.url.startsWith('data:application/pdf') || item.meta?.type?.includes('pdf')) ext = '.pdf';
          else if (item.url.startsWith('data:image/jpeg') || item.url.startsWith('data:image/jpg') || item.meta?.type?.includes('jpeg')) ext = '.jpg';
          else if (item.url.startsWith('data:image/png') || item.meta?.type?.includes('png')) ext = '.png';
          else if (item.url.startsWith('data:image/webp')) ext = '.webp';

          let fname = item.meta?.name || `${item.defaultName}${ext}`;
          if (ext && !fname.toLowerCase().endsWith(ext)) {
            fname += ext;
          }
          handleDownloadDocument(item.url, fname);
        }, (index + 1) * 350);
      }
    });
  };

  // Action Modals
  const [reassignModalRide, setReassignModalRide] = useState<any>(null);
  const [reassignDriverId, setReassignDriverId] = useState('');
  const [reassignReason, setReassignReason] = useState('Requested by passenger');

  const [cancelModalRide, setCancelModalRide] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('Driver vehicle breakdown');

  const [resolveIncidentModal, setResolveIncidentModal] = useState<any>(null);
  const [incidentResolutionNote, setIncidentResolutionNote] = useState('');

  // Announcement Form State (A13)
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annAudience, setAnnAudience] = useState<'all' | 'riders' | 'drivers'>('all');
  const [annChannels, setAnnChannels] = useState<Array<'in_app' | 'sms' | 'push'>>(['in_app']);
  const [annSuccessMessage, setAnnSuccessMessage] = useState('');

  // Validate existing session on mount
  useEffect(() => {
    if (adminToken && currentUser) {
      adminFetch('/api/admin/dashboard')
        .then((r) => {
          if (r.status === 401) {
            handleLogout();
          }
        })
        .catch(() => {});
    }
  }, []);

  // Fetch data periodically for current tab
  const refreshAllData = async () => {
    try {
      const [
        resDash,
        resRides,
        resDrivers,
        resApps,
        resInc,
        resTkt,
        resFares,
        resLogs,
        resSettings,
        resSurveys,
        resRiders,
        resCash,
        resReports,
        resAnn,
        resStaff,
        resReferrals,
        resVehicles,
      ] = await Promise.all([
        adminFetch('/api/admin/dashboard').then((r) => r.json()),
        adminFetch('/api/admin/rides').then((r) => r.json()),
        adminFetch('/api/admin/drivers').then((r) => r.json()),
        adminFetch('/api/admin/applications').then((r) => r.json()),
        adminFetch('/api/admin/incidents').then((r) => r.json()),
        adminFetch('/api/admin/support/tickets').then((r) => r.json()),
        adminFetch('/api/admin/fares').then((r) => r.json()),
        adminFetch('/api/admin/audit-logs').then((r) => r.json()),
        adminFetch('/api/admin/settings').then((r) => r.json()),
        adminFetch('/api/admin/surveys').then((r) => r.json()).catch(() => ({ success: false })),
        adminFetch('/api/admin/riders').then((r) => r.json()).catch(() => ({ success: false })),
        adminFetch('/api/admin/cash').then((r) => r.json()).catch(() => ({ success: false })),
        adminFetch('/api/admin/reports').then((r) => r.json()).catch(() => ({ success: false })),
        adminFetch('/api/admin/announcements').then((r) => r.json()).catch(() => ({ success: false })),
        adminFetch('/api/admin/staff').then((r) => r.json()).catch(() => ({ success: false })),
        adminFetch('/api/admin/referrals').then((r) => r.json()).catch(() => ({ success: false })),
        adminFetch('/api/admin/fare-rules/vehicles').then((r) => r.json()).catch(() => ({ success: false })),
      ]);

      if (resDash.success) setDashboardData(resDash.metrics);
      if (resRides.success) setRides(resRides.trips);
      if (resDrivers.success) setDrivers(resDrivers.drivers);
      if (resApps.success) setApplications(resApps.applications);
      if (resInc.success) setIncidents(resInc.incidents);
      if (resTkt.success) setSupportTickets(resTkt.tickets);
      if (resFares.success) setFareRules(resFares.fares);
      if (resLogs.success) setAuditLogs(resLogs.auditLogs);
      if (resSettings.success) setSystemSettings(resSettings.settings);
      if (resSurveys?.success) setSurveys(resSurveys.surveys);
      if (resRiders?.success) setRidersList(resRiders.riders);
      if (resCash?.success) setCashLedgerData(resCash);
      if (resReports?.success) setReportsData(resReports);
      if (resAnn?.success && Array.isArray(resAnn.announcements)) setAnnouncementsList(resAnn.announcements);
      if (resStaff?.success && Array.isArray(resStaff.staff)) setStaffList(resStaff.staff);
      if (resReferrals?.success) {
        setReferralsData({
          totalReferrals: resReferrals.totalReferrals || 0,
          completedReferrals: resReferrals.completedReferrals || 0,
          pendingReferrals: resReferrals.pendingReferrals || 0,
          leaderboard: resReferrals.leaderboard || [],
          referrals: resReferrals.referrals || [],
        });
      }
      if (resVehicles?.success && resVehicles.rules && !vehicleRulesDirtyRef.current) {
        setVehicleRules(resVehicles.rules);
      }
    } catch (e) {
      console.warn('Admin sync error:', e);
    }
  };

  useEffect(() => {
    if (currentUser) {
      refreshAllData();
      const interval = setInterval(refreshAllData, 5000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Handle Staff Login (Single-Step: Email & Password only)
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (data.success && data.staff && data.token) {
        setAdminToken(data.token);
        setCurrentUser(data.staff);
        try {
          localStorage.setItem('zylift_admin_token', data.token);
          localStorage.setItem('zylift_admin_staff', JSON.stringify(data.staff));
        } catch (e) {}
      } else {
        setLoginError(data.error || 'Authentication failed');
      }
    } catch (e) {
      setLoginError('Could not reach pilot server');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // RBAC Permission Check (Section 1)
  const isAllowed = (tab: AdminTab): boolean => {
    if (!currentUser) return false;
    const role: StaffRole = currentUser.role || 'pilot_lead';

    if (role === 'pilot_lead') return true; // Unrestricted (including staff management)

    if (role === 'operations') {
      return ['dashboard', 'live_map', 'rides', 'drivers', 'riders', 'referrals', 'fares', 'support', 'announcements', 'reports'].includes(tab);
    }

    if (role === 'school_security') {
      return ['live_map'].includes(tab);
    }

    if (role === 'support') {
      return ['support', 'rides', 'riders'].includes(tab);
    }

    if (role === 'viewer') {
      return ['dashboard', 'reports'].includes(tab);
    }

    return false;
  };

  // ==============================================================
  // A1. ADMIN LOGIN & 2FA SCREEN (MODERNIZED DUAL-STEP UI)
  // ==============================================================
  if (!currentUser) {
    return (
      <div className="flex-1 min-h-screen min-h-[100dvh] bg-gradient-to-br from-[#07120C] via-[#0E2018] to-[#050D09] flex items-center justify-center p-3 sm:p-6 select-none relative overflow-y-auto py-8">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#0E7C3A]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-lg bg-white rounded-3xl p-5 sm:p-8 shadow-2xl border border-white/20 relative z-10 my-auto">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 sm:w-12 h-11 sm:h-12 rounded-2xl bg-gradient-to-br from-[#0E7C3A] to-[#14532D] text-white flex items-center justify-center font-black text-xl sm:text-2xl shadow-lg shadow-[#0E7C3A]/30 shrink-0">
                K
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-[#14201A] tracking-tight">Operations HQ</h1>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#E6F4EC] text-[#0E7C3A] px-2 py-0.5 rounded-full border border-[#0E7C3A]/20">
                    Staff Portal
                  </span>
                </div>
                <p className="text-xs text-[#7A857F] mt-0.5">FUTMINNA Campus Pilot Administration Console</p>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#7A857F] mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@zylift.com"
                  className="w-full p-3.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] focus:border-[#0E7C3A] focus:bg-white text-sm font-semibold text-[#14201A] transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#7A857F] mb-1.5">
                Console Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-3.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] focus:border-[#0E7C3A] focus:bg-white text-sm font-semibold text-[#14201A] transition-all outline-none"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-[#FDE8E8] border border-[#D93A3A]/30 rounded-xl flex items-center gap-2 text-xs font-bold text-[#D93A3A]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            <div className="pt-2">
              <KerbButton isLoading={isLoggingIn} onClick={handleLogin}>
                Sign In to Operations Console &rarr;
              </KerbButton>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ==============================================================
  // MAIN CONSOLE LAYOUT (PROFESSIONAL GROUPED NAVIGATION + MOBILE DRAWER)
  // ==============================================================
  const openIncidentsCount = incidents.filter((i) => i.status === 'open').length;

  const navCategories = [
    {
      title: 'OPERATIONS',
      items: [
        { tab: 'dashboard' as AdminTab, label: 'Overview & KPIs', icon: <LayoutDashboard className="w-4 h-4" /> },
        { tab: 'live_map' as AdminTab, label: 'Campus Live Map', icon: <Map className="w-4 h-4" /> },
        { tab: 'rides' as AdminTab, label: 'Live Ride Stream', icon: <Car className="w-4 h-4" /> },
      ],
    },
    {
      title: 'FLEET & COMMUNITY',
      items: [
        {
          tab: 'drivers' as AdminTab,
          label: 'Driver Dossiers',
          icon: <UserCheck className="w-4 h-4" />,
          badge: pendingDriversList.length || undefined,
        },
        { tab: 'riders' as AdminTab, label: 'Campus Passengers', icon: <Users className="w-4 h-4" /> },
        {
          tab: 'referrals' as AdminTab,
          label: 'Campus Referrals',
          icon: <Gift className="w-4 h-4" />,
          badge: referralsData.pendingReferrals || undefined,
        },
      ],
    },
    {
      title: 'FINANCE & FARES',
      items: [
        { tab: 'fares' as AdminTab, label: 'Route Fare Matrix', icon: <Tag className="w-4 h-4" /> },
        { tab: 'cash' as AdminTab, label: 'Cash & 0% Remittance', icon: <Banknote className="w-4 h-4" /> },
      ],
    },
    {
      title: 'SYSTEM & LOGS',
      items: [
        {
          tab: 'support' as AdminTab,
          label: 'Support Tickets',
          icon: <MessageSquare className="w-4 h-4" />,
          badge: supportTickets.filter((t) => t.status === 'open').length || undefined,
        },
        { tab: 'announcements' as AdminTab, label: 'Broadcasts', icon: <Megaphone className="w-4 h-4" /> },
        { tab: 'reports' as AdminTab, label: 'Analytics & Export', icon: <TrendingUp className="w-4 h-4" /> },
        { tab: 'staff' as AdminTab, label: 'Staff Management', icon: <Users className="w-4 h-4" /> },
        { tab: 'settings' as AdminTab, label: 'Settings & Audit', icon: <Settings className="w-4 h-4" /> },
      ],
    },
  ];

  const currentTabLabel =
    navCategories.flatMap((c) => c.items).find((i) => i.tab === currentTab)?.label || 'Console';

  return (
    <div className="flex h-screen h-[100dvh] bg-[#F4F6F5] text-slate-900 overflow-hidden font-sans select-none relative">
      {/* Mobile Drawer Backdrop Blur */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* 256dp Refined Ink Sidebar (#0C1611) */}
      <aside
        className={`fixed inset-y-0 left-0 w-[82vw] max-w-xs sm:w-72 bg-[#0C1611] text-white flex flex-col justify-between z-50 transition-transform duration-300 ease-in-out lg:static lg:w-64 lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo & Role Badge Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0E7C3A] to-[#15803D] text-white flex items-center justify-center font-black text-lg shadow-md shadow-[#0E7C3A]/30">
                K
              </div>
              <div>
                <p className="font-black text-sm tracking-tight text-white flex items-center gap-1.5">
                  Zylift Admin
                  <span className="w-2 h-2 rounded-full bg-[#1B9E4B] animate-pulse" />
                </p>
                <p className="text-[10px] text-white/60 font-medium">FUTMINNA Operations</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Grouped Navigation Links */}
          <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
            {navCategories.map((cat) => {
              const visibleItems = cat.items.filter((item) => isAllowed(item.tab));
              if (visibleItems.length === 0) return null;

              return (
                <div key={cat.title}>
                  <p className="text-[10px] font-bold tracking-wider uppercase text-white/40 px-3 pb-1.5">
                    {cat.title}
                  </p>
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const active = currentTab === item.tab;
                      return (
                        <button
                          key={item.tab}
                          onClick={() => {
                            setCurrentTab(item.tab);
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                            active
                              ? 'bg-[#0E7C3A] text-white shadow-md shadow-[#0E7C3A]/25'
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={active ? 'text-white' : 'text-white/60'}>{item.icon}</span>
                            <span>{item.label}</span>
                          </div>

                          {item.badge !== undefined && item.badge > 0 && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                (item as any).badgeAlert
                                  ? 'bg-[#D93A3A] text-white animate-pulse'
                                  : 'bg-white/20 text-white'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Footer User Info & Sign Out */}
          <div className="p-3.5 border-t border-white/10 bg-black/30 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 truncate max-w-[170px]">
              <div className="w-8 h-8 rounded-full bg-[#0E7C3A] text-white flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser?.name?.charAt(0) || 'A'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold truncate text-white leading-tight">{currentUser?.name}</p>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#1B9E4B] bg-[#0E7C3A]/20 px-1.5 py-0.2 rounded">
                  {currentUser?.role?.replace('_', ' ')}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-white/50 hover:text-[#D93A3A] hover:bg-white/5 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-3 sm:px-6 flex items-center justify-between z-20 flex-shrink-0 shadow-2xs">
          {/* Left: Mobile Menu Button + Breadcrumb */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors shrink-0"
              aria-label="Toggle navigation drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 truncate">
              <span className="text-xs font-semibold text-slate-400 hidden sm:inline">Operations HQ</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline shrink-0" />
              <span className="text-xs sm:text-sm font-black text-slate-900 bg-slate-100 px-2 sm:px-2.5 py-1 rounded-lg truncate">
                {currentTabLabel}
              </span>
            </div>
          </div>

          {/* Center: Global Search Bar */}
          <div className="hidden md:flex items-center gap-2 max-w-sm w-full mx-4 bg-[#F4F6F5] px-3.5 py-2 rounded-xl border border-slate-200 focus-within:border-[#0E7C3A] focus-within:bg-white transition-all">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search Ride ID, Driver plate, Passenger..."
              className="w-full bg-transparent text-xs text-slate-900 outline-none font-medium placeholder:text-slate-400"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
              >
                Clear
              </button>
            )}          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Refresh Live Data */}
            <button
              onClick={refreshAllData}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Refresh Telemetry"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* View Content Container */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          {/* ============================================================== */}
          {/* A2. DASHBOARD (MODERN BENTO METRICS + LIVE STREAM) */}
          {/* ============================================================== */}
          {currentTab === 'dashboard' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pilot Operations Overview</h2>
                  <p className="text-xs text-slate-500 font-medium">Real-time telemetry from FUTMINNA Gidan Kwanu Campus transit</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs font-bold text-[#0E7C3A] bg-[#E6F4EC] px-3.5 py-1.5 rounded-xl border border-[#0E7C3A]/20 flex items-center gap-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-[#1B9E4B] animate-pulse" />
                    <span>0% Platform Commission Active</span>
                  </div>
                </div>
              </div>

              {/* 6 Bento KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#0E7C3A]/40 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rides Today</span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#0E7C3A] flex items-center justify-center">
                      <Car className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">{dashboardData?.totalTripsToday || rides.length}</p>
                  <span className="text-[10px] text-[#1B9E4B] font-bold mt-1 inline-block">Campus Live</span>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#0E7C3A]/40 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completion</span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#1B9E4B] flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-[#1B9E4B] tracking-tight">{dashboardData?.completionRatePercent || 94}%</p>
                  <span className="text-[10px] text-slate-500 font-medium mt-1 inline-block">High Reliability</span>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#0E7C3A]/40 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Wait Time</span>
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-[#E69500] flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">2.4m</p>
                  <span className="text-[10px] text-[#1B9E4B] font-bold mt-1 inline-block">Quick Dispatch</span>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#0E7C3A]/40 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Online Drivers</span>
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center">
                      <UserCheck className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-[#2563EB] tracking-tight">{drivers.filter((d) => d.isOnline).length}</p>
                  <span className="text-[10px] text-slate-500 font-medium mt-1 inline-block">Across Stations</span>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#0E7C3A]/40 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cancelled</span>
                    <div className="w-7 h-7 rounded-lg bg-rose-50 text-[#D93A3A] flex items-center justify-center">
                      <XCircle className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-[#D93A3A] tracking-tight">{dashboardData?.cancelledTripsToday || 0}</p>
                  <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">Minimal Drop</span>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#0E7C3A]/40 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Direct Cash</span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#0E7C3A] flex items-center justify-center">
                      <Banknote className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-[#0E7C3A] tracking-tight">
                    ₦{dashboardData?.cashCollectedToday?.toLocaleString() || '4,800'}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">100% to Drivers</span>
                </div>
              </div>

              {/* Quick Actions & Live Ride Stream Card */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="font-black text-base text-slate-900 tracking-tight">Live Campus Ride Stream</h3>
                    <p className="text-xs text-slate-500">Real-time trip requests, assignments, and campus completions</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentTab('rides')}
                      className="px-3 py-1.5 bg-[#E6F4EC] hover:bg-[#D7EFE0] text-[#0E7C3A] font-bold text-xs rounded-xl border border-[#0E7C3A]/20 transition-colors cursor-pointer"
                    >
                      View All Lifecycle Stream &rarr;
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left text-xs min-w-[620px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                        <th className="py-3 px-3.5">Ride ID</th>
                        <th className="py-3 px-3.5">Passenger</th>
                        <th className="py-3 px-3.5">Route</th>
                        <th className="py-3 px-3.5">Driver</th>
                        <th className="py-3 px-3.5">Fare</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rides.slice(0, 8).map((ride) => (
                        <tr
                          key={ride.id}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                          onClick={() => setSelectedRide(ride)}
                        >
                          <td className="py-3 px-3.5 font-mono font-bold text-slate-900">{ride.id}</td>
                          <td className="py-3 px-3.5 font-bold text-slate-900">{ride.riderName}</td>
                          <td className="py-3 px-3.5 text-slate-600 truncate max-w-xs">
                            <span className="font-medium">{ride.pickupName}</span> &rarr;{' '}
                            <span className="font-medium text-slate-800">{ride.dropoffName}</span>
                          </td>
                          <td className="py-3 px-3.5 text-slate-900">
                            {ride.driverName ? (
                              <span className="font-semibold">{ride.driverName}</span>
                            ) : (
                              <span className="text-[#E69500] font-bold">Matching nearby...</span>
                            )}                          </td>
                          <td className="py-3 px-3.5 font-black text-[#0E7C3A]">₦{ride.fareNaira}</td>
                          <td className="py-3 px-3.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                                ride.status === 'completed'
                                  ? 'bg-emerald-50 text-[#1B9E4B] border-emerald-200'
                                  : ride.status === 'cancelled'
                                  ? 'bg-rose-50 text-[#D93A3A] border-rose-200'
                                  : 'bg-amber-50 text-[#E69500] border-amber-200'
                              }`}
                            >
                              {ride.status}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap space-x-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRide(ride);
                              }}
                              className="px-2.5 py-1 bg-slate-100 group-hover:bg-[#0E7C3A] group-hover:text-white text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                            >
                              Timeline &rarr;
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRide(ride.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete this ride record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {/* ============================================================== */}
          {/* A3. LIVE MAP (FULL-BLEED MODERN TELEMETRY PANEL) */}
          {/* ============================================================== */}
          {currentTab === 'live_map' && (
            <div className="h-[calc(100vh-120px)] flex flex-col bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs relative">
              <div className="p-4 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#0E7C3A] flex items-center justify-center font-bold">
                    <Map className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 tracking-tight">FUTMINNA Campus Live Telemetry Map</h3>
                    <p className="text-[11px] text-slate-500">Real-time driver GPS beacons across Gidan Kwanu campus ring roads</p>
                  </div>
                  <span className="text-xs bg-[#E6F4EC] text-[#0E7C3A] font-bold px-2.5 py-1 rounded-full border border-[#0E7C3A]/20 hidden md:inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#1B9E4B] animate-pulse" />
                    <span>5s Live Stream · {drivers.filter((d) => d.isOnline).length} Active Vehicles</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="flex items-center gap-1.5 font-bold text-[#1B9E4B] bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1B9E4B]" /> Online
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" /> In Trip
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-[#E69500] bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E69500]" /> Station Waiting
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full relative z-0">
                <RealLiveMap stage="choose" selectedRide="keke" />
              </div>
            </div>
          )}
          {/* ============================================================== */}
          {/* A4 & A5. RIDES & TIMELINE DETAIL */}
          {/* ============================================================== */}
          {currentTab === 'rides' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Rides Lifecycle Stream</h2>
                  <p className="text-xs text-slate-500 font-medium">Inspect complete 7-step timeline, reassign drivers, or cancel rides</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={handleClearTestRides}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                    title="Clear completed and cancelled test rides"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Test Rides</span>
                  </button>
                  <button
                    onClick={() => {
                      const csvContent =
                        'data:text/csv;charset=utf-8,' +
                        ['Ride ID,Passenger,Driver,Plate,Pickup,Dropoff,Fare,Status,Date'].join(',') +
                        '\n' +
                        rides
                          .map(
                            (r) =>
                              `"${r.id}","${r.riderName}","${r.driverName || ''}","${r.vehiclePlate || ''}","${r.pickupName}","${r.dropoffName}",${r.fareNaira},"${r.status}","${r.createdAt}"`
                          )
                          .join('\n');
                      const link = document.createElement('a');
                      link.setAttribute('href', encodeURI(csvContent));
                      link.setAttribute('download', `zylift_trips_${Date.now()}.csv`);
                      document.body.appendChild(link);
                      link.click();
                    }}
                    className="px-4 py-2 bg-white text-slate-800 border border-slate-200/80 rounded-xl text-xs font-bold hover:bg-slate-50 shadow-2xs flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Export CSV Log</span>
                  </button>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(
                  [
                    { id: 'all', label: `All Rides (${rides.length})` },
                    {
                      id: 'in_progress',
                      label: `In Progress (${
                        rides.filter((r) =>
                          ['requested', 'matching', 'accepted', 'arriving', 'in_progress'].includes(r.status)
                        ).length
                      })`,
                    },
                    {
                      id: 'completed',
                      label: `Completed (${rides.filter((r) => r.status === 'completed').length})`,
                    },
                    {
                      id: 'cancelled',
                      label: `Cancelled (${rides.filter((r) => r.status === 'cancelled').length})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setRideStatusFilter(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      rideStatusFilter === tab.id
                        ? 'bg-[#0E7C3A] text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-3 sm:p-6 shadow-xs">
                {/* Desktop Data Table */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                        <th className="py-3 px-3.5">Ride ID</th>
                        <th className="py-3 px-3.5">Passenger</th>
                        <th className="py-3 px-3.5">Campus Route</th>
                        <th className="py-3 px-3.5">Assigned Driver</th>
                        <th className="py-3 px-3.5">Fare</th>
                        <th className="py-3 px-3.5">Safety PIN</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5 text-right">Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rides
                        .filter((r) => {
                          if (rideStatusFilter === 'in_progress') {
                            return ['requested', 'matching', 'accepted', 'arriving', 'in_progress'].includes(r.status);
                          }
                          if (rideStatusFilter === 'completed') return r.status === 'completed';
                          if (rideStatusFilter === 'cancelled') return r.status === 'cancelled';
                          return true;
                        })
                        .filter((r) => {
                          if (!globalSearch) return true;
                          const q = globalSearch.toLowerCase();
                          return (
                            r.id?.toLowerCase().includes(q) ||
                            r.riderName?.toLowerCase().includes(q) ||
                            r.driverName?.toLowerCase().includes(q) ||
                            r.vehiclePlate?.toLowerCase().includes(q) ||
                            r.pickupName?.toLowerCase().includes(q) ||
                            r.dropoffName?.toLowerCase().includes(q)
                          );
                        })
                        .map((ride) => (
                          <tr key={ride.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5 font-mono font-bold text-slate-900">{ride.id}</td>
                            <td className="py-3 px-3.5">
                              <p className="font-bold text-slate-900">{ride.riderName}</p>
                              <span className="text-[10px] text-slate-400 font-mono">{ride.riderPhone}</span>
                            </td>
                            <td className="py-3 px-3.5 text-slate-600 truncate max-w-xs">
                              <span className="font-semibold text-slate-800">{ride.pickupName}</span> &rarr;{' '}
                              <span className="font-semibold text-slate-800">{ride.dropoffName}</span>
                            </td>
                            <td className="py-3 px-3.5">
                              {ride.driverName ? (
                                <div>
                                  <span className="font-bold text-slate-900 block">{ride.driverName}</span>
                                  <span className="font-mono text-[10px] text-slate-400 font-semibold">{ride.vehiclePlate}</span>
                                </div>
                              ) : (
                                <span className="text-[#E69500] font-bold">Matching...</span>
                              )}                            </td>
                            <td className="py-3 px-3.5 font-black text-[#0E7C3A]">₦{ride.fareNaira}</td>
                            <td className="py-3 px-3.5">
                              <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/50">
                                {ride.safetyPin}
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                                  ride.status === 'completed'
                                    ? 'bg-emerald-50 text-[#1B9E4B] border-emerald-200'
                                    : ride.status === 'cancelled'
                                    ? 'bg-rose-50 text-[#D93A3A] border-rose-200'
                                    : 'bg-amber-50 text-[#E69500] border-amber-200'
                                }`}
                              >
                                {ride.status}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => setSelectedRide(ride)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-[#E6F4EC] text-[#0E7C3A] font-bold rounded-lg text-xs transition-colors cursor-pointer"
                              >
                                Timeline
                              </button>
                              {ride.status !== 'completed' && ride.status !== 'cancelled' && (
                                <>
                                  <button
                                    onClick={() => {
                                      setReassignModalRide(ride);
                                      setReassignDriverId(drivers[0]?.id || '');
                                    }}
                                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#2563EB] font-bold rounded-lg text-xs transition-colors cursor-pointer"
                                  >
                                    Reassign
                                  </button>
                                  <button
                                    onClick={() => setCancelModalRide(ride)}
                                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-[#D93A3A] font-bold rounded-lg text-xs transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRide(ride.id);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                title="Delete this ride record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Responsive Ride Cards */}
                <div className="md:hidden space-y-3">
                  {rides
                    .filter((r) => {
                      if (rideStatusFilter === 'in_progress') {
                        return ['requested', 'matching', 'accepted', 'arriving', 'in_progress'].includes(r.status);
                      }
                      if (rideStatusFilter === 'completed') return r.status === 'completed';
                      if (rideStatusFilter === 'cancelled') return r.status === 'cancelled';
                      return true;
                    })
                    .filter((r) => {
                      if (!globalSearch) return true;
                      const q = globalSearch.toLowerCase();
                      return (
                        r.id?.toLowerCase().includes(q) ||
                        r.riderName?.toLowerCase().includes(q) ||
                        r.driverName?.toLowerCase().includes(q) ||
                        r.vehiclePlate?.toLowerCase().includes(q) ||
                        r.pickupName?.toLowerCase().includes(q) ||
                        r.dropoffName?.toLowerCase().includes(q)
                      );
                    })
                    .map((ride) => (
                      <div key={ride.id} className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-slate-900">#{ride.id.slice(-6)}</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(ride.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              ride.status === 'completed'
                                ? 'bg-emerald-50 text-[#1B9E4B] border border-emerald-200'
                                : ride.status === 'cancelled'
                                ? 'bg-rose-50 text-[#D93A3A] border border-rose-200'
                                : 'bg-blue-50 text-[#2563EB] border border-blue-200'
                            }`}
                          >
                            {ride.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="bg-[#F8FAF9] p-2.5 rounded-xl border border-[#DDE3DF]/60 space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full bg-[#0E7C3A] shrink-0" />
                            <span className="font-bold text-[#14201A] truncate">{ride.pickupName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0" />
                            <span className="font-bold text-[#14201A] truncate">{ride.dropoffName}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Passenger</span>
                            <span className="font-bold text-slate-900 truncate block">{ride.riderName || 'Anonymous'}</span>
                            <span className="text-[10px] font-mono text-slate-500">{ride.riderPhone}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Driver</span>
                            <span className="font-bold text-slate-900 truncate block">{ride.driverName || 'Matching...'}</span>
                            {ride.driverPlate && <span className="text-[10px] font-mono text-slate-500">{ride.driverPlate}</span>}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <div>
                            <span className="font-black text-[#0E7C3A] text-sm">₦{ride.fareNaira}</span>
                            <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-700 ml-2">
                              PIN: {ride.safetyPin}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setSelectedRide(ride)}
                              className="px-2.5 py-1.5 bg-[#E6F4EC] text-[#0E7C3A] font-bold text-xs rounded-xl hover:bg-[#D7EFE0] transition-colors cursor-pointer"
                            >
                              Timeline
                            </button>
                            {ride.status !== 'completed' && ride.status !== 'cancelled' && (
                              <>
                                <button
                                  onClick={() => {
                                    setReassignModalRide(ride);
                                    setReassignDriverId(drivers[0]?.id || '');
                                  }}
                                  className="px-2 py-1.5 bg-blue-50 text-[#2563EB] font-bold text-xs rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
                                >
                                  Reassign
                                </button>
                                <button
                                  onClick={() => setCancelModalRide(ride)}
                                  className="px-2 py-1.5 bg-rose-50 text-[#D93A3A] font-bold text-xs rounded-xl hover:bg-rose-100 transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            )}                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRide(ride.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete this ride record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {rides.length === 0 && (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No rides logged under this filter.
                    </div>
                  )}                </div>
              </div>
            </div>
          )}
          {/* ============================================================== */}
          {/* A6 & A7. DRIVERS REVIEW & 4-BOX VERIFICATION CHECKLIST */}
          {/* ============================================================== */}
          {currentTab === 'drivers' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Driver Verification & Fleet Management</h2>
                  <p className="text-xs text-slate-500 font-medium">Enforce mandatory 4-box in-person inspection checklist and inspect documents</p>
                </div>
              </div>

              {/* Segmented Filter Pills */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDriverTabFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    driverTabFilter === 'all'
                      ? 'bg-[#0E7C3A] text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  All Sections
                </button>
                <button
                  type="button"
                  onClick={() => setDriverTabFilter('pending')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    driverTabFilter === 'pending'
                      ? 'bg-[#0E7C3A] text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  <span>Pending Dossiers</span>
                  {pendingDriversList.length > 0 && (
                    <span className="bg-[#D93A3A] text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                      {pendingDriversList.length}
                    </span>
                  )}                </button>
                <button
                  type="button"
                  onClick={() => setDriverTabFilter('active')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    driverTabFilter === 'active'
                      ? 'bg-[#0E7C3A] text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  Approved Fleet ({drivers.filter((d) => d.isApproved !== false).length})
                </button>
              </div>

              {/* Applications under Review */}
              {(driverTabFilter === 'all' || driverTabFilter === 'pending') && (
                <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-black text-base text-slate-900 tracking-tight">
                        Pending Driver Registrations Awaiting Verification & Approval
                      </h3>
                      <p className="text-xs text-slate-500">Review submitted documents, perform in-person inspection, or approve/delete registration</p>
                    </div>
                    <span className="text-xs font-bold text-[#E69500] bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      {pendingDriversList.length} In Review
                    </span>
                  </div>

                  {pendingDriversList.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <CheckCircle2 className="w-8 h-8 text-[#1B9E4B] mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">All driver applications are vetted & up to date!</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">New driver registrations will appear here automatically.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingDriversList.map((app) => (
                        <div
                          key={app.id}
                          className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/40 via-white to-white rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#0E7C3A]/50 transition-all shadow-2xs"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-full bg-[#0E7C3A] text-white flex items-center justify-center font-black text-sm shrink-0 relative overflow-hidden border border-amber-200">
                              <span>{(app.applicantName || app.name || 'D').charAt(0).toUpperCase()}</span>
                              {app.facePhotoUrl && !String(app.facePhotoUrl).includes('driver_avatar_keke_1790847258442') && (
                                <img
                                  src={app.facePhotoUrl}
                                  alt={app.applicantName || app.name || 'Driver'}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="font-black text-sm sm:text-base text-slate-900">{app.applicantName || app.name}</span>
                                <span className="text-xs font-mono text-slate-500 font-semibold">{app.phone}</span>
                                <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
                                  {app.vehicleCategory}
                                </span>
                                <span className="text-[10px] font-extrabold uppercase bg-rose-100 text-[#D93A3A] px-2 py-0.5 rounded">
                                  Awaiting Approval
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1">
                                Vehicle: <strong className="text-slate-800">{app.vehicleModel || 'Campus Transit'}</strong> · Plate:{' '}
                                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  {app.vehiclePlate || 'N/A'}
                                </span>
                              </p>
                              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 flex-wrap">
                                <span>Park Leader: <strong className="text-slate-700">{app.parkLeaderName || 'Main Gate Chairman'}</strong></span>
                                {app.ninNumber && <span>· NIN: <strong className="font-mono text-slate-700">{app.ninNumber}</strong></span>}
                                {app.homeArea && <span>· Area: <strong className="text-slate-700">{app.homeArea}</strong></span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                            <button
                              onClick={async () => {
                                if (confirm(`1-Click Approve driver ${app.applicantName || app.name} (${app.vehiclePlate})? This confirms in-person verification and activates the driver immediately.`)) {
                                  await adminFetch(`/api/admin/drivers/${app.id}/approve`, {
                                    method: 'POST',
                                    body: JSON.stringify({
                                      checklist: {
                                        metInPerson: true,
                                        faceMatchesId: true,
                                        plateMatchesVehicle: true,
                                        parkLeaderKnown: true,
                                      },
                                    }),
                                  });
                                  refreshAllData();
                                }
                              }}
                              className="px-3.5 py-2.5 bg-[#0E7C3A] hover:bg-[#0A632E] text-white font-bold text-xs rounded-xl shadow-md shadow-[#0E7C3A]/20 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve Driver
                            </button>

                            <button
                              onClick={() => {
                                setSelectedDriverApp(app);
                                setVerificationChecklist({
                                  metInPerson: false,
                                  faceMatchesId: false,
                                  plateMatchesVehicle: false,
                                  parkLeaderKnown: false,
                                });
                              }}
                              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap"
                            >
                              Docs & Dossier &rarr;
                            </button>

                            <button
                              onClick={async () => {
                                if (confirm(`Permanently delete driver registration for ${app.applicantName || app.name}? This action cannot be undone.`)) {
                                  await adminFetch(`/api/admin/drivers/${app.id}`, { method: 'DELETE' });
                                  refreshAllData();
                                }
                              }}
                              className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-[#D93A3A] font-bold text-xs rounded-xl border border-rose-200 transition-all cursor-pointer whitespace-nowrap"
                              title="Delete registration"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}                </div>
              )}
              {/* Active Driver Fleet */}
              {(driverTabFilter === 'all' || driverTabFilter === 'active') && (
                <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-black text-base text-slate-900 tracking-tight">Approved Campus Fleet</h3>
                      <p className="text-xs text-slate-500">Active vetted drivers operating within FUTMINNA campus boundaries</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      {drivers.length} Registered Drivers
                    </span>
                  </div>

                  {/* Desktop Driver Table */}
                  <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left text-xs min-w-[720px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                          <th className="py-3 px-3.5">Driver</th>
                          <th className="py-3 px-3.5">Plate Number</th>
                          <th className="py-3 px-3.5">Category</th>
                          <th className="py-3 px-3.5">Rating</th>
                          <th className="py-3 px-3.5">Trips</th>
                          <th className="py-3 px-3.5">Base Station</th>
                          <th className="py-3 px-3.5">Fleet Status</th>
                          <th className="py-3 px-3.5 text-right">Controls</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {drivers.map((drv) => (
                          <tr key={drv.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-full bg-[#0E7C3A] text-white flex items-center justify-center font-bold text-xs shrink-0 relative overflow-hidden">
                                  <span>{drv.name?.charAt(0)?.toUpperCase() || 'D'}</span>
                                  {(drv.facePhotoUrl || drv.avatarUrl) &&
                                    !String(drv.facePhotoUrl || drv.avatarUrl).includes('driver_avatar_keke_1790847258442') && (
                                      <img
                                        src={drv.facePhotoUrl || drv.avatarUrl}
                                        alt={drv.name}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                      />
                                    )}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">{drv.name}</p>
                                  <span className="text-[10px] text-slate-400 font-mono">{drv.phone}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3.5">
                              <KerbPlateBadge plate={drv.vehiclePlate} />
                            </td>
                            <td className="py-3 px-3.5 capitalize font-semibold text-slate-700">{drv.vehicleCategory}</td>
                            <td className="py-3 px-3.5 text-[#E69500] font-bold">★ {drv.rating}</td>
                            <td className="py-3 px-3.5 font-bold text-slate-900">{drv.totalTrips}</td>
                            <td className="py-3 px-3.5 text-slate-500 font-medium">{drv.stationName || 'Motor Park'}</td>
                            <td className="py-3 px-3.5">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                                  drv.isSuspended
                                    ? 'bg-rose-50 text-[#D93A3A] border-rose-200'
                                    : drv.isOnline
                                    ? 'bg-emerald-50 text-[#1B9E4B] border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {drv.isSuspended ? 'SUSPENDED' : drv.isOnline ? 'ONLINE' : 'OFFLINE'}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right space-x-1.5 whitespace-nowrap">
                              {!drv.isApproved && (
                                <button
                                  onClick={async () => {
                                    if (confirm(`Approve driver ${drv.name} (${drv.vehiclePlate})? This confirms in-person verification and activates the driver.`)) {
                                      await adminFetch(`/api/admin/drivers/${drv.id}/approve`, {
                                        method: 'POST',
                                        body: JSON.stringify({
                                          checklist: {
                                            metInPerson: true,
                                            faceMatchesId: true,
                                            plateMatchesVehicle: true,
                                            parkLeaderKnown: true,
                                          },
                                        }),
                                      });
                                      refreshAllData();
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                                >
                                  Approve
                                </button>
                              )}                              <button
                                onClick={() => {
                                  setSelectedDriverApp(drv);
                                }}
                                className="px-2.5 py-1 bg-emerald-50 text-[#0E7C3A] font-bold rounded-lg text-xs hover:bg-[#D4EEDB] border border-[#0E7C3A]/20 transition-colors cursor-pointer"
                                title="View & Download Driver Documents"
                              >
                                Docs & Dossier
                              </button>
                              <button
                                onClick={async () => {
                                  const reason = prompt(`Reason for suspending ${drv.name}:`);
                                  if (reason) {
                                    await adminFetch(`/api/admin/drivers/${drv.id}/suspend`, {
                                      method: 'POST',
                                      body: JSON.stringify({ reason }),
                                    });
                                    refreshAllData();
                                  }
                                }}
                                className="px-2.5 py-1 bg-rose-50 text-[#D93A3A] font-bold rounded-lg text-xs hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                              >
                                Suspend
                              </button>
                              <button
                                onClick={async () => {
                                  const warningText = prompt(`Warning text for ${drv.name}:`);
                                  if (warningText) {
                                    await adminFetch(`/api/admin/drivers/${drv.id}/warn`, {
                                      method: 'POST',
                                      body: JSON.stringify({ warningText }),
                                    });
                                    refreshAllData();
                                  }
                                }}
                                className="px-2.5 py-1 bg-amber-50 text-[#E69500] font-bold rounded-lg text-xs hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                              >
                                Warn
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Permanently delete driver registration for ${drv.name} (${drv.vehiclePlate})? This action cannot be undone.`)) {
                                    await adminFetch(`/api/admin/drivers/${drv.id}`, { method: 'DELETE' });
                                    refreshAllData();
                                  }
                                }}
                                className="px-2.5 py-1 bg-rose-100 text-[#D93A3A] hover:bg-rose-200 font-bold rounded-lg text-xs border border-rose-300 transition-colors cursor-pointer"
                                title="Permanently delete driver registration"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Responsive Driver Fleet Cards */}
                  <div className="md:hidden space-y-3">
                    {drivers.map((drv) => (
                      <div key={drv.id} className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-[#0E7C3A] text-white flex items-center justify-center font-bold text-xs shrink-0 relative overflow-hidden">
                              <span>{drv.name?.charAt(0)?.toUpperCase() || 'D'}</span>
                              {(drv.facePhotoUrl || drv.avatarUrl) &&
                                !String(drv.facePhotoUrl || drv.avatarUrl).includes('driver_avatar_keke_1790847258442') && (
                                  <img
                                    src={drv.facePhotoUrl || drv.avatarUrl}
                                    alt={drv.name}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                )}
                            </div>
                            <div>
                              <p className="font-bold text-xs text-slate-900">{drv.name}</p>
                              <span className="text-[10px] font-mono text-slate-400">{drv.phone}</span>
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                              drv.isSuspended
                                ? 'bg-rose-50 text-[#D93A3A] border-rose-200'
                                : drv.isOnline
                                ? 'bg-emerald-50 text-[#1B9E4B] border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {drv.isSuspended ? 'SUSPENDED' : drv.isOnline ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between bg-[#F8FAF9] p-2.5 rounded-xl border border-[#DDE3DF]/60 text-xs">
                          <div className="flex items-center gap-2">
                            <KerbPlateBadge plate={drv.vehiclePlate} />
                            <span className="capitalize font-semibold text-slate-700">{drv.vehicleCategory}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#E69500] font-bold">★ {drv.rating}</span>
                            <span className="text-slate-400 font-medium">· {drv.totalTrips} rides</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                          <span className="truncate max-w-[120px] text-[11px]">Base: {drv.stationName || 'Motor Park'}</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {!drv.isApproved && (
                              <button
                                onClick={async () => {
                                  if (confirm(`Approve driver ${drv.name} (${drv.vehiclePlate})?`)) {
                                    await adminFetch(`/api/admin/drivers/${drv.id}/approve`, {
                                      method: 'POST',
                                      body: JSON.stringify({
                                        checklist: { metInPerson: true, faceMatchesId: true, plateMatchesVehicle: true, parkLeaderKnown: true },
                                      }),
                                    });
                                    refreshAllData();
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                              >
                                Approve
                              </button>
                            )}                            <button
                              onClick={() => setSelectedDriverApp(drv)}
                              className="px-2.5 py-1.5 bg-emerald-50 text-[#0E7C3A] font-bold text-xs rounded-xl hover:bg-[#D4EEDB] transition-colors cursor-pointer"
                            >
                              Docs
                            </button>
                            <button
                              onClick={async () => {
                                const reason = prompt(`Reason for suspending ${drv.name}:`);
                                if (reason) {
                                  await adminFetch(`/api/admin/drivers/${drv.id}/suspend`, {
                                    method: 'POST',
                                    body: JSON.stringify({ reason }),
                                  });
                                  refreshAllData();
                                }
                              }}
                              className="px-2.5 py-1.5 bg-rose-50 text-[#D93A3A] font-bold text-xs rounded-xl hover:bg-rose-100 transition-colors cursor-pointer"
                            >
                              Suspend
                            </button>
                            <button
                              onClick={async () => {
                                const warningText = prompt(`Warning text for ${drv.name}:`);
                                if (warningText) {
                                  await adminFetch(`/api/admin/drivers/${drv.id}/warn`, {
                                    method: 'POST',
                                    body: JSON.stringify({ warningText }),
                                  });
                                  refreshAllData();
                                }
                              }}
                              className="px-2.5 py-1.5 bg-amber-50 text-[#E69500] font-bold text-xs rounded-xl hover:bg-amber-100 transition-colors cursor-pointer"
                            >
                              Warn
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Permanently delete driver registration for ${drv.name} (${drv.vehiclePlate})? This action cannot be undone.`)) {
                                  await adminFetch(`/api/admin/drivers/${drv.id}`, { method: 'DELETE' });
                                  refreshAllData();
                                }
                              }}
                              className="px-2.5 py-1.5 bg-rose-100 text-[#D93A3A] hover:bg-rose-200 font-bold text-xs rounded-xl border border-rose-300 transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {drivers.length === 0 && (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        No approved drivers in fleet yet.
                      </div>
                    )}                  </div>
                </div>
              )}            </div>
          )}
          {/* ============================================================== */}
          {/* A8. CAMPUS PASSENGER DIRECTORY */}
          {/* ============================================================== */}
          {currentTab === 'riders' && (
            <div className="space-y-6 max-w-7xl">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#14201A] tracking-tight">Campus Passenger Directory</h2>
                  <p className="text-xs sm:text-sm text-[#7A857F] mt-0.5">
                    FUTMINNA student, faculty & visitor rider accounts & wallet balances
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      exportToCsv(
                        `FUTMINNA_Passengers_${new Date().toISOString().slice(0, 10)}.csv`,
                        ['User ID', 'Full Name', 'Phone', 'Role', 'Matric/Staff ID', 'Department', 'Trips Completed', 'Status', 'Block Reason'],
                        ridersList.map(u => [
                          u.id,
                          u.name || 'Anonymous',
                          u.phone,
                          u.role || 'student',
                          u.matricOrStaffId || '',
                          u.department || '',
                          u.tripsCount || 0,
                          u.isBlocked ? 'BLOCKED' : 'ACTIVE',
                          u.blockReason || ''
                        ])
                      );
                    }}
                    className="px-3.5 py-2.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#14201A] rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#0E7C3A]" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={refreshAllData}
                    className="p-2.5 bg-white border border-[#DDE3DF] text-[#7A857F] hover:text-[#0E7C3A] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                    title="Refresh data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bento KPI Summary Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Total Registered</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-[#14201A]">{ridersList.length}</span>
                    <span className="text-[10px] font-bold text-[#0E7C3A] bg-[#E6F4EC] px-1.5 py-0.5 rounded-md">Live</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">FUTMINNA community riders</p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Active In Good Standing</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-[#0E7C3A]">
                      {ridersList.filter(r => !r.isBlocked).length}
                    </span>
                    <span className="text-[10px] font-bold text-[#0E7C3A] bg-[#E6F4EC] px-1.5 py-0.5 rounded-md">
                      {ridersList.length > 0 ? Math.round((ridersList.filter(r => !r.isBlocked).length / ridersList.length) * 100) : 100}%
                    </span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">Eligible to hail rides</p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Completed Rider Trips</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-[#14201A]">
                      {ridersList.reduce((acc, r) => acc + (r.tripsCount || 0), 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">Total verified campus trips</p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Role Breakdown</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm font-bold text-[#14201A]">
                      {ridersList.filter(r => (r.role || 'student') === 'student').length} Std · {ridersList.filter(r => r.role === 'staff').length} Staff
                    </span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">
                    {ridersList.filter(r => r.role === 'visitor').length} campus visitors
                  </p>
                </div>
              </div>

              {/* Filters & Search Bar */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#DDE3DF] p-3 sm:p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#7A857F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={riderSearchQuery}
                    onChange={(e) => setRiderSearchQuery(e.target.value)}
                    placeholder="Search by name, phone, matric number, or department..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F4F6F5] rounded-xl text-xs font-semibold text-[#14201A] placeholder-[#7A857F] outline-none focus:bg-white focus:ring-2 focus:ring-[#0E7C3A]/30 border border-transparent focus:border-[#0E7C3A] transition-all"
                  />
                  {riderSearchQuery && (
                    <button
                      onClick={() => setRiderSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7A857F] hover:text-[#14201A]"
                    >
                      Clear
                    </button>
                  )}                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                  {(['all', 'student', 'staff', 'visitor'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRiderRoleFilter(r)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap shrink-0 ${
                        riderRoleFilter === r
                          ? 'bg-[#0E7C3A] text-white shadow-xs'
                          : 'bg-[#F4F6F5] text-[#3E4A43] hover:bg-[#EAEFEA]'
                      }`}
                    >
                      {r === 'all' ? 'All Roles' : `${r}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Passenger Directory Table */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#DDE3DF] overflow-hidden shadow-xs">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#DDE3DF] bg-[#F8FAF9] text-[#7A857F] uppercase text-[10px] tracking-wider font-bold">
                        <th className="py-3 px-4">Passenger</th>
                        <th className="py-3 px-4">Role & ID</th>
                        <th className="py-3 px-4">Department / Unit</th>
                        <th className="py-3 px-4">Trips Completed</th>
                        <th className="py-3 px-4">Account Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F3F1]">
                      {ridersList
                        .filter((user) => {
                          if (riderRoleFilter !== 'all' && (user.role || 'student') !== riderRoleFilter) return false;
                          if (riderSearchQuery.trim()) {
                            const q = riderSearchQuery.toLowerCase();
                            const matchesName = (user.name || '').toLowerCase().includes(q);
                            const matchesPhone = (user.phone || '').includes(q);
                            const matchesId = (user.matricOrStaffId || '').toLowerCase().includes(q);
                            const matchesDept = (user.department || '').toLowerCase().includes(q);
                            return matchesName || matchesPhone || matchesId || matchesDept;
                          }
                          return true;
                        })
                        .map((user) => {
                          const role = user.role || 'student';
                          return (
                            <tr key={user.id} className="hover:bg-[#F9FBFA] transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-full bg-[#0E7C3A] text-white flex items-center justify-center font-bold text-xs shrink-0 relative overflow-hidden">
                                    <span>{(user.name || 'P').charAt(0).toUpperCase()}</span>
                                    {user.avatarUrl && (
                                      <img
                                        src={user.avatarUrl}
                                        alt={user.name || 'Passenger'}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                      />
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-bold text-[#14201A]">{user.name || 'Anonymous Rider'}</div>
                                    <div className="text-[11px] font-mono text-[#7A857F]">{user.phone}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                      role === 'student'
                                        ? 'bg-[#E6F4EC] text-[#0E7C3A] border border-[#0E7C3A]/20'
                                        : role === 'staff'
                                        ? 'bg-[#EEF2FF] text-[#4F46E5] border border-[#4F46E5]/20'
                                        : 'bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/20'
                                    }`}
                                  >
                                    {role}
                                  </span>
                                </div>
                                <div className="text-[11px] font-mono text-[#7A857F] mt-0.5">
                                  {user.matricOrStaffId || 'Not specified'}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-medium text-[#3E4A43]">
                                {user.department || 'General Campus'}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="font-black text-[#0E7C3A] text-sm">
                                  {(user.tripsCount || 0).toLocaleString()} {(user.tripsCount || 0) === 1 ? 'trip' : 'trips'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                {user.isBlocked ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FDE8E8] text-[#D93A3A] border border-[#D93A3A]/20">
                                      <XCircle className="w-3 h-3" />
                                      Blocked
                                    </span>
                                    {user.blockReason && (
                                      <p className="text-[10px] text-[#D93A3A] mt-0.5 max-w-xs truncate" title={user.blockReason}>
                                        {user.blockReason}
                                      </p>
                                    )}                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F4EC] text-[#0E7C3A] border border-[#0E7C3A]/20">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Active
                                  </span>
                                )}                              </td>
                              <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                                {user.isBlocked ? (
                                  <button
                                    onClick={async () => {
                                      await adminFetch(`/api/admin/riders/${user.id}/unblock`, { method: 'POST' });
                                      refreshAllData();
                                    }}
                                    className="px-3 py-1.5 bg-[#E6F4EC] hover:bg-[#d5edd9] text-[#0E7C3A] font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                  >
                                    Unblock
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setBlockingRider(user);
                                      setBlockReasonInput('');
                                    }}
                                    className="px-3 py-1.5 bg-[#FDE8E8] hover:bg-[#fbd0d0] text-[#D93A3A] font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                  >
                                    Block Rider
                                  </button>
                                )}                                <button
                                  onClick={async () => {
                                    if (confirm(`Permanently delete passenger registration for ${user.name || 'this passenger'} (${user.phone})? This will remove their record from the database.`)) {
                                      await adminFetch(`/api/admin/riders/${user.id}`, { method: 'DELETE' });
                                      refreshAllData();
                                    }
                                  }}
                                  className="px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-[#D93A3A] font-bold rounded-xl text-xs border border-rose-300 transition-colors cursor-pointer"
                                  title="Permanently delete user registration"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      {ridersList.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-[#7A857F]">
                            <Users className="w-8 h-8 text-[#DDE3DF] mx-auto mb-2" />
                            <p className="font-bold text-sm text-[#14201A]">No Registered Passengers Yet</p>
                            <p className="text-xs text-[#7A857F] mt-0.5">Riders will appear here as they register on the campus portal.</p>
                          </td>
                        </tr>
                      )}                    </tbody>
                  </table>
                </div>

                {/* Mobile Responsive Passenger Cards */}
                <div className="md:hidden space-y-3 p-3">
                  {ridersList
                    .filter((user) => {
                      if (riderRoleFilter !== 'all' && (user.role || 'student') !== riderRoleFilter) return false;
                      if (riderSearchQuery.trim()) {
                        const q = riderSearchQuery.toLowerCase();
                        const matchesName = (user.name || '').toLowerCase().includes(q);
                        const matchesPhone = (user.phone || '').includes(q);
                        const matchesId = (user.matricOrStaffId || '').toLowerCase().includes(q);
                        const matchesDept = (user.department || '').toLowerCase().includes(q);
                        return matchesName || matchesPhone || matchesId || matchesDept;
                      }
                      return true;
                    })
                    .map((user) => {
                      const role = user.role || 'student';
                      return (
                        <div key={user.id} className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-full bg-[#0E7C3A] text-white flex items-center justify-center font-bold text-xs shrink-0 relative overflow-hidden">
                                <span>{(user.name || 'P').charAt(0).toUpperCase()}</span>
                                {user.avatarUrl && (
                                  <img
                                    src={user.avatarUrl}
                                    alt={user.name || 'Passenger'}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-xs text-[#14201A]">{user.name || 'Anonymous Rider'}</p>
                                <span className="text-[10px] font-mono text-[#7A857F]">{user.phone}</span>
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                role === 'student'
                                  ? 'bg-[#E6F4EC] text-[#0E7C3A] border border-[#0E7C3A]/20'
                                  : role === 'staff'
                                  ? 'bg-[#EEF2FF] text-[#4F46E5] border border-[#4F46E5]/20'
                                  : 'bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/20'
                              }`}
                            >
                              {role}
                            </span>
                          </div>

                          <div className="bg-[#F8FAF9] p-2.5 rounded-xl border border-[#DDE3DF]/60 text-xs flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">ID & Dept</span>
                              <span className="font-semibold text-[#14201A]">{user.matricOrStaffId || 'No ID'}</span>
                              <span className="text-slate-500 block text-[11px] truncate max-w-[150px]">{user.department || 'General Campus'}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">Trips</span>
                              <span className="font-black text-[#0E7C3A] text-sm">{(user.tripsCount || 0).toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <div>
                              {user.isBlocked ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FDE8E8] text-[#D93A3A] border border-[#D93A3A]/20">
                                  <XCircle className="w-3 h-3" />
                                  Blocked
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F4EC] text-[#0E7C3A] border border-[#0E7C3A]/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Active
                                </span>
                              )}                            </div>

                            <div className="flex items-center gap-1.5">
                              {user.isBlocked ? (
                                <button
                                  onClick={async () => {
                                    await adminFetch(`/api/admin/riders/${user.id}/unblock`, { method: 'POST' });
                                    refreshAllData();
                                  }}
                                  className="px-3 py-1.5 bg-[#E6F4EC] hover:bg-[#d5edd9] text-[#0E7C3A] font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                  Unblock
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setBlockingRider(user);
                                    setBlockReasonInput('');
                                  }}
                                  className="px-3 py-1.5 bg-[#FDE8E8] hover:bg-[#fbd0d0] text-[#D93A3A] font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                  Block Rider
                                </button>
                              )}                              <button
                                onClick={async () => {
                                  if (confirm(`Permanently delete passenger registration for ${user.name || 'this passenger'} (${user.phone})?`)) {
                                    await adminFetch(`/api/admin/riders/${user.id}`, { method: 'DELETE' });
                                    refreshAllData();
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-[#D93A3A] font-bold rounded-xl text-xs border border-rose-300 transition-colors cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {ridersList.length === 0 && (
                    <div className="py-8 text-center text-[#7A857F] text-xs">
                      No passengers registered yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CAMPUS REFERRALS & PIONEER AMBASSADOR MANAGEMENT */}
          {/* ============================================================== */}
          {currentTab === 'referrals' && (
            <div className="space-y-6 max-w-7xl animate-fadeIn">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#14201A] tracking-tight flex items-center gap-2">
                    <Gift className="w-6 h-6 text-[#0E7C3A]" />
                    Campus Referrals & Pioneer Ambassadors
                  </h2>
                  <p className="text-xs sm:text-sm text-[#7A857F] mt-0.5">
                    Peer-to-peer driver and passenger referrals across FUTMINNA (100% zero-cost community growth model)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-[#E6F4EC] text-[#0E7C3A] text-xs font-bold rounded-xl border border-[#0E7C3A]/20 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    Zero-Cost Non-Cash Model
                  </span>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 bg-white rounded-2xl border border-[#DDE3DF] shadow-xs">
                  <span className="text-[11px] font-bold uppercase text-[#7A857F] block">Total Referrals</span>
                  <p className="text-2xl sm:text-3xl font-black text-[#14201A] mt-1">{referralsData.totalReferrals}</p>
                  <p className="text-[11px] text-[#7A857F] mt-0.5">Students & Drivers joined via link</p>
                </div>

                <div className="p-4 bg-[#E6F4EC]/60 rounded-2xl border border-[#0E7C3A]/30 shadow-xs">
                  <span className="text-[11px] font-bold uppercase text-[#0E7C3A] block">1st Rides Completed</span>
                  <p className="text-2xl sm:text-3xl font-black text-[#0E7C3A] mt-1">{referralsData.completedReferrals}</p>
                  <p className="text-[11px] text-[#0E7C3A] mt-0.5">Perks unlocked upon trip completion</p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-[#DDE3DF] shadow-xs">
                  <span className="text-[11px] font-bold uppercase text-amber-700 block">Pending 1st Ride</span>
                  <p className="text-2xl sm:text-3xl font-black text-amber-600 mt-1">{referralsData.pendingReferrals}</p>
                  <p className="text-[11px] text-[#7A857F] mt-0.5">Signed up, awaiting first completed trip</p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-[#DDE3DF] shadow-xs">
                  <span className="text-[11px] font-bold uppercase text-[#7A857F] block">Active Ambassadors</span>
                  <p className="text-2xl sm:text-3xl font-black text-[#14201A] mt-1">{referralsData.leaderboard.length}</p>
                  <p className="text-[11px] text-[#7A857F] mt-0.5">Campus advocates with active codes</p>
                </div>
              </div>

              {/* Ambassador Leaderboard */}
              <div className="bg-white rounded-3xl border border-[#DDE3DF] p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-sm sm:text-base text-[#14201A]">Campus Ambassador Leaderboard</h3>
                  </div>
                  <span className="text-xs text-[#7A857F]">{referralsData.leaderboard.length} Ambassadors</span>
                </div>

                {referralsData.leaderboard.length === 0 ? (
                  <div className="p-8 text-center bg-[#F8FAF9] rounded-2xl border border-dashed border-[#DDE3DF]">
                    <Gift className="w-8 h-8 text-[#7A857F] mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-bold text-[#14201A]">No referral milestones yet</p>
                    <p className="text-xs text-[#7A857F] mt-1">
                      As students and drivers share their unique Zylift invite links and complete rides, they will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {referralsData.leaderboard.map((ambassador, idx) => (
                      <div
                        key={ambassador.code}
                        className="p-3.5 bg-[#F8FAF9] rounded-2xl border border-[#DDE3DF] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                            idx === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            idx === 1 ? 'bg-slate-200 text-slate-800' :
                            idx === 2 ? 'bg-amber-50 text-amber-700' : 'bg-white text-slate-600 border border-[#DDE3DF]'
                          }`}>
                            #{idx + 1}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#14201A]">{ambassador.name}</p>
                            <span className="font-mono text-[10px] text-[#0E7C3A] font-semibold">{ambassador.code}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-[#0E7C3A]">{ambassador.completed}</span>
                          <span className="text-[10px] text-[#7A857F] block">/ {ambassador.total} invited</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Detailed Referral Log Table */}
              <div className="bg-white rounded-3xl border border-[#DDE3DF] overflow-hidden shadow-xs">
                <div className="p-4 sm:p-5 border-b border-[#DDE3DF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-[#14201A]">All Referral Records</h3>
                    <p className="text-xs text-[#7A857F]">Real-time log of campus invite trackings and first-ride completions</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#7A857F] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search code, name, phone..."
                        value={referralsSearchQuery}
                        onChange={(e) => setReferralsSearchQuery(e.target.value)}
                        className="pl-9 pr-3 py-1.5 bg-[#F8FAF9] border border-[#DDE3DF] rounded-xl text-xs font-medium w-full sm:w-64 focus:border-[#0E7C3A] outline-none"
                      />
                    </div>
                    {referralsData.referrals.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllReferrals}
                        disabled={isClearingAllReferrals}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Permanently clear all referral records"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isClearingAllReferrals ? 'Clearing...' : 'Clear All'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAF9] border-b border-[#DDE3DF] text-[10px] sm:text-xs font-bold uppercase text-[#7A857F]">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Ambassador</th>
                        <th className="py-3 px-4">Invited Friend</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Unlocked Perks</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDE3DF] text-xs">
                      {referralsData.referrals
                        .filter((r) => {
                          if (!referralsSearchQuery.trim()) return true;
                          const q = referralsSearchQuery.toLowerCase();
                          return (
                            r.referrerCode?.toLowerCase().includes(q) ||
                            r.referrerName?.toLowerCase().includes(q) ||
                            r.refereeName?.toLowerCase().includes(q) ||
                            r.refereePhone?.toLowerCase().includes(q)
                          );
                        })
                        .map((r) => (
                          <tr key={r.id} className="hover:bg-[#F8FAF9] transition-colors">
                            <td className="py-3 px-4 text-[#7A857F] font-mono text-[11px]">
                              {new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-bold text-[#14201A]">{r.referrerName || 'Ambassador'}</p>
                              <span className="font-mono text-[10px] text-[#0E7C3A]">{r.referrerCode}</span>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-[#14201A]">{r.refereeName || 'New User'}</p>
                              <span className="font-mono text-[10px] text-[#7A857F]">{r.refereePhone}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                r.refereeType === 'driver' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {r.refereeType || 'rider'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {r.status === 'completed' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#E6F4EC] text-[#0E7C3A]">
                                  <Check className="w-3 h-3" />
                                  1st Ride Done
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <Clock className="w-3 h-3" />
                                  Awaiting 1st Ride
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1">
                                {(r.rewardsUnlocked || ['Founding Badge']).map((reward: string, ridx: number) => (
                                  <span
                                    key={ridx}
                                    className="px-2 py-0.5 bg-emerald-50 text-[#0E7C3A] text-[10px] font-semibold rounded-md border border-emerald-200"
                                  >
                                    {reward}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                disabled={deletingReferralId === r.id}
                                onClick={() => handleDeleteReferral(r.id, r.refereeName || r.refereePhone)}
                                className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold"
                                title="Permanently delete referral"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      {referralsData.referrals.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-[#7A857F] text-xs">
                            No referral invitations tracked yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* A9. FARES GRID MATRIX & DYNAMIC VEHICLE RULES */}
          {/* ============================================================== */}
          {currentTab === 'fares' && (
            <div className="space-y-6 max-w-7xl">
              {/* Fares Sub-Tab Navigation */}
              <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80 w-fit">
                <button
                  type="button"
                  onClick={() => setFaresSubTab('matrix')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    faresSubTab === 'matrix'
                      ? 'bg-white text-[#0E7C3A] shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Tag className="w-4 h-4" />
                  <span>Campus Fixed Routes</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                    {fareRules.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFaresSubTab('vehicle_rules')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    faresSubTab === 'vehicle_rules'
                      ? 'bg-white text-[#0E7C3A] shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Distance & Vehicle Rules (Uber/Bolt)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-[#0E7C3A] font-black">
                    Live
                  </span>
                </button>
              </div>

              {faresSubTab === 'matrix' ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-[#14201A] tracking-tight">Campus Route Fare Matrix</h2>
                      <p className="text-xs sm:text-sm text-[#7A857F] mt-0.5">
                        Deterministic zone-based fixed pricing across FUTMINNA Gidan Kwano & Bosso
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      exportToCsv(
                        `FUTMINNA_Fare_Matrix_${new Date().toISOString().slice(0, 10)}.csv`,
                        ['From Zone', 'To Zone', 'Keke (NGN)', 'Okada (NGN)', 'Car Shuttle (NGN)', 'Small Bus (NGN)', 'Big Bus (NGN)'],
                        fareRules.map(r => [
                          r.fromZone,
                          r.toZone,
                          r.kekeFare,
                          r.okadaFare,
                          r.carFare,
                          r.smallBusFare !== undefined ? r.smallBusFare : Math.round((r.kekeFare || 200) * 0.75),
                          r.bigBusFare !== undefined ? r.bigBusFare : Math.round((r.kekeFare || 200) * 0.5)
                        ])
                      );
                    }}
                    className="px-3.5 py-2.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#14201A] rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#0E7C3A]" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </button>

                  {!isEditingWholeTable ? (
                    <>
                      <button
                        onClick={() => {
                          setEditingFareRule(null);
                          setIsNewRouteModal(true);
                          setFareEditFromZone('');
                          setFareEditToZone('');
                          setFareEditKeke('200');
                          setFareEditOkada('250');
                          setFareEditCar('500');
                          setFareEditSmallBus('150');
                          setFareEditBigBus('100');
                        }}
                        className="px-3.5 py-2.5 bg-[#0E7C3A] hover:bg-[#0c6b32] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Route</span>
                      </button>
                      <button
                        onClick={() => {
                          setTableDraftFares(fareRules.map(r => ({
                            fromZone: r.fromZone,
                            toZone: r.toZone,
                            kekeFare: r.kekeFare,
                            okadaFare: r.okadaFare,
                            carFare: r.carFare,
                            smallBusFare: r.smallBusFare !== undefined ? r.smallBusFare : Math.round((r.kekeFare || 200) * 0.75),
                            bigBusFare: r.bigBusFare !== undefined ? r.bigBusFare : Math.round((r.kekeFare || 200) * 0.5),
                          })));
                          setIsEditingWholeTable(true);
                        }}
                        className="px-3.5 py-2.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#14201A] rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4 text-[#0E7C3A]" />
                        <span>Edit Table</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setTableDraftFares(prev => [
                            ...prev,
                            {
                              fromZone: '',
                              toZone: '',
                              kekeFare: 200,
                              okadaFare: 250,
                              carFare: 500,
                              smallBusFare: 150,
                              bigBusFare: 100,
                            }
                          ]);
                        }}
                        className="px-3.5 py-2.5 bg-white border border-[#0E7C3A] text-[#0E7C3A] hover:bg-[#E6F4EC] rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Row</span>
                      </button>
                      <button
                        disabled={isSavingTable}
                        onClick={async () => {
                          const invalid = tableDraftFares.some(r => !String(r.fromZone).trim() || !String(r.toZone).trim());
                          if (invalid) {
                            alert('Please ensure all routes have both Origin and Destination campus zones entered.');
                            return;
                          }
                          setIsSavingTable(true);
                          try {
                            const res = await adminFetch('/api/admin/fares/batch', {
                              method: 'POST',
                              body: JSON.stringify({ rules: tableDraftFares }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              setFareRules(data.rules || tableDraftFares);
                              setIsEditingWholeTable(false);
                              playKerbSound('success');
                              refreshAllData();
                            } else {
                              alert(data.error || 'Failed to save route matrix');
                            }
                          } catch (e: any) {
                            alert(e.message || 'Error saving fare matrix');
                          } finally {
                            setIsSavingTable(false);
                          }
                        }}
                        className="px-4 py-2.5 bg-[#0E7C3A] hover:bg-[#0c6b32] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSavingTable ? 'Saving...' : 'Save Entire Matrix'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingWholeTable(false);
                          setTableDraftFares([]);
                        }}
                        className="px-3 py-2.5 bg-white border border-[#DDE3DF] hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Undo2 className="w-4 h-4 text-slate-500" />
                        <span>Cancel</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={refreshAllData}
                    className="p-2.5 bg-white border border-[#DDE3DF] text-[#7A857F] hover:text-[#0E7C3A] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                    title="Refresh data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bento KPI Summary Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Configured Routes</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-[#14201A]">
                      {isEditingWholeTable ? tableDraftFares.length : fareRules.length}
                    </span>
                    <span className="text-[10px] font-bold text-[#0E7C3A] bg-[#E6F4EC] px-1.5 py-0.5 rounded-md">Fixed Matrix</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">Campus routes configured</p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Vehicles Supported</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-[#0E7C3A]">5 Types</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">Keke, Okada, Car, Small & Big Bus</p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Surge Multiplier</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-[#14201A]">1.0x (Disabled)</span>
                    <span className="text-[10px] font-bold text-[#0E7C3A] bg-[#E6F4EC] px-1.5 py-0.5 rounded-md">Zero Surge</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">No dynamic peak pricing</p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Pricing Authority</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm font-bold text-[#14201A]">FUTMINNA SUG & Park Union</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">Jointly ratified fares</p>
                </div>
              </div>

              {isEditingWholeTable && (
                <div className="p-3.5 bg-[#E6F4EC] border border-[#0E7C3A]/30 rounded-2xl flex items-center justify-between text-xs text-[#0E7C3A]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0 text-[#0E7C3A]" />
                    <span className="font-bold">
                      Full Table Edit Mode Active: Edit Origin and Destination zones and fares directly in the table. Click "+ Add Row" to insert new routes, then "Save Entire Matrix".
                    </span>
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider bg-white px-2 py-0.5 rounded-md border border-[#0E7C3A]/20">
                    {tableDraftFares.length} Routes
                  </span>
                </div>
              )}
              {/* Fares Matrix Table */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#DDE3DF] overflow-hidden shadow-xs">
                {/* Desktop Fares Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#DDE3DF] bg-[#F8FAF9] text-[#7A857F] uppercase text-[10px] tracking-wider font-bold">
                        <th className="py-3 px-4 min-w-[170px]">Origin Campus Zone</th>
                        <th className="py-3 px-4 min-w-[170px]">Destination Campus Zone</th>
                        <th className="py-3 px-3">Keke Napep</th>
                        <th className="py-3 px-3">Okada Bike</th>
                        <th className="py-3 px-3">Car Shuttle</th>
                        <th className="py-3 px-3">Small Bus</th>
                        <th className="py-3 px-3">Big Bus</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F3F1]">
                      {isEditingWholeTable ? (
                        tableDraftFares.map((rule, idx) => (
                          <tr key={idx} className="hover:bg-[#F9FBFA] transition-colors">
                            <td className="py-2.5 px-4 font-bold text-[#14201A]">
                              <input
                                type="text"
                                list="admin-campus-locations"
                                value={rule.fromZone}
                                onChange={(e) => {
                                  const copy = [...tableDraftFares];
                                  copy[idx] = { ...copy[idx], fromZone: e.target.value };
                                  setTableDraftFares(copy);
                                }}
                                placeholder="Origin Zone"
                                className="w-full p-2 bg-[#F8FAF9] border border-[#DDE3DF] focus:bg-white focus:border-[#0E7C3A] rounded-xl text-xs font-bold text-[#14201A] outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-4 font-bold text-[#14201A]">
                              <input
                                type="text"
                                list="admin-campus-locations"
                                value={rule.toZone}
                                onChange={(e) => {
                                  const copy = [...tableDraftFares];
                                  copy[idx] = { ...copy[idx], toZone: e.target.value };
                                  setTableDraftFares(copy);
                                }}
                                placeholder="Destination Zone"
                                className="w-full p-2 bg-[#F8FAF9] border border-[#DDE3DF] focus:bg-white focus:border-[#0E7C3A] rounded-xl text-xs font-bold text-[#14201A] outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                value={rule.kekeFare ?? 0}
                                onChange={(e) => {
                                  const copy = [...tableDraftFares];
                                  copy[idx] = { ...copy[idx], kekeFare: Number(e.target.value) };
                                  setTableDraftFares(copy);
                                }}
                                className="w-20 p-2 bg-[#F8FAF9] border border-[#DDE3DF] focus:bg-white focus:border-[#0E7C3A] rounded-xl text-xs font-black text-[#0E7C3A] text-right outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                value={rule.okadaFare ?? 0}
                                onChange={(e) => {
                                  const copy = [...tableDraftFares];
                                  copy[idx] = { ...copy[idx], okadaFare: Number(e.target.value) };
                                  setTableDraftFares(copy);
                                }}
                                className="w-20 p-2 bg-[#F8FAF9] border border-[#DDE3DF] focus:bg-white focus:border-[#0E7C3A] rounded-xl text-xs font-black text-[#0E7C3A] text-right outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                value={rule.carFare ?? 0}
                                onChange={(e) => {
                                  const copy = [...tableDraftFares];
                                  copy[idx] = { ...copy[idx], carFare: Number(e.target.value) };
                                  setTableDraftFares(copy);
                                }}
                                className="w-20 p-2 bg-[#F8FAF9] border border-[#DDE3DF] focus:bg-white focus:border-[#0E7C3A] rounded-xl text-xs font-black text-[#0E7C3A] text-right outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                value={rule.smallBusFare ?? 0}
                                onChange={(e) => {
                                  const copy = [...tableDraftFares];
                                  copy[idx] = { ...copy[idx], smallBusFare: Number(e.target.value) };
                                  setTableDraftFares(copy);
                                }}
                                className="w-20 p-2 bg-[#F8FAF9] border border-[#DDE3DF] focus:bg-white focus:border-[#0E7C3A] rounded-xl text-xs font-black text-[#0E7C3A] text-right outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                value={rule.bigBusFare ?? 0}
                                onChange={(e) => {
                                  const copy = [...tableDraftFares];
                                  copy[idx] = { ...copy[idx], bigBusFare: Number(e.target.value) };
                                  setTableDraftFares(copy);
                                }}
                                className="w-20 p-2 bg-[#F8FAF9] border border-[#DDE3DF] focus:bg-white focus:border-[#0E7C3A] rounded-xl text-xs font-black text-[#0E7C3A] text-right outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                onClick={() => setTableDraftFares(prev => prev.filter((_, i) => i !== idx))}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                title="Remove this route"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        fareRules.map((rule, idx) => (
                          <tr key={idx} className="hover:bg-[#F9FBFA] transition-colors">
                            <td className="py-3.5 px-4 font-bold text-[#14201A]">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#0E7C3A] shrink-0" />
                                <span>{rule.fromZone}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-[#14201A]">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0" />
                                <span>{rule.toZone}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 font-black text-[#0E7C3A] text-sm">
                              ₦{rule.kekeFare}
                            </td>
                            <td className="py-3.5 px-3 font-black text-[#0E7C3A] text-sm">
                              ₦{rule.okadaFare}
                            </td>
                            <td className="py-3.5 px-3 font-black text-[#0E7C3A] text-sm">
                              ₦{rule.carFare}
                            </td>
                            <td className="py-3.5 px-3 font-black text-[#0E7C3A] text-sm">
                              ₦{rule.smallBusFare !== undefined ? rule.smallBusFare : Math.round((rule.kekeFare || 200) * 0.75)}
                            </td>
                            <td className="py-3.5 px-3 font-black text-[#0E7C3A] text-sm">
                              ₦{rule.bigBusFare !== undefined ? rule.bigBusFare : Math.round((rule.kekeFare || 200) * 0.5)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingFareRule(rule);
                                    setIsNewRouteModal(false);
                                    setFareEditFromZone(rule.fromZone);
                                    setFareEditToZone(rule.toZone);
                                    setFareEditKeke(String(rule.kekeFare));
                                    setFareEditOkada(String(rule.okadaFare));
                                    setFareEditCar(String(rule.carFare));
                                    setFareEditSmallBus(String(rule.smallBusFare !== undefined ? rule.smallBusFare : Math.round((rule.kekeFare || 200) * 0.75)));
                                    setFareEditBigBus(String(rule.bigBusFare !== undefined ? rule.bigBusFare : Math.round((rule.kekeFare || 200) * 0.5)));
                                  }}
                                  className="px-2.5 py-1.5 bg-[#F4F6F5] hover:bg-[#EAEFEA] text-[#0E7C3A] font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Are you sure you want to remove route: "${rule.fromZone} ↔ ${rule.toZone}"?`)) return;
                                    try {
                                      const res = await adminFetch('/api/admin/fares', {
                                        method: 'DELETE',
                                        body: JSON.stringify({ fromZone: rule.fromZone, toZone: rule.toZone }),
                                      });
                                      const data = await res.json();
                                      if (data.success) {
                                        setFareRules(prev => prev.filter(r => !(
                                          (r.fromZone.toLowerCase() === rule.fromZone.toLowerCase() && r.toZone.toLowerCase() === rule.toZone.toLowerCase()) ||
                                          (r.fromZone.toLowerCase() === rule.toZone.toLowerCase() && r.toZone.toLowerCase() === rule.fromZone.toLowerCase())
                                        )));
                                        playKerbSound('success');
                                      } else {
                                        alert(data.error || 'Failed to delete route');
                                      }
                                    } catch (e: any) {
                                      alert(e.message || 'Error deleting route');
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                  title="Delete route"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                      {(!isEditingWholeTable ? fareRules.length === 0 : tableDraftFares.length === 0) && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-[#7A857F]">
                            <Tag className="w-8 h-8 text-[#DDE3DF] mx-auto mb-2" />
                            <p className="font-bold text-sm text-[#14201A]">No campus routes configured.</p>
                            <p className="text-xs text-[#7A857F] mt-1">Click "Add Route" or "Edit Table" to add routes.</p>
                          </td>
                        </tr>
                      )}                    </tbody>
                  </table>
                </div>

                {/* Mobile Responsive Fares Cards */}
                <div className="md:hidden space-y-3 p-3">
                  {isEditingWholeTable ? (
                    tableDraftFares.map((rule, idx) => (
                      <div key={idx} className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-slate-400">Route #{idx + 1}</span>
                          <button
                            onClick={() => setTableDraftFares(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={rule.fromZone}
                            onChange={(e) => {
                              const copy = [...tableDraftFares];
                              copy[idx] = { ...copy[idx], fromZone: e.target.value };
                              setTableDraftFares(copy);
                            }}
                            placeholder="Origin Zone (e.g. Main Gate)"
                            className="w-full p-2.5 bg-[#F8FAF9] border border-[#DDE3DF] focus:bg-white focus:border-[#0E7C3A] rounded-xl text-xs font-bold text-[#14201A] outline-none"
                          />
                          <input
                            type="text"
                            value={rule.toZone}
                            onChange={(e) => {
                              const copy = [...tableDraftFares];
                              copy[idx] = { ...copy[idx], toZone: e.target.value };
                              setTableDraftFares(copy);
                            }}
                            placeholder="Destination Zone (e.g. Hostels)"
                            className="w-full p-2.5 bg-[#F8FAF9] border border-[#DDE3DF] focus:bg-white focus:border-[#0E7C3A] rounded-xl text-xs font-bold text-[#14201A] outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase font-bold block mb-0.5">Keke (₦)</span>
                            <input
                              type="number"
                              value={rule.kekeFare ?? 0}
                              onChange={(e) => {
                                const copy = [...tableDraftFares];
                                copy[idx] = { ...copy[idx], kekeFare: Number(e.target.value) };
                                setTableDraftFares(copy);
                              }}
                              className="w-full p-2 bg-[#F8FAF9] border border-[#DDE3DF] rounded-xl text-xs font-black text-[#0E7C3A] outline-none text-center"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase font-bold block mb-0.5">Okada (₦)</span>
                            <input
                              type="number"
                              value={rule.okadaFare ?? 0}
                              onChange={(e) => {
                                const copy = [...tableDraftFares];
                                copy[idx] = { ...copy[idx], okadaFare: Number(e.target.value) };
                                setTableDraftFares(copy);
                              }}
                              className="w-full p-2 bg-[#F8FAF9] border border-[#DDE3DF] rounded-xl text-xs font-black text-[#0E7C3A] outline-none text-center"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase font-bold block mb-0.5">Car (₦)</span>
                            <input
                              type="number"
                              value={rule.carFare ?? 0}
                              onChange={(e) => {
                                const copy = [...tableDraftFares];
                                copy[idx] = { ...copy[idx], carFare: Number(e.target.value) };
                                setTableDraftFares(copy);
                              }}
                              className="w-full p-2 bg-[#F8FAF9] border border-[#DDE3DF] rounded-xl text-xs font-black text-[#0E7C3A] outline-none text-center"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase font-bold block mb-0.5">Small Bus (₦)</span>
                            <input
                              type="number"
                              value={rule.smallBusFare ?? 0}
                              onChange={(e) => {
                                const copy = [...tableDraftFares];
                                copy[idx] = { ...copy[idx], smallBusFare: Number(e.target.value) };
                                setTableDraftFares(copy);
                              }}
                              className="w-full p-2 bg-[#F8FAF9] border border-[#DDE3DF] rounded-xl text-xs font-black text-[#0E7C3A] outline-none text-center"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase font-bold block mb-0.5">Big Bus (₦)</span>
                            <input
                              type="number"
                              value={rule.bigBusFare ?? 0}
                              onChange={(e) => {
                                const copy = [...tableDraftFares];
                                copy[idx] = { ...copy[idx], bigBusFare: Number(e.target.value) };
                                setTableDraftFares(copy);
                              }}
                              className="w-full p-2 bg-[#F8FAF9] border border-[#DDE3DF] rounded-xl text-xs font-black text-[#0E7C3A] outline-none text-center"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    fareRules.map((rule, idx) => (
                      <div key={idx} className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
                        <div className="bg-[#F8FAF9] p-2.5 rounded-xl border border-[#DDE3DF]/60 space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full bg-[#0E7C3A] shrink-0" />
                            <span className="font-bold text-[#14201A] truncate">{rule.fromZone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0" />
                            <span className="font-bold text-[#14201A] truncate">{rule.toZone}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-5 gap-1.5 text-center">
                          <div className="p-2 bg-[#F4F6F5] rounded-xl">
                            <span className="text-[9px] text-slate-500 uppercase font-bold block">Keke</span>
                            <span className="font-black text-[#0E7C3A] text-xs">₦{rule.kekeFare}</span>
                          </div>
                          <div className="p-2 bg-[#F4F6F5] rounded-xl">
                            <span className="text-[9px] text-slate-500 uppercase font-bold block">Okada</span>
                            <span className="font-black text-[#0E7C3A] text-xs">₦{rule.okadaFare}</span>
                          </div>
                          <div className="p-2 bg-[#F4F6F5] rounded-xl">
                            <span className="text-[9px] text-slate-500 uppercase font-bold block">Car</span>
                            <span className="font-black text-[#0E7C3A] text-xs">₦{rule.carFare}</span>
                          </div>
                          <div className="p-2 bg-[#F4F6F5] rounded-xl">
                            <span className="text-[9px] text-slate-500 uppercase font-bold block">S-Bus</span>
                            <span className="font-black text-[#0E7C3A] text-xs">
                              ₦{rule.smallBusFare !== undefined ? rule.smallBusFare : Math.round((rule.kekeFare || 200) * 0.75)}
                            </span>
                          </div>
                          <div className="p-2 bg-[#F4F6F5] rounded-xl">
                            <span className="text-[9px] text-slate-500 uppercase font-bold block">B-Bus</span>
                            <span className="font-black text-[#0E7C3A] text-xs">
                              ₦{rule.bigBusFare !== undefined ? rule.bigBusFare : Math.round((rule.kekeFare || 200) * 0.5)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => {
                              setEditingFareRule(rule);
                              setIsNewRouteModal(false);
                              setFareEditFromZone(rule.fromZone);
                              setFareEditToZone(rule.toZone);
                              setFareEditKeke(String(rule.kekeFare));
                              setFareEditOkada(String(rule.okadaFare));
                              setFareEditCar(String(rule.carFare));
                              setFareEditSmallBus(String(rule.smallBusFare !== undefined ? rule.smallBusFare : Math.round((rule.kekeFare || 200) * 0.75)));
                              setFareEditBigBus(String(rule.bigBusFare !== undefined ? rule.bigBusFare : Math.round((rule.kekeFare || 200) * 0.5)));
                            }}
                            className="flex-1 py-2 bg-[#F4F6F5] hover:bg-[#EAEFEA] text-[#0E7C3A] font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Rates</span>
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Are you sure you want to remove route: "${rule.fromZone} ↔ ${rule.toZone}"?`)) return;
                              try {
                                const res = await adminFetch('/api/admin/fares', {
                                  method: 'DELETE',
                                  body: JSON.stringify({ fromZone: rule.fromZone, toZone: rule.toZone }),
                                });
                                const data = await res.json();
                                if (data.success) {
                                  setFareRules(prev => prev.filter(r => !(
                                    (r.fromZone.toLowerCase() === rule.fromZone.toLowerCase() && r.toZone.toLowerCase() === rule.toZone.toLowerCase()) ||
                                    (r.fromZone.toLowerCase() === rule.toZone.toLowerCase() && r.toZone.toLowerCase() === rule.fromZone.toLowerCase())
                                  )));
                                  playKerbSound('success');
                                } else {
                                  alert(data.error || 'Failed to delete route');
                                }
                              } catch (e: any) {
                                alert(e.message || 'Error deleting route');
                              }
                            }}
                            className="p-2 bg-[#F4F6F5] hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                            title="Delete route"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}                  {(!isEditingWholeTable ? fareRules.length === 0 : tableDraftFares.length === 0) && (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No route fare rules configured.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              {/* Header & Save Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-[#14201A] tracking-tight">
                      Distance & Capacity Vehicle Rules
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-[#E6F4EC] text-[#0E7C3A] border border-[#0E7C3A]/20">
                      Uber/Bolt Formula
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#7A857F] mt-1">
                    Configure base fares, per-km/per-min rates, distance cutoffs, and passenger group sizes for non-campus routes.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {hasUnsavedVehicleRules && (
                    <>
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                        Unsaved edits
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          vehicleRulesDirtyRef.current = false;
                          setHasUnsavedVehicleRules(false);
                          try {
                            const r = await adminFetch('/api/admin/fare-rules/vehicles').then((res) => res.json());
                            if (r?.success && r.rules) setVehicleRules(r.rules);
                          } catch {}
                        }}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Reset
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={isSavingVehicleRules}
                    onClick={handleSaveVehicleRules}
                    className="px-5 py-2.5 bg-[#0E7C3A] hover:bg-[#0c6b32] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingVehicleRules ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Vehicle Rules</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {vehicleRulesSavedNotice && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span>{vehicleRulesSavedNotice}</span>
                </div>
              )}

              {/* Formula & Rule Guide Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50/60 to-slate-50 border border-emerald-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0E7C3A] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[#14201A] uppercase tracking-wider">
                      Pricing Formula Engine
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      <code className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px] text-[#0E7C3A] font-bold">
                        fare = max(minimumFare, baseFare + (perKm × km) + (perMinute × minutes))
                      </code>{' '}
                      rounded to the nearest ₦50.
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      • <strong>Distance Cutoff (maxKm):</strong> Trips exceeding this distance will not offer this vehicle (e.g. 15 km for Okada, 25 km for Keke). Cars have no cutoff.
                      <br />
                      • <strong>Passenger Group Size (minPassengersToOffer):</strong> Small Bus only unlocks at 8+ passengers; Big Bus only unlocks at 19+ passengers.
                    </p>
                  </div>
                </div>
              </div>

              {/* Vehicle Rules Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  { key: 'okada', label: 'Okada (Motorcycle)', icon: 'okada', desc: 'Short single/dual passenger trips & quick hops' },
                  { key: 'keke', label: 'Keke (Tricycle)', icon: 'keke', desc: 'Local student commute & cross-campus town shuttle' },
                  { key: 'cab_go', label: 'Car (Cab Go)', icon: 'car', desc: 'Private sedans for long distance, intercity & luggage' },
                  { key: 'small_bus', label: 'Small Bus (18-Seater)', icon: 'small_bus', desc: 'Medium groups, church/mosque trips & class outings' },
                  { key: 'big_bus', label: 'Big Bus (Coaster/45+)', icon: 'big_bus', desc: 'Large student excursions, rallies & departmental trips' },
                ].map((v) => {
                  const rule = vehicleRules[v.key] || {};
                  const toNum = (val: any, fallback: number) =>
                    val === '' || val === null || val === undefined || !Number.isFinite(Number(val)) ? fallback : Number(val);
                  const baseFare = toNum(rule.baseFare, 0);
                  const perKm = toNum(rule.perKm, 0);
                  const perMinute = toNum(rule.perMinute, 0);
                  const minFare = toNum(rule.minimumFare, 0);
                  const maxKm = rule.maxKm !== null && rule.maxKm !== undefined && rule.maxKm !== '' ? Number(rule.maxKm) : null;
                  const minPassengers = Math.max(1, toNum(rule.minPassengersToOffer, 1));
                  const minSeats = Math.max(1, toNum(rule.minSeats, 1));
                  const maxSeats = Math.max(1, toNum(rule.maxSeats, 4));

                  // Preview simulation for 5km (10 min) and 20km (30 min)
                  const sim5km = Math.round(Math.max(minFare, baseFare + (perKm * 5) + (perMinute * 10)) / 50) * 50;
                  const sim20km = Math.round(Math.max(minFare, baseFare + (perKm * 20) + (perMinute * 30)) / 50) * 50;

                  const updateField = (field: string, val: any) => {
                    vehicleRulesDirtyRef.current = true;
                    setHasUnsavedVehicleRules(true);
                    setVehicleRules((prev) => ({
                      ...prev,
                      [v.key]: {
                        ...(prev[v.key] || {}),
                        [field]: val,
                      },
                    }));
                  };

                  const numInputVal = (val: any) => (val === null || val === undefined ? '' : val);
                  const parseRawNum = (raw: string, minVal = 0) => {
                    if (raw.trim() === '') return '';
                    const n = Number(raw);
                    return Number.isFinite(n) ? Math.max(minVal, n) : '';
                  };

                  return (
                    <div
                      key={v.key}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-[#0E7C3A]/50 transition-all p-5 flex flex-col justify-between"
                    >
                      <div>
                        {/* Card Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-[#0E7C3A]">
                              {v.icon === 'okada' ? (
                                <span className="text-xl">🏍️</span>
                              ) : v.icon === 'keke' ? (
                                <span className="text-xl">🛺</span>
                              ) : v.icon === 'car' ? (
                                <Car className="w-5 h-5 text-[#0E7C3A]" />
                              ) : (
                                <Bus className="w-5 h-5 text-[#0E7C3A]" />
                              )}
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-[#14201A]">{rule.label || v.label}</h3>
                              <p className="text-[11px] text-slate-500">{v.desc}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                            {v.key}
                          </span>
                        </div>

                        {/* Inputs Grid */}
                        <div className="mt-4 space-y-3.5">
                          {/* Max Distance Cutoff */}
                          <div>
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-slate-700">
                                Max Distance Limit (km)
                              </label>
                              <span className="text-[10px] text-slate-400">
                                {maxKm === null || maxKm === 0 ? 'No limit' : `${maxKm} km max`}
                              </span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              placeholder="Leave blank or 0 for unlimited"
                              value={numInputVal(rule.maxKm)}
                              onChange={(e) => {
                                const val = e.target.value.trim();
                                updateField('maxKm', val === '' ? '' : Math.max(0, Number(val)));
                              }}
                              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
                            />
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              e.g. 15 km for Okada, 25 km for Keke. Empty for no limit.
                            </p>
                          </div>

                          {/* Min Passengers to Offer */}
                          <div>
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-slate-700">
                                Min Passengers to Unlock
                              </label>
                              <span className="text-[10px] text-[#0E7C3A] font-bold">
                                {minPassengers} pax min
                              </span>
                            </div>
                            <input
                              type="number"
                              min={1}
                              max={80}
                              value={numInputVal(rule.minPassengersToOffer)}
                              onChange={(e) => updateField('minPassengersToOffer', parseRawNum(e.target.value, 1))}
                              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
                            />
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              1 for Okada/Keke/Car; 8 for Small Bus; 19 for Big Bus.
                            </p>
                          </div>

                          {/* Seat Capacity Range */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[11px] font-bold text-slate-700">Min Seats</label>
                              <input
                                type="number"
                                min={1}
                                value={numInputVal(rule.minSeats)}
                                onChange={(e) => updateField('minSeats', parseRawNum(e.target.value, 1))}
                                className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-slate-700">Max Seats</label>
                              <input
                                type="number"
                                min={1}
                                value={numInputVal(rule.maxSeats)}
                                onChange={(e) => updateField('maxSeats', parseRawNum(e.target.value, 1))}
                                className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
                              />
                            </div>
                          </div>

                          {/* Pricing Formula Values */}
                          <div className="pt-2 border-t border-slate-100 space-y-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Formula Rates
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[11px] font-bold text-slate-700">Base Fare (₦)</label>
                                <input
                                  type="number"
                                  min={0}
                                  step={50}
                                  value={numInputVal(rule.baseFare)}
                                  onChange={(e) => updateField('baseFare', parseRawNum(e.target.value, 0))}
                                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-bold text-slate-700">Minimum Fare (₦)</label>
                                <input
                                  type="number"
                                  min={0}
                                  step={50}
                                  value={numInputVal(rule.minimumFare)}
                                  onChange={(e) => updateField('minimumFare', parseRawNum(e.target.value, 0))}
                                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-bold text-slate-700">Per Km (₦/km)</label>
                                <input
                                  type="number"
                                  min={0}
                                  step={5}
                                  value={numInputVal(rule.perKm)}
                                  onChange={(e) => updateField('perKm', parseRawNum(e.target.value, 0))}
                                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-bold text-slate-700">Per Minute (₦/min)</label>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={numInputVal(rule.perMinute)}
                                  onChange={(e) => updateField('perMinute', parseRawNum(e.target.value, 0))}
                                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Live Price Estimation Preview */}
                      <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50/80 -mx-5 -mb-5 p-4 rounded-b-2xl">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          Sample Price Calculations:
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                          <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold">
                            5 km (10m): <strong className="text-[#0E7C3A]">₦{sim5km.toLocaleString()}</strong>
                          </span>
                          <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold">
                            20 km (30m):{' '}
                            {maxKm && 20 > maxKm ? (
                              <strong className="text-amber-600">Blocked (&gt;{maxKm}km)</strong>
                            ) : (
                              <strong className="text-[#0E7C3A]">₦{sim20km.toLocaleString()}</strong>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Save Bar */}
              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  disabled={isSavingVehicleRules}
                  onClick={handleSaveVehicleRules}
                  className="px-6 py-3 bg-[#0E7C3A] hover:bg-[#0c6b32] text-white rounded-xl text-sm font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingVehicleRules ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save All Vehicle Rules</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
          {/* ============================================================== */}
          {/* A10. CASH COLLECTION & 0% REMITTANCE LEDGER */}
          {/* ============================================================== */}
          {currentTab === 'cash' && (
            <div className="space-y-6 max-w-7xl">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#14201A] tracking-tight">Cash & 0% Remittance Ledger</h2>
                  <p className="text-xs sm:text-sm text-[#7A857F] mt-0.5">
                    Direct driver fare retention & zero-commission campus transit policy
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      exportToCsv(
                        `FUTMINNA_Cash_Ledger_${new Date().toISOString().slice(0, 10)}.csv`,
                        ['Driver ID', 'Driver Name', 'Plate', 'Category', 'Completed Trips', 'Total Cash Collected (NGN)', 'Commission Due (NGN)', 'Remittance Status'],
                        (cashLedgerData?.ledger || []).map((l: any) => [
                          l.driverId,
                          l.driverName,
                          l.vehiclePlate,
                          l.vehicleCategory,
                          l.totalCompletedTrips,
                          l.totalCashCollected,
                          l.pilotCommissionDue || 0,
                          l.remittanceStatus || 'CLEARED_0_PCT'
                        ])
                      );
                    }}
                    className="px-3.5 py-2.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#14201A] rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#0E7C3A]" />
                    <span>Export Ledger CSV</span>
                  </button>
                  <button
                    onClick={refreshAllData}
                    className="p-2.5 bg-white border border-[#DDE3DF] text-[#7A857F] hover:text-[#0E7C3A] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                    title="Refresh data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Zero-Commission Campus Policy Banner */}
              <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#0C1611] to-[#14281E] text-white border border-[#0E7C3A]/30 shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-full bg-[#0E7C3A]/10 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-[#0E7C3A] flex items-center justify-center shrink-0 shadow-lg shadow-[#0E7C3A]/30">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm sm:text-base text-white">0% Platform Commission Policy Strictly Enforced</h3>
                        <span className="px-2 py-0.5 bg-[#0E7C3A]/30 text-[#22C55E] text-[10px] font-black uppercase rounded-full border border-[#22C55E]/30">
                          Active Policy
                        </span>
                      </div>
                      <p className="text-xs text-white/70 mt-1 max-w-2xl leading-relaxed">
                        Under the FUTMINNA Campus Ride Pilot agreement with campus transport unions, <strong>100% of all fares collected belong directly to drivers</strong>. Zylift takes ₦0 platform fee or commission cut.
                      </p>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/10 shrink-0 text-center">
                    <span className="text-[10px] uppercase font-bold text-white/60 block">Platform Commission</span>
                    <span className="text-lg font-black text-[#22C55E]">₦0.00 / 0%</span>
                  </div>
                </div>
              </div>

              {/* Bento KPI Summary Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Total Cash Collected</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-[#14201A]">
                      ₦{(cashLedgerData?.totalCashCollected || 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">100% paid by passengers</p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Driver Fare Retention</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-[#0E7C3A]">100%</span>
                    <span className="text-[10px] font-bold text-[#0E7C3A] bg-[#E6F4EC] px-1.5 py-0.5 rounded-md">Retained</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">Direct to driver earnings</p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Commission Remittance Due</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-[#14201A]">₦0.00</span>
                    <span className="text-[10px] font-bold text-[#0E7C3A] bg-[#E6F4EC] px-1.5 py-0.5 rounded-md">0% Cut</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">Pilot commission fee waived</p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Drivers in Ledger</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-[#14201A]">
                      {cashLedgerData?.ledger?.length || 0}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">Active verified accounts</p>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#DDE3DF] p-3 sm:p-4 shadow-xs flex items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[#7A857F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={cashSearchQuery}
                    onChange={(e) => setCashSearchQuery(e.target.value)}
                    placeholder="Search by driver name or vehicle plate..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F4F6F5] rounded-xl text-xs font-semibold text-[#14201A] placeholder-[#7A857F] outline-none focus:bg-white focus:ring-2 focus:ring-[#0E7C3A]/30 border border-transparent focus:border-[#0E7C3A] transition-all"
                  />
                  {cashSearchQuery && (
                    <button
                      onClick={() => setCashSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7A857F] hover:text-[#14201A]"
                    >
                      Clear
                    </button>
                  )}                </div>
              </div>

              {/* Driver Remittance Ledger Table */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#DDE3DF] overflow-hidden shadow-xs">
                {/* Desktop Cash Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#DDE3DF] bg-[#F8FAF9] text-[#7A857F] uppercase text-[10px] tracking-wider font-bold">
                        <th className="py-3 px-4">Driver & Category</th>
                        <th className="py-3 px-4">Vehicle Plate</th>
                        <th className="py-3 px-4">Completed Rides</th>
                        <th className="py-3 px-4">Total Cash Collected</th>
                        <th className="py-3 px-4">Commission Due</th>
                        <th className="py-3 px-4">Remittance Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F3F1]">
                      {(cashLedgerData?.ledger || [])
                        .filter((item: any) => {
                          if (!cashSearchQuery.trim()) return true;
                          const q = cashSearchQuery.toLowerCase();
                          return (item.driverName || '').toLowerCase().includes(q) ||
                                 (item.vehiclePlate || '').toLowerCase().includes(q);
                        })
                        .map((item: any) => (
                          <tr key={item.driverId} className="hover:bg-[#F9FBFA] transition-colors">
                            <td className="py-3.5 px-4 font-bold text-[#14201A]">
                              <div>{item.driverName}</div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A857F]">
                                {item.vehicleCategory}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <KerbPlateBadge plate={item.vehiclePlate} />
                            </td>
                            <td className="py-3.5 px-4 font-bold text-[#14201A]">
                              {item.totalCompletedTrips} rides
                            </td>
                            <td className="py-3.5 px-4 font-black text-[#0E7C3A] text-sm">
                              ₦{(item.totalCashCollected || 0).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 font-black text-[#7A857F] text-xs">
                              ₦0.00 (0%)
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F4EC] text-[#0E7C3A] border border-[#0E7C3A]/20">
                                <CheckCircle2 className="w-3 h-3" />
                                100% Cleared
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => {
                                  setReconcilingDriver({
                                    driverId: item.driverId,
                                    driverName: item.driverName,
                                    amount: item.totalCashCollected,
                                    plate: item.vehiclePlate,
                                  });
                                  setReconcileNotesInput('');
                                }}
                                className="px-3 py-1.5 bg-[#F4F6F5] hover:bg-[#EAEFEA] text-[#14201A] font-bold rounded-xl text-xs transition-colors cursor-pointer"
                              >
                                Reconcile Audit
                              </button>
                            </td>
                          </tr>
                        ))}
                      {(!cashLedgerData?.ledger || cashLedgerData.ledger.length === 0) && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-[#7A857F]">
                            <Banknote className="w-8 h-8 text-[#DDE3DF] mx-auto mb-2" />
                            <p className="font-bold text-sm text-[#14201A]">No Cash Remittance Records</p>
                            <p className="text-xs text-[#7A857F] mt-0.5">Completed rides will show accumulated cash revenue here.</p>
                          </td>
                        </tr>
                      )}                    </tbody>
                  </table>
                </div>

                {/* Mobile Responsive Cash Remittance Cards */}
                <div className="md:hidden space-y-3 p-3">
                  {(cashLedgerData?.ledger || [])
                    .filter((item: any) => {
                      if (!cashSearchQuery.trim()) return true;
                      const q = cashSearchQuery.toLowerCase();
                      return (item.driverName || '').toLowerCase().includes(q) ||
                             (item.vehiclePlate || '').toLowerCase().includes(q);
                    })
                    .map((item: any) => (
                      <div key={item.driverId} className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-xs text-[#14201A]">{item.driverName}</p>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A857F]">
                              {item.vehicleCategory}
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F4EC] text-[#0E7C3A] border border-[#0E7C3A]/20">
                            <CheckCircle2 className="w-3 h-3" />
                            100% Cleared
                          </span>
                        </div>

                        <div className="flex items-center justify-between bg-[#F8FAF9] p-2.5 rounded-xl border border-[#DDE3DF]/60 text-xs">
                          <div>
                            <KerbPlateBadge plate={item.vehiclePlate} />
                            <span className="text-[11px] text-slate-500 mt-1 block">{item.totalCompletedTrips} completed rides</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Cash Retained</span>
                            <span className="font-black text-[#0E7C3A] text-sm">₦{(item.totalCashCollected || 0).toLocaleString()}</span>
                            <span className="text-[10px] text-slate-400 block">Commission: ₦0 (0%)</span>
                          </div>
                        </div>

                        <div className="pt-1">
                          <button
                            onClick={() => {
                              setReconcilingDriver({
                                driverId: item.driverId,
                                driverName: item.driverName,
                                amount: item.totalCashCollected,
                                plate: item.vehiclePlate,
                              });
                              setReconcileNotesInput('');
                            }}
                            className="w-full py-2 bg-[#F4F6F5] hover:bg-[#EAEFEA] text-[#14201A] font-bold rounded-xl text-xs transition-colors cursor-pointer"
                          >
                            Reconcile Cash Audit &rarr;
                          </button>
                        </div>
                      </div>
                    ))}
                  {(!cashLedgerData?.ledger || cashLedgerData.ledger.length === 0) && (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No cash remittance records logged.
                    </div>
                  )}                </div>
              </div>
            </div>
          )}


          {/* ============================================================== */}
          {/* A12. SUPPORT TICKETS */}
          {/* ============================================================== */}
          {currentTab === 'support' && (
            <div className="space-y-4 max-w-6xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#14201A]">Helpdesk Support Inbox</h2>
                  <p className="text-xs text-[#7A857F]">Review rider queries, respond to lost items, and manage support tickets</p>
                </div>
                {supportTickets.length > 0 && (
                  <button
                    onClick={handleClearAllSupportTickets}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all self-start sm:self-auto"
                    title="Delete all support tickets"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All Tickets</span>
                  </button>
                )}              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tickets list */}
                <div className={`bg-white rounded-3xl border border-[#DDE3DF] p-4 space-y-2 max-h-[500px] overflow-y-auto ${
                  selectedTicket ? 'hidden md:block' : 'block'
                }`}>
                  {supportTickets.length === 0 ? (
                    <p className="text-xs text-[#7A857F] p-4 text-center">No open support tickets.</p>
                  ) : (
                    supportTickets.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTicket(t)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all relative group ${
                          selectedTicket?.id === t.id
                            ? 'border-[#0E7C3A] bg-[#E6F4EC]/30'
                            : 'border-[#DDE3DF] hover:bg-[#F3F6F4]'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-xs text-[#14201A]">{t.riderName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-[#0E7C3A]">{t.category}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSupportTicket(t.id);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors opacity-70 hover:opacity-100"
                              title="Delete ticket"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-[#3E4A43] truncate">{t.subject}</p>
                      </div>
                    ))
                  )}                </div>

                {/* Ticket Message Thread */}
                <div className={`bg-white rounded-3xl border border-[#DDE3DF] p-4 sm:p-5 flex flex-col justify-between ${
                  !selectedTicket ? 'hidden md:flex' : 'flex'
                }`}>
                  {selectedTicket ? (
                    <>
                      <div>
                        {/* Mobile Back Button */}
                        <div className="flex items-center justify-between mb-3">
                          <button
                            onClick={() => setSelectedTicket(null)}
                            className="md:hidden flex items-center gap-1.5 text-xs font-bold text-[#0E7C3A] hover:underline"
                          >
                            &larr; Back to Ticket List
                          </button>
                          <button
                            onClick={() => handleDeleteSupportTicket(selectedTicket.id)}
                            className="text-rose-600 hover:text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer ml-auto"
                            title="Delete this ticket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Ticket</span>
                          </button>
                        </div>

                        <div className="border-b border-[#DDE3DF] pb-3 mb-3">
                          <h3 className="font-bold text-sm text-[#14201A]">{selectedTicket.subject}</h3>
                          <p className="text-xs text-[#7A857F]">From: {selectedTicket.riderName} ({selectedTicket.riderPhone})</p>
                        </div>

                        <div className="space-y-2 max-h-56 overflow-y-auto mb-4">
                          {selectedTicket.messages.map((m: any, idx: number) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl text-xs ${
                                m.sender === 'support'
                                  ? 'bg-[#E6F4EC] text-[#0E7C3A] ml-6'
                                  : 'bg-[#F3F6F4] text-[#14201A] mr-6'
                              }`}
                            >
                              <span className="block font-bold text-[10px] mb-0.5">{m.senderName}</span>
                              <p>{m.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type response to rider..."
                          className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs outline-none font-medium"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              if (!replyText.trim()) return;
                              await adminFetch(`/api/admin/support/tickets/${selectedTicket.id}/reply`, {
                                method: 'POST',
                                body: JSON.stringify({
                                  text: replyText,
                                  sender: 'support',
                                  senderName: currentUser.name,
                                }),
                              });
                              setReplyText('');
                              refreshAllData();
                            }}
                            className="flex-1 py-2 bg-[#0E7C3A] text-white rounded-xl text-xs font-bold"
                          >
                            Send Reply
                          </button>
                          <button
                            onClick={() => {
                              setResolvingTicket(selectedTicket);
                              setTicketResolutionInput('');
                            }}
                            className="px-3 py-2 bg-[#F3F6F4] hover:bg-[#E5E9E7] text-[#14201A] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            Resolve Ticket
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-center text-xs text-[#7A857F] my-auto">Select a ticket to review conversation thread</p>
                  )}                </div>
              </div>

              {/* Passenger Feedback & Rating Surveys Table */}
              <div className="bg-white rounded-3xl border border-[#DDE3DF] p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[#14201A]">Passenger Ride Ratings & Feedback</h3>
                    <p className="text-xs text-[#7A857F]">Live feedback stream submitted by students and campus riders</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {surveys.length > 0 && (
                      <button
                        onClick={handleClearAllSurveys}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-[#D93A3A] text-xs font-bold rounded-lg border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Delete all feedback records"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear All
                      </button>
                    )}                    <span className="px-2.5 py-1 bg-[#E6F4EC] text-[#0E7C3A] text-xs font-bold rounded-full">
                      {surveys.length} Received
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-72">
                  {surveys.length === 0 ? (
                    <p className="text-xs text-[#7A857F] py-6 text-center">No passenger ratings recorded yet.</p>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#DDE3DF] text-[#7A857F] uppercase text-[10px]">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Trip ID</th>
                          <th className="pb-2">Passenger</th>
                          <th className="pb-2">Rating</th>
                          <th className="pb-2">Feedback & Comments</th>
                          <th className="pb-2">Safety Sentiment</th>
                          <th className="pb-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F6F4]">
                        {surveys.map((s: any) => (
                          <tr key={s.id} className="hover:bg-[#F3F6F4]/50">
                            <td className="py-2.5 text-[10px] text-[#7A857F] whitespace-nowrap">
                              {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : 'Recent'}
                            </td>
                            <td className="py-2.5 font-mono text-[10px] text-[#0E7C3A] font-bold">
                              {s.tripId || 'Direct'}
                            </td>
                            <td className="py-2.5 text-xs font-semibold text-[#14201A]">
                              {s.userId || 'Student'}
                            </td>
                            <td className="py-2.5 whitespace-nowrap text-[#F5B800] font-bold text-sm">
                              {s.safetyFeeling === 'very_safe' ? '★★★★★' : s.safetyFeeling === 'safe' ? '★★★★☆' : '★★★☆☆'}
                            </td>
                            <td className="py-2.5 text-xs text-[#3E4A43] max-w-xs truncate">
                              {s.comments || 'Great ride experience'}
                            </td>
                            <td className="py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                  s.safetyFeeling === 'very_safe'
                                    ? 'bg-[#E6F4EC] text-[#0E7C3A]'
                                    : s.safetyFeeling === 'safe'
                                    ? 'bg-[#FFF8E6] text-[#E69500]'
                                    : 'bg-[#FDE8E8] text-[#D93A3A]'
                                }`}
                              >
                                {s.safetyFeeling?.replace('_', ' ') || 'Safe'}
                              </span>
                            </td>
                            <td className="py-2.5 text-right">
                              <button
                                onClick={() => handleDeleteSurvey(s.id)}
                                className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete this feedback entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}                </div>
              </div>
            </div>
          )}
          {/* ============================================================== */}
          {/* A13. ANNOUNCEMENTS */}
          {/* ============================================================== */}
          {currentTab === 'announcements' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-xl font-bold text-[#14201A]">Broadcast Campus Announcements</h2>
                <p className="text-xs text-[#7A857F]">Push notifications and SMS with 160-char constraint</p>
              </div>

              <div className="bg-white rounded-3xl border border-[#DDE3DF] p-6 shadow-sm space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Title</label>
                  <input
                    type="text"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    placeholder="e.g. Matriculation Ceremony Shuttle Update"
                    className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold uppercase text-[#7A857F]">Message Body</label>
                    <span className={`text-[10px] font-mono font-bold ${annBody.length > 160 ? 'text-[#D93A3A]' : 'text-[#7A857F]'}`}>
                      {annBody.length}/160 characters (SMS Limit)
                    </span>
                  </div>
                  <textarea
                    value={annBody}
                    onChange={(e) => setAnnBody(e.target.value)}
                    placeholder="Type broadcast message..."
                    className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs h-28 resize-none outline-none font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Audience</label>
                    <select
                      value={annAudience}
                      onChange={(e) => setAnnAudience(e.target.value as any)}
                      className="w-full p-2.5 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold"
                    >
                      <option value="all">Everyone on Campus</option>
                      <option value="riders">Students & Staff (Riders)</option>
                      <option value="drivers">Keke & Okada Drivers</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Channels</label>
                    <div className="flex gap-2 pt-1 text-xs">
                      <label className="flex items-center gap-1.5 font-bold">
                        <input type="checkbox" checked={annChannels.includes('in_app')} readOnly /> In-App
                      </label>
                      <label className="flex items-center gap-1.5 font-bold">
                        <input
                          type="checkbox"
                          checked={annChannels.includes('sms')}
                          onChange={(e) => {
                            if (e.target.checked) setAnnChannels([...annChannels, 'sms']);
                            else setAnnChannels(annChannels.filter(c => c !== 'sms'));
                          }}
                        /> SMS
                      </label>
                    </div>
                  </div>
                </div>

                {annSuccessMessage && (
                  <p className="text-xs font-bold text-[#1B9E4B]">{annSuccessMessage}</p>
                )}
                <div className="pt-2">
                  <KerbButton
                    onClick={async () => {
                      if (!annTitle || !annBody) return;
                      const res = await adminFetch('/api/admin/announcements', {
                        method: 'POST',
                        body: JSON.stringify({
                          title: annTitle,
                          body: annBody,
                          audience: annAudience,
                          channels: annChannels,
                        }),
                      });
                      const d = await res.json();
                      if (d.success) {
                        setAnnSuccessMessage(`✓ Broadcasted to ${d.announcement.recipientCount} recipients!`);
                        setAnnTitle('');
                        setAnnBody('');
                        refreshAllData();
                        playKerbSound('success');
                        setTimeout(() => setAnnSuccessMessage(''), 4000);
                      }
                    }}
                  >
                    Broadcast Announcement &rarr;
                  </KerbButton>
                </div>
              </div>

              {/* Broadcasts History & Active Announcements */}
              <div className="bg-white rounded-3xl border border-[#DDE3DF] p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[#14201A]">Active Broadcasts & History</h3>
                    <p className="text-xs text-[#7A857F]">Announcements currently published to passenger and driver apps</p>
                  </div>
                  <span className="px-2.5 py-1 bg-[#E6F4EC] text-[#0E7C3A] text-xs font-bold rounded-full">
                    {announcementsList.length} Broadcasts
                  </span>
                </div>

                <div className="space-y-3">
                  {announcementsList.length === 0 ? (
                    <p className="text-xs text-[#7A857F] py-6 text-center">No broadcast announcements published yet.</p>
                  ) : (
                    announcementsList.map((ann) => (
                      <div
                        key={ann.id}
                        className="p-4 rounded-2xl border border-[#DDE3DF] bg-[#F8FAF9] flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-[#14201A]">{ann.title}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#E6F4EC] text-[#0E7C3A] px-2 py-0.5 rounded-full border border-[#0E7C3A]/20">
                              Audience: {ann.audience}
                            </span>
                            <span className="text-[10px] font-mono text-[#7A857F]">
                              {ann.sentAt ? new Date(ann.sentAt).toLocaleString() : 'Recent'}
                            </span>
                          </div>
                          <p className="text-xs text-[#3E4A43] leading-relaxed">{ann.body}</p>
                          <div className="flex items-center gap-3 text-[10px] text-[#7A857F] pt-1 font-medium">
                            <span>Channels: {ann.channels?.join(', ') || 'in_app'}</span>
                            <span>•</span>
                            <span>Recipients: {ann.recipientCount || 0}</span>
                            <span>•</span>
                            <span>Sent by: {ann.sentBy || 'Admin HQ'}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start shrink-0"
                          title="Delete this announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    ))
                  )}                </div>
              </div>
            </div>
          )}
          {/* ============================================================== */}
          {/* A14. REPORTS & ANALYTICS DATA CENTER */}
          {/* ============================================================== */}
          {currentTab === 'reports' && (
            <div className="space-y-6 max-w-7xl">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#14201A] tracking-tight">Reports & Analytics Export Center</h2>
                  <p className="text-xs sm:text-sm text-[#7A857F] mt-0.5">
                    Real-time campus transit metrics, high-demand route telemetry, and 1-click CSV data exports
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={refreshAllData}
                    className="px-3.5 py-2.5 bg-white border border-[#DDE3DF] hover:border-[#0E7C3A] text-[#14201A] rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-[#0E7C3A]" />
                    <span>Sync Metrics</span>
                  </button>
                </div>
              </div>

              {/* Bento KPI Summary Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Total Campus Rides</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-[#14201A]">{rides.length}</span>
                    <span className="text-[10px] font-bold text-[#0E7C3A] bg-[#E6F4EC] px-1.5 py-0.5 rounded-md">Logged</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">{rides.filter(r => r.status === 'completed').length} completed trips</p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Trip Completion Rate</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-[#0E7C3A]">
                      {rides.length > 0 ? Math.round((rides.filter(r => r.status === 'completed').length / rides.length) * 100) : 100}%
                    </span>
                    <span className="text-[10px] font-bold text-[#0E7C3A] bg-[#E6F4EC] px-1.5 py-0.5 rounded-md">Optimal</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">Completed vs requested</p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Active Driver Fleet</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-[#14201A]">{drivers.length}</span>
                    <span className="text-[10px] font-bold text-[#0E7C3A] bg-[#E6F4EC] px-1.5 py-0.5 rounded-md">Verified</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">{drivers.filter(d => d.isOnline).length} currently online</p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-[#DDE3DF] shadow-xs">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A857F]">Rider Feedback Logs</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-black text-[#14201A]">{surveys.length}</span>
                  </div>
                  <p className="text-[11px] text-[#7A857F] mt-1">Post-trip ratings recorded</p>
                </div>
              </div>

              {/* 1-Click CSV Export Download Center */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#DDE3DF] p-5 sm:p-6 shadow-xs">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-10 h-10 rounded-2xl bg-[#E6F4EC] flex items-center justify-center text-[#0E7C3A]">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-[#14201A]">1-Click Pilot Data Export Center</h3>
                    <p className="text-xs text-[#7A857F]">Download comprehensive immutable archives in universal RFC 4180 CSV format</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Card 1: Trips CSV */}
                  <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-[#DDE3DF] flex flex-col justify-between hover:border-[#0E7C3A] transition-all">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black uppercase text-[#14201A]">Trips & Bookings</span>
                        <span className="text-[10px] font-bold bg-[#E6F4EC] text-[#0E7C3A] px-2 py-0.5 rounded-full">
                          {rides.length} records
                        </span>
                      </div>
                      <p className="text-xs text-[#7A857F] mb-4">
                        Every campus hailing event, routes, fares, payment type, safety PINs, and timestamps.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        exportToCsv(
                          `FUTMINNA_Trips_Ledger_${new Date().toISOString().slice(0, 10)}.csv`,
                          ['Trip ID', 'Passenger Name', 'Passenger Phone', 'Driver Name', 'Driver Plate', 'Vehicle Category', 'Pickup Zone', 'Dropoff Zone', 'Fare (NGN)', 'Payment Method', 'Status', 'Safety PIN', 'Created At'],
                          rides.map(r => [
                            r.id,
                            r.riderName || 'Anonymous',
                            r.riderPhone || '',
                            r.driverName || 'Unassigned',
                            r.driverPlate || '',
                            r.vehicleCategory || '',
                            r.pickupName,
                            r.dropoffName,
                            r.fareNaira,
                            r.paymentMethod || 'cash',
                            r.status,
                            r.safetyPin,
                            new Date(r.createdAt).toISOString()
                          ])
                        );
                      }}
                      className="w-full py-2.5 bg-[#0E7C3A] hover:bg-[#0c6b32] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Trips CSV</span>
                    </button>
                  </div>

                  {/* Card 2: Driver Fleet CSV */}
                  <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-[#DDE3DF] flex flex-col justify-between hover:border-[#0E7C3A] transition-all">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black uppercase text-[#14201A]">Driver Fleet Dossier</span>
                        <span className="text-[10px] font-bold bg-[#E6F4EC] text-[#0E7C3A] px-2 py-0.5 rounded-full">
                          {drivers.length} drivers
                        </span>
                      </div>
                      <p className="text-xs text-[#7A857F] mb-4">
                        Driver personal records, NIN numbers, vehicle specs, union base stations, and ratings.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        exportToCsv(
                          `FUTMINNA_Drivers_Fleet_${new Date().toISOString().slice(0, 10)}.csv`,
                          ['Driver ID', 'Name', 'Phone', 'Alt Phone', 'NIN', 'Category', 'Plate', 'Model', 'Color', 'Base Station', 'Park Leader', 'Status', 'Rating', 'Trips', 'Approved'],
                          drivers.map(d => [
                            d.id,
                            d.name,
                            d.phone,
                            d.secondPhone || '',
                            d.ninNumber || '',
                            d.vehicleCategory,
                            d.vehiclePlate,
                            d.vehicleModel,
                            d.vehicleColor,
                            d.stationName || '',
                            d.parkLeaderName || '',
                            d.status || (d.isApproved ? 'Approved' : 'Pending'),
                            d.rating || 5.0,
                            d.totalTrips || 0,
                            d.isApproved ? 'YES' : 'NO'
                          ])
                        );
                      }}
                      className="w-full py-2.5 bg-[#0E7C3A] hover:bg-[#0c6b32] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Fleet CSV</span>
                    </button>
                  </div>

                  {/* Card 3: Passenger Directory CSV */}
                  <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-[#DDE3DF] flex flex-col justify-between hover:border-[#0E7C3A] transition-all">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black uppercase text-[#14201A]">Passenger Directory</span>
                        <span className="text-[10px] font-bold bg-[#E6F4EC] text-[#0E7C3A] px-2 py-0.5 rounded-full">
                          {ridersList.length} riders
                        </span>
                      </div>
                      <p className="text-xs text-[#7A857F] mb-4">
                        Full student, faculty staff and visitor accounts, trip counts, and status records.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        exportToCsv(
                          `FUTMINNA_Passengers_${new Date().toISOString().slice(0, 10)}.csv`,
                          ['User ID', 'Full Name', 'Phone', 'Role', 'Matric/Staff ID', 'Department', 'Trips Completed', 'Status', 'Block Reason'],
                          ridersList.map(u => [
                            u.id,
                            u.name || 'Anonymous',
                            u.phone,
                            u.role || 'student',
                            u.matricOrStaffId || '',
                            u.department || '',
                            u.tripsCount || 0,
                            u.isBlocked ? 'BLOCKED' : 'ACTIVE',
                            u.blockReason || ''
                          ])
                        );
                      }}
                      className="w-full py-2.5 bg-[#0E7C3A] hover:bg-[#0c6b32] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Passengers CSV</span>
                    </button>
                  </div>

                  {/* Card 4: Cash Ledger CSV */}
                  <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-[#DDE3DF] flex flex-col justify-between hover:border-[#0E7C3A] transition-all">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black uppercase text-[#14201A]">Cash & 0% Remittance</span>
                        <span className="text-[10px] font-bold bg-[#E6F4EC] text-[#0E7C3A] px-2 py-0.5 rounded-full">
                          {cashLedgerData?.ledger?.length || 0} accounts
                        </span>
                      </div>
                      <p className="text-xs text-[#7A857F] mb-4">
                        0% Commission audit records verifying 100% fare retention by union campus drivers.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        exportToCsv(
                          `FUTMINNA_Cash_Audit_${new Date().toISOString().slice(0, 10)}.csv`,
                          ['Driver ID', 'Driver Name', 'Plate', 'Category', 'Completed Trips', 'Total Cash Collected (NGN)', 'Commission Due (NGN)', 'Remittance Status'],
                          (cashLedgerData?.ledger || []).map((l: any) => [
                            l.driverId,
                            l.driverName,
                            l.vehiclePlate,
                            l.vehicleCategory,
                            l.totalCompletedTrips,
                            l.totalCashCollected,
                            l.pilotCommissionDue || 0,
                            l.remittanceStatus || 'CLEARED_0_PCT'
                          ])
                        );
                      }}
                      className="w-full py-2.5 bg-[#0E7C3A] hover:bg-[#0c6b32] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Cash Audit CSV</span>
                    </button>
                  </div>

                  {/* Card 5: Safety Incidents CSV */}

                </div>
              </div>

              {/* High-Demand Campus Route Corridors & Driver Leaderboard */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Popular Route Corridors */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#DDE3DF] p-5 sm:p-6 shadow-xs">
                  <h3 className="font-black text-base text-[#14201A] mb-1">Campus Route Demand Corridors</h3>
                  <p className="text-xs text-[#7A857F] mb-4">Most frequented transit pathways across Gidan Kwano</p>
                  
                  <div className="space-y-3">
                    {(reportsData?.topRoutes || [
                      { route: 'Main Gate <-> Student Hostels', count: 184, fare: 200 },
                      { route: 'Student Hostels <-> SEET Complex', count: 96, fare: 150 },
                      { route: 'Hostels <-> Central Library', count: 72, fare: 150 },
                    ]).map((r: any, idx: number) => (
                      <div key={idx} className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#DDE3DF] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-[#0E7C3A] text-white text-xs font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-bold text-xs text-[#14201A]">{r.route}</p>
                            <p className="text-[11px] text-[#7A857F]">{r.count} completed trips · Standard Fare: ₦{r.fare}</p>
                          </div>
                        </div>
                        <span className="text-xs font-black text-[#0E7C3A] bg-[#E6F4EC] px-2.5 py-1 rounded-xl">
                          High Demand
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Driver Fleet Performance Leaderboard */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#DDE3DF] p-5 sm:p-6 shadow-xs">
                  <h3 className="font-black text-base text-[#14201A] mb-1">Driver Performance Leaderboard</h3>
                  <p className="text-xs text-[#7A857F] mb-4">Top campus drivers ranked by trip volume and safety rating</p>

                  <div className="space-y-3">
                    {(reportsData?.driverRankings || drivers.slice(0, 5).map(d => ({
                      name: d.name,
                      rating: d.rating || 5.0,
                      trips: d.totalTrips || 0,
                      plate: d.vehiclePlate,
                    }))).map((d: any, idx: number) => (
                      <div key={idx} className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#DDE3DF] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-[#14201A] text-white text-xs font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-bold text-xs text-[#14201A]">{d.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <KerbPlateBadge plate={d.plate} />
                              <span className="text-[11px] text-[#7A857F]">· {d.trips} rides</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-black text-[#E69500]">
                          <span>★</span>
                          <span>{Number(d.rating).toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                    {drivers.length === 0 && (
                      <div className="py-8 text-center text-[#7A857F] text-xs">
                        No active driver ratings recorded yet.
                      </div>
                    )}                  </div>
                </div>
              </div>
            </div>
          )}
          {/* ============================================================== */}
          {/* A15. SETTINGS & AUDIT LOG */}
          {/* ============================================================== */}
          {currentTab === 'settings' && (
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="text-xl font-bold text-[#14201A]">System Settings & Security Audit Log</h2>
                <p className="text-xs text-[#7A857F]">Read-only immutable action trail for pilot leads and auditors</p>
              </div>

              {/* Immutable Audit Log Table */}
              <div className="bg-white rounded-3xl border border-[#DDE3DF] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-[#14201A]">Permanent Security Audit Trail</h3>
                  {currentUser?.role === 'pilot_lead' && auditLogs.length > 0 && (
                    <button
                      onClick={handleClearAuditLogs}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-[#D93A3A] text-xs font-bold rounded-lg border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Clear historical audit logs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear Audit Trail
                    </button>
                  )}                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#DDE3DF] text-[#7A857F] uppercase text-[10px]">
                        <th className="pb-2">Timestamp</th>
                        <th className="pb-2">Action</th>
                        <th className="pb-2">Staff Member</th>
                        <th className="pb-2">Role</th>
                        <th className="pb-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F6F4]">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#F3F6F4]/50">
                          <td className="py-2.5 font-mono text-[10px] text-[#7A857F]">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2.5 font-bold text-[#14201A]">{log.action}</td>
                          <td className="py-2.5 font-semibold text-[#14201A]">{log.staffName}</td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-[#F3F6F4] text-[#3E4A43]">
                              {log.staffRole}
                            </span>
                          </td>
                          <td className="py-2.5 text-[#3E4A43] max-w-md">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {/* ============================================================== */}
          {/* STAFF MANAGEMENT TAB (SUPERADMIN / PILOT LEAD ONLY) */}
          {/* ============================================================== */}
          {currentTab === 'staff' && (
            <div className="space-y-6 max-w-6xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#14201A] flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#0E7C3A]" />
                    Operations Staff Roster & Access Control
                  </h2>
                  <p className="text-xs text-[#7A857F]">
                    Create, manage, and remove authorized operational personnel (Super Admin exclusive)
                  </p>
                </div>

                {currentUser?.role === 'pilot_lead' && (
                  <button
                    onClick={() => {
                      setStaffActionError('');
                      setIsCreateStaffModalOpen(true);
                    }}
                    className="px-4 py-2.5 bg-[#0E7C3A] text-white rounded-xl text-xs font-bold hover:bg-[#14532D] transition-all flex items-center gap-2 shadow-md shadow-[#0E7C3A]/20 cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Add Staff Member
                  </button>
                )}              </div>

              {/* Staff Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-4 rounded-2xl border border-[#DDE3DF] shadow-xs">
                  <p className="text-[10px] font-bold uppercase text-[#7A857F]">Total Active Staff</p>
                  <p className="text-2xl font-black text-[#14201A] mt-1">{staffList.length}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#DDE3DF] shadow-xs">
                  <p className="text-[10px] font-bold uppercase text-[#7A857F]">Super Admins</p>
                  <p className="text-2xl font-black text-[#0E7C3A] mt-1">
                    {staffList.filter((s) => s.role === 'pilot_lead').length}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#DDE3DF] shadow-xs">
                  <p className="text-[10px] font-bold uppercase text-[#7A857F]">Ops & Support</p>
                  <p className="text-2xl font-black text-[#3E4A43] mt-1">
                    {staffList.filter((s) => ['operations', 'support'].includes(s.role)).length}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#DDE3DF] shadow-xs">
                  <p className="text-[10px] font-bold uppercase text-[#7A857F]">Security & Audit</p>
                  <p className="text-2xl font-black text-[#3E4A43] mt-1">
                    {staffList.filter((s) => ['school_security', 'viewer'].includes(s.role)).length}
                  </p>
                </div>
              </div>

              {/* Staff Accounts Table */}
              <div className="bg-white rounded-3xl border border-[#DDE3DF] p-5 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-sm text-[#14201A]">Operational Personnel Directory</h3>
                    <p className="text-[11px] text-[#7A857F]">Authorized console logins, security roles, and active 2FA PINs</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#DDE3DF] text-[#7A857F] uppercase text-[10px]">
                        <th className="pb-3 font-bold">Staff Member</th>
                        <th className="pb-3 font-bold">Role & Permissions</th>
                        <th className="pb-3 font-bold">Phone Contact</th>
                        <th className="pb-3 font-bold">2FA PIN</th>
                        <th className="pb-3 font-bold">Account Status</th>
                        <th className="pb-3 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F6F4]">
                      {staffList.map((member) => {
                        const isCurrentUser = currentUser?.id === member.id;
                        const isSuperAdmin = member.role === 'pilot_lead';
                        const isCannotDelete = isCurrentUser || isSuperAdmin;

                        return (
                          <tr key={member.id} className="hover:bg-[#F3F6F4]/50 transition-colors">
                            <td className="py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#E6F4EC] text-[#0E7C3A] font-bold flex items-center justify-center text-xs shrink-0">
                                  {member.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-[#14201A] flex items-center gap-1.5">
                                    {member.name}
                                    {isCurrentUser && (
                                      <span className="text-[9px] bg-[#0E7C3A] text-white px-1.5 py-0.2 rounded font-semibold">
                                        You
                                      </span>
                                    )}                                  </p>
                                  <p className="text-[11px] text-[#7A857F] font-mono">{member.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                  member.role === 'pilot_lead'
                                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                    : member.role === 'operations'
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : member.role === 'school_security'
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                    : member.role === 'support'
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                                }`}
                              >
                                {member.role === 'pilot_lead'
                                  ? 'Pilot Lead (Super Admin)'
                                  : member.role === 'operations'
                                  ? 'Operations Manager'
                                  : member.role === 'school_security'
                                  ? 'Campus Security'
                                  : member.role === 'support'
                                  ? 'Support Lead'
                                  : 'Auditor / Viewer'}
                              </span>
                            </td>
                            <td className="py-3 text-[#3E4A43] font-medium">
                              {member.phone || <span className="text-[#7A857F] italic">—</span>}
                            </td>
                            <td className="py-3">
                              <span className="font-mono bg-[#F3F6F4] text-[#14201A] px-2 py-0.5 rounded text-[11px] font-bold border border-[#DDE3DF]">
                                {member.pin2fa || '******'}
                              </span>
                            </td>
                            <td className="py-3">
                              {member.lockedUntil && new Date(member.lockedUntil).getTime() > Date.now() ? (
                                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                  Locked
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 w-fit">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Active
                                </span>
                              )}                            </td>
                            <td className="py-3 text-right">
                              {currentUser?.role === 'pilot_lead' && (
                                <button
                                  onClick={() => handleDeleteStaff(member.id, member.name)}
                                  disabled={isCannotDelete}
                                  title={
                                    isCurrentUser
                                      ? 'Cannot delete your own active account as Super Admin'
                                      : isSuperAdmin
                                      ? 'The Super Admin account cannot be deleted'
                                      : 'Delete staff account'
                                  }
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    isCannotDelete
                                      ? 'text-gray-300 cursor-not-allowed opacity-40'
                                      : 'text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer'
                                  }`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}        </main>

        {/* Mobile Bottom Navigation Bar (Phone-Friendly Thumb Navigation) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 z-30 px-2 py-1 flex items-center justify-around shadow-lg h-16">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
              currentTab === 'dashboard' ? 'text-[#0E7C3A]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard className={`w-5 h-5 mb-0.5 ${currentTab === 'dashboard' ? 'stroke-[2.5]' : ''}`} />
            <span>Overview</span>
          </button>

          <button
            onClick={() => {
              if (isAllowed('live_map')) setCurrentTab('live_map');
            }}
            className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
              currentTab === 'live_map' ? 'text-[#0E7C3A]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Map className={`w-5 h-5 mb-0.5 ${currentTab === 'live_map' ? 'stroke-[2.5]' : ''}`} />
            <span>Map</span>
          </button>

          <button
            onClick={() => {
              if (isAllowed('rides')) setCurrentTab('rides');
            }}
            className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer relative ${
              currentTab === 'rides' ? 'text-[#0E7C3A]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Car className={`w-5 h-5 mb-0.5 ${currentTab === 'rides' ? 'stroke-[2.5]' : ''}`} />
            <span>Rides</span>
            {rides.filter((r) => ['requested', 'matching', 'accepted', 'arriving'].includes(r.status)).length > 0 && (
              <span className="absolute top-1 right-5 w-2 h-2 rounded-full bg-[#0E7C3A] animate-ping" />
            )}          </button>

          <button
            onClick={() => {
              if (isAllowed('drivers')) setCurrentTab('drivers');
            }}
            className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer relative ${
              currentTab === 'drivers' ? 'text-[#0E7C3A]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className={`w-5 h-5 mb-0.5 ${currentTab === 'drivers' ? 'stroke-[2.5]' : ''}`} />
            <span>Drivers</span>
            {applications.filter((a) => a.status === 'pending').length > 0 && (
              <span className="absolute top-1 right-5 px-1 text-[8px] font-extrabold bg-[#E6F4EC] text-[#0E7C3A] border border-[#0E7C3A]/30 rounded-full">
                {applications.filter((a) => a.status === 'pending').length}
              </span>
            )}          </button>

          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex-1 flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span>All Tabs</span>
          </button>
        </nav>
      </div>

      {/* ============================================================== */}
      {/* A7. DRIVER DOSSIER, DOCUMENTS & VERIFICATION PANEL */}
      {/* ============================================================== */}
      {selectedDriverApp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[96vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-[#DDE3DF] my-auto">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-5 border-b border-[#DDE3DF] flex items-center justify-between bg-white sticky top-0 z-10 gap-2">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-2xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center font-bold shrink-0">
                  <UserCheck size={20} />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                    <h3 className="text-sm sm:text-lg font-black text-[#14201A] truncate">
                      {selectedDriverApp.applicantName || selectedDriverApp.name}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                      selectedDriverApp.status === 'pending'
                        ? 'bg-[#FFF8E6] text-[#E69500]'
                        : selectedDriverApp.isSuspended
                        ? 'bg-[#FDE8E8] text-[#D93A3A]'
                        : 'bg-[#E6F4EC] text-[#1B9E4B]'
                    }`}>
                      {selectedDriverApp.status || (selectedDriverApp.isApproved ? 'Approved' : 'Pending')}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#7A857F] truncate">
                    Phone: <span className="font-semibold text-[#14201A]">{selectedDriverApp.phone}</span>
                    {selectedDriverApp.secondPhone && ` · Alt: ${selectedDriverApp.secondPhone}`}
                    {selectedDriverApp.ninNumber && (
                      <span className="ml-1.5 font-mono font-bold text-[#0E7C3A] bg-[#E6F4EC] px-1.5 py-0.2 rounded text-[10px]">
                        NIN: {selectedDriverApp.ninNumber}
                      </span>
                    )}                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleDownloadAllDossier(selectedDriverApp)}
                  className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-[#0E7C3A] hover:bg-[#0b632e] text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
                  title="Download all documents and text summary"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Download All Files</span>
                </button>
                <button
                  onClick={() => setSelectedDriverApp(null)}
                  className="p-1.5 rounded-full hover:bg-[#F3F6F4] text-[#7A857F] hover:text-[#14201A] transition-colors"
                >
                  <CloseIcon size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-[#F9FAF9]">
              {/* Quick Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 bg-white rounded-2xl border border-[#DDE3DF] shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-[#7A857F] block mb-1">Personal Details</span>
                  <p className="text-xs text-[#14201A]"><strong>DOB:</strong> {selectedDriverApp.dob || 'Not specified'}</p>
                  <p className="text-xs text-[#14201A]"><strong>Residence:</strong> {selectedDriverApp.homeArea || 'Campus/Minna'}</p>
                  <p className="text-xs text-[#14201A]"><strong>NIN:</strong> {selectedDriverApp.ninNumber || 'Not submitted'}</p>
                  <p className="text-xs text-[#14201A]"><strong>Device:</strong> 📲 Smartphone (Driver App)</p>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-[#DDE3DF] shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-[#7A857F] block mb-1">Vehicle Information</span>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[#14201A] capitalize">{selectedDriverApp.vehicleCategory}</span>
                    <KerbPlateBadge plate={selectedDriverApp.vehiclePlate} />
                  </div>
                  <p className="text-xs text-[#14201A]"><strong>Model:</strong> {selectedDriverApp.vehicleModel} ({selectedDriverApp.vehicleColor})</p>
                  <p className="text-xs text-[#14201A]"><strong>Station:</strong> {selectedDriverApp.stationName || 'School Motor Park'}</p>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-[#DDE3DF] shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-[#7A857F] block mb-1">Park Leader & Union Vouching</span>
                  <p className="text-xs text-[#14201A]"><strong>Leader:</strong> {selectedDriverApp.parkLeaderName || 'Main Gate Chairman'}</p>
                  <p className="text-xs text-[#14201A]"><strong>Contact:</strong> {selectedDriverApp.parkLeaderPhone || 'N/A'}</p>
                  <button
                    onClick={() => handleDownloadAllDossier(selectedDriverApp)}
                    className="sm:hidden mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#0E7C3A] text-white font-bold text-xs rounded-xl shadow"
                  >
                    <Download size={13} /> Download All Dossier Files
                  </button>
                </div>
              </div>

              {/* Uploaded Documents Grid (20MB Images / PDFs) */}
              <div className="bg-white rounded-2xl border border-[#DDE3DF] p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-sm text-[#14201A]">Uploaded Verification Documents & Pictures</h4>
                    <p className="text-[11px] text-[#7A857F]">Review high-res images and PDF documents submitted during registration (up to 20MB each).</p>
                  </div>
                  <span className="text-xs font-bold text-[#0E7C3A] bg-[#E6F4EC] px-2.5 py-1 rounded-full">
                    5 Verification Assets
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {[
                    {
                      key: 'facePhoto',
                      title: 'Profile Photo',
                      url: selectedDriverApp.facePhotoUrl,
                      meta: selectedDriverApp.documentsMeta?.facePhoto,
                      isPdf: selectedDriverApp.facePhotoUrl?.startsWith('data:application/pdf') || selectedDriverApp.documentsMeta?.facePhoto?.type?.includes('pdf'),
                      fallbackName: `${(selectedDriverApp.applicantName || selectedDriverApp.name).replace(/\s+/g, '_')}_Profile_Photo.jpg`,
                      desc: 'Driver face & official ID portrait',
                    },
                    {
                      key: 'idCard',
                      title: 'NIN Document / Slip',
                      url: selectedDriverApp.idCardPhotoUrl,
                      meta: selectedDriverApp.documentsMeta?.idCard,
                      isPdf: selectedDriverApp.idCardPhotoUrl?.startsWith('data:application/pdf') || selectedDriverApp.documentsMeta?.idCard?.type?.includes('pdf'),
                      fallbackName: `${(selectedDriverApp.applicantName || selectedDriverApp.name).replace(/\s+/g, '_')}_NIN_Document.pdf`,
                      desc: `NIN: ${selectedDriverApp.ninNumber || 'National Identity Document'}`,
                    },
                    {
                      key: 'license',
                      title: 'Driver License / Park Card',
                      url: selectedDriverApp.licenseOrParkCardUrl,
                      meta: selectedDriverApp.documentsMeta?.license,
                      isPdf: selectedDriverApp.licenseOrParkCardUrl?.startsWith('data:application/pdf') || selectedDriverApp.documentsMeta?.license?.type?.includes('pdf'),
                      fallbackName: `${(selectedDriverApp.applicantName || selectedDriverApp.name).replace(/\s+/g, '_')}_License_Park_Card.pdf`,
                      desc: 'FRSC license or Campus Motor Park ID',
                    },
                    {
                      key: 'vehiclePhoto',
                      title: 'Vehicle Exterior Photo',
                      url: selectedDriverApp.vehiclePhotoUrl,
                      meta: selectedDriverApp.documentsMeta?.vehiclePhoto,
                      isPdf: selectedDriverApp.vehiclePhotoUrl?.startsWith('data:application/pdf') || selectedDriverApp.documentsMeta?.vehiclePhoto?.type?.includes('pdf'),
                      fallbackName: `${(selectedDriverApp.applicantName || selectedDriverApp.name).replace(/\s+/g, '_')}_Vehicle_Exterior.jpg`,
                      desc: `Plate: ${selectedDriverApp.vehiclePlate}`,
                    },
                    {
                      key: 'vehiclePapers',
                      title: 'Vehicle Papers / Particulars',
                      url: selectedDriverApp.vehiclePapersUrl,
                      meta: selectedDriverApp.documentsMeta?.vehiclePapers,
                      isPdf: selectedDriverApp.vehiclePapersUrl?.startsWith('data:application/pdf') || selectedDriverApp.documentsMeta?.vehiclePapers?.type?.includes('pdf'),
                      fallbackName: `${(selectedDriverApp.applicantName || selectedDriverApp.name).replace(/\s+/g, '_')}_Vehicle_Papers.pdf`,
                      desc: 'Vehicle license or roadworthiness certificate',
                    },
                  ].map((doc) => {
                    const hasFile = Boolean(doc.url);
                    const isPdf = Boolean(doc.isPdf);
                    const filename = doc.meta?.name || doc.fallbackName;

                    return (
                      <div
                        key={doc.key}
                        className={`rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                          hasFile ? 'bg-[#FAFCFA] border-[#DDE3DF] hover:border-[#0E7C3A]/50 shadow-sm' : 'bg-[#F9F9F9] border-dashed border-[#DDE3DF]'
                        }`}
                      >
                        {/* Preview / Thumbnail */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-xs text-[#14201A]">{doc.title}</span>
                            {hasFile ? (
                              <span className="text-[10px] font-semibold text-[#0E7C3A] bg-[#E6F4EC] px-1.5 py-0.5 rounded">
                                {doc.meta?.size || (isPdf ? 'PDF Doc' : 'Image')}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#7A857F] bg-[#F3F6F4] px-1.5 py-0.5 rounded">
                                Missing
                              </span>
                            )}                          </div>

                          {hasFile ? (
                            isPdf ? (
                              <div
                                onClick={() => setPreviewDocModal({
                                  isOpen: true,
                                  title: doc.title,
                                  url: doc.url,
                                  filename,
                                  fileType: doc.meta?.type || 'application/pdf',
                                  fileSize: doc.meta?.size,
                                })}
                                className="w-full h-28 rounded-xl bg-gradient-to-br from-[#E6F4EC] to-[#F3F6F4] border border-[#DDE3DF] flex flex-col items-center justify-center cursor-pointer hover:border-[#0E7C3A] transition-all group p-2 text-center"
                              >
                                <FileText size={28} className="text-[#0E7C3A] group-hover:scale-110 transition-transform mb-1" />
                                <span className="text-[11px] font-bold text-[#14201A] truncate max-w-[95%]">
                                  {filename}
                                </span>
                                <span className="text-[9px] text-[#0E7C3A] font-semibold flex items-center gap-1 mt-0.5">
                                  <Eye size={10} /> Click to View PDF
                                </span>
                              </div>
                            ) : (
                              <div
                                onClick={() => setPreviewDocModal({
                                  isOpen: true,
                                  title: doc.title,
                                  url: doc.url,
                                  filename,
                                  fileType: doc.meta?.type || 'image/jpeg',
                                  fileSize: doc.meta?.size,
                                })}
                                className="w-full h-28 rounded-xl bg-[#F3F6F4] border border-[#DDE3DF] overflow-hidden cursor-pointer group relative flex items-center justify-center hover:border-[#0E7C3A] transition-all"
                              >
                                <img
                                  src={doc.url}
                                  alt={doc.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white font-bold text-[11px] gap-1">
                                  <Eye size={14} /> View High-Res
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="w-full h-28 rounded-xl bg-[#F3F6F4]/50 border border-dashed border-[#DDE3DF] flex flex-col items-center justify-center text-center p-3 text-[#7A857F]">
                              <AlertCircle size={22} className="text-[#A2ADA7] mb-1" />
                              <span className="text-[11px] font-medium">Not submitted</span>
                            </div>
                          )}
                          <p className="text-[10px] text-[#7A857F] mt-2 line-clamp-1">{doc.desc}</p>
                        </div>

                        {/* Action Buttons */}
                        {hasFile && (
                          <div className="flex gap-2 mt-3 pt-2 border-t border-[#DDE3DF]/60">
                            <button
                              onClick={() => setPreviewDocModal({
                                isOpen: true,
                                title: doc.title,
                                url: doc.url,
                                filename,
                                fileType: doc.meta?.type,
                                fileSize: doc.meta?.size,
                              })}
                              className="flex-1 py-1.5 px-2 bg-white hover:bg-[#F3F6F4] border border-[#DDE3DF] text-[#14201A] rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                            >
                              <Eye size={12} className="text-[#0E7C3A]" /> View
                            </button>
                            <button
                              onClick={() => handleDownloadDocument(doc.url, filename)}
                              className="flex-1 py-1.5 px-2 bg-[#E6F4EC] hover:bg-[#D4EEDB] text-[#0E7C3A] rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                            >
                              <Download size={12} /> Download
                            </button>
                          </div>
                        )}                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4 Mandatory Checkboxes & Approval Section (for applications) */}
              {(selectedDriverApp.status === 'pending' || !selectedDriverApp.isApproved) ? (
                <div className="p-4 bg-white rounded-2xl border border-[#DDE3DF] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-[#14201A]">
                        Mandatory 4-Box In-Person Verification
                      </h4>
                      <p className="text-[11px] text-[#7A857F]">
                        Safety protocol requires physical inspection at the motor park before approving any driver.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-[#D93A3A] bg-[#FDE8E8] px-2 py-0.5 rounded-full">
                      Strict Compliance
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                    <label className="flex items-center gap-2.5 p-2.5 bg-[#F9FAF9] rounded-xl border border-[#DDE3DF] cursor-pointer hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={verificationChecklist.metInPerson}
                        onChange={(e) => setVerificationChecklist({ ...verificationChecklist, metInPerson: e.target.checked })}
                        className="w-4 h-4 text-[#0E7C3A] rounded"
                      />
                      <span className="text-xs font-bold text-[#14201A]">1. Met applicant in-person at School Motor Park</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-[#F9FAF9] rounded-xl border border-[#DDE3DF] cursor-pointer hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={verificationChecklist.faceMatchesId}
                        onChange={(e) => setVerificationChecklist({ ...verificationChecklist, faceMatchesId: e.target.checked })}
                        className="w-4 h-4 text-[#0E7C3A] rounded"
                      />
                      <span className="text-xs font-bold text-[#14201A]">2. Face visually confirmed against physical NIN / ID card</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-[#F9FAF9] rounded-xl border border-[#DDE3DF] cursor-pointer hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={verificationChecklist.plateMatchesVehicle}
                        onChange={(e) => setVerificationChecklist({ ...verificationChecklist, plateMatchesVehicle: e.target.checked })}
                        className="w-4 h-4 text-[#0E7C3A] rounded"
                      />
                      <span className="text-xs font-bold text-[#14201A]">3. Vehicle plate ({selectedDriverApp.vehiclePlate}) matches physical vehicle</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-[#F9FAF9] rounded-xl border border-[#DDE3DF] cursor-pointer hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={verificationChecklist.parkLeaderKnown}
                        onChange={(e) => setVerificationChecklist({ ...verificationChecklist, parkLeaderKnown: e.target.checked })}
                        className="w-4 h-4 text-[#0E7C3A] rounded"
                      />
                      <span className="text-xs font-bold text-[#14201A]">4. Park Leader / Union Representative vouching confirmed</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-[#E6F4EC] rounded-2xl border border-[#0E7C3A]/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#0E7C3A]">
                    <CheckCircle2 size={18} />
                    <span className="text-xs font-bold">This driver has completed in-person inspection and is an active member of the campus fleet.</span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#0E7C3A]">Rating: ★ {selectedDriverApp.rating || '5.0'}</span>
                </div>
              )}            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-[#DDE3DF] bg-white flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setSelectedDriverApp(null)}
                className="px-4 py-2.5 bg-[#F3F6F4] text-xs font-bold rounded-xl hover:bg-[#E5E9E7] transition-colors"
              >
                Close Dossier
              </button>

              {(selectedDriverApp.status === 'pending' || !selectedDriverApp.isApproved) ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={async () => {
                      if (confirm(`Permanently delete driver registration for ${selectedDriverApp.applicantName || selectedDriverApp.name}? This action cannot be undone.`)) {
                        await adminFetch(`/api/admin/drivers/${selectedDriverApp.id}`, { method: 'DELETE' });
                        setSelectedDriverApp(null);
                        refreshAllData();
                      }
                    }}
                    className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-[#D93A3A] text-xs font-bold rounded-xl border border-rose-200 transition-colors"
                  >
                    Delete Registration
                  </button>

                  <button
                    onClick={async () => {
                      const reason = prompt(`Reason for rejecting applicant ${selectedDriverApp.applicantName || selectedDriverApp.name} (will be sent via SMS):`);
                      if (reason) {
                        await adminFetch(`/api/admin/drivers/${selectedDriverApp.id}/reject`, {
                          method: 'POST',
                          body: JSON.stringify({ reason }),
                        });
                        setSelectedDriverApp(null);
                        refreshAllData();
                      }
                    }}
                    className="px-4 py-2.5 bg-[#FDE8E8] text-[#D93A3A] hover:bg-[#FCD4D4] text-xs font-bold rounded-xl transition-colors"
                  >
                    Reject Application
                  </button>

                  <button
                    onClick={async () => {
                      await adminFetch(`/api/admin/drivers/${selectedDriverApp.id}/approve`, {
                        method: 'POST',
                        body: JSON.stringify({
                          checklist: {
                            metInPerson: true,
                            faceMatchesId: true,
                            plateMatchesVehicle: true,
                            parkLeaderKnown: true,
                          },
                        }),
                      });
                      setSelectedDriverApp(null);
                      refreshAllData();
                    }}
                    className="px-4 py-2.5 bg-[#0E7C3A] hover:bg-[#0A632E] text-white text-xs font-bold rounded-xl shadow transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={15} /> 1-Click Approve (Verify All) &rarr;
                  </button>

                  <button
                    disabled={
                      !verificationChecklist.metInPerson ||
                      !verificationChecklist.faceMatchesId ||
                      !verificationChecklist.plateMatchesVehicle ||
                      !verificationChecklist.parkLeaderKnown
                    }
                    onClick={async () => {
                      await adminFetch(`/api/admin/drivers/${selectedDriverApp.id}/approve`, {
                        method: 'POST',
                        body: JSON.stringify({ checklist: verificationChecklist }),
                      });
                      setSelectedDriverApp(null);
                      refreshAllData();
                    }}
                    className="px-4 py-2.5 bg-[#0E7C3A] disabled:bg-[#DDE3DF] disabled:text-[#7A857F] text-white text-xs font-bold rounded-xl shadow hover:bg-[#0b632e] transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={15} /> Approve Driver (Checklist) &rarr;
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (confirm(`Permanently delete driver registration for ${selectedDriverApp.name || selectedDriverApp.applicantName}? This action cannot be undone.`)) {
                        await adminFetch(`/api/admin/drivers/${selectedDriverApp.id}`, { method: 'DELETE' });
                        setSelectedDriverApp(null);
                        refreshAllData();
                      }
                    }}
                    className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-[#D93A3A] text-xs font-bold rounded-xl border border-rose-200 transition-colors"
                  >
                    Delete Driver Registration
                  </button>
                  <button
                    onClick={() => handleDownloadAllDossier(selectedDriverApp)}
                    className="px-4 py-2.5 bg-[#0E7C3A] text-white text-xs font-bold rounded-xl shadow hover:bg-[#0b632e] transition-colors flex items-center gap-1.5"
                  >
                    <Download size={14} /> Download All Files
                  </button>
                </div>
              )}            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DOCUMENT PREVIEW & PDF LIGHTBOX MODAL */}
      {/* ============================================================== */}
      {previewDocModal && previewDocModal.isOpen && (
        <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-5">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[95vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-[#DDE3DF]">
            {/* Header */}
            <div className="p-3.5 sm:p-4 border-b border-[#DDE3DF] flex items-center justify-between bg-white gap-2">
              <div className="truncate">
                <h4 className="font-bold text-sm text-[#14201A] truncate">{previewDocModal.title}</h4>
                <p className="text-[11px] text-[#7A857F] truncate">
                  {previewDocModal.filename} {previewDocModal.fileSize && `· ${previewDocModal.fileSize}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleDownloadDocument(previewDocModal.url, previewDocModal.filename)}
                  className="px-3 py-1.5 bg-[#0E7C3A] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow hover:bg-[#0b632e] transition-colors"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Download File</span>
                </button>
                <button
                  onClick={() => setPreviewDocModal(null)}
                  className="p-1.5 rounded-full hover:bg-[#F3F6F4] text-[#7A857F] hover:text-[#14201A] transition-colors"
                >
                  <CloseIcon size={20} />
                </button>
              </div>
            </div>

            {/* Viewer Body */}
            <div className="p-2 sm:p-4 flex-1 overflow-auto bg-[#F9FAF9] flex items-center justify-center min-h-[300px] sm:min-h-[460px]">
              {previewDocModal.url.startsWith('data:application/pdf') ||
              previewDocModal.fileType?.includes('pdf') ||
              previewDocModal.filename.toLowerCase().endsWith('.pdf') ? (
                <div className="w-full h-full min-h-[500px] flex flex-col">
                  <iframe
                    src={previewDocModal.url}
                    title={previewDocModal.title}
                    className="w-full flex-1 min-h-[520px] rounded-2xl border border-[#DDE3DF] bg-white shadow-inner"
                  />
                  <p className="text-center text-[11px] text-[#7A857F] mt-2">
                    Tip: If your browser blocks inline PDF previews, click "Download File" above to view it in your local reader.
                  </p>
                </div>
              ) : (
                <img
                  src={previewDocModal.url}
                  alt={previewDocModal.title}
                  className="max-h-[72vh] max-w-full object-contain rounded-2xl shadow-lg border border-[#DDE3DF]"
                />
              )}            </div>
          </div>
        </div>
      )}



      {/* Reassign Ride Modal */}
      {reassignModalRide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-black text-[#14201A] mb-1">Reassign Ride #{reassignModalRide.id.slice(-6)}</h3>
            <p className="text-xs text-[#7A857F] mb-4">
              Select a new driver to immediately re-route this trip ({reassignModalRide.pickupName} &rarr; {reassignModalRide.dropoffName}).
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">New Driver</label>
                <select
                  value={reassignDriverId}
                  onChange={(e) => setReassignDriverId(e.target.value)}
                  className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#14201A]"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.vehicleCategory}) · {d.vehiclePlate} [{d.isOnline ? 'Online' : 'Offline'}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Reason for Reassignment</label>
                <input
                  type="text"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Driver vehicle puncture / rider request"
                  className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setReassignModalRide(null)}
                className="flex-1 py-2.5 bg-[#F3F6F4] text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!reassignDriverId) return;
                  await adminFetch(`/api/admin/rides/${reassignModalRide.id}/reassign`, {
                    method: 'POST',
                    body: JSON.stringify({ newDriverId: reassignDriverId, reason: reassignReason }),
                  });
                  setReassignModalRide(null);
                  refreshAllData();
                }}
                className="flex-1 py-2.5 bg-[#2563EB] text-white text-xs font-bold rounded-xl shadow"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Rider Account Modal */}
      {blockingRider && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[#DDE3DF]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-[#FDE8E8] text-[#D93A3A] flex items-center justify-center font-bold">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#14201A]">Block Passenger Account</h3>
                <p className="text-xs text-[#7A857F]">{blockingRider.name} ({blockingRider.phone})</p>
              </div>
            </div>
            <p className="text-xs text-[#3E4A43] mb-4 mt-2">
              Blocking restricts this user from hailing any campus rides until unblocked by an operations officer. Please provide a formal reason.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1.5">Official Reason for Suspension</label>
              <textarea
                rows={3}
                value={blockReasonInput}
                onChange={(e) => setBlockReasonInput(e.target.value)}
                placeholder="e.g. Failure to pay fare, safety dispute, or abusive conduct..."
                className="w-full p-3 bg-[#F4F6F5] rounded-xl border border-[#DDE3DF] text-xs font-medium outline-none focus:bg-white focus:border-[#D93A3A] transition-all"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setBlockingRider(null)}
                className="flex-1 py-2.5 bg-[#F4F6F5] hover:bg-[#EAEFEA] text-xs font-bold rounded-xl text-[#14201A] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!blockReasonInput.trim()) return;
                  await adminFetch(`/api/admin/riders/${blockingRider.id}/block`, {
                    method: 'POST',
                    body: JSON.stringify({ reason: blockReasonInput }),
                  });
                  setBlockingRider(null);
                  refreshAllData();
                }}
                disabled={!blockReasonInput.trim()}
                className="flex-1 py-2.5 bg-[#D93A3A] hover:bg-[#b82e2e] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Confirm Account Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Reconcile Audit Modal */}
      {reconcilingDriver && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[#DDE3DF]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center font-bold">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#14201A]">Reconcile Cash Audit</h3>
                <p className="text-xs text-[#7A857F]">{reconcilingDriver.driverName} · {reconcilingDriver.plate}</p>
              </div>
            </div>

            <div className="p-3 bg-[#F4F6F5] rounded-2xl my-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#7A857F] block">Total Driver Cash Retained</span>
                <span className="text-lg font-black text-[#0E7C3A]">₦{(reconcilingDriver.amount || 0).toLocaleString()}</span>
              </div>
              <span className="text-[10px] font-bold bg-[#E6F4EC] text-[#0E7C3A] px-2 py-0.5 rounded-full border border-[#0E7C3A]/20">
                0% Commission Policy
              </span>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1.5">Audit Note / Verification Station</label>
              <input
                type="text"
                value={reconcileNotesInput}
                onChange={(e) => setReconcileNotesInput(e.target.value)}
                placeholder="e.g. In-person physical audit confirmed at School Motor Park"
                className="w-full p-3 bg-[#F4F6F5] rounded-xl border border-[#DDE3DF] text-xs font-medium outline-none focus:bg-white focus:border-[#0E7C3A] transition-all"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setReconcilingDriver(null)}
                className="flex-1 py-2.5 bg-[#F4F6F5] hover:bg-[#EAEFEA] text-xs font-bold rounded-xl text-[#14201A] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await adminFetch('/api/admin/cash/mark-paid', {
                    method: 'POST',
                    body: JSON.stringify({
                      driverId: reconcilingDriver.driverId,
                      amount: reconcilingDriver.amount,
                      notes: reconcileNotesInput || 'Reconciled by operations officer',
                    }),
                  });
                  setReconcilingDriver(null);
                  refreshAllData();
                }}
                className="flex-1 py-2.5 bg-[#0E7C3A] hover:bg-[#0c6b32] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Confirm Reconciled
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit or Add Route Fare Modal */}
      {(editingFareRule || isNewRouteModal) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-[#DDE3DF] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center font-bold">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#14201A]">
                  {isNewRouteModal ? 'Add New Campus Route' : 'Edit Route Rates & Zones'}
                </h3>
                <p className="text-xs text-[#7A857F]">
                  {isNewRouteModal
                    ? 'Configure a new origin-destination route and fixed fares'
                    : `${editingFareRule?.fromZone} ↔ ${editingFareRule?.toZone}`}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#3E4A43] mb-4 mt-2">
              Update deterministic zone rates. Changes apply immediately to all active dispatch and trip pricing across campus.
            </p>

            <div className="space-y-3 mb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Origin Campus Zone</label>
                  <input
                    type="text"
                    list="admin-campus-locations"
                    placeholder="e.g. Main Campus Gate, Hostels"
                    value={fareEditFromZone}
                    onChange={(e) => setFareEditFromZone(e.target.value)}
                    className="w-full p-3 bg-[#F4F6F5] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#14201A] outline-none focus:bg-white focus:border-[#0E7C3A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Destination Campus Zone</label>
                  <input
                    type="text"
                    list="admin-campus-locations"
                    placeholder="e.g. Student Hostels, SEET, Senate"
                    value={fareEditToZone}
                    onChange={(e) => setFareEditToZone(e.target.value)}
                    className="w-full p-3 bg-[#F4F6F5] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#14201A] outline-none focus:bg-white focus:border-[#0E7C3A]"
                  />
                </div>
              </div>

              {/* Autocomplete Datalist for Campus Locations */}
              <datalist id="admin-campus-locations">
                {FUTMINNA_KEY_LOCATIONS.map((loc) => (
                  <option key={loc.id} value={loc.name} />
                ))}
                <option value="Main Campus Gate" />
                <option value="School Motor Park" />
                <option value="Student Hostels" />
                <option value="Senate Building" />
                <option value="University Central Library" />
                <option value="SEET Complex" />
                <option value="SAAT Complex" />
                <option value="Gidan Kwanu Village" />
                <option value="Bosso Campus" />
                <option value="Kpakungu Station" />
                <option value="Minna Central Market" />
              </datalist>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#7A857F] mb-1">Keke Napep (₦)</label>
                  <input
                    type="number"
                    value={fareEditKeke}
                    onChange={(e) => setFareEditKeke(e.target.value)}
                    className="w-full p-3 bg-[#F4F6F5] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#0E7C3A] outline-none focus:bg-white focus:border-[#0E7C3A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#7A857F] mb-1">Okada Bike (₦)</label>
                  <input
                    type="number"
                    value={fareEditOkada}
                    onChange={(e) => setFareEditOkada(e.target.value)}
                    className="w-full p-3 bg-[#F4F6F5] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#0E7C3A] outline-none focus:bg-white focus:border-[#0E7C3A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#7A857F] mb-1">Car Shuttle (₦)</label>
                  <input
                    type="number"
                    value={fareEditCar}
                    onChange={(e) => setFareEditCar(e.target.value)}
                    className="w-full p-3 bg-[#F4F6F5] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#0E7C3A] outline-none focus:bg-white focus:border-[#0E7C3A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#7A857F] mb-1">Small Bus (₦)</label>
                  <input
                    type="number"
                    value={fareEditSmallBus}
                    onChange={(e) => setFareEditSmallBus(e.target.value)}
                    className="w-full p-3 bg-[#F4F6F5] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#0E7C3A] outline-none focus:bg-white focus:border-[#0E7C3A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#7A857F] mb-1">Big Bus (₦)</label>
                  <input
                    type="number"
                    value={fareEditBigBus}
                    onChange={(e) => setFareEditBigBus(e.target.value)}
                    className="w-full p-3 bg-[#F4F6F5] rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#0E7C3A] outline-none focus:bg-white focus:border-[#0E7C3A]"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingFareRule(null);
                  setIsNewRouteModal(false);
                }}
                className="flex-1 py-2.5 bg-[#F4F6F5] hover:bg-[#EAEFEA] text-xs font-bold rounded-xl text-[#14201A] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!fareEditFromZone.trim() || !fareEditToZone.trim()) {
                    alert('Please enter both Origin and Destination campus zones');
                    return;
                  }
                  try {
                    const res = await adminFetch('/api/admin/fares', {
                      method: 'POST',
                      body: JSON.stringify({
                        originalFromZone: editingFareRule ? editingFareRule.fromZone : undefined,
                        originalToZone: editingFareRule ? editingFareRule.toZone : undefined,
                        fromZone: fareEditFromZone.trim(),
                        toZone: fareEditToZone.trim(),
                        kekeFare: Number(fareEditKeke) || 0,
                        okadaFare: Number(fareEditOkada) || 0,
                        carFare: Number(fareEditCar) || 0,
                        smallBusFare: Number(fareEditSmallBus) || 0,
                        bigBusFare: Number(fareEditBigBus) || 0,
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setEditingFareRule(null);
                      setIsNewRouteModal(false);
                      playKerbSound('success');
                      refreshAllData();
                    } else {
                      alert(data.error || 'Failed to save route fares');
                    }
                  } catch (e: any) {
                    alert(e.message || 'Error saving route fares');
                  }
                }}
                className="flex-1 py-2.5 bg-[#0E7C3A] hover:bg-[#0c6b32] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{isNewRouteModal ? 'Add Campus Route' : 'Save Route Fares'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Support Ticket Modal */}
      {resolvingTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[#DDE3DF]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#14201A]">Resolve Support Ticket</h3>
                <p className="text-xs text-[#7A857F]">{resolvingTicket.subject}</p>
              </div>
            </div>

            <div className="mb-4 mt-3">
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1.5">Resolution Outcome / Summary</label>
              <textarea
                rows={3}
                value={ticketResolutionInput}
                onChange={(e) => setTicketResolutionInput(e.target.value)}
                placeholder="Describe how the passenger's inquiry or issue was settled..."
                className="w-full p-3 bg-[#F4F6F5] rounded-xl border border-[#DDE3DF] text-xs font-medium outline-none focus:bg-white focus:border-[#0E7C3A] transition-all"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setResolvingTicket(null)}
                className="flex-1 py-2.5 bg-[#F4F6F5] hover:bg-[#EAEFEA] text-xs font-bold rounded-xl text-[#14201A] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!ticketResolutionInput.trim()) return;
                  await adminFetch(`/api/admin/support/tickets/${resolvingTicket.id}/resolve`, {
                    method: 'POST',
                    body: JSON.stringify({ resolutionNote: ticketResolutionInput }),
                  });
                  setResolvingTicket(null);
                  refreshAllData();
                }}
                disabled={!ticketResolutionInput.trim()}
                className="flex-1 py-2.5 bg-[#0E7C3A] hover:bg-[#0c6b32] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Ride Modal */}
      {cancelModalRide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-black text-[#14201A] mb-1">Cancel Ride #{cancelModalRide.id.slice(-6)}</h3>
            <p className="text-xs text-[#7A857F] mb-4">
              Cancelling a ride notifies both passenger and driver and logs the action to the audit trail.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase text-[#7A857F] mb-1">Cancellation Reason</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation..."
                className="w-full p-3 bg-[#F3F6F4] rounded-xl border border-[#DDE3DF] text-xs font-medium"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCancelModalRide(null)}
                className="flex-1 py-2.5 bg-[#F3F6F4] text-xs font-bold rounded-xl"
              >
                Back
              </button>
              <button
                onClick={async () => {
                  await adminFetch(`/api/admin/rides/${cancelModalRide.id}/cancel`, {
                    method: 'POST',
                    body: JSON.stringify({ reason: cancelReason }),
                  });
                  setCancelModalRide(null);
                  refreshAllData();
                }}
                className="flex-1 py-2.5 bg-[#D93A3A] text-white text-xs font-bold rounded-xl shadow"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ride Timeline Drawer */}
      {selectedRide && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 max-w-full bg-white shadow-2xl z-50 p-5 sm:p-6 flex flex-col justify-between overflow-y-auto animate-slideLeft">
          <div>
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h3 className="font-black text-base text-[#14201A]">Ride Lifecycle Timeline</h3>
              <button onClick={() => setSelectedRide(null)} className="p-1 rounded-full text-[#7A857F] hover:text-[#14201A]">
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-3 bg-[#F3F6F4] rounded-2xl">
                <p className="text-xs font-bold text-[#14201A]">{selectedRide.pickupName} &rarr; {selectedRide.dropoffName}</p>
                <p className="text-xs text-[#0E7C3A] font-black mt-1">₦{selectedRide.fareNaira} Cash · PIN {selectedRide.safetyPin}</p>
              </div>

              {/* 7-Step Vertical Timeline */}
              <div className="border-l-2 border-[#0E7C3A] ml-3 pl-4 space-y-4">
                {(selectedRide.timeline || [
                  { step: 'requested', timestamp: selectedRide.createdAt, note: 'Rider booked trip' },
                  { step: 'accepted', timestamp: selectedRide.acceptedAt || selectedRide.createdAt, note: `Accepted by ${selectedRide.driverName || 'driver'}` },
                ]).map((step: any, idx: number) => (
                  <div key={idx} className="relative">
                    <span className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-[#0E7C3A] border-2 border-white" />
                    <p className="text-xs font-black uppercase text-[#14201A]">{step.step}</p>
                    <p className="text-[11px] text-[#3E4A43]">{step.note}</p>
                    <span className="text-[9px] text-[#7A857F]">{new Date(step.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t space-y-2">
            <button
              onClick={() => handleDeleteRide(selectedRide.id)}
              className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-[#D93A3A] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-rose-200"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Ride Record</span>
            </button>
            <button onClick={() => setSelectedRide(null)} className="w-full py-2.5 bg-[#F3F6F4] hover:bg-[#E5E9E7] text-xs font-bold rounded-xl cursor-pointer transition-colors">
              Close
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CREATE STAFF MODAL (SUPER ADMIN ONLY) */}
      {/* ============================================================== */}
      {isCreateStaffModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-[#DDE3DF] my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#DDE3DF] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E6F4EC] text-[#0E7C3A] flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-[#14201A]">Create New Staff Account</h3>
                  <p className="text-[11px] text-[#7A857F]">Add authorized team member to Zylift HQ</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateStaffModalOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {staffActionError && (
              <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{staffActionError}</span>
              </div>
            )}
            <form onSubmit={handleCreateStaff} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-[#3E4A43] uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g. Fatima Bello"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDE3DF] text-xs focus:outline-none focus:border-[#0E7C3A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#3E4A43] uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="e.g. fatima@zylift.futminna.edu.ng"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDE3DF] text-xs focus:outline-none focus:border-[#0E7C3A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#3E4A43] uppercase mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  placeholder="+234 803 000 0000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDE3DF] text-xs focus:outline-none focus:border-[#0E7C3A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#3E4A43] uppercase mb-1">Operational Role</label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as StaffRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDE3DF] text-xs focus:outline-none focus:border-[#0E7C3A] bg-white cursor-pointer"
                >
                  <option value="operations">Operations Manager</option>
                  <option value="school_security">Campus Security Lead</option>
                  <option value="support">Customer Support Lead</option>
                  <option value="viewer">Student Affairs Auditor (View Only)</option>
                </select>
                <p className="text-[10px] text-[#7A857F] mt-1 italic">
                  * Note: Only one Superadmin account exists by design. Staff accounts are granted specific operational roles.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#3E4A43] uppercase mb-1">Password</label>
                  <input
                    type="text"
                    required
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    placeholder="Min 4 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDE3DF] text-xs focus:outline-none focus:border-[#0E7C3A] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#3E4A43] uppercase mb-1">6-Digit 2FA PIN</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={newStaffPin}
                    onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 123456"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDE3DF] text-xs focus:outline-none focus:border-[#0E7C3A] font-mono text-center tracking-widest font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateStaffModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#DDE3DF] text-xs font-bold text-[#3E4A43] hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="flex-1 py-2.5 rounded-xl bg-[#0E7C3A] text-white text-xs font-bold hover:bg-[#14532D] shadow-md shadow-[#0E7C3A]/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingStaff ? 'Creating...' : 'Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
