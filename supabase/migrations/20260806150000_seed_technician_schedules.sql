-- Seed realistic technician schedules for last week, this week, and next week
-- (America/Chicago business hours). Also sets SLA fields so star ratings differ.
-- Idempotent for ticket_number prefix TKT-SCHED-.

-- Remove prior seed rows
delete from public.work_entries
where ticket_id in (
  select id from public.service_tickets where ticket_number like 'TKT-SCHED-%'
);
delete from public.ticket_hour_extension_requests
where ticket_id in (
  select id from public.service_tickets where ticket_number like 'TKT-SCHED-%'
);
delete from public.service_tickets where ticket_number like 'TKT-SCHED-%';

-- Free calendar slots in the 3-week window so seeded work does not collide
update public.service_tickets
set scheduled_start = null, scheduled_window = null
where scheduled_start >= timestamptz '2026-07-27 00:00:00-05'
  and scheduled_start < timestamptz '2026-08-16 00:00:00-05';

drop table if exists public._seed_sched_staging;
create table public._seed_sched_staging (
  seq int generated always as identity primary key,
  tech_id uuid not null,
  customer_id uuid not null,
  day date not null,
  start_hour int not null check (start_hour between 8 and 16),
  duration_hours int not null check (duration_hours between 1 and 4),
  title text not null,
  category text not null,
  priority text not null,
  status text not null,
  service_method text not null,
  max_hours int not null,
  response_quality numeric not null,
  resolution_quality numeric not null
);

-- Customers
-- Beacon, Cedar, Greenfield, Harbor, Lakeside, Northwind, Pixel, Summit
-- Techs: Terry 301, Jamie 302, Chris 303, Dana 304, Evan 305, Fran 306

-- ========== LAST WEEK Mon Jul 28 – Fri Aug 1 (mostly Completed) ==========
-- Terry (top performer): packed days, longer jobs, excellent SLA
insert into public._seed_sched_staging (tech_id, customer_id, day, start_hour, duration_hours, title, category, priority, status, service_method, max_hours, response_quality, resolution_quality) values
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111101','2026-07-28',8,3,'Workstation imaging batch — Northwind plant floor','Hardware','High','Completed','On-site',4,0.95,0.98),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111103','2026-07-28',12,2,'Harbor register printer mapping','Hardware','Medium','Completed','On-site',3,0.9,0.95),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111104','2026-07-28',15,2,'Summit clinic VPN reconnect after ISP cut','Networking','Critical','Completed','Remote',3,0.98,0.97),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111102','2026-07-29',8,2,'Beacon Legal MFA reset wave','Software','High','Completed','Remote',3,0.96,0.96),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111107','2026-07-29',11,3,'Lakeside scanner fleet firmware','Hardware','Medium','Completed','On-site',4,0.92,0.94),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111106','2026-07-29',15,2,'PixelCraft Adobe license repair','Software','Low','Completed','Remote',2,0.9,0.93),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111105','2026-07-30',8,4,'Cedar Schools lab switch replacement assist','Networking','High','Completed','On-site',5,0.94,0.95),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111108','2026-07-30',13,3,'Greenfield teller PC rebuild','Hardware','Medium','Completed','On-site',4,0.93,0.96),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111101','2026-07-31',8,2,'Northwind shared drive permissions','Software','Medium','Completed','Remote',3,0.95,0.97),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111103','2026-07-31',11,3,'Harbor back-office Wi-Fi dead spots','Networking','High','Completed','On-site',4,0.97,0.94),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111104','2026-07-31',15,2,'Summit EHR thin-client refresh','Hardware','Medium','Completed','On-site',3,0.91,0.95),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111102','2026-08-01',8,3,'Beacon mail migration cleanup','Software','High','Completed','Remote',4,0.96,0.98),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111107','2026-08-01',12,2,'Lakeside dock station swap','Hardware','Low','Completed','On-site',3,0.9,0.92),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111108','2026-08-01',15,2,'Greenfield password policy rollout','Software','Medium','Completed','Remote',2,0.94,0.96),

-- Jamie (strong networking): busy mornings, solid SLA
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111105','2026-07-28',8,3,'Cedar WAN failover test','Networking','Critical','Completed','On-site',4,0.9,0.92),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111107','2026-07-28',13,2,'Lakeside VLAN cleanup','Networking','High','Completed','Remote',3,0.88,0.9),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111101','2026-07-29',8,4,'Northwind core switch stack upgrade','Networking','Critical','Completed','On-site',5,0.92,0.88),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111103','2026-07-29',14,2,'Harbor AP channel rebalance','Networking','Medium','Completed','On-site',3,0.85,0.9),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111108','2026-07-30',8,3,'Greenfield SD-WAN cutover assist','Networking','High','Completed','On-site',4,0.9,0.91),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111104','2026-07-30',13,3,'Summit clinic guest Wi-Fi isolate','Networking','High','Completed','On-site',4,0.87,0.89),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111106','2026-07-31',8,2,'PixelCraft studio switch port flap','Networking','Medium','Completed','On-site',3,0.86,0.9),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111102','2026-07-31',11,3,'Beacon Legal site-to-site VPN','Networking','High','Completed','Remote',4,0.91,0.93),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111105','2026-08-01',8,3,'Cedar Schools fiber handoff','Networking','Critical','Completed','On-site',4,0.93,0.9),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111107','2026-08-01',13,2,'Lakeside DHCP scope expansion','Networking','Medium','Completed','Remote',2,0.84,0.88),

-- Chris (solid cloud): fewer longer jobs
('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111108','2026-07-28',8,4,'Greenfield Azure AD sync repair','Cloud & Servers','High','Completed','Remote',5,0.82,0.85),
('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111101','2026-07-29',9,3,'Northwind Hyper-V host patch','Cloud & Servers','High','Completed','On-site',4,0.8,0.84),
('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111102','2026-07-30',8,4,'Beacon M365 archive mailbox move','Cloud & Servers','Medium','Completed','Remote',5,0.78,0.82),
('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111104','2026-07-31',10,3,'Summit RDS farm capacity add','Cloud & Servers','High','Completed','Remote',4,0.81,0.8),
('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111106','2026-08-01',8,3,'PixelCraft backup vault restore drill','Cloud & Servers','Medium','Completed','Remote',4,0.79,0.83),
('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111103','2026-08-01',13,2,'Harbor Entra device join cleanup','Cloud & Servers','Low','Completed','Remote',3,0.75,0.8),

-- Dana (endpoints): many short tickets, mixed SLA
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111103','2026-07-28',8,1,'Harbor laptop BitLocker unlock','Hardware','Medium','Completed','Remote',2,0.7,0.65),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111105','2026-07-28',10,1,'Cedar teacher Chromebook enroll','Hardware','Low','Completed','On-site',2,0.6,0.7),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111106','2026-07-28',12,2,'PixelCraft Wacom driver fix','Hardware','Medium','Completed','Remote',3,0.55,0.6),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111101','2026-07-28',15,1,'Northwind headset USB issue','Hardware','Low','Completed','Remote',1,0.5,0.55),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111104','2026-07-29',8,2,'Summit laptop refresh prep','Hardware','Medium','Completed','On-site',3,0.65,0.6),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111102','2026-07-29',11,1,'Beacon Outlook profile rebuild','Software','Medium','Completed','Remote',2,0.7,0.55),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111107','2026-07-29',13,2,'Lakeside barcode scanner pair','Hardware','Low','Completed','On-site',3,0.45,0.5),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111108','2026-07-29',16,1,'Greenfield webcam for Teams','Hardware','Low','Completed','Remote',1,0.6,0.65),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111103','2026-07-30',8,1,'Harbor POS peripheral check','Hardware','High','Completed','On-site',2,0.75,0.5),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111105','2026-07-30',10,2,'Cedar cart PC imaging','Hardware','Medium','Completed','On-site',3,0.55,0.58),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111101','2026-07-30',13,1,'Northwind printer tray jam','Hardware','Low','Completed','On-site',2,0.4,0.45),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111106','2026-07-30',15,2,'PixelCraft dual-monitor setup','Hardware','Medium','Completed','On-site',3,0.62,0.7),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111104','2026-07-31',8,1,'Summit badge printer ink','Hardware','Low','Completed','On-site',1,0.5,0.4),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111102','2026-07-31',10,2,'Beacon laptop docking station','Hardware','Medium','Completed','On-site',3,0.58,0.62),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111107','2026-07-31',13,1,'Lakeside Teams audio fix','Software','Medium','Completed','Remote',2,0.68,0.55),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111108','2026-07-31',15,2,'Greenfield Windows updates stuck','Software','High','Completed','Remote',3,0.72,0.48),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111101','2026-08-01',8,2,'Northwind new hire laptop kit','Hardware','Medium','Completed','On-site',3,0.6,0.65),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111103','2026-08-01',11,1,'Harbor iPad kiosk reset','Hardware','Low','Completed','On-site',2,0.45,0.5),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111105','2026-08-01',13,2,'Cedar staff laptop recall patch','Hardware','High','Completed','Remote',3,0.7,0.55),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111106','2026-08-01',16,1,'PixelCraft mouse battery swap','Hardware','Low','Completed','On-site',1,0.55,0.6),

-- Evan (security, lighter / slower): weaker SLA
('33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111108','2026-07-28',9,3,'Greenfield phishing mailbox hunt','Security','Critical','Completed','Remote',4,0.35,0.4),
('33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111102','2026-07-29',10,2,'Beacon Legal conditional access tweak','Security','High','Completed','Remote',3,0.3,0.35),
('33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111104','2026-07-30',8,3,'Summit EDR alert triage','Security','Critical','Completed','Remote',4,0.4,0.3),
('33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111101','2026-07-31',11,2,'Northwind firewall rule review','Security','Medium','Completed','Remote',3,0.25,0.45),
('33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111107','2026-08-01',9,3,'Lakeside ransomware tabletop follow-up','Security','High','Completed','On-site',4,0.35,0.38),

-- Fran (infra, often late): weakest ratings
('33333333-3333-3333-3333-333333333306','11111111-1111-1111-1111-111111111105','2026-07-28',10,3,'Cedar UPS battery replace','Infrastructure','Medium','Completed','On-site',4,0.2,0.25),
('33333333-3333-3333-3333-333333333306','11111111-1111-1111-1111-111111111103','2026-07-29',8,2,'Harbor rack cable dress','Infrastructure','Low','Completed','On-site',3,0.15,0.2),
('33333333-3333-3333-3333-333333333306','11111111-1111-1111-1111-111111111101','2026-07-30',9,4,'Northwind SAN capacity expand','Infrastructure','High','Completed','On-site',5,0.25,0.15),
('33333333-3333-3333-3333-333333333306','11111111-1111-1111-1111-111111111108','2026-07-31',13,2,'Greenfield HVAC sensor network','Infrastructure','Medium','Completed','On-site',3,0.1,0.3),
('33333333-3333-3333-3333-333333333306','11111111-1111-1111-1111-111111111104','2026-08-01',8,3,'Summit clinic IDF cleanup','Infrastructure','Medium','Completed','On-site',4,0.2,0.22);

-- ========== THIS WEEK Mon Aug 4 – Fri Aug 8 ==========
-- Today context: Thu Aug 6 — Mon–Wed mostly done, Thu in progress, Fri assigned
insert into public._seed_sched_staging (tech_id, customer_id, day, start_hour, duration_hours, title, category, priority, status, service_method, max_hours, response_quality, resolution_quality) values
-- Terry this week
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111101','2026-08-04',8,3,'Northwind ERP client freeze','Software','High','Completed','Remote',4,0.96,0.97),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111103','2026-08-04',13,2,'Harbor morning POS open failure','Hardware','Critical','Completed','On-site',3,0.98,0.95),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111104','2026-08-04',16,1,'Summit label printer queue','Hardware','Low','Completed','Remote',2,0.9,0.94),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111102','2026-08-05',8,2,'Beacon discovery hold mailbox','Software','Medium','Completed','Remote',3,0.94,0.96),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111107','2026-08-05',11,3,'Lakeside yard tablet deploy','Hardware','High','Completed','On-site',4,0.93,0.95),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111106','2026-08-05',15,2,'PixelCraft Dropbox sync storm','Software','Medium','Completed','Remote',3,0.92,0.93),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111105','2026-08-06',8,3,'Cedar admin office PC rebuild','Hardware','High','In Progress','On-site',4,0.95,0.9),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111108','2026-08-06',13,2,'Greenfield VPN MFA prompt loop','Software','High','In Progress','Remote',3,0.97,0.9),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111101','2026-08-07',8,2,'Northwind shared calendar ACL','Software','Medium','Assigned','Remote',3,0.9,0.9),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111103','2026-08-07',11,3,'Harbor seasonal hire imaging','Hardware','Medium','Assigned','On-site',4,0.9,0.9),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111104','2026-08-08',9,2,'Summit Friday clinic walk-up window','Hardware','Low','Assigned','On-site',3,0.9,0.9),

-- Jamie this week
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111107','2026-08-04',8,3,'Lakeside WAN brownout diagnose','Networking','Critical','Completed','On-site',4,0.9,0.88),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111105','2026-08-04',13,2,'Cedar AP firmware batch','Networking','High','Completed','Remote',3,0.86,0.9),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111101','2026-08-05',8,4,'Northwind distribution switch replace','Networking','Critical','Completed','On-site',5,0.91,0.87),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111103','2026-08-06',8,3,'Harbor storefront mesh AP add','Networking','High','In Progress','On-site',4,0.88,0.85),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111108','2026-08-06',14,2,'Greenfield DNS forwarder tweak','Networking','Medium','Assigned','Remote',3,0.85,0.85),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111104','2026-08-07',9,3,'Summit clinic VLAN for imaging','Networking','High','Assigned','On-site',4,0.85,0.85),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111106','2026-08-08',8,2,'PixelCraft uplink utilization check','Networking','Medium','Assigned','Remote',2,0.85,0.85),

-- Chris this week
('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111102','2026-08-04',8,4,'Beacon SharePoint site migrate','Cloud & Servers','High','Completed','Remote',5,0.8,0.82),
('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111108','2026-08-05',9,3,'Greenfield SQL backup job fail','Cloud & Servers','Critical','Completed','Remote',4,0.83,0.78),
('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111101','2026-08-06',8,3,'Northwind file server snapshot','Cloud & Servers','Medium','In Progress','On-site',4,0.78,0.8),
('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111106','2026-08-07',10,2,'PixelCraft OneDrive quota bump','Cloud & Servers','Low','Assigned','Remote',3,0.75,0.75),
('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111104','2026-08-08',8,3,'Summit Azure VM resize','Cloud & Servers','High','Assigned','Remote',4,0.8,0.8),

-- Dana this week — short tickets
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111103','2026-08-04',8,1,'Harbor drawer cash printer','Hardware','Medium','Completed','On-site',2,0.65,0.55),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111105','2026-08-04',10,1,'Cedar stylus replacement','Hardware','Low','Completed','On-site',1,0.5,0.6),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111101','2026-08-04',12,2,'Northwind laptop blue screen','Hardware','High','Completed','On-site',3,0.7,0.5),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111102','2026-08-04',15,1,'Beacon keyboard remap','Hardware','Low','Completed','Remote',1,0.55,0.6),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111106','2026-08-05',8,1,'PixelCraft color profile','Software','Low','Completed','Remote',2,0.6,0.55),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111107','2026-08-05',10,2,'Lakeside rugged tablet wipe','Hardware','Medium','Completed','On-site',3,0.58,0.62),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111108','2026-08-05',13,1,'Greenfield Teams camera','Hardware','Medium','Completed','Remote',2,0.68,0.5),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111104','2026-08-05',15,2,'Summit nurse station PC','Hardware','High','Completed','On-site',3,0.72,0.48),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111103','2026-08-06',8,2,'Harbor seasonal PC setup','Hardware','Medium','In Progress','On-site',3,0.6,0.55),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111105','2026-08-06',11,1,'Cedar projector HDMI','Hardware','Low','In Progress','On-site',2,0.5,0.5),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111101','2026-08-06',14,2,'Northwind scanner driver','Hardware','Medium','Assigned','Remote',3,0.55,0.55),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111102','2026-08-07',8,1,'Beacon PDF default app','Software','Low','Assigned','Remote',1,0.55,0.55),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111107','2026-08-07',10,2,'Lakeside label printer','Hardware','Medium','Assigned','On-site',3,0.55,0.55),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111106','2026-08-08',9,1,'PixelCraft font install','Software','Low','Assigned','Remote',1,0.55,0.55),

-- Evan this week
('33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111102','2026-08-04',10,3,'Beacon suspicious OAuth grant','Security','Critical','Completed','Remote',4,0.35,0.32),
('33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111108','2026-08-05',9,2,'Greenfield MFA fatigue reports','Security','High','Completed','Remote',3,0.3,0.4),
('33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111101','2026-08-06',11,3,'Northwind USB block policy','Security','Medium','In Progress','Remote',4,0.28,0.35),
('33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111104','2026-08-07',13,2,'Summit phishing report review','Security','High','Assigned','Remote',3,0.3,0.3),
('33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111107','2026-08-08',9,2,'Lakeside firewall log noise','Security','Medium','Assigned','Remote',3,0.25,0.3),

-- Fran this week
('33333333-3333-3333-3333-333333333306','11111111-1111-1111-1111-111111111105','2026-08-04',9,3,'Cedar MDF thermostat alert','Infrastructure','Medium','Completed','On-site',4,0.2,0.18),
('33333333-3333-3333-3333-333333333306','11111111-1111-1111-1111-111111111103','2026-08-05',8,2,'Harbor PDU circuit map','Infrastructure','Low','Completed','On-site',3,0.15,0.25),
('33333333-3333-3333-3333-333333333306','11111111-1111-1111-1111-111111111101','2026-08-06',10,3,'Northwind rack rail install','Infrastructure','Medium','In Progress','On-site',4,0.22,0.2),
('33333333-3333-3333-3333-333333333306','11111111-1111-1111-1111-111111111108','2026-08-07',13,2,'Greenfield camera NVR disk','Infrastructure','High','Assigned','On-site',3,0.2,0.2),
('33333333-3333-3333-3333-333333333306','11111111-1111-1111-1111-111111111104','2026-08-08',8,2,'Summit closet patch panel','Infrastructure','Low','Assigned','On-site',3,0.15,0.2);

-- ========== NEXT WEEK Mon Aug 11 – Fri Aug 15 (light) ==========
insert into public._seed_sched_staging (tech_id, customer_id, day, start_hour, duration_hours, title, category, priority, status, service_method, max_hours, response_quality, resolution_quality) values
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111101','2026-08-11',9,2,'Northwind weekly patch window','Software','Medium','Assigned','Remote',3,0.9,0.9),
('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111103','2026-08-13',13,1,'Harbor register health check','Hardware','Low','Assigned','On-site',2,0.9,0.9),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111105','2026-08-11',8,2,'Cedar WAN utilization review','Networking','Medium','Assigned','Remote',3,0.85,0.85),
('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111107','2026-08-14',10,1,'Lakeside AP reboot scheduled','Networking','Low','Assigned','Remote',2,0.85,0.85),
('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111108','2026-08-12',9,3,'Greenfield backup restore drill','Cloud & Servers','High','Assigned','Remote',4,0.8,0.8),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111106','2026-08-11',11,1,'PixelCraft new hire laptop','Hardware','Medium','Assigned','On-site',2,0.55,0.55),
('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111104','2026-08-13',14,1,'Summit badge reprint station','Hardware','Low','Assigned','On-site',2,0.55,0.55),
('33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111102','2026-08-12',10,2,'Beacon quarterly access review','Security','Medium','Assigned','Remote',3,0.3,0.3),
('33333333-3333-3333-3333-333333333306','11111111-1111-1111-1111-111111111101','2026-08-13',9,2,'Northwind UPS self-test','Infrastructure','Low','Assigned','On-site',3,0.2,0.2);

-- Materialize tickets
insert into public.service_tickets (
  ticket_number,
  customer_id,
  title,
  description,
  category,
  priority,
  severity,
  status,
  service_method,
  assigned_technician_id,
  max_hours,
  opened_at,
  responded_at,
  target_response_at,
  target_resolution_at,
  completed_at,
  scheduled_start,
  scheduled_window,
  requester_name,
  location,
  notes
)
select
  'TKT-SCHED-' || lpad(seq::text, 4, '0'),
  customer_id,
  title,
  'Seeded schedule work for technician calendar demo (' || to_char(day, 'YYYY-MM-DD') || ').',
  category,
  priority,
  priority,
  status,
  service_method,
  tech_id,
  max_hours,
  -- opened morning before slot
  ((day - 1) + time '07:30') at time zone 'America/Chicago',
  -- response: high quality responds quickly; low quality misses the SLA window
  (
    ((day - 1) + time '07:30') at time zone 'America/Chicago'
    + make_interval(
      mins => case
        when response_quality >= 0.85 then 20 + round((1.0 - response_quality) * 40)::int
        when response_quality >= 0.55 then 90 + round((0.85 - response_quality) * 120)::int
        else 150 + round((0.55 - response_quality) * 400)::int
      end
    )
  ),
  -- response SLA target ~2h for Critical/High else 4h
  (
    ((day - 1) + time '07:30') at time zone 'America/Chicago'
    + make_interval(hours => case when priority in ('Critical','High') then 2 else 4 end)
  ),
  -- resolution target end of business (+ buffer for long jobs)
  (
    (day + time '17:00') at time zone 'America/Chicago'
    + make_interval(hours => case when duration_hours >= 3 then 2 else 0 end)
  ),
  case
    when status in ('Completed','Closed') then
      (
        (day + time '17:00') at time zone 'America/Chicago'
        + make_interval(hours => case when duration_hours >= 3 then 2 else 0 end)
        + make_interval(
          mins => case
            when resolution_quality >= 0.85 then -60 - round((resolution_quality - 0.85) * 80)::int
            when resolution_quality >= 0.55 then 30 + round((0.85 - resolution_quality) * 100)::int
            else 120 + round((0.55 - resolution_quality) * 360)::int
          end
        )
      )
    else null
  end,
  (day + make_time(start_hour, 0, 0)) at time zone 'America/Chicago',
  case when duration_hours <= 1 then 'h' || lpad(start_hour::text, 2, '0')
       else 'h' || lpad(start_hour::text, 2, '0') || 'x' || duration_hours::text
  end,
  'Schedule Seed',
  'Customer site / remote',
  'Auto-seeded for last/this/next week calendars'
from public._seed_sched_staging
order by seq;

-- Work entries for completed seeded tickets (utilization + payroll realism)
insert into public.work_entries (
  ticket_id,
  customer_id,
  technician_id,
  work_date,
  start_time,
  end_time,
  hours_worked,
  work_performed,
  resolution_notes,
  service_method,
  labor_cost,
  total_direct_cost,
  included_in_contract,
  approval_status,
  billing_status
)
select
  t.id,
  t.customer_id,
  t.assigned_technician_id,
  (t.scheduled_start at time zone 'America/Chicago')::date,
  make_time(extract(hour from (t.scheduled_start at time zone 'America/Chicago'))::int, 0, 0),
  make_time(
    extract(hour from (t.scheduled_start at time zone 'America/Chicago'))::int
      + greatest(1, coalesce(nullif(split_part(t.scheduled_window, 'x', 2), '')::int, 1)),
    0,
    0
  ),
  greatest(1, coalesce(nullif(split_part(t.scheduled_window, 'x', 2), '')::int, 1))::numeric,
  'Completed scheduled work: ' || t.title,
  'Resolved during assigned window.',
  t.service_method,
  greatest(1, coalesce(nullif(split_part(t.scheduled_window, 'x', 2), '')::int, 1)) * 85.0,
  greatest(1, coalesce(nullif(split_part(t.scheduled_window, 'x', 2), '')::int, 1)) * 85.0,
  true,
  'Approved',
  'Included'
from public.service_tickets t
where t.ticket_number like 'TKT-SCHED-%'
  and t.status = 'Completed'
  and t.assigned_technician_id is not null
  and t.scheduled_start is not null;

drop table if exists public._seed_sched_staging;

-- Keep Needs scheduling light: at most 2 highest-priority unscheduled
-- open tickets per active technician. Excess move to the week after the
-- seeded 3-week window so calendars stay usable for demos.
with ranked as (
  select
    st.id,
    st.assigned_technician_id,
    greatest(1, least(coalesce(st.max_hours, 2), 3)) as dur,
    row_number() over (
      partition by st.assigned_technician_id
      order by
        case st.priority
          when 'Critical' then 1
          when 'High' then 2
          when 'Medium' then 3
          when 'Low' then 4
          else 5
        end,
        coalesce(st.opened_at, now()),
        st.ticket_number
    ) as keep_rank
  from public.service_tickets st
  join public.technicians tech on tech.id = st.assigned_technician_id
  where tech.active = true
    and st.scheduled_start is null
    and st.status not in ('Completed', 'Closed', 'Cancelled')
),
excess as (
  select
    r.id,
    r.dur,
    row_number() over (
      partition by r.assigned_technician_id
      order by r.keep_rank
    ) - 1 as slot_idx
  from ranked r
  where r.keep_rank > 2
),
placed as (
  select
    e.id,
    e.dur,
    (
      date '2026-08-17'
      + ((e.slot_idx / 2) || ' days')::interval
      + case when e.slot_idx % 2 = 0 then interval '8 hours' else interval '13 hours' end
    ) at time zone 'America/Chicago' as start_at
  from excess e
)
update public.service_tickets st
set
  scheduled_start = p.start_at,
  scheduled_window = case
    when p.dur <= 1 then
      'h' || lpad(extract(hour from p.start_at at time zone 'America/Chicago')::int::text, 2, '0')
    else
      'h' || lpad(extract(hour from p.start_at at time zone 'America/Chicago')::int::text, 2, '0')
      || 'x' || p.dur::text
  end
from placed p
where st.id = p.id;

