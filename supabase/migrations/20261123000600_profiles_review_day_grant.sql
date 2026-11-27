-- Members read their own review day (the profiles policy limits rows to their own). It is
-- written only through set_journal_review_day.
grant select (journal_review_day) on public.profiles to authenticated;
