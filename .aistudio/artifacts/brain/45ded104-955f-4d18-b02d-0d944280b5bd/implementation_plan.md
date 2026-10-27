# IPMC-SimWeb: Web-Based Digital Twin for IPMC Soft Actuators

A scientific laboratory digital twin and control benchmarking platform for Ionic Polymer-Metal Composite (IPMC) soft actuators, modeling rate-independent Prandtl-Ishlinskii (PI) hysteresis, closed-form Krejci–Kuhnen inverse feedforward compensation, 2nd-order plant dynamics with velocity-dependent drag, and 4-way closed-loop control comparison with real-time cantilever deflection visualization.

> [!IMPORTANT]
> **User Review & Confirmed Decisions**
> - **Visual Aesthetic**: Clean scientific paper light mode with high-contrast monochrome (`#FFFFFF` paper canvas, slate hairline borders `#E2E8F0`, deep charcoal ink `#0F172A`, and cobalt/indigo precision accents `#2563EB`).
> - **Actuator Visualization**: "Both" selected — Full suite of analytical high-resolution engineering plots coupled with an interactive live 2D deflection cantilever animation of the physical IPMC beam with electro-osmotic ionic gradient visualization.
> - **Benchmark Signal Suite**: Multi-signal generator supporting linear chirp (quasi-static default $0.02$–$0.08$ Hz), multi-sine, multi-level step response, and smoothed square wave reference trajectories.
> - **Identification & Simulation Engine**: Pure client-side high-precision TypeScript numerical engine mirroring the PRD v8.0 mathematical specifications (NNLS PI identification, Krejci-Kuhnen inverse with $w_1 \ge 10^{-3}$ singularity floor, continuous-to-discrete ZOH state-space plant with $f_{drag} = -B_{drag}\dot{x}$, anti-windup back-calculation, and saturation clipping at $\pm 2\text{ V}$).

---

## 1. Overview & Core Concept

Ionic Polymer-Metal Composite (IPMC) artificial muscles suffer from strong non-linear hysteresis, ionic back-relaxation, and hydrodynamic drag when actuated in wet or biomedical environments. **IPMC-SimWeb** provides NTHU Microdevice Fabrication and Integration Lab researchers with a web-based digital twin that:
1. **Identifies Parameters from Experimental CSV or Synthetic Benchmarks**: Sequentially fits the Prandtl-Ishlinskii Play operators using Non-Negative Least Squares (NNLS), normalizes weights ($\sum w_i = 1$) to decouple hysteresis gain from plant DC gain, and identifies 2nd-order electro-mechanical plant parameters ($K, \zeta, \omega_n$).
2. **Validates the Closed-Form Krejci–Kuhnen Inverse**: Verifies feedforward linearizing compensation with singularity flooring ($w_1 \ge 10^{-3}$) and computes post-transient tracking RMSE ($>0.5\text{ s}$).
3. **Simulates and Benchmarks 4 Control Architectures in Real-Time**:
   - **Open Loop**: Direct voltage excitation $V_{in} = u_{cmd}$.
   - **FF Only**: Model-based inverse feedforward $V_{in} = PI^{-1}(y_{desired} / K_{dc})$.
   - **FB Only**: PI feedback in normalized actuation domain $V_{in} = \mathrm{sat}(PI^{-1}(u_{fb}))$.
   - **Hybrid (Cascade Linearization)**: Synergistic feedforward + anti-windup feedback $V_{in} = \mathrm{sat}(PI^{-1}(y_{desired}/K_{dc} + u_{fb}))$.
4. **Visualizes Actuator Dynamics**: High-density interactive dual-axis and time-series plots plus an interactive 2D physics cantilever bending viewport depicting mechanical displacement, curvature, electrode surfaces, and internal cation distribution.

---

## 2. User Experience & Visual Design

### 2.1 Workspace Layout & Navigation
The application adheres to the **Science & Laboratory Console** pattern with a clean 3-zone header, workspace ribbon, and four dedicated tabs:
- **Top Bar Contract**:
  - *Zone 1*: Single wordmark `IPMC-SimWeb` with subtle laboratory credit (`NTHU Microdevice Lab`).
  - *Zone 2*: Tab switches: `01. System Identification`, `02. Inverse Validation`, `03. Simulation & Controllers`, `04. Metrics & Export`.
  - *Zone 3*: Primary action button: `Run Simulation` / `Run Benchmark`.

### 2.2 Tab-by-Tab Experience

#### Tab 1: System Identification
- **Input Data Panel**: File uploader for experimental CSV (`Time_s`, `Input_Voltage_V`, `Output_Displacement_mm`) with sample validation, NaN interpolation, and outlier filtering.
- **Synthetic Benchmark Generator**: One-click generator with customizable chirp frequency range ($f_0$ to $f_1$), amplitude ($2.0\text{ V}$), sample rate ($T_s = 10\text{ ms}$), duration ($10\text{ s}$), and Gaussian noise ($\sigma = 1\%$). Warning banner appears when $f_1 > 0.1\text{ Hz}$ alerting users to dynamic biasing.
- **Plot 1.1 — Hysteresis Loop**: Input Voltage (V) vs Output Displacement (mm) comparing experimental scatter points to the fitted PI model loop.
- **Plot 1.2 — Time-Domain Fit**: Time vs Displacement displaying measured signal alongside simulated Hammerstein cascade $G[PI(V)]$.
- **Plot 1.3 — Play Operator Weight Distribution**: Calibrated bar chart displaying normalized weights $w_i$ across threshold grid $r_i$, reporting $R^2$ fit metric.

#### Tab 2: Inverse Validation
- **Validation Test Console**: Evaluates the Krejci–Kuhnen inverse model $PI^{-1}$ against target trajectories.
- **Plot 2.1 — Domain Validation**: Target $y_{desired}(t)$ vs reconstructed $PI(u_{ff})(t)$ with first 50 samples ($0.5\text{ s}$) shaded gray to indicate Play operator state-initialization transient exclusion.
- **Plot 2.2 — Residual Error**: Time vs tracking error (mm) with $\pm 1\%$ tolerance bands.
- **Validation Scorecard**: Displays RMSE after transient, max residual error, and condition number check ($w_1 \ge 10^{-3}$, $w'_1 \le 1000$).

#### Tab 3: Simulation & Controller Comparison
- **Actuator Interactive Cantilever Stage**: Split viewport showing a 2D rendering of the IPMC beam fixed at the clamp ($x=0$) and deflecting at the tip ($x=L$). Visualizes real-time tip deflection, curvature, and electrode contact potential.
- **Controller Parameter Toolbar**: Sliders and numeric inputs for $K_p$, $K_i$, back-calculation tracking gain $K_t$ (or Clamping mode toggle), voltage saturation limit ($\pm 2\text{ V}$), hydrodynamic drag $B_{drag}$, and sensor noise $\sigma$.
- **Reference Trajectory Selector**: Presets for Quasi-Static Chirp, Multi-Sine, Multi-Step staircase, and Smoothed Square Wave.
- **Four-Strategy Multi-Chart Dashboard**:
  - *Plot 3.1 — Displacement Tracking*: Desired reference vs Open Loop, FF Only, FB Only, and Hybrid.
  - *Plot 3.2 — Tracking Error*: Error traces ($e(t) = y_{des} - y$) for all 4 strategies.
  - *Plot 3.3 — Control Voltage & Saturation*: Command voltage traces showing saturation boundaries at $\pm 2\text{ V}$.
  - *Plot 3.4 — Drag Disturbance*: Real-time hydrodynamic drag force $f_{drag}(t) = -B_{drag}\dot{x}(t)$ in normalized actuation units.

#### Tab 4: Metrics & Export
- **Table 4.1 — Performance Metrics**: Comprehensive side-by-side comparison (RMSE, Max Absolute Error, Settling Time, Overshoot %, Error Reduction % or Absolute mm Reduction).
- **Export Center**:
  - `Download simulation_data.csv`: Time-series of all 4 control strategies and states.
  - `Download parameters.json`: Identification weights, thresholds, plant parameters, controller gains, and run metadata (`app_version: 8.0`, `seed: 42`).
  - Interactive CSV preview table with pagination and column sorting.

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale | Alternatives Considered |
|---|---|---|---|
| **Simulation Core** | TypeScript Numerical Math Engine in-browser | Zero latency, instant recalculation upon slider changes, no server roundtrips, works entirely offline in iframe. | Server-side Python exec (slower, network delay, cold-start latency). |
| **Hysteresis Identification** | Sequential Non-Negative Least Squares (NNLS) with Gain Normalization | Decouples PI operator scaling ($\sum w_i = 1$) from plant DC gain $K_{dc} = K/\omega_n^2$, guaranteeing numerical stability and physical interpretability. | Joint unconstrained nonlinear optimization (prone to local minima and ill-conditioning). |
| **Inverse Conditioning** | Enforce $w_1 \ge 10^{-3}$ Singularity Floor | Ensures $w'_1 \le 1000$, preventing floating-point overflow during rapid reversals while preserving high-fidelity inversion. | Unconstrained matrix inversion (causes numerical breakdown when $w_1 \to 0$). |
| **Control Signal Routing** | Unified PI-Output (Actuation) Domain for FB & Hybrid | Allows identical $K_p, K_i$ gains across both FB Only and Hybrid modes, solving the classical superposition failure in nonlinear Hammerstein systems. | Feedback in voltage domain (breaks dimensional consistency and degrades hybrid performance). |
| **Actuator Visualization** | SVG/Canvas 2D Cantilever Beam with Dynamic Curvature | Gives physical intuition to researchers on beam bending, curvature limits, and tip displacement without overhead of heavy 3D engines. | Static plots only (lacks physical laboratory realism). |

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           IPMC-SimWeb Console Shell                             │
│  [Header: Brand & Version] [Tab Navigation: 01 Ident | 02 Inv | 03 Sim | 04 Exp] │
└──────────────────────────┬──────────────────────────────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────────────────────┐
│     Numerical Engine      │ │            Reactive UI Stores             │
│ • PlayOperator & PIModel  │ │ • experimentalData & benchmarkConfig      │
│ • KrejciKuhnenInverse     │ │ • piIdentified & plantParameters          │
│ • IPMCPlant (ZOH SS+Drag) │ │ • controllerGains (Kp, Ki, Kt, Sat)       │
│ • SimEngine (4 Strategies)│ │ • simulationResults & performanceMetrics  │
└─────────────┬─────────────┘ └─────────────────────┬─────────────────────┘
              │                                     │
              ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 Visual Surfaces                                 │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌───────────────────────────┐ │
│ │  Cantilever Beam 2D  │ │  Interactive Plotly  │ │ Performance Metric Table  │ │
│ │  Deflection Canvas   │ │  Time-Series Charts  │ │ & CSV/JSON Export Engine  │ │
│ └──────────────────────┘ └──────────────────────┘ └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Component & State Mapping
- `src/lib/ipmcEngine.ts`:
  - `PlayOperator`: Discrete play operator state updates $H_r[x](t) = \max(x-r, \min(x+r, \text{state}))$.
  - `PIModel`: Forward model and Krejci-Kuhnen inverse derivation with $w_1$ singularity floor.
  - `IPMCPlant`: 2nd-order continuous-to-discrete ZOH state-space conversion:
    $$A_c = \begin{bmatrix} 0 & 1 \\ -\omega_n^2 & -2\zeta\omega_n \end{bmatrix},\quad B_c = \begin{bmatrix} 0 \\ K \end{bmatrix},\quad C_c = [1, 0]$$
    Discretized with matrix exponential / ZOH step formulation and augmented with hydrodynamic drag force $f_{drag} = -B_{drag}\dot{x}$ acting on dynamic state update.
  - `identifyPI`: NNLS solver for non-negative weights $w_i \ge 0$.
  - `identifyPlant`: Levenberg-Marquardt / Nelder-Mead optimization for plant parameters $(K, \zeta, \omega_n)$.
  - `runSimulation`: 4-strategy simulation loop with anti-windup back-calculation and voltage clamping.
- `src/components/CantileverViewer.tsx`: Canvas/SVG 2D cantilever beam showing physical bending, clamp mount, laser displacement sensor beam, and instantaneous tip deflection.
- `src/components/ChartWrapper.tsx`: Precision SVG/Canvas interactive plotting component with crosshair inspection, grid axes, and zoom/pan.
- `src/components/tabs/IdentificationTab.tsx`: CSV dropzone, benchmark synthesis, hysteresis and time-fit plots.
- `src/components/tabs/InverseTab.tsx`: Krejci-Kuhnen inverse validation, residual errors, transient omission.
- `src/components/tabs/SimulationTab.tsx`: Trajectory builder, controller parameter rails, 4-strategy overlay charts.
- `src/components/tabs/MetricsTab.tsx`: Comparative metric table, parameters JSON viewer, CSV downloader.

---

## 5. Verification Plan

1. **Analytical Validation Unit Checks**:
   - Verify Krejci-Kuhnen inverse residual: $PI^{-1}(PI(x)) \approx x$ with post-transient RMSE $< 0.01\text{ mm}$ on $0.1\text{ Hz}$ sinusoid.
   - Verify 2nd-order discrete plant step response matches analytical solution $y_a(t) = \frac{K}{\omega_n^2}\left[1 - e^{-\zeta\omega_n t}\left(\cos\omega_d t + \frac{\zeta\omega_n}{\omega_d}\sin\omega_d t\right)\right]$ within $1\%$ peak error.
   - Verify hydrodynamic drag test: $B_{drag} > 0$ reduces step peak displacement vs $B_{drag} = 0$.
   - Verify saturation test: Output voltage strictly clamped in $[-2\text{ V}, +2\text{ V}]$.
   - Verify anti-windup back-calculation recovery within $1\text{ s}$.
2. **Build and Lint Verification**:
   - Run `compile_applet` and `lint_applet` to confirm strict TypeScript types and zero syntax errors.
