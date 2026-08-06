insert into public.knowledge_base_articles (title, content, category, tags)
values
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
);
