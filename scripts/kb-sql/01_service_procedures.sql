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
);
