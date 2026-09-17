# Security check results

I re-scanned the whole app. Two items came back, and only one needs work.

## 1. Household name still readable by any logged-in person (needs fixing)

The old household-name record can be read by anyone with an account, not just members of that household. Today there is only one household, so nothing is actually leaking — but if other families sign up, they could read each other's household name.

Important detail found while checking: this old record is no longer used anywhere in the app. The household name now lives in the newer households list, which is already correctly limited to members. So the safest fix is simply to retire the leftover record.

Proposed fix: remove the unused leftover household-name table entirely. Nothing in the app reads it, so nothing changes for you visually.

If you'd rather keep it, the alternative is to lock its access down to members of your own household only.

## 2. Internal database helper routines (reviewed, no action)

Flagged earlier and already reviewed: these are the routines that enforce the "only your household can see your data" rules. They must stay callable for those rules to work, and each one checks who you are internally. Already marked as reviewed and expected.

## Everything else

No other issues: no exposed data, no unprotected pages, no vulnerable dependencies.

## Technical notes

- `public.household_settings` is a leftover from before the multi-household migration; `rg` shows no app reference outside generated `types.ts`, and it holds 1 row superseded by `public.households`.
- Fix: `DROP TABLE public.household_settings;` (drops its two policies with it). This is a destructive statement, so it will ask for your confirmation before running.
- Alternative if kept: replace `USING (true)` with `id = public.current_household_id()`-style membership scoping — but the table has no household link column, so retiring it is cleaner.
- `SUPA_authenticated_security_definer_function_executable` stays ignored: `current_household_id`, `is_household_admin` and `has_role` must be executable by `authenticated` for RLS evaluation; the RPCs check `auth.uid()` and admin status internally.
