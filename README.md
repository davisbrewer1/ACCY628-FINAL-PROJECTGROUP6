# Nexus Technology Solutions

Nexus Technology Solutions is a localhost **Technology Operations Platform** for a fictional mid-sized technology solutions and managed-services provider. It connects customer need → solution → contract → hardware/software → deployment → support → billing → payment → renewal/retirement.

Built with **Next.js**, **React**, **Tailwind CSS**, **daisyUI**, **Supabase**, and **Recharts**.

## Branch

Work for this first skeleton lives on:

`initial-app-skeleton`

Do not merge into `main` until the team agrees. Do not deploy yet.

## Environment variables

1. Copy `.env.local.example` to `.env.local` if needed.
2. Open Supabase → project **ACCY628-FINAL-PROJECTGROUP6**.
3. Open **Connect** or **Settings → API Keys**.
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (or legacy anon public key) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Never put a service role / secret key in frontend code.

After changing `.env.local`, **stop and restart** `npm run dev`.

## Start locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo logins

All demo passwords: `DemoPass123!`

| Role | Email |
|------|-------|
| Administrator | admin@nexus.demo |
| Executive Leadership | executive@nexus.demo |
| Service Delivery Manager | manager@nexus.demo |
| Account Manager | account@nexus.demo |
| Technician | tech@nexus.demo |
| Billing & Accounting | billing@nexus.demo |
| Client Administrator | clientadmin@nexus.demo |
| Client End User | clientuser@nexus.demo |

The administrator **Demo Role Switcher** only changes the visible interface for demos. Database security (Row Level Security) still uses the real signed-in role.

## What this version includes

- Login / sign-up / log out with theme selector
- Role-based navigation and dashboards (8 roles)
- Service catalog, customers, contracts, hardware assets
- Service tickets, technician workspace, time & costs
- Cybersecurity and AI Governance dashboards (simulated seed data)
- Recommendations, billing / AR, reports
- Client Admin and End User portals
- Supabase schema, RLS, and fake seed data

## Not included yet

- Deploying to Vercel
- Real payment processing or live AI vendor APIs
- Photo uploads
- Full edit/delete CRUD everywhere
- Full general ledger journal posting
- Dispute workflows
