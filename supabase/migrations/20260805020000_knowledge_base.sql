-- Technician knowledge base articles (no customer billing/pricing content)

create table if not exists public.knowledge_base_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null,
  tags text[] not null default '{}',
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_base_articles_category_idx
  on public.knowledge_base_articles (category);

create index if not exists knowledge_base_articles_updated_at_idx
  on public.knowledge_base_articles (updated_at desc);

create index if not exists knowledge_base_articles_tags_gin_idx
  on public.knowledge_base_articles using gin (tags);

alter table public.knowledge_base_articles enable row level security;

-- Internal roles only — never expose to client portal users
create policy "Internal staff can read knowledge base"
  on public.knowledge_base_articles for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in (
          'administrator',
          'executive',
          'service_manager',
          'account_manager',
          'technician',
          'billing'
        )
    )
  );

create policy "Managers can insert knowledge base articles"
  on public.knowledge_base_articles for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('administrator', 'service_manager')
    )
  );

create policy "Managers can update knowledge base articles"
  on public.knowledge_base_articles for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('administrator', 'service_manager')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('administrator', 'service_manager')
    )
  );

insert into public.knowledge_base_articles (title, content, category, tags)
select * from (values
  (
    'Laptop Imaging Checklist',
    E'# Laptop Imaging Checklist\n\nUse this SOP when preparing a replacement or new-hire laptop.\n\n## Steps\n1. Verify asset tag and warranty status in Hardware Assets.\n2. Wipe the drive and apply the standard Windows image.\n3. Join the device to Azure AD / Intune.\n4. Install baseline apps from the managed catalog.\n5. Confirm BitLocker is enabled and recovery key escrowed.\n6. Run a connectivity test on customer VPN if required.\n\n## Notes\n- Do **not** discuss pricing with the customer.\n- Capture serial number and update the hardware record before shipping.',
    'Hardware',
    array['laptop','imaging','intune','sop']
  ),
  (
    'Printer Offline Troubleshooting',
    E'# Printer Offline Troubleshooting\n\n## Quick checks\n- Confirm the printer is powered on and shows a ready state.\n- Verify network cable / Wi-Fi association.\n- Ping the printer IP from a known-good workstation.\n- Clear the print spooler on the affected PC if jobs are stuck.\n\n## Escalation\nIf the device remains unreachable after network checks, flag hardware failure and schedule on-site replacement.',
    'Hardware',
    array['printer','network','troubleshooting']
  ),
  (
    'Windows Update Failure Recovery',
    E'# Windows Update Failure Recovery\n\n## Symptoms\nUpdate pending restart loops, error `0x80070002`, or Feature Update rollback.\n\n## Resolution\n1. Run `DISM /Online /Cleanup-Image /RestoreHealth`.\n2. Run `sfc /scannow`.\n3. Reset Windows Update components if needed.\n4. Reboot and retry the update ring policy from Intune.\n\nDocument hours against the related service ticket.',
    'Software',
    array['windows','updates','intune']
  ),
  (
    'VPN Client Reinstall Guide',
    E'# VPN Client Reinstall Guide\n\n1. Uninstall the existing VPN client.\n2. Remove leftover adapters in Device Manager.\n3. Reboot.\n4. Install the approved client package from the software catalog.\n5. Import the customer profile and test split-tunnel connectivity.\n\n## Security\nOnly use signed packages from the internal software repository.',
    'Software',
    array['vpn','connectivity','client']
  ),
  (
    'Switch Port Bounce Procedure',
    E'# Switch Port Bounce Procedure\n\nUse when a single endpoint loses connectivity but neighboring ports are healthy.\n\n```\nconfigure terminal\ninterface GigabitEthernet1/0/24\nshutdown\nno shutdown\nend\nwrite memory\n```\n\nConfirm link lights and DHCP lease after the bounce. Log the change in the ticket notes.',
    'Networking',
    array['switch','cisco','connectivity']
  ),
  (
    'DNS Resolution Failure Playbook',
    E'# DNS Resolution Failure Playbook\n\n1. Confirm the client receives the correct DNS servers via DHCP.\n2. Test `nslookup` against internal and public resolvers.\n3. Flush client DNS cache.\n4. Check firewall allow rules for UDP/TCP 53.\n5. If site-wide, escalate to Networking on-call.\n\nAvoid changing customer DNS to public resolvers unless approved.',
    'Networking',
    array['dns','troubleshooting','network']
  ),
  (
    'Suspected Phishing Response',
    E'# Suspected Phishing Response\n\n## Immediate actions\n1. Instruct the user not to open attachments or links.\n2. Quarantine the message in the email security portal.\n3. Reset credentials if the user interacted with the lure.\n4. Flag the ticket as a **Security Concern**.\n5. Capture headers and sample for the cybersecurity queue.\n\nDo not forward the raw phishing email to distribution lists.',
    'Security',
    array['phishing','security','incident']
  ),
  (
    'MFA Reset SOP',
    E'# MFA Reset SOP\n\n1. Verify caller identity using the approved verification script.\n2. Remove existing MFA methods in the identity admin center.\n3. Require re-registration at next sign-in.\n4. Notify the customer admin contact.\n5. Record verification method used in the ticket.\n\nNever disable MFA permanently without manager approval.',
    'SOPs',
    array['mfa','identity','sop']
  ),
  (
    'On-site Visit Safety Checklist',
    E'# On-site Visit Safety Checklist\n\n- Confirm site access and point of contact before travel.\n- Bring asset tags, spare cables, and sanitized tools.\n- Photograph rack/labeling before changes when practical.\n- Leave the workspace cleaner than you found it.\n- Update ticket status and hours before leaving the site.',
    'SOPs',
    array['onsite','safety','sop']
  ),
  (
    'Device Repair Intake & Return Process',
    E'# Device Repair Intake & Return Process\n\nUse this SOP for laptops, desktops, printers, and other customer devices that need repair.\n\n## 1. Intake\n1. Confirm the ticket number, customer, and asset tag / serial number.\n2. Photograph the device (front, ports, damage) and upload to the ticket.\n3. Record reported symptoms and when the issue started.\n4. Set ticket status to **In Progress** (or **On Hold** if waiting on parts).\n5. Update the hardware asset status to **In Repair** in Hardware Assets.\n6. Store the device in the labeled repair bay with a printed intake slip.\n\n## 2. Diagnosis\n1. Reproduce the issue before disassembly.\n2. Run basic health checks (POST/boot, SMART disk status, battery health if applicable).\n3. Document findings in a repair note on the asset and the ticket.\n4. Decide: repair in-house, replace parts, or flag for replacement.\n\n## 3. Repair\n1. Use only approved parts from inventory; log part usage on the cost entry.\n2. After repair, retest the original symptom and a short soak test (power cycle, network, login).\n3. Re-image or restore only when required by the ticket / customer policy.\n4. Add a **Repair Note** describing work performed and parts used.\n\n## 4. Return / Close\n1. Update asset status to **Active** (or **Retired** if replaced).\n2. Confirm the assigned user and location are still correct.\n3. Schedule return / customer pickup and note the window on the ticket.\n4. Mark the ticket **Completed** after customer confirmation.\n5. If the device is aging or failing repeatedly, **Flag for Replacement**.\n\n## Escalation triggers\n- Data-loss risk or disk SMART failure\n- Liquid damage beyond board-level capability\n- Security incident suspected (stop repair; follow Security playbooks)\n- Repair cost likely above approval threshold — request manager approval first\n\nDo **not** discuss pricing or contract rates with the customer during repair handoff.',
    'Repairs',
    array['repair','intake','hardware','sop','return']
  )
) as seed(title, content, category, tags)
where not exists (select 1 from public.knowledge_base_articles limit 1);
