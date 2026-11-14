export type UserRole = 'admin' | 'tenant';

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  fullName: string;
  tenantId: number | null;
}

export interface Bed {
  id: number;
  room_id: number;
  bed_label: string;
  status: 'Vacant' | 'Occupied' | 'Reserved';
  tenant_id: number | null;
  tenant_name?: string | null;
  tenant_phone?: string | null;
  tenant_email?: string | null;
}

export interface Room {
  id: number;
  room_number: string;
  floor: number;
  sharing_type: 'Single' | 'Double' | 'Triple';
  ac_type: 'AC' | 'Non-AC';
  monthly_rent: number;
  security_deposit: number;
  total_beds: number;
  description: string;
  image_url: string;
  amenities_list: string;
  status: 'Active' | 'Maintenance';
  beds: Bed[];
  vacant_beds: number;
  occupied_beds: number;
}

export interface Tenant {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  kyc_id_type: 'Aadhaar' | 'Passport' | 'Driving License' | 'PAN';
  kyc_id_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  occupation_or_college: string;
  check_in_date: string;
  check_out_date: string | null;
  security_deposit_paid: number;
  deposit_status: 'Held' | 'Pending' | 'Refunded';
  status: 'Active' | 'Checked Out';
  bed_id?: number | null;
  bed_label?: string | null;
  room_id?: number | null;
  room_number?: string | null;
  monthly_rent?: number | null;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  tenant_id: number;
  room_id: number;
  room_number?: string;
  tenant_name?: string;
  tenant_phone?: string;
  billing_month: string;
  rent_amount: number;
  electricity_amount: number;
  other_charges: number;
  total_amount: number;
  due_date: string;
  paid_date: string | null;
  payment_method: string | null;
  status: 'Paid' | 'Pending' | 'Overdue';
}

export interface Expense {
  id: number;
  expense_date: string;
  category:
    | 'Groceries & Mess'
    | 'Utilities'
    | 'Maintenance'
    | 'Housekeeping'
    | 'Internet & Security'
    | 'Other';
  description: string;
  amount: number;
  recorded_by: string;
}

export interface Complaint {
  id: number;
  ticket_number: string;
  tenant_id: number;
  room_id: number | null;
  room_number?: string | null;
  tenant_name?: string;
  tenant_phone?: string;
  category: 'Maintenance' | 'Food & Mess' | 'Wi-Fi & IT' | 'Housekeeping' | 'Security';
  priority: 'Low' | 'Medium' | 'High';
  title: string;
  description: string;
  assigned_to: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  admin_notes: string;
  created_at: string;
  updated_at: string;
}

export interface Inquiry {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  preferred_sharing: 'Single' | 'Double' | 'Triple';
  preferred_ac: 'AC' | 'Non-AC';
  visit_date: string;
  message: string;
  status: 'New' | 'Contacted' | 'Scheduled' | 'Converted' | 'Closed';
  created_at: string;
}

export interface MessMenuDay {
  id: number;
  day_of_week: string;
  breakfast: string;
  lunch: string;
  evening_snack: string;
  dinner: string;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  audience: 'All Residents' | 'Public & Residents';
  pinned: number;
  created_at: string;
}

export interface GalleryPhoto {
  id: number;
  title: string;
  category: 'Rooms' | 'Common Areas' | 'Dining' | 'Exterior';
  image_url: string;
  caption: string;
}

export interface PublicSiteData {
  cms: Record<string, string>;
  rooms: Room[];
  messMenu: MessMenuDay[];
  announcements: Announcement[];
  gallery: GalleryPhoto[];
  summary: {
    totalBeds: number;
    vacantBeds: number;
    roomCount: number;
  };
}

export interface AdminOverviewData {
  kpis: {
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    occupancyRate: number;
    collectedRevenue: number;
    pendingDues: number;
    totalExpenses: number;
    openComplaints: number;
  };
  rooms: Room[];
  tenants: Tenant[];
  invoices: Invoice[];
  expenses: Expense[];
  complaints: Complaint[];
  inquiries: Inquiry[];
  messMenu: MessMenuDay[];
  announcements: Announcement[];
  cms: Record<string, string>;
  gallery: GalleryPhoto[];
}

export interface TenantDashboardData {
  tenant: Tenant;
  bedInfo: {
    bed_id: number;
    bed_label: string;
    bed_status: string;
    room_id: number;
    room_number: string;
    floor: number;
    sharing_type: string;
    ac_type: string;
    monthly_rent: number;
    security_deposit: number;
    amenities_list: string;
    image_url: string;
  } | null;
  invoices: Invoice[];
  complaints: Complaint[];
  messMenu: MessMenuDay[];
  announcements: Announcement[];
  cms: Record<string, string>;
}
