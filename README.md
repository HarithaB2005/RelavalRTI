# Nexus RTI (RelavalRTI)

Frontend app for RTI guidance with Nexus API integration.

## Requirements
- Node.js 18+

## Setup
1. Install dependencies:
   npm install
2. Create env file:
   copy .env.example .env
3. Update values in `.env`:
   - `VITE_NEXUS_API`
   - `VITE_NEXUS_KEY`

## Run
- Development: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`
- Proof script: `npm run prove`

## Security
- Never commit real API keys.
- Rotate any key that was previously committed.
- Use `.env` for local secrets only.
