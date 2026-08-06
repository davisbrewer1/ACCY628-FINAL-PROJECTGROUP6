insert into public.knowledge_base_articles (title, content, category, tags)
values
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
