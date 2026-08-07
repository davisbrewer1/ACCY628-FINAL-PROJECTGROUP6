/**
 * Generates a realistic calendar-year 2026 MSP operational seed.
 * Run: node scripts/generate-2026-msp-seed.js
 */
const fs = require("fs");
const path = require("path");

const ACCOUNT_MGR = "33333333-3333-3333-3333-333333333303";
const BILLING = "33333333-3333-3333-3333-333333333305";
const CLIENTUSER = "33333333-3333-3333-3333-333333333307";
const CLIENTADMIN = "33333333-3333-3333-3333-333333333306";

const PLANS = {
  essentials: {
    id: "55555555-5555-5555-5555-555555555501",
    name: "Essentials",
    mrr: 1800,
    hours: 10,
    assets: 5000,
    overage: 160,
  },
  silver: {
    id: "55555555-5555-5555-5555-555555555502",
    name: "Silver",
    mrr: 2800,
    hours: 20,
    assets: 15000,
    overage: 155,
  },
  gold: {
    id: "55555555-5555-5555-5555-555555555503",
    name: "Gold",
    mrr: 4500,
    hours: 40,
    assets: 40000,
    overage: 145,
  },
};

const TECHS = [
  { id: "33333333-3333-3333-3333-333333333301", key: "terry", name: "Terry Tech", cost: 48, rate: 95 },
  { id: "33333333-3333-3333-3333-333333333302", key: "jamie", name: "Jamie Network", cost: 55, rate: 110 },
  { id: "33333333-3333-3333-3333-333333333303", key: "chris", name: "Chris Cloud", cost: 58, rate: 115 },
  { id: "33333333-3333-3333-3333-333333333304", key: "dana", name: "Dana Desktop", cost: 42, rate: 85 },
  { id: "33333333-3333-3333-3333-333333333305", key: "evan", name: "Evan Endpoint", cost: 60, rate: 120 },
  { id: "33333333-3333-3333-3333-333333333306", key: "fran", name: "Fran Firewall", cost: 62, rate: 125 },
  { id: "33333333-3333-3333-3333-333333333308", key: "kai", name: "Kai Cipher", cost: 64, rate: 130 },
  { id: "33333333-3333-3333-3333-333333333309", key: "quinn", name: "Quinn Volt", cost: 56, rate: 112 },
];

const CUSTOMERS = [
  {
    id: "11111111-1111-1111-1111-111111111101",
    name: "Northwind Manufacturing",
    industry: "Manufacturing",
    contact: "Casey Plant",
    email: "clientuser@nexus.demo",
    phone: "(662) 555-0101",
    address: "1200 Industrial Parkway",
    city: "Oxford",
    state: "MS",
    zip: "38655",
    plan: "gold",
    health: 86,
    weight: 2.2,
  },
  {
    id: "11111111-1111-1111-1111-111111111102",
    name: "Beacon Legal Group",
    industry: "Legal",
    contact: "Pat Rivera",
    email: "clientadmin@nexus.demo",
    phone: "(662) 555-0102",
    address: "44 Courthouse Square",
    city: "Oxford",
    state: "MS",
    zip: "38655",
    plan: "silver",
    health: 82,
    weight: 1.2,
  },
  {
    id: "11111111-1111-1111-1111-111111111103",
    name: "Harbor Retail Collective",
    industry: "Retail",
    contact: "Sam Harbor",
    email: "ops@harborretail.demo",
    phone: "(601) 555-0103",
    address: "890 Market Street",
    city: "Jackson",
    state: "MS",
    zip: "39201",
    plan: "silver",
    health: 78,
    weight: 1.1,
  },
  {
    id: "11111111-1111-1111-1111-111111111104",
    name: "Summit Family Clinics",
    industry: "Healthcare",
    contact: "Dr. Riley Summit",
    email: "it@summitclinics.demo",
    phone: "(601) 555-0104",
    address: "215 Wellness Drive",
    city: "Ridgeland",
    state: "MS",
    zip: "39157",
    plan: "gold",
    health: 88,
    weight: 1.4,
  },
  {
    id: "11111111-1111-1111-1111-111111111105",
    name: "Cedar County Schools",
    industry: "Education",
    contact: "Jordan Cedar",
    email: "tech@cedarschools.demo",
    phone: "(662) 555-0105",
    address: "1 Eagle Drive",
    city: "Pontotoc",
    state: "MS",
    zip: "38863",
    plan: "silver",
    health: 74,
    weight: 1.3,
  },
  {
    id: "11111111-1111-1111-1111-111111111106",
    name: "PixelCraft Studio",
    industry: "Media & Design",
    contact: "Alex Pixel",
    email: "hello@pixelcraft.demo",
    phone: "(662) 555-0106",
    address: "18 Gallery Lane",
    city: "Oxford",
    state: "MS",
    zip: "38655",
    plan: "essentials",
    health: 80,
    weight: 0.8,
  },
  {
    id: "11111111-1111-1111-1111-111111111107",
    name: "Lakeside Logistics",
    industry: "Transportation",
    contact: "Morgan Lake",
    email: "dispatch@lakesidelogistics.demo",
    phone: "(662) 555-0107",
    address: "500 Freight Way",
    city: "Southaven",
    state: "MS",
    zip: "38671",
    plan: "silver",
    health: 76,
    weight: 1.0,
  },
  {
    id: "11111111-1111-1111-1111-111111111108",
    name: "Greenfield Credit Union",
    industry: "Financial Services",
    contact: "Taylor Green",
    email: "security@greenfieldcu.demo",
    phone: "(601) 555-0108",
    address: "77 Main Street",
    city: "Hattiesburg",
    state: "MS",
    zip: "39401",
    plan: "gold",
    health: 91,
    weight: 1.2,
  },
];

const ISSUE_TEMPLATES = [
  { title: "VPN dropouts for remote staff", cat: "Network", pri: "High", method: "Remote", hours: 2.5 },
  { title: "Laptop imaging and join to Entra ID", cat: "Hardware Deployment", pri: "Medium", method: "On-site", hours: 3 },
  { title: "M365 mailbox restore request", cat: "Microsoft 365", pri: "High", method: "Remote", hours: 2 },
  { title: "Patch cycle review and reboot window", cat: "Software Support", pri: "Medium", method: "Remote", hours: 1.5 },
  { title: "Firewall rule change for vendor access", cat: "Network", pri: "High", method: "Remote", hours: 2 },
  { title: "Endpoint AV quarantine investigation", cat: "Cybersecurity", pri: "Critical", method: "Remote", hours: 3 },
  { title: "Printer mapping and driver cleanup", cat: "Hardware Support", pri: "Low", method: "On-site", hours: 1.5 },
  { title: "Shared drive permissions update", cat: "Software Support", pri: "Medium", method: "Remote", hours: 1 },
  { title: "Wi-Fi dead spot survey", cat: "Network", pri: "Medium", method: "On-site", hours: 3.5 },
  { title: "Backup job failure triage", cat: "Cloud", pri: "High", method: "Remote", hours: 2.5 },
  { title: "New hire workstation setup", cat: "Hardware Deployment", pri: "Medium", method: "On-site", hours: 2 },
  { title: "Phishing report triage", cat: "Cybersecurity", pri: "High", method: "Remote", hours: 1.5 },
  { title: "Server disk capacity expansion", cat: "Cloud", pri: "High", method: "Remote", hours: 3 },
  { title: "QoS tuning for VoIP quality", cat: "Network", pri: "Medium", method: "Remote", hours: 2 },
  { title: "Application licensing renewal assist", cat: "Software Support", pri: "Low", method: "Remote", hours: 1 },
];

function uid(kind, n) {
  const hex = Number(n).toString(16).padStart(12, "0");
  return `a626${kind}-0000-4000-8000-${hex}`;
}

function sqlStr(v) {
  if (v == null) return "null";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function isoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

function weekdaySafe(y, m, preferredDay) {
  const dim = daysInMonth(y, m);
  let d = Math.min(preferredDay, dim);
  for (let i = 0; i < 6; i++) {
    const dt = new Date(y, m - 1, d);
    const wd = dt.getDay();
    if (wd !== 0 && wd !== 6) return d;
    d = Math.min(dim, d + 1);
  }
  return Math.min(preferredDay, dim);
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

const lines = [];
const out = (s = "") => lines.push(s);

out(`-- Calendar-year 2026 MSP operational seed (mid-sized Nexus demo)
-- Idempotent fixed UUIDs. Regenerated by scripts/generate-2026-msp-seed.js

begin;

-- ---------------------------------------------------------------------------
-- New technicians: Kai Cipher + Quinn Volt (Auth + profiles + technician rows)
-- ---------------------------------------------------------------------------
`);

const newTechs = [
  {
    profileId: "22222222-2222-2222-2222-222222222211",
    techId: "33333333-3333-3333-3333-333333333308",
    email: "kai@nexus.demo",
    name: "Kai Cipher",
    specialty: "Security Operations",
    cost: 64,
    rate: 130,
  },
  {
    profileId: "22222222-2222-2222-2222-222222222212",
    techId: "33333333-3333-3333-3333-333333333309",
    email: "quinn@nexus.demo",
    name: "Quinn Volt",
    specialty: "Infrastructure & Power Systems",
    cost: 56,
    rate: 112,
  },
];

for (const t of newTechs) {
  out(`
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '${t.profileId}',
  'authenticated',
  'authenticated',
  '${t.email}',
  extensions.crypt('DemoPass123!', extensions.gen_salt('bf')),
  now(),
  jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
  jsonb_build_object('full_name',${sqlStr(t.name)},'role','technician'),
  now(), now(), '', '', '', ''
)
on conflict (id) do update
  set email = excluded.email,
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
      encrypted_password = excluded.encrypted_password,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now();

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) values (
  '${t.profileId}',
  '${t.profileId}',
  jsonb_build_object('sub','${t.profileId}','email','${t.email}'),
  'email',
  '${t.profileId}',
  now(), now(), now()
)
on conflict (provider_id, provider) do update
  set user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      updated_at = now();

insert into public.profiles (id, full_name, email, role, active)
values ('${t.profileId}', ${sqlStr(t.name)}, '${t.email}', 'technician', true)
on conflict (id) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      role = 'technician',
      active = true;

insert into public.technicians (
  id, profile_id, technician_name, specialty, internal_hourly_cost, hourly_rate, annual_pto_hours, active
) values (
  '${t.techId}', '${t.profileId}', ${sqlStr(t.name)}, ${sqlStr(t.specialty)}, ${t.cost}, ${t.rate}, 80, true
)
on conflict (id) do update
  set profile_id = excluded.profile_id,
      technician_name = excluded.technician_name,
      specialty = excluded.specialty,
      internal_hourly_cost = excluded.internal_hourly_cost,
      hourly_rate = excluded.hourly_rate,
      active = true;
`);
}

out(`
insert into public.technician_expense_budgets (technician_id, monthly_limit)
select id, 250 from public.technicians
where id in ('33333333-3333-3333-3333-333333333308','33333333-3333-3333-3333-333333333309')
on conflict (technician_id) do nothing;

insert into public.technician_parts_budgets (technician_id, monthly_limit)
select id, 500 from public.technicians
where id in ('33333333-3333-3333-3333-333333333308','33333333-3333-3333-3333-333333333309')
on conflict (technician_id) do nothing;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
`);

for (const c of CUSTOMERS) {
  out(`insert into public.customers (
  id, customer_name, industry, primary_contact_name, contact_email, contact_phone,
  address, city, state, zip_code, status, notes, account_manager_id, technology_health_score
) values (
  '${c.id}', ${sqlStr(c.name)}, ${sqlStr(c.industry)}, ${sqlStr(c.contact)}, ${sqlStr(c.email)},
  ${sqlStr(c.phone)}, ${sqlStr(c.address)}, ${sqlStr(c.city)}, ${sqlStr(c.state)}, ${sqlStr(c.zip)},
  'Active', ${sqlStr(`Managed IT client under Nexus ${PLANS[c.plan].name} plan.`)},
  '${ACCOUNT_MGR}', ${c.health}
)
on conflict (id) do update set
  customer_name = excluded.customer_name,
  industry = excluded.industry,
  primary_contact_name = excluded.primary_contact_name,
  contact_email = excluded.contact_email,
  contact_phone = excluded.contact_phone,
  address = excluded.address,
  city = excluded.city,
  state = excluded.state,
  zip_code = excluded.zip_code,
  status = 'Active',
  account_manager_id = excluded.account_manager_id,
  technology_health_score = excluded.technology_health_score;
`);
}

out(`
-- Link portal demos to their organizations
update public.profiles
set customer_id = '11111111-1111-1111-1111-111111111101',
    role = 'client_user',
    full_name = coalesce(nullif(full_name,''), 'Casey Plant'),
    active = true
where id = '${CLIENTUSER}';

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('role','client_user','customer_id','11111111-1111-1111-1111-111111111101','full_name','Casey Plant')
where id = '${CLIENTUSER}';

update public.profiles
set customer_id = '11111111-1111-1111-1111-111111111102',
    role = 'client_user',
    active = true
where id = '${CLIENTADMIN}';

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('role','client_user','customer_id','11111111-1111-1111-1111-111111111102')
where id = '${CLIENTADMIN}';

-- ---------------------------------------------------------------------------
-- Contracts (Active through 2026)
-- ---------------------------------------------------------------------------
`);

CUSTOMERS.forEach((c, idx) => {
  const plan = PLANS[c.plan];
  const contractId = uid("7700", idx + 1);
  c.contractId = contractId;
  out(`insert into public.contracts (
  id, customer_id, contract_name, contract_status, start_date, end_date, renewal_date,
  automatic_renewal, service_plan_name, monthly_recurring_fee, included_support_hours,
  additional_hourly_rate, emergency_support_rate, onsite_support_rate,
  remote_support_included, onsite_support_included, preventive_maintenance_frequency,
  critical_response_target_hours, high_response_target_hours, standard_response_target_hours,
  resolution_target_hours, support_coverage, billing_frequency, payment_terms, invoice_due_days,
  setup_fee, pass_through_charges_allowed, revenue_recognition_method, approval_status,
  plan_id, included_asset_budget, additional_asset_rate, late_fee_percent, late_fee_period_days,
  notes, included_services
) values (
  '${contractId}', '${c.id}', ${sqlStr(`${c.name} — ${plan.name} 2026`)},
  'Active', '2026-01-01', '2026-12-31', '2026-12-01', true,
  ${sqlStr(plan.name)}, ${plan.mrr}, ${plan.hours}, ${plan.overage}, ${plan.overage * 1.5}, ${plan.overage * 1.15},
  true, true, 'Quarterly', 1, 4, 8, 24,
  'Business hours Mon-Fri 8am-5pm CT', 'Monthly', 'Net 30', 30, 0, true,
  'Monthly over service period', 'Approved', '${plan.id}', ${plan.assets}, 1, 1.5, 30,
  ${sqlStr(`2026 managed services agreement for ${c.name}.`)},
  array['Remote support','Patch management','Backup monitoring','Help desk']
)
on conflict (id) do update set
  contract_status = 'Active',
  approval_status = 'Approved',
  monthly_recurring_fee = excluded.monthly_recurring_fee,
  included_support_hours = excluded.included_support_hours,
  plan_id = excluded.plan_id,
  end_date = excluded.end_date;
`);
});

// Tickets + work + invoices
let ticketN = 0;
let workN = 0;
let invN = 0;
let payN = 0;
let assetN = 0;
let expN = 0;
let scoreN = 0;

const ticketRows = [];
const workRows = [];
const invoiceRows = [];
const paymentRows = [];
const assetRows = [];
const expenseRows = [];
const scoreRows = [];

out(`
-- Clear prior 2026 seed operational rows (safe fixed UUID prefixes)
delete from public.payments where id::text like 'a6267400%';
delete from public.ticket_expenses where id::text like 'a6267600%';
delete from public.work_entries where id::text like 'a6267200%';
delete from public.invoices where id::text like 'a6267300%';
delete from public.service_tickets where id::text like 'a6267100%';
delete from public.hardware_assets where id::text like 'a6267500%';
delete from public.security_scores where id::text like 'a6267800%';
`);

// Monthly plan invoices Jan–Dec 2026
CUSTOMERS.forEach((c, cIdx) => {
  const plan = PLANS[c.plan];
  for (let month = 1; month <= 12; month++) {
    invN += 1;
    const invId = uid("7300", invN);
    const invoiceDate = isoDate(2026, month, 1);
    const dueDate = isoDate(2026, month, Math.min(28, daysInMonth(2026, month)));
    const period = `2026-${String(month).padStart(2, "0")}`;
    const amount = plan.mrr;
    // Through July: Paid. August: Issued/Partially. Sep+: Issued future.
    let status = "Issued";
    let paid = 0;
    let remaining = amount;
    if (month <= 7) {
      status = "Paid";
      paid = amount;
      remaining = 0;
    } else if (month === 8) {
      status = "Issued";
      paid = 0;
      remaining = amount;
    } else {
      status = "Issued";
      paid = 0;
      remaining = amount;
    }

    invoiceRows.push({
      id: invId,
      number: `INV-PLAN-2026-${String(month).padStart(2, "0")}-${String(cIdx + 1).padStart(2, "0")}`,
      customerId: c.id,
      contractId: c.contractId,
      invoiceDate,
      dueDate,
      recurring: amount,
      additional: 0,
      software: 0,
      equipment: 0,
      other: 0,
      total: amount,
      paid,
      remaining,
      status,
      source: "plan_recurring",
      period,
    });

    if (status === "Paid") {
      payN += 1;
      paymentRows.push({
        id: uid("7400", payN),
        invoiceId: invId,
        customerId: c.id,
        date: isoDate(2026, month, Math.min(12 + (cIdx % 10), daysInMonth(2026, month))),
        amount,
        method: pick(["ACH", "Card", "Check"], cIdx + month),
        ref: `PMT-${period}-${cIdx + 1}`,
      });
    }
  }
});

// Generate tickets across months — denser for Northwind
CUSTOMERS.forEach((c, cIdx) => {
  const plan = PLANS[c.plan];
  for (let month = 1; month <= 12; month++) {
    const baseCount = Math.max(1, Math.round((2 + c.weight) * (month === 8 ? 1.2 : 1)));
    const count = cIdx === 0 ? baseCount + 2 : baseCount; // Northwind richer
    for (let i = 0; i < count; i++) {
      ticketN += 1;
      const tpl = pick(ISSUE_TEMPLATES, ticketN + cIdx * 3);
      const tech = pick(TECHS, ticketN + month + cIdx);
      const day = weekdaySafe(2026, month, 3 + ((i * 4 + cIdx) % 20));
      const date = isoDate(2026, month, day);
      const hour = 8 + ((ticketN + i) % 8);
      const ticketId = uid("7100", ticketN);
      const isFuture = month > 8 || (month === 8 && day > 6);
      const isCurrentOpen = month === 8 && day >= 1 && day <= 6 && i % 3 === 0;
      let status = "Completed";
      if (isFuture) status = pick(["Assigned", "In Progress", "New"], ticketN);
      else if (isCurrentOpen) status = pick(["In Progress", "Assigned", "Waiting on Customer"], ticketN);

      const openedAt = `${date}T${String(hour).padStart(2, "0")}:05:00-05:00`;
      const scheduledStart = `${date}T${String(hour).padStart(2, "0")}:00:00-05:00`;
      const completedAt =
        status === "Completed"
          ? `${date}T${String(Math.min(17, hour + Math.ceil(tpl.hours))).padStart(2, "0")}:20:00-05:00`
          : null;
      const window = tpl.hours >= 3 ? `h${String(hour).padStart(2, "0")}x3` : `h${String(hour).padStart(2, "0")}`;

      ticketRows.push({
        id: ticketId,
        number: `TKT-2026-${String(ticketN).padStart(4, "0")}`,
        customerId: c.id,
        contractId: c.contractId,
        title: `${tpl.title} — ${c.name.split(" ")[0]}`,
        description: `${tpl.cat} request logged for ${c.name}. Handled under ${plan.name} included hours where possible.`,
        category: tpl.cat,
        priority: tpl.pri,
        method: tpl.method,
        techId: tech.id,
        openedAt,
        completedAt,
        status,
        scheduledStart,
        scheduledWindow: window,
        maxHours: Math.min(9, Math.ceil(tpl.hours) + 1),
        requester: c.contact,
        requesterEmail: c.email,
        resolution:
          status === "Completed"
            ? `Resolved for ${c.contact}. Changes documented and validated with end users.`
            : null,
      });

      if (status === "Completed") {
        workN += 1;
        const overage = tpl.hours > plan.hours / 8 && i === 0 && month % 3 === 0;
        const hours = round2(tpl.hours + (overage ? 1.5 : 0));
        const labor = round2(hours * tech.cost);
        const travel = tpl.method === "On-site" ? 35 : 0;
        const parts = tpl.cat.includes("Hardware") && i % 4 === 0 ? 89.5 : 0;
        workRows.push({
          id: uid("7200", workN),
          ticketId,
          customerId: c.id,
          contractId: c.contractId,
          techId: tech.id,
          workDate: date,
          start: `${String(hour).padStart(2, "0")}:00`,
          end: `${String(Math.min(17, hour + Math.ceil(hours))).padStart(2, "0")}:00`,
          hours,
          work: `Completed ${tpl.title.toLowerCase()} for ${c.name}.`,
          resolution: `Closed with customer confirmation from ${c.contact}.`,
          method: tpl.method,
          parts,
          travel,
          labor,
          total: round2(labor + parts + travel),
          included: !overage,
          approval: "Approved",
          billing: overage ? "Billed" : "Not Billable",
        });

        if (overage) {
          invN += 1;
          const overAmt = round2(1.5 * plan.overage + travel + parts);
          const oInvId = uid("7300", invN);
          const oStatus = month <= 7 ? "Paid" : "Issued";
          const oPaid = oStatus === "Paid" ? overAmt : 0;
          invoiceRows.push({
            id: oInvId,
            number: `INV-WB-2026-${String(invN).padStart(4, "0")}`,
            customerId: c.id,
            contractId: c.contractId,
            invoiceDate: date,
            dueDate: isoDate(2026, month, Math.min(day + 30 > daysInMonth(2026, month) ? daysInMonth(2026, month) : day + 15, daysInMonth(2026, month))),
            recurring: 0,
            additional: round2(1.5 * plan.overage),
            software: 0,
            equipment: parts,
            other: travel,
            total: overAmt,
            paid: oPaid,
            remaining: round2(overAmt - oPaid),
            status: oStatus,
            source: "work_entries",
            period: null,
          });
          if (oStatus === "Paid") {
            payN += 1;
            paymentRows.push({
              id: uid("7400", payN),
              invoiceId: oInvId,
              customerId: c.id,
              date: isoDate(2026, month, Math.min(day + 7, daysInMonth(2026, month))),
              amount: overAmt,
              method: "ACH",
              ref: `OVG-${ticketN}`,
            });
          }
          // link work to invoice
          workRows[workRows.length - 1].invoiceId = oInvId;
        }

        if (tpl.method === "On-site" && i % 5 === 0) {
          expN += 1;
          expenseRows.push({
            id: uid("7600", expN),
            ticketId,
            techId: tech.id,
            type: pick(["Travel", "Meals", "Parking"], expN),
            amount: pick([18.5, 24, 42.75, 12], expN),
            date,
            tag: pick(["Billable to Customer", "Internal Company Expense"], expN),
            approval: "Approved",
            desc: `On-site support expense — ${c.name}`,
          });
        }
      }
    }
  }
});

// Hardware assets — heavier for Northwind / Gold clients
CUSTOMERS.forEach((c, cIdx) => {
  const counts = { gold: 14, silver: 8, essentials: 5 };
  const n = counts[c.plan];
  for (let i = 0; i < n; i++) {
    assetN += 1;
    const cats = ["laptop", "desktop", "server", "switch", "mobile"];
    const cat = pick(cats, i + cIdx);
    const purchaseMonth = 1 + ((i + cIdx) % 11);
    assetRows.push({
      id: uid("7500", assetN),
      number: `AST-2026-${String(assetN).padStart(4, "0")}`,
      customerId: c.id,
      location: pick(["HQ", "Warehouse", "Clinic Floor", "Branch Office", "Remote"], i),
      category: cat,
      manufacturer: pick(["Dell", "HP", "Lenovo", "Apple", "Cisco"], i + cIdx),
      model: pick(["Latitude 5440", "EliteBook 840", "ThinkPad T14", "MacBook Pro 14", "Catalyst 9200"], i),
      serial: `SN26${String(assetN).padStart(6, "0")}`,
      purchaseDate: isoDate(2024 + (i % 2), purchaseMonth, 12),
      warranty: isoDate(2027, purchaseMonth, 12),
      assigned: pick([c.contact, "Shared Pool", "Ops Desk", "Executive"], i),
      os: cat === "server" ? "Windows Server 2022" : pick(["Windows 11 Pro", "macOS Sonoma", "ChromeOS"], i),
      cost: pick([1299, 899, 2499, 1899, 650], i),
      value: pick([900, 650, 1800, 1400, 420], i),
      health: 70 + ((i * 7 + cIdx * 3) % 28),
    });
  }
});

// Quarterly security scores for each customer
CUSTOMERS.forEach((c, cIdx) => {
  for (let q = 1; q <= 4; q++) {
    scoreN += 1;
    const month = q * 3;
    scoreRows.push({
      id: uid("7800", scoreN),
      customerId: c.id,
      asOf: isoDate(2026, month, Math.min(28, daysInMonth(2026, month))),
      endpoint: round2(78 + ((cIdx + q) % 15)),
      patch: round2(72 + ((cIdx * 2 + q) % 18)),
      mfa: round2(80 + ((cIdx + q * 3) % 16)),
      encryption: round2(75 + ((cIdx * 3 + q) % 20)),
      backup: round2(70 + ((cIdx + q * 2) % 22)),
      overall: round2(c.health - 4 + q),
    });
  }
});

// Emit inserts in batches
function emitTickets() {
  out(`-- Service tickets (${ticketRows.length})`);
  for (const t of ticketRows) {
    out(`insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  '${t.id}', ${sqlStr(t.number)}, '${t.customerId}', '${t.contractId}', ${sqlStr(t.title)},
  ${sqlStr(t.description)}, ${sqlStr(t.category)}, ${sqlStr(t.priority)}, ${sqlStr(t.method)},
  '${t.techId}', ${sqlStr(t.openedAt)}, ${t.completedAt ? sqlStr(t.completedAt) : "null"},
  ${sqlStr(t.status)}, ${sqlStr(t.requester)}, ${sqlStr(t.requesterEmail)},
  ${t.resolution ? sqlStr(t.resolution) : "null"}, ${sqlStr(t.scheduledStart)}, ${sqlStr(t.scheduledWindow)},
  ${t.maxHours}, ${t.maxHours}, false, false, false, ${t.category === "Cybersecurity" ? "true" : "false"},
  false, false, false, false, false, 0, false,
  ${sqlStr("Seeded 2026 MSP operations history.")}
);
`);
  }
}

function emitWork() {
  out(`-- Work entries (${workRows.length})`);
  for (const w of workRows) {
    out(`insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  '${w.id}', '${w.ticketId}', '${w.customerId}', '${w.contractId}', '${w.techId}',
  ${sqlStr(w.workDate)}, ${sqlStr(w.start)}, ${sqlStr(w.end)}, ${w.hours},
  ${sqlStr(w.work)}, ${sqlStr(w.resolution)}, ${sqlStr(w.method)},
  ${w.parts}, 0, 0, ${w.travel}, 0, ${w.labor}, ${w.total}, ${w.included},
  false, ${sqlStr(w.approval)}, ${sqlStr(w.billing)},
  ${w.invoiceId ? `'${w.invoiceId}'` : "null"}, '[]'::jsonb
);
`);
  }
}

function emitInvoices() {
  out(`-- Invoices (${invoiceRows.length})`);
  for (const inv of invoiceRows) {
    out(`insert into public.invoices (
  id, invoice_number, customer_id, contract_id, invoice_date, due_date,
  recurring_service_fee, additional_support_charges, software_charges, equipment_charges,
  other_charges, late_fee_amount, total_amount, amount_paid, remaining_balance, status,
  invoice_source, billing_period, created_by
) values (
  '${inv.id}', ${sqlStr(inv.number)}, '${inv.customerId}', '${inv.contractId}',
  ${sqlStr(inv.invoiceDate)}, ${sqlStr(inv.dueDate)},
  ${inv.recurring}, ${inv.additional}, ${inv.software}, ${inv.equipment}, ${inv.other},
  0, ${inv.total}, ${inv.paid}, ${inv.remaining}, ${sqlStr(inv.status)},
  ${sqlStr(inv.source)}, ${inv.period ? sqlStr(inv.period) : "null"}, '${BILLING}'
);
`);
  }
}

function emitPayments() {
  out(`-- Payments (${paymentRows.length})`);
  for (const p of paymentRows) {
    out(`insert into public.payments (
  id, invoice_id, customer_id, payment_date, payment_amount, payment_method, reference_number, notes, created_by
) values (
  '${p.id}', '${p.invoiceId}', '${p.customerId}', ${sqlStr(p.date)}, ${p.amount},
  ${sqlStr(p.method)}, ${sqlStr(p.ref)}, 'Seeded 2026 payment', '${BILLING}'
);
`);
  }
}

function emitAssets() {
  out(`-- Hardware assets (${assetRows.length})`);
  for (const a of assetRows) {
    out(`insert into public.hardware_assets (
  id, asset_number, customer_id, location, category, manufacturer, model, serial_number,
  purchase_date, warranty_expiration, assigned_employee, operating_system, device_status,
  lifecycle_stage, purchase_cost, current_value, managed_coverage, warranty_expiring_soon,
  nearing_eol, needs_replacement, unsupported_os, missing_security_updates, quantity,
  health_score, online_status, patch_status, antivirus_status, notes
) values (
  '${a.id}', ${sqlStr(a.number)}, '${a.customerId}', ${sqlStr(a.location)}, ${sqlStr(a.category)},
  ${sqlStr(a.manufacturer)}, ${sqlStr(a.model)}, ${sqlStr(a.serial)}, ${sqlStr(a.purchaseDate)},
  ${sqlStr(a.warranty)}, ${sqlStr(a.assigned)}, ${sqlStr(a.os)}, 'Active', 'In Use',
  ${a.cost}, ${a.value}, true, false, false, false, false, false, 1,
  ${a.health}, 'Online', 'Up to date', 'Protected',
  ${sqlStr("Managed endpoint under Nexus RMM coverage.")}
);
`);
  }
}

function emitExpenses() {
  out(`-- Ticket expenses (${expenseRows.length})`);
  for (const e of expenseRows) {
    out(`insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  '${e.id}', '${e.ticketId}', '${e.techId}', ${sqlStr(e.type)}, ${e.amount}, ${sqlStr(e.date)},
  ${sqlStr(e.desc)}, ${sqlStr(e.tag)}, ${sqlStr(e.approval)}
);
`);
  }
}

function emitScores() {
  out(`-- Security scores (${CUSTOMERS.length} — one current score per customer)`);
  CUSTOMERS.forEach((c, cIdx) => {
    const s = scoreRows[cIdx * 4 + 3] ?? scoreRows[cIdx]; // prefer Q4 / latest
    if (!s) return;
    out(`insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  '${uid("7800", cIdx + 1)}', '${c.id}', ${s.overall}, 'Healthy', ${s.endpoint}, ${s.patch},
  ${s.patch}, ${s.encryption}, ${s.mfa}, ${sqlStr(s.asOf)}, 'Current MSP security posture review'
)
on conflict (customer_id) do update set
  health_score = excluded.health_score,
  endpoint_coverage_pct = excluded.endpoint_coverage_pct,
  antivirus_current_pct = excluded.antivirus_current_pct,
  patch_compliance_pct = excluded.patch_compliance_pct,
  encryption_coverage_pct = excluded.encryption_coverage_pct,
  mfa_adoption_pct = excluded.mfa_adoption_pct,
  last_assessed_at = excluded.last_assessed_at,
  notes = excluded.notes;
`);
  });
}

emitTickets();
emitWork();
emitInvoices();
emitPayments();
emitAssets();
emitExpenses();
emitScores();

out(`
-- Helpful announcement for the client portal
insert into public.announcements (title, body, audience, active)
select
  '2026 service year underway',
  'Your Nexus managed services agreement covers recurring support hours, patching, and backup monitoring. Review Billing for paid invoices and open tickets from the portal home.',
  'All Clients',
  true
where not exists (
  select 1 from public.announcements where title = '2026 service year underway'
);

commit;
`);

const outPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260806260000_seed_msp_2026_year.sql",
);
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${outPath}`);
console.log(
  JSON.stringify(
    {
      customers: CUSTOMERS.length,
      techsAdded: 2,
      tickets: ticketRows.length,
      workEntries: workRows.length,
      invoices: invoiceRows.length,
      payments: paymentRows.length,
      assets: assetRows.length,
      expenses: expenseRows.length,
      scores: scoreRows.length,
      bytes: fs.statSync(outPath).size,
    },
    null,
    2,
  ),
);
