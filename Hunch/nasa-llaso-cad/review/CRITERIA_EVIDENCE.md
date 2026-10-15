# How We Meet NASA HUNCH Judge Criteria

**Package location:** `Hunch/nasa-llaso-cad/review/`  
**Serve:** `python3 serve.py 8002` → http://127.0.0.1:8002/review/  
**AI navigation:** No changes to `viewer.html` autonomy stack, `js/autonomy_stack.js`, or `payload.json` for this packet.

---

## Presentation

| Criterion | Met how | Where |
|-----------|---------|-------|
| Concise project description | One-page brochure + tri-fold problem panel | `brochure.html`, `trifold.html` |
| Tri-fold / board | Printable HTML with CAD, tests, evolution, QR | `trifold.html` |
| Brochure | Single-sided print layout with team + CAD + QR | `brochure.html` |
| PowerPoint-style deck | Web engineering deck (short bullets, no paragraphs) | `engineering-deck.html` |
| Team speaks / Q&A | Deck ends with “demo script” + constraint cheat sheet | `engineering-deck.html` § Demo |
| QR → demo video | QR targets sim + deck; drop MP4s in `media/` per guide | `docs/install-and-demo.md`, `media/README.md` |

## Research

| Criterion | Met how | Where |
|-----------|---------|-------|
| Problem + constraints | Lunar g, slope, mass, dust, power | `docs/research-brief.md` |
| Environment depth | Sim flaws documented honestly | `Lunar_Constraints_and_Sim_Flaws.pdf` |
| COTS / prior art | Motor, driver, LiDAR, material table | `docs/cots-comparison.md` |
| Decision matrix | Weighted 4WD vs 6WD vs rocker-bogie | `data/decision-matrix.json`, `decision-matrix.html` |

## Design

| Criterion | Met how | Where |
|-----------|---------|-------|
| CAD drawings | STL/OBJ/URDF + generated assembly | `../nasa-hunch-rover/cad_model/` |
| Design progression | v0 concept → CAD → sim → bench | `design-evolution.html` |
| Electrical architecture | Block diagram (rails, isolation) | `electrical-block-diagram.svg` |
| Requirements trace | Torque math, BOM-class spec | `hardware_specification_sheet.md` |

## Prototype

| Criterion | Met how | Where |
|-----------|---------|-------|
| Functional demo | Live sim + optional physical rover | `viewer.html`, bench scripts |
| Innovation | 6WD tracked + dual isolated power + LLASO logistics link | Tri-fold + research brief |
| Finished appearance | PETG spec + fusion 3D model | Hardware spec + `rover_solo.html` |
| 60% / 90% fidelity story | Phase labels aligned to HUNCH PDR/CDR | `engineering-deck.html` milestones |

## Testing & data

| Criterion | Met how | Where |
|-----------|---------|-------|
| Test plan | SIM + HW + review tables | `docs/test-plan.md` |
| Automated sim checks | Pit geometry regression | `test-results/nav_geometry_regression.txt` |
| Telemetry metrics | CSV + JSON summary | `test-results/*.csv`, `sim_summary.json` |
| FMEA + design changes | Closed loop NCR-001–004 | `docs/fmea-closure.md` |
| Regenerate bundle | One command | `python3 generate_hunch_review_bundle.py` |

## Software / digital twin (extra credit)

| Criterion | Met how | Where |
|-----------|---------|-------|
| Mission control | AEGIS-V1 | https://aegisv1.vercel.app |
| AMR dashboard | React telemetry UI | `nasa-hunch-rover/` |
| ONNX pilot (optional) | Unchanged; still toggled in viewer | `rover_pilot.onnx` |

---

**Before Houston (FDR):** Replace archetype telemetry CSV with a fresh LOG TELEMETRY export; add real prototype MP4s to `review/media/`; fill `[School]` and `[Teacher]` on print pages.
