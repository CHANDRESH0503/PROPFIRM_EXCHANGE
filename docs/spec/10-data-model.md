# 10. Data model

Part of the project brief. The rules in `/CLAUDE.md` §2 override anything here.

**Implementation status, 22 November 2026.** Staging includes the versioned economy configuration, wallet and ledger, catalogue, claims, commissions, rewards, encrypted voucher inventory, check-ins, missions, notifications and in-app preferences. The implementation matrix in [PROGRESS.md](../PROGRESS.md) tracks remaining tables by feature.


A starting point. Refine names and columns as you design, and keep to `/CLAUDE.md` §2 (rules) and §4 (conventions).

- **Identity:** `profiles` (id = auth user, display_name, country_code, timezone, age_confirmed_at, referral_code, referred_by, risk_score, telegram_chat_id), `admin_roles`, `device_signals` (hashed), `waitlist_signups`.
- **Catalogue:** `firms` (slug, name, asset_classes, status, is_sample, our_code, tracking_url_template, commission_bps, rebate_permission, rebate_evidence_url), `firm_programs` (account_size, steps, list_price_cents, currency, profit_target_bps, daily_loss_bps, max_loss_bps, drawdown_type, profit_split_bps, payout_frequency, rules jsonb), `offers` (discount_bps, code, starts_at, ends_at, exclusive), `price_history`, `firm_changes`, `sponsorships`.
- **Tracking and earning:** `clicks` (click_id, user_id, firm_id, program_id, source, creator_id, country_code), `purchase_claims` (order_ref, amount_paid_cents, checkout_email, receipt_path, status, confidence, reviewed_by), `commission_import_batches`, `commissions` (external_ref, order_ref, amount_cents, status, claim_id).
- **Economy:** `economy_config` (versioned), `ledger_entries` (user_id, amount, bucket, type, ref_type, ref_id, idempotency_key unique, config_version, created_by), view `wallet_balances`, `xp_events` (amount, source, ref, idempotency_key unique), `levels`, `boosters`, `user_boosters`, `campaign_budgets`.
- **Rewards:** `rewards`, `voucher_inventory` (encrypted code, status, assigned_to, expires_at), `redemptions` (cost_coins, status, voucher_id, target_at, fulfilled_by).
- **Engagement:** `checkins`, `streaks`, `missions`, `mission_progress`, `badges`, `user_badges`, `seasons`, `season_scores`, `referrals`, `polls`, `poll_votes`, `spin_results`, `draws`, `draw_entries`.
- **Tracker and community:** `tracked_accounts`, `account_snapshots`, `account_milestones` (type, proof_path, amount_cents, requested_at, paid_at, status, public_consent), `reviews`, `review_replies`, `change_reports`, `watchlist_items`, `lessons`, `lesson_completions`.
- **Platform:** `notifications`, `notification_prefs`, `geo_rules` (country_code, asset_class, action), `feature_flags`, `audit_log`, `content_pages`, `content_page_versions`, `site_settings` (brand, contact, maintenance; one row per key), `themes` (name, tokens jsonb, fonts, radius, is_active, scheduled_from, scheduled_to), `homepage_sections` (key, order, visible, content jsonb), `nav_items`, `faqs`, `banners` (placement, images, text, link, audience jsonb, priority, status, starts_at, ends_at, is_sponsored), `announcement_bars`, `ticker_items`, `banner_events` (views and clicks), `news_posts` (severity, firm_id, body, pushed_at), `site_promo_codes`, `site_promo_redemptions`, `user_moderation_actions` (freeze, suspend, ban, unban, reason, by), `blocklist`, `broadcasts`, `message_templates`, `seo_overrides`, `redirects`.

Shop items are `rewards` (extend with stock, per-user limit, level_required, countries, featured, sort_order). Merchandise orders use `redemptions` plus a `shipping` jsonb.

**Storage buckets:** `receipts` and `proofs` are private and read through short-lived signed URLs; `public-assets` is public.

**Scheduled jobs:** release pending Coins; expire Coins and send warnings; streak-at-risk reminders; daily mission rotation; season rollover; deal alerts; weekly recap; liability and redemption-target alerts.

