# Send reset emails from huri.team + unrestricted passwords

## 1. Sender domain: huri.team

Right now Huri has no sender address of its own, so reset-password emails go out through a shared default sender that gets filtered and is capped at a couple per hour — that's why nobody received one.

Setup steps:

1. You complete the email domain setup (button below the plan) for **huri.team**. It shows a couple of DNS records to add where you manage huri.team; adding them lets the mail system prove it may send as huri.team.
2. Once that's in place, I set up the branded auth emails (password reset, sign-up, etc.) to send from **support@huri.team** — the right choice for automated account emails; aron@huri.team stays your personal address.
3. Reset emails will then arrive reliably from support@huri.team with Huri branding.

## 2. Passwords completely unrestricted

Turn the known-breach password blocking back off, so any password of any length is accepted again at sign-up and reset — exactly as before.

## Technical notes

- Email domain setup happens through the Lovable email setup dialog (DNS records shown there; huri.team DNS is managed where the domain was bought — if bought through Lovable: Project Settings → Domains → ⋯ → Configure → Manage DNS records).
- After setup: `email_domain--setup_email_infra`, then `email_domain--scaffold_auth_email_templates` with sender support@huri.team, styled to Huri's look.
- `supabase--configure_auth` with `password_hibp_enabled: false` (keep signup enabled, no auto-confirm).
- No app code changes needed — the forgot-password flow and reset page already exist.
