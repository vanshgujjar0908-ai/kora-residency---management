import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  createSessionToken,
  db,
  hashPassword,
  initDatabase,
  verifyPassword,
  verifySessionToken,
} from './server/db.ts';
import type { SessionPayload } from './server/db.ts';

initDatabase();

interface AuthenticatedRequest extends Request {
  user?: SessionPayload;
}

function getBearerUser(req: AuthenticatedRequest): SessionPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return verifySessionToken(token);
}

function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const user = getBearerUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  req.user = user;
  next();
}

function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const user = getBearerUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required' });
    return;
  }
  req.user = user;
  next();
}

interface RoomRow {
  id: number;
  room_number: string;
  floor: number;
  sharing_type: string;
  ac_type: string;
  monthly_rent: number;
  security_deposit: number;
  total_beds: number;
  description: string;
  image_url: string;
  amenities_list: string;
  status: string;
  created_at: string;
}

function getRoomsWithBeds() {
  const rooms = db
    .prepare('SELECT * FROM rooms ORDER BY floor ASC, room_number ASC')
    .all() as RoomRow[];

  const beds = db
    .prepare(
      `SELECT b.*, t.full_name as tenant_name, t.phone as tenant_phone, t.email as tenant_email
       FROM beds b
       LEFT JOIN tenants t ON b.tenant_id = t.id
       ORDER BY b.room_id ASC, b.bed_label ASC`
    )
    .all() as Array<Record<string, unknown>>;

  const bedsByRoom = new Map<number, Array<Record<string, unknown>>>();
  for (const bed of beds) {
    const rid = bed.room_id as number;
    const list = bedsByRoom.get(rid) || [];
    list.push(bed);
    bedsByRoom.set(rid, list);
  }

  return rooms.map((room) => {
    const roomBeds = bedsByRoom.get(room.id) || [];
    const vacantBeds = roomBeds.filter((b) => b.status === 'Vacant').length;
    const occupiedBeds = roomBeds.filter((b) => b.status === 'Occupied').length;
    return {
      ...room,
      beds: roomBeds,
      vacant_beds: vacantBeds,
      occupied_beds: occupiedBeds,
    };
  });
}

function getCmsObject(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM cms_content').all() as Array<{
    key: string;
    value: string;
  }>;
  const out: Record<string, string> = {};
  for (const r of rows) {
    out[r.key] = r.value;
  }
  return out;
}

async function startServer(): Promise<void> {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '5mb' }));

  // Serve generated images reliably in both dev and production
  app.use(
    '/src/assets/images',
    express.static(path.resolve('src/assets/images'))
  );

  // =========================================================================
  // PUBLIC ROUTES
  // =========================================================================

  app.get('/api/public/site', (_req: Request, res: Response) => {
    const cms = getCmsObject();
    const rooms = getRoomsWithBeds().filter((r) => r.status === 'Active');
    const messMenu = db.prepare('SELECT * FROM mess_menu ORDER BY id ASC').all();
    const announcements = db
      .prepare(
        `SELECT * FROM announcements
         WHERE audience = 'Public & Residents'
         ORDER BY pinned DESC, created_at DESC`
      )
      .all();
    const gallery = db
      .prepare('SELECT * FROM gallery_photos ORDER BY id ASC')
      .all();

    const totalBeds = rooms.reduce(
      (sum, r) => sum + (r.beds as unknown[]).length,
      0
    );
    const vacantBeds = rooms.reduce(
      (sum, r) => sum + (r.vacant_beds as number),
      0
    );

    res.json({
      cms,
      rooms,
      messMenu,
      announcements,
      gallery,
      summary: {
        totalBeds,
        vacantBeds,
        roomCount: rooms.length,
      },
    });
  });

  app.post('/api/public/inquiries', (req: Request, res: Response) => {
    const {
      full_name,
      email,
      phone,
      preferred_sharing,
      preferred_ac,
      visit_date,
      message,
    } = req.body as Record<string, string>;

    if (!full_name?.trim() || !email?.trim() || !phone?.trim() || !visit_date?.trim()) {
      res.status(400).json({
        error: 'Name, email, phone number, and preferred visit date are required.',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    const sharing = ['Single', 'Double', 'Triple'].includes(preferred_sharing)
      ? preferred_sharing
      : 'Double';
    const ac = ['AC', 'Non-AC'].includes(preferred_ac) ? preferred_ac : 'AC';

    const result = db
      .prepare(
        `INSERT INTO inquiries (
          full_name, email, phone, preferred_sharing, preferred_ac, visit_date, message, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'New')`
      )
      .run(
        full_name.trim(),
        email.trim(),
        phone.trim(),
        sharing,
        ac,
        visit_date.trim(),
        (message || '').trim()
      );

    res.status(201).json({
      id: result.lastInsertRowid,
      reference: `INQ-${String(result.lastInsertRowid).padStart(4, '0')}`,
      message: 'Visit request recorded successfully.',
    });
  });

  // =========================================================================
  // AUTH ROUTES
  // =========================================================================

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = db
      .prepare('SELECT * FROM users WHERE lower(email) = lower(?)')
      .get(email.trim()) as
      | {
          id: number;
          email: string;
          password_hash: string;
          role: 'admin' | 'tenant';
          full_name: string;
          tenant_id: number | null;
        }
      | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      tenantId: user.tenant_id,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        tenantId: user.tenant_id,
      },
    });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  // =========================================================================
  // TENANT PORTAL ROUTES
  // =========================================================================

  app.get(
    '/api/tenant/dashboard',
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const user = req.user!;
      const requestedTenantId = req.query.tenantId
        ? Number(req.query.tenantId)
        : null;

      const targetTenantId =
        user.role === 'admin' && requestedTenantId
          ? requestedTenantId
          : user.tenantId;

      if (!targetTenantId) {
        res.status(404).json({ error: 'No resident profile linked to account.' });
        return;
      }

      const tenant = db
        .prepare('SELECT * FROM tenants WHERE id = ?')
        .get(targetTenantId) as Record<string, unknown> | undefined;

      if (!tenant) {
        res.status(404).json({ error: 'Resident record not found.' });
        return;
      }

      const bedInfo = db
        .prepare(
          `SELECT b.id as bed_id, b.bed_label, b.status as bed_status,
                  r.id as room_id, r.room_number, r.floor, r.sharing_type,
                  r.ac_type, r.monthly_rent, r.security_deposit, r.amenities_list, r.image_url
           FROM beds b
           JOIN rooms r ON b.room_id = r.id
           WHERE b.tenant_id = ?`
        )
        .get(targetTenantId) as Record<string, unknown> | undefined;

      const invoices = db
        .prepare(
          `SELECT i.*, r.room_number
           FROM invoices i
           JOIN rooms r ON i.room_id = r.id
           WHERE i.tenant_id = ?
           ORDER BY i.billing_month DESC, i.id DESC`
        )
        .all(targetTenantId);

      const complaints = db
        .prepare(
          `SELECT c.*, r.room_number
           FROM complaints c
           LEFT JOIN rooms r ON c.room_id = r.id
           WHERE c.tenant_id = ?
           ORDER BY c.created_at DESC, c.id DESC`
        )
        .all(targetTenantId);

      const messMenu = db
        .prepare('SELECT * FROM mess_menu ORDER BY id ASC')
        .all();

      const announcements = db
        .prepare(
          'SELECT * FROM announcements ORDER BY pinned DESC, created_at DESC'
        )
        .all();

      const cms = getCmsObject();

      res.json({
        tenant,
        bedInfo: bedInfo || null,
        invoices,
        complaints,
        messMenu,
        announcements,
        cms,
      });
    }
  );

  app.post(
    '/api/tenant/invoices/:id/pay',
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const invoiceId = Number(req.params.id);
      const { payment_method } = req.body as { payment_method?: string };
      const invoice = db
        .prepare('SELECT * FROM invoices WHERE id = ?')
        .get(invoiceId) as { id: number; tenant_id: number; status: string } | undefined;

      if (!invoice) {
        res.status(404).json({ error: 'Invoice not found.' });
        return;
      }
      if (
        req.user!.role === 'tenant' &&
        invoice.tenant_id !== req.user!.tenantId
      ) {
        res.status(403).json({ error: 'Access denied.' });
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const method = payment_method?.trim() || 'UPI';

      db.prepare(
        `UPDATE invoices SET status = 'Paid', paid_date = ?, payment_method = ? WHERE id = ?`
      ).run(today, method, invoiceId);

      res.json({ success: true, paid_date: today, payment_method: method });
    }
  );

  app.post(
    '/api/tenant/complaints',
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const tenantId = req.user!.tenantId;
      if (!tenantId) {
        res.status(400).json({ error: 'Resident profile required to file ticket.' });
        return;
      }

      const { category, priority, title, description } = req.body as Record<
        string,
        string
      >;
      if (!title?.trim() || !description?.trim()) {
        res.status(400).json({ error: 'Ticket title and description are required.' });
        return;
      }

      const validCategory = [
        'Maintenance',
        'Food & Mess',
        'Wi-Fi & IT',
        'Housekeeping',
        'Security',
      ].includes(category)
        ? category
        : 'Maintenance';
      const validPriority = ['Low', 'Medium', 'High'].includes(priority)
        ? priority
        : 'Medium';

      const bed = db
        .prepare('SELECT room_id FROM beds WHERE tenant_id = ?')
        .get(tenantId) as { room_id: number } | undefined;

      const nextNumRow = db
        .prepare('SELECT COALESCE(MAX(id), 0) + 1044 as next_num FROM complaints')
        .get() as { next_num: number };
      const ticketNumber = `TKT-${nextNumRow.next_num}`;

      const result = db
        .prepare(
          `INSERT INTO complaints (
            ticket_number, tenant_id, room_id, category, priority,
            title, description, assigned_to, status, admin_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Unassigned', 'Open', '')`
        )
        .run(
          ticketNumber,
          tenantId,
          bed ? bed.room_id : null,
          validCategory,
          validPriority,
          title.trim(),
          description.trim()
        );

      res.status(201).json({
        id: result.lastInsertRowid,
        ticket_number: ticketNumber,
      });
    }
  );

  // =========================================================================
  // ADMIN DASHBOARD ROUTES
  // =========================================================================

  app.get('/api/admin/overview', requireAdmin, (_req: Request, res: Response) => {
    const rooms = getRoomsWithBeds();
    const tenants = db
      .prepare(
        `SELECT t.*, b.id as bed_id, b.bed_label, r.id as room_id, r.room_number, r.monthly_rent
         FROM tenants t
         LEFT JOIN beds b ON b.tenant_id = t.id
         LEFT JOIN rooms r ON b.room_id = r.id
         ORDER BY t.status ASC, t.created_at DESC`
      )
      .all();

    const invoices = db
      .prepare(
        `SELECT i.*, t.full_name as tenant_name, t.phone as tenant_phone, r.room_number
         FROM invoices i
         JOIN tenants t ON i.tenant_id = t.id
         JOIN rooms r ON i.room_id = r.id
         ORDER BY i.billing_month DESC, i.id DESC`
      )
      .all() as Array<{ status: string; total_amount: number }>;

    const expenses = db
      .prepare('SELECT * FROM expenses ORDER BY expense_date DESC, id DESC')
      .all() as Array<{ amount: number }>;

    const complaints = db
      .prepare(
        `SELECT c.*, t.full_name as tenant_name, t.phone as tenant_phone, r.room_number
         FROM complaints c
         JOIN tenants t ON c.tenant_id = t.id
         LEFT JOIN rooms r ON c.room_id = r.id
         ORDER BY CASE c.status WHEN 'Open' THEN 1 WHEN 'In Progress' THEN 2 ELSE 3 END, c.created_at DESC`
      )
      .all() as Array<{ status: string }>;

    const inquiries = db
      .prepare('SELECT * FROM inquiries ORDER BY created_at DESC, id DESC')
      .all();

    const messMenu = db.prepare('SELECT * FROM mess_menu ORDER BY id ASC').all();
    const announcements = db
      .prepare('SELECT * FROM announcements ORDER BY pinned DESC, created_at DESC')
      .all();
    const cms = getCmsObject();
    const gallery = db
      .prepare('SELECT * FROM gallery_photos ORDER BY id ASC')
      .all();

    const totalBeds = rooms.reduce(
      (acc, r) => acc + (r.beds as unknown[]).length,
      0
    );
    const occupiedBeds = rooms.reduce(
      (acc, r) => acc + (r.occupied_beds as number),
      0
    );
    const vacantBeds = totalBeds - occupiedBeds;
    const collectedRevenue = invoices
      .filter((i) => i.status === 'Paid')
      .reduce((acc, i) => acc + i.total_amount, 0);
    const pendingDues = invoices
      .filter((i) => i.status !== 'Paid')
      .reduce((acc, i) => acc + i.total_amount, 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const openComplaints = complaints.filter(
      (c) => c.status !== 'Resolved'
    ).length;

    res.json({
      kpis: {
        totalBeds,
        occupiedBeds,
        vacantBeds,
        occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
        collectedRevenue,
        pendingDues,
        totalExpenses,
        openComplaints,
      },
      rooms,
      tenants,
      invoices,
      expenses,
      complaints,
      inquiries,
      messMenu,
      announcements,
      cms,
      gallery,
    });
  });

  // Room CRUD
  app.post('/api/admin/rooms', requireAdmin, (req: Request, res: Response) => {
    const {
      room_number,
      floor,
      sharing_type,
      ac_type,
      monthly_rent,
      security_deposit,
      description,
      image_url,
      amenities_list,
    } = req.body as Record<string, string | number>;

    if (!room_number || !sharing_type || !ac_type || monthly_rent === undefined) {
      res.status(400).json({ error: 'Room number, sharing, AC type, and rent are required.' });
      return;
    }

    const totalBeds =
      sharing_type === 'Single' ? 1 : sharing_type === 'Double' ? 2 : 3;

    const defaultImages: Record<string, string> = {
      Single: '/src/assets/images/room_single_ac_1794555050578.jpg',
      Double: '/src/assets/images/room_double_sharing_1794555050160.jpg',
      Triple: '/src/assets/images/room_triple_sharing_1794555050621.jpg',
    };

    try {
      const tx = db.transaction(() => {
        const resRoom = db
          .prepare(
            `INSERT INTO rooms (
              room_number, floor, sharing_type, ac_type, monthly_rent,
              security_deposit, total_beds, description, image_url, amenities_list, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`
          )
          .run(
            String(room_number).trim(),
            Number(floor) || 1,
            String(sharing_type),
            String(ac_type),
            Number(monthly_rent),
            Number(security_deposit) || Number(monthly_rent) * 2,
            totalBeds,
            String(description || ''),
            String(image_url || defaultImages[String(sharing_type)] || ''),
            String(amenities_list || 'Wardrobe, Study Desk, High-Speed Wi-Fi')
          );

        const roomId = resRoom.lastInsertRowid as number;
        const labels = ['A', 'B', 'C'];
        const insertBed = db.prepare(
          'INSERT INTO beds (room_id, bed_label, status) VALUES (?, ?, ?)'
        );
        for (let i = 0; i < totalBeds; i++) {
          insertBed.run(roomId, labels[i], 'Vacant');
        }
        return roomId;
      });

      const roomId = tx();
      res.status(201).json({ id: roomId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to add room';
      res.status(400).json({ error: msg.includes('UNIQUE') ? 'Room number already exists.' : msg });
    }
  });

  app.patch('/api/admin/rooms/:id', requireAdmin, (req: Request, res: Response) => {
    const roomId = Number(req.params.id);
    const {
      monthly_rent,
      security_deposit,
      ac_type,
      description,
      image_url,
      amenities_list,
      status,
    } = req.body as Record<string, string | number>;

    const existing = db
      .prepare('SELECT * FROM rooms WHERE id = ?')
      .get(roomId) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    db.prepare(
      `UPDATE rooms
       SET monthly_rent = ?, security_deposit = ?, ac_type = ?,
           description = ?, image_url = ?, amenities_list = ?, status = ?
       WHERE id = ?`
    ).run(
      monthly_rent !== undefined ? Number(monthly_rent) : existing.monthly_rent,
      security_deposit !== undefined
        ? Number(security_deposit)
        : existing.security_deposit,
      ac_type || existing.ac_type,
      description !== undefined ? String(description) : existing.description,
      image_url !== undefined ? String(image_url) : existing.image_url,
      amenities_list !== undefined
        ? String(amenities_list)
        : existing.amenities_list,
      status || existing.status,
      roomId
    );

    res.json({ success: true });
  });

  // Bed Assignment & Vacate
  app.post(
    '/api/admin/beds/:bedId/assign',
    requireAdmin,
    (req: Request, res: Response) => {
      const bedId = Number(req.params.bedId);
      const { tenant_id } = req.body as { tenant_id?: number };
      if (!tenant_id) {
        res.status(400).json({ error: 'Tenant selection is required.' });
        return;
      }

      const bed = db
        .prepare('SELECT * FROM beds WHERE id = ?')
        .get(bedId) as { id: number; status: string } | undefined;
      if (!bed) {
        res.status(404).json({ error: 'Bed not found.' });
        return;
      }

      const tx = db.transaction(() => {
        db.prepare(
          `UPDATE beds SET status = 'Vacant', tenant_id = NULL WHERE tenant_id = ?`
        ).run(tenant_id);
        db.prepare(
          `UPDATE beds SET status = 'Occupied', tenant_id = ? WHERE id = ?`
        ).run(tenant_id, bedId);
        db.prepare(`UPDATE tenants SET status = 'Active' WHERE id = ?`).run(
          tenant_id
        );
      });
      tx();
      res.json({ success: true });
    }
  );

  app.post(
    '/api/admin/beds/:bedId/vacate',
    requireAdmin,
    (req: Request, res: Response) => {
      const bedId = Number(req.params.bedId);
      db.prepare(
        `UPDATE beds SET status = 'Vacant', tenant_id = NULL WHERE id = ?`
      ).run(bedId);
      res.json({ success: true });
    }
  );

  // Tenant Onboarding & Checkout
  app.post('/api/admin/tenants', requireAdmin, (req: Request, res: Response) => {
    const {
      full_name,
      email,
      phone,
      kyc_id_type,
      kyc_id_number,
      emergency_contact_name,
      emergency_contact_phone,
      occupation_or_college,
      check_in_date,
      security_deposit_paid,
      bed_id,
    } = req.body as Record<string, string | number>;

    if (
      !full_name ||
      !email ||
      !phone ||
      !kyc_id_type ||
      !kyc_id_number ||
      !emergency_contact_name ||
      !emergency_contact_phone
    ) {
      res.status(400).json({ error: 'All mandatory KYC and contact fields are required.' });
      return;
    }

    try {
      const tx = db.transaction(() => {
        const result = db
          .prepare(
            `INSERT INTO tenants (
              full_name, email, phone, kyc_id_type, kyc_id_number,
              emergency_contact_name, emergency_contact_phone, occupation_or_college,
              check_in_date, security_deposit_paid, deposit_status, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Held', 'Active')`
          )
          .run(
            String(full_name).trim(),
            String(email).trim(),
            String(phone).trim(),
            String(kyc_id_type),
            String(kyc_id_number).trim(),
            String(emergency_contact_name).trim(),
            String(emergency_contact_phone).trim(),
            String(occupation_or_college || '').trim(),
            String(check_in_date || new Date().toISOString().slice(0, 10)),
            Number(security_deposit_paid) || 0
          );

        const tenantId = result.lastInsertRowid as number;

        if (bed_id) {
          db.prepare(
            `UPDATE beds SET status = 'Occupied', tenant_id = ? WHERE id = ?`
          ).run(tenantId, Number(bed_id));
        }

        // Create resident portal login automatically (default password: tenant123)
        db.prepare(
          `INSERT INTO users (email, password_hash, role, full_name, tenant_id)
           VALUES (?, ?, 'tenant', ?, ?)`
        ).run(
          String(email).trim(),
          hashPassword('tenant123'),
          String(full_name).trim(),
          tenantId
        );

        return tenantId;
      });

      const tenantId = tx();
      res.status(201).json({
        id: tenantId,
        defaultPortalPassword: 'tenant123',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to onboard tenant';
      res.status(400).json({
        error: msg.includes('UNIQUE')
          ? 'A resident with this email already exists.'
          : msg,
      });
    }
  });

  app.post(
    '/api/admin/tenants/:id/checkout',
    requireAdmin,
    (req: Request, res: Response) => {
      const tenantId = Number(req.params.id);
      const today = new Date().toISOString().slice(0, 10);
      const tx = db.transaction(() => {
        db.prepare(
          `UPDATE tenants
           SET status = 'Checked Out', check_out_date = ?, deposit_status = 'Refunded'
           WHERE id = ?`
        ).run(today, tenantId);
        db.prepare(
          `UPDATE beds SET status = 'Vacant', tenant_id = NULL WHERE tenant_id = ?`
        ).run(tenantId);
      });
      tx();
      res.json({ success: true });
    }
  );

  // Invoices & Rent Billing
  app.post(
    '/api/admin/invoices/generate',
    requireAdmin,
    (req: Request, res: Response) => {
      const { billing_month, due_date, electricity_amount } = req.body as {
        billing_month?: string;
        due_date?: string;
        electricity_amount?: number;
      };
      const month = billing_month || new Date().toISOString().slice(0, 7);
      const due = due_date || `${month}-05`;
      const elec = Number(electricity_amount) || 500;

      const occupied = db
        .prepare(
          `SELECT t.id as tenant_id, r.id as room_id, r.monthly_rent
           FROM tenants t
           JOIN beds b ON b.tenant_id = t.id
           JOIN rooms r ON b.room_id = r.id
           WHERE t.status = 'Active'`
        )
        .all() as Array<{
        tenant_id: number;
        room_id: number;
        monthly_rent: number;
      }>;

      let created = 0;
      const insertInv = db.prepare(`
        INSERT OR IGNORE INTO invoices (
          invoice_number, tenant_id, room_id, billing_month,
          rent_amount, electricity_amount, other_charges, total_amount,
          due_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'Pending')
      `);

      const tx = db.transaction(() => {
        for (const row of occupied) {
          const invNum = `INV-${month.replace('-', '')}-${row.tenant_id}${Math.floor(
            10 + Math.random() * 89
          )}`;
          const total = row.monthly_rent + elec;
          const resInsert = insertInv.run(
            invNum,
            row.tenant_id,
            row.room_id,
            month,
            row.monthly_rent,
            elec,
            total,
            due
          );
          if (resInsert.changes > 0) created++;
        }
      });
      tx();

      res.json({ created, billing_month: month });
    }
  );

  app.patch(
    '/api/admin/invoices/:id/pay',
    requireAdmin,
    (req: Request, res: Response) => {
      const invoiceId = Number(req.params.id);
      const { payment_method } = req.body as { payment_method?: string };
      const today = new Date().toISOString().slice(0, 10);
      db.prepare(
        `UPDATE invoices SET status = 'Paid', paid_date = ?, payment_method = ? WHERE id = ?`
      ).run(today, payment_method || 'Bank Transfer', invoiceId);
      res.json({ success: true });
    }
  );

  // Daily Expenses
  app.post('/api/admin/expenses', requireAdmin, (req: Request, res: Response) => {
    const { expense_date, category, description, amount } = req.body as Record<
      string,
      string | number
    >;
    if (!description || !amount || Number(amount) <= 0) {
      res.status(400).json({ error: 'Description and positive amount are required.' });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO expenses (expense_date, category, description, amount, recorded_by)
         VALUES (?, ?, ?, ?, 'Admin')`
      )
      .run(
        String(expense_date || new Date().toISOString().slice(0, 10)),
        String(category || 'Other'),
        String(description).trim(),
        Number(amount)
      );

    res.status(201).json({ id: result.lastInsertRowid });
  });

  app.delete(
    '/api/admin/expenses/:id',
    requireAdmin,
    (req: Request, res: Response) => {
      db.prepare('DELETE FROM expenses WHERE id = ?').run(Number(req.params.id));
      res.json({ success: true });
    }
  );

  // Complaints
  app.patch(
    '/api/admin/complaints/:id',
    requireAdmin,
    (req: Request, res: Response) => {
      const id = Number(req.params.id);
      const { status, assigned_to, admin_notes } = req.body as Record<
        string,
        string
      >;
      db.prepare(
        `UPDATE complaints
         SET status = COALESCE(?, status),
             assigned_to = COALESCE(?, assigned_to),
             admin_notes = COALESCE(?, admin_notes),
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(status || null, assigned_to || null, admin_notes ?? null, id);
      res.json({ success: true });
    }
  );

  // Inquiries
  app.patch(
    '/api/admin/inquiries/:id',
    requireAdmin,
    (req: Request, res: Response) => {
      const id = Number(req.params.id);
      const { status } = req.body as { status: string };
      db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run(status, id);
      res.json({ success: true });
    }
  );

  // CMS Content
  app.put('/api/admin/cms', requireAdmin, (req: Request, res: Response) => {
    const updates = req.body as Record<string, string>;
    const upsert = db.prepare(`
      INSERT INTO cms_content (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `);
    const tx = db.transaction(() => {
      for (const [key, val] of Object.entries(updates)) {
        if (typeof val === 'string') {
          upsert.run(key, val);
        }
      }
    });
    tx();
    res.json({ success: true });
  });

  // Weekly Mess Menu
  app.put(
    '/api/admin/mess-menu/:day',
    requireAdmin,
    (req: Request, res: Response) => {
      const day = req.params.day;
      const { breakfast, lunch, evening_snack, dinner } = req.body as Record<
        string,
        string
      >;
      db.prepare(
        `UPDATE mess_menu
         SET breakfast = ?, lunch = ?, evening_snack = ?, dinner = ?, updated_at = datetime('now')
         WHERE day_of_week = ?`
      ).run(breakfast, lunch, evening_snack, dinner, day);
      res.json({ success: true });
    }
  );

  // Announcements
  app.post(
    '/api/admin/announcements',
    requireAdmin,
    (req: Request, res: Response) => {
      const { title, body, audience, pinned } = req.body as {
        title?: string;
        body?: string;
        audience?: string;
        pinned?: boolean;
      };
      if (!title?.trim() || !body?.trim()) {
        res.status(400).json({ error: 'Title and notice content are required.' });
        return;
      }
      const result = db
        .prepare(
          `INSERT INTO announcements (title, body, audience, pinned) VALUES (?, ?, ?, ?)`
        )
        .run(
          title.trim(),
          body.trim(),
          audience === 'Public & Residents' ? 'Public & Residents' : 'All Residents',
          pinned ? 1 : 0
        );
      res.status(201).json({ id: result.lastInsertRowid });
    }
  );

  app.delete(
    '/api/admin/announcements/:id',
    requireAdmin,
    (req: Request, res: Response) => {
      db.prepare('DELETE FROM announcements WHERE id = ?').run(
        Number(req.params.id)
      );
      res.json({ success: true });
    }
  );

  // Gallery Photos
  app.post('/api/admin/gallery', requireAdmin, (req: Request, res: Response) => {
    const { title, category, image_url, caption } = req.body as Record<
      string,
      string
    >;
    if (!title?.trim() || !image_url?.trim()) {
      res.status(400).json({ error: 'Photo title and image source are required.' });
      return;
    }
    const validCat = ['Rooms', 'Common Areas', 'Dining', 'Exterior'].includes(
      category
    )
      ? category
      : 'Rooms';
    const result = db
      .prepare(
        `INSERT INTO gallery_photos (title, category, image_url, caption) VALUES (?, ?, ?, ?)`
      )
      .run(
        title.trim(),
        validCat,
        image_url.trim(),
        (caption || '').trim()
      );
    res.status(201).json({ id: result.lastInsertRowid });
  });

  app.delete(
    '/api/admin/gallery/:id',
    requireAdmin,
    (req: Request, res: Response) => {
      db.prepare('DELETE FROM gallery_photos WHERE id = ?').run(
        Number(req.params.id)
      );
      res.json({ success: true });
    }
  );

  // =========================================================================
  // VITE / STATIC SERVING
  // =========================================================================

  const distDir = path.resolve('dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Kora Residency server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
