insert into public.knowledge_base_articles (title, content, category, tags)
values
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
);
