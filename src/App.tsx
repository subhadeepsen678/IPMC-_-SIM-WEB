import React, { useState, useMemo } from 'react';
import {
  generateSyntheticBenchmark,
  runIdentificationPipeline,
  IdentificationResult,
  PIModel,
  runSimulation,
  DEFAULT_SATURATION,
} from './lib/ipmcEngine';
import { IdentificationTab } from './components/tabs/IdentificationTab';
import { InverseTab } from './components/tabs/InverseTab';
import { SimulationTab } from './components/tabs/SimulationTab';
import { MetricsTab } from './components/tabs/MetricsTab';
import {
  Sliders,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'identification' | 'inverse' | 'simulation' | 'metrics'>('simulation');

  // Baseline Model Parameters (Initialized from Quasi-Static Ground Truth Benchmark)
  const [dt, setDt] = useState(0.01);
  const [thresholds, setThresholds] = useState<number[]>([0.0, 0.5, 1.0, 1.5, 2.0]);
  const [weights, setWeights] = useState<number[]>([0.1, 0.4, 0.3, 0.15, 0.05]);
  const [plantParams, setPlantParams] = useState<{ K: number; zeta: number; wn: number }>({
    K: 2.5,
    zeta: 0.7,
    wn: 4.0,
  });
  const [identifiedResult, setIdentifiedResult] = useState<IdentificationResult | null>(null);

  // Initialize once on mount with default identification
  React.useEffect(() => {
    const bench = generateSyntheticBenchmark(1000, 0.01, 42, 0.02, 0.08, 2.0);
    const ident = runIdentificationPipeline(bench.V_in, bench.y_meas, 0.01);
    setIdentifiedResult(ident);
    setThresholds(ident.thresholds);
    setWeights(ident.weightsNormalized);
    setPlantParams({ K: ident.K, zeta: ident.zeta, wn: ident.wn });
  }, []);

  // Update identification handler from Tab 1
  const handleIdentificationComplete = (ident: IdentificationResult, detectedDt: number) => {
    setIdentifiedResult(ident);
    setThresholds(ident.thresholds);
    setWeights(ident.weightsNormalized);
    setPlantParams({ K: ident.K, zeta: ident.zeta, wn: ident.wn });
    setDt(detectedDt);
  };

  // Controller Parameters for global metrics
  const controllerParams = useMemo(() => {
    return {
      Kp: 1.2,
      Ki: 0.8,
      Kt: Math.sqrt(0.8 / 1.2),
      antiWindupMode: 'back_calculation',
      saturationLimit: DEFAULT_SATURATION,
      B_drag: 0.4,
      sensorNoiseFraction: 0.01,
    };
  }, []);

  // Shared simulation result for Metrics tab
  const fullSimulationResult = useMemo(() => {
    const pi = new PIModel(thresholds);
    pi.setWeights(weights);
    return runSimulation(pi, plantParams, {
      dt,
      numSamples: 1000,
      trajectoryType: 'chirp',
      trajectoryAmplitude: 2.0,
      f0: 0.02,
      f1: 0.08,
      Kp: controllerParams.Kp,
      Ki: controllerParams.Ki,
      Kt: controllerParams.Kt,
      antiWindupMode: controllerParams.antiWindupMode as 'back_calculation' | 'clamping',
      saturationLimit: controllerParams.saturationLimit,
      B_drag: controllerParams.B_drag,
      sensorNoiseFraction: controllerParams.sensorNoiseFraction,
      seed: 42,
    });
  }, [thresholds, weights, plantParams, dt, controllerParams]);

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      {/* Top Bar Contract (Zone 1: Wordmark, Zone 2: 4 Nav Links, Zone 3: 1 Primary CTA) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-base font-bold tracking-tight text-slate-950 font-sans">
              IPMC-SimWeb
            </span>
            <span className="text-xs text-slate-400 font-normal">·</span>
            <span className="text-xs font-mono text-slate-500 hidden sm:inline">
              NTHU Microdevice Lab
            </span>
          </div>

          {/* Zone 2: 4-5 single-line navigation links/tabs */}
          <nav className="flex items-center gap-2 overflow-x-auto py-1">
            <button
              onClick={() => setActiveTab('identification')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'identification'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              01. System Identification
            </button>

            <button
              onClick={() => setActiveTab('inverse')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'inverse'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              02. Inverse Validation
            </button>

            <button
              onClick={() => setActiveTab('simulation')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'simulation'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              03. Simulation & Controllers
            </button>

            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'metrics'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              04. Metrics & Export
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            {activeTab !== 'simulation' ? (
              <button
                onClick={() => setActiveTab('simulation')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
              >
                <span>Launch Simulation</span>
                <ArrowRight size={13} />
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('metrics')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>View Metrics</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Laboratory Metadata Sub-Ribbon */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-3">
            <span>Model: Prandtl-Ishlinskii (5 Play Ops)</span>
            <span aria-hidden="true">·</span>
            <span>Inverse: Krejci-Kuhnen Closed-Form</span>
            <span aria-hidden="true">·</span>
            <span>Plant: 2nd-Order Hammerstein + Hydrodynamic Drag</span>
          </div>

          <div className="flex items-center gap-3 text-slate-700">
            <span>K = {plantParams.K.toFixed(2)}</span>
            <span>ζ = {plantParams.zeta.toFixed(2)}</span>
            <span>ωn = {plantParams.wn.toFixed(2)} rad/s</span>
            <span>Ts = {(dt * 1000).toFixed(0)} ms</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Stage */}
      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1">
        {activeTab === 'identification' && (
          <IdentificationTab
            onIdentificationComplete={handleIdentificationComplete}
            identifiedResult={identifiedResult}
            dt={dt}
          />
        )}

        {activeTab === 'inverse' && (
          <InverseTab
            thresholds={thresholds}
            weights={weights}
            dt={dt}
          />
        )}

        {activeTab === 'simulation' && (
          <SimulationTab
            thresholds={thresholds}
            weights={weights}
            plantParams={plantParams}
            dt={dt}
          />
        )}

        {activeTab === 'metrics' && (
          <MetricsTab
            simulationResult={fullSimulationResult}
            dt={dt}
            thresholds={thresholds}
            weights={weights}
            plantParams={plantParams}
            controllerParams={controllerParams}
          />
        )}
      </main>

      {/* Quiet Laboratory Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            IPMC-SimWeb: Web-Based Digital Twin for IPMC Soft Actuators (v8.0)
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
            <span>Microdevice Fabrication and Integration Lab</span>
            <span>·</span>
            <span>National Tsing Hua University</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
