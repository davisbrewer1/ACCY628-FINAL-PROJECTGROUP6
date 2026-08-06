const fs = require("fs");
const T = {
  terry: "33333333-3333-3333-3333-333333333301",
  jamie: "33333333-3333-3333-3333-333333333302",
  chris: "33333333-3333-3333-3333-333333333303",
  dana: "33333333-3333-3333-3333-333333333304",
  evan: "33333333-3333-3333-3333-333333333305",
  fran: "33333333-3333-3333-3333-333333333306",
};
const C = {
  beacon: "11111111-1111-1111-1111-111111111102",
  cedar: "11111111-1111-1111-1111-111111111105",
  green: "11111111-1111-1111-1111-111111111108",
  harbor: "11111111-1111-1111-1111-111111111103",
  lake: "11111111-1111-1111-1111-111111111107",
  north: "11111111-1111-1111-1111-111111111101",
  pixel: "11111111-1111-1111-1111-111111111106",
  summit: "11111111-1111-1111-1111-111111111104",
};
const rows = [];
const a = (tech, cust, day, hour, dur, title, cat, pri, status, method, maxh, rq, resq) => {
  rows.push([
    T[tech],
    C[cust],
    day,
    hour,
    dur,
    title.replace(/'/g, "''"),
    cat,
    pri,
    status,
    method,
    maxh,
    rq,
    resq,
  ]);
};

a("terry", "north", "2026-07-28", 8, 3, "Workstation imaging batch - Northwind plant floor", "Hardware", "High", "Completed", "On-site", 4, 0.95, 0.98);
a("terry", "harbor", "2026-07-28", 12, 2, "Harbor register printer mapping", "Hardware", "Medium", "Completed", "On-site", 3, 0.9, 0.95);
a("terry", "summit", "2026-07-28", 15, 2, "Summit clinic VPN reconnect after ISP cut", "Networking", "Critical", "Completed", "Remote", 3, 0.98, 0.97);
a("terry", "beacon", "2026-07-29", 8, 2, "Beacon Legal MFA reset wave", "Software", "High", "Completed", "Remote", 3, 0.96, 0.96);
a("terry", "lake", "2026-07-29", 11, 3, "Lakeside scanner fleet firmware", "Hardware", "Medium", "Completed", "On-site", 4, 0.92, 0.94);
a("terry", "pixel", "2026-07-29", 15, 2, "PixelCraft Adobe license repair", "Software", "Low", "Completed", "Remote", 2, 0.9, 0.93);
a("terry", "cedar", "2026-07-30", 8, 4, "Cedar Schools lab switch replacement assist", "Networking", "High", "Completed", "On-site", 5, 0.94, 0.95);
a("terry", "green", "2026-07-30", 13, 3, "Greenfield teller PC rebuild", "Hardware", "Medium", "Completed", "On-site", 4, 0.93, 0.96);
a("terry", "north", "2026-07-31", 8, 2, "Northwind shared drive permissions", "Software", "Medium", "Completed", "Remote", 3, 0.95, 0.97);
a("terry", "harbor", "2026-07-31", 11, 3, "Harbor back-office Wi-Fi dead spots", "Networking", "High", "Completed", "On-site", 4, 0.97, 0.94);
a("terry", "summit", "2026-07-31", 15, 2, "Summit EHR thin-client refresh", "Hardware", "Medium", "Completed", "On-site", 3, 0.91, 0.95);
a("terry", "beacon", "2026-08-01", 8, 3, "Beacon mail migration cleanup", "Software", "High", "Completed", "Remote", 4, 0.96, 0.98);
a("terry", "lake", "2026-08-01", 12, 2, "Lakeside dock station swap", "Hardware", "Low", "Completed", "On-site", 3, 0.9, 0.92);
a("terry", "green", "2026-08-01", 15, 2, "Greenfield password policy rollout", "Software", "Medium", "Completed", "Remote", 2, 0.94, 0.96);

a("jamie", "cedar", "2026-07-28", 8, 3, "Cedar WAN failover test", "Networking", "Critical", "Completed", "On-site", 4, 0.9, 0.92);
a("jamie", "lake", "2026-07-28", 13, 2, "Lakeside VLAN cleanup", "Networking", "High", "Completed", "Remote", 3, 0.88, 0.9);
a("jamie", "north", "2026-07-29", 8, 4, "Northwind core switch stack upgrade", "Networking", "Critical", "Completed", "On-site", 5, 0.92, 0.88);
a("jamie", "harbor", "2026-07-29", 14, 2, "Harbor AP channel rebalance", "Networking", "Medium", "Completed", "On-site", 3, 0.85, 0.9);
a("jamie", "green", "2026-07-30", 8, 3, "Greenfield SD-WAN cutover assist", "Networking", "High", "Completed", "On-site", 4, 0.9, 0.91);
a("jamie", "summit", "2026-07-30", 13, 3, "Summit clinic guest Wi-Fi isolate", "Networking", "High", "Completed", "On-site", 4, 0.87, 0.89);
a("jamie", "pixel", "2026-07-31", 8, 2, "PixelCraft studio switch port flap", "Networking", "Medium", "Completed", "On-site", 3, 0.86, 0.9);
a("jamie", "beacon", "2026-07-31", 11, 3, "Beacon Legal site-to-site VPN", "Networking", "High", "Completed", "Remote", 4, 0.91, 0.93);
a("jamie", "cedar", "2026-08-01", 8, 3, "Cedar Schools fiber handoff", "Networking", "Critical", "Completed", "On-site", 4, 0.93, 0.9);
a("jamie", "lake", "2026-08-01", 13, 2, "Lakeside DHCP scope expansion", "Networking", "Medium", "Completed", "Remote", 2, 0.84, 0.88);

a("chris", "green", "2026-07-28", 8, 4, "Greenfield Azure AD sync repair", "Cloud & Servers", "High", "Completed", "Remote", 5, 0.82, 0.85);
a("chris", "north", "2026-07-29", 9, 3, "Northwind Hyper-V host patch", "Cloud & Servers", "High", "Completed", "On-site", 4, 0.8, 0.84);
a("chris", "beacon", "2026-07-30", 8, 4, "Beacon M365 archive mailbox move", "Cloud & Servers", "Medium", "Completed", "Remote", 5, 0.78, 0.82);
a("chris", "summit", "2026-07-31", 10, 3, "Summit RDS farm capacity add", "Cloud & Servers", "High", "Completed", "Remote", 4, 0.81, 0.8);
a("chris", "pixel", "2026-08-01", 8, 3, "PixelCraft backup vault restore drill", "Cloud & Servers", "Medium", "Completed", "Remote", 4, 0.79, 0.83);
a("chris", "harbor", "2026-08-01", 13, 2, "Harbor Entra device join cleanup", "Cloud & Servers", "Low", "Completed", "Remote", 3, 0.75, 0.8);

a("dana", "harbor", "2026-07-28", 8, 1, "Harbor laptop BitLocker unlock", "Hardware", "Medium", "Completed", "Remote", 2, 0.7, 0.65);
a("dana", "cedar", "2026-07-28", 10, 1, "Cedar teacher Chromebook enroll", "Hardware", "Low", "Completed", "On-site", 2, 0.6, 0.7);
a("dana", "pixel", "2026-07-28", 12, 2, "PixelCraft Wacom driver fix", "Hardware", "Medium", "Completed", "Remote", 3, 0.55, 0.6);
a("dana", "north", "2026-07-28", 15, 1, "Northwind headset USB issue", "Hardware", "Low", "Completed", "Remote", 1, 0.5, 0.55);
a("dana", "summit", "2026-07-29", 8, 2, "Summit laptop refresh prep", "Hardware", "Medium", "Completed", "On-site", 3, 0.65, 0.6);
a("dana", "beacon", "2026-07-29", 11, 1, "Beacon Outlook profile rebuild", "Software", "Medium", "Completed", "Remote", 2, 0.7, 0.55);
a("dana", "lake", "2026-07-29", 13, 2, "Lakeside barcode scanner pair", "Hardware", "Low", "Completed", "On-site", 3, 0.45, 0.5);
a("dana", "green", "2026-07-29", 16, 1, "Greenfield webcam for Teams", "Hardware", "Low", "Completed", "Remote", 1, 0.6, 0.65);
a("dana", "harbor", "2026-07-30", 8, 1, "Harbor POS peripheral check", "Hardware", "High", "Completed", "On-site", 2, 0.75, 0.5);
a("dana", "cedar", "2026-07-30", 10, 2, "Cedar cart PC imaging", "Hardware", "Medium", "Completed", "On-site", 3, 0.55, 0.58);
a("dana", "north", "2026-07-30", 13, 1, "Northwind printer tray jam", "Hardware", "Low", "Completed", "On-site", 2, 0.4, 0.45);
a("dana", "pixel", "2026-07-30", 15, 2, "PixelCraft dual-monitor setup", "Hardware", "Medium", "Completed", "On-site", 3, 0.62, 0.7);
a("dana", "summit", "2026-07-31", 8, 1, "Summit badge printer ink", "Hardware", "Low", "Completed", "On-site", 1, 0.5, 0.4);
a("dana", "beacon", "2026-07-31", 10, 2, "Beacon laptop docking station", "Hardware", "Medium", "Completed", "On-site", 3, 0.58, 0.62);
a("dana", "lake", "2026-07-31", 13, 1, "Lakeside Teams audio fix", "Software", "Medium", "Completed", "Remote", 2, 0.68, 0.55);
a("dana", "green", "2026-07-31", 15, 2, "Greenfield Windows updates stuck", "Software", "High", "Completed", "Remote", 3, 0.72, 0.48);
a("dana", "north", "2026-08-01", 8, 2, "Northwind new hire laptop kit", "Hardware", "Medium", "Completed", "On-site", 3, 0.6, 0.65);
a("dana", "harbor", "2026-08-01", 11, 1, "Harbor iPad kiosk reset", "Hardware", "Low", "Completed", "On-site", 2, 0.45, 0.5);
a("dana", "cedar", "2026-08-01", 13, 2, "Cedar staff laptop recall patch", "Hardware", "High", "Completed", "Remote", 3, 0.7, 0.55);
a("dana", "pixel", "2026-08-01", 16, 1, "PixelCraft mouse battery swap", "Hardware", "Low", "Completed", "On-site", 1, 0.55, 0.6);

a("evan", "green", "2026-07-28", 9, 3, "Greenfield phishing mailbox hunt", "Security", "Critical", "Completed", "Remote", 4, 0.35, 0.4);
a("evan", "beacon", "2026-07-29", 10, 2, "Beacon Legal conditional access tweak", "Security", "High", "Completed", "Remote", 3, 0.3, 0.35);
a("evan", "summit", "2026-07-30", 8, 3, "Summit EDR alert triage", "Security", "Critical", "Completed", "Remote", 4, 0.4, 0.3);
a("evan", "north", "2026-07-31", 11, 2, "Northwind firewall rule review", "Security", "Medium", "Completed", "Remote", 3, 0.25, 0.45);
a("evan", "lake", "2026-08-01", 9, 3, "Lakeside ransomware tabletop follow-up", "Security", "High", "Completed", "On-site", 4, 0.35, 0.38);

a("fran", "cedar", "2026-07-28", 10, 3, "Cedar UPS battery replace", "Infrastructure", "Medium", "Completed", "On-site", 4, 0.2, 0.25);
a("fran", "harbor", "2026-07-29", 8, 2, "Harbor rack cable dress", "Infrastructure", "Low", "Completed", "On-site", 3, 0.15, 0.2);
a("fran", "north", "2026-07-30", 9, 4, "Northwind SAN capacity expand", "Infrastructure", "High", "Completed", "On-site", 5, 0.25, 0.15);
a("fran", "green", "2026-07-31", 13, 2, "Greenfield HVAC sensor network", "Infrastructure", "Medium", "Completed", "On-site", 3, 0.1, 0.3);
a("fran", "summit", "2026-08-01", 8, 3, "Summit clinic IDF cleanup", "Infrastructure", "Medium", "Completed", "On-site", 4, 0.2, 0.22);

a("terry", "north", "2026-08-04", 8, 3, "Northwind ERP client freeze", "Software", "High", "Completed", "Remote", 4, 0.96, 0.97);
a("terry", "harbor", "2026-08-04", 13, 2, "Harbor morning POS open failure", "Hardware", "Critical", "Completed", "On-site", 3, 0.98, 0.95);
a("terry", "summit", "2026-08-04", 16, 1, "Summit label printer queue", "Hardware", "Low", "Completed", "Remote", 2, 0.9, 0.94);
a("terry", "beacon", "2026-08-05", 8, 2, "Beacon discovery hold mailbox", "Software", "Medium", "Completed", "Remote", 3, 0.94, 0.96);
a("terry", "lake", "2026-08-05", 11, 3, "Lakeside yard tablet deploy", "Hardware", "High", "Completed", "On-site", 4, 0.93, 0.95);
a("terry", "pixel", "2026-08-05", 15, 2, "PixelCraft Dropbox sync storm", "Software", "Medium", "Completed", "Remote", 3, 0.92, 0.93);
a("terry", "cedar", "2026-08-06", 8, 3, "Cedar admin office PC rebuild", "Hardware", "High", "In Progress", "On-site", 4, 0.95, 0.9);
a("terry", "green", "2026-08-06", 13, 2, "Greenfield VPN MFA prompt loop", "Software", "High", "In Progress", "Remote", 3, 0.97, 0.9);
a("terry", "north", "2026-08-07", 8, 2, "Northwind shared calendar ACL", "Software", "Medium", "Assigned", "Remote", 3, 0.9, 0.9);
a("terry", "harbor", "2026-08-07", 11, 3, "Harbor seasonal hire imaging", "Hardware", "Medium", "Assigned", "On-site", 4, 0.9, 0.9);
a("terry", "summit", "2026-08-08", 9, 2, "Summit Friday clinic walk-up window", "Hardware", "Low", "Assigned", "On-site", 3, 0.9, 0.9);

a("jamie", "lake", "2026-08-04", 8, 3, "Lakeside WAN brownout diagnose", "Networking", "Critical", "Completed", "On-site", 4, 0.9, 0.88);
a("jamie", "cedar", "2026-08-04", 13, 2, "Cedar AP firmware batch", "Networking", "High", "Completed", "Remote", 3, 0.86, 0.9);
a("jamie", "north", "2026-08-05", 8, 4, "Northwind distribution switch replace", "Networking", "Critical", "Completed", "On-site", 5, 0.91, 0.87);
a("jamie", "harbor", "2026-08-06", 8, 3, "Harbor storefront mesh AP add", "Networking", "High", "In Progress", "On-site", 4, 0.88, 0.85);
a("jamie", "green", "2026-08-06", 14, 2, "Greenfield DNS forwarder tweak", "Networking", "Medium", "Assigned", "Remote", 3, 0.85, 0.85);
a("jamie", "summit", "2026-08-07", 9, 3, "Summit clinic VLAN for imaging", "Networking", "High", "Assigned", "On-site", 4, 0.85, 0.85);
a("jamie", "pixel", "2026-08-08", 8, 2, "PixelCraft uplink utilization check", "Networking", "Medium", "Assigned", "Remote", 2, 0.85, 0.85);

a("chris", "beacon", "2026-08-04", 8, 4, "Beacon SharePoint site migrate", "Cloud & Servers", "High", "Completed", "Remote", 5, 0.8, 0.82);
a("chris", "green", "2026-08-05", 9, 3, "Greenfield SQL backup job fail", "Cloud & Servers", "Critical", "Completed", "Remote", 4, 0.83, 0.78);
a("chris", "north", "2026-08-06", 8, 3, "Northwind file server snapshot", "Cloud & Servers", "Medium", "In Progress", "On-site", 4, 0.78, 0.8);
a("chris", "pixel", "2026-08-07", 10, 2, "PixelCraft OneDrive quota bump", "Cloud & Servers", "Low", "Assigned", "Remote", 3, 0.75, 0.75);
a("chris", "summit", "2026-08-08", 8, 3, "Summit Azure VM resize", "Cloud & Servers", "High", "Assigned", "Remote", 4, 0.8, 0.8);

a("dana", "harbor", "2026-08-04", 8, 1, "Harbor drawer cash printer", "Hardware", "Medium", "Completed", "On-site", 2, 0.65, 0.55);
a("dana", "cedar", "2026-08-04", 10, 1, "Cedar stylus replacement", "Hardware", "Low", "Completed", "On-site", 1, 0.5, 0.6);
a("dana", "north", "2026-08-04", 12, 2, "Northwind laptop blue screen", "Hardware", "High", "Completed", "On-site", 3, 0.7, 0.5);
a("dana", "beacon", "2026-08-04", 15, 1, "Beacon keyboard remap", "Hardware", "Low", "Completed", "Remote", 1, 0.55, 0.6);
a("dana", "pixel", "2026-08-05", 8, 1, "PixelCraft color profile", "Software", "Low", "Completed", "Remote", 2, 0.6, 0.55);
a("dana", "lake", "2026-08-05", 10, 2, "Lakeside rugged tablet wipe", "Hardware", "Medium", "Completed", "On-site", 3, 0.58, 0.62);
a("dana", "green", "2026-08-05", 13, 1, "Greenfield Teams camera", "Hardware", "Medium", "Completed", "Remote", 2, 0.68, 0.5);
a("dana", "summit", "2026-08-05", 15, 2, "Summit nurse station PC", "Hardware", "High", "Completed", "On-site", 3, 0.72, 0.48);
a("dana", "harbor", "2026-08-06", 8, 2, "Harbor seasonal PC setup", "Hardware", "Medium", "In Progress", "On-site", 3, 0.6, 0.55);
a("dana", "cedar", "2026-08-06", 11, 1, "Cedar projector HDMI", "Hardware", "Low", "In Progress", "On-site", 2, 0.5, 0.5);
a("dana", "north", "2026-08-06", 14, 2, "Northwind scanner driver", "Hardware", "Medium", "Assigned", "Remote", 3, 0.55, 0.55);
a("dana", "beacon", "2026-08-07", 8, 1, "Beacon PDF default app", "Software", "Low", "Assigned", "Remote", 1, 0.55, 0.55);
a("dana", "lake", "2026-08-07", 10, 2, "Lakeside label printer", "Hardware", "Medium", "Assigned", "On-site", 3, 0.55, 0.55);
a("dana", "pixel", "2026-08-08", 9, 1, "PixelCraft font install", "Software", "Low", "Assigned", "Remote", 1, 0.55, 0.55);

a("evan", "beacon", "2026-08-04", 10, 3, "Beacon suspicious OAuth grant", "Security", "Critical", "Completed", "Remote", 4, 0.35, 0.32);
a("evan", "green", "2026-08-05", 9, 2, "Greenfield MFA fatigue reports", "Security", "High", "Completed", "Remote", 3, 0.3, 0.4);
a("evan", "north", "2026-08-06", 11, 3, "Northwind USB block policy", "Security", "Medium", "In Progress", "Remote", 4, 0.28, 0.35);
a("evan", "summit", "2026-08-07", 13, 2, "Summit phishing report review", "Security", "High", "Assigned", "Remote", 3, 0.3, 0.3);
a("evan", "lake", "2026-08-08", 9, 2, "Lakeside firewall log noise", "Security", "Medium", "Assigned", "Remote", 3, 0.25, 0.3);

a("fran", "cedar", "2026-08-04", 9, 3, "Cedar MDF thermostat alert", "Infrastructure", "Medium", "Completed", "On-site", 4, 0.2, 0.18);
a("fran", "harbor", "2026-08-05", 8, 2, "Harbor PDU circuit map", "Infrastructure", "Low", "Completed", "On-site", 3, 0.15, 0.25);
a("fran", "north", "2026-08-06", 10, 3, "Northwind rack rail install", "Infrastructure", "Medium", "In Progress", "On-site", 4, 0.22, 0.2);
a("fran", "green", "2026-08-07", 13, 2, "Greenfield camera NVR disk", "Infrastructure", "High", "Assigned", "On-site", 3, 0.2, 0.2);
a("fran", "summit", "2026-08-08", 8, 2, "Summit closet patch panel", "Infrastructure", "Low", "Assigned", "On-site", 3, 0.15, 0.2);

a("terry", "north", "2026-08-11", 9, 2, "Northwind weekly patch window", "Software", "Medium", "Assigned", "Remote", 3, 0.9, 0.9);
a("terry", "harbor", "2026-08-13", 13, 1, "Harbor register health check", "Hardware", "Low", "Assigned", "On-site", 2, 0.9, 0.9);
a("jamie", "cedar", "2026-08-11", 8, 2, "Cedar WAN utilization review", "Networking", "Medium", "Assigned", "Remote", 3, 0.85, 0.85);
a("jamie", "lake", "2026-08-14", 10, 1, "Lakeside AP reboot scheduled", "Networking", "Low", "Assigned", "Remote", 2, 0.85, 0.85);
a("chris", "green", "2026-08-12", 9, 3, "Greenfield backup restore drill", "Cloud & Servers", "High", "Assigned", "Remote", 4, 0.8, 0.8);
a("dana", "pixel", "2026-08-11", 11, 1, "PixelCraft new hire laptop", "Hardware", "Medium", "Assigned", "On-site", 2, 0.55, 0.55);
a("dana", "summit", "2026-08-13", 14, 1, "Summit badge reprint station", "Hardware", "Low", "Assigned", "On-site", 2, 0.55, 0.55);
a("evan", "beacon", "2026-08-12", 10, 2, "Beacon quarterly access review", "Security", "Medium", "Assigned", "Remote", 3, 0.3, 0.3);
a("fran", "north", "2026-08-13", 9, 2, "Northwind UPS self-test", "Infrastructure", "Low", "Assigned", "On-site", 3, 0.2, 0.2);

const values = rows
  .map(
    (r) =>
      `('${r[0]}','${r[1]}','${r[2]}',${r[3]},${r[4]},'${r[5]}','${r[6]}','${r[7]}','${r[8]}','${r[9]}',${r[10]},${r[11]},${r[12]})`,
  )
  .join(",\n");

const insert = `insert into public._seed_sched_staging (tech_id, customer_id, day, start_hour, duration_hours, title, category, priority, status, service_method, max_hours, response_quality, resolution_quality) values\n${values};`;
fs.writeFileSync("tmp-seed-clean-insert.sql", insert);

const materialize = fs.readFileSync(
  "supabase/migrations/20260806150000_seed_technician_schedules.sql",
  "utf8",
);
const mat = materialize.slice(materialize.indexOf("-- Materialize tickets"));
fs.writeFileSync("tmp-seed-materialize.sql", mat);
console.log("rows", rows.length, "insert", insert.length, "mat", mat.length);

// Split insert into chunks of 25 for MCP
const chunkSize = 25;
for (let i = 0, n = 0; i < rows.length; i += chunkSize, n += 1) {
  const slice = rows.slice(i, i + chunkSize);
  const chunkValues = slice
    .map(
      (r) =>
        `('${r[0]}','${r[1]}','${r[2]}',${r[3]},${r[4]},'${r[5]}','${r[6]}','${r[7]}','${r[8]}','${r[9]}',${r[10]},${r[11]},${r[12]})`,
    )
    .join(",\n");
  const q = `insert into public._seed_sched_staging (tech_id, customer_id, day, start_hour, duration_hours, title, category, priority, status, service_method, max_hours, response_quality, resolution_quality) values\n${chunkValues};`;
  fs.writeFileSync(`tmp-seed-chunk-${n}.sql`, q);
  console.log("chunk", n, slice.length, q.length);
}
