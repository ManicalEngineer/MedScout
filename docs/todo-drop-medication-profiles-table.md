# TODO: drop the `medication_profiles` table (migration 2)

**Status:** blocked on mobile release
**Depends on:** commit `e37c98d` ("Move medication profiles on-device; slim
server-side matching") — backend deployed, mobile changes committed but not
yet built/shipped as an app release.

## Context

Medication profiles (medication name, strength, and — for caregiver
accounts — a child's name) moved to on-device-only storage. The backend no
longer reads or writes `MedicationProfile` anywhere: `AlertSettings` and
`RefillCountdown` carry their own `medication_name`/`strength` directly, and
a new user-less `tracked_medications` table feeds FDA shortage ingestion.

The `medication_profiles` table and the old `/users/me/medication-profiles*`
endpoints were intentionally **not** dropped in that same change, because a
mobile build (build #5, TestFlight) was still live calling those endpoints.
Dropping the table before every client has moved to a build with the new
on-device storage would 500 anyone still on the old build.

## What's left

1. Confirm the mobile build containing this session's changes
   (`mobile/src/storage/medicationProfiles.ts` and the updated
   `api/auth.ts` / `api/calls.ts` / `api/users.ts` / screens) has shipped —
   submitted to the App Store/Play Store and rolled out, not just committed.
2. Give it a reasonable adoption buffer (old clients still calling the
   removed medication-profile endpoints will already be getting 404s since
   the backend deploy in `e37c98d`'s companion PR removed those routes — this
   step is purely about the now-orphaned *table*, not live compatibility).
3. Write a migration that:
   - Drops the `medication_profiles` table.
   - Removes the `MedicationProfile` class and the `User.medication_profiles`
     relationship from `backend/models.py`.
4. Run the usual: `alembic upgrade head` locally, full `pytest tests/` pass,
   deploy via the same systemd-restart flow as the previous migration
   (`backend/deploy/medscout-backend.service` runs `alembic upgrade head`
   automatically on restart).

## Why this matters

`medication_profiles` still contains real user data (medication names,
strengths, and any child's name entered before this change shipped) sitting
unused server-side. Dropping it is the actual point of this whole
migration — leaving it in place indefinitely defeats the purpose of moving
profiles on-device in the first place.
