import React, { useState } from 'react';
import {
  Upload,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { ChartViewer } from '../ChartViewer';
import {
  generateSyntheticBenchmark,
  runIdentificationPipeline,
  SyntheticBenchmarkResult,
  IdentificationResult,
  PIModel,
} from '../../lib/ipmcEngine';

interface IdentificationTabProps {
  onIdentificationComplete: (ident: IdentificationResult, dt: number) => void;
  identifiedResult: IdentificationResult | null;
  dt: number;
}

export const IdentificationTab: React.FC<IdentificationTabProps> = ({
  onIdentificationComplete,
  identifiedResult,
  dt,
}) => {
  // Benchmark generator options
  const [f0, setF0] = useState(0.02);
  const [f1, setF1] = useState(0.08);
  const [amplitude, setAmplitude] = useState(2.0);
  const [duration, setDuration] = useState(10.0);
  const [seed, setSeed] = useState(42);

  // Active dataset state
  const [timeSeries, setTimeSeries] = useState<{
    t: number[];
    V_in: number[];
    y_meas: number[];
    isSynthetic: boolean;
    groundTruth?: SyntheticBenchmarkResult['groundTruth'];
  } | null>(() => {
    // Generate initial synthetic benchmark by default
    const b = generateSyntheticBenchmark(1000, 0.01, 42, 0.02, 0.08, 2.0);
    return {
      t: b.t,
      V_in: b.V_in,
      y_meas: b.y_meas,
      isSynthetic: true,
      groundTruth: b.groundTruth,
    };
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Quick generate synthetic benchmark handler
  const handleGenerateSynthetic = () => {
    setCsvError(null);
    const numSamples = Math.floor(duration / 0.01);
    const result = generateSyntheticBenchmark(numSamples, 0.01, seed, f0, f1, amplitude);
    setTimeSeries({
      t: result.t,
      V_in: result.V_in,
      y_meas: result.y_meas,
      isSynthetic: true,
      groundTruth: result.groundTruth,
    });

    // Auto-run identification on benchmark
    const ident = runIdentificationPipeline(result.V_in, result.y_meas, 0.01);
    onIdentificationComplete(ident, 0.01);
  };

  // CSV File Uploader with NaN interpolation & outlier moving average filter
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
        if (lines.length < 10) {
          throw new Error('CSV file has too few rows (minimum 10 rows required).');
        }

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const timeIdx = headers.findIndex((h) => h.includes('time'));
        const voltIdx = headers.findIndex((h) => h.includes('volt') || h.includes('vin') || h.includes('input'));
        const dispIdx = headers.findIndex((h) => h.includes('disp') || h.includes('out') || h.includes('y'));

        if (timeIdx === -1 || voltIdx === -1 || dispIdx === -1) {
          throw new Error(
            'Missing required columns. CSV header must contain "Time_s", "Input_Voltage_V", and "Output_Displacement_mm".'
          );
        }

        const rawT: number[] = [];
        const rawV: number[] = [];
        const rawY: (number | null)[] = [];

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map((p) => p.trim());
          if (parts.length <= Math.max(timeIdx, voltIdx, dispIdx)) continue;

          const tVal = parseFloat(parts[timeIdx]);
          const vVal = parseFloat(parts[voltIdx]);
          const yVal = parts[dispIdx] === '' || isNaN(parseFloat(parts[dispIdx])) ? null : parseFloat(parts[dispIdx]);

          if (!isNaN(tVal) && !isNaN(vVal)) {
            rawT.push(tVal);
            rawV.push(vVal);
            rawY.push(yVal);
          }
        }

        if (rawT.length === 0) {
          throw new Error('No valid numeric rows parsed from CSV.');
        }

        // Auto-detect Ts
        let deltaSum = 0;
        let deltaCount = 0;
        for (let i = 1; i < Math.min(rawT.length, 50); i++) {
          const dt_i = rawT[i] - rawT[i - 1];
          if (dt_i > 0) {
            deltaSum += dt_i;
            deltaCount++;
          }
        }
        const detectedDt = deltaCount > 0 ? deltaSum / deltaCount : 0.01;

        // Linear interpolation for NaNs in displacement
        const cleanY: number[] = new Array(rawY.length);
        for (let i = 0; i < rawY.length; i++) {
          if (rawY[i] !== null) {
            cleanY[i] = rawY[i]!;
          } else {
            // Find prior and next valid
            let prev = 0;
            for (let p = i - 1; p >= 0; p--) {
              if (rawY[p] !== null) {
                prev = rawY[p]!;
                break;
              }
            }
            let next = prev;
            for (let n = i + 1; n < rawY.length; n++) {
              if (rawY[n] !== null) {
                next = rawY[n]!;
                break;
              }
            }
            cleanY[i] = 0.5 * (prev + next);
          }
        }

        // Outlier filtering: 10-sample moving average with 3-sigma rejection
        const windowSize = 10;
        const filteredY = [...cleanY];
        for (let i = windowSize; i < cleanY.length; i++) {
          const window = cleanY.slice(i - windowSize, i);
          const mean = window.reduce((a, b) => a + b, 0) / windowSize;
          const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / windowSize;
          const std = Math.sqrt(variance);
          if (std > 1e-4 && Math.abs(cleanY[i] - mean) > 3.0 * std) {
            filteredY[i] = mean; // Replace outlier with moving average
          }
        }

        setTimeSeries({
          t: rawT,
          V_in: rawV,
          y_meas: filteredY,
          isSynthetic: false,
        });

        // Run identification
        setIsProcessing(true);
        setTimeout(() => {
          const ident = runIdentificationPipeline(rawV, filteredY, detectedDt);
          onIdentificationComplete(ident, detectedDt);
          setIsProcessing(false);
        }, 50);
      } catch (err: any) {
        setCsvError(err?.message || 'Error parsing CSV file');
      }
    };
    reader.readAsText(file);
  };

  // Re-run identification manually
  const handleRunIdentification = () => {
    if (!timeSeries) return;
    setIsProcessing(true);
    setTimeout(() => {
      const detectedDt = timeSeries.t.length > 1 ? timeSeries.t[1] - timeSeries.t[0] : 0.01;
      const ident = runIdentificationPipeline(timeSeries.V_in, timeSeries.y_meas, detectedDt);
      onIdentificationComplete(ident, detectedDt);
      setIsProcessing(false);
    }, 50);
  };

  // Prepare Plot Data
  const hysteresisData = React.useMemo(() => {
    if (!timeSeries) return { measured: [], fitted: [] };
    const measured: [number, number][] = timeSeries.V_in.map((v, i) => [v, timeSeries.y_meas[i]]);

    let fitted: [number, number][] = [];
    if (identifiedResult) {
      // Re-evaluate forward PI model on input voltage
      fitted = timeSeries.V_in.map((v, i) => [v, identifiedResult.y_pi[i] ?? 0]);
    }

    return { measured, fitted };
  }, [timeSeries, identifiedResult]);

  const timeDomainData = React.useMemo(() => {
    if (!timeSeries) return { measured: [], cascade: [] };
    const measured: [number, number][] = timeSeries.t.map((ti, i) => [ti, timeSeries.y_meas[i]]);
    let cascade: [number, number][] = [];
    if (identifiedResult) {
      cascade = timeSeries.t.map((ti, i) => [ti, identifiedResult.y_fit_cascade[i] ?? 0]);
    }
    return { measured, cascade };
  }, [timeSeries, identifiedResult]);

  return (
    <div className="space-y-6">
      {/* Top Controls Grid: Synthetic Generator + CSV Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Synthetic Benchmark Generator (FR-1) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Synthetic Benchmark Generator (Quasi-Static Chirp)
              </h3>
            </div>
            <button
              onClick={handleGenerateSynthetic}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Play size={13} />
              Generate Benchmark
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="text-slate-500 block mb-1">Start Freq f₀ (Hz)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="0.5"
                value={f0}
                onChange={(e) => setF0(parseFloat(e.target.value) || 0.02)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="text-slate-500 block mb-1">End Freq f₁ (Hz)</label>
              <input
                type="number"
                step="0.01"
                min="0.02"
                max="1.0"
                value={f1}
                onChange={(e) => setF1(parseFloat(e.target.value) || 0.08)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="text-slate-500 block mb-1">Amplitude (V)</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="3.0"
                value={amplitude}
                onChange={(e) => setAmplitude(parseFloat(e.target.value) || 2.0)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md font-mono text-slate-800"
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
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md font-mono text-slate-800"
              />
            </div>
          </div>

          {/* Dynamic Frequency Warning (§5.1 PRD requirement) */}
          {f1 > 0.1 && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-900 text-xs">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Quasi-Static Identification Alert:</strong> Frequencies above 0.1 Hz may bias PI weight identification due to unmodeled electro-mechanical phase lag.
              </div>
            </div>
          )}

          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
            <span>Ground Truth: K=2.50, ζ=0.70, ωn=4.00 rad/s · 1% Gaussian Noise</span>
            <span className="font-mono">Seed: {seed}</span>
          </div>
        </div>

        {/* Lab Experimental Data Upload */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <Upload size={16} className="text-slate-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                Upload Experimental Lab Data (CSV)
              </h3>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Expected headers: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">Time_s</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">Input_Voltage_V</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">Output_Displacement_mm</code>
            </p>

            <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors text-center bg-slate-50/50">
              <Upload size={20} className="text-slate-400 mb-1" />
              <span className="text-xs font-medium text-slate-700">Choose CSV or drag & drop</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Max 5MB · Auto NaN interpolation & outlier rejection</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {csvError && (
              <p className="mt-2 text-xs text-rose-600 flex items-center gap-1 font-mono">
                <AlertTriangle size={13} /> {csvError}
              </p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Active: {timeSeries?.isSynthetic ? 'Synthetic Benchmark' : 'Uploaded CSV'} ({timeSeries?.t.length ?? 0} samples)
            </span>
            <button
              onClick={handleRunIdentification}
              disabled={isProcessing || !timeSeries}
              className="px-3 py-1.5 font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? 'Fitting...' : 'Re-fit Model'}
            </button>
          </div>
        </div>
      </div>

      {/* Identified Parameters Scorecard */}
      {identifiedResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Sequential Identification Results (Normalized Gain)
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-slate-500">
                PI Fit R²: <strong className="text-slate-900">{(identifiedResult.rSquaredPI * 100).toFixed(2)}%</strong>
              </span>
              <span className="text-slate-500">
                Cascade R²: <strong className="text-slate-900">{(identifiedResult.rSquaredPlant * 100).toFixed(2)}%</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase">Plant Gain K</span>
              <span className="text-base font-bold text-slate-900">{identifiedResult.K.toFixed(3)}</span>
              {timeSeries?.groundTruth && (
                <span className="text-[10px] text-slate-400 block mt-0.5">GT: 2.500</span>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase">Damping Ratio ζ</span>
              <span className="text-base font-bold text-slate-900">{identifiedResult.zeta.toFixed(3)}</span>
              {timeSeries?.groundTruth && (
                <span className="text-[10px] text-slate-400 block mt-0.5">GT: 0.700</span>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase">Nat. Frequency ωn</span>
              <span className="text-base font-bold text-slate-900">{identifiedResult.wn.toFixed(2)} rad/s</span>
              {timeSeries?.groundTruth && (
                <span className="text-[10px] text-slate-400 block mt-0.5">GT: 4.00</span>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase">DC Gain K_dc</span>
              <span className="text-base font-bold text-slate-900">
                {(identifiedResult.K / (identifiedResult.wn * identifiedResult.wn)).toFixed(3)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">K / ωn²</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase">Singularity Floor w₁</span>
              <span className="text-base font-bold text-emerald-600">
                {identifiedResult.weightsNormalized[0].toFixed(4)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">≥ 10⁻³ enforced</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase">Sampling Ts</span>
              <span className="text-base font-bold text-slate-900">{(dt * 1000).toFixed(1)} ms</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{(1 / dt).toFixed(0)} Hz</span>
            </div>
          </div>
        </div>
      )}

      {/* Visualizations Grid (§6 PRD Tab 1 Plots) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plot 1.1 — Hysteresis Loop */}
        <ChartViewer
          title="Plot 1.1 — Hysteresis Loop (Vin vs Output Displacement)"
          xLabel="Input Voltage Vin (V)"
          yLabel="Displacement (mm)"
          traces={[
            {
              name: 'Measured Data',
              data: hysteresisData.measured,
              color: '#94a3b8',
              isScatter: true,
              opacity: 0.5,
            },
            {
              name: 'Fitted PI Model',
              data: hysteresisData.fitted,
              color: '#2563eb',
              strokeWidth: 2,
            },
          ]}
          height={280}
        />

        {/* Plot 1.2 — Time-Domain Fit */}
        <ChartViewer
          title="Plot 1.2 — Time-Domain Fit (Measured vs Simulated Cascade G[PI(V)])"
          xLabel="Time (s)"
          yLabel="Displacement (mm)"
          traces={[
            {
              name: 'Measured Signal',
              data: timeDomainData.measured,
              color: '#64748b',
              strokeDasharray: '3 2',
              strokeWidth: 1.5,
            },
            {
              name: 'Hammerstein Cascade G[PI(V)]',
              data: timeDomainData.cascade,
              color: '#0284c7',
              strokeWidth: 2,
            },
          ]}
          height={280}
        />
      </div>

      {/* Plot 1.3 — NNLS Fit Residuals & Weight Distribution */}
      {identifiedResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-xs font-semibold text-slate-900">
                Plot 1.3 — Prandtl-Ishlinskii Play Operator Weights (Normalized)
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Decoupled threshold grid with w₁ ≥ 10⁻³ singularity floor. Sum of weights Σ w_i = 1.0.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {identifiedResult.thresholds.map((r, i) => {
              const w = identifiedResult.weightsNormalized[i];
              const pct = (w * 100).toFixed(1);
              return (
                <div
                  key={i}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Operator r_{i + 1}</span>
                    <span className="font-mono font-medium">{r.toFixed(2)} V</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden my-1.5">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(5, w * 100))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-slate-400">Weight:</span>
                    <span className="font-bold text-slate-900">{w.toFixed(4)} ({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
