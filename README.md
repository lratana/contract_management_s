# Procurement System — GitHub + Netlify + Apps Script Temporary Architecture

## Structure

```text
procurement-system/
├── apps-script/
│   ├── appsscript.json
│   ├── Code.gs
│   ├── Index.html
│   ├── Styles.html
│   └── App.html
│
└── web/
    ├── src/
    │   ├── App.tsx
    │   ├── api.ts
    │   ├── main.tsx
    │   └── styles.css
    ├── public/
    │   └── _redirects
    ├── netlify/
    │   └── functions/
    │       └── api.mjs
    ├── index.html
    ├── netlify.toml
    └── package.json
```

## Temporary data flow

```text
React
  ↓
Netlify /api
  ↓
Netlify Function
  ↓
Apps Script doPost()
  ↓
Google Sheets
  ↓
Google Drive
```

The existing Apps Script `doGet()` continues to serve the original Apps Script Web App.
The new `doPost()` bridge is appended to the same `Code.gs` file.

## Apps Script setup

1. Open the Apps Script project.
2. Replace the existing five files with the files under `apps-script/`.
3. Create a Script Property:

```text
NETLIFY_API_SECRET = <same value used in Netlify>
```

4. Run `setupSystem()` once and approve permissions.
5. Deploy as Web App.
6. Copy the `/exec` URL.

## Netlify setup

Connect the `web/` project to Netlify. If the GitHub repository root is the parent `procurement-system/`, configure the Netlify base directory as:

```text
web
```

Build:

```text
npm run build
```

Publish:

```text
dist
```

Functions directory:

```text
netlify/functions
```

Environment variables:

```text
GAS_WEB_APP_URL=https://script.google.com/macros/s/XXXXXXXX/exec
APPS_SCRIPT_API_SECRET=<same secret>
```

Do not prefix the secret with `VITE_`, because client-side Vite variables are exposed to the browser bundle.

## Local web development

```bash
cd web
npm install
npm run dev
```

For a real Netlify Function locally:

```bash
netlify dev
```

The temporary bridge expects the Apps Script Web App to be reachable.

## Important authentication note

This package uses an API secret for the temporary Netlify → Apps Script bridge.

The legacy Apps Script backend still determines the current Google user from Apps Script session context. Therefore, this bridge is suitable as a temporary/single-admin architecture, but it is not yet the final multi-user identity layer for a public Netlify application.

For the final production architecture, move authentication and RBAC into Node.js/Hono + Cloudflare and use D1 as the source of truth.

## Current modules

The Apps Script source contains:

- Projects
- Procurement Plan
- Budget Request
- Bidding Process
- Suppliers
- Bids
- Evaluations
- Contracts
- Payments
- Variations
- Deliveries
- Handover
- Warranty
- Warranty Defects
- Documents

The frontend reads the module metadata from the Apps Script bootstrap response and renders a reusable list/form UI.

## Loading UX

- Full-screen blue loading on startup
- Shimmer table loading
- Search debounce
- Create loading
- Update loading
- Modal busy overlay
- Pagination
- Refresh current module only

## GitHub workflow

```bash
git init
git add .
git commit -m "Initial procurement system"
git branch -M main
git remote add origin <YOUR_GITHUB_REPOSITORY>
git push -u origin main
```

Then connect the GitHub repository to Netlify.

## Important production boundary

Do not commit:

- API secrets
- Google OAuth credentials
- production private keys
- database credentials

The `appsscript.json` remains an Apps Script manifest and is not a Netlify manifest.


## IMPORTANT — Fixing `Uncaught ReferenceError: React is not defined`

The React app now uses:
- explicit `import React from "react"` runtime access
- `@vitejs/plugin-react` with `jsxRuntime: "classic"`
- TypeScript `jsx: "react"`

After updating GitHub, trigger a fresh Netlify deploy. If the previous deployment is still serving
`index-DZ-X3IpM.js`, that is the old cached/build asset.

Recommended:
1. Push the new commit to GitHub.
2. Netlify → Deploys → Trigger deploy → Clear cache and deploy site.
3. Hard-refresh the browser.

Netlify Base directory:
`web`

Build command:
`npm run build`

Publish directory:
`dist`


## React runtime fix / stale Netlify bundle

The frontend now uses Vite's automatic React JSX runtime and does not depend on a global `React` variable.

After pulling this commit:

```bash
cd web
rm -rf node_modules dist
npm install
npm run build
```

Push the changes and trigger a fresh Netlify deploy. In Netlify use:

- Base directory: `web`
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

The generated JS filename/hash should change. If the browser still reports an older file such as `index-DZ-X3IpM.js`, hard-refresh the site and confirm the Netlify deploy is using the latest Git commit.

## If Netlify still shows `React is not defined`

The filename in the browser error (for example `index-DZ-X3IpM.js`) is a generated build asset. If the same old filename keeps appearing after a fix, the site is still serving the previous deployment.

1. Push the latest commit to GitHub.
2. In Netlify, trigger **Deploy site → Clear cache and deploy site**.
3. Verify the latest deploy commit is the one containing:
   - `web/src/App.tsx`
   - `web/vite.config.ts`
   - `web/tsconfig.json`
   - root `netlify.toml`
4. Hard refresh the browser.

The final React setup explicitly imports `React` and also uses Vite's automatic JSX runtime.
