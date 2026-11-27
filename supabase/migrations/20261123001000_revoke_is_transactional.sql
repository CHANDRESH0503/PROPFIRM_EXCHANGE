-- Default deny (CLAUDE.md §2.13): the helper is internal to the notification batch function.
revoke execute on function private.is_transactional(text) from public, anon, authenticated;
