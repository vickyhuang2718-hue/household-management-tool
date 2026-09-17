# Fix: sign-up blocked by "Password is known to be weak..."

## What's happening

The app has leaked-password protection turned on. At sign-up, the chosen
password is checked against the Have I Been Pwned breach database; common or
previously-leaked passwords are rejected with "Password is known to be
weak...". The new user hit this because their password is too common.

## Changes

### 1. Add password guidance on the sign-up form (`src/routes/auth.tsx`)

Small hint text under the password field, shown in sign-up mode, in
Simplified Chinese to match the app:

> 密码提示：至少 6 个字符。请避免常见密码（如 123456、password、生日或手机号）——这些密码已被泄露，会被系统拒绝。建议用一句只有你知道的短句，混合大小写字母和数字，例如「WoJia2SuiBao2026!」。

English meaning: at least 6 characters; avoid common passwords (123456,
password, birthdays, phone numbers) — they're already leaked and will be
rejected; use a short phrase only you know, mixing uppercase/lowercase
letters and numbers.

### 2. Keep leaked-password protection ON (recommended)

It stays enabled so weak passwords keep being rejected. The hint text should
prevent repeat failures.

**Alternative (only if you'd rather not block anyone):** turn the protection
off via `configure_auth` with `password_hibp_enabled: false`. Say the word
and I'll switch to this instead — but the hint + stronger password is the
safer default.

## Technical details

- UI: one `<p className="text-xs text-muted-foreground">` under the password
  `Input` in `src/routes/auth.tsx`, rendered when `mode === "signup"`.
- Optional settings change uses `supabase--configure_auth`; no code or
  migration changes for the recommended path.
