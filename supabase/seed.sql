-- Development and staging seed. Never run on production (scripts/db.mjs refuses).
-- Phase 0 needs no seed rows: flags, geo rules and settings ship in migrations because
-- production needs them too. Catalogue samples (fictional firms, is_sample = true) arrive in Phase 1.2.
select 1;
