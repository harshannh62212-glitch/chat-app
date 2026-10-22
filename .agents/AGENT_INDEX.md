---
name: agent-index
description: "Primary navigation map for Cursor agents working in the Hunch monorepo."
trigger: "always_on"
---

# Hunch — Agent navigation index

Read this **before** grepping `viewer.html` or `logs/`. Human-oriented detail: [`HANDOFF.md`](../HANDOFF.md). Commands: [`AGENTS.md`](../AGENTS.md) and [`.agents/skills/nasa-hunch/SKILL.md`](skills/nasa-hunch/SKILL.md).

## Workspace paths (same tree, two Mac homes)

| Machine | Path |
|--------|------|
| M1 Air (this workspace) | `/Users/nhharshan/Hunch` |
| M4 Mini mirror | `/Users/nhharshan/Hunch` — `ssh m4` |
| Rules also cite | `/Users/harshan/Hunch` (legacy path in some docs — equivalent tree) |

Do **not** use GitHub as source of truth unless the user asks to push/pull.

## Repo shape

```
Hunch/                          ← git root
├── index.html, styles.css      ← AEGIS-V1 public site (Vercel)
├── payload.json                ← hunch-rover-nav prompt template (qwen2.5-coder:7b)
├── AGENTS.md, HANDOFF.md
├── .agents/                    ← YOU ARE HERE
├── .cursor/rules/
└── Hunch/                      ← nested project folder (not a typo)
    ├── nasa-llaso-cad/         ← surface sim + ONNX train + logistics
    ├── nasa-hunch-rover/       ← React dashboard
    └── coppeliabot/
```

## Task → where to edit

| User intent | Start here |
|-------------|------------|
| Sim won’t start / telemetry | `Hunch/nasa-llaso-cad/serve.py`, `launcher.html` |
| Autopilot, A*, LiDAR, physics | `Hunch/nasa-llaso-cad/viewer.html` (see map below) |
| Ollama / dodge JSON assist | `viewer.html` (`askLLM`), `js/autonomy_stack.js`, `payload.json` |
| Neural pilot ONNX | `train_rover_imitation.py`, `rover_pilot.onnx`, `viewer.html` neural block |
| Record training data | `viewer.html` flight recorder → `dataset_latest.json` |
| Logistics / parcels / lander | `js/lunar_logistics.js`, `build_rover_parcels.py`, `rover_parcel_manifest.json`, `viewer.html` cargo bay + seeded rocks |
| Public mission site | `/index.html`, `styles.css`, `vercel.json` |
| React rover UI | `Hunch/nasa-hunch-rover/src/App.jsx` |
| Hardware BOM | `nasa-hunch-rover/cad_model/hardware_specification_sheet.md` |

## `viewer.html` — monolith map (~5.7k lines)

Single file: HTML + CSS + all sim logic. Extracted modules:

| File | Role |
|------|------|
| `js/autonomy_stack.js` | Ollama discovery, `shouldCallLlm`, policy manifest |
| `js/telemetry_export.js` | `NASA_Telemetry` CSV / metrics JSON |
| `js/lunar_logistics.js` | Supply depot, cargo lander, arm pickup, parcel manifest |

| Section | ~Line | Contents |
|---------|-------|----------|
| Scene / terrain `getH` | 654–873 | Three.js, craters, rocks, hangar |
| Rover CAD mesh | 1375–1927 | Rocker-bogie, wheels |
| Terrain nav guards | 2046–2300 | Pits, hills, missions, map click |
| **LiDAR + A* + cost** | 2674–3515 | `navBuildCost`, `navPlan`, `navStampRockObstaclesInWindow` |
| **`computeAutopilot`** | 3517–3805 | Pure pursuit, replan, LOC watchdog |
| Mastcam / vision preflight | 3997–4130 | `captureVisionNavPreflight` |
| Flight recorder | 4134–4250 | `dataset_latest.json` samples |
| **ONNX neural pilot** | 4256–4410 | `rover_pilot.onnx` |
| **Supervisor reverse** | 4415–4530 | `evaluateObstacleProximityAndEscape` |
| Ollama `askLLM` | 4600–4720 | `/api/generate`, dodge bias |
| **`updatePhysics`** | 4933–5480 | Integrator, collision, 6-wheel solver |
| **`animate`** | 5485+ | Main loop |

Constants near line **2692**: `ROVER_RADIUS`, `NAV_PLAN_CLEAR`, `NAV_PATH_MIN_ROCK_CLR`, `NAV_INFL_R`.

## AI stack (what has a “map”)

| Layer | Model | Map? |
|-------|--------|------|
| Classical autopilot | — | Yes: `navLogOdds` grid + `rockData[]` in planner |
| Ollama assist | `hunch-rover-nav:latest` (7B family) | No — sparse lidar text + optional image |
| ONNX pilot | `rover_pilot.onnx` | No — camera + 6 telemetry dims |
| Root `payload.json` | Template for fine-tune | No — 10 sensor strings |

Default Ollama: local then M4 `100.92.134.100:11434`. Production assist: **7B fine-tune**, not 12B/14B.

## Do not waste context on

- `Hunch/nasa-llaso-cad/logs/` — Chrome profile from headless nav studies (listed in `.cursorignore`)
- `node_modules/`, `.venv/`, `dist/`
- Reading every `.stl` / large `.obj` — use URDF + `generate_*_cad.py`

## Run (copy-paste)

```bash
cd /Users/nhharshan/Hunch/Hunch/nasa-llaso-cad && python3 serve.py 8002
# http://127.0.0.1:8002/launcher.html
```

## After edits (two-machine sync)

```bash
rsync -a --update --exclude '.tmp.drivedownload/' --exclude '.tmp.driveupload/' --exclude '.DS_Store' --exclude '.stfolder/' \
  /Users/nhharshan/Hunch/ m4:/Users/nhharshan/Hunch/
rsync -a --update --exclude '.tmp.drivedownload/' --exclude '.tmp.driveupload/' --exclude '.DS_Store' --exclude '.stfolder/' \
  m4:/Users/nhharshan/Hunch/ /Users/nhharshan/Hunch/
```
