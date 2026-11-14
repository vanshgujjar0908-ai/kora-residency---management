import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve('data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'kora_residency.db');
const SCHEMA_PATH = path.resolve('database/schema.sql');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'kora-residency-local-dev-signing-key-2026';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export interface SessionPayload {
  userId: number;
  email: string;
  role: 'admin' | 'tenant';
  fullName: string;
  tenantId: number | null;
  exp: number;
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function initDatabase(): void {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schemaSql);

  const roomCount = (
    db.prepare('SELECT COUNT(*) as count FROM rooms').get() as { count: number }
  ).count;

  if (roomCount > 0) {
    return;
  }

  const seedTransaction = db.transaction(() => {
    // 1. Seed CMS Content
    const cmsEntries: Array<[string, string]> = [
      ['brand_name', 'Kora Residency'],
      ['location_label', 'Koramangala 4th Block, Bengaluru'],
      [
        'hero_headline',
        'Thoughtfully managed urban living with zero-friction stays.',
      ],
      [
        'hero_subheadline',
        'Private and shared suites built for students and young professionals. Transparent monthly rent, fresh four-meal dining, enterprise Wi-Fi, and digital resident support.',
      ],
      ['hero_image_url', '/src/assets/images/hero_pg_exterior_1794555049870.jpg'],
      [
        'dining_image_url',
        '/src/assets/images/facility_dining_lounge_1794555051861.jpg',
      ],
      ['contact_phone', '+91 80 4123 8910'],
      ['contact_email', 'hello@koraresidency.in'],
      [
        'property_address',
        '148, 80 Feet Road, Koramangala 4th Block, Bengaluru 560034',
      ],
      ['visiting_hours', 'Daily, 9:00 AM to 8:00 PM'],
    ];
    const insertCms = db.prepare(
      'INSERT INTO cms_content (key, value) VALUES (?, ?)'
    );
    for (const [k, v] of cmsEntries) {
      insertCms.run(k, v);
    }

    // 2. Seed Rooms
    const insertRoom = db.prepare(`
      INSERT INTO rooms (
        room_number, floor, sharing_type, ac_type, monthly_rent,
        security_deposit, total_beds, description, image_url, amenities_list, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const r101 = insertRoom.run(
      '101',
      1,
      'Single',
      'AC',
      18500,
      30000,
      1,
      'Quiet corner studio suite with ergonomic workstation, private wardrobe, and attached bathroom.',
      '/src/assets/images/room_single_ac_1794555050578.jpg',
      'Split AC, Attached Bath, Study Desk, Wardrobe, 200 Mbps Wi-Fi',
      'Active'
    ).lastInsertRowid as number;

    const r102 = insertRoom.run(
      '102',
      1,
      'Single',
      'Non-AC',
      14500,
      25000,
      1,
      'Sunlit private room with cross-ventilation, ceiling fan, study corner, and attached bath.',
      '/src/assets/images/room_single_ac_1794555050578.jpg',
      'Private Balcony, Attached Bath, Study Desk, Wardrobe, Wi-Fi',
      'Active'
    ).lastInsertRowid as number;

    const r201 = insertRoom.run(
      '201',
      2,
      'Double',
      'AC',
      11500,
      20000,
      2,
      'Bright twin-sharing suite featuring two dedicated study desks, personal lockers, and split AC.',
      '/src/assets/images/room_double_sharing_1794555050160.jpg',
      'Split AC, Dual Study Desks, Attached Bath, Individual Wardrobes',
      'Active'
    ).lastInsertRowid as number;

    const r202 = insertRoom.run(
      '202',
      2,
      'Double',
      'Non-AC',
      9500,
      18000,
      2,
      'Spacious twin room overlooking the courtyard trees with ample storage and natural light.',
      '/src/assets/images/room_double_sharing_1794555050160.jpg',
      'Courtyard View, Dual Desks, Attached Bath, High-Speed Wi-Fi',
      'Active'
    ).lastInsertRowid as number;

    const r301 = insertRoom.run(
      '301',
      3,
      'Triple',
      'AC',
      8500,
      15000,
      3,
      'Tailored birch-wood three-bed suite with individual privacy partitions and under-bed storage.',
      '/src/assets/images/room_triple_sharing_1794555050621.jpg',
      'Split AC, Privacy Partitions, Personal Lockers, Reading Lamps',
      'Active'
    ).lastInsertRowid as number;

    const r302 = insertRoom.run(
      '302',
      3,
      'Triple',
      'Non-AC',
      7200,
      12000,
      3,
      'Value-focused triple room with dedicated study table, individual charging bays, and daily housekeeping.',
      '/src/assets/images/room_triple_sharing_1794555050621.jpg',
      'Daily Housekeeping, Personal Lockers, High-Speed Wi-Fi, Laundry Access',
      'Active'
    ).lastInsertRowid as number;

    // 3. Seed Tenants
    const insertTenant = db.prepare(`
      INSERT INTO tenants (
        full_name, email, phone, kyc_id_type, kyc_id_number,
        emergency_contact_name, emergency_contact_phone, occupation_or_college,
        check_in_date, security_deposit_paid, deposit_status, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const t1 = insertTenant.run(
      'Aarav Mehta',
      'aarav.mehta@koraresidency.in',
      '+91 98450 11223',
      'Aadhaar',
      'XXXX-XXXX-4821',
      'Rajesh Mehta',
      '+91 98201 44556',
      'Software Engineer, FinStack',
      '2026-06-01',
      20000,
      'Held',
      'Active'
    ).lastInsertRowid as number;

    const t2 = insertTenant.run(
      'Priya Nair',
      'priya.nair@koraresidency.in',
      '+91 97400 88991',
      'Passport',
      'Z4829103',
      'Sunita Nair',
      '+91 94471 33442',
      'M.Des Student, Srishti Institute',
      '2026-07-15',
      30000,
      'Held',
      'Active'
    ).lastInsertRowid as number;

    const t3 = insertTenant.run(
      'Rohan Kulkarni',
      'rohan.k@koraresidency.in',
      '+91 99001 77665',
      'Aadhaar',
      'XXXX-XXXX-9014',
      'Anil Kulkarni',
      '+91 98220 55441',
      'Data Analyst, CloudNine',
      '2026-08-01',
      18000,
      'Held',
      'Active'
    ).lastInsertRowid as number;

    const t4 = insertTenant.run(
      'Devika Sharma',
      'devika.s@koraresidency.in',
      '+91 96112 34567',
      'Driving License',
      'KA03-20230019284',
      'Meenakshi Sharma',
      '+91 98111 22334',
      'Product Intern, PayGrid',
      '2026-09-01',
      15000,
      'Held',
      'Active'
    ).lastInsertRowid as number;

    const t5 = insertTenant.run(
      'Kabir Verma',
      'kabir.v@koraresidency.in',
      '+91 98802 66778',
      'Aadhaar',
      'XXXX-XXXX-3319',
      'Suresh Verma',
      '+91 94120 99887',
      'B.Tech Final Year, PES University',
      '2026-09-10',
      15000,
      'Held',
      'Active'
    ).lastInsertRowid as number;

    const t6 = insertTenant.run(
      'Neha Deshmukh',
      'neha.d@koraresidency.in',
      '+91 97311 45670',
      'PAN',
      'ABCPD1234E',
      'Prakash Deshmukh',
      '+91 98230 11220',
      'UX Researcher, CraftLabs',
      '2026-10-01',
      12000,
      'Held',
      'Active'
    ).lastInsertRowid as number;

    // 4. Seed Beds (Leave some vacant in 102, 201, 202, 301, 302 for live availability!)
    const insertBed = db.prepare(
      'INSERT INTO beds (room_id, bed_label, status, tenant_id) VALUES (?, ?, ?, ?)'
    );
    // Room 101 (1 bed) -> Occupied by Priya Nair
    insertBed.run(r101, 'A', 'Occupied', t2);
    // Room 102 (1 bed) -> Vacant
    insertBed.run(r102, 'A', 'Vacant', null);
    // Room 201 (2 beds) -> 1 Occupied (Aarav), 1 Vacant
    insertBed.run(r201, 'A', 'Occupied', t1);
    insertBed.run(r201, 'B', 'Vacant', null);
    // Room 202 (2 beds) -> 1 Occupied (Rohan), 1 Vacant
    insertBed.run(r202, 'A', 'Occupied', t3);
    insertBed.run(r202, 'B', 'Vacant', null);
    // Room 301 (3 beds) -> 2 Occupied (Devika, Kabir), 1 Vacant
    insertBed.run(r301, 'A', 'Occupied', t4);
    insertBed.run(r301, 'B', 'Occupied', t5);
    insertBed.run(r301, 'C', 'Vacant', null);
    // Room 302 (3 beds) -> 1 Occupied (Neha), 2 Vacant
    insertBed.run(r302, 'A', 'Occupied', t6);
    insertBed.run(r302, 'B', 'Vacant', null);
    insertBed.run(r302, 'C', 'Vacant', null);

    // 5. Seed Portal Users (Admin + Demo Tenants)
    const insertUser = db.prepare(
      'INSERT INTO users (email, password_hash, role, full_name, tenant_id) VALUES (?, ?, ?, ?, ?)'
    );
    insertUser.run(
      'admin@koraresidency.in',
      hashPassword('admin123'),
      'admin',
      'Vikram Rao (Property Manager)',
      null
    );
    insertUser.run(
      'aarav.mehta@koraresidency.in',
      hashPassword('tenant123'),
      'tenant',
      'Aarav Mehta',
      t1
    );
    insertUser.run(
      'priya.nair@koraresidency.in',
      hashPassword('tenant123'),
      'tenant',
      'Priya Nair',
      t2
    );
    insertUser.run(
      'rohan.k@koraresidency.in',
      hashPassword('tenant123'),
      'tenant',
      'Rohan Kulkarni',
      t3
    );

    // 6. Seed Invoices (Oct 2026 Paid + Nov 2026 Mix of Paid/Pending/Overdue)
    const insertInvoice = db.prepare(`
      INSERT INTO invoices (
        invoice_number, tenant_id, room_id, billing_month,
        rent_amount, electricity_amount, other_charges, total_amount,
        due_date, paid_date, payment_method, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // October 2026 (Paid)
    insertInvoice.run(
      'INV-202610-101',
      t1,
      r201,
      '2026-10',
      11500,
      650,
      0,
      12150,
      '2026-10-05',
      '2026-10-03',
      'UPI',
      'Paid'
    );
    insertInvoice.run(
      'INV-202610-102',
      t2,
      r101,
      '2026-10',
      18500,
      920,
      0,
      19420,
      '2026-10-05',
      '2026-10-04',
      'Bank Transfer',
      'Paid'
    );
    insertInvoice.run(
      'INV-202610-103',
      t3,
      r202,
      '2026-10',
      9500,
      400,
      0,
      9900,
      '2026-10-05',
      '2026-10-05',
      'UPI',
      'Paid'
    );

    // November 2026
    insertInvoice.run(
      'INV-202611-201',
      t1,
      r201,
      '2026-11',
      11500,
      710,
      0,
      12210,
      '2026-11-15',
      null,
      null,
      'Pending'
    );
    insertInvoice.run(
      'INV-202611-202',
      t2,
      r101,
      '2026-11',
      18500,
      880,
      0,
      19380,
      '2026-11-05',
      '2026-11-04',
      'UPI',
      'Paid'
    );
    insertInvoice.run(
      'INV-202611-203',
      t3,
      r202,
      '2026-11',
      9500,
      420,
      0,
      9920,
      '2026-11-05',
      null,
      null,
      'Overdue'
    );
    insertInvoice.run(
      'INV-202611-204',
      t4,
      r301,
      '2026-11',
      8500,
      500,
      0,
      9000,
      '2026-11-05',
      '2026-11-02',
      'UPI',
      'Paid'
    );
    insertInvoice.run(
      'INV-202611-205',
      t5,
      r301,
      '2026-11',
      8500,
      500,
      0,
      9000,
      '2026-11-15',
      null,
      null,
      'Pending'
    );
    insertInvoice.run(
      'INV-202611-206',
      t6,
      r302,
      '2026-11',
      7200,
      350,
      0,
      7550,
      '2026-11-05',
      '2026-11-05',
      'Card',
      'Paid'
    );

    // 7. Seed Daily Expenses
    const insertExpense = db.prepare(
      'INSERT INTO expenses (expense_date, category, description, amount, recorded_by) VALUES (?, ?, ?, ?, ?)'
    );
    insertExpense.run(
      '2026-11-11',
      'Groceries & Mess',
      'Weekly fresh produce, dairy, and grains supply',
      14800,
      'Vikram Rao'
    );
    insertExpense.run(
      '2026-11-09',
      'Utilities',
      'BESCOM commercial electricity meter bill (Oct cycle)',
      18450,
      'Vikram Rao'
    );
    insertExpense.run(
      '2026-11-07',
      'Maintenance',
      'RO water purifier filter cartridge replacement (Floors 1-3)',
      3200,
      'Vikram Rao'
    );
    insertExpense.run(
      '2026-11-05',
      'Internet & Security',
      'ACT Fibernet 1 Gbps leased line renewal + CCTV cloud backup',
      5900,
      'Vikram Rao'
    );
    insertExpense.run(
      '2026-11-03',
      'Housekeeping',
      'Sanitization supplies and linen laundry service',
      4100,
      'Vikram Rao'
    );

    // 8. Seed Complaints
    const insertComplaint = db.prepare(`
      INSERT INTO complaints (
        ticket_number, tenant_id, room_id, category, priority,
        title, description, assigned_to, status, admin_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertComplaint.run(
      'TKT-1041',
      t1,
      r201,
      'Maintenance',
      'High',
      'Split AC cooling efficiency drop',
      'The AC in Room 201 is running on fan mode and not cooling below 27C since last evening.',
      'Ramesh (HVAC Tech)',
      'In Progress',
      'Technician scheduled for inspection today at 4:30 PM.'
    );
    insertComplaint.run(
      'TKT-1042',
      t3,
      r202,
      'Wi-Fi & IT',
      'Medium',
      'Intermittent packet loss on 2nd floor east wing',
      'Video calls drop briefly around 9 PM near Room 202 desk.',
      'Sandeep (IT Support)',
      'Open',
      'Checking 2nd floor Mesh AP firmware logs.'
    );
    insertComplaint.run(
      'TKT-1040',
      t2,
      r101,
      'Housekeeping',
      'Low',
      'Request extra pillow cover and bath mat',
      'Need a spare set of fresh linen for Room 101.',
      'Lakshmi (Housekeeping)',
      'Resolved',
      'Delivered to Room 101 on Nov 10.'
    );
    insertComplaint.run(
      'TKT-1043',
      t4,
      r301,
      'Food & Mess',
      'Medium',
      'Early breakfast parcel option for 7:30 AM classes',
      'Could we keep cold sandwich/fruit boxes ready for residents leaving before 8 AM?',
      'Chef Manoj',
      'Resolved',
      'Added early-bird breakfast grab box from 7:15 AM starting Monday.'
    );

    // 9. Seed Inquiries
    const insertInquiry = db.prepare(`
      INSERT INTO inquiries (
        full_name, email, phone, preferred_sharing, preferred_ac, visit_date, message, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertInquiry.run(
      'Siddharth Joshi',
      'siddharth.j@example.com',
      '+91 98451 22019',
      'Double',
      'AC',
      '2026-11-15',
      'Moving to Koramangala for a 6-month internship starting Dec 1. Would like to tour Room 201.',
      'Scheduled'
    );
    insertInquiry.run(
      'Ananya Krishnan',
      'ananya.k@example.com',
      '+91 99160 88721',
      'Single',
      'Non-AC',
      '2026-11-14',
      'Looking for a quiet private room with reliable Wi-Fi for remote work.',
      'New'
    );

    // 10. Seed Weekly Mess Menu
    const insertMenu = db.prepare(`
      INSERT INTO mess_menu (day_of_week, breakfast, lunch, evening_snack, dinner)
      VALUES (?, ?, ?, ?, ?)
    `);
    const weeklyMenu: Array<[string, string, string, string, string]> = [
      [
        'Monday',
        'Idli, Medu Vada, Sambar, Coconut Chutney, Filter Coffee / Tea',
        'Phulka, Jeera Rice, Dal Tadka, Aloo Gobi, Curd, Green Salad',
        'Masala Chai & Veg Cutlet',
        'Chapati, Steamed Rice, Paneer Butter Masala, Rasam, Fresh Fruit',
      ],
      [
        'Tuesday',
        'Aloo Paratha, Curd, Mint Chutney, Boiled Eggs / Sprouts, Tea',
        'Roti, Pulao, Rajma Masala, Bhindi Fry, Boondi Raita',
        'Cold Coffee & Banana Walnut Cake',
        'Phulka, Rice, Mix Veg Curry, Dal Fry, Gulab Jamun',
      ],
      [
        'Wednesday',
        'Poha with Peanuts, Sev, Bread Omelette / Toast, Coffee',
        'Chapati, Rice, Kadai Chicken / Kadai Paneer, Dal Palak, Salad',
        'Ginger Tea & Onion Pakoda',
        'Ghee Rice, Roti, Chana Masala, Cucumber Kosambari, Buttermilk',
      ],
      [
        'Thursday',
        'Masala Dosa, Sambar, Tomato Chutney, Fresh Watermelon, Tea',
        'Phulka, Lemon Rice, Sambar, Cabbage Poriyal, Papad, Curd',
        'Filter Coffee & Corn Chaat',
        'Chapati, Rice, Egg Curry / Veg Kofta, Dal Makhani, Salad',
      ],
      [
        'Friday',
        'Upma, Kesari Bath, Boiled Eggs / Sprouts Salad, Coffee',
        'Roti, Peas Pulao, Palak Paneer, Yellow Dal, Boondi Raita',
        'Masala Chai & Samosa with Tamarind Chutney',
        'Jeera Rice, Phulka, Chicken Biryani / Veg Dum Biryani, Mirchi Ka Salan',
      ],
      [
        'Saturday',
        'Chole Bhature (Light), Pickle, Fruit Bowl, Tea / Coffee',
        'Chapati, Steamed Rice, Aloo Matar, Moong Dal, Curd',
        'Lemon Iced Tea & Grilled Cheese Sandwich',
        'Hakka Noodles / Fried Rice, Manchurian Gravy, Clear Veg Soup',
      ],
      [
        'Sunday',
        'Plain & Cheese Omelette, Pancakes, Hash Browns, Fresh Juice',
        'Special Thali: Poori, Pulao, Paneer Tikka Masala, Dal, Ice Cream',
        'Filter Coffee & Cookies',
        'Light Khichdi, Kadhi, Roasted Papad, Pickle, Warm Milk',
      ],
    ];
    for (const row of weeklyMenu) {
      insertMenu.run(...row);
    }

    // 11. Seed Announcements
    const insertAnnouncement = db.prepare(
      'INSERT INTO announcements (title, body, audience, pinned) VALUES (?, ?, ?, ?)'
    );
    insertAnnouncement.run(
      'December Room Reservations Open',
      'Zero-brokerage early reservations are open for Single Non-AC (Room 102) and Double AC (Room 201). Book a walkthrough via the inquiry form.',
      'Public & Residents',
      1
    );
    insertAnnouncement.run(
      'Early-Bird Breakfast Box Now Available',
      'Residents with 8:00 AM classes or commutes can pick up packed fruit and sandwich boxes at the dining counter from 7:15 AM onwards.',
      'All Residents',
      1
    );
    insertAnnouncement.run(
      'Solar Water Heater Servicing Complete',
      'Scheduled winter thermal calibration is complete across Floors 1 to 3. Continuous hot water is available 24/7.',
      'All Residents',
      0
    );

    // 12. Seed Gallery Photos
    const insertGallery = db.prepare(
      'INSERT INTO gallery_photos (title, category, image_url, caption) VALUES (?, ?, ?, ?)'
    );
    insertGallery.run(
      'Courtyard Lounge & Co-Study',
      'Common Areas',
      '/src/assets/images/hero_pg_exterior_1794555049870.jpg',
      'Double-height sunlit common lounge opening onto a landscaped courtyard.'
    );
    insertGallery.run(
      'Private AC Studio (Room 101)',
      'Rooms',
      '/src/assets/images/room_single_ac_1794555050578.jpg',
      'Dedicated workstation, ergonomic chair, and quiet courtyard acoustics.'
    );
    insertGallery.run(
      'Twin-Sharing Suite (Room 201)',
      'Rooms',
      '/src/assets/images/room_double_sharing_1794555050160.jpg',
      'Two separate study zones, individual wardrobes, and natural daylight.'
    );
    insertGallery.run(
      'Triple-Sharing Suite (Room 301)',
      'Rooms',
      '/src/assets/images/room_triple_sharing_1794555050621.jpg',
      'Custom birch privacy partitions with lockable under-bed storage.'
    );
    insertGallery.run(
      'Hygienic Dining Hall & Cafe',
      'Dining',
      '/src/assets/images/facility_dining_lounge_1794555051861.jpg',
      'Open-view kitchen serving four freshly prepared meals daily.'
    );
  });

  seedTransaction();
}
