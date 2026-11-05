-- =============================================================================
--  !!  DANGER: DESTRUCTIVE. RUN THIS ONLY ON A DISPOSABLE LOAD-TEST COPY.  !!
--
--  This permanently overwrites emails, password hashes, push tokens, Apple/Google
--  identifiers and free-text notes IN THE DATABASE YOU RUN IT AGAINST.
--  Run against production it would destroy every account.
--
--  Intended use: restore a copy of a production dump into a NEW local database whose
--  name contains "loadtest", scrub it, and load-test against that copy. Never restore
--  into, or point this at, the production server.
--
--      createdb medscout_loadtest
--      pg_restore -d medscout_loadtest prod_dump.dump        # on a machine that is not production
--      psql -d medscout_loadtest -v scrub_confirm=yes \
--           -v pw_hash="$(python -c "import bcrypt;print(bcrypt.hashpw(b'LoadTest-pw-123', bcrypt.gensalt()).decode())")" \
--           -f loadtest/scrub.sql
--
--  Safeguards (all must pass or nothing changes; the script is one transaction):
--    * psql variable scrub_confirm=yes must be passed
--    * the database name must contain "loadtest"
--    * after scrubbing, no row may still carry a non-synthetic email
--
--  Not part of the backend deploy. Not run by anything automatically. Review before use.
--
--  What remains after scrubbing, so you can judge the risk: user ids, medication names and
--  strengths with their statuses and timestamps (health information, no longer tied to an
--  email or name), pharmacy names/coordinates rounded to ~1 km, and the public community
--  reports. Treat the scrubbed copy as sensitive anyway: keep it on one machine and delete it
--  afterwards.
-- =============================================================================

\set ON_ERROR_STOP on

\if :{?scrub_confirm}
\else
  \set scrub_confirm no
\endif
SELECT (:'scrub_confirm' = 'yes') AS confirmed \gset
\if :confirmed
\else
  \echo 'REFUSING TO RUN: pass -v scrub_confirm=yes to confirm this is a disposable load-test database.'
  \quit
\endif

\if :{?pw_hash}
\else
  \echo 'note: no -v pw_hash=... given; password hashes will be set to NULL (scrubbed users cannot log in).'
  \set pw_hash ''
\endif

BEGIN;

-- Guard 1: only a database with "loadtest" in its name.
DO $$
BEGIN
  IF current_database() NOT LIKE '%loadtest%' THEN
    RAISE EXCEPTION 'scrub.sql refuses to run on database "%": its name must contain "loadtest"', current_database();
  END IF;
END
$$;

-- users: every identifier and credential.
UPDATE users SET
  email               = 'lt-user-' || id || '@loadtest.example.com',
  hashed_password     = NULLIF(:'pw_hash', ''),          -- one known password for all, or NULL
  apple_sub           = NULL,
  google_sub          = NULL,
  apple_refresh_token = NULL,
  push_token          = NULL;

-- pharmacies: free-text contact details; coordinates kept but rounded (~1 km).
UPDATE pharmacies SET
  name      = 'Pharmacy ' || id,
  phone     = '555-0100',
  address   = NULL,
  latitude  = ROUND(latitude::numeric, 2),
  longitude = ROUND(longitude::numeric, 2);

-- call logs: free-text notes can contain anything the user typed.
UPDATE call_logs SET notes = NULL;

-- Optional, stricter: also blur which medication each account takes. Uncomment to apply.
-- UPDATE call_logs SET medication_name = 'Medication ' || (id % 20), strength = '10mg';
-- UPDATE refill_countdowns SET medication_name = 'Medication ' || (id % 20);
-- UPDATE medication_alert_subscriptions SET medication_name = 'Medication ' || (id % 20), strength = '10mg';

-- Guard 2: nothing identifying may remain.
DO $$
DECLARE bad bigint;
BEGIN
  SELECT count(*) INTO bad FROM users
   WHERE email NOT LIKE '%@loadtest.example.com'
      OR apple_sub IS NOT NULL OR google_sub IS NOT NULL
      OR apple_refresh_token IS NOT NULL OR push_token IS NOT NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION 'scrub incomplete: % users still carry identifying data; rolling back', bad;
  END IF;
  SELECT count(*) INTO bad FROM call_logs WHERE notes IS NOT NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION 'scrub incomplete: % call logs still carry notes; rolling back', bad;
  END IF;
END
$$;

COMMIT;

\echo 'scrub complete. Now: VACUUM FULL; ANALYZE;  (dead rows still hold the old values until then)'
