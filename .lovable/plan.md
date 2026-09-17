# Fix: sign-up blocked by "Password is known to be weak..."

## What's happening

The app has leaked-password protection turned on. At sign-up, the chosen
password is checked against the Have I Been Pwned breach database; common or
previously-leaked passwords are rejected with "Password is known to be
weak...". The new user hit this because their password is too common.

## Options

**Option A — Ask the user to pick a stronger password (recommended, no code change)**
Have them choose a longer, less common password (e.g. a short phrase with
mixed words and numbers). Protection stays on for everyone.

**Option B — Turn off leaked-password protection**
- Call `configure_auth` with `password_hibp_enabled: false` (leaving
  `disable_signup`, `external_anonymous_users_enabled`, and
  `auto_confirm_email` at their current values: signups enabled, anonymous
  users off, email confirmation on).
- The new user can then sign up with any password meeting the 6-character
  minimum.

## Technical details

- Single tool call: `supabase--configure_auth` (idempotent auth settings
  update). No code or migration changes.
- Verify by confirming the setting took effect; the user retries sign-up.

## Recommendation

Try Option A first (stronger password) — it's the safer default. If the user
still can't get in or you'd rather not block anyone, proceed with Option B.
