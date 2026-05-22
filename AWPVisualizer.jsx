import { useState, useEffect, useRef } from "react";

// ── AWP Algorithm (mirrors Java implementation exactly) ──────────
const SIZE_WEIGHT  = 0.4;
const AGING_WEIGHT = 0.6;

function awpScore(length, waitingTime) {
  return SIZE_WEIGHT * (1.0 / length) + AGING_WEIGHT * Math.max(0, waitingTime);
}

// ── Initial job set (mirrors Java jobSpec) ───────────────────────
const INITIAL_JOBS = [
  { id: "C0",  length: 5000,  arrival: 0.0 },
  { id: "C1",  length: 10000, arrival: 0.5 },  // large, arrives early
  { id: "C2",  length: 8000,  arrival: 1.0 },
  { id: "C3",  length: 3000,  arrival: 1.5 },
  { id: "C4",  length: 12000, arrival: 2.0 },
  { id: "C5",  length: 1000,  arrival: 2.5 },
  { id: "C6",  length: 7000,  arrival: 3.0 },
  { id: "C7",  length: 2000,  arrival: 3.5 },  // small, arrives late
  { id: "C8",  length: 15000, arrival: 4.0 },
  { id: "C9",  length: 500,   arrival: 4.5 },
  { id: "C10", length: 9000,  arrival: 5.0 },
  { id: "C11", length: 4000,  arrival: 5.5 },
];

const NUM_VMS = 6;

function getLengthColor(length) {
  if (length <= 1000)  return "#34d399";
  if (length <= 3000)  return "#6ee7b7";
  if (length <= 6000)  return "#fbbf24";
  if (length <= 10000) return "#f97316";
  return "#ef4444";
}

function getScoreColor(score) {
  if (score > 1)    return "#34d399";
  if (score > 0.3)  return "#fbbf24";
  if (score > 0.1)  return "#f97316";
  return "#94a3b8";
}

export default function AWPVisualizer() {
  const [time, setTime]         = useState(0);
  const [playing, setPlaying]   = useState(false);
  const [jobs, setJobs]         = useState(INITIAL_JOBS);
  const [newJob, setNewJob]     = useState({ length: 6000, arrival: 3.0 });
  const [highlight, setHighlight] = useState(null);
  const intervalRef             = useRef(null);

  // ── Tick simulation clock ────────────────────────────────────
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setTime(t => {
          if (t >= 12) { setPlaying(false); return t; }
          return parseFloat((t + 0.5).toFixed(1));
        });
      }, 600);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing]);

  // ── Jobs visible at current time ────────────────────────────
  const visibleJobs = jobs.filter(j => j.arrival <= time);

  // ── Score each visible job ───────────────────────────────────
  const scoredJobs = visibleJobs.map(j => ({
    ...j,
    waitingTime: Math.max(0, time - j.arrival),
    score: awpScore(j.length, Math.max(0, time - j.arrival)),
  })).sort((a, b) => b.score - a.score);

  // ── Load balance: round-robin across VMs ────────────────────
  const vmAssignments = Array.from({ length: NUM_VMS }, () => []);
  scoredJobs.forEach((job, i) => {
    vmAssignments[i % NUM_VMS].push(job);
  });

  const reset = () => { setTime(0); setPlaying(false); };

  const addJob = () => {
    const id = `C${jobs.length}`;
    setJobs(prev => [...prev, { id, length: newJob.length, arrival: newJob.arrival }]);
  };

  const maxScore = scoredJobs.length ? scoredJobs[0].score : 1;

  return (
    <div style={{
      background: "#0a0f1e",
      minHeight: "100vh",
      color: "#e2e8f0",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      padding: "24px",
      boxSizing: "border-box",
    }}>

      {/* ── Header ── */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{
          display: "inline-block",
          background: "linear-gradient(135deg, #1e3a5f, #0f2744)",
          border: "1px solid #2563eb44",
          borderRadius: 12,
          padding: "16px 32px",
          boxShadow: "0 0 40px #2563eb22",
        }}>
          <div style={{ fontSize: 11, color: "#60a5fa", letterSpacing: 4, marginBottom: 4 }}>
            CLOUDSIM PLUS
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>
            Aging-Weighted Priority Scheduler
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            score = α × (1/length) + β × waitTime &nbsp;|&nbsp; α={SIZE_WEIGHT} &nbsp; β={AGING_WEIGHT}
          </div>
        </div>
      </div>

      {/* ── Time Control ── */}
      <div style={{
        background: "#111827",
        border: "1px solid #1e3a5f",
        borderRadius: 10,
        padding: "14px 20px",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setPlaying(p => !p)} style={{
            background: playing ? "#7f1d1d" : "#1e3a5f",
            border: "1px solid " + (playing ? "#ef4444" : "#3b82f6"),
            color: playing ? "#fca5a5" : "#93c5fd",
            borderRadius: 6, padding: "6px 18px", cursor: "pointer",
            fontSize: 12, fontFamily: "inherit",
          }}>
            {playing ? "⏸ PAUSE" : "▶ PLAY"}
          </button>
          <button onClick={reset} style={{
            background: "#1f2937", border: "1px solid #374151",
            color: "#9ca3af", borderRadius: 6, padding: "6px 14px",
            cursor: "pointer", fontSize: 12, fontFamily: "inherit",
          }}>
            ↺ RESET
          </button>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input type="range" min={0} max={12} step={0.5} value={time}
            onChange={e => setTime(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#3b82f6" }} />
        </div>
        <div style={{
          background: "#0f2744", border: "1px solid #2563eb",
          borderRadius: 6, padding: "4px 14px",
          color: "#60a5fa", fontSize: 18, fontWeight: 700, minWidth: 80,
          textAlign: "center",
        }}>
          t = {time.toFixed(1)}s
        </div>
        <div style={{ color: "#64748b", fontSize: 11 }}>
          {visibleJobs.length}/{jobs.length} jobs in queue
        </div>
      </div>

      {/* ── Main Grid: Priority Queue + VM Assignment ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* Priority Queue */}
        <div style={{
          background: "#111827",
          border: "1px solid #1e3a5f",
          borderRadius: 10, padding: 16,
        }}>
          <div style={{ color: "#60a5fa", fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
            ◈ AWP PRIORITY QUEUE
          </div>
          {scoredJobs.length === 0 && (
            <div style={{ color: "#374151", textAlign: "center", padding: 24, fontSize: 12 }}>
              No jobs arrived yet — advance time
            </div>
          )}
          {scoredJobs.map((job, rank) => {
            const barWidth = maxScore > 0 ? (job.score / maxScore) * 100 : 0;
            const isTop    = rank === 0;
            return (
              <div key={job.id}
                onMouseEnter={() => setHighlight(job.id)}
                onMouseLeave={() => setHighlight(null)}
                style={{
                  marginBottom: 8,
                  background: highlight === job.id ? "#1e3a5f33" : isTop ? "#0f2744" : "#0d1117",
                  border: `1px solid ${isTop ? "#2563eb" : "#1e293b"}`,
                  borderRadius: 8, padding: "10px 12px",
                  transition: "all 0.2s",
                  cursor: "pointer",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      background: isTop ? "#1d4ed8" : "#1e293b",
                      color: isTop ? "#93c5fd" : "#64748b",
                      borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700,
                    }}>
                      #{rank + 1}
                    </span>
                    <span style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600 }}>{job.id}</span>
                    {isTop && <span style={{ color: "#fbbf24", fontSize: 10 }}>▲ NEXT</span>}
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#94a3b8" }}>
                    <span>len: <span style={{ color: getLengthColor(job.length) }}>{job.length.toLocaleString()}</span></span>
                    <span>wait: <span style={{ color: "#a78bfa" }}>{job.waitingTime.toFixed(1)}s</span></span>
                    <span style={{ color: getScoreColor(job.score), fontWeight: 700 }}>
                      ★ {job.score.toFixed(4)}
                    </span>
                  </div>
                </div>
                {/* Score bar */}
                <div style={{ height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${barWidth}%`,
                    background: isTop
                      ? "linear-gradient(90deg, #2563eb, #60a5fa)"
                      : "linear-gradient(90deg, #374151, #4b5563)",
                    borderRadius: 2,
                    transition: "width 0.4s ease",
                  }} />
                </div>
                {/* Score breakdown */}
                <div style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 10, color: "#475569" }}>
                  <span>α×(1/len) = {(SIZE_WEIGHT / job.length).toFixed(5)}</span>
                  <span>β×wait = {(AGING_WEIGHT * job.waitingTime).toFixed(4)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* VM Load Balancer */}
        <div style={{
          background: "#111827",
          border: "1px solid #1e3a5f",
          borderRadius: 10, padding: 16,
        }}>
          <div style={{ color: "#34d399", fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
            ◈ VM LOAD BALANCER ({NUM_VMS} VMs)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {vmAssignments.map((assigned, vmIdx) => (
              <div key={vmIdx} style={{
                background: "#0d1117",
                border: `1px solid ${assigned.length > 0 ? "#065f46" : "#1e293b"}`,
                borderRadius: 8, padding: 10, minHeight: 90,
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 6,
                }}>
                  <span style={{ color: "#34d399", fontSize: 11, fontWeight: 700 }}>VM-{vmIdx}</span>
                  <span style={{
                    background: assigned.length ? "#065f46" : "#1e293b",
                    color: assigned.length ? "#6ee7b7" : "#374151",
                    borderRadius: 3, padding: "1px 6px", fontSize: 10,
                  }}>
                    {assigned.length} job{assigned.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {/* CPU bar */}
                <div style={{ height: 3, background: "#1e293b", borderRadius: 2, marginBottom: 8 }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, (assigned.length / 3) * 100)}%`,
                    background: assigned.length > 2
                      ? "linear-gradient(90deg, #dc2626, #ef4444)"
                      : "linear-gradient(90deg, #059669, #34d399)",
                    borderRadius: 2, transition: "width 0.4s ease",
                  }} />
                </div>
                {assigned.map(j => (
                  <div key={j.id} style={{
                    fontSize: 10, color: "#94a3b8",
                    background: highlight === j.id ? "#1e3a5f44" : "transparent",
                    borderRadius: 3, padding: "2px 4px",
                  }}>
                    {j.id} <span style={{ color: getLengthColor(j.length) }}>({j.length.toLocaleString()})</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Load balance stats */}
          <div style={{
            marginTop: 12, padding: "8px 12px",
            background: "#0d1117", borderRadius: 6,
            border: "1px solid #1e293b",
            fontSize: 11, color: "#64748b",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Max VM load: <span style={{ color: "#f1f5f9" }}>
                {Math.max(...vmAssignments.map(a => a.length))} jobs
              </span></span>
              <span>Min VM load: <span style={{ color: "#f1f5f9" }}>
                {visibleJobs.length ? Math.min(...vmAssignments.map(a => a.length)) : 0} jobs
              </span></span>
              <span>Balance: <span style={{ color: "#34d399" }}>Round-Robin</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Algorithm Explainer ── */}
      <div style={{
        background: "#0d1117",
        border: "1px solid #1e293b",
        borderRadius: 10, padding: 16, marginBottom: 20,
      }}>
        <div style={{ color: "#f59e0b", fontSize: 11, letterSpacing: 3, marginBottom: 10 }}>
          ◈ LIVE ALGORITHM TRACE
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* C1 vs C7 scenario */}
          <div style={{
            background: "#111827", borderRadius: 8, padding: 12,
            border: "1px solid #292524",
          }}>
            <div style={{ color: "#fbbf24", fontSize: 11, marginBottom: 8, fontWeight: 600 }}>
              Scenario: C1 (size=10000, t=0.5) vs C7 (size=2000, t=3.5)
            </div>
            {["C1", "C7"].map(cid => {
              const job = jobs.find(j => j.id === cid);
              if (!job || job.arrival > time) return (
                <div key={cid} style={{ color: "#374151", fontSize: 11, marginBottom: 4 }}>
                  {cid}: not arrived yet
                </div>
              );
              const wait  = Math.max(0, time - job.arrival);
              const score = awpScore(job.length, wait);
              const sizeC = SIZE_WEIGHT / job.length;
              const ageC  = AGING_WEIGHT * wait;
              return (
                <div key={cid} style={{ marginBottom: 8 }}>
                  <div style={{ color: "#f1f5f9", fontSize: 12, marginBottom: 2 }}>
                    <span style={{ color: "#60a5fa" }}>{cid}</span>
                    {" "}len={job.length.toLocaleString()} wait={wait.toFixed(1)}s
                  </div>
                  <div style={{ color: "#64748b", fontSize: 10 }}>
                    = {SIZE_WEIGHT}×(1/{job.length}) + {AGING_WEIGHT}×{wait.toFixed(1)}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 10 }}>
                    = {sizeC.toFixed(5)} + {ageC.toFixed(4)}
                    {" "}= <span style={{ color: getScoreColor(score), fontWeight: 700 }}>{score.toFixed(4)}</span>
                  </div>
                </div>
              );
            })}
            {(() => {
              const c1 = jobs.find(j => j.id === "C1");
              const c7 = jobs.find(j => j.id === "C7");
              if (!c1 || !c7 || c1.arrival > time || c7.arrival > time) return null;
              const s1 = awpScore(c1.length, Math.max(0, time - c1.arrival));
              const s7 = awpScore(c7.length, Math.max(0, time - c7.arrival));
              const winner = s1 > s7 ? "C1 (large, waited longer)" : "C7 (smaller job)";
              return (
                <div style={{
                  background: "#0f2744", border: "1px solid #2563eb",
                  borderRadius: 6, padding: "6px 10px", marginTop: 4,
                  fontSize: 11, color: "#93c5fd",
                }}>
                  → Higher priority: <strong>{winner}</strong>
                </div>
              );
            })()}
          </div>

          {/* Anti-starvation explanation */}
          <div style={{
            background: "#111827", borderRadius: 8, padding: 12,
            border: "1px solid #292524",
          }}>
            <div style={{ color: "#a78bfa", fontSize: 11, marginBottom: 8, fontWeight: 600 }}>
              Anti-Starvation: How aging protects large jobs
            </div>
            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.7 }}>
              <div>• Small job (len=500) at t=0:</div>
              <div style={{ color: "#34d399", paddingLeft: 12 }}>
                score = 0.4×(1/500) + 0 = <strong>0.0008</strong>
              </div>
              <div style={{ marginTop: 6 }}>• Large job (len=10000) at t=0:</div>
              <div style={{ color: "#f97316", paddingLeft: 12 }}>
                score = 0.4×(1/10000) + 0 = <strong>0.00004</strong>
              </div>
              <div style={{ marginTop: 6 }}>• Same large job after 5s wait:</div>
              <div style={{ color: "#60a5fa", paddingLeft: 12 }}>
                score = 0.00004 + 0.6×5 = <strong>3.00004</strong> ✅
              </div>
              <div style={{
                color: "#a78bfa", marginTop: 8, fontSize: 10,
                borderTop: "1px solid #1e293b", paddingTop: 6,
              }}>
                Aging bonus grows linearly → large jobs ALWAYS eventually win
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Custom Job ── */}
      <div style={{
        background: "#111827",
        border: "1px solid #1e3a5f",
        borderRadius: 10, padding: 16,
      }}>
        <div style={{ color: "#60a5fa", fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
          ◈ ADD CUSTOM JOB
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 10, marginBottom: 4 }}>JOB LENGTH (MI)</div>
            <input type="number" value={newJob.length} min={100} max={20000} step={100}
              onChange={e => setNewJob(j => ({ ...j, length: parseInt(e.target.value) || 1000 }))}
              style={{
                background: "#0d1117", border: "1px solid #1e3a5f",
                color: "#f1f5f9", borderRadius: 6, padding: "6px 12px",
                fontSize: 12, fontFamily: "inherit", width: 120,
              }} />
          </div>
          <div>
            <div style={{ color: "#64748b", fontSize: 10, marginBottom: 4 }}>ARRIVAL TIME (s)</div>
            <input type="number" value={newJob.arrival} min={0} max={12} step={0.5}
              onChange={e => setNewJob(j => ({ ...j, arrival: parseFloat(e.target.value) || 0 }))}
              style={{
                background: "#0d1117", border: "1px solid #1e3a5f",
                color: "#f1f5f9", borderRadius: 6, padding: "6px 12px",
                fontSize: 12, fontFamily: "inherit", width: 120,
              }} />
          </div>
          <button onClick={addJob} style={{
            background: "#1e3a5f", border: "1px solid #3b82f6",
            color: "#93c5fd", borderRadius: 6, padding: "7px 20px",
            cursor: "pointer", fontSize: 12, fontFamily: "inherit",
          }}>
            + ADD JOB
          </button>
          <div style={{ fontSize: 11, color: "#475569" }}>
            Preview score at t={time.toFixed(1)}:&nbsp;
            <span style={{ color: getScoreColor(awpScore(newJob.length, Math.max(0, time - newJob.arrival))) }}>
              {newJob.arrival <= time
                ? awpScore(newJob.length, Math.max(0, time - newJob.arrival)).toFixed(4)
                : "not arrived"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        textAlign: "center", marginTop: 20,
        color: "#1e3a5f", fontSize: 10, letterSpacing: 2,
      }}>
        AWP SCHEDULER · CLOUDSIM PLUS · score = {SIZE_WEIGHT}×(1/len) + {AGING_WEIGHT}×wait
      </div>
    </div>
  );
}
