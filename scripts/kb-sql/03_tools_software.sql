insert into public.knowledge_base_articles (title, content, category, tags)
values
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
);
