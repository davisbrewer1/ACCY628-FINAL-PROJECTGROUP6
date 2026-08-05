-- Add Repairs process to Knowledge Base

insert into public.knowledge_base_articles (title, content, category, tags)
select
  'Device Repair Intake & Return Process',
  E'# Device Repair Intake & Return Process

Use this SOP for laptops, desktops, printers, and other customer devices that need repair.

## 1. Intake
1. Confirm the ticket number, customer, and asset tag / serial number.
2. Photograph the device (front, ports, damage) and upload to the ticket.
3. Record reported symptoms and when the issue started.
4. Set ticket status to **In Progress** (or **On Hold** if waiting on parts).
5. Update the hardware asset status to **In Repair** in Hardware Assets.
6. Store the device in the labeled repair bay with a printed intake slip.

## 2. Diagnosis
1. Reproduce the issue before disassembly.
2. Run basic health checks (POST/boot, SMART disk status, battery health if applicable).
3. Document findings in a repair note on the asset and the ticket.
4. Decide: repair in-house, replace parts, or flag for replacement.

## 3. Repair
1. Use only approved parts from inventory; log part usage on the cost entry.
2. After repair, retest the original symptom and a short soak test (power cycle, network, login).
3. Re-image or restore only when required by the ticket / customer policy.
4. Add a **Repair Note** describing work performed and parts used.

## 4. Return / Close
1. Update asset status to **Active** (or **Retired** if replaced).
2. Confirm the assigned user and location are still correct.
3. Schedule return / customer pickup and note the window on the ticket.
4. Mark the ticket **Completed** after customer confirmation.
5. If the device is aging or failing repeatedly, **Flag for Replacement**.

## Escalation triggers
- Data-loss risk or disk SMART failure
- Liquid damage beyond board-level capability
- Security incident suspected (stop repair; follow Security playbooks)
- Repair cost likely above approval threshold — request manager approval first

Do **not** discuss pricing or contract rates with the customer during repair handoff.',
  'Repairs',
  array['repair','intake','hardware','sop','return']
where not exists (
  select 1
  from public.knowledge_base_articles
  where title = 'Device Repair Intake & Return Process'
);
