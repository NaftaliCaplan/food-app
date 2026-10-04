# cba-ai-proxy

A thin Cloudflare Worker that sits between the app and Cloudflare Workers AI. The app no longer calls Workers AI directly (which required shipping a real Cloudflare account ID + API token inside the client bundle — see `docs/decisions/` and the root `README.md`'s security note). Instead, the app calls this Worker; the Worker calls Workers AI using Cloudflare's native `AI` binding, which needs no separate credential at all — it's implicitly authenticated as this Worker's own Cloudflare account.

The only thing the client holds now is a single shared secret, scoped to "can call this one endpoint, subject to a rate limit" — a much smaller exposure than a real account-level API token.

## One-time setup

```sh
cd server
npm install
npx wrangler login          # opens a browser to authenticate with your Cloudflare account
npx wrangler kv namespace create RATE_LIMIT
```

The last command prints an `id`. Paste it into `wrangler.toml`'s `[[kv_namespaces]]` block, replacing `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.

Set the shared secret (pick any long random string — this is what the app will also need, see below):

```sh
npx wrangler secret put APP_SHARED_SECRET
```

## Local development

```sh
cp .dev.vars.example .dev.vars
# edit .dev.vars and fill in the same APP_SHARED_SECRET value
npm run dev
```

This runs the Worker locally (via `wrangler dev`) with access to the real `AI` binding, so you can test against it before deploying.

## Deploy

```sh
npm run deploy
```

This prints the Worker's live URL (`https://cba-ai-proxy.<your-subdomain>.workers.dev` by default). Put that URL, plus the same shared secret you set above, into the app's `.env` (see the root `.env.example`):

```
EXPO_PUBLIC_PROXY_URL=https://cba-ai-proxy.<your-subdomain>.workers.dev
EXPO_PUBLIC_APP_SHARED_SECRET=<the same value you set with wrangler secret put>
```

## Notes

- `EXPO_PUBLIC_CF_ACCOUNT_ID` / `EXPO_PUBLIC_CF_API_TOKEN` are no longer read anywhere in the app — safe to delete from your local `.env` once this is wired up.
- The shared secret is still `EXPO_PUBLIC_`-prefixed on the app side, so it still ships inside the client bundle — it is **not** a secret in the cryptographic sense once shipped, a determined person can still extract it and call this Worker directly. What it actually buys you: your real Cloudflare account credential never leaves this Worker, and the rate limit below caps the cost/abuse blast radius regardless of who's calling.
- The rate limit (`src/index.ts`) is a per-IP fixed-window cap via Workers KV — a cost backstop, not a precise security boundary (KV reads/writes aren't atomic, so concurrent bursts from one IP can overshoot slightly). Tune `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_SECONDS` in `src/index.ts` if needed.
- `npm run typecheck` runs `tsc --noEmit` against this folder specifically — it's excluded from the main app's `tsc`/`jest`/`lint` since it's a separate deployable with Worker-specific globals, not React Native code.
