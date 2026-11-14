import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Mail,
  MapPin,
  Menu,
  Phone,
  ShieldCheck,
  Utensils,
  Wifi,
  X,
} from 'lucide-react';
import { apiRequest, formatDateShort, formatINR } from '../lib/api.ts';
import type { PublicSiteData, Room } from '../types.ts';
import { ResilientImage } from './ResilientImage.tsx';

interface PublicSiteProps {
  data: PublicSiteData;
  onOpenPortal: () => void;
  loggedInRole: 'admin' | 'tenant' | null;
}

export function PublicSite({
  data,
  onOpenPortal,
  loggedInRole,
}: PublicSiteProps) {
  const { cms, rooms, messMenu, announcements, gallery, summary } = data;

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sharingFilter, setSharingFilter] = useState<string>('All');
  const [acFilter, setAcFilter] = useState<string>('All');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const initialDay = messMenu.some((m) => m.day_of_week === todayName)
    ? todayName
    : messMenu[0]?.day_of_week || 'Monday';
  const [selectedDay, setSelectedDay] = useState<string>(initialDay);

  // Inquiry form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredSharing, setPreferredSharing] = useState<
    'Single' | 'Double' | 'Triple'
  >('Double');
  const [preferredAc, setPreferredAc] = useState<'AC' | 'Non-AC'>('AC');
  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [inquirySuccess, setInquirySuccess] = useState<{
    reference: string;
    name: string;
  } | null>(null);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      if (sharingFilter !== 'All' && room.sharing_type !== sharingFilter) {
        return false;
      }
      if (acFilter !== 'All' && room.ac_type !== acFilter) {
        return false;
      }
      if (onlyAvailable && room.vacant_beds === 0) {
        return false;
      }
      return true;
    });
  }, [rooms, sharingFilter, acFilter, onlyAvailable]);

  const activeMenuDay =
    messMenu.find((m) => m.day_of_week === selectedDay) || messMenu[0];

  function scrollToInquiry(room?: Room) {
    if (room) {
      setPreferredSharing(room.sharing_type);
      setPreferredAc(room.ac_type);
      setMessage(
        `Interested in Room ${room.room_number} (${room.sharing_type}, ${room.ac_type}).`
      );
    }
    const el = document.getElementById('book-visit');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileNavOpen(false);
  }

  async function handleInquirySubmit(e: FormEvent) {
    e.preventDefault();
    setInquiryError(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ reference: string }>(
        '/api/public/inquiries',
        {
          method: 'POST',
          body: JSON.stringify({
            full_name: fullName,
            email,
            phone,
            preferred_sharing: preferredSharing,
            preferred_ac: preferredAc,
            visit_date: visitDate,
            message,
          }),
        }
      );
      setInquirySuccess({ reference: res.reference, name: fullName });
      setFullName('');
      setPhone('');
      setEmail('');
      setMessage('');
    } catch (err) {
      setInquiryError(
        err instanceof Error ? err.message : 'Unable to submit request.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const portalLabel =
    loggedInRole === 'admin'
      ? 'Admin Console'
      : loggedInRole === 'tenant'
        ? 'Resident Portal'
        : 'Portal';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            {cms.brand_name || 'Kora Residency'}
          </a>

          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-6 lg:gap-7 text-sm font-medium text-slate-600"
          >
            <a
              href="#rooms"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Rooms
            </a>
            <a
              href="#amenities"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Amenities
            </a>
            <a
              href="#mess-menu"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Mess Menu
            </a>
            <a
              href="#notices"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Notices
            </a>
            <button
              type="button"
              onClick={onOpenPortal}
              className="hover:text-blue-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {portalLabel}
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => scrollToInquiry()}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Book a Visit
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle Menu"
              aria-expanded={mobileNavOpen}
              className="md:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 sm:px-6 py-4 space-y-1 shadow-lg">
            {[
              ['#rooms', 'Rooms & Live Availability'],
              ['#amenities', 'Amenities & Gallery'],
              ['#mess-menu', 'Weekly Mess Menu'],
              ['#notices', 'Residence Notices'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center min-h-[44px] px-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg"
              >
                {label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                onOpenPortal();
              }}
              className="flex items-center w-full min-h-[44px] px-2 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
            >
              {portalLabel}
            </button>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => scrollToInquiry()}
                className="w-full min-h-[44px] py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
              >
                Book a Visit
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section id="top" className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-5 flex flex-col justify-between py-1">
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-600 mb-3 sm:mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>
                      {cms.location_label || 'Koramangala 4th Block, Bengaluru'}
                    </span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-700 font-semibold tabular-nums">
                    {summary.vacantBeds} beds available now
                  </span>
                </p>

                <h1 className="font-display text-[clamp(2rem,4vw,3.35rem)] font-bold tracking-tight leading-[1.1] text-slate-900 text-balance">
                  {cms.hero_headline ||
                    'Thoughtfully managed urban living with zero-friction stays.'}
                </h1>

                <p className="mt-4 sm:mt-5 text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                  {cms.hero_subheadline}
                </p>
              </div>

              <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-slate-100 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => scrollToInquiry()}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-3 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  <span>Book a Visit / Check Availability</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#rooms"
                  className="inline-flex items-center justify-center min-h-[44px] px-5 py-3 text-sm font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  View Room Inventory
                </a>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="h-56 sm:h-80 lg:h-full lg:min-h-[380px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <ResilientImage
                  src={
                    cms.hero_image_url ||
                    '/src/assets/images/hero_pg_exterior_1794555049870.jpg'
                  }
                  alt="Kora Residency sunlit courtyard and communal study lounge"
                  className="w-full h-full object-cover"
                  fallbackLabel="Kora Residency Courtyard Lounge"
                />
              </div>
            </div>
          </div>

          {/* 4-column Highlights Strip directly below Hero split */}
          <div className="mt-10 sm:mt-12 pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <div className="flex items-start gap-3.5">
              <Wifi className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  200 Mbps Fiber Wi-Fi
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Enterprise dual-band mesh routers on every floor with power backup.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <Utensils className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Hygienic 4-Meal Dining
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Freshly prepared breakfast, lunch, evening tea, and dinner included.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <ShieldCheck className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  24/7 Biometric & CCTV
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Keyless entry gates, resident warden on-site, and visitor logbook.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <CheckCircle2 className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Zero-Brokerage Leases
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Digital KYC onboarding, transparent invoices, and instant deposit receipts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Room Showcase & Live Bed Availability */}
      <section id="rooms" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 sm:mb-10">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Room Showcase & Live Availability
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl">
              Inventory updates directly as beds are assigned or vacated. Filter by occupancy and climate preference.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Sharing Segmented Filter */}
            <div
              role="group"
              aria-label="Filter by sharing type"
              className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg max-w-full overflow-x-auto"
            >
              {['All', 'Single', 'Double', 'Triple'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSharingFilter(type)}
                  className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    sharingFilter === type
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* AC Segmented Filter */}
            <div
              role="group"
              aria-label="Filter by AC type"
              className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg"
            >
              {['All', 'AC', 'Non-AC'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAcFilter(type)}
                  className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    acFilter === type
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOnlyAvailable((v) => !v)}
              className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                onlyAvailable
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              Vacant Beds Only
            </button>
          </div>
        </div>

        {filteredRooms.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center">
            <p className="text-base font-medium text-slate-900">
              No rooms match the selected filters.
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Reset filters to inspect all room configurations.
            </p>
            <button
              type="button"
              onClick={() => {
                setSharingFilter('All');
                setAcFilter('All');
                setOnlyAvailable(false);
              }}
              className="mt-4 min-h-[40px] px-4 py-2 text-sm font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-lg cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
            {filteredRooms.map((room) => (
              <article
                key={room.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
              >
                <div className="aspect-[4/3] bg-slate-100 overflow-hidden border-b border-slate-200">
                  <ResilientImage
                    src={room.image_url}
                    alt={`Room ${room.room_number} ${room.sharing_type} ${room.ac_type}`}
                    className="w-full h-full object-cover"
                    fallbackLabel={`Room ${room.room_number} · ${room.sharing_type}`}
                  />
                </div>

                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                      <span className="font-mono">
                        Room {room.room_number} · Floor {room.floor}
                      </span>
                      <span
                        className={`font-semibold tabular-nums ${
                          room.vacant_beds > 0
                            ? 'text-emerald-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {room.vacant_beds > 0
                          ? `${room.vacant_beds} of ${room.total_beds} beds open`
                          : 'Currently Full'}
                      </span>
                    </div>

                    <h3 className="mt-2 font-display text-xl font-bold text-slate-900">
                      {room.sharing_type} Sharing · {room.ac_type}
                    </h3>

                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                      {room.description}
                    </p>

                    <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                      Includes: {room.amenities_list}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                      <div>
                        <span className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                          {formatINR(room.monthly_rent)}
                        </span>
                        <span className="text-xs text-slate-500"> / month</span>
                      </div>
                      <span className="text-xs text-slate-600 tabular-nums">
                        Deposit: {formatINR(room.security_deposit)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => scrollToInquiry(room)}
                      className={`w-full min-h-[44px] py-2.5 px-4 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        room.vacant_beds > 0
                          ? 'bg-slate-900 hover:bg-blue-700 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {room.vacant_beds > 0
                        ? `Book Visit for Room ${room.room_number}`
                        : 'Join Waitlist / Inquire'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Amenities & Property Gallery */}
      <section id="amenities" className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-6">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
                Designed for uninterrupted work, study, and comfortable daily routines.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                Every resident has access to communal study tables, an open-view hygienic dining kitchen, automated laundry, and reliable backup power.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                {[
                  [
                    '01. Open-View Hygienic Kitchen',
                    'RO-purified cooking water, commercial cold storage, and FSSAI-compliant prep.',
                  ],
                  [
                    '02. Quiet Study & Co-Work Lounge',
                    'Acoustic lounge seating with high-density power outlets and dual-band Wi-Fi.',
                  ],
                  [
                    '03. Automated Laundry & Ironing',
                    'Bosch front-load washing machines on every floor with covered terrace drying.',
                  ],
                  [
                    '04. Daily Room Housekeeping',
                    'Trained staff clean bathrooms and common floors daily with eco-safe disinfectants.',
                  ],
                  [
                    '05. Full DG Power & Solar Hot Water',
                    'Automatic diesel generator backup for Wi-Fi, lighting, and study desks.',
                  ],
                  [
                    '06. Digital Resident Helpdesk',
                    'Pay monthly rent, download receipts, and track maintenance tickets online.',
                  ],
                ].map(([title, desc]) => (
                  <div key={title} className="pt-3 border-t border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                      {desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <ResilientImage
                  src={
                    cms.dining_image_url ||
                    '/src/assets/images/facility_dining_lounge_1794555051861.jpg'
                  }
                  alt="Kora Residency communal dining hall and co-study cafe"
                  className="w-full h-full object-cover"
                  fallbackLabel="Dining Hall & Study Lounge"
                />
              </div>
            </div>
          </div>

          {/* CMS Managed Gallery Strip */}
          {gallery.length > 0 && (
            <div className="mt-12 sm:mt-14 pt-8 sm:pt-10 border-t border-slate-200">
              <div className="flex items-baseline justify-between mb-6">
                <h3 className="font-display text-xl font-bold text-slate-900">
                  Inside the Residence
                </h3>
                <span className="text-xs text-slate-500">
                  {gallery.length} architectural views
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
                {gallery.map((photo) => (
                  <figure key={photo.id} className="group">
                    <div className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                      <ResilientImage
                        src={photo.image_url}
                        alt={photo.title}
                        className="w-full h-full object-cover"
                        fallbackLabel={photo.title}
                      />
                    </div>
                    <figcaption className="mt-2">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {photo.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        {photo.category}
                      </div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Weekly Mess Menu & Public Notices */}
      <section id="mess-menu" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          <div className="lg:col-span-8">
            <div className="mb-6">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Weekly Mess Menu
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Balanced vegetarian and non-vegetarian options prepared fresh daily.
              </p>
            </div>

            {/* Day Selector Tabs: 7-col grid on mobile, inline row on sm+ */}
            <div className="grid grid-cols-7 sm:inline-flex gap-1 p-1 bg-slate-200/70 rounded-lg mb-6 w-full sm:w-auto">
              {messMenu.map((day) => (
                <button
                  key={day.day_of_week}
                  type="button"
                  onClick={() => setSelectedDay(day.day_of_week)}
                  className={`min-h-[38px] px-1.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap text-center cursor-pointer ${
                    selectedDay === day.day_of_week
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {day.day_of_week.slice(0, 3)}
                </button>
              ))}
            </div>

            {activeMenuDay && (
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                {[
                  ['Breakfast · 7:30 AM – 9:30 AM', activeMenuDay.breakfast],
                  ['Lunch · 12:30 PM – 2:30 PM', activeMenuDay.lunch],
                  ['Evening Snack · 5:00 PM – 6:15 PM', activeMenuDay.evening_snack],
                  ['Dinner · 8:00 PM – 10:00 PM', activeMenuDay.dinner],
                ].map(([mealLabel, items]) => (
                  <div
                    key={mealLabel}
                    className="px-4 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-6 items-baseline"
                  >
                    <div className="sm:col-span-4 text-xs font-semibold text-slate-500">
                      {mealLabel}
                    </div>
                    <div className="sm:col-span-8 text-sm font-medium text-slate-900">
                      {items}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Public Announcements */}
          <div id="notices" className="lg:col-span-4">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 mb-2">
              Residence Notices
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              Latest updates from property management.
            </p>

            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
              {announcements.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  No public notices at the moment.
                </div>
              ) : (
                announcements.map((item) => (
                  <div key={item.id} className="p-5">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1.5">
                      <span>{item.pinned ? 'Pinned Notice' : 'Update'}</span>
                      <span className="tabular-nums">
                        {formatDateShort(item.created_at)}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Book a Visit / Lead Inquiry Form */}
      <section id="book-visit" className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-5">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Schedule a Property Tour or Request a Callback
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                Visit in person to inspect available rooms, sample the dining kitchen, and complete zero-brokerage booking on the spot.
              </p>

              <div className="mt-8 space-y-4 pt-6 border-t border-slate-200 text-sm text-slate-700">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-blue-700 mt-1 shrink-0" />
                  <span>{cms.property_address}</span>
                </div>
                <a
                  href={`tel:${(cms.contact_phone || '').replace(/\s+/g, '')}`}
                  className="flex items-center gap-3 hover:text-blue-700 transition-colors"
                >
                  <Phone className="w-4 h-4 text-blue-700 shrink-0" />
                  <span className="tabular-nums">{cms.contact_phone}</span>
                </a>
                <a
                  href={`mailto:${cms.contact_email || ''}`}
                  className="flex items-center gap-3 hover:text-blue-700 transition-colors"
                >
                  <Mail className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>{cms.contact_email}</span>
                </a>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>Visiting Hours: {cms.visiting_hours}</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="border border-slate-200 rounded-xl p-5 sm:p-8 bg-[#F8FAFC]">
                {inquirySuccess ? (
                  <div className="py-8 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
                    <h3 className="font-display text-xl font-bold text-slate-900">
                      Visit Request Confirmed
                    </h3>
                    <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
                      Thank you, {inquirySuccess.name}. Your booking reference is{' '}
                      <span className="font-mono font-semibold text-slate-900">
                        {inquirySuccess.reference}
                      </span>
                      . Our property manager will confirm your slot shortly.
                    </p>
                    <button
                      type="button"
                      onClick={() => setInquirySuccess(null)}
                      className="mt-6 min-h-[44px] px-5 py-2 text-sm font-semibold text-blue-700 border border-blue-200 bg-white rounded-lg hover:bg-blue-50 cursor-pointer"
                    >
                      Submit Another Request
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleInquirySubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Siddharth Joshi"
                          className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98450 00000"
                          className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Email Address
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Preferred Visit Date
                        </label>
                        <input
                          type="date"
                          required
                          value={visitDate}
                          onChange={(e) => setVisitDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Room Sharing Preference
                        </label>
                        <select
                          value={preferredSharing}
                          onChange={(e) =>
                            setPreferredSharing(
                              e.target.value as 'Single' | 'Double' | 'Triple'
                            )
                          }
                          className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                        >
                          <option value="Single">Single Occupancy</option>
                          <option value="Double">Double Sharing</option>
                          <option value="Triple">Triple Sharing</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Climate Preference
                        </label>
                        <select
                          value={preferredAc}
                          onChange={(e) =>
                            setPreferredAc(e.target.value as 'AC' | 'Non-AC')
                          }
                          className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                        >
                          <option value="AC">Air Conditioned (AC)</option>
                          <option value="Non-AC">Non-AC (Ventilated)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Move-in Timeline or Questions
                      </label>
                      <textarea
                        rows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Share expected move-in date, college/company, or room questions..."
                        className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                      />
                    </div>

                    {inquiryError && (
                      <p className="text-sm text-red-600 font-medium">
                        {inquiryError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full sm:w-auto min-h-[44px] px-6 py-3 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                    >
                      {submitting ? 'Submitting...' : 'Schedule Visit / Request Callback'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="bg-slate-900 text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="font-display text-base font-bold text-white">
              {cms.brand_name || 'Kora Residency'}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {cms.property_address} · {cms.contact_email}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-5 sm:gap-6 text-xs text-slate-400">
            <a href="#rooms" className="py-1 hover:text-white transition-colors">
              Rooms
            </a>
            <a href="#mess-menu" className="py-1 hover:text-white transition-colors">
              Mess Menu
            </a>
            <a href="#book-visit" className="py-1 hover:text-white transition-colors">
              Book a Visit
            </a>
            <button
              type="button"
              onClick={onOpenPortal}
              className="py-1 text-white font-semibold hover:underline underline-offset-4 cursor-pointer"
            >
              Resident & Admin Portal
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
