import React, { useState, useMemo } from 'react';
import {
  Activity,
  Sliders,
  Zap,
  Gauge,
  RotateCcw,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { ChartViewer } from '../ChartViewer';
import { CantileverViewer } from '../CantileverViewer';
import {
  PIModel,
  runSimulation,
  SimulationOptions,
  SimulationResult,
  DEFAULT_SATURATION,
} from '../../lib/ipmcEngine';

interface SimulationTabProps {
  thresholds: number[];
  weights: number[];
  plantParams: { K: number; zeta: number; wn: number };
  dt: number;
}

export const SimulationTab: React.FC<SimulationTabProps> = ({
  thresholds,
  weights,
  plantParams,
  dt,
}) => {
  // Trajectory Settings
  const [trajectoryType, setTrajectoryType] = useState<SimulationOptions['trajectoryType']>('chirp');
  const [amplitude, setAmplitude] = useState(2.0); // mm
  const [duration, setDuration] = useState(10.0); // seconds
  const [f0, setF0] = useState(0.02);
  const [f1, setF1] = useState(0.08);

  // Controller Tuning (Normalized Actuation Domain)
  const [Kp, setKp] = useState(1.2);
  const [Ki, setKi] = useState(0.8);
  const [antiWindupMode, setAntiWindupMode] = useState<'back_calculation' | 'clamping'>('back_calculation');
  const [KtManual, setKtManual] = useState<number | null>(null);

  // Physics Injection Settings
  const [saturationLimit, setSaturationLimit] = useState(DEFAULT_SATURATION); // 2.0 V
  const [B_drag, setBDrag] = useState(0.4); // normalized drag
  const [sensorNoisePct, setSensorNoisePct] = useState(1.0); // 1% of full scale
  const [seed, setSeed] = useState(42);

  // Cantilever preview active strategy selector
  const [previewStrategy, setPreviewStrategy] = useState<'hybrid' | 'fb_only' | 'ff_only' | 'open_loop'>('hybrid');

  // Compute default Kt = sqrt(Ki / Kp)
  const computedKt = useMemo(() => {
    return Math.sqrt(Math.max(1e-4, Ki / Math.max(1e-4, Kp)));
  }, [Kp, Ki]);
  const activeKt = KtManual !== null ? KtManual : computedKt;

  // Run 4-Strategy Simulation
  const simResult: SimulationResult = useMemo(() => {
    const numSamples = Math.floor(duration / dt);
    const pi = new PIModel(thresholds);
    pi.setWeights(weights);

    const options: SimulationOptions = {
      dt,
      numSamples,
      trajectoryType,
      trajectoryAmplitude: amplitude,
      f0,
      f1,
      Kp,
      Ki,
      Kt: activeKt,
      antiWindupMode,
      saturationLimit,
      B_drag,
      sensorNoiseFraction: sensorNoisePct / 100,
      seed,
    };

    return runSimulation(pi, plantParams, options);
  }, [
    thresholds,
    weights,
    plantParams,
    dt,
    duration,
    trajectoryType,
    amplitude,
    f0,
    f1,
    Kp,
    Ki,
    activeKt,
    antiWindupMode,
    saturationLimit,
    B_drag,
    sensorNoisePct,
    seed,
  ]);

  // Active series for Cantilever Viewer
  const activeSeries = useMemo(() => {
    switch (previewStrategy) {
      case 'open_loop':
        return { name: 'Open Loop', series: simResult.openLoop };
      case 'ff_only':
        return { name: 'FF Only', series: simResult.ffOnly };
      case 'fb_only':
        return { name: 'FB Only', series: simResult.fbOnly };
      case 'hybrid':
      default:
        return { name: 'Hybrid (Cascade Linearization)', series: simResult.hybrid };
    }
  }, [previewStrategy, simResult]);

  // Chart 3.1: Displacement Tracking Data
  const trackingTraces = useMemo(() => {
    const target: [number, number][] = [];
    const ol: [number, number][] = [];
    const ff: [number, number][] = [];
    const fb: [number, number][] = [];
    const hyb: [number, number][] = [];

    for (let i = 0; i < simResult.t.length; i++) {
      const time = simResult.t[i];
      target.push([time, simResult.y_desired[i]]);
      ol.push([time, simResult.openLoop.y[i]]);
      ff.push([time, simResult.ffOnly.y[i]]);
      fb.push([time, simResult.fbOnly.y[i]]);
      hyb.push([time, simResult.hybrid.y[i]]);
    }

    return [
      { name: 'Desired', data: target, color: '#0f172a', strokeDasharray: '4 3', strokeWidth: 2 },
      { name: 'Open Loop', data: ol, color: '#94a3b8', strokeWidth: 1.5 },
      { name: 'FF Only', data: ff, color: '#2563eb', strokeWidth: 1.6 },
      { name: 'FB Only', data: fb, color: '#f59e0b', strokeWidth: 1.6 },
      { name: 'Hybrid', data: hyb, color: '#16a34a', strokeWidth: 2.2 },
    ];
  }, [simResult]);

  // Chart 3.2: Tracking Error Traces
  const errorTraces = useMemo(() => {
    const ol: [number, number][] = [];
    const ff: [number, number][] = [];
    const fb: [number, number][] = [];
    const hyb: [number, number][] = [];

    for (let i = 0; i < simResult.t.length; i++) {
      const time = simResult.t[i];
      ol.push([time, simResult.openLoop.error[i]]);
      ff.push([time, simResult.ffOnly.error[i]]);
      fb.push([time, simResult.fbOnly.error[i]]);
      hyb.push([time, simResult.hybrid.error[i]]);
    }

    return [
      { name: 'Open Loop Error', data: ol, color: '#94a3b8', strokeWidth: 1.4 },
      { name: 'FF Only Error', data: ff, color: '#2563eb', strokeWidth: 1.5 },
      { name: 'FB Only Error', data: fb, color: '#f59e0b', strokeWidth: 1.5 },
      { name: 'Hybrid Error', data: hyb, color: '#16a34a', strokeWidth: 2 },
    ];
  }, [simResult]);

  // Chart 3.3: Control Voltage & Saturation Traces
  const voltageTraces = useMemo(() => {
    const vHyb: [number, number][] = [];
    const vFb: [number, number][] = [];
    const vFf: [number, number][] = [];

    for (let i = 0; i < simResult.t.length; i++) {
      const time = simResult.t[i];
      vHyb.push([time, simResult.hybrid.V_in[i]]);
      vFb.push([time, simResult.fbOnly.V_in[i]]);
      vFf.push([time, simResult.ffOnly.V_in[i]]);
    }

    return [
      { name: 'Hybrid Vin', data: vHyb, color: '#7c3aed', strokeWidth: 2 },
      { name: 'FB Only Vin', data: vFb, color: '#f59e0b', strokeWidth: 1.2, strokeDasharray: '2 2' },
      { name: 'FF Only Vin', data: vFf, color: '#2563eb', strokeWidth: 1.2, strokeDasharray: '3 2' },
    ];
  }, [simResult]);

  // Chart 3.4: Drag Disturbance Force Traces
  const dragTraces = useMemo(() => {
    const dHyb: [number, number][] = [];
    const dOl: [number, number][] = [];

    for (let i = 0; i < simResult.t.length; i++) {
      const time = simResult.t[i];
      dHyb.push([time, simResult.hybrid.f_drag[i]]);
      dOl.push([time, simResult.openLoop.f_drag[i]]);
    }

    return [
      { name: 'Hybrid f_drag', data: dHyb, color: '#06b6d4', strokeWidth: 1.8 },
      { name: 'Open Loop f_drag', data: dOl, color: '#94a3b8', strokeWidth: 1.4, strokeDasharray: '3 2' },
    ];
  }, [simResult]);

  return (
    <div className="space-y-6">
      {/* Real-time Physical Cantilever Beam Visualization */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Actuator Physical Cantilever Deflection Viewport
            </h3>
          </div>

          {/* Strategy selector button strip */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                ['hybrid', 'Hybrid (Recommended)'],
                ['ff_only', 'FF Only'],
                ['fb_only', 'FB Only'],
                ['open_loop', 'Open Loop'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPreviewStrategy(key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  previewStrategy === key
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <CantileverViewer
          t={simResult.t}
          y_desired={simResult.y_desired}
          actualY={activeSeries.series.y}
          Vin={activeSeries.series.V_in}
          f_drag={activeSeries.series.f_drag}
          strategyName={activeSeries.name}
        />
      </div>

      {/* Controller Tuning & Physics Controls Ribbon */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trajectory Reference Selection */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Gauge size={16} className="text-slate-700" />
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
              Reference Trajectory
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {(
              [
                ['chirp', 'Quasi-Static Chirp'],
                ['multisine', 'Multi-Sine (0.02-0.12 Hz)'],
                ['step', 'Multi-Step Staircase'],
                ['square', 'Smoothed Square'],
              ] as const
            ).map(([type, label]) => (
              <button
                key={type}
                onClick={() => setTrajectoryType(type)}
                className={`p-2 rounded-lg text-left border transition-colors cursor-pointer ${
                  trajectoryType === type
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-500 block mb-1">Target Amplitude (mm)</label>
              <input
                type="number"
                step="0.2"
                min="0.5"
                max="3.0"
                value={amplitude}
                onChange={(e) => setAmplitude(parseFloat(e.target.value) || 2.0)}
                className="w-full px-2 py-1.5 border border-slate-200 rounded font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="text-slate-500 block mb-1">Duration (s)</label>
              <input
                type="number"
                step="1"
                min="5"
                max="30"
                value={duration}
                onChange={(e) => setDuration(parseFloat(e.target.value) || 10)}
                className="w-full px-2 py-1.5 border border-slate-200 rounded font-mono text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Shared Controller Tuning (Cascade Linearization) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-blue-600" />
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                Controller Tuning (Actuation Domain)
              </h4>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Kp, Ki in [norm/mm]</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="flex justify-between text-slate-500 mb-1">
                <span>Proportional Gain Kp</span>
                <span className="font-mono font-semibold text-slate-800">{Kp.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.05"
                value={Kp}
                onChange={(e) => setKp(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-500 mb-1">
                <span>Integral Gain Ki</span>
                <span className="font-mono font-semibold text-slate-800">{Ki.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="5.0"
                step="0.05"
                value={Ki}
                onChange={(e) => setKi(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          {/* Anti-Windup Selection */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-600 font-medium block">Anti-Windup Method</span>
              <span className="text-[10px] text-slate-400">Kt = √(Ki/Kp) = {computedKt.toFixed(3)}</span>
            </div>

            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md text-[11px]">
              <button
                onClick={() => setAntiWindupMode('back_calculation')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  antiWindupMode === 'back_calculation'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Back-Calc
              </button>
              <button
                onClick={() => setAntiWindupMode('clamping')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  antiWindupMode === 'clamping'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Clamping
              </button>
            </div>
          </div>
        </div>

        {/* Physics Injection (Saturation, Drag, Noise) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Zap size={16} className="text-amber-600" />
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
              Physical Disturbances & Limits
            </h4>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-500 mb-1">
                <span>Driver Voltage Saturation</span>
                <span className="font-mono font-semibold text-slate-800">±{saturationLimit.toFixed(1)} V</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={saturationLimit}
                onChange={(e) => setSaturationLimit(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-amber-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-500 mb-1">
                <span>Hydrodynamic Velocity Drag (B_drag)</span>
                <span className="font-mono font-semibold text-slate-800">{B_drag.toFixed(2)} [u/(mm/s)]</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.05"
                value={B_drag}
                onChange={(e) => setBDrag(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-cyan-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-500 mb-1">
                <span>Sensor Gaussian Noise (σ)</span>
                <span className="font-mono font-semibold text-slate-800">{sensorNoisePct.toFixed(1)}% full-scale</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="3.0"
                step="0.2"
                value={sensorNoisePct}
                onChange={(e) => setSensorNoisePct(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-slate-700"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4-Chart Grid (§6 Tab 3 Plots) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plot 3.1: Displacement Tracking */}
        <ChartViewer
          title="Plot 3.1 — Closed-Loop Displacement Tracking Comparison"
          xLabel="Time (s)"
          yLabel="Displacement y(t) (mm)"
          traces={trackingTraces}
          height={280}
        />

        {/* Plot 3.2: Tracking Error */}
        <ChartViewer
          title="Plot 3.2 — Tracking Error e(t) = y_des - y_act"
          xLabel="Time (s)"
          yLabel="Error e(t) (mm)"
          traces={errorTraces}
          refLines={[{ y: 0, color: '#cbd5e1' }]}
          height={280}
        />

        {/* Plot 3.3: Control Signal & Saturation */}
        <ChartViewer
          title="Plot 3.3 — Applied Voltage Signal & Saturation Boundaries"
          xLabel="Time (s)"
          yLabel="Control Voltage Vin (V)"
          traces={voltageTraces}
          refLines={[
            {
              y: saturationLimit,
              label: `+${saturationLimit.toFixed(1)} V Saturation Limit`,
              color: '#ef4444',
              strokeDasharray: '4 3',
            },
            {
              y: -saturationLimit,
              label: `-${saturationLimit.toFixed(1)} V Saturation Limit`,
              color: '#ef4444',
              strokeDasharray: '4 3',
            },
            { y: 0, color: '#cbd5e1' },
          ]}
          height={280}
        />

        {/* Plot 3.4: Drag Disturbance Force */}
        <ChartViewer
          title="Plot 3.4 — Hydrodynamic Drag Disturbance Force f_drag = -B_drag·ẋ"
          xLabel="Time (s)"
          yLabel="Drag Force (Norm Actuation Units)"
          traces={dragTraces}
          refLines={[{ y: 0, color: '#cbd5e1' }]}
          height={280}
        />
      </div>
    </div>
  );
};
