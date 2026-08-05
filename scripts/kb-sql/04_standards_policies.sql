insert into public.knowledge_base_articles (title, content, category, tags)
values
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
);
