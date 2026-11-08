# 🎯 OptiScheduling

> **High-Performance University Course Timetabling Engine & Web Platform**  
> Originally developed as a Bachelor's Capstone for **Paragon International University** (July 2025) by Bunlong Prak & Bovisal Zhou, re-architected with a native **Rust** optimization engine to eliminate extreme latency and enforce complex real-world institutional constraints.

---

## 📋 Table of Contents
1. [Overview & Problem Context](#-overview--problem-context)
2. [Key Constraints Solved](#-key-constraints-solved)
3. [Architecture](#-architecture)
4. [Empirical Benchmarks](#-empirical-benchmarks)
5. [Thesis Prototype Bugs Fixed](#-thesis-prototype-bugs-fixed)
6. [Quick Start & Usage](#-quick-start--usage)
   - [Building the Rust Engine](#1-building-the-rust-engine)
   - [Running CLI Subcommands](#2-running-the-cli)
   - [Running the HTTP Microservice](#3-running-the-http-microservice)
   - [Running the Next.js Webapp](#4-running-the-nextjs-webapp)
   - [Using with Python](#5-using-with-python)
7. [Tech Stack](#-tech-stack)

---

## 🎓 Overview & Problem Context

Universities face NP-hard combinatorial challenges in scheduling coursework across departments, instructors, classrooms, and student cohorts. At **Paragon International University**, these complexities are amplified by:
- **High proportion of part-time instructors (~67%)** who have strictly limited availability windows and preferred teaching days.
- **Blended online and in-person instruction**, requiring strict gap buffers so instructors and students do not transition between online sessions and on-campus physical rooms without travel time.
- **Physical room constraints**, including specialized computer labs, standard lecture halls, and multi-building campus layouts.
- **Consecutive hour limits**, preventing instructor fatigue (>4 continuous hours/day).

The original prototype suffered from severe runtime bottlenecks (taking dozens of seconds or dropping course hours entirely) due to recursive backtracking in Python and $N+1$ database queries in Next.js. **OptiScheduling** solves this with an ultra-optimized Rust core executing in **sub-10 milliseconds** for greedy repair and **~150 milliseconds** for multi-threaded hybrid metaheuristics.

---

## ⚡ Key Constraints Solved

### Hard Constraints
* **Instructor Double-Booking**: An instructor cannot teach two courses simultaneously.
* **Instructor Blackout Windows**: Respects explicit unavailability constraints and restricts part-time instructors to agreed periods.
* **Classroom Double-Booking & Capacity**: Physical classrooms cannot host multiple courses simultaneously, and capacity must accommodate student enrollment.
* **Unbounded Virtual Classrooms**: Online courses are assigned virtual rooms without consuming physical campus capacity.
* **Section Day Separation**: Split hours of the same section (e.g., a 3-hour course split into $2\text{h} + 1\text{h}$) cannot be scheduled on the same day.
* **Max Consecutive Teaching Hours**: Enforces a strict $\le 4$-hour continuous teaching threshold per instructor per day.

### Soft Constraints & Multi-Objective Optimization
* **Part-Time Instructor Preferred Slots & Day Clustering**: Prioritizes scheduling part-time faculty in their preferred time windows and compacts their schedules into fewer days.
* **Online/Offline Proximity Buffer**: Penalizes back-to-back transitions between online and physical classes for both instructors and student cohorts.
* **Room & Room Type Matching**: Maximizes placement in requested classroom types (e.g., Computer Labs) or specific preferred rooms.
* **Cohort Conflict Minimization**: Penalizes simultaneous scheduling of distinct courses belonging to the same major and academic year cohort.
* **Building Transition Avoidance**: Minimizes inter-building travel across consecutive classes for instructors.

---

## 🏗 Architecture

```
OptiScheduling/
├── rust_scheduler/                   # High-performance Rust workspace
│   ├── optischeduling-core/          # Core bitmask solver, CSP & metaheuristics
│   │   ├── src/model.rs              # Zero-cost Serde DTOs & metrics schemas
│   │   ├── src/time.rs               # u128 bitmask time slot & adjacency algebra
│   │   ├── src/solver/state.rs       # O(1) incremental delta-cost state
│   │   ├── src/solver/constructive.rs# MRV + Part-Time-First + Ejection chains
│   │   ├── src/solver/backtracking.rs# Exact Branch-and-Bound CSP DFS
│   │   ├── src/solver/annealing.rs   # Multi-threaded Portfolio SA + LNS
│   │   ├── src/validator.rs          # Microsecond real-time conflict detector
│   │   └── src/benchmark.rs          # Realistic Paragon IU scenario generator
│   ├── optischeduling-cli/           # Standalone CLI binary (solve/validate/bench)
│   └── optischeduling-server/        # Tokio/Hyper HTTP microservice (CORS, JSON)
├── fyp/                              # Next.js 15 Web Application
│   ├── src/lib/rust-scheduler.ts     # Dual-mode client (HTTP daemon + CLI fallback)
│   ├── src/app/api/generate-schedule/ # Parallel batched Drizzle query route
│   ├── src/app/api/check-conflict/   # Real-time manual drag-and-drop validation API
│   └── src/app/dashboard/schedule/   # Timetable views with strategy selectors & metrics
└── scheduling_algorithms/
    └── scheduler_api.py              # Python runner with Rust acceleration bridge
```

### Solver Strategies
1. **`greedy_repair`**: Minimum Remaining Values (MRV) + Part-Time-First constructive placement with depth-limited Ejection Chain repair. Runs in **$1\text{--}4\text{ ms}$**.
2. **`hybrid` (Recommended)**: MRV constructive seed followed by multi-threaded Large Neighborhood Search (LNS) Ruin-and-Recreate and Simulated Annealing. Eliminates cohort overlaps and minimizes soft penalties in **$150\text{ ms}$**.
3. **`simulated_annealing`**: Multi-threaded portfolio Simulated Annealing with geometric cooling across all CPU cores.
4. **`backtracking`**: Exact Constraint Satisfaction (CSP) depth-first search with forward-checking and Branch-and-Bound pruning for smaller instances.

---

## 📊 Empirical Benchmarks

### 1. Scaling Benchmark (Python Greedy vs. Rust Engine)
*Tested on an Apple Silicon host across synthetic course loads with ~67% part-time faculty and 25% room-to-course ratio:*

| Courses | Python Greedy Wall | Rust HTTP Engine | Engine Speedup | Rust CLI Wall | CLI Speedup | Scheduled Hours (Rust vs. Python) |
|:-------:|:------------------:|:----------------:|:--------------:|:-------------:|:-----------:|:---------------------------------:|
| **50**  | 8.54 ms            | **0.86 ms**      | **10.0x**      | 9.72 ms       | 0.9x        | **240/240** (100%) vs. 219/240    |
| **150** | 54.98 ms           | **1.54 ms**      | **35.7x**      | 10.80 ms      | **5.1x**    | **640/640** (100%) vs. 639/640    |
| **300** | 145.28 ms          | **3.44 ms**      | **42.2x**      | 14.28 ms      | **10.2x**   | **1281/1281** (100%) vs. 1271/1281|
| **600** | 449.99 ms          | **7.00 ms**      | **64.3x**      | 28.64 ms      | **15.7x**   | **2642/2642** (100%) vs. 2623/2642|

> *Note: Legacy Python greedy dropped required hours as problem size grew because it lacks conflict repair. Rust scheduled 100% of required units with zero hard conflicts across all sizes.*

### 2. Realistic Paragon International University Benchmark
*120 sections (280 split units), 103 instructors (~67% part-time), 2 campus buildings, 3 classroom types:*

| Strategy | Solve Time | Units Assigned | Hard Violations | SecSameDay | Online/Offline Proximity | Bldg Switches | Cohort Overlaps |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **GreedyRepair** | **2.20 ms** | **280 / 280** | **0** | 0 | 0 | 0 | 4 |
| **Hybrid** | **152.22 ms** | **280 / 280** | **0** | **0** | **0** | **0** | **0** |
| **SimulatedAnnealing** | **152.26 ms** | **280 / 280** | **0** | 0 | 0 | 0 | 2 |

### 3. Real-Time Manual Conflict Detection
* Used for drag-and-drop course adjustment in the web UI.
* Single-unit conflict check latency: **$6.9\text{ }\mu\text{s}$ (microseconds)**.
* Full-schedule validation latency: **$0.011\text{ ms}$**.

---

## 🐛 Thesis Prototype Bugs Fixed

1. **`preferClassRoomId` Schema Mismatch**:
   - *Bug*: In `fyp/src/app/api/courses/route.ts`, the frontend saved `classroomTypes.id` into `courseHours.preferClassRoomId`, but `generate-schedule/route.ts` tried matching it against `classrooms.id`, causing room preferences to be silently discarded.
   - *Fix*: The rewrite explicitly builds ID lookup sets for both `classroomTypes` and `classrooms`, mapping correctly to `prefer_classroom_type_id` and `prefer_classroom_id`.
2. **Next.js $N+1$ Database Queries**:
   - *Bug*: Original API executed sequential database queries inside nested loops for each course, section, and instructor, resulting in hundreds of HTTP/MySQL round-trips.
   - *Fix*: Replaced with parallel batched Drizzle queries (`Promise.all` + `inArray`) and an atomic database transaction for writing results.
3. **Python Tuple Validity Check Bug**:
   - *Bug*: In `scheduler_api.py`, `check_schedule_validity()` checked `len(self.timetable[day][hour][room_id]) > 1` on a 2-tuple `(course, instructor)`, causing it to always return `False`.
   - *Fix*: Corrected to verify multi-assignment dictionaries and entries.
4. **Python Greedy Over-Allocation on 4-Hour Courses**:
   - *Bug*: When splitting a 4-hour course, `this_session_hours = min(hours_per_session, remaining_hours)` omitted `hours_left`, causing 4-hour courses to schedule $3\text{h} + 3\text{h} = 6\text{h}$ and fail validation.
   - *Fix*: Bounded by `min(hours_per_session, remaining_hours, hours_left)`.
5. **Virtual Online Classroom Collision**:
   - *Bug*: Online courses placed into physical classroom slots trampled in-person course keys in the timetable grid.
   - *Fix*: Online courses are given virtual identifiers without physical room IDs.

---

## 🚀 Quick Start with Docker (Recommended — One Command)

Everything (MySQL 8 database with pre-loaded Paragon IU seed data, Rust scheduler microservice, and Next.js web application) is fully containerized.

```bash
# 1. Start Docker Desktop if not already running
open -a Docker   # macOS shortcut

# 2. Spin up the entire stack with a single command
docker compose up --build
```

That's it!
* **Web UI**: Open [http://localhost:3000](http://localhost:3000)
  * Click **One-Click Demo Login** to immediately enter the dashboard (no Google OAuth setup required for local testing).
  * Open the timetable view: [http://localhost:3000/dashboard/schedule/1/timetable](http://localhost:3000/dashboard/schedule/1/timetable)
  * Select your solver strategy from the dropdown (e.g. **Rust Hybrid (MRV + Parallel LNS/SA)**) and click **Auto-Generate Schedule**!
* **Rust Scheduler Microservice**: Listening on [http://localhost:8085](http://localhost:8085) (healthcheck: `http://localhost:8085/health`).
* **MySQL Database**: Running on `localhost:3306` with schema & seed data automatically populated from `docker/mysql/`.

To shut down:
```bash
docker compose down
```

---

## 💻 Manual / Standalone Development Setup

If you prefer testing individual components locally without Docker:

### 1. Standalone Rust Engine & Benchmarks

Ensure [Rust toolchain](https://rustup.rs/) (1.75+) is installed.

```bash
cd rust_scheduler

# Run test suite (11 unit & integration tests)
cargo test --workspace

# Build optimized release binaries
cargo build --release
```
The compiled binaries are produced in `rust_scheduler/target/release/`:
* `optischeduling-cli`
* `optischeduling-server`

---

### 2. Running the CLI

```bash
# Run benchmark with Paragon IU parameters
./rust_scheduler/target/release/optischeduling-cli bench --sections 120 --budget-ms 150

# Solve a schedule from JSON file or stdin
./rust_scheduler/target/release/optischeduling-cli solve --input request.json --strategy hybrid --pretty

# Check conflict for a single drag-and-drop movement
./rust_scheduler/target/release/optischeduling-cli check-conflict --input conflict_check.json

# Validate an entire schedule
./rust_scheduler/target/release/optischeduling-cli validate --input schedule_to_validate.json
```

---

### 3. Running the HTTP Microservice

Start the microservice daemon to enable sub-millisecond network generation for the Next.js frontend:

```bash
PORT=8085 RUST_LOG=info ./rust_scheduler/target/release/optischeduling-server
```

**Available Endpoints:**
* `GET /health` — Health check & engine version.
* `GET /v1/benchmark` — Runs standard Paragon benchmark suite across all strategies.
* `POST /v1/schedule/generate` — Solves `ScheduleRequest` payload.
* `POST /v1/schedule/check-conflict` — Sub-millisecond validation for single-cell manual movement.
* `POST /v1/schedule/validate` — Validates existing timetable assignments.

---

### 4. Running the Next.js Webapp

```bash
cd fyp

# Configure environment variables (e.g. in .env.local)
# OPTISCHEDULING_RUST_URL=http://127.0.0.1:8085  # (Optional: uses daemon; falls back to CLI binary automatically)
# DATABASE_URL=mysql://...

npm install
npm run dev
```

In the timetable view (`/dashboard/schedule/[id]/timetable`), you can:
* Select algorithm strategies from the dropdown:
  * **Rust Hybrid (MRV + Parallel LNS/SA)**
  * **Fast Greedy + Ejection Repair (<5ms)**
  * **Exact CSP Backtracking (MRV)**
  * **Simulated Annealing Portfolio**
* View real-time solver metrics and database timing banners upon generation.
* Drag and drop courses with instant conflict feedback.

---

### 5. Using with Python

The legacy Python prototype in `scheduling_algorithms/scheduler_api.py` automatically bridges to the Rust engine:

```bash
python3 scheduling_algorithms/scheduler_api.py
```

To call the Rust solver programmatically in Python:
```python
from scheduler_api import Schedule, Course, Instructor, Classroom

sched = Schedule()
# ... add courses, instructors, classrooms ...

# Solves via Rust CLI automatically
resp = sched.generate_schedule(use_rust=True, strategy="hybrid", time_budget_ms=150)
sched.print_schedule()
print("Valid:", sched.check_schedule_validity())
```

---

## 🛠 Tech Stack

* **Core Scheduling Engine**: Rust 2021, `tokio`, `hyper 0.14`, `rayon`, `serde`, `rand`.
* **Web Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Lucide Icons, Shadcn UI.
* **Database & ORM**: MySQL, Drizzle ORM.
* **Prototyping & Benchmarks**: Python 3.10+, Subprocess & HTTP Bridge.
