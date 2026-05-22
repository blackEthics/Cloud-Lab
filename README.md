# Cloud Lab — Aging-Weighted Priority (AWP) Scheduler

A cloud computing lab that implements and visualizes the **Aging-Weighted Priority (AWP)** scheduling algorithm — a dynamic task scheduler that balances fairness and efficiency in cloud environments by preventing job starvation.

The lab consists of two complementary components:

| Component | Tech | Purpose |
|-----------|------|---------|
| `cloudsim-scheduler/` | Java 11 · CloudSim Plus · Maven | Simulates AWP scheduling across VMs in a datacenter |
| `awp-visualizer/` | React · Vite | Interactive browser visualization of AWP priority scores over time |

---

## The AWP Algorithm

Traditional priority schedulers favor short jobs, which can cause large jobs to wait indefinitely (**starvation**). AWP solves this with an aging mechanism:

```
Priority Score = α × (1 / jobLength) + β × waitingTime
```

| Symbol | Parameter | Default | Effect |
|--------|-----------|---------|--------|
| α | `SIZE_WEIGHT` | 0.4 | Smaller jobs start with higher priority |
| β | `AGING_WEIGHT` | 0.6 | Waiting jobs gain priority over time |

**Key properties:**
- A newly arrived small job beats a newly arrived large job (α effect)
- A large job that has waited long enough eventually overtakes small jobs (β effect)
- As `waitingTime → ∞`, every job's score → ∞ — mathematically **guarantees no starvation**
- Priority is re-evaluated every scheduling interval

**Example from the simulation:**

```
Job C1: length=10000 MI, arrives at t=0.5s   (large, arrives early)
Job C7: length=2000  MI, arrives at t=3.5s   (small, arrives late)

At t=0 (fresh queue):
  Score(C1) = 0.4 × (1/10000) + 0.6 × 0   = 0.00004   ← C7 would win on size
  Score(C7) = 0.4 × (1/2000)  + 0.6 × 0   = 0.0002

At t=5s (C1 has been waiting 4.5s):
  Score(C1) = 0.4 × (1/10000) + 0.6 × 4.5 = 2.70004   ← C1 regains priority via aging
  Score(C7) = 0.4 × (1/2000)  + 0.6 × 1.5 = 0.9002
```

---

## Project Structure

```
Cloud-Lab/
├── AWPVisualizer.jsx              # Standalone React component (single-file copy)
├── DynamicPriorityScheduler.java  # Standalone Java source (single-file copy)
│
├── awp-visualizer/                # React + Vite web application
│   ├── src/
│   │   ├── AWPVisualizer.jsx      # Main visualizer component
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── index.css
│   ├── public/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
└── cloudsim-scheduler/            # Java CloudSim Plus simulation
    ├── src/main/java/org/cloudbus/cloudsim/examples/
    │   └── DynamicPriorityScheduler.java
    ├── pom.xml
    └── run.cmd
```

---

## CloudSim Scheduler

### What it simulates

- **3 hosts**, each with 4 Processing Elements (PEs) at 1000 MIPS
- **6 Virtual Machines**, each with 2 PEs at 500 MIPS
- **12 cloudlets** (tasks) with mixed sizes and staggered arrival times
- **Load balancing** — each task is assigned to the least-loaded VM
- **Starvation check** — reports whether any job waited excessively

### Requirements

- Java 11 or higher
- Maven 3.6+ (or use the included `run.cmd` which uses a bundled Maven)

### Run

**Windows (using included run script):**
```cmd
cd cloudsim-scheduler
run.cmd
```

**Linux / macOS (using system Maven):**
```bash
cd cloudsim-scheduler
mvn compile exec:java -Dexec.mainClass=org.cloudbus.cloudsim.examples.DynamicPriorityScheduler
```

### Sample Output

```
╔══════════════════════════════════════════════════════╗
║     DYNAMIC PRIORITY SCHEDULER — CloudSim Plus       ║
║     Algorithm: Aging-Weighted Priority (AWP)         ║
╚══════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────┐
│  AWP PRIORITY ORDER (initial scheduling decision)    │
├────┬──────────────┬────────────┬───────────┬────────┤
│ ID │  Length (MI) │  Wait (s)  │ AWP Score │  VM   │
├────┼──────────────┼────────────┼───────────┼────────┤
│ C9 │          500 │        4.5 │    2.7008 │  VM-0 │
│ C5 │         1000 │        2.5 │    1.5004 │  VM-1 │
...

┌─────────────────────────────────────────────────────┐
│            PERFORMANCE SUMMARY                       │
├─────────────────────────────────────────────────────┤
│  Total Cloudlets Completed : 12                      │
│  Average Execution Time    : 14.20                   │
│  Average Waiting Time      : 2.34                    │
│  Max Waiting Time (any job): 8.50                    │
│  Algorithm : Aging-Weighted Priority (AWP)           │
│  α (size weight)  = 0.4                              │
│  β (aging weight) = 0.6                              │
└─────────────────────────────────────────────────────┘

✔ Starvation Check: Max wait time = 8.50
  ✅ PASS — No job waited excessively. AWP aging prevented starvation.
```

---

## AWP Visualizer

An interactive React application that animates the AWP algorithm in real time. Watch priority scores evolve as the simulation clock ticks and see exactly how aging lifts long-waiting jobs above newly arrived small ones.

### Features

- **Live simulation clock** — play/pause/reset the time axis
- **Dynamic priority bars** — scores update every 0.5s as jobs age
- **Color-coded jobs** — green (tiny) → yellow (medium) → red (very large)
- **VM assignment display** — see which VM each job is routed to
- **Add custom jobs** — inject a new job mid-simulation and watch AWP react

### Requirements

- Node.js 18+
- npm

### Run

```bash
cd awp-visualizer
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
npm run build
```

---

## How the Two Parts Connect

The Java simulation and the React visualizer implement the **exact same algorithm** with the same weights (α = 0.4, β = 0.6) and the same 12-job dataset. The visualizer is a teaching tool — it lets you see what the scheduler is doing at each moment that the Java simulation computes numerically.

---

## Dependencies

| Project | Dependency | Version |
|---------|-----------|---------|
| cloudsim-scheduler | [CloudSim Plus](https://github.com/manoelcampos/cloudsim-plus) | 8.0.0 |
| awp-visualizer | [React](https://react.dev) | 19.x |
| awp-visualizer | [Vite](https://vitejs.dev) | 6.x |

---

## Author

**Md Abu Saeed** && **Khairul ISlam Robi**
