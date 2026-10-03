# CBA (clothes/outfit matcher)

A React Native (Expo) app that catalogs your wardrobe, tags items via AI photo analysis, and generates outfit suggestions with a deterministic scoring engine — built with colorblind users in mind (color/pattern-clash detection, no reliance on judging color by eye). Also includes two standalone one-shot checkers (food ripeness, and a selfie-based "does this outfit match" check).

See `docs/ARCHITECTURE.md` for how the pieces fit together, and `docs/decisions/` for the ADRs explaining why specific choices were made — read both before assuming context about this codebase.

## Setup

```sh
npm install
```

This app calls Cloudflare Workers AI (a vision model) for photo tagging/analysis. Copy `.env.example` to `.env` and fill in your own Cloudflare account ID and API token:

```sh
cp .env.example .env
```

**Security note:** these are `EXPO_PUBLIC_`-prefixed, which means they get inlined into the client JS bundle at build time — anyone with the shipped app can extract them. Fine for local development; this needs a server-side proxy before a real launch (tracked, not yet built).

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
