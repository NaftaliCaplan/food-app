# CBA (clothes/outfit matcher)

A React Native (Expo) app that catalogs your wardrobe, tags items via AI photo analysis, and generates outfit suggestions with a deterministic scoring engine — built with colorblind users in mind (color/pattern-clash detection, no reliance on judging color by eye). Also includes two standalone one-shot checkers (food ripeness, and a selfie-based "does this outfit match" check).

See `docs/ARCHITECTURE.md` for how the pieces fit together, and `docs/decisions/` for the ADRs explaining why specific choices were made — read both before assuming context about this codebase.

## Setup

```sh
npm install
```

This app calls an AI vision model for photo tagging/analysis, via a small proxy Worker rather than directly — see `server/README.md` to set that up first (one-time Cloudflare account steps). Once it's deployed, copy `.env.example` to `.env` and fill in the Worker's URL and shared secret:

```sh
cp .env.example .env
```

**Security note:** `EXPO_PUBLIC_APP_SHARED_SECRET` is still `EXPO_PUBLIC_`-prefixed, so it still ships inside the client JS bundle — a determined person can extract it. What the proxy actually buys you: that secret only grants "can call this one rate-limited endpoint," not a real Cloudflare account credential, which now lives only inside the Worker itself. See `server/README.md` for the full reasoning and the rate-limit details.

## Running

```sh
npm start        # Expo dev server — scan the QR with Expo Go
npm run android
npm run ios
npm run web
```

## Scripts

```sh
npm test         # Jest
npm run test:watch
npm run lint      # ESLint (eslint-config-expo)
```
