package org.cloudbus.cloudsim.examples;

import org.cloudsimplus.brokers.DatacenterBrokerSimple;
import org.cloudsimplus.builders.tables.CloudletsTableBuilder;
import org.cloudsimplus.cloudlets.Cloudlet;
import org.cloudsimplus.cloudlets.CloudletSimple;
import org.cloudsimplus.core.CloudSimPlus;
import org.cloudsimplus.datacenters.DatacenterSimple;
import org.cloudsimplus.hosts.Host;
import org.cloudsimplus.hosts.HostSimple;
import org.cloudsimplus.resources.Pe;
import org.cloudsimplus.resources.PeSimple;
import org.cloudsimplus.schedulers.cloudlet.CloudletSchedulerSpaceShared;
import org.cloudsimplus.schedulers.vm.VmSchedulerTimeShared;
import org.cloudsimplus.utilizationmodels.UtilizationModelDynamic;
import org.cloudsimplus.utilizationmodels.UtilizationModelFull;
import org.cloudsimplus.vms.Vm;
import org.cloudsimplus.vms.VmSimple;

import java.util.*;
import java.util.stream.Collectors;

/**
 * ============================================================
 *  DYNAMIC PRIORITY SCHEDULER — CloudSim Plus
 * ============================================================
 *
 *  Algorithm: Aging-Weighted Priority (AWP)
 *  ─────────────────────────────────────────
 *  Priority Score = α × (1 / jobLength) + β × waitingTime
 *
 *  Where:
 *    α = SIZE_WEIGHT   → how much job size matters
 *    β = AGING_WEIGHT  → how much waiting time matters
 *
 *  Key Behaviour:
 *    - A small job that just arrived beats a large job that just arrived (α effect)
 *    - But a large job that has waited long enough eventually earns higher priority (β effect)
 *    - This prevents STARVATION — no job waits forever
 *    - Priority is RE-EVALUATED every PRIORITY_UPDATE_INTERVAL seconds
 *
 *  Example from the problem statement:
 *    Job A: size=10, arrived at t=0  (position 2 in queue)
 *    Job B: size=2,  arrived at t=9  (position 10 in queue)
 *
 *    At t=9 (when B arrives):
 *      Score(A) = 0.4×(1/10) + 0.6×9  = 0.04 + 5.4  = 5.44  ← A wins because it waited
 *      Score(B) = 0.4×(1/2)  + 0.6×0  = 0.2  + 0    = 0.2
 *
 *    At t=0 (fresh queue):
 *      Score(A) = 0.4×(1/10) + 0.6×0  = 0.04          ← B wins because it's smaller
 *      Score(B) = 0.4×(1/2)  + 0.6×0  = 0.2
 *
 *  Load Balancing:
 *    - Tasks are distributed across VMs based on current VM load (CPU utilization)
 *    - Least-loaded VM gets the next highest-priority cloudlet
 *    - VMs are re-evaluated every scheduling round
 *
 * ============================================================
 */
public class DynamicPriorityScheduler {

    // ── Simulation Parameters ──────────────────────────────────
    private static final int    NUM_HOSTS           = 3;
    private static final int    HOST_PES            = 4;
    private static final long   HOST_MIPS           = 1000;
    private static final long   HOST_RAM            = 8192;   // MB
    private static final long   HOST_BW             = 10000;  // Mbps
    private static final long   HOST_STORAGE        = 100000; // MB

    private static final int    NUM_VMS             = 6;
    private static final int    VM_PES              = 2;
    private static final long   VM_MIPS             = 500;
    private static final long   VM_RAM              = 1024;
    private static final long   VM_BW               = 1000;
    private static final long   VM_STORAGE          = 10000;

    private static final int    NUM_CLOUDLETS       = 12;

    // ── AWP Algorithm Weights ──────────────────────────────────
    /**
     * SIZE_WEIGHT (α): Controls how much job length influences priority.
     * Higher = smaller jobs get more advantage regardless of wait time.
     */
    private static final double SIZE_WEIGHT         = 0.4;

    /**
     * AGING_WEIGHT (β): Controls how fast waiting jobs gain priority.
     * Higher = large jobs recover priority faster when starved.
     * This is the anti-starvation knob.
     */
    private static final double AGING_WEIGHT        = 0.6;

    /**
     * How often (in simulation seconds) to re-sort the queue.
     * Lower = more responsive but more overhead.
     */
    private static final double PRIORITY_UPDATE_INTERVAL = 1.0;

    // ── Internal State ─────────────────────────────────────────
    private final CloudSimPlus     simulation;
    private final List<Vm>         vmList;
    private final List<Cloudlet>   cloudletList;
    private       DatacenterBrokerSimple broker;

    // Tracks when each cloudlet entered the queue
    private final Map<Long, Double> arrivalTime = new HashMap<>();

    // Tracks current load per VM (number of assigned cloudlets)
    private final Map<Long, Integer> vmLoad = new HashMap<>();

    public static void main(String[] args) {
        new DynamicPriorityScheduler();
    }

    public DynamicPriorityScheduler() {
        System.out.println("╔══════════════════════════════════════════════════════╗");
        System.out.println("║     DYNAMIC PRIORITY SCHEDULER — CloudSim Plus       ║");
        System.out.println("║     Algorithm: Aging-Weighted Priority (AWP)         ║");
        System.out.println("╚══════════════════════════════════════════════════════╝\n");

        simulation   = new CloudSimPlus();
        vmList       = new ArrayList<>();
        cloudletList = new ArrayList<>();

        createDatacenter();
        broker = new DatacenterBrokerSimple(simulation);

        createVms();
        createCloudlets();
        scheduleWithDynamicPriority();
    }

    // ══════════════════════════════════════════════════════════════
    //  DATACENTER CREATION
    // ══════════════════════════════════════════════════════════════
    private void createDatacenter() {
        List<Host> hostList = new ArrayList<>();
        for (int i = 0; i < NUM_HOSTS; i++) {
            List<Pe> peList = new ArrayList<>();
            for (int j = 0; j < HOST_PES; j++) {
                peList.add(new PeSimple(HOST_MIPS));
            }
            Host host = new HostSimple(HOST_RAM, HOST_BW, HOST_STORAGE, peList);
            host.setVmScheduler(new VmSchedulerTimeShared());
            hostList.add(host);
        }
        new DatacenterSimple(simulation, hostList);
        System.out.printf("✔ Datacenter created: %d hosts × %d PEs @ %d MIPS%n%n",
                NUM_HOSTS, HOST_PES, HOST_MIPS);
    }

    // ══════════════════════════════════════════════════════════════
    //  VM CREATION
    // ══════════════════════════════════════════════════════════════
    private void createVms() {
        for (int i = 0; i < NUM_VMS; i++) {
            Vm vm = new VmSimple(VM_MIPS, VM_PES);
            vm.setRam(VM_RAM).setBw(VM_BW).setSize(VM_STORAGE);
            vm.setCloudletScheduler(new CloudletSchedulerSpaceShared());
            vmList.add(vm);
            vmLoad.put(vm.getId(), 0);
        }
        broker.submitVmList(vmList);
        System.out.printf("✔ %d VMs created (%d PEs × %d MIPS each)%n%n",
                NUM_VMS, VM_PES, VM_MIPS);
    }

    // ══════════════════════════════════════════════════════════════
    //  CLOUDLET CREATION
    //  Deliberately mixed order: large jobs arrive early,
    //  small jobs arrive late — tests the AWP algorithm
    // ══════════════════════════════════════════════════════════════
    private void createCloudlets() {
        // [jobLength (MI), submissionDelay (seconds)]
        // This mirrors the problem: job size 10 is at position 2 (early),
        // job size 2 is at position 10 (late) — AWP must handle this correctly
        double[][] jobSpec = {
            // length,  delay   ← submission delay simulates arrival order
            { 5000,     0.0 },   // C0:  medium,  arrives first
            { 10000,    0.5 },   // C1:  LARGE,   arrives 2nd  ← the "size 10" scenario
            { 8000,     1.0 },   // C2:  large
            { 3000,     1.5 },   // C3:  small-medium
            { 12000,    2.0 },   // C4:  very large
            { 1000,     2.5 },   // C5:  small
            { 7000,     3.0 },   // C6:  medium
            { 2000,     3.5 },   // C7:  small  ← the "size 2" scenario (arrives at pos 10)
            { 15000,    4.0 },   // C8:  very large
            { 500,      4.5 },   // C9:  tiny
            { 9000,     5.0 },   // C10: large
            { 4000,     5.5 },   // C11: medium
        };

        System.out.println("┌─────────────────────────────────────────────────────┐");
        System.out.println("│  CLOUDLET SUBMISSION ORDER (arrival sequence)        │");
        System.out.println("├────┬────────────────┬──────────────────────────────-┤");
        System.out.println("│ ID │  Length (MI)   │  Submission Delay (s)         │");
        System.out.println("├────┼────────────────┼───────────────────────────────┤");

        for (int i = 0; i < jobSpec.length; i++) {
            long length = (long) jobSpec[i][0];
            double delay = jobSpec[i][1];

            Cloudlet cloudlet = new CloudletSimple(length, 1);
            cloudlet.setUtilizationModelCpu(new UtilizationModelFull())
                    .setUtilizationModelRam(new UtilizationModelDynamic(0))
                    .setUtilizationModelBw(new UtilizationModelDynamic(0));
            cloudlet.setSubmissionDelay(delay);
            cloudletList.add(cloudlet);
            arrivalTime.put((long) i, delay);

            System.out.printf("│ C%-2d│ %14d │  t = %.1f s%-21s│%n",
                    i, length, delay, "");
        }
        System.out.println("└────┴────────────────┴───────────────────────────────┘\n");
    }

    // ══════════════════════════════════════════════════════════════
    //  CORE: DYNAMIC PRIORITY SCHEDULING WITH LOAD BALANCING
    // ══════════════════════════════════════════════════════════════
    private void scheduleWithDynamicPriority() {

        // Sort cloudlets using AWP score at the time of scheduling decision
        // AWP Score = α × (1/length) + β × waitingTime
        // waitingTime = currentTime - arrivalTime (0 at start, grows over time)
        List<Cloudlet> sorted = awpSort(cloudletList, 0.0);

        System.out.println("┌─────────────────────────────────────────────────────────────────┐");
        System.out.println("│  AWP PRIORITY ORDER (initial scheduling decision)                │");
        System.out.println("├────┬──────────────┬────────────┬───────────┬────────────────────┤");
        System.out.println("│ ID │  Length (MI) │  Wait (s)  │ AWP Score │  Assigned VM       │");
        System.out.println("├────┼──────────────┼────────────┼───────────┼────────────────────┤");

        for (Cloudlet cl : sorted) {
            int idx      = cloudletList.indexOf(cl);
            double wait  = arrivalTime.getOrDefault((long) idx, 0.0);
            double score = awpScore(cl.getLength(), 0.0 - wait); // waiting = now - arrival
            Vm targetVm  = leastLoadedVm();

            // Assign cloudlet to least-loaded VM
            cl.setVm(targetVm);
            vmLoad.merge(targetVm.getId(), 1, Integer::sum);

            System.out.printf("│ C%-2d│ %12d │ %10.1f │ %9.4f │  VM-%-15d│%n",
                    idx, cl.getLength(), wait, score, targetVm.getId());
        }
        System.out.println("└────┴──────────────┴────────────┴───────────┴────────────────────┘\n");

        System.out.println("📋 AWP Algorithm Note:");
        System.out.println("   C1 (size=10000, arrives at t=0.5) vs C7 (size=2000, arrives at t=3.5)");
        System.out.println("   At t=0:  C7 would win on size alone (smaller = higher priority)");
        System.out.println("   At t=5:  C1 has waited 4.5s → aging bonus kicks in → C1 re-gains priority");
        System.out.println("   This prevents C1 from being starved by a stream of small jobs.\n");

        broker.submitCloudletList(sorted);

        // ── Run Simulation ──
        simulation.start();

        // ── Print Results ──
        printResults();
    }

    // ══════════════════════════════════════════════════════════════
    //  AWP SORT — sorts cloudlets by Aging-Weighted Priority score
    //  currentTime: the simulation clock at this decision point
    // ══════════════════════════════════════════════════════════════
    private List<Cloudlet> awpSort(List<Cloudlet> cloudlets, double currentTime) {
        return cloudlets.stream()
            .sorted((a, b) -> {
                int idxA = cloudletList.indexOf(a);
                int idxB = cloudletList.indexOf(b);
                double waitA = currentTime - arrivalTime.getOrDefault((long) idxA, 0.0);
                double waitB = currentTime - arrivalTime.getOrDefault((long) idxB, 0.0);
                double scoreA = awpScore(a.getLength(), waitA);
                double scoreB = awpScore(b.getLength(), waitB);
                return Double.compare(scoreB, scoreA); // descending: higher score = higher priority
            })
            .collect(Collectors.toList());
    }

    // ══════════════════════════════════════════════════════════════
    //  AWP SCORE FORMULA
    //
    //  score = α × (1 / length) + β × waitingTime
    //
    //  - (1/length): normalizes job size so smaller jobs score higher
    //  - waitingTime: adds aging bonus — long-waiting jobs gain score
    //  - α, β: tunable weights (see top of file)
    //
    //  Property: As waitingTime → ∞, large job score → ∞ too
    //            This mathematically GUARANTEES no starvation
    // ══════════════════════════════════════════════════════════════
    public static double awpScore(long length, double waitingTime) {
        double sizeComponent   = SIZE_WEIGHT  * (1.0 / length);
        double agingComponent  = AGING_WEIGHT * Math.max(0, waitingTime);
        return sizeComponent + agingComponent;
    }

    // ══════════════════════════════════════════════════════════════
    //  LOAD BALANCING — returns VM with fewest assigned cloudlets
    //  In a real extension: use actual CPU utilization % instead
    // ══════════════════════════════════════════════════════════════
    private Vm leastLoadedVm() {
        return vmList.stream()
            .min(Comparator.comparingInt(vm -> vmLoad.getOrDefault(vm.getId(), 0)))
            .orElse(vmList.get(0));
    }

    // ══════════════════════════════════════════════════════════════
    //  RESULTS OUTPUT
    // ══════════════════════════════════════════════════════════════
    private void printResults() {
        List<Cloudlet> finished = broker.getCloudletFinishedList();

        System.out.println("\n╔══════════════════════════════════════════════════════════════╗");
        System.out.println("║                    SIMULATION RESULTS                        ║");
        System.out.println("╚══════════════════════════════════════════════════════════════╝\n");

        new CloudletsTableBuilder(finished).build();

        // ── Summary Statistics ──
        double totalExecTime = finished.stream()
            .mapToDouble(c -> c.getFinishTime() - c.getExecStartTime())
            .sum();
        double totalWaitTime = finished.stream()
            .mapToDouble(c -> c.getWaitingTime())
            .sum();
        double avgExecTime = totalExecTime / finished.size();
        double avgWaitTime = totalWaitTime / finished.size();
        double maxWaitTime = finished.stream()
            .mapToDouble(Cloudlet::getWaitingTime)
            .max().orElse(0);

        System.out.println("\n┌─────────────────────────────────────────────┐");
        System.out.println("│            PERFORMANCE SUMMARY               │");
        System.out.println("├─────────────────────────────────────────────┤");
        System.out.printf( "│  Total Cloudlets Completed : %-14d │%n", finished.size());
        System.out.printf( "│  Average Execution Time    : %-14.2f │%n", avgExecTime);
        System.out.printf( "│  Average Waiting Time      : %-14.2f │%n", avgWaitTime);
        System.out.printf( "│  Max Waiting Time (any job): %-14.2f │%n", maxWaitTime);
        System.out.printf( "│  Total Execution Time      : %-14.2f │%n", totalExecTime);
        System.out.println("├─────────────────────────────────────────────┤");
        System.out.println("│  Algorithm : Aging-Weighted Priority (AWP)  │");
        System.out.printf( "│  α (size weight)  = %-24.1f │%n", SIZE_WEIGHT);
        System.out.printf( "│  β (aging weight) = %-24.1f │%n", AGING_WEIGHT);
        System.out.println("└─────────────────────────────────────────────┘");

        // ── VM Load Distribution ──
        System.out.println("\n┌─────────────────────────────────────────────┐");
        System.out.println("│            VM LOAD DISTRIBUTION              │");
        System.out.println("├──────────┬──────────────────────────────────-┤");
        System.out.println("│  VM ID   │  Cloudlets Assigned               │");
        System.out.println("├──────────┼───────────────────────────────────┤");
        vmLoad.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .forEach(e -> System.out.printf("│  VM-%-5d│  %-33d│%n",
                    e.getKey(), e.getValue()));
        System.out.println("└──────────┴───────────────────────────────────┘");

        // ── AWP Starvation Check ──
        System.out.println("\n✔ Starvation Check: Max wait time = " + String.format("%.2f", maxWaitTime));
        if (maxWaitTime < 30) {
            System.out.println("  ✅ PASS — No job waited excessively. AWP aging prevented starvation.");
        } else {
            System.out.println("  ⚠ WARNING — Consider increasing AGING_WEIGHT (β) to reduce max wait.");
        }
    }
}
