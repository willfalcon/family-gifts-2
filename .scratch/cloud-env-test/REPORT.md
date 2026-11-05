# Cloud environment capability test

Date: 2026-11-05. Branch: `claude/cloud-env-test` (from `main`). No application code was changed.

## Summary

| Check | Result | Cause |
| --- | --- | --- |
| `git push` | ❌ 403 | Claude GitHub App not installed / GitHub not linked for this repo |
| `npm ci` | ✅ 89 s | — |
| Backend typecheck (`tsc` in `packages/backend`) | ✅ 2 s, 81 convex files | — |
| Web typecheck (`tsc` in `apps/web`) | ❌ 4 errors | **Code error** (not environmental) |
| Mobile typecheck (`tsc` in `apps/mobile`) | ✅ 11 s | — |
| Mobile lint (`expo lint`) | ❌ | **Tooling error**: typescript-eslint does not support TS 7.0 |
| `prettier --check .` | ❌ 153 files | Formatting drift (code, not environment) |
| Tests | n/a | No test files or test scripts exist |
| `npx convex codegen` | ❌ | No `CONVEX_DEPLOYMENT`; with a dummy one, `fetch failed` (Convex hosts blocked) |
| `npx convex dev` (cloud dev deployment) | ❌ not possible | No deploy key / login, and Convex hosts blocked |
| `CONVEX_AGENT_MODE=anonymous npx convex dev --once` (local backend) | ❌ | "Failed to fetch latest backend version" (`version.convex.dev`, `api.github.com` blocked) |
| `apps/web` `vite build` | ✅ 5 s | Works with or without `VITE_*` env vars |

## Setup

- Package manager: **npm** (`package-lock.json`, npm workspaces `packages/*`, `apps/*`). Node 22.23.4, npm 10.9.9. `.npmrc` sets `legacy-peer-deps=true`.
- Workspaces: `@family-gifts/backend` (Convex, `packages/backend/convex`), `@family-gifts/web` (Vite / TanStack Start), `@family-gifts/mobile` (Expo), `@family-gifts/shared`, `@family-gifts/design-tokens`.
- Scripts present: root `dev`, `build`, `format`, `format:check`; backend `dev`/`deploy` (`convex dev`/`convex deploy`); web `dev`/`build`; mobile `start`/`lint`/etc. **No `typecheck` or `test` script anywhere**, so `tsc --noEmit -p .` was run per package by hand.

## Details

### Typecheck

- `packages/backend`: passes against the committed `_generated/` files as they are.
- `apps/web`: 4 errors. These are code errors, not environment problems. Most are a birthday type mismatch: the backend now returns `{ day, month, year? }`, but the web code still uses `string`.
  - `src/components/profile-form.tsx(71,7)` TS2322
  - `src/components/ui/glass-panel.tsx(1,30)` TS7031 (implicit any `children`)
  - `src/routes/dashboard/profile.tsx(72,13)` TS2322
  - `src/routes/dashboard/users.$id.tsx(74,35)` TS2345
- `apps/mobile`: passes.

### Lint

`expo lint` crashes: `Error: typescript-eslint does not support TS 7.0.` The repo pins `typescript@^7.0.2`, and the `@typescript-eslint` version bundled with `eslint-config-expo` refuses to run with it. This would fail locally too.

### Convex

- `packages/backend/convex/_generated/` **is committed** (api, dataModel, server and `ai/guidelines.md`). `apps/mobile/convex/_generated/` is also committed. Typecheck works with them as they are. They cannot be regenerated here, so a schema or function change can't be reflected in `_generated` from this environment.
- `npx convex codegen` (convex 1.46.0):
  - No env: `✖ No CONVEX_DEPLOYMENT set, run \`npx convex dev\` to configure a Convex project` (and the process still exits 0).
  - `CONVEX_DEPLOYMENT=dev:fake…`: `✖ TypeError: fetch failed`.
- Anonymous local backend: `✖ Failed to fetch latest backend version` → `Hit an error while running local deployment`.
- No Convex-related env vars are present in this environment.

### Env vars the code expects

From `.env.example` files and `process.env` / `import.meta.env` usage:

| Var | Where | Present here |
| --- | --- | --- |
| `CONVEX_DEPLOYMENT` | backend `.env.local` (written by `convex dev`) | no |
| `VITE_CONVEX_URL` | backend + web | no |
| `VITE_CONVEX_SITE_URL` | backend + web | no |
| `VITE_SITE_URL` | backend + web | no |
| `SITE_URL` | Convex functions (deployment env) | no |
| `RESEND_API_KEY` | Convex functions | no |
| `FROM_EMAIL_ADDRESS` | Convex functions | no |
| `ALLOW_EXPO_GO_DEV_ORIGIN` | Convex functions (dev only) | no |
| `ENABLE_MOCK_USERS` | Convex functions | no |
| `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL` | mobile | no |
| `CONVEX_DEPLOY_KEY` | needed for non-interactive `convex dev`/`deploy` | no |

Deployment-side vars (`SITE_URL`, `RESEND_API_KEY`, `FROM_EMAIL_ADDRESS`, …) live on the Convex deployment (`npx convex env set`), so they only need to be in the cloud environment if you want to set them from here.

### Network

| Host | Result |
| --- | --- |
| registry.npmjs.org | ✅ 200 |
| github.com | reachable (git push denied by auth, not network) |
| convex.dev, www/dashboard/api/provision/version.convex.dev | ❌ proxy 403 on CONNECT (policy denial) |
| *.convex.cloud | ❌ proxy 403 |
| api.github.com (used by local-backend download) | ❌ 403 |

### Web build

`npm run build` in `apps/web` (vite build, client + SSR) succeeds in ~5 s with no env vars set, and again with dummy `VITE_*` values. Vite does not typecheck, so the 4 TS errors above don't block it.

## What's needed for full development here (including running Convex functions)

1. **GitHub access**: install the Claude GitHub App on `willfalcon/family-gifts-2`, or reconnect GitHub, so pushes work.
2. **Network allowlist**: add `*.convex.dev` (at least `api.convex.dev`, `provision.convex.dev`, `version.convex.dev`), `*.convex.cloud` and `*.convex.site` under Allowed domains in the environment's network settings. Add `api.github.com` (and `objects.githubusercontent.com` / `github.com` release downloads) only if you want the local/anonymous backend instead.
3. **Env vars in the cloud environment**:
   - `CONVEX_DEPLOY_KEY`: a deploy key for a **dedicated dev deployment** (not prod). It lets `npx convex dev --once` / `codegen` run without login.
   - `CONVEX_DEPLOYMENT`: the dev deployment name (optional if the deploy key identifies it).
   - `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `VITE_SITE_URL` for the web app. Also `EXPO_PUBLIC_*` for mobile if needed.
   - A setup script that writes these into `packages/backend/.env.local` and `apps/web/.env.local`, since the tooling reads those files.
   - Set `SITE_URL`, `RESEND_API_KEY`, `FROM_EMAIL_ADDRESS` and the other function env vars on that dev deployment, not in the container.
4. **Repo fixes (unrelated to the environment)**: fix the 4 web TS errors, resolve the TS 7 / typescript-eslint incompatibility, and consider adding root `typecheck` / `lint` / `test` scripts so CI and agents have one command to run.
