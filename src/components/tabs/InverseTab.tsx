import React, { useState, useMemo } from 'react';
import { CheckCircle2, ShieldCheck, Play, ArrowRight, Layers, Sliders } from 'lucide-react';
import { ChartViewer } from '../ChartViewer';
import { PIModel, W1_FLOOR } from '../../lib/ipmcEngine';

interface InverseTabProps {
  thresholds: number[];
  weights: number[];
  dt: number;
}

export const InverseTab: React.FC<InverseTabProps> = ({
  thresholds,
  weights,
  dt,
}) => {
  // Test waveform generator
  const [testFreq, setTestFreq] = useState(0.1); // 0.1 Hz validation standard
  const [testAmplitude, setTestAmplitude] = useState(2.0); // 2 mm standard
  const [customWeights, setCustomWeights] = useState<number[]>([...weights]);

  // Keep in sync when parent weights change if not manually edited
  React.useEffect(() => {
    setCustomWeights([...weights]);
  }, [weights]);

  // Krejci-Kuhnen Inverse Model
  const { piModel, invThresholds, invWeights, w1Capped } = useMemo(() => {
    const w = customWeights.map((val) => Math.max(0, val));
    const capped = w[0] < W1_FLOOR;
    w[0] = Math.max(w[0], W1_FLOOR);

    const model = new PIModel(thresholds);
    model.setWeights(w);

    return {
      piModel: model,
      invThresholds: model.invThresholds,
      invWeights: model.invWeights,
      w1Capped: capped,
    };
  }, [thresholds, customWeights]);

  // Run validation: y_des -> u_ff = PI^-1(y_des) -> y_rec = PI(u_ff)
  const validationData = useMemo(() => {
    const numSamples = 500;
    const duration = 10.0;
    const stepDt = duration / numSamples;
    const t: number[] = new Array(numSamples);
    const y_des: number[] = new Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const time = i * stepDt;
      t[i] = time;
      y_des[i] = testAmplitude * Math.sin(2 * Math.PI * testFreq * time);
    }

    // Pass through inverse then forward
    const u_ff = piModel.inverse(y_des);
    const y_rec = piModel.forward(u_ff);

    const targetTrace: [number, number][] = [];
    const reconstructedTrace: [number, number][] = [];
    const errorTrace: [number, number][] = [];

    // Transient skip: first 50 samples (0.5 s)
    const transientSamples = 50;
    let sumSqErr = 0;
    let maxAbsErr = 0;

    for (let i = 0; i < numSamples; i++) {
      targetTrace.push([t[i], y_des[i]]);
      reconstructedTrace.push([t[i], y_rec[i]]);

      const err = y_rec[i] - y_des[i];
      errorTrace.push([t[i], err]);

      if (i >= transientSamples) {
        sumSqErr += err * err;
        if (Math.abs(err) > maxAbsErr) maxAbsErr = Math.abs(err);
      }
    }

    const postTransientRmse = Math.sqrt(sumSqErr / (numSamples - transientSamples));
    const rmsePct = (postTransientRmse / testAmplitude) * 100;
    const passesCriteria = rmsePct < 1.0; // Acceptance Criteria 1: RMSE < 1%

    return {
      t,
      targetTrace,
      reconstructedTrace,
      errorTrace,
      postTransientRmse,
      rmsePct,
      maxAbsErr,
      passesCriteria,
      transientDuration: transientSamples * stepDt,
    };
  }, [piModel, testFreq, testAmplitude]);

  return (
    <div className="space-y-6">
      {/* Top Banner: Mathematical Inversion Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={20} className="text-emerald-600" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Krejci–Kuhnen Exact Analytical Inverse Compensator
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Calculates direct feedforward Play operator thresholds r' and inverse weights w' with singularity flooring.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold ${
                validationData.passesCriteria
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <CheckCircle2 size={13} />
              {validationData.passesCriteria ? 'Passed (< 1% RMSE)' : 'Warning (≥ 1% RMSE)'}
            </span>
          </div>
        </div>

        {/* Singularity Guard Callout */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase">Conditioning Guard</span>
            <span className="text-sm font-bold text-slate-800">w₁ ≥ 10⁻³ Singularity Floor</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Guarantees w'₁ = 1/w₁ ≤ 1000. Prevents infinite gain inversion.
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase">Post-Transient RMSE (t &gt; 0.5s)</span>
            <span className="text-sm font-bold text-emerald-600">
              {validationData.postTransientRmse.toFixed(6)} mm
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {validationData.rmsePct.toFixed(3)}% of reference amplitude
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase">Peak Inversion Error</span>
            <span className="text-sm font-bold text-slate-800">
              {validationData.maxAbsErr.toFixed(5)} mm
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Excluded: first 50 samples state initialization
            </span>
          </div>
        </div>
      </div>

      {/* Threshold and Weight Mapping Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs overflow-x-auto">
        <h4 className="text-xs font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Layers size={14} className="text-slate-600" />
          Forward vs Inverse Prandtl-Ishlinskii Transformation Matrix
        </h4>

        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-[11px]">
              <th className="py-2 px-3">Operator Index</th>
              <th className="py-2 px-3">Threshold r_i (V)</th>
              <th className="py-2 px-3">Forward Weight w_i</th>
              <th className="py-2 px-3 text-blue-600">Inverse Threshold r'_i (mm)</th>
              <th className="py-2 px-3 text-blue-600">Inverse Weight w'_i</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {thresholds.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50/70">
                <td className="py-2 px-3 text-slate-500">i = {i + 1}</td>
                <td className="py-2 px-3 font-semibold text-slate-800">{r.toFixed(3)}</td>
                <td className="py-2 px-3 text-slate-800">
                  {customWeights[i]?.toFixed(5) ?? '0.00000'}
                </td>
                <td className="py-2 px-3 text-blue-700 font-semibold">
                  {invThresholds[i]?.toFixed(4) ?? '0.0000'}
                </td>
                <td className="py-2 px-3 text-blue-700 font-semibold">
                  {invWeights[i]?.toFixed(5) ?? '0.00000'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Interactive Waveform Parameters for Verification */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Sliders size={15} className="text-slate-600" />
          <span className="font-semibold text-slate-800">Validation Excitation Controls:</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Frequency:</span>
            <input
              type="number"
              step="0.02"
              min="0.02"
              max="0.5"
              value={testFreq}
              onChange={(e) => setTestFreq(parseFloat(e.target.value) || 0.1)}
              className="w-20 px-2 py-1 border border-slate-200 rounded font-mono text-slate-800 text-xs"
            />
            <span className="text-slate-400">Hz</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Amplitude:</span>
            <input
              type="number"
              step="0.2"
              min="0.5"
              max="3.0"
              value={testAmplitude}
              onChange={(e) => setTestAmplitude(parseFloat(e.target.value) || 2.0)}
              className="w-20 px-2 py-1 border border-slate-200 rounded font-mono text-slate-800 text-xs"
            />
            <span className="text-slate-400">mm</span>
          </div>
        </div>
      </div>

      {/* Visualizations Grid (§6 Tab 2 Plots) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plot 2.1 — Domain Validation */}
        <ChartViewer
          title="Plot 2.1 — Domain Validation: y_desired(t) vs PI(u_ff)(t)"
          xLabel="Time (s)"
          yLabel="Displacement (mm)"
          traces={[
            {
              name: 'Target y_desired',
              data: validationData.targetTrace,
              color: '#0f172a',
              strokeDasharray: '4 3',
              strokeWidth: 2,
            },
            {
              name: 'Reconstructed PI(u_ff)',
              data: validationData.reconstructedTrace,
              color: '#16a34a',
              strokeWidth: 1.8,
            },
          ]}
          shadedRegions={[
            {
              xMin: 0,
              xMax: validationData.transientDuration,
              label: 'Initialization Transient (0-50 samples excluded)',
              color: '#64748b',
            },
          ]}
          height={280}
        />

        {/* Plot 2.2 — Residual Error */}
        <ChartViewer
          title="Plot 2.2 — Residual Inversion Error (mm)"
          xLabel="Time (s)"
          yLabel="Error e(t) (mm)"
          traces={[
            {
              name: 'Residual Error',
              data: validationData.errorTrace,
              color: '#dc2626',
              strokeWidth: 1.5,
            },
          ]}
          refLines={[
            {
              y: testAmplitude * 0.01,
              label: '+1% tolerance',
              color: '#94a3b8',
              strokeDasharray: '3 2',
            },
            {
              y: -testAmplitude * 0.01,
              label: '-1% tolerance',
              color: '#94a3b8',
              strokeDasharray: '3 2',
            },
            {
              y: 0,
              color: '#cbd5e1',
            },
          ]}
          shadedRegions={[
            {
              xMin: 0,
              xMax: validationData.transientDuration,
              color: '#64748b',
            },
          ]}
          height={280}
        />
      </div>
    </div>
  );
};
