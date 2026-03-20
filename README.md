# RelavalRTI

RelavalRTI is a React + Vite frontend that provides an RTI guidance chat experience backed by a Nexus API endpoint.

## Features
- Conversational RTI assistant UX built with React.
- Structured response parsing using a `<NEXUS_JSON>` block contract.
- Source-grounded legal/procedure context support.
- Local proof script (`npm run prove`) to compare profile behavior.

## Tech Stack
- React 18
- Vite 5
- Node.js 18+

## Getting Started
1. Install dependencies:

```bash
npm install
```

2. Create your local environment file:

```bash
copy .env.example .env
```

3. Update `.env` values:
- `VITE_NEXUS_API` - Nexus backend endpoint (example: `http://localhost:8000/api/v1/generate-prompt`)
- `VITE_NEXUS_KEY` - API key used by the frontend for development
- `NEXUS_API` - Used by the proof script
- `NEXUS_KEY` - Used by the proof script

## Run Locally
```bash
npm run dev
```

Default Vite port is configured in `vite.config.js`.

## Build
```bash
npm run build
```

## Preview Production Build
```bash
npm run preview
```

## Proof Script
Run profile comparison checks:

```bash
npm run prove
```

## Security Notes
- Do not commit real API keys or secrets.
- Rotate any key that was previously exposed.
- Keep `.env` local only.
- Prefer using restricted/short-lived keys for frontend testing.

## Repository Hygiene
- `node_modules/` and `dist/` are ignored.
- `.env` files are ignored.
- Keep `rti-sources.json` factual and timestamped when updating legal references.

## License
This project is licensed under the MIT License. See `LICENSE`.
