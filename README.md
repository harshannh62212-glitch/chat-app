# The Hunch

NASA HUNCH LLASO monorepo — external cargo transport robot (AEGIS-V1), lunar surface simulator, AMR dashboard, and logistics tooling.

Autonomous lunar surface logistics and payload transport engineered for **NASA HUNCH LLASO Project 2** (Rocket to Base Supply Building).

## Mission Overview
- **Mission Status**: `PROTOTYPE` (see [Informational content](https://aegisv1.vercel.app/informational))
- **Subsystem Engineers**:
  - **Sacheth** — Avionics & Systems Lead
  - **Ahrav** — Mechanical Design & Locomotion Lead
  - **Harshan** — Autonomous Software & AI Lead
- **Key Features**:
  - Interactive Three.js 3D CAD Visualizer (Wireframe, Exploded View, Subsystems)
  - Tactical Lunar Surface Route & Hazard Simulator
  - Standardized HUNCH Payload & Weight Calculator (1/6th gravity physics)
  - Real-time Subsystems Telemetry HUD & Cybernetic Audio FX

## Quick start
```bash
cd Hunch/nasa-llaso-cad && python3 serve.py 8002
# http://127.0.0.1:8002/launcher.html
```

Agents & humans: see [`AGENTS.md`](AGENTS.md), [`.agents/AGENT_INDEX.md`](.agents/AGENT_INDEX.md), [`HANDOFF.md`](HANDOFF.md).

## Deployment on Vercel
```bash
npx vercel
```
Production: [aegisv1.vercel.app](https://aegisv1.vercel.app) (project name in `vercel.json`).

## GitHub
GitHub repo: **`harshannh62212-glitch/HUNCH`** — see [`.github/REPOSITORY.md`](.github/REPOSITORY.md).
