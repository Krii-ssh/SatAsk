# SatAsk backend

A thin Express gateway between the frontend and the Python agent controller. It
does no routing of its own: it validates that a query is present, forwards it to
the controller and passes the answer back. The planning, tool calls and geometry
checks all happen in [`controller/`](../controller/).

## Endpoints

| method | path | what it does |
|---|---|---|
| `POST` | `/query` | forwards `{query, image_ids}` to the controller's `POST /query` |
| `GET` | `/query/images` | lists the scenes the controller has loaded, with absolute preview URLs |
| `GET` | `/health` | liveness check |
| `POST` | `/vqa`, `/grounding`, `/change-detection` | legacy in-process mocks from the v1 contract, kept for standalone demos |

The request and response shapes are specified in
[`docs/json-contracts-v2.md`](../docs/json-contracts-v2.md).

**Request**

```json
{
  "query_id": "q_004",
  "query": "Find buildings constructed after 2023",
  "image_ids": ["navi_mumbai_2023_opt", "navi_mumbai_2026_opt"]
}
```

**Errors** come back as `{"status": "error", "error": {"code", "message"}}` with
one of these codes:

| code | status | meaning |
|---|---|---|
| `INVALID_QUERY` | 400 | `query` missing or empty |
| `CONTROLLER_ERROR` | from controller | the controller rejected the request |
| `CONTROLLER_UNREACHABLE` | 502 | nothing listening at `CONTROLLER_URL` |

## Configuration

Copy `.env.example` to `.env` and adjust if needed.

| variable | default | effect |
|---|---|---|
| `PORT` | `3001` | port the gateway listens on |
| `CONTROLLER_URL` | `http://127.0.0.1:8080` | where `controller/server.py` is running |

## Running

Requires Node.js 18 or later (for the built-in `fetch`).

```bash
cd backend
pnpm install      # or npm install
pnpm dev          # http://localhost:3001, reloads on change
```
