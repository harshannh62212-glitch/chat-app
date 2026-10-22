# The Hunch — NASA HUNCH LLASO Autonomous Lunar Robotics & Logistics

**Cursor agents:** start at [`.agents/AGENT_INDEX.md`](.agents/AGENT_INDEX.md) (task → file map, `viewer.html` sections, what not to index).

## 📍 Codebase Topology & Locations
- **Workspace (edit/run here):** `/Users/nhharshan/Hunch` on this Mac — single copy; no agent-driven `rsync`/`cp` to other folders or machines.
- **Sync / backup:** **GitHub only** (push/pull when the user asks). See `.cursor/rules/github-only-sync.mdc`.
- **Google Drive Synced Docs Root:** `/Users/harshan/Library/CloudStorage/GoogleDrive-harshannh62212@gmail.com/My Drive/Hunch` — do not use unless the user names it.
- **Hardware/NAS Testbed:** `192.168.1.27` (`harshan@192.168.1.27`, Dell Latitude 5290 Server with Docker: Portainer, Glances, Postgres, Redis)
- **Production Web Deployment:** https://aegisv1.vercel.app

---

## 🚀 Projects Breakdown

### 1. Root: AEGIS-V1 Mission Control & Web Dashboard (`/Users/harshan/Hunch`)
- **Key Files:** `index.html`, `styles.css`, `payload.json`, `vercel.json`
- **Features:**
  - Three.js 3D CAD Visualizer (Wireframe, exploded view, subsystem isolation, lighting).
  - 1/6g Lunar Gravity physics calculator ($1.622\,\text{m/s}^2$) vs Earth 1g ($9.806\,\text{m/s}^2$), CoG margin validation, battery power estimation.
  - Tactical lunar surface route & hazard simulator.
  - Web Audio API synthesizer for cybernetic telemetry feedback.
- **Team:**
  - **Sacheth:** 3D Design Lead & Assembly Lead (CAD modeling, kinematic animation, co-assembly, co-AI trainer).
  - **Ahrav:** Mechanical Design Lead (Chassis, suspension, drivetrain, steering).
  - **Harshan:** Autonomous Software & AI Lead (Auto-Nav AI, primary codebase, CAD co-design, CompTIA A+ & Python certified).

### 2. Autonomous Navigation AI (`/Users/harshan/Hunch/payload.json`)
- **Model:** `hunch-rover-nav` (fine-tune / system prompt for `qwen2.5-coder:7b`).
- **Telemetry:** 10 sensor clearances (FL, FC, FR, cL, cR, SL, SR, BL, BC, BR in meters) + terrain hazard tags (rocks, craters, pits, mountains).
- **Safety Directive:** Strict JSON output: `{"dodge": "none" | "left" | "right"}`. Never drive into pits/mountains to avoid a rock.

### 3. Digital Twin & Flight Simulator (`/Users/harshan/Hunch/Hunch/nasa-llaso-cad`)
- **Interactive 3D Simulator:** `viewer.html` (symlinked as `index.html`).
- **Autonomy Engine:**
  - Classical: LiDAR occupancy map + A* + pure pursuit (primary driver).
  - Optional Ollama assist: `hunch-rover-nav:latest` (7B-class dodge JSON → planner cost bias).
  - Optional 60 FPS imitation policy (`rover_pilot.onnx` via ONNX Runtime WebAssembly).
  - Proximity supervisor (auto-reverse) + 6-wheel rocker-bogie terrain solver.
- **Training Pipeline (`train_rover_imitation.py`):**
  - PyTorch `RoverPilotNet` (4-layer Conv2D 1280-dim vision + 6-dim telemetry MLP -> Tanh 2-dim `[steer, throttle]`).
  - Symmetrical augmentation + reverse reflex injection.
  - Accelerated on Apple Silicon MPS (`torch.device("mps")`).
- **Lunar Logistics (Project 1):**
  - 40-ft cylindrical cargo module ($12.192\,\text{m} \times 3.0\,\text{m}$).
  - `optimize_manifest.py` & `lunar_logistics_manifest.json`: 14-day LIFO reverse-chronological mission packing, CoM tracking ($\mathbf{r}_{\text{CoM}} = [-0.912, -0.022, +0.002]\,\text{m}$), tracking 5 NASA variables.
  - 3-DOF ceiling gantry robot (ILTR) retrieval in CoppeliaSim (`coppelia_unloading_simulation.lua`).
- **Server:** `serve.py` (serves directory on port 8002, receives telemetry logs at `/api/log` -> `rover_actions.log`).

### 4. AMR Tracked Lunar Rover (`/Users/harshan/Hunch/Hunch/nasa-hunch-rover`)
- **Vite + React Dashboard:** `src/App.jsx`, `tailwind.config.js`.
- **Engineering Specification (`cad_model/hardware_specification_sheet.md`):**
  - Gross mass: $8.0\,\text{kg}$, max slope $25^\circ$, $\mu_{\text{track}} = 0.65$.
  - Earth testing motor torque target: $\ge 35\,\text{kg}\cdot\text{cm}$ stall (JGB37-550 12V 30:1 / 50:1 DC gear motors with optical/magnetic encoders).
  - Motor Driver: Cytron MDD10A (dual 10A continuous, 30A peak).
  - Buck Converter: XL4015 5A continuous (8A peak) step-down to 5.1V (prevents Raspberry Pi brownouts when YDLIDAR spins up).
  - Battery: 12.8V LiFePO4 4S (3Ah–6Ah).
  - Fabrication: PETG 3D print (4 walls, 35-40% gyroid infill), M3/M4 brass heat-set threaded inserts ($230^\circ\text{C}$).
- **CAD & Physics:** `generate_rover_cad.py`, `tracked_lunar_rover.urdf`.

### 5. Multi-Robot CoppeliaSim (`/Users/harshan/Hunch/Hunch/coppeliabot`)
- **Models:** `coppeliabot.urdf`, `coppeliabot_assembly.obj`, `keyboard_controller.lua`, `teleop_remote_api.py`.

---

## 🛠️ Fast Commands Cheatsheet

```bash
# Serve NASA CAD Simulator + Telemetry Logging (port 8002)
cd /Users/harshan/Hunch/Hunch/nasa-llaso-cad && python3 serve.py 8002

# Train Rover Neural Pilot on Apple Silicon MPS
cd /Users/harshan/Hunch/Hunch/nasa-llaso-cad && python3 train_rover_imitation.py

# Run Lunar Logistics Manifest Optimizer
cd /Users/harshan/Hunch/Hunch/nasa-llaso-cad && python3 optimize_manifest.py

# Run Rover React App Dev Server
cd /Users/harshan/Hunch/Hunch/nasa-hunch-rover && npm run dev

# Deploy Root Dashboard to Vercel
cd /Users/harshan/Hunch && npx vercel --prod
```
