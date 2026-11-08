# OptiScheduling: Assistant Guide & Project Context

> **Project**: OptiScheduling (Automated University Timetabling Engine & Web Application)  
> **Original Capstone**: Paragon International University (July 2025) by Bunlong Prak & Bovisal Zhou  
> **Stack**: Rust (Tokio/Hyper/Serde), Next.js 15 (Turbopack/React 19/TypeScript), MySQL 8, Drizzle ORM, Docker Compose.

---

## ⚡ Quick Commands

### Docker (Full Stack)
```bash
docker compose up -d --build     # Start MySQL, Rust scheduler, and Next.js webapp
docker compose ps                # Check container health and status
docker compose logs -f web       # View Next.js web application logs
docker compose logs -f scheduler # View Rust engine daemon logs
docker compose down -v           # Stop and reset database volume
```
- Web UI: http://localhost:3000 (Use "One-Click Demo Login" to access seeded dashboard)
- Timetable URL: http://localhost:3000/dashboard/schedule/1/timetable
- Rust Scheduler API: http://localhost:8085/health

### Rust Engine (`rust_scheduler/`)
```bash
cd rust_scheduler
cargo test --workspace           # Run all 11 unit & integration tests
cargo build --release            # Compile release binaries (optischeduling-cli & optischeduling-server)
./target/release/optischeduling-cli bench --sections 120 --budget-ms 150 # Run Paragon IU benchmark
```

### Python Prototype (`scheduling_algorithms/`)
```bash
python3 scheduling_algorithms/scheduler_api.py # Runs test scenario via Rust acceleration bridge
```

---

## 🏛 Architecture & Codebase Map

### 1. Rust Optimization Workspace (`rust_scheduler/`)
- `optischeduling-core/`: Core scheduling library:
  - `src/model.rs`: Request/Response schemas, strategy enums, metrics & breakdown DTOs.
  - `src/time.rs`: `u128` bitmask time slot algebra, 12h/24h time parser, non-exponential slot combo generator.
  - `src/solver/state.rs`: $O(1)$ incremental delta-cost state tracking across 9 objective terms.
  - `src/solver/constructive.rs`: MRV + Part-Time-First constructive solver with depth-limited Ejection Chain repair.
  - `src/solver/backtracking.rs`: Exact Branch-and-Bound CSP DFS.
  - `src/solver/annealing.rs`: Multi-threaded portfolio Simulated Annealing + LNS Ruin-and-Recreate.
  - `src/validator.rs`: Sub-millisecond ($6.9\text{ }\mu\text{s}$) conflict checking and full schedule validator.
  - `src/benchmark.rs`: Realistic Paragon IU benchmark scenario generator (103 instructors ~67% part-time).
- `optischeduling-cli/`: CLI binary (`solve`, `validate`, `check-conflict`, `bench`).
- `optischeduling-server/`: High-performance Tokio/Hyper HTTP microservice daemon on port 8085.

### 2. Next.js 15 Webapp (`fyp/`)
- `src/lib/rust-scheduler.ts`: Dual-mode client (calls HTTP daemon at `OPTISCHEDULING_RUST_URL`, falls back to CLI binary at `OPTISCHEDULING_BIN`).
- `src/app/api/generate-schedule/route.ts`: Parallel Drizzle queries (`Promise.all` + `inArray`), maps `preferClassRoomId` correctly, calls Rust solver, and persists via atomic transaction.
- `src/app/api/check-conflict/route.ts`: Real-time manual drag-and-drop validation API.
- `src/app/api/dev-login/route.ts`: One-click local demo login bypassing Google OAuth.
- `src/app/dashboard/schedule/[id]/timetable/`:
  - `timetable-classroom-view.tsx`: Classroom view with algorithm strategy selector & metrics banner.
  - `timetable-major-view.tsx`: Major view with algorithm strategy selector & metrics banner.
- `src/lib/db.ts` & `src/drizzle/db.ts`: MySQL connection pool & Drizzle instances with build-time fallback URLs.

### 3. Docker Infrastructure (`docker/`)
- `docker/Dockerfile.scheduler`: Multi-stage Rust build -> `debian:bookworm-slim`.
- `docker/Dockerfile.web`: Multi-stage Node 20 build -> Next.js production runner.
- `docker/mysql/init.sql`: Automated schema creation.
- `docker/mysql/seed.sql`: Pre-seeded Paragon IU Fall 2025 semester schedule (`scheduleId: 1`), user, majors, rooms, instructors, and courses.

---

## 🎯 Institutional Constraints Solved

### Hard Constraints
1. **No Instructor Double-Booking**: $O(1)$ bitmask check ensuring an instructor cannot teach concurrent sessions.
2. **Instructor Blackouts**: Bitmask exclusion of unavailable days and hours.
3. **Classroom Capacity & Conflict**: Physical classrooms cannot host concurrent classes, and capacity must meet enrollment.
4. **Unbounded Virtual Online Rooms**: Online classes receive virtual identifiers (`classroom_id: -1`), bypassing physical room limits.
5. **Section Day Separation**: Split hours of the same section (e.g. $2\text{h} + 1\text{h}$) cannot land on the same day.
6. **Max 4 Consecutive Teaching Hours**: Enforces a strict continuous threshold $\le 4\text{ hours/day}$ per instructor.

### Soft Constraints / Objectives
1. **Part-Time Faculty Priority & Day Clustering**: Prioritizes scheduling part-time faculty in their preferred time windows and compacts their schedules into fewer days.
2. **Online/Offline Proximity Buffer**: Penalizes back-to-back transitions between online and physical classes for both instructors and student cohorts.
3. **Classroom Type & Room Matching**: Rewards matching requested classroom types (e.g. Computer Labs) and specific preferred rooms.
4. **Cohort Conflict Minimization**: Penalizes simultaneous scheduling of distinct courses for the same major and academic year.
5. **Campus Building Transition Minimization**: Penalizes back-to-back classes in different campus buildings.

---

## 🐛 Fixed Prototype Bugs to Keep in Mind
- **`preferClassRoomId` schema mismatch**: `classroomTypes.id` was previously saved into `courseHours.preferClassRoomId` but checked against `classrooms.id`. The query route now checks both ID sets cleanly.
- **$N+1$ Database Queries**: All sequential loops in `generate-schedule/route.ts` were replaced with parallel queries and single chunked transactions.
- **Python tuple check**: Line 351 in `scheduler_api.py` checked `len(entry) > 1` on a 2-tuple `(course, instructor)`. Fixed to check dictionary entries.
- **Python greedy 4h over-allocation**: `this_session_hours` in `scheduler_api.py` omitted `hours_left`, turning 4h courses into $3\text{h} + 3\text{h} = 6\text{h}$. Bounded by `min(hours_per_session, remaining_hours, hours_left)`.
- **Next.js build-time pool**: `src/lib/db.ts` uses fallback strings so `npm run build` never crashes when `DATABASE_URL` is unset at build time.
- **`__Secure-` cookies**: `src/auth/index.ts` bypasses the `__Secure-` cookie prefix when running on `localhost`.

---

## 🚀 Suggested Next Tasks for Claude Code
1. **Interactive Real-Time Drag-and-Drop Popover**: In `timetable-classroom-view.tsx`, connect dragging hover events to call `/api/check-conflict` in real time to show conflict tooltips before dropping.
2. **Timetable Export**: Add client-side export to Excel (`xlsx`), CSV, or PDF using existing download button handlers in the dashboard header.
3. **Configurable Constraint Weights**: Add a settings drawer in the UI allowing academic administrators to tune penalty weights.
4. **Production Deployment Script**: Add a production Docker Compose overlay (`docker-compose.prod.yml`) with Nginx reverse proxy and SSL.
