import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  AlertCircle,
  BedDouble,
  Building,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileEdit,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Search,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { apiRequest, formatDateShort, formatINR } from '../lib/api.ts';
import type {
  AdminOverviewData,
  AuthUser,
  Bed,
  Complaint,
  MessMenuDay,
  Room,
} from '../types.ts';
import { ResilientImage } from './ResilientImage.tsx';

interface AdminDashboardProps {
  user: AuthUser;
  onLogout: () => void;
  onBackToSite: () => void;
}

type AdminTab =
  | 'overview'
  | 'rooms'
  | 'tenants'
  | 'billing'
  | 'complaints'
  | 'inquiries'
  | 'cms';

export function AdminDashboard({
  user,
  onLogout,
  onBackToSite,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Room Add/Edit modals
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({
    room_number: '',
    floor: 1,
    sharing_type: 'Double' as 'Single' | 'Double' | 'Triple',
    ac_type: 'AC' as 'AC' | 'Non-AC',
    monthly_rent: 11500,
    security_deposit: 20000,
    description: '',
    amenities_list: 'Split AC, Study Desk, Attached Bath, 200 Mbps Wi-Fi',
  });
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [assigningBed, setAssigningBed] = useState<{
    bed: Bed;
    roomNumber: string;
  } | null>(null);
  const [selectedTenantForBed, setSelectedTenantForBed] = useState<string>('');

  // Tenant Onboarding & Search
  const [tenantSearch, setTenantSearch] = useState('');
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [newTenant, setNewTenant] = useState({
    full_name: '',
    email: '',
    phone: '',
    kyc_id_type: 'Aadhaar',
    kyc_id_number: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    occupation_or_college: '',
    check_in_date: new Date().toISOString().slice(0, 10),
    security_deposit_paid: 20000,
    bed_id: '',
  });

  // Billing & Expenses
  const [invoiceFilter, setInvoiceFilter] = useState<string>('All');
  const [billingMonth, setBillingMonth] = useState('2026-12');
  const [electricityFlat, setElectricityFlat] = useState(550);
  const [newExpense, setNewExpense] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category: 'Groceries & Mess',
    description: '',
    amount: '',
  });

  // Complaints
  const [complaintFilter, setComplaintFilter] = useState<string>('All');
  const [editingComplaint, setEditingComplaint] = useState<Complaint | null>(null);

  // CMS & Mess Menu & Announcements & Gallery
  const [cmsDraft, setCmsDraft] = useState<Record<string, string>>({});
  const [menuDrafts, setMenuDrafts] = useState<Record<string, MessMenuDay>>({});
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    body: '',
    audience: 'Public & Residents',
    pinned: false,
  });
  const [newPhoto, setNewPhoto] = useState({
    title: '',
    category: 'Rooms',
    image_url: '/src/assets/images/room_double_sharing_1794555050160.jpg',
    caption: '',
  });

  function showSuccess(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadOverview() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<AdminOverviewData>('/api/admin/overview');
      setData(res);
      setCmsDraft(res.cms);
      const menuMap: Record<string, MessMenuDay> = {};
      for (const m of res.messMenu) {
        menuMap[m.day_of_week] = { ...m };
      }
      setMenuDrafts(menuMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  const vacantBedsList = useMemo(() => {
    if (!data) return [];
    const list: Array<{ bedId: number; label: string }> = [];
    for (const r of data.rooms) {
      for (const b of r.beds) {
        if (b.status === 'Vacant') {
          list.push({
            bedId: b.id,
            label: `Room ${r.room_number} · Bed ${b.bed_label} (${r.sharing_type} ${r.ac_type} · ${formatINR(r.monthly_rent)})`,
          });
        }
      }
    }
    return list;
  }, [data]);

  const unassignedActiveTenants = useMemo(() => {
    if (!data) return [];
    return data.tenants.filter((t) => t.status === 'Active' && !t.bed_id);
  }, [data]);

  const filteredTenants = useMemo(() => {
    if (!data) return [];
    const q = tenantSearch.trim().toLowerCase();
    if (!q) return data.tenants;
    return data.tenants.filter(
      (t) =>
        t.full_name.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q) ||
        (t.room_number || '').toLowerCase().includes(q) ||
        t.kyc_id_number.toLowerCase().includes(q)
    );
  }, [data, tenantSearch]);

  const filteredInvoices = useMemo(() => {
    if (!data) return [];
    if (invoiceFilter === 'All') return data.invoices;
    return data.invoices.filter((i) => i.status === invoiceFilter);
  }, [data, invoiceFilter]);

  const filteredComplaints = useMemo(() => {
    if (!data) return [];
    if (complaintFilter === 'All') return data.complaints;
    return data.complaints.filter((c) => c.status === complaintFilter);
  }, [data, complaintFilter]);

  // Handlers
  async function handleCreateRoom(e: FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/rooms', {
        method: 'POST',
        body: JSON.stringify(newRoom),
      });
      setShowAddRoom(false);
      setNewRoom({ ...newRoom, room_number: '' });
      await loadOverview();
      showSuccess('Room and beds added to inventory.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add room.');
    }
  }

  async function handleSaveRoomEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRoom) return;
    try {
      await apiRequest(`/api/admin/rooms/${editingRoom.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          monthly_rent: editingRoom.monthly_rent,
          security_deposit: editingRoom.security_deposit,
          ac_type: editingRoom.ac_type,
          description: editingRoom.description,
          image_url: editingRoom.image_url,
          amenities_list: editingRoom.amenities_list,
          status: editingRoom.status,
        }),
      });
      setEditingRoom(null);
      await loadOverview();
      showSuccess('Room details updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update room.');
    }
  }

  async function handleAssignBed() {
    if (!assigningBed || !selectedTenantForBed) return;
    try {
      await apiRequest(`/api/admin/beds/${assigningBed.bed.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ tenant_id: Number(selectedTenantForBed) }),
      });
      setAssigningBed(null);
      setSelectedTenantForBed('');
      await loadOverview();
      showSuccess('Resident assigned to bed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to assign bed.');
    }
  }

  async function handleVacateBed(bedId: number) {
    try {
      await apiRequest(`/api/admin/beds/${bedId}/vacate`, { method: 'POST' });
      await loadOverview();
      showSuccess('Bed marked vacant.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to vacate bed.');
    }
  }

  async function handleOnboardTenant(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await apiRequest<{ defaultPortalPassword: string }>(
        '/api/admin/tenants',
        {
          method: 'POST',
          body: JSON.stringify({
            ...newTenant,
            bed_id: newTenant.bed_id ? Number(newTenant.bed_id) : null,
          }),
        }
      );
      setShowAddTenant(false);
      setNewTenant({
        full_name: '',
        email: '',
        phone: '',
        kyc_id_type: 'Aadhaar',
        kyc_id_number: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        occupation_or_college: '',
        check_in_date: new Date().toISOString().slice(0, 10),
        security_deposit_paid: 20000,
        bed_id: '',
      });
      await loadOverview();
      showSuccess(
        `Tenant onboarded. Portal login provisioned (password: ${res.defaultPortalPassword}).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to onboard tenant.');
    }
  }

  async function handleCheckoutTenant(tenantId: number) {
    try {
      await apiRequest(`/api/admin/tenants/${tenantId}/checkout`, {
        method: 'POST',
      });
      await loadOverview();
      showSuccess('Tenant checked out and bed released automatically.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check out.');
    }
  }

  async function handleGenerateInvoices() {
    try {
      const res = await apiRequest<{ created: number; billing_month: string }>(
        '/api/admin/invoices/generate',
        {
          method: 'POST',
          body: JSON.stringify({
            billing_month: billingMonth,
            electricity_amount: electricityFlat,
          }),
        }
      );
      await loadOverview();
      showSuccess(
        `Generated ${res.created} rent invoices for ${res.billing_month}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invoices.');
    }
  }

  async function handleMarkInvoicePaid(invoiceId: number) {
    try {
      await apiRequest(`/api/admin/invoices/${invoiceId}/pay`, {
        method: 'PATCH',
        body: JSON.stringify({ payment_method: 'UPI / Bank' }),
      });
      await loadOverview();
      showSuccess('Invoice marked as Paid.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update invoice.');
    }
  }

  async function handleAddExpense(e: FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/expenses', {
        method: 'POST',
        body: JSON.stringify({
          ...newExpense,
          amount: Number(newExpense.amount),
        }),
      });
      setNewExpense({ ...newExpense, description: '', amount: '' });
      await loadOverview();
      showSuccess('Daily expense recorded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record expense.');
    }
  }

  async function handleDeleteExpense(id: number) {
    try {
      await apiRequest(`/api/admin/expenses/${id}`, { method: 'DELETE' });
      await loadOverview();
      showSuccess('Expense removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove expense.');
    }
  }

  async function handleUpdateComplaint(e: FormEvent) {
    e.preventDefault();
    if (!editingComplaint) return;
    try {
      await apiRequest(`/api/admin/complaints/${editingComplaint.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: editingComplaint.status,
          assigned_to: editingComplaint.assigned_to,
          admin_notes: editingComplaint.admin_notes,
        }),
      });
      setEditingComplaint(null);
      await loadOverview();
      showSuccess('Complaint status updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update complaint.');
    }
  }

  async function handleUpdateInquiryStatus(id: number, status: string) {
    try {
      await apiRequest(`/api/admin/inquiries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadOverview();
      showSuccess('Inquiry status updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update inquiry.');
    }
  }

  async function handleSaveCms(e: FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/cms', {
        method: 'PUT',
        body: JSON.stringify(cmsDraft),
      });
      await loadOverview();
      showSuccess('Public website copy updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save CMS copy.');
    }
  }

  async function handleSaveMenuDay(day: string) {
    const draft = menuDrafts[day];
    if (!draft) return;
    try {
      await apiRequest(`/api/admin/mess-menu/${day}`, {
        method: 'PUT',
        body: JSON.stringify(draft),
      });
      await loadOverview();
      showSuccess(`${day} mess menu updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save menu.');
    }
  }

  async function handlePublishAnnouncement(e: FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify(newAnnouncement),
      });
      setNewAnnouncement({
        title: '',
        body: '',
        audience: 'Public & Residents',
        pinned: false,
      });
      await loadOverview();
      showSuccess('Announcement published.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to publish announcement.'
      );
    }
  }

  async function handleDeleteAnnouncement(id: number) {
    try {
      await apiRequest(`/api/admin/announcements/${id}`, { method: 'DELETE' });
      await loadOverview();
      showSuccess('Announcement removed.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to delete announcement.'
      );
    }
  }

  function handleGalleryFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewPhoto((prev) => ({ ...prev, image_url: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleAddGalleryPhoto(e: FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/gallery', {
        method: 'POST',
        body: JSON.stringify(newPhoto),
      });
      setNewPhoto({
        title: '',
        category: 'Rooms',
        image_url: '/src/assets/images/room_double_sharing_1794555050160.jpg',
        caption: '',
      });
      await loadOverview();
      showSuccess('Gallery photo added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add photo.');
    }
  }

  async function handleDeleteGalleryPhoto(id: number) {
    try {
      await apiRequest(`/api/admin/gallery/${id}`, { method: 'DELETE' });
      await loadOverview();
      showSuccess('Gallery photo removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove photo.');
    }
  }

  const navItems: Array<{
    id: AdminTab;
    label: string;
    icon: typeof LayoutDashboard;
  }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'rooms', label: 'Rooms & Beds', icon: BedDouble },
    { id: 'tenants', label: 'Tenants & KYC', icon: Users },
    { id: 'billing', label: 'Rent & Expenses', icon: Receipt },
    { id: 'complaints', label: 'Complaints', icon: Wrench },
    { id: 'inquiries', label: 'Visit Inquiries', icon: ClipboardList },
    { id: 'cms', label: 'CMS & Mess Menu', icon: FileEdit },
  ];

  const activeNavLabel =
    navItems.find((n) => n.id === activeTab)?.label || 'Overview';

  const pendingOrOverdueInvoices = useMemo(
    () => (data ? data.invoices.filter((i) => i.status !== 'Paid') : []),
    [data]
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-white border-r border-slate-200 flex-col shrink-0">
        <div className="h-16 px-5 border-b border-slate-200 flex items-center gap-2">
          <Building className="w-4 h-4 text-blue-700 shrink-0" />
          <span className="font-display text-base font-bold text-slate-900 truncate">
            Kora Admin
          </span>
        </div>

        <nav className="p-3 flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-slate-200">
          <div className="text-xs font-semibold text-slate-900 truncate">
            {user.fullName}
          </div>
          <div className="text-xs text-slate-500 truncate">{user.email}</div>
        </div>
      </aside>

      {/* Mobile Drawer Navigation */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full border-r border-slate-200 flex flex-col z-10">
            <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-700 shrink-0" />
                <span className="font-display text-base font-bold text-slate-900">
                  Kora Admin
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="p-3 flex flex-col gap-1 flex-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileDrawerOpen(false);
                    }}
                    className={`flex items-center gap-3 min-h-[44px] px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-200 space-y-3">
              <div>
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {user.fullName}
                </div>
                <div className="text-xs text-slate-500 truncate">{user.email}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onBackToSite}
                  className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg"
                >
                  Public Site
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-14 lg:h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open admin menu"
              className="lg:hidden min-w-[40px] min-h-[40px] -ml-2 inline-flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-slate-500 flex items-center gap-2 truncate">
              <span className="hidden sm:inline font-medium text-slate-700">
                Admin Console
              </span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 truncate">
                {activeNavLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Public Website</span>
              <span className="sm:hidden">Site</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="hidden sm:inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {toast && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toast}</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-xs font-semibold underline cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {loading || !data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse"
                  />
                ))}
              </div>
              <div className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs font-medium text-slate-500">
                        Bed Occupancy
                      </div>
                      <div className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
                        {data.kpis.occupiedBeds} / {data.kpis.totalBeds} beds (
                        {data.kpis.occupancyRate}%)
                      </div>
                      <div className="mt-1 text-xs text-emerald-700 font-medium tabular-nums">
                        {data.kpis.vacantBeds} beds vacant
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs font-medium text-slate-500">
                        Rent Collected
                      </div>
                      <div className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
                        {formatINR(data.kpis.collectedRevenue)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 tabular-nums">
                        Expenses logged: {formatINR(data.kpis.totalExpenses)}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs font-medium text-slate-500">
                        Pending & Overdue Dues
                      </div>
                      <div className="mt-2 font-display text-2xl font-bold text-amber-700 tabular-nums">
                        {formatINR(data.kpis.pendingDues)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {pendingOrOverdueInvoices.length} unpaid invoices
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs font-medium text-slate-500">
                        Active Maintenance Tickets
                      </div>
                      <div className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
                        {data.kpis.openComplaints}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {data.inquiries.filter((q) => q.status === 'New').length}{' '}
                        new visit inquiries
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
                        <h2 className="font-display text-base font-bold text-slate-900">
                          Pending & Overdue Rent Dues
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('billing')}
                          className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer shrink-0"
                        >
                          Open Billing Ledger
                        </button>
                      </div>

                      {/* Mobile Cards */}
                      <div className="md:hidden divide-y divide-slate-200">
                        {pendingOrOverdueInvoices.length === 0 ? (
                          <div className="p-6 text-center text-sm text-slate-500">
                            All generated invoices are settled.
                          </div>
                        ) : (
                          pendingOrOverdueInvoices.map((inv) => (
                            <div
                              key={inv.id}
                              className="p-4 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 truncate">
                                  {inv.tenant_name}
                                </div>
                                <div className="text-xs text-slate-500 font-mono">
                                  Rm {inv.room_number} ·{' '}
                                  <span
                                    className={
                                      inv.status === 'Overdue'
                                        ? 'text-red-600 font-semibold'
                                        : 'text-amber-700 font-semibold'
                                    }
                                  >
                                    {inv.status}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0 space-y-1">
                                <div className="text-sm font-bold text-slate-900 tabular-nums">
                                  {formatINR(inv.total_amount)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleMarkInvoicePaid(inv.id)
                                  }
                                  className="px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-md cursor-pointer"
                                >
                                  Mark Paid
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                              <th className="py-2.5 px-4">Resident</th>
                              <th className="py-2.5 px-4">Room</th>
                              <th className="py-2.5 px-4 text-right">Amount</th>
                              <th className="py-2.5 px-4">Status</th>
                              <th className="py-2.5 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-sm">
                            {pendingOrOverdueInvoices.map((inv) => (
                              <tr key={inv.id}>
                                <td className="py-3 px-4 font-medium text-slate-900">
                                  {inv.tenant_name}
                                </td>
                                <td className="py-3 px-4 font-mono text-xs text-slate-600">
                                  {inv.room_number}
                                </td>
                                <td className="py-3 px-4 text-right tabular-nums font-semibold">
                                  {formatINR(inv.total_amount)}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`text-xs font-semibold ${
                                      inv.status === 'Overdue'
                                        ? 'text-red-600'
                                        : 'text-amber-700'
                                    }`}
                                  >
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleMarkInvoicePaid(inv.id)
                                    }
                                    className="px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-md cursor-pointer"
                                  >
                                    Mark Paid
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {pendingOrOverdueInvoices.length === 0 && (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="py-8 text-center text-slate-500 text-sm"
                                >
                                  All generated invoices are settled.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
                        <h2 className="font-display text-base font-bold text-slate-900">
                          Recent Visit Inquiries
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('inquiries')}
                          className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer shrink-0"
                        >
                          View All
                        </button>
                      </div>
                      <div className="divide-y divide-slate-200">
                        {data.inquiries.slice(0, 4).map((inq) => (
                          <div key={inq.id} className="p-4">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>
                                {inq.preferred_sharing} · {inq.preferred_ac}
                              </span>
                              <span className="font-semibold text-blue-700">
                                {inq.status}
                              </span>
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">
                              {inq.full_name}
                            </div>
                            <div className="text-xs text-slate-600 tabular-nums">
                              {inq.phone} · Visit {formatDateShort(inq.visit_date)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ROOMS & BEDS */}
              {activeTab === 'rooms' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-slate-900">
                        Room & Bed Inventory
                      </h2>
                      <p className="text-sm text-slate-600">
                        Assign residents to specific beds or vacate rooms; public website counts update automatically.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddRoom(true)}
                      className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Room</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                    {data.rooms.map((room) => (
                      <div
                        key={room.id}
                        className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-sm font-bold text-slate-900">
                              Room {room.room_number} · Floor {room.floor}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingRoom(room)}
                              className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                            >
                              Edit Room
                            </button>
                          </div>

                          <div className="mt-1 text-xs text-slate-600">
                            {room.sharing_type} Sharing · {room.ac_type} ·{' '}
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {formatINR(room.monthly_rent)}/mo
                            </span>
                          </div>

                          <div className="mt-4 space-y-2 pt-3 border-t border-slate-100">
                            {room.beds.map((bed) => (
                              <div
                                key={bed.id}
                                className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-slate-50 border border-slate-200/80"
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                                    <span className="font-mono shrink-0">
                                      Bed {bed.bed_label}
                                    </span>
                                    <span
                                      className={
                                        bed.status === 'Occupied'
                                          ? 'text-slate-600 font-normal truncate'
                                          : 'text-emerald-700'
                                      }
                                    >
                                      {bed.status === 'Occupied'
                                        ? bed.tenant_name
                                        : 'Vacant'}
                                    </span>
                                  </div>
                                </div>

                                {bed.status === 'Occupied' ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleVacateBed(bed.id)}
                                    className="min-h-[32px] px-2 text-xs font-medium text-red-600 hover:underline shrink-0 cursor-pointer"
                                  >
                                    Vacate
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAssigningBed({
                                        bed,
                                        roomNumber: room.room_number,
                                      });
                                      setSelectedTenantForBed(
                                        unassignedActiveTenants[0]
                                          ? String(unassignedActiveTenants[0].id)
                                          : ''
                                      );
                                    }}
                                    className="min-h-[32px] px-2 text-xs font-semibold text-blue-700 hover:underline shrink-0 cursor-pointer"
                                  >
                                    Assign
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 tabular-nums">
                          <span>
                            Deposit: {formatINR(room.security_deposit)}
                          </span>
                          <span
                            className={
                              room.vacant_beds > 0
                                ? 'text-emerald-700 font-semibold'
                                : 'text-slate-500'
                            }
                          >
                            {room.vacant_beds} / {room.total_beds} vacant
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: TENANTS & KYC */}
              {activeTab === 'tenants' && (
                <div className="space-y-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-slate-900">
                        Tenant Directory & Digital KYC
                      </h2>
                      <p className="text-sm text-slate-600">
                        Manage resident onboarding, KYC records, emergency contacts, and check-outs.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="relative flex-1 sm:flex-initial">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={tenantSearch}
                          onChange={(e) => setTenantSearch(e.target.value)}
                          placeholder="Search name, phone, room..."
                          className="w-full sm:w-64 pl-9 pr-3.5 py-2 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddTenant(true)}
                        className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Onboard Tenant</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    {/* Mobile Cards */}
                    <div className="md:hidden divide-y divide-slate-200">
                      {filteredTenants.map((t) => (
                        <div key={t.id} className="p-4 space-y-2.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {t.full_name}
                              </div>
                              <div className="text-slate-500">
                                {t.phone} · {t.email}
                              </div>
                            </div>
                            <span
                              className={`font-semibold shrink-0 ${
                                t.status === 'Active'
                                  ? 'text-emerald-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              {t.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 text-slate-700">
                            <div>
                              <span className="text-slate-500">Suite: </span>
                              <span className="font-mono font-medium">
                                {t.room_number
                                  ? `Rm ${t.room_number} · ${t.bed_label}`
                                  : 'Unassigned'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Deposit: </span>
                              <span className="font-semibold tabular-nums">
                                {formatINR(t.security_deposit_paid)} (
                                {t.deposit_status})
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">KYC: </span>
                              <span>
                                {t.kyc_id_type} · {t.kyc_id_number}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Emergency: </span>
                              <span>
                                {t.emergency_contact_name} (
                                {t.emergency_contact_phone})
                              </span>
                            </div>
                          </div>

                          {t.status === 'Active' && (
                            <div className="pt-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => void handleCheckoutTenant(t.id)}
                                className="min-h-[36px] px-3 py-1 text-xs font-semibold text-red-600 border border-red-200 rounded-lg cursor-pointer"
                              >
                                Check Out Resident
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                            <th className="py-3 px-4">Resident</th>
                            <th className="py-3 px-4">Room / Bed</th>
                            <th className="py-3 px-4">KYC Document</th>
                            <th className="py-3 px-4">Emergency Contact</th>
                            <th className="py-3 px-4">Check-In</th>
                            <th className="py-3 px-4 text-right">Deposit</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {filteredTenants.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50/70">
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900">
                                  {t.full_name}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {t.phone} · {t.email}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-xs text-slate-700">
                                {t.room_number
                                  ? `Rm ${t.room_number} · Bed ${t.bed_label}`
                                  : 'Unassigned'}
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-700">
                                <div className="font-medium">{t.kyc_id_type}</div>
                                <div className="font-mono text-slate-500">
                                  {t.kyc_id_number}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-700">
                                <div>{t.emergency_contact_name}</div>
                                <div className="text-slate-500 tabular-nums">
                                  {t.emergency_contact_phone}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-xs tabular-nums text-slate-600">
                                {formatDateShort(t.check_in_date)}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-xs">
                                <div className="font-semibold text-slate-900">
                                  {formatINR(t.security_deposit_paid)}
                                </div>
                                <div className="text-slate-500">
                                  {t.deposit_status}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`text-xs font-semibold ${
                                    t.status === 'Active'
                                      ? 'text-emerald-700'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {t.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                {t.status === 'Active' ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleCheckoutTenant(t.id)}
                                    className="text-xs font-medium text-red-600 hover:underline cursor-pointer"
                                  >
                                    Check Out
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400">
                                    {formatDateShort(t.check_out_date)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: RENT & EXPENSES */}
              {activeTab === 'billing' && (
                <div className="space-y-8">
                  {/* Rent Invoices Section */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <h2 className="font-display text-lg font-bold text-slate-900">
                          Monthly Rent Invoices
                        </h2>
                        <p className="text-xs text-slate-500">
                          Generate monthly bills for all active residents and track paid/pending dues.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <input
                          type="month"
                          value={billingMonth}
                          onChange={(e) => setBillingMonth(e.target.value)}
                          className="px-3 py-2 text-base sm:text-xs border border-slate-200 rounded-lg bg-white"
                        />
                        <input
                          type="number"
                          min={0}
                          value={electricityFlat}
                          onChange={(e) =>
                            setElectricityFlat(Number(e.target.value))
                          }
                          title="Electricity share per bed"
                          className="w-24 px-3 py-2 text-base sm:text-xs border border-slate-200 rounded-lg bg-white tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => void handleGenerateInvoices()}
                          className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          Generate Monthly Invoices
                        </button>
                      </div>
                    </div>

                    <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-2">
                      {['All', 'Paid', 'Pending', 'Overdue'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setInvoiceFilter(st)}
                          className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                            invoiceFilter === st
                              ? 'bg-white text-slate-900 border border-slate-200'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden divide-y divide-slate-200">
                      {filteredInvoices.map((inv) => (
                        <div key={inv.id} className="p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-800">
                              {inv.invoice_number}
                            </span>
                            <span
                              className={`text-xs font-semibold ${
                                inv.status === 'Paid'
                                  ? 'text-emerald-700'
                                  : inv.status === 'Overdue'
                                    ? 'text-red-600'
                                    : 'text-amber-700'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {inv.tenant_name}
                              </div>
                              <div className="text-xs text-slate-500">
                                Rm {inv.room_number} · {inv.billing_month}
                              </div>
                            </div>
                            <div className="text-base font-bold text-slate-900 tabular-nums">
                              {formatINR(inv.total_amount)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
                            <span className="tabular-nums">
                              Rent {formatINR(inv.rent_amount)} + Elec.{' '}
                              {formatINR(inv.electricity_amount)}
                            </span>
                            {inv.status !== 'Paid' ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleMarkInvoicePaid(inv.id)
                                }
                                className="px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-200 rounded-md cursor-pointer"
                              >
                                Mark Paid
                              </button>
                            ) : (
                              <span>{formatDateShort(inv.paid_date)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                            <th className="py-3 px-4">Invoice</th>
                            <th className="py-3 px-4">Resident</th>
                            <th className="py-3 px-4">Room</th>
                            <th className="py-3 px-4">Month</th>
                            <th className="py-3 px-4 text-right">Rent</th>
                            <th className="py-3 px-4 text-right">Elec.</th>
                            <th className="py-3 px-4 text-right">Total</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {filteredInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50/70">
                              <td className="py-3 px-4 font-mono text-xs text-slate-800">
                                {inv.invoice_number}
                              </td>
                              <td className="py-3 px-4 font-medium text-slate-900">
                                {inv.tenant_name}
                              </td>
                              <td className="py-3 px-4 font-mono text-xs text-slate-600">
                                {inv.room_number}
                              </td>
                              <td className="py-3 px-4 tabular-nums text-xs text-slate-600">
                                {inv.billing_month}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                                {formatINR(inv.rent_amount)}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                                {formatINR(inv.electricity_amount)}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums font-semibold text-slate-900">
                                {formatINR(inv.total_amount)}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`text-xs font-semibold ${
                                    inv.status === 'Paid'
                                      ? 'text-emerald-700'
                                      : inv.status === 'Overdue'
                                        ? 'text-red-600'
                                        : 'text-amber-700'
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                {inv.status === 'Paid' ? (
                                  <span className="text-xs text-slate-500">
                                    {formatDateShort(inv.paid_date)}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleMarkInvoicePaid(inv.id)
                                    }
                                    className="px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-md cursor-pointer"
                                  >
                                    Mark Paid
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Daily Expenses Ledger */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
                      <h3 className="font-display text-base font-bold text-slate-900">
                        Log Daily Property Expense
                      </h3>
                      <form
                        onSubmit={handleAddExpense}
                        className="mt-4 space-y-3.5"
                      >
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Date
                          </label>
                          <input
                            type="date"
                            required
                            value={newExpense.expense_date}
                            onChange={(e) =>
                              setNewExpense({
                                ...newExpense,
                                expense_date: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Category
                          </label>
                          <select
                            value={newExpense.category}
                            onChange={(e) =>
                              setNewExpense({
                                ...newExpense,
                                category: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg bg-white"
                          >
                            <option value="Groceries & Mess">
                              Groceries & Mess
                            </option>
                            <option value="Utilities">Utilities</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Housekeeping">Housekeeping</option>
                            <option value="Internet & Security">
                              Internet & Security
                            </option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            required
                            value={newExpense.description}
                            onChange={(e) =>
                              setNewExpense({
                                ...newExpense,
                                description: e.target.value,
                              })
                            }
                            placeholder="e.g. LPG kitchen cylinder refill"
                            className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Amount (INR)
                          </label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={newExpense.amount}
                            onChange={(e) =>
                              setNewExpense({
                                ...newExpense,
                                amount: e.target.value,
                              })
                            }
                            placeholder="2400"
                            className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg tabular-nums"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full min-h-[42px] py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-blue-700 rounded-lg cursor-pointer"
                        >
                          Record Expense
                        </button>
                      </form>
                    </div>

                    <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="font-display text-base font-bold text-slate-900">
                          Operating Expenses Ledger
                        </h3>
                        <span className="text-xs font-semibold text-slate-700 tabular-nums">
                          Total: {formatINR(data.kpis.totalExpenses)}
                        </span>
                      </div>

                      {/* Mobile Cards */}
                      <div className="md:hidden divide-y divide-slate-200">
                        {data.expenses.map((exp) => (
                          <div
                            key={exp.id}
                            className="p-4 flex items-start justify-between gap-3"
                          >
                            <div>
                              <div className="text-xs text-slate-500 tabular-nums">
                                {formatDateShort(exp.expense_date)} · {exp.category}
                              </div>
                              <div className="text-sm font-medium text-slate-900 mt-0.5">
                                {exp.description}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-bold text-slate-900 tabular-nums">
                                {formatINR(exp.amount)}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleDeleteExpense(exp.id)}
                                aria-label="Delete expense"
                                className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                              <th className="py-2.5 px-4">Date</th>
                              <th className="py-2.5 px-4">Category</th>
                              <th className="py-2.5 px-4">Description</th>
                              <th className="py-2.5 px-4 text-right">Amount</th>
                              <th className="py-2.5 px-4 text-right">Remove</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-sm">
                            {data.expenses.map((exp) => (
                              <tr key={exp.id}>
                                <td className="py-3 px-4 text-xs tabular-nums text-slate-600 whitespace-nowrap">
                                  {formatDateShort(exp.expense_date)}
                                </td>
                                <td className="py-3 px-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                                  {exp.category}
                                </td>
                                <td className="py-3 px-4 text-slate-900">
                                  {exp.description}
                                </td>
                                <td className="py-3 px-4 text-right tabular-nums font-semibold text-slate-900">
                                  {formatINR(exp.amount)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteExpense(exp.id)}
                                    aria-label="Delete expense"
                                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: COMPLAINTS */}
              {activeTab === 'complaints' && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-slate-900">
                        Maintenance & Food Complaints
                      </h2>
                      <p className="text-sm text-slate-600">
                        Assign technicians, update ticket status, and post resolution notes to the resident portal.
                      </p>
                    </div>
                    <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
                      {['All', 'Open', 'In Progress', 'Resolved'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setComplaintFilter(st)}
                          className={`min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                            complaintFilter === st
                              ? 'bg-white text-slate-900'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                    {filteredComplaints.map((c) => (
                      <div
                        key={c.id}
                        className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono font-semibold text-slate-800">
                              {c.ticket_number}
                            </span>
                            <span>·</span>
                            <span>
                              {c.tenant_name} (Room {c.room_number || '—'})
                            </span>
                            <span>·</span>
                            <span>
                              {c.category} · {c.priority} Priority
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-slate-900">
                            {c.title}
                          </h3>
                          <p className="text-sm text-slate-600">{c.description}</p>
                          <div className="text-xs text-slate-500 pt-1">
                            Assigned to:{' '}
                            <span className="font-medium text-slate-800">
                              {c.assigned_to}
                            </span>
                            {c.admin_notes && ` · Note: ${c.admin_notes}`}
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                          <span
                            className={`text-xs font-semibold ${
                              c.status === 'Resolved'
                                ? 'text-emerald-700'
                                : c.status === 'In Progress'
                                  ? 'text-amber-700'
                                  : 'text-red-600'
                            }`}
                          >
                            {c.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingComplaint({ ...c })}
                            className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-lg cursor-pointer"
                          >
                            Update Ticket
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: VISIT INQUIRIES */}
              {activeTab === 'inquiries' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 sm:px-6 py-4 border-b border-slate-200">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Prospective Tenant Visit Inquiries
                    </h2>
                    <p className="text-xs text-slate-500">
                      Leads submitted from the public landing page inquiry form.
                    </p>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-slate-200">
                    {data.inquiries.map((inq) => (
                      <div key={inq.id} className="p-4 space-y-2.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {inq.full_name}
                            </div>
                            <div className="text-slate-500">
                              {inq.phone} · {inq.email}
                            </div>
                          </div>
                          <select
                            value={inq.status}
                            onChange={(e) =>
                              void handleUpdateInquiryStatus(
                                inq.id,
                                e.target.value
                              )
                            }
                            className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white"
                          >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Scheduled">Scheduled</option>
                            <option value="Converted">Converted</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </div>
                        <div className="text-slate-700 tabular-nums">
                          {inq.preferred_sharing} · {inq.preferred_ac} · Visit{' '}
                          {formatDateShort(inq.visit_date)}
                        </div>
                        {inq.message && (
                          <p className="text-slate-600">{inq.message}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4">Prospect</th>
                          <th className="py-3 px-4">Preference</th>
                          <th className="py-3 px-4">Visit Date</th>
                          <th className="py-3 px-4">Message</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {data.inquiries.map((inq) => (
                          <tr key={inq.id}>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">
                                {inq.full_name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {inq.phone} · {inq.email}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-700">
                              {inq.preferred_sharing} · {inq.preferred_ac}
                            </td>
                            <td className="py-3 px-4 text-xs tabular-nums text-slate-700">
                              {formatDateShort(inq.visit_date)}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 max-w-xs">
                              {inq.message || '—'}
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={inq.status}
                                onChange={(e) =>
                                  void handleUpdateInquiryStatus(
                                    inq.id,
                                    e.target.value
                                  )
                                }
                                className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white"
                              >
                                <option value="New">New</option>
                                <option value="Contacted">Contacted</option>
                                <option value="Scheduled">Scheduled</option>
                                <option value="Converted">Converted</option>
                                <option value="Closed">Closed</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 7: CMS & MESS MENU */}
              {activeTab === 'cms' && (
                <div className="space-y-8">
                  {/* Website Copy CMS */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Public Website Text & Contact Details
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Changes publish immediately to the public marketing website.
                    </p>

                    <form onSubmit={handleSaveCms} className="mt-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Property Brand Name
                          </label>
                          <input
                            type="text"
                            value={cmsDraft.brand_name || ''}
                            onChange={(e) =>
                              setCmsDraft({
                                ...cmsDraft,
                                brand_name: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Neighborhood Label
                          </label>
                          <input
                            type="text"
                            value={cmsDraft.location_label || ''}
                            onChange={(e) =>
                              setCmsDraft({
                                ...cmsDraft,
                                location_label: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Hero Headline
                        </label>
                        <input
                          type="text"
                          value={cmsDraft.hero_headline || ''}
                          onChange={(e) =>
                            setCmsDraft({
                              ...cmsDraft,
                              hero_headline: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Hero Subheadline
                        </label>
                        <textarea
                          rows={2}
                          value={cmsDraft.hero_subheadline || ''}
                          onChange={(e) =>
                            setCmsDraft({
                              ...cmsDraft,
                              hero_subheadline: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Contact Phone
                          </label>
                          <input
                            type="text"
                            value={cmsDraft.contact_phone || ''}
                            onChange={(e) =>
                              setCmsDraft({
                                ...cmsDraft,
                                contact_phone: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Contact Email
                          </label>
                          <input
                            type="text"
                            value={cmsDraft.contact_email || ''}
                            onChange={(e) =>
                              setCmsDraft({
                                ...cmsDraft,
                                contact_email: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Visiting Hours
                          </label>
                          <input
                            type="text"
                            value={cmsDraft.visiting_hours || ''}
                            onChange={(e) =>
                              setCmsDraft({
                                ...cmsDraft,
                                visiting_hours: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="min-h-[42px] px-5 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                      >
                        Publish Website Copy
                      </button>
                    </form>
                  </div>

                  {/* Weekly Mess Menu Editor */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Weekly Mess Menu Editor
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 mb-5">
                      Update meals for any day; reflected live on both the Public Website and Resident Portal.
                    </p>

                    <div className="space-y-4">
                      {data.messMenu.map((day) => {
                        const draft = menuDrafts[day.day_of_week] || day;
                        return (
                          <div
                            key={day.day_of_week}
                            className="p-4 border border-slate-200 rounded-lg space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-display text-sm font-bold text-slate-900">
                                {day.day_of_week}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleSaveMenuDay(day.day_of_week)
                                }
                                className="min-h-[34px] px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-md cursor-pointer"
                              >
                                Save {day.day_of_week.slice(0, 3)}
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              {(
                                [
                                  ['breakfast', 'Breakfast'],
                                  ['lunch', 'Lunch'],
                                  ['evening_snack', 'Evening Snack'],
                                  ['dinner', 'Dinner'],
                                ] as const
                              ).map(([field, label]) => (
                                <div key={field}>
                                  <label className="block text-xs text-slate-500 mb-1">
                                    {label}
                                  </label>
                                  <input
                                    type="text"
                                    value={draft[field]}
                                    onChange={(e) =>
                                      setMenuDrafts({
                                        ...menuDrafts,
                                        [day.day_of_week]: {
                                          ...draft,
                                          [field]: e.target.value,
                                        },
                                      })
                                    }
                                    className="w-full px-2.5 py-2 text-base sm:text-xs border border-slate-200 rounded-md"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Announcements & Photo Gallery Manager */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
                      <div>
                        <h2 className="font-display text-lg font-bold text-slate-900">
                          Post Announcements
                        </h2>
                        <form
                          onSubmit={handlePublishAnnouncement}
                          className="mt-4 space-y-3"
                        >
                          <input
                            type="text"
                            required
                            value={newAnnouncement.title}
                            onChange={(e) =>
                              setNewAnnouncement({
                                ...newAnnouncement,
                                title: e.target.value,
                              })
                            }
                            placeholder="Announcement headline"
                            className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                          />
                          <textarea
                            rows={2}
                            required
                            value={newAnnouncement.body}
                            onChange={(e) =>
                              setNewAnnouncement({
                                ...newAnnouncement,
                                body: e.target.value,
                              })
                            }
                            placeholder="Write notice details..."
                            className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <select
                              value={newAnnouncement.audience}
                              onChange={(e) =>
                                setNewAnnouncement({
                                  ...newAnnouncement,
                                  audience: e.target.value,
                                })
                              }
                              className="px-3 py-2 text-base sm:text-xs border border-slate-200 rounded-lg bg-white"
                            >
                              <option value="Public & Residents">
                                Public & Residents
                              </option>
                              <option value="All Residents">
                                Residents Portal Only
                              </option>
                            </select>

                            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={newAnnouncement.pinned}
                                onChange={(e) =>
                                  setNewAnnouncement({
                                    ...newAnnouncement,
                                    pinned: e.target.checked,
                                  })
                                }
                              />
                              Pin to top
                            </label>

                            <button
                              type="submit"
                              className="min-h-[38px] px-4 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                            >
                              Publish Notice
                            </button>
                          </div>
                        </form>
                      </div>

                      <div className="divide-y divide-slate-200 border-t border-slate-200 pt-3">
                        {data.announcements.map((a) => (
                          <div
                            key={a.id}
                            className="py-3 flex items-start justify-between gap-3"
                          >
                            <div>
                              <div className="text-xs text-slate-500">
                                {a.audience} {a.pinned ? '· Pinned' : ''}
                              </div>
                              <div className="text-sm font-semibold text-slate-900">
                                {a.title}
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5">
                                {a.body}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleDeleteAnnouncement(a.id)}
                              className="text-slate-400 hover:text-red-600 p-1.5 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
                      <div>
                        <h2 className="font-display text-lg font-bold text-slate-900">
                          Property Photo Gallery
                        </h2>
                        <form
                          onSubmit={handleAddGalleryPhoto}
                          className="mt-4 space-y-3"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                              type="text"
                              required
                              value={newPhoto.title}
                              onChange={(e) =>
                                setNewPhoto({ ...newPhoto, title: e.target.value })
                              }
                              placeholder="Photo title"
                              className="px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                            />
                            <select
                              value={newPhoto.category}
                              onChange={(e) =>
                                setNewPhoto({
                                  ...newPhoto,
                                  category: e.target.value,
                                })
                              }
                              className="px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg bg-white"
                            >
                              <option value="Rooms">Rooms</option>
                              <option value="Common Areas">Common Areas</option>
                              <option value="Dining">Dining</option>
                              <option value="Exterior">Exterior</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                            <input
                              type="text"
                              required
                              value={newPhoto.image_url}
                              onChange={(e) =>
                                setNewPhoto({
                                  ...newPhoto,
                                  image_url: e.target.value,
                                })
                              }
                              placeholder="Image URL"
                              className="px-3 py-2 text-base sm:text-xs border border-slate-200 rounded-lg font-mono"
                            />
                            <label className="text-xs font-medium text-blue-700 cursor-pointer py-1">
                              <span>Or upload local photo</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleGalleryFileUpload}
                                className="hidden"
                              />
                            </label>
                          </div>

                          <button
                            type="submit"
                            className="min-h-[38px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-blue-700 rounded-lg cursor-pointer"
                          >
                            Add to Gallery
                          </button>
                        </form>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-200 pt-4">
                        {data.gallery.map((g) => (
                          <div
                            key={g.id}
                            className="border border-slate-200 rounded-lg overflow-hidden"
                          >
                            <div className="aspect-[4/3] bg-slate-100">
                              <ResilientImage
                                src={g.image_url}
                                alt={g.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="p-2.5 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-900 truncate">
                                  {g.title}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {g.category}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleDeleteGalleryPhoto(g.id)}
                                className="text-slate-400 hover:text-red-600 p-1.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal: Add Room */}
      {showAddRoom && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreateRoom}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-slate-900">
              Add New Room
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Room Number
                </label>
                <input
                  type="text"
                  required
                  value={newRoom.room_number}
                  onChange={(e) =>
                    setNewRoom({ ...newRoom, room_number: e.target.value })
                  }
                  placeholder="e.g. 401"
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Floor
                </label>
                <input
                  type="number"
                  min={1}
                  value={newRoom.floor}
                  onChange={(e) =>
                    setNewRoom({ ...newRoom, floor: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sharing
                </label>
                <select
                  value={newRoom.sharing_type}
                  onChange={(e) =>
                    setNewRoom({
                      ...newRoom,
                      sharing_type: e.target.value as
                        | 'Single'
                        | 'Double'
                        | 'Triple',
                    })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Single">Single (1 Bed)</option>
                  <option value="Double">Double (2 Beds)</option>
                  <option value="Triple">Triple (3 Beds)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Climate
                </label>
                <select
                  value={newRoom.ac_type}
                  onChange={(e) =>
                    setNewRoom({
                      ...newRoom,
                      ac_type: e.target.value as 'AC' | 'Non-AC',
                    })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="AC">AC</option>
                  <option value="Non-AC">Non-AC</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monthly Rent (INR)
                </label>
                <input
                  type="number"
                  required
                  value={newRoom.monthly_rent}
                  onChange={(e) =>
                    setNewRoom({
                      ...newRoom,
                      monthly_rent: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Security Deposit
                </label>
                <input
                  type="number"
                  required
                  value={newRoom.security_deposit}
                  onChange={(e) =>
                    setNewRoom({
                      ...newRoom,
                      security_deposit: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={newRoom.description}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, description: e.target.value })
                }
                placeholder="Room highlights..."
                className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddRoom(false)}
                className="min-h-[42px] px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg cursor-pointer"
              >
                Create Room
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit Room */}
      {editingRoom && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveRoomEdit}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-slate-900">
              Edit Room {editingRoom.room_number}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monthly Rent (INR)
                </label>
                <input
                  type="number"
                  required
                  value={editingRoom.monthly_rent}
                  onChange={(e) =>
                    setEditingRoom({
                      ...editingRoom,
                      monthly_rent: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Security Deposit
                </label>
                <input
                  type="number"
                  required
                  value={editingRoom.security_deposit}
                  onChange={(e) =>
                    setEditingRoom({
                      ...editingRoom,
                      security_deposit: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Climate
                </label>
                <select
                  value={editingRoom.ac_type}
                  onChange={(e) =>
                    setEditingRoom({
                      ...editingRoom,
                      ac_type: e.target.value as 'AC' | 'Non-AC',
                    })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="AC">AC</option>
                  <option value="Non-AC">Non-AC</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Room Status
                </label>
                <select
                  value={editingRoom.status}
                  onChange={(e) =>
                    setEditingRoom({
                      ...editingRoom,
                      status: e.target.value as 'Active' | 'Maintenance',
                    })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Active">Active (Listed)</option>
                  <option value="Maintenance">Maintenance (Hidden)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={editingRoom.description}
                onChange={(e) =>
                  setEditingRoom({ ...editingRoom, description: e.target.value })
                }
                className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRoom(null)}
                className="min-h-[42px] px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Assign Bed */}
      {assigningBed && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900">
              Assign Room {assigningBed.roomNumber} · Bed{' '}
              {assigningBed.bed.bed_label}
            </h3>

            {unassignedActiveTenants.length === 0 ? (
              <p className="text-sm text-slate-600">
                All active residents are currently assigned to beds. Onboard a new tenant first from the Tenants tab.
              </p>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Resident
                </label>
                <select
                  value={selectedTenantForBed}
                  onChange={(e) => setSelectedTenantForBed(e.target.value)}
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {unassignedActiveTenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.phone})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssigningBed(null)}
                className="min-h-[42px] px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg cursor-pointer"
              >
                Close
              </button>
              {unassignedActiveTenants.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleAssignBed()}
                  className="min-h-[42px] px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg cursor-pointer"
                >
                  Assign Bed
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Onboard Tenant */}
      {showAddTenant && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleOnboardTenant}
            className="bg-white border border-slate-200 rounded-xl max-w-lg w-full max-h-[90dvh] overflow-y-auto p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-slate-900">
              Digital Tenant Onboarding & KYC
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newTenant.full_name}
                  onChange={(e) =>
                    setNewTenant({ ...newTenant, full_name: e.target.value })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={newTenant.phone}
                  onChange={(e) =>
                    setNewTenant({ ...newTenant, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email (Portal Login)
                </label>
                <input
                  type="email"
                  required
                  value={newTenant.email}
                  onChange={(e) =>
                    setNewTenant({ ...newTenant, email: e.target.value })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Occupation / College
                </label>
                <input
                  type="text"
                  value={newTenant.occupation_or_college}
                  onChange={(e) =>
                    setNewTenant({
                      ...newTenant,
                      occupation_or_college: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  KYC Document Type
                </label>
                <select
                  value={newTenant.kyc_id_type}
                  onChange={(e) =>
                    setNewTenant({ ...newTenant, kyc_id_type: e.target.value })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Aadhaar">Aadhaar Card</option>
                  <option value="Passport">Passport</option>
                  <option value="Driving License">Driving License</option>
                  <option value="PAN">PAN Card</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  KYC ID Number
                </label>
                <input
                  type="text"
                  required
                  value={newTenant.kyc_id_number}
                  onChange={(e) =>
                    setNewTenant({
                      ...newTenant,
                      kyc_id_number: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  required
                  value={newTenant.emergency_contact_name}
                  onChange={(e) =>
                    setNewTenant({
                      ...newTenant,
                      emergency_contact_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Emergency Phone
                </label>
                <input
                  type="tel"
                  required
                  value={newTenant.emergency_contact_phone}
                  onChange={(e) =>
                    setNewTenant({
                      ...newTenant,
                      emergency_contact_phone: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Check-In Date
                </label>
                <input
                  type="date"
                  required
                  value={newTenant.check_in_date}
                  onChange={(e) =>
                    setNewTenant({
                      ...newTenant,
                      check_in_date: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Security Deposit Paid (INR)
                </label>
                <input
                  type="number"
                  required
                  value={newTenant.security_deposit_paid}
                  onChange={(e) =>
                    setNewTenant({
                      ...newTenant,
                      security_deposit_paid: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assign Vacant Bed (Optional)
              </label>
              <select
                value={newTenant.bed_id}
                onChange={(e) =>
                  setNewTenant({ ...newTenant, bed_id: e.target.value })
                }
                className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Assign later</option>
                {vacantBedsList.map((b) => (
                  <option key={b.bedId} value={b.bedId}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddTenant(false)}
                className="min-h-[42px] px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg cursor-pointer"
              >
                Complete Onboarding
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Update Complaint */}
      {editingComplaint && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleUpdateComplaint}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-slate-900">
              Update Ticket {editingComplaint.ticket_number}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status
              </label>
              <select
                value={editingComplaint.status}
                onChange={(e) =>
                  setEditingComplaint({
                    ...editingComplaint,
                    status: e.target.value as Complaint['status'],
                  })
                }
                className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assign Technician / Staff
              </label>
              <input
                type="text"
                value={editingComplaint.assigned_to}
                onChange={(e) =>
                  setEditingComplaint({
                    ...editingComplaint,
                    assigned_to: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Resolution / Resident Note
              </label>
              <textarea
                rows={3}
                value={editingComplaint.admin_notes}
                onChange={(e) =>
                  setEditingComplaint({
                    ...editingComplaint,
                    admin_notes: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-base sm:text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingComplaint(null)}
                className="min-h-[42px] px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg cursor-pointer"
              >
                Save Update
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
