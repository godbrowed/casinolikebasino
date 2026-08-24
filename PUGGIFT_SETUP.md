# PugGift bot setup

1. Create the new bot through `@BotFather` and copy its token.
2. Locally, copy `.env.example` to `.env.local`. On Vercel, add the same keys under **Project → Settings → Environment Variables**. Never commit real tokens.
3. Put the new bot credentials in `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`.
4. Set the deployed HTTPS address in both `TELEGRAM_WEBAPP_URL` and `NEXT_PUBLIC_APP_URL`.
5. Generate unique long random values for `TELEGRAM_WEBHOOK_SECRET`, `SESSION_SECRET`, `ADMIN_SECRET`, and `CRON_SECRET`.
6. If this is a completely fresh economy, create a new Neon/Postgres database and put its connection string in `DATABASE_URL`. Reusing the old database also reuses existing users, balances, inventory, rooms, and history.
7. Update `url` and `iconUrl` in `public/tonconnect-manifest.json` if the production domain changes.
8. Deploy, then open `https://YOUR_DOMAIN/api/telegram/setup?secret=YOUR_ADMIN_SECRET` once. This registers the webhook, `/start`, and Telegram menu button for the new bot.

The PugGift `/start` image is `public/images/puggift-mascot-share-v1.png`. Optimized in-app mascot and Crash assets are `public/images/puggift-mascot-web-v1.webp` and `public/images/puggift-rocket-web-v1.webp`.
