# RelavalRTI

A production-oriented React + Vite frontend for RTI guidance flows, powered by a Nexus API backend.

This repository is designed to be public-safe:
- no committed runtime secrets
- explicit environment setup
- basic security and repository hygiene in place

## Highlights
- Chat-first RTI assistance UX
- Structured model contract using `<NEXUS_JSON>` blocks
- Verified legal/procedure source injection support
- Scripted profile proofing via `npm run prove`

## Stack
- React 18
- Vite 5
- Node.js 18+

## Quick Start

### 1) Install
```bash
npm install
```

### 2) Create local env
```bash
copy .env.example .env
```

### 3) Configure variables
Update `.env` values before running.

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `VITE_NEXUS_API` | Yes | Frontend API endpoint | `http://localhost:8000/api/v1/generate-prompt` |
| `VITE_NEXUS_KEY` | Yes | Frontend bearer key for Nexus calls | `relevo_sk_xxx` |
| `NEXUS_API` | For proof script | Endpoint used by `npm run prove` | `http://localhost:8000/api/v1/generate-prompt` |
| `NEXUS_KEY` | For proof script | Key used by `npm run prove` | `relevo_sk_xxx` |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Build production assets |
| `npm run preview` | Preview production build locally |
| `npm run prove` | Run profile/proof comparison script |

## Project Structure

```text
.
|- index.html
|- main.jsx
|- relavalrti.jsx
|- rti-sources.json
|- prove-nexus-difference.mjs
|- package.json
|- vite.config.js
|- .env.example
|- .gitignore
|- SECURITY.md
|- LICENSE
```

## Security
- Never commit real keys, tokens, or credentials.
- Rotate any key that may have been exposed.
- Keep `.env` local only.
- Use scoped and short-lived credentials where possible.

See `SECURITY.md` for vulnerability reporting guidance.

## Contribution
1. Create a feature branch.
2. Keep changes focused and documented.
3. Validate with `npm run build` before opening a PR.

## License
MIT License. See `LICENSE`.
