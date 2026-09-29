# SatAsk

**Ask a satellite image a question in plain English.**

SatAsk is an interactive vision-language assistant for remote-sensing imagery. You type a question such as *"Find buildings constructed after 2023"* and an agentic controller works out which specialist models to run, chains them together and returns an answer with the evidence drawn on the image, a confidence score and an auditable trace of which model produced what.

It was built for Smart India Hackathon 2026, problem statement 26167 ("SatQuery AI", Space Technology).

## Why

Remote sensing already has excellent specialist models. One answers questions about an image, another finds named objects in it and another compares two dates to report what changed. Using them, though, means knowing which model applies, how to feed it and how to read what it returns. A question that today needs a GIS analyst, a workflow and several separate tools should be answerable in a single sentence.

SatAsk puts a controller in front of the models. The user asks, the controller plans and the models do the work.

## How it works

```
 Browser                Gateway               Intelligence                Inference
 Next.js  :3000  ---->  Express  :3001  ---->  Python controller :8080 ---> model services
 query, viewer,         validates and          planner (LLM)                vqa            :8001
 overlays, trace        forwards the query     plan validator               ground         :8002
                                               executor                     change_detect  :8003
                                               geometry checks              cross_modal    :8004
```

1. The **frontend** sends the question and the scenes on screen to the gateway.
2. The **backend** checks the query is not empty and forwards it to the controller.
3. The **planner** asks a language model for a JSON plan, picking tools from a registry and wiring their inputs and outputs together.
4. The **validator** rejects any plan that uses unknown tools, invents image ids, compares two different places, runs a change comparison backwards in time or contains a literal coordinate or count. A rejected plan is retried once with the error attached, then handed to a fallback provider, then to offline keyword routing.
5. The **executor** runs each step over HTTP, passes results between steps with `$step.field` references and checks every geometry that comes back.
6. The **server** projects each result polygon into the pixel space of its image so the browser can draw it without knowing anything about map projections.

The headline query shows why this matters. *"Find buildings constructed after 2023"* cannot be answered by any single model. The planner produces a chain instead:

```json
{
  "steps": [
    {"id": "s1", "tool": "change_detect", "args": {"image_id_t1": "navi_mumbai_2023_opt", "image_id_t2": "navi_mumbai_2026_opt"}},
    {"id": "s2", "tool": "ground", "args": {"image_id": "navi_mumbai_2026_opt", "phrase": "buildings"}},
    {"id": "s3", "tool": "filter_by_region", "args": {"objects": "$s2.objects", "regions": "$s1.regions"}}
  ],
  "answer_from": "s3"
}
```

### Design principles

- **The language model never produces a number.** It only chooses tools and connects them. Every count, area and polygon comes from a model's output or from a geodesic calculation on it. The validator structurally rejects plans that contain literal geometry or counts.
- **Everything is GeoJSON in EPSG:4326.** Grounding and change detection work on different pixel grids, so pixel boxes from one cannot be compared with regions from the other. Longitude and latitude line up, which is what makes chains like the one above possible.
- **Confidence is the minimum, never the mean.** One weak step pulls the reported confidence down. Below 0.5 the answer says it is unsure.
- **Failures degrade rather than break.** A dead model in step three still returns steps one and two with `status: "partial"` and a readable explanation. The frontend never receives a stack trace.
- **Mocks by default.** Every tool can run against fixtures, so the whole stack works with no GPU and no network. Real services can be swapped in one at a time.

## Capabilities

| Capability | Tool | Backed by | Status |
|---|---|---|---|
| Visual question answering and captioning | `vqa` | [GeoChat-7B](https://github.com/mbzuai-oryx/GeoChat) | Working on GPU; Gemini vision backend for machines without one |
| Phrase grounding | `ground` | GeoChat-7B | Working through the Gemini backend; GeoChat path awaiting its first GPU run |
| Bi-temporal change detection | `change_detect` | [BIT_CD](https://github.com/justchenhao/BIT_CD) pretrained on LEVIR-CD | Working and GPU verified |
| Optical and SAR fusion | `cross_modal` | | Contract, routing rule and validator complete; served by the mock service |
| Spatial filtering and counting | `filter_by_region`, `count` | Local geometry (Shapely, pyproj) | Working |

## Repository layout

| Path | What it is |
|---|---|
| [`frontend/`](frontend/) | Next.js 15 and React 19 workspace: site picker, image viewer with split and slider compare, SVG overlays and results panel |
| [`backend/`](backend/) | Express gateway that proxies queries and scene listings to the controller |
| [`controller/`](controller/) | The agent layer: planner, plan validator, executor, tool registry, geometry checks, HTTP server, mock service and demo imagery |
| [`AI/geochat/`](AI/geochat/) | Combined VQA and grounding service with three interchangeable backends: `stub`, `gemini` and `geochat` |
| [`AI/vqa/`](AI/vqa/) | Standalone GeoChat-7B VQA service, including a patch that ports GeoChat to transformers 5 |
| [`AI/change_detection/`](AI/change_detection/) | BIT_CD change detection service with tiling, mask analysis and templated descriptions |
| [`docs/json-contracts-v2.md`](docs/json-contracts-v2.md) | The interface contract between every layer |

## Getting started

### Prerequisites

- Python 3.11
- Node.js 18 or later
- [pnpm](https://pnpm.io/) (npm also works)

A GPU is only needed for the real GeoChat and BIT_CD models. Everything below runs on a laptop.

### 1. Controller

Mocks are on by default, so this alone gives a working demo with no models and no network.

```bash
cd controller
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # .venv/bin/pip on Linux and macOS
.venv/Scripts/python tests.py                   # runs fully offline
.venv/Scripts/python server.py                  # http://127.0.0.1:8080
```

### 2. Backend

```bash
cd backend
pnpm install
pnpm dev                                        # http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
pnpm install
pnpm dev                                        # http://localhost:3000
```

Open http://localhost:3000, pick a site and ask a question.

### Configuration

Each part reads its own environment file. Copy the example next to it and edit as needed.

| File | Main settings |
|---|---|
| `controller/.env` | `SATASK_MOCK_<TOOL>` and `SATASK_<TOOL>_URL` per tool, planner LLM endpoints |
| `backend/.env` | `PORT`, `CONTROLLER_URL` |
| `frontend/.env.local` | `NEXT_PUBLIC_BACKEND_URL` |

With no planner configured the controller uses offline keyword routing. To plan with a language model, point it at any OpenAI-compatible endpoint. A local [Ollama](https://ollama.com/) server is the default primary and a hosted model can act as a fallback:

```bash
SATASK_LLM_BASE_URL=http://localhost:11434/v1
SATASK_LLM_MODEL=gpt-oss:20b
SATASK_LLM_FALLBACK_API_KEY=<your key>
```

### Using real models

Swap mocks for real services one tool at a time by adding lines like these to `controller/.env`:

```bash
SATASK_MOCK_VQA=0
SATASK_VQA_URL=http://127.0.0.1:8001/vqa
```

Each service's README covers its own setup:

- [GeoChat agent](AI/geochat/README.md) for VQA and grounding, on a laptop with the stub or Gemini backend or on a GPU (including a free Kaggle T4)
- [VQA service](AI/vqa/README.md) for GeoChat-7B under transformers 5
- [Change detection](AI/change_detection/README.md) for BIT_CD on port 8003

## Demo imagery

`controller/images/` holds 23 Sentinel-2 true-colour chips at 10 m per pixel, each as a georeferenced GeoTIFF with a PNG preview and an entry in `manifest.json`. Every site was chosen to exercise a particular kind of query. Most have one chip from 2023 and one from 2026.

| Site | Used for |
|---|---|
| Jewar Airport, Noida | Change detection: fields in 2023, a finished airport by 2026 |
| Navi Mumbai Airport | The "built after 2023" chain |
| JNPT Port, Mumbai | Counting ships |
| Singapore anchorage | Counting stress test with dozens of small ships |
| Rondônia, Brazil | Deforestation |
| Udaipur lakes | Finding water bodies and monsoon water-level change |
| Bhadla Solar Park | Grounding and land-cover questions |
| Singrauli coal mine | Opencast pit expansion |
| Punjab cropland | Agricultural questions |
| Sundarbans | Mangrove wetland and water grounding |
| Vienna | City scenes and routing around a cloudy image |

`controller/fetch_chips.py` rebuilds or extends this set from the public Sentinel-2 archive on AWS Open Data. No account is needed.

## Testing

```bash
cd controller && .venv/Scripts/python tests.py      # planner, validator, executor, geometry, fixtures
cd AI/geochat && python tests.py                    # parsing, geometry, contract, controller round trip
cd frontend && pnpm lint && pnpm build
```

The controller suite runs fully offline and checks every mock fixture against the same validators a real service response goes through, so a service that matches its fixture will pass integration. GitHub Actions runs all of the above on every push and pull request.

## Roadmap

- Wire in ChangeMamba as a second change detection backend and GeoGround for grounding
- Finish the QLoRA fine-tune of GeoChat on BigEarthNet.txt
- Real optical and SAR fusion behind `cross_modal`, with a shared SAR preprocessing module
- Ground sample distance normalisation so sub-metre Cartosat-2S and RISAT imagery can be fed to models trained at other resolutions

## Acknowledgements

SatAsk builds on the work of others:

- [GeoChat](https://github.com/mbzuai-oryx/GeoChat) by MBZUAI Oryx, a grounded vision-language model for remote sensing
- [BIT_CD](https://github.com/justchenhao/BIT_CD), from Chen, Qi and Shi, *Remote Sensing Image Change Detection with Transformers*, IEEE TGRS 2021
- [LEVIR-CD](https://justchenhao.github.io/LEVIR/), the building change detection dataset behind the BIT_CD checkpoint
- [Sentinel-2](https://registry.opendata.aws/sentinel-2-l2a-cogs/) imagery from the Copernicus programme via AWS Open Data and the Element 84 STAC API

These projects keep their own licences. BIT_CD and GeoChat are cloned separately during setup and are not redistributed here.

## Licence

Released under the [MIT Licence](LICENSE).
