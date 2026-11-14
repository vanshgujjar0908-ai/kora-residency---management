import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertCircle,
  BedDouble,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Home,
  LogOut,
  Menu,
  MessageSquarePlus,
  Utensils,
  X,
} from 'lucide-react';
import { apiRequest, formatDateShort, formatINR } from '../lib/api.ts';
import type { AuthUser, Invoice, TenantDashboardData } from '../types.ts';
import { ResilientImage } from './ResilientImage.tsx';

interface TenantPortalProps {
  user: AuthUser;
  onLogout: () => void;
  onBackToSite: () => void;
}

type TenantTab = 'overview' | 'payments' | 'tickets' | 'menu';

export function TenantPortal({
  user,
  onLogout,
  onBackToSite,
}: TenantPortalProps) {
  const [activeTab, setActiveTab] = useState<TenantTab>('overview');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pay invoice modal state
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [payingBusy, setPayingBusy] = useState(false);

  // Raise ticket form state
  const [ticketCategory, setTicketCategory] = useState('Maintenance');
  const [ticketPriority, setTicketPriority] = useState('Medium');
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketNotice, setTicketNotice] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<TenantDashboardData>('/api/tenant/dashboard');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load portal.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function handlePayInvoice() {
    if (!payingInvoice) return;
    setPayingBusy(true);
    try {
      await apiRequest(`/api/tenant/invoices/${payingInvoice.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ payment_method: paymentMethod }),
      });
      setPayingInvoice(null);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed.');
    } finally {
      setPayingBusy(false);
    }
  }

  async function handleRaiseTicket(e: FormEvent) {
    e.preventDefault();
    setTicketBusy(true);
    setTicketNotice(null);
    try {
      const res = await apiRequest<{ ticket_number: string }>(
        '/api/tenant/complaints',
        {
          method: 'POST',
          body: JSON.stringify({
            category: ticketCategory,
            priority: ticketPriority,
            title: ticketTitle,
            description: ticketDescription,
          }),
        }
      );
      setTicketNotice(`Ticket ${res.ticket_number} submitted to maintenance desk.`);
      setTicketTitle('');
      setTicketDescription('');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit ticket.');
    } finally {
      setTicketBusy(false);
    }
  }

  const navItems: Array<{ id: TenantTab; label: string; icon: typeof Home }> = [
    { id: 'overview', label: 'My Stay', icon: Home },
    { id: 'payments', label: 'Rent & Invoices', icon: CreditCard },
    { id: 'tickets', label: 'Raise a Ticket', icon: MessageSquarePlus },
    { id: 'menu', label: 'Mess Menu', icon: Utensils },
  ];

  const activeNavLabel =
    navItems.find((n) => n.id === activeTab)?.label || 'My Stay';

  const nextDueInvoice = data?.invoices.find((i) => i.status !== 'Paid');
  const openTicketsCount =
    data?.complaints.filter((c) => c.status !== 'Resolved').length || 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-white border-r border-slate-200 flex-col shrink-0">
        <div className="h-16 px-5 border-b border-slate-200 flex items-center">
          <span className="font-display text-base font-bold text-slate-900">
            Kora Residency
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
              <span className="font-display text-base font-bold text-slate-900">
                Resident Portal
              </span>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close menu"
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
              aria-label="Open navigation menu"
              className="lg:hidden min-w-[40px] min-h-[40px] -ml-2 inline-flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-slate-500 flex items-center gap-2 truncate">
              <span className="hidden sm:inline font-medium text-slate-700">
                Resident Portal
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
              <span className="hidden sm:inline">Public Site</span>
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

        <main className="p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading || !data ? (
            <div className="space-y-4">
              <div className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
              <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Top KPI Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs font-medium text-slate-500">
                        Assigned Room & Bed
                      </div>
                      <div className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
                        {data.bedInfo
                          ? `Room ${data.bedInfo.room_number} · Bed ${data.bedInfo.bed_label}`
                          : 'Unassigned'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {data.bedInfo
                          ? `${data.bedInfo.sharing_type} · ${data.bedInfo.ac_type} · Floor ${data.bedInfo.floor}`
                          : 'Contact property desk'}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs font-medium text-slate-500">
                        Next Rent Due
                      </div>
                      <div className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
                        {nextDueInvoice
                          ? formatINR(nextDueInvoice.total_amount)
                          : 'All Settled'}
                      </div>
                      <div className="mt-1 text-xs text-slate-600 tabular-nums">
                        {nextDueInvoice
                          ? `Due ${formatDateShort(nextDueInvoice.due_date)} · ${nextDueInvoice.status}`
                          : 'No pending invoices'}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs font-medium text-slate-500">
                        Security Deposit Held
                      </div>
                      <div className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
                        {formatINR(data.tenant.security_deposit_paid)}
                      </div>
                      <div className="mt-1 text-xs text-emerald-700 font-medium">
                        Status: {data.tenant.deposit_status}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs font-medium text-slate-500">
                        Active Support Tickets
                      </div>
                      <div className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
                        {openTicketsCount}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {openTicketsCount > 0
                          ? 'In maintenance queue'
                          : 'No open requests'}
                      </div>
                    </div>
                  </div>

                  {/* Room Details + Announcements */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-display text-base font-bold text-slate-900">
                          Suite & Residency Profile
                        </h2>
                        <span className="text-xs text-slate-500 tabular-nums">
                          Checked in {formatDateShort(data.tenant.check_in_date)}
                        </span>
                      </div>

                      {data.bedInfo && (
                        <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                          <div className="sm:col-span-5 aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                            <ResilientImage
                              src={data.bedInfo.image_url}
                              alt={`Room ${data.bedInfo.room_number}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="sm:col-span-7 space-y-2.5 text-sm">
                            <div className="flex items-center gap-2 font-semibold text-slate-900">
                              <BedDouble className="w-4 h-4 text-blue-700 shrink-0" />
                              <span>
                                Room {data.bedInfo.room_number} (Bed{' '}
                                {data.bedInfo.bed_label})
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">
                              Amenities: {data.bedInfo.amenities_list}
                            </p>
                            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <div className="text-slate-500">Monthly Rent</div>
                                <div className="font-semibold text-slate-900 tabular-nums">
                                  {formatINR(data.bedInfo.monthly_rent)}
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-500">KYC Verified</div>
                                <div className="font-semibold text-slate-900 break-words">
                                  {data.tenant.kyc_id_type} · {data.tenant.kyc_id_number}
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-500">Emergency Contact</div>
                                <div className="font-medium text-slate-900">
                                  {data.tenant.emergency_contact_name}
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-500">Emergency Phone</div>
                                <div className="font-medium text-slate-900 tabular-nums">
                                  {data.tenant.emergency_contact_phone}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {nextDueInvoice && (
                        <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-sm">
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {nextDueInvoice.invoice_number}
                            </span>
                            <span className="text-slate-500 mx-2">·</span>
                            <span className="text-slate-700 tabular-nums">
                              {formatINR(nextDueInvoice.total_amount)} due{' '}
                              {formatDateShort(nextDueInvoice.due_date)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPayingInvoice(nextDueInvoice)}
                            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                          >
                            Pay Rent Now
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-5 sm:px-6 py-4 border-b border-slate-200">
                        <h2 className="font-display text-base font-bold text-slate-900">
                          Residence Announcements
                        </h2>
                      </div>
                      <div className="divide-y divide-slate-200">
                        {data.announcements.map((ann) => (
                          <div key={ann.id} className="p-5">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                              <span>{ann.pinned ? 'Pinned Notice' : 'Notice'}</span>
                              <span className="tabular-nums">
                                {formatDateShort(ann.created_at)}
                              </span>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-900">
                              {ann.title}
                            </h3>
                            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                              {ann.body}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'payments' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 sm:px-6 py-4 border-b border-slate-200">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Monthly Rent Invoices & Payment History
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Itemized rent and electricity charges for Room{' '}
                      {data.bedInfo?.room_number || '—'}.
                    </p>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-slate-200">
                    {data.invoices.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-500">
                        No rent invoices generated yet.
                      </div>
                    ) : (
                      data.invoices.map((inv) => (
                        <div key={inv.id} className="p-4 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-900">
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
                          <div className="flex items-baseline justify-between">
                            <div className="text-xs text-slate-600 tabular-nums">
                              Month {inv.billing_month} · Due{' '}
                              {formatDateShort(inv.due_date)}
                            </div>
                            <div className="font-display text-lg font-bold text-slate-900 tabular-nums">
                              {formatINR(inv.total_amount)}
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            Rent {formatINR(inv.rent_amount)} + Electricity{' '}
                            {formatINR(inv.electricity_amount)}
                          </div>
                          {inv.status !== 'Paid' ? (
                            <button
                              type="button"
                              onClick={() => setPayingInvoice(inv)}
                              className="w-full min-h-[40px] py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                            >
                              Pay Online
                            </button>
                          ) : (
                            <div className="text-xs text-slate-500">
                              Paid on {formatDateShort(inv.paid_date)} via{' '}
                              {inv.payment_method || 'Online'}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4">Invoice</th>
                          <th className="py-3 px-4">Billing Month</th>
                          <th className="py-3 px-4 text-right">Rent</th>
                          <th className="py-3 px-4 text-right">Electricity</th>
                          <th className="py-3 px-4 text-right">Total</th>
                          <th className="py-3 px-4">Due Date</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {data.invoices.length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="py-10 text-center text-slate-500"
                            >
                              No rent invoices generated yet.
                            </td>
                          </tr>
                        ) : (
                          data.invoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-4 font-mono text-xs font-medium text-slate-900">
                                {inv.invoice_number}
                              </td>
                              <td className="py-3 px-4 tabular-nums text-slate-700">
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
                              <td className="py-3 px-4 tabular-nums text-slate-600">
                                {formatDateShort(inv.due_date)}
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
                                  {inv.paid_date
                                    ? ` · ${formatDateShort(inv.paid_date)}`
                                    : ''}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                {inv.status === 'Paid' ? (
                                  <span className="text-xs text-slate-500">
                                    {inv.payment_method || 'Settled'}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setPayingInvoice(inv)}
                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md cursor-pointer"
                                  >
                                    Pay Online
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'tickets' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Raise a Maintenance or Food Ticket
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Tickets are routed directly to our on-site technician and kitchen team.
                    </p>

                    <form onSubmit={handleRaiseTicket} className="mt-5 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Category
                          </label>
                          <select
                            value={ticketCategory}
                            onChange={(e) => setTicketCategory(e.target.value)}
                            className="w-full px-3 py-2 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                          >
                            <option value="Maintenance">Maintenance</option>
                            <option value="Food & Mess">Food & Mess</option>
                            <option value="Wi-Fi & IT">Wi-Fi & IT</option>
                            <option value="Housekeeping">Housekeeping</option>
                            <option value="Security">Security</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Priority
                          </label>
                          <select
                            value={ticketPriority}
                            onChange={(e) => setTicketPriority(e.target.value)}
                            className="w-full px-3 py-2 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Issue Summary
                        </label>
                        <input
                          type="text"
                          required
                          value={ticketTitle}
                          onChange={(e) => setTicketTitle(e.target.value)}
                          placeholder="e.g. Bathroom tap leaking"
                          className="w-full px-3.5 py-2 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Details
                        </label>
                        <textarea
                          rows={4}
                          required
                          value={ticketDescription}
                          onChange={(e) => setTicketDescription(e.target.value)}
                          placeholder="Describe the issue and preferred time for room access..."
                          className="w-full px-3.5 py-2 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                        />
                      </div>

                      {ticketNotice && (
                        <div className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{ticketNotice}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={ticketBusy}
                        className="w-full min-h-[44px] py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg cursor-pointer"
                      >
                        {ticketBusy ? 'Submitting...' : 'Submit Ticket'}
                      </button>
                    </form>
                  </div>

                  <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-5 sm:px-6 py-4 border-b border-slate-200">
                      <h2 className="font-display text-lg font-bold text-slate-900">
                        My Support Tickets
                      </h2>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {data.complaints.length === 0 ? (
                        <div className="p-10 text-center text-sm text-slate-500">
                          You have not submitted any maintenance or food tickets yet.
                        </div>
                      ) : (
                        data.complaints.map((tkt) => (
                          <div key={tkt.id} className="p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-1.5">
                              <span className="font-mono font-semibold text-slate-700">
                                {tkt.ticket_number} · {tkt.category} · {tkt.priority} Priority
                              </span>
                              <span
                                className={`font-semibold ${
                                  tkt.status === 'Resolved'
                                    ? 'text-emerald-700'
                                    : tkt.status === 'In Progress'
                                      ? 'text-amber-700'
                                      : 'text-red-600'
                                }`}
                              >
                                {tkt.status}
                              </span>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-900">
                              {tkt.title}
                            </h3>
                            <p className="mt-1 text-sm text-slate-600">
                              {tkt.description}
                            </p>
                            <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap justify-between gap-2">
                              <span>Assigned: {tkt.assigned_to}</span>
                              {tkt.admin_notes && (
                                <span className="text-slate-700">
                                  Note: {tkt.admin_notes}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'menu' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 sm:px-6 py-4 border-b border-slate-200">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Weekly Mess Schedule
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Breakfast 7:30–9:30 AM · Lunch 12:30–2:30 PM · Snack 5:00–6:15 PM · Dinner 8:00–10:00 PM
                    </p>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-slate-200">
                    {data.messMenu.map((row) => (
                      <div key={row.id} className="p-4 space-y-2 text-xs">
                        <div className="font-display text-sm font-bold text-slate-900">
                          {row.day_of_week}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Breakfast: </span>
                          <span className="text-slate-800">{row.breakfast}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Lunch: </span>
                          <span className="text-slate-800">{row.lunch}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Snack: </span>
                          <span className="text-slate-800">{row.evening_snack}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Dinner: </span>
                          <span className="text-slate-800">{row.dinner}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4">Day</th>
                          <th className="py-3 px-4">Breakfast</th>
                          <th className="py-3 px-4">Lunch</th>
                          <th className="py-3 px-4">Evening Snack</th>
                          <th className="py-3 px-4">Dinner</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {data.messMenu.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                              {row.day_of_week}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700">
                              {row.breakfast}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700">
                              {row.lunch}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700">
                              {row.evening_snack}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700">
                              {row.dinner}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Pay Rent Modal */}
      {payingInvoice && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900">
              Pay Rent Invoice {payingInvoice.invoice_number}
            </h3>
            <div className="text-sm text-slate-600 space-y-1.5 border-y border-slate-100 py-3">
              <div className="flex justify-between">
                <span>Billing Month</span>
                <span className="font-medium text-slate-900 tabular-nums">
                  {payingInvoice.billing_month}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Monthly Rent</span>
                <span className="tabular-nums">
                  {formatINR(payingInvoice.rent_amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Electricity Charges</span>
                <span className="tabular-nums">
                  {formatINR(payingInvoice.electricity_amount)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-100">
                <span>Total Payable</span>
                <span className="tabular-nums">
                  {formatINR(payingInvoice.total_amount)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2 text-base sm:text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="UPI">UPI (GPay / PhonePe / BHIM)</option>
                <option value="Card">Debit / Credit Card</option>
                <option value="Bank Transfer">NEFT / IMPS Bank Transfer</option>
              </select>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="min-h-[42px] px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={payingBusy}
                onClick={() => void handlePayInvoice()}
                className="min-h-[42px] px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {payingBusy
                  ? 'Processing...'
                  : `Confirm Payment (${formatINR(payingInvoice.total_amount)})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
