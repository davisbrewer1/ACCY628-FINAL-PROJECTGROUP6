-- Expand technician Knowledge Base processes (text-only, no client docs)
delete from public.knowledge_base_articles;

insert into public.knowledge_base_articles (title, content, category, tags)
values
(
  'Device Setup Procedure',
  '## Purpose
Standard steps to set up a new or replacement workstation for an end user.

## Prerequisites
- Asset tag and serial number recorded
- Approved image or enrollment profile ready
- User account and license confirmed
- Ticket assigned and acknowledged

## Steps
1. Confirm ticket details and assigned user.
2. Verify asset tag / serial in Hardware Assets.
3. Image or enroll the device.
4. Join identity and confirm device compliance.
5. Install baseline apps from the approved catalog.
6. Map printers and shared drives as required.
7. Test sign-in, network, and email.
8. Update asset status to Active and assign the user.
9. Note completion on the ticket.

## Common Issues
- Enrollment loop — reboot and retry Autopilot / MDM sync
- Missing license — assign seat before continuing
- Printer not found — confirm queue name and network path
- BitLocker pending — wait for policy sync, then reboot

## Escalation
Escalate to a service manager if imaging fails twice or required access is missing.',
  'Service Procedures',
  array['setup', 'workstation', 'procedure', 'quick-access']::text[]
),
(
  'New User Onboarding Procedure',
  '## Purpose
Provision access and tools for a new hire so they can work on day one.

## Prerequisites
- Approved onboarding request / ticket
- Manager-confirmed start date and role
- License seats available
- Device ready or already assigned

## Steps
1. Verify identity details and start date.
2. Create or enable the user account.
3. Assign required licenses and groups.
4. Enroll MFA with the user.
5. Confirm mailbox and Teams / chat access.
6. Complete device setup or handoff.
7. Map printers, drives, and line-of-business apps.
8. Walk through sign-in and MFA once.
9. Mark the New User Checklist complete on the ticket.

## Common Issues
- License missing — assign seat before mailbox creation
- MFA delay — confirm phone time sync
- Wrong groups — verify with manager before closing

## Escalation
Escalate if HR / manager approval is missing or privileged access is requested.',
  'Service Procedures',
  array['onboarding', 'user', 'procedure', 'quick-access']::text[]
),
(
  'User Offboarding Procedure',
  '## Purpose
Securely disable access and recover company assets when a user leaves.

## Prerequisites
- Written offboarding authorization
- Last day / cutoff time confirmed
- Ticket open with manager contact
- Asset list for the user available

## Steps
1. Confirm authorization and cutoff time.
2. Disable or convert the account per policy.
3. Revoke sessions and MFA methods.
4. Remove group, VPN, and app access.
5. Secure mailbox and forwarding as directed.
6. Collect or wipe assigned devices.
7. Update Hardware Assets assignment.
8. Complete the Offboarding Checklist on the ticket.

## Common Issues
- Shared mailbox access still needed — confirm with manager
- Device not returned — document and escalate
- Shared credentials found — rotate immediately

## Escalation
Escalate for executive accounts, legal holds, or suspected data risk.',
  'Service Procedures',
  array['offboarding', 'user', 'procedure']::text[]
),
(
  'Printer Service Procedure',
  '## Purpose
Service a printer that is offline, erroring, or failing to print.

## Prerequisites
- Printer location and model known
- Network or USB connection type confirmed
- Ticket open with reported symptom

## Steps
1. Confirm power and Ready / Online status.
2. Check paper, toner, and visible error codes.
3. Verify cable or Wi-Fi association.
4. Ping the printer IP if networked.
5. Clear the print spooler on the affected PC.
6. Reinstall the approved driver if needed.
7. Send a test page.
8. Update the ticket with result.

## Common Issues
- Offline queue — restart spooler and printer
- Wrong driver — install approved package only
- IP changed — confirm DHCP reservation
- Paper jam sensor — clear path and restart

## Escalation
Escalate if the device stays unreachable after network checks or needs parts.',
  'Service Procedures',
  array['printer', 'procedure', 'hardware']::text[]
),
(
  'Laptop Repair Procedure',
  '## Purpose
Intake, diagnose, repair, and return a laptop under a service ticket.

## Prerequisites
- Ticket number and asset tag confirmed
- Photos of condition taken at intake
- Repair bay / parts access available

## Steps
1. Photograph device and confirm serial.
2. Set asset status to In Repair.
3. Reproduce the reported issue.
4. Run basic health checks (boot, disk, battery).
5. Repair using approved parts only.
6. Retest the original symptom.
7. Update asset status to Active.
8. Schedule return or pickup.
9. Complete the ticket after confirmation.

## Common Issues
- Intermittent failure — soak test before return
- No boot — try known-good charger / RAM reseat
- Disk warnings — back up before further work
- Missing parts — set On Hold and request stock

## Escalation
Escalate for data-loss risk, liquid damage beyond scope, or suspected security incident.',
  'Service Procedures',
  array['laptop', 'repair', 'procedure']::text[]
),
(
  'On-Site Visit Procedure',
  '## Purpose
Complete an on-site visit safely and leave clear ticket documentation.

## Prerequisites
- Site access and contact confirmed
- Ticket scope understood
- Required tools and spare cables packed

## Steps
1. Check in with the site contact.
2. Confirm the issue on site before changing anything.
3. Perform the approved work.
4. Test the fix with the user when possible.
5. Leave the workspace clean.
6. Update ticket status and notes before leaving.
7. Log accurate start and end times.

## Common Issues
- No site access — contact requester before traveling again
- Scope creep — confirm with manager before extra work
- Missing parts — document and schedule return visit

## Escalation
Escalate immediately for safety concerns or Critical outages beyond local fix.',
  'Service Procedures',
  array['onsite', 'procedure', 'field']::text[]
),
(
  'Ticket Handling Procedure',
  '## Purpose
Move a ticket from assignment to completion with consistent updates.

## Prerequisites
- Ticket assigned to you
- Customer impact understood
- Required access available

## Steps
1. Acknowledge the assignment.
2. Set status to In Progress when work starts.
3. Gather symptoms and recent changes.
4. Apply the fix using KB guides as needed.
5. Validate with the user when possible.
6. Log work entries with accurate times.
7. Add a short resolution note.
8. Set status to Completed after confirmation.

## Common Issues
- Waiting on customer — set On Hold with a clear reason
- Waiting on parts — note ETA in the ticket
- Unclear priority — confirm with the service manager

## Escalation
Escalate for SLA risk, security incidents, or blocked access after two attempts.',
  'Service Procedures',
  array['tickets', 'sop', 'procedure', 'quick-access']::text[]
),
(
  'Password Reset Procedure',
  '## Purpose
Reset a user password safely after verifying identity.

## Prerequisites
- Open ticket or authenticated request
- Approved identity verification script ready
- Access to the identity admin center

## Steps
1. Verify caller identity using the approved script.
2. Confirm username / UPN.
3. Reset the password in the identity admin center.
4. Clear lockout if present.
5. Have the user sign in and set a new password if required.
6. Confirm MFA still works.
7. Record verification method on the ticket.

## Common Issues
- Cannot verify identity — stop and escalate
- MFA also broken — follow MFA Issues guide
- Account compromise indicators — do not reset casually

## Escalation
Escalate if identity cannot be verified or compromise is suspected.',
  'Service Procedures',
  array['password', 'identity', 'procedure', 'quick-access']::text[]
),
(
  'Software Install Procedure',
  '## Purpose
Install approved software on a managed device without breaking policy.

## Prerequisites
- Ticket approving the request
- App is on the approved catalog or exception granted
- License available if required
- Admin rights or RMM deploy method ready

## Steps
1. Confirm the exact app name and version needed.
2. Check license and existing install.
3. Deploy via RMM / company portal when possible.
4. If manual, use the signed package from the approved source.
5. Complete first-run setup with the user.
6. Confirm the app launches and signs in.
7. Note version and method on the ticket.

## Common Issues
- Blocked by policy — request exception through change process
- Wrong architecture — confirm 64-bit vs ARM
- License activation fails — verify seat assignment

## Escalation
Escalate for unapproved software requests or deployment failures after two attempts.',
  'Service Procedures',
  array['software', 'install', 'procedure']::text[]
),
(
  'Patch Update Procedure',
  '## Purpose
Apply or verify OS and security patches on a managed endpoint.

## Prerequisites
- Ticket or maintenance window confirmed
- Device online in RMM
- Backup / restore point status checked for servers

## Steps
1. Confirm device and maintenance window.
2. Check pending updates in RMM / update console.
3. Notify the user if reboot is required.
4. Push or approve the update ring.
5. Reboot if required and wait for check-in.
6. Verify patch status and device health.
7. Update the ticket with result.

## Common Issues
- Update loop — run repair steps from Windows Update guide
- Device offline — schedule when online
- App breaks after patch — document and roll back if approved

## Escalation
Escalate for failed server patches or widespread update failures.',
  'Service Procedures',
  array['patch', 'updates', 'procedure']::text[]
),
(
  'Backup Verification Procedure',
  '## Purpose
Confirm backups are healthy before changes or after reported failures.

## Prerequisites
- Device / server identified
- Access to the Backup Dashboard
- Ticket open with scope

## Steps
1. Open the Backup Dashboard for the asset.
2. Confirm last successful backup time.
3. Review failed jobs and error text.
4. Confirm retention meets the request.
5. Document findings on the ticket.
6. Only proceed with restore after manager approval when needed.

## Common Issues
- Agent offline — fix connectivity first
- Storage full — escalate with error details
- Missing restore point — do not wipe data

## Escalation
Escalate any restore request or repeated job failures.',
  'Service Procedures',
  array['backup', 'procedure', 'recovery']::text[]
),
(
  'Device Retirement Procedure',
  '## Purpose
Retire a device securely and update records when it leaves service.

## Prerequisites
- Manager approval to retire
- Replacement or data path confirmed
- Wipe method available

## Steps
1. Confirm asset tag and serial.
2. Back up or transfer user data if required.
3. Remove from domain / MDM and RMM.
4. Wipe the device using the approved method.
5. Remove licenses tied only to that device if applicable.
6. Set asset status to Retired in Hardware Assets.
7. Store or dispose per policy.
8. Close the ticket with wipe method noted.

## Common Issues
- BitLocker key needed — retrieve from escrow before wipe
- User files missing — pause and confirm with manager
- Still checking into RMM — force agent removal

## Escalation
Escalate for devices under legal hold or unclear ownership.',
  'Service Procedures',
  array['retirement', 'wipe', 'procedure']::text[]
),
(
  'Printer Offline',
  '## Symptoms
- Printer shows Offline
- Jobs stuck in queue
- Cannot ping printer IP

## Quick Checks
- Power and Ready light
- Cable / Wi-Fi connection
- Correct printer selected on the PC
- Recent IP or queue change

## Fix Steps
1. Power-cycle the printer.
2. Confirm network link or USB connection.
3. Ping the printer IP.
4. Restart the Print Spooler service on the PC.
5. Remove and re-add the approved queue if needed.
6. Print a test page.

## Escalation Criteria
Escalate if unreachable after network checks or hardware fault is confirmed.',
  'Troubleshooting Guides',
  array['printer', 'offline', 'troubleshooting', 'quick-access']::text[]
),
(
  'Email Troubleshooting',
  '## Symptoms
- Cannot send or receive mail
- Outlook stuck on password prompt
- Search or sync not working

## Quick Checks
- Internet connectivity
- Correct mailbox / account
- Recent password or MFA change
- Quarantine or license status

## Fix Steps
1. Confirm sign-in on webmail.
2. Re-enter credentials / complete MFA.
3. Repair Outlook profile or recreate account if needed.
4. Clear stuck send queue.
5. Test send/receive.
6. Note result on the ticket.

## Escalation Criteria
Escalate for mailbox corruption, tenant-wide mail flow issues, or suspected compromise.',
  'Troubleshooting Guides',
  array['email', 'outlook', 'troubleshooting', 'quick-access']::text[]
),
(
  'Password Reset',
  '## Symptoms
- User locked out
- Forgotten password
- Password expired

## Quick Checks
- Verify caller identity using the approved script
- Confirm username / UPN
- Check lockout or MFA blocks

## Fix Steps
1. Verify identity.
2. Reset password in the identity admin center.
3. Clear lockout if present.
4. Have the user sign in and set a new password if required.
5. Confirm MFA still works.
6. Record verification method on the ticket.

## Escalation Criteria
Escalate if identity cannot be verified or account shows compromise indicators.',
  'Troubleshooting Guides',
  array['password', 'identity', 'troubleshooting', 'quick-access']::text[]
),
(
  'VPN Setup & Failures',
  '## Symptoms
- VPN will not connect
- Connected but no internal resources
- Adapter or DNS errors

## Quick Checks
- Internet works without VPN
- Correct customer profile selected
- Client version is approved
- Recent OS or security updates

## Fix Steps
1. Disconnect and quit the VPN client.
2. Reboot the PC.
3. Reinstall the approved VPN package if needed.
4. Re-import the profile.
5. Connect and test an internal resource.
6. Flush DNS if name resolution fails.

## Escalation Criteria
Escalate for gateway outages or profile changes that require admin approval.',
  'Troubleshooting Guides',
  array['vpn', 'remote', 'troubleshooting', 'quick-access']::text[]
),
(
  'MFA Issues',
  '## Symptoms
- MFA prompts not received
- Lost phone / authenticator
- MFA fatigue or unexpected prompts

## Quick Checks
- Correct user account
- Phone time sync
- Existing MFA methods on the account
- Unusual sign-in locations

## Fix Steps
1. Verify identity.
2. Remove stale MFA methods if resetting.
3. Require re-registration at next sign-in.
4. Complete setup with the user.
5. Confirm a successful test sign-in.
6. Document the change on the ticket.

## Escalation Criteria
Escalate for suspected account takeover or repeated MFA fatigue attacks.',
  'Troubleshooting Guides',
  array['mfa', 'identity', 'troubleshooting', 'quick-access']::text[]
),
(
  'WiFi Connectivity',
  '## Symptoms
- Cannot join SSID
- Connected with no internet
- Intermittent drops

## Quick Checks
- Correct SSID and password / cert
- Airplane mode off
- Other devices on same SSID
- Signal strength in the area

## Fix Steps
1. Forget and rejoin the network.
2. Renew the DHCP lease.
3. Test another device.
4. Toggle Wi-Fi adapter / reboot.
5. Check AP or controller status if site-wide.
6. Update the ticket with scope.

## Escalation Criteria
Escalate for site-wide wireless outages or controller failures.',
  'Troubleshooting Guides',
  array['wifi', 'network', 'troubleshooting']::text[]
),
(
  'Slow Computer Performance',
  '## Symptoms
- Long boot or login times
- Apps freeze or hang
- High disk / CPU / memory usage

## Quick Checks
- Free disk space
- Recent installs or updates
- Startup apps count
- Malware / EDR alerts

## Fix Steps
1. Check Task Manager for resource hogs.
2. Free disk space and empty temp files safely.
3. Disable unnecessary startup apps.
4. Run an EDR quick scan.
5. Reboot and retest with the user.
6. Note findings on the ticket.

## Escalation Criteria
Escalate for failing disks, recurring malware, or business-critical app slowness.',
  'Troubleshooting Guides',
  array['performance', 'slow', 'troubleshooting']::text[]
),
(
  'No Internet / Network Down',
  '## Symptoms
- No internet access
- Cannot reach internal servers
- Limited connectivity message

## Quick Checks
- Cable / Wi-Fi connected
- Link lights on NIC / switch
- IP address assigned
- Other users affected?

## Fix Steps
1. Confirm physical / Wi-Fi link.
2. Renew IP / release DHCP.
3. Ping gateway and a known internal host.
4. Flush DNS and reset the adapter if needed.
5. Test a known-good device on the same port / SSID.
6. Document single-user vs site-wide scope.

## Escalation Criteria
Escalate immediately for site-wide outages or core switch / firewall failures.',
  'Troubleshooting Guides',
  array['network', 'internet', 'troubleshooting']::text[]
),
(
  'Windows Update Failures',
  '## Symptoms
- Updates stuck downloading
- Error codes on install
- Restart loop after patching

## Quick Checks
- Disk space available
- Device online and checking into RMM
- Recent policy or ring change

## Fix Steps
1. Reboot and retry the update.
2. Run Windows Update troubleshooter.
3. Free disk space if low.
4. Reset update components if still failing.
5. Reboot and confirm status in RMM.
6. Note error code on the ticket.

## Escalation Criteria
Escalate for Feature Update rollbacks or many devices failing the same patch.',
  'Troubleshooting Guides',
  array['windows', 'updates', 'troubleshooting']::text[]
),
(
  'Shared Drive Access Issues',
  '## Symptoms
- Access denied to a share
- Drive mapping missing
- Can see folder but cannot open files

## Quick Checks
- User is on VPN / corporate network
- Correct path / drive letter
- Recent group membership changes
- Other users can access the same share

## Fix Steps
1. Confirm network / VPN connectivity.
2. Remap the approved drive path.
3. Verify group membership with the manager request.
4. Sign out and back in after group changes.
5. Test open / save of a file.
6. Update the ticket with path and result.

## Escalation Criteria
Escalate for permission redesign requests or server-side share outages.',
  'Troubleshooting Guides',
  array['shares', 'permissions', 'troubleshooting']::text[]
),
(
  'Audio / Webcam Not Working',
  '## Symptoms
- No sound or mic in meetings
- Webcam not detected
- App cannot access camera / mic

## Quick Checks
- Correct playback / recording device selected
- Privacy permissions allowed
- Device not muted physically
- Works in another app?

## Fix Steps
1. Confirm Windows privacy settings for camera / mic.
2. Select the correct device in Sound settings.
3. Update or reinstall the device driver if needed.
4. Test in a second app (Camera / Voice Recorder).
5. Reboot and retest the meeting app.
6. Note device model on the ticket.

## Escalation Criteria
Escalate for hardware failure after driver reinstall or dock-related failures.',
  'Troubleshooting Guides',
  array['audio', 'webcam', 'troubleshooting']::text[]
),
(
  'Blue Screen / Unexpected Restart',
  '## Symptoms
- Blue screen error
- Sudden restarts
- Crash dumps present

## Quick Checks
- Recent hardware or driver changes
- Overheating / power issues
- Disk health warnings
- EDR detections

## Fix Steps
1. Capture the stop code from the screen or Event Viewer.
2. Boot and check disk / SMART status.
3. Remove recently added hardware if practical.
4. Update chipset / display drivers from approved source.
5. Run EDR scan.
6. Document stop code and actions on the ticket.

## Escalation Criteria
Escalate for recurring BSODs, suspected memory failure, or data-loss risk.',
  'Troubleshooting Guides',
  array['bsod', 'crash', 'troubleshooting']::text[]
),
(
  'RMM Tool',
  '## What it is used for
Remote monitoring, scripting, patch visibility, and device inventory for managed endpoints.

## How to log in
Use your Nexus staff SSO / approved RMM credentials. Never share agent keys in tickets.

## Common actions
- Find a device by hostname or asset tag
- Review alerts and last check-in
- Run approved scripts only
- Push or verify patch status
- Start a remote session when authorized

## Common errors
- Device offline — confirm power and network first
- Agent missing — reinstall from approved package
- Script denied — request elevated approval',
  'Tools & Software',
  array['rmm', 'tools', 'remote']::text[]
),
(
  'PSA / Ticketing System',
  '## What it is used for
Ticket tracking, time entry, assignment, and status updates for service work.

## How to log in
Sign in with your Nexus staff account. Use the technician board for assigned work.

## Common actions
- Open and update assigned tickets
- Change status (In Progress, On Hold, Completed)
- Log work entries with start/end times
- Add short resolution notes
- Attach photos or logs when useful

## Common errors
- Ticket not visible — confirm assignment and filters
- Cannot change status — refresh or re-open the ticket
- Time entry rejected — verify required fields',
  'Tools & Software',
  array['psa', 'tickets', 'tools']::text[]
),
(
  'Remote Access',
  '## What it is used for
Attended or approved remote control sessions to troubleshoot end-user devices.

## How to log in
Launch the approved remote tool and authenticate with staff credentials.

## Common actions
- Start a session with user consent
- Transfer approved files only
- Run diagnostics during the session
- End the session and note actions on the ticket

## Common errors
- User declines prompt — reschedule or switch to on-site
- Black screen — ask user to confirm display / permissions
- Session drops — confirm bandwidth and retry once',
  'Tools & Software',
  array['remote', 'tools', 'support']::text[]
),
(
  'Backup Dashboard',
  '## What it is used for
Verify backup jobs, review failures, and confirm restore points before changes.

## How to log in
Use the approved backup console with staff MFA.

## Common actions
- Check last successful backup time
- Review failed jobs and error text
- Confirm retention for the device or server
- Document findings on the ticket before restore work

## Common errors
- Job failing storage — escalate with error code
- Agent offline — confirm device connectivity
- Missing restore point — do not wipe until manager confirms',
  'Tools & Software',
  array['backup', 'tools', 'recovery']::text[]
),
(
  'Antivirus / EDR',
  '## What it is used for
Endpoint protection status, quarantine review, and threat investigation support.

## How to log in
Open the security console with staff SSO / MFA.

## Common actions
- Confirm agent online and policy applied
- Review quarantine / detections
- Force a policy sync
- Reinstall agent from the approved package only

## Common errors
- Agent offline — check network and services
- False positive — collect hash / path before restore
- Policy not applying — sync and reboot once',
  'Tools & Software',
  array['antivirus', 'edr', 'security', 'tools']::text[]
),
(
  'Identity Admin Center',
  '## What it is used for
User accounts, password resets, MFA methods, group membership, and license assignment.

## How to log in
Sign in with your privileged staff account and MFA. Use least privilege roles only.

## Common actions
- Reset passwords after identity verification
- Manage MFA methods
- Assign / remove groups and licenses
- Review sign-in logs for lockouts
- Disable accounts during offboarding

## Common errors
- Insufficient role — request elevation through manager
- User not found — confirm UPN spelling
- License assignment delayed — wait and refresh',
  'Tools & Software',
  array['identity', 'entra', 'tools', 'mfa']::text[]
),
(
  'Company Portal / MDM',
  '## What it is used for
Device enrollment, compliance checks, company app installs, and policy sync.

## How to log in
Users: Company Portal app with work account. Techs: MDM admin console with staff MFA.

## Common actions
- Check device compliance status
- Sync device to pull policies
- Deploy required apps
- Review enrollment errors
- Retire / wipe only when authorized

## Common errors
- Enrollment stuck — reboot and retry sync
- Non-compliant — open compliance details and remediate
- App not installing — confirm assignment group',
  'Tools & Software',
  array['mdm', 'intune', 'tools', 'enrollment']::text[]
),
(
  'Password Manager / Vault',
  '## What it is used for
Store and retrieve approved shared credentials for support work. Never store personal user passwords here without policy.

## How to log in
Use staff SSO into the approved vault. Do not export credentials to email or chat.

## Common actions
- Check out a credential for a ticket
- Check it back in when finished
- Rotate after shared use if required
- Record ticket number in the vault note when prompted

## Common errors
- Access denied — request vault folder permission
- Credential outdated — escalate to owner for rotation
- Checkout conflict — wait or contact current holder',
  'Tools & Software',
  array['vault', 'passwords', 'tools']::text[]
),
(
  'Documentation Wiki',
  '## What it is used for
Internal runbooks, network notes, and process docs that supplement this Knowledge Base.

## How to log in
Open the internal wiki with staff SSO. Prefer this Knowledge Base for day-to-day tech steps.

## Common actions
- Search by site or system name
- Open the related KB article first for standard fixes
- Copy only approved snippets into tickets
- Flag outdated pages to a service manager

## Common errors
- Page missing — search KB categories instead
- Conflicting steps — follow KB + ask manager
- Client-specific pricing found — do not use or share',
  'Tools & Software',
  array['docs', 'wiki', 'tools']::text[]
),
(
  'Expense Tracker',
  '## What it is used for
Log technician expenses and upload receipts for parts, travel, or approved purchases.

## How to log in
Open Expense Tracker from the technician navigation while signed in.

## Common actions
- Create an expense tied to a ticket when possible
- Upload one or more receipt images
- Enter amount, date, and short description
- Submit for review

## Common errors
- Upload fails — retry with a smaller image
- Missing ticket link — add ticket number in notes
- Duplicate entry — void / note before resubmitting',
  'Tools & Software',
  array['expenses', 'receipts', 'tools']::text[]
),
(
  'Naming Conventions',
  '## Device names
- Prefer site or role prefix + unique ID
- Avoid spaces and special characters
- Update Hardware Assets when renamed

## Ticket titles
- Short and specific (what + where)
- No customer pricing language
- Include asset tag when relevant

## User accounts
- Match approved identity format
- Do not create personal admin aliases
- Document exceptions on the ticket',
  'Standards & Policies',
  array['standards', 'naming', 'policy']::text[]
),
(
  'Password Policy',
  '## Expectations
- Follow the enforced length and complexity rules
- Never share passwords in chat or email
- Prefer password manager / vault workflows
- Reset only after identity verification
- Do not disable MFA to make it easier
- Rotate shared credentials after use when required',
  'Standards & Policies',
  array['password', 'security', 'policy']::text[]
),
(
  'Ticketing Expectations',
  '## Expectations
- Acknowledge assignments promptly
- Keep status accurate (In Progress / On Hold / Completed)
- Log time for work performed
- Write short, clear notes
- No pricing, margins, or contract rates in notes
- Escalate early for SLA or security risk
- Attach evidence when it helps the next tech',
  'Standards & Policies',
  array['tickets', 'standards', 'policy']::text[]
),
(
  'Security Protocols',
  '## Expectations
- Verify identity before account changes
- Use least privilege access
- Preserve evidence for suspected incidents
- Do not forward phishing samples to distribution lists
- Report compromise indicators immediately
- Wipe loaner media after use
- Never bypass MFA or EDR for convenience',
  'Standards & Policies',
  array['security', 'policy', 'standards']::text[]
),
(
  'Communication Guidelines',
  '## Expectations
- Be clear, calm, and specific
- Confirm next steps and windows
- Avoid internal jargon when talking to users
- Never discuss pricing or margins
- Summarize outcomes in plain language
- Keep ticket notes professional
- Set expectations when waiting on parts or third parties',
  'Standards & Policies',
  array['communication', 'standards', 'policy']::text[]
),
(
  'Remote Support Policy',
  '## Expectations
- Get user consent before remote control
- Announce actions that reboot or change settings
- Transfer only approved files
- End the session when finished
- Document what was done on the ticket
- Switch to on-site when remote is unsafe or ineffective',
  'Standards & Policies',
  array['remote', 'policy', 'standards']::text[]
),
(
  'Change Management Basics',
  '## Expectations
- Use a Change Request for non-standard work
- Include risk and rollback notes
- Get approval before production changes
- Work inside the approved window
- Confirm success after the change
- Update the ticket and related docs',
  'Standards & Policies',
  array['change', 'policy', 'standards']::text[]
),
(
  'Asset Handling Standards',
  '## Expectations
- Record asset tag and serial before moves
- Keep status current (Active / In Repair / Retired)
- Photograph damage at intake
- Store devices in labeled locations
- Wipe before retirement or redeploy
- Never leave unencrypted drives unattended',
  'Standards & Policies',
  array['assets', 'hardware', 'policy']::text[]
),
(
  'After-Hours / Escalation Policy',
  '## Expectations
- Follow Critical / High SLA windows
- Escalate security incidents immediately
- Do not wait out a blocked Critical ticket
- Notify the service manager for site-wide outages
- Leave a clear handoff note if shifting shifts
- Log all after-hours work time accurately',
  'Standards & Policies',
  array['escalation', 'oncall', 'policy']::text[]
),
(
  'Data Handling Standards',
  '## Expectations
- Access only the data needed for the ticket
- Do not copy customer files to personal devices
- Use approved transfer methods only
- Remove local copies when the ticket closes
- Report suspected data exposure immediately
- Follow legal hold instructions without wiping',
  'Standards & Policies',
  array['data', 'privacy', 'policy']::text[]
),
(
  'New User Checklist',
  '## New user checklist
- [ ] Identity account created / licensed
- [ ] MFA enrolled
- [ ] Mailbox accessible
- [ ] Groups / shares assigned
- [ ] Device set up or enrolled
- [ ] Printers / apps confirmed
- [ ] VPN access tested if required
- [ ] User can sign in successfully
- [ ] Ticket updated with completion notes',
  'Templates & Forms',
  array['checklist', 'onboarding', 'template', 'quick-access']::text[]
),
(
  'Offboarding Checklist',
  '## Offboarding checklist
- [ ] Confirm offboarding authorization
- [ ] Disable / convert account per policy
- [ ] Revoke MFA and sessions
- [ ] Remove group and app access
- [ ] Remove VPN / remote access
- [ ] Redirect or secure mailbox as directed
- [ ] Collect or wipe device
- [ ] Update asset assignment
- [ ] Document actions on the ticket',
  'Templates & Forms',
  array['checklist', 'offboarding', 'template']::text[]
),
(
  'Change Request Form',
  '## Change request
- **Requestor:**
- **Systems affected:**
- **Change summary:**
- **Business reason:**
- **Scheduled window:**
- **Risk / rollback plan:**
- **Approver:**
- **Ticket #:**

Keep entries short. Do not include pricing.',
  'Templates & Forms',
  array['change', 'form', 'template']::text[]
),
(
  'Ticket Resolution Template',
  '## Resolution template
- **Issue:**
- **Cause:**
- **Actions taken:**
- **Result:**
- **Follow-up (if any):**

Use plain language. No pricing or contract details.',
  'Templates & Forms',
  array['ticket', 'resolution', 'template']::text[]
),
(
  'On-Site Visit Checklist',
  '## On-site visit checklist
- [ ] Site contact and access confirmed
- [ ] Ticket scope reviewed
- [ ] Tools / parts packed
- [ ] Check-in completed on arrival
- [ ] Issue confirmed before changes
- [ ] Work tested with user when possible
- [ ] Workspace left clean
- [ ] Ticket notes and time logged before leaving',
  'Templates & Forms',
  array['onsite', 'checklist', 'template']::text[]
),
(
  'Device Intake Form',
  '## Device intake
- **Ticket #:**
- **Asset tag / serial:**
- **Device type / model:**
- **Reported issue:**
- **Accessories included:**
- **Visible damage:**
- **Photos taken:** Yes / No
- **Intake tech:**
- **Date in:**

Set asset status to In Repair after intake.',
  'Templates & Forms',
  array['intake', 'repair', 'template']::text[]
),
(
  'Password Reset Verification Script',
  '## Verification script
1. Ask for full name and username / UPN.
2. Confirm a recent ticket or manager-known detail.
3. Ask one approved private identifier (last 4 of employee ID, manager name, etc.).
4. If any check fails — stop and escalate.
5. If checks pass — proceed with reset and note method used.

Never reset based on email alone for privileged accounts.',
  'Templates & Forms',
  array['password', 'verification', 'template']::text[]
),
(
  'Incident Handoff Template',
  '## Incident handoff
- **Ticket # / severity:**
- **Impact summary:**
- **What was tried:**
- **Current status:**
- **Next action needed:**
- **Who is waiting / ETA:**
- **Risk if delayed:**

Keep it short enough for the next tech to act immediately.',
  'Templates & Forms',
  array['incident', 'handoff', 'template']::text[]
),
(
  'Remote Session Notes Template',
  '## Remote session notes
- **Ticket #:**
- **User consent obtained:** Yes / No
- **Device name:**
- **Issue confirmed:**
- **Actions during session:**
- **Reboot performed:** Yes / No
- **Result:**
- **Follow-up:**',
  'Templates & Forms',
  array['remote', 'notes', 'template']::text[]
),
(
  'Loaner Device Checklist',
  '## Loaner device checklist
- [ ] Asset tag recorded
- [ ] Device wiped / baseline imaged
- [ ] Assigned to user on ticket
- [ ] Charger and accessories noted
- [ ] Expected return date set
- [ ] User can sign in
- [ ] On return: wipe and update asset status',
  'Templates & Forms',
  array['loaner', 'checklist', 'template']::text[]
),
(
  'Quick Access',
  '## Most-used guides
Open these first for common technician work:

1. **New user setup** → New User Onboarding Procedure / New User Checklist
2. **Password reset** → Password Reset Procedure / Password Reset
3. **Email troubleshooting** → Email Troubleshooting
4. **Printer offline** → Printer Offline
5. **VPN setup** → VPN Setup & Failures
6. **MFA issues** → MFA Issues
7. **Ticket handling** → Ticket Handling Procedure
8. **Offboarding** → User Offboarding Procedure / Offboarding Checklist

Search by title or tag if the item is not listed here.',
  'Quick Access',
  array['quick-access', 'index', 'most-used']::text[]
);
