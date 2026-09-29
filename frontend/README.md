# SatAsk frontend

The Next.js workspace for SatAsk. Pick a site, type a question and the answer
comes back with its evidence drawn over the satellite image, a confidence score
and the plan the controller ran.

## Features

- **Site picker** listing every scene the controller has loaded
- **Image viewer** with before, after, split and slider modes for comparing dates
- **Evidence overlays** drawn as SVG polygons in each chip's own pixel space
- **Results panel** showing the answer, confidence, plan steps and execution trace

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Motion and
lucide-react.

| path | what |
|---|---|
| `app/page.tsx` | the workspace: state, query lifecycle, layout |
| `app/types.ts` | TypeScript mirror of the controller's response contract |
| `components/` | `Sidebar`, `Header`, `ImageViewer`, `QueryInput`, `ResultsPanel` |
| `lib/api.ts` | calls to the backend, site labels, date formatting |

## Configuration

Copy `.env.example` to `.env.local` if the backend is not on the default address.

| variable | default |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:3001` |

## Running

The frontend talks to the [backend](../backend/), which talks to the
[controller](../controller/), so start those first.

```bash
cd frontend
pnpm install      # or npm install
pnpm dev          # http://localhost:3000
```

Other scripts: `pnpm build`, `pnpm start` and `pnpm lint`.
