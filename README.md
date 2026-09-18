# MEM ATC Trainer

A browser-based **Memphis (KMEM) air traffic control and pilot training game** built from the supplied MEMSim airport geometry and the FAA airport diagram. The goal is to feel closer to a flight-simulator training session than a multiple-choice quiz: aircraft move, the runway can become occupied, clearances have to be read back, and the player can train from either side of the frequency.

> **Training aid only. Not for navigation, real-world ATC operations, or FAA certification.**

## What is in v0.1

- **Two roles:** Pilot and Controller.
- **Four positions:** Ground, Tower, Approach, Departure.
- **Eight playable scenarios** covering taxi/readback, runway sequencing, line-up-and-wait/takeoff, vectors, altitude/speed assignments, ILS setup, and initial departure control.
- **3D surface view:** MapLibre airport view with the supplied MEM airport geometry, gates, taxi graph, runway geometry, 3D building extrusions, taxiway-reference labels, and an A300 GLB aircraft model.
- **Ground movement:** Graph-based taxiing with selectable junction turns, taxi speed/braking, route-deviation detection, runway-edge protection, hold-short targets, and an immediate runway-incursion failure condition.
- **Controller traffic:** CPU pilots read back clearances and move along the surface graph.
- **Tower traffic:** Arrival-versus-departure runway sequencing and runway occupancy logic.
- **Radar modes:** A purpose-built simulated radar display for Approach and Departure with selectable tracks, heading/altitude/speed commands, range rings, data blocks, and moving targets.
- **Radio training:** Typed transmissions, optional browser speech recognition, optional spoken CPU radio traffic, phrase parsing, and scenario-specific scoring.
- **Three difficulties:** Student, Academy, Challenge. Student provides route/phraseology help; Challenge removes much of the guidance and can inject bad readbacks that must be corrected.
- **Debrief:** Score, error count, elapsed time, and objective completion at the end of a session.

## FAA / airport data basis

This project intentionally separates **airport/surface data** from the **game logic**.

- `data/map-data.js` is the supplied MEMSim airport dataset and contains the airport graph, gates, runways, taxi-centerline geometry, and hub geometry.
- `data/gate-730-extension.js` is the supplied Gate 730/731/732 extension and is loaded before the game engine so those gates and taxi connections are available to routing.
- `docs/source-notes.md` records the FAA/current-cycle references and the boundary between published data and simulator-derived data.
- `data/airport-reference.js` contains game-facing runway names, current diagram frequencies, and display-reference taxiway labels.

The game data is aligned to the FAA D-TPP **2609** MEM airport diagram (effective 03 SEP 2026–01 OCT 2026). Phraseology and runway-safety behavior are modeled around FAA Order JO 7110.65BB, current FAA notices, and AIM runway-operation/readback guidance.

### Important realism boundary

This is meant to be realistic **training software**, but it is not a certified ATC simulator and does not claim exact facility SOP/LOA behavior.

- Taxiway text labels were georeferenced from the supplied airport diagram for on-screen orientation; they are not surveyed navigation points.
- The supplied airport graph is the movement engine. A future version should explicitly assign every graph edge its official taxiway name and every published hold line its exact graph location.
- The current repository only contains the supplied **A300 GLB**. Other aircraft types use the A300 visual scaled to an approximate type size until their own GLBs are added.
- Approach/Departure use a training radar presentation, not a pixel-perfect STARS/ARTS emulation.
- Approach/Departure sector frequencies are intentionally shown as **SIM** because the supplied airport diagram does not establish facility-sector frequencies or local position splits.
- Weather/ATIS values in scenarios are simulated; there is no live METAR/NOTAM feed.

## Run it locally

Because the simulator loads JavaScript/data/model files, serve the repository over HTTP rather than double-clicking `index.html`.

### Windows

```bat
py -m http.server 8080
```

Then open `http://localhost:8080`.

### macOS / Linux

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

The project currently loads MapLibre and Three.js from CDNs, so an internet connection is needed for those libraries. Airport data and the A300 model are local to the repository.

## GitHub Pages

A Pages workflow is included at `.github/workflows/pages.yml`.

1. Create a GitHub repository and copy this project into it.
2. Push to the `main` branch.
3. In **GitHub → Settings → Pages**, set **Source** to **GitHub Actions**.
4. The included workflow publishes the repository as a static site after each push to `main`.

No build step, Node server, database, or API key is required.

## Controls

### Ground — Pilot

1. Read the clearance and type a readback.
2. Choose the next graph direction at each junction.
3. `1` = 5 kt taxi, `2` = 12 kt, `3` = 18 kt, `Space` = brake.
4. Stop at the displayed hold-short target. Entering a runway edge without a crossing/takeoff clearance is treated as a runway incursion.

### Ground — Controller

Type the taxi clearance into the radio box. The phrase parser checks the callsign, runway, taxi route and hold-short instruction. The CPU pilot reads it back and follows the resulting route. In Challenge mode, a deliberately incomplete readback can require a controller correction.

### Tower — Pilot

Read back and comply with hold-short, line-up-and-wait and takeoff instructions in sequence. The aircraft does not enter the runway before clearance.

### Tower — Controller

Manage the runway with an arrival on final and a departure holding short. Landing, hold-short, line-up-and-wait and takeoff instructions are interpreted from typed radio calls. Releasing the departure while the arrival is too close or occupying the runway is scored as an unsafe action.

### Approach / Departure — Pilot

Use the heading, altitude and speed controls to comply with the controller's assignments while watching the radar track update.

### Approach / Departure — Controller

Type heading, altitude, speed and approach clearances in normal English/FAA-style phraseology. The CPU track responds to recognized values.

## Repository layout

```text
MEM-ATC-Trainer/
├─ index.html
├─ css/
│  └─ game.css
├─ data/
│  ├─ map-data.js
│  ├─ gate-730-extension.js
│  └─ airport-reference.js
├─ js/
│  ├─ game.js
│  ├─ phraseology.js
│  ├─ radar-engine.js
│  └─ surface-engine.js
├─ models/
│  └─ a300.glb
├─ docs/
│  └─ source-notes.md
└─ .github/workflows/pages.yml
```

## Adding the rest of the aircraft models

The current renderer deliberately falls back to the A300 model. A clean next step is to add:

```text
models/md-11.glb
models/b757.glb
models/b767.glb
models/b777.glb
models/atr42.glb
```

Then update the model map in `js/surface-engine.js` so each type loads its own GLB instead of using the A300 fallback.

## Recommended realism roadmap

1. **Authoritative taxiway-edge mapping:** tag every `AIR_GRAPH_EDGE` with its actual taxiway identifier from the FAA diagram and validate every runway entry/hold line.
2. **More Ground scenarios:** runway crossings, progressive taxi, amended taxi instructions, wrong-turn recovery, multiple aircraft, opposite-direction traffic and readback corrections.
3. **Tower:** multiple arrival/departure queues, wake-turbulence categories, go-arounds, runway crossings, runway changes and intersection departures.
4. **Approach:** multiple arrivals, final sequencing, speed control, base/final geometry, missed approaches and approach gates.
5. **Departure:** multiple departure fixes, climb restrictions and handoff logic.
6. **Aircraft-specific GLBs and performance:** turn radius, acceleration, taxi speed limits, takeoff roll, climb and landing performance by aircraft family.
7. **Radio:** better number pronunciation, frequency changes, stepped-on calls, delayed pilot responses and configurable voice packs.
8. **Weather/runway configuration:** optional live METAR ingestion in a future hosted version, but keep an offline deterministic mode for repeatable training.
9. **Scenario editor:** create/save JSON scenarios without touching source code.
10. **Progress tracking:** local profile, skill categories, scenario history and recurring weak-point drills.

## Development notes

The code is plain HTML/CSS/JavaScript so it is easy to inspect and modify. The training game intentionally does **not** load the old tug runtime or stop-sign logic. It reuses only the aircraft-relevant map/graph/gate data and builds a separate ATC game layer around it.


## v0.1.1 Flat GitHub Pages build
This package is intentionally flat so every runtime file can be uploaded directly into the repository root using GitHub's browser uploader. Do not create css/, data/, js/, or models/ folders for this build. GitHub Pages should publish from `main` / `(root)`.

After replacing the files, wait for the Pages deployment to finish, then hard-refresh the site (Ctrl+F5).
