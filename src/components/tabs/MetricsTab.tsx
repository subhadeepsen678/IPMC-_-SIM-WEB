import React, { useState } from 'react';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  Table,
  Layers,
} from 'lucide-react';
import {
  SimulationResult,
  runAcceptanceTests,
  TestResult,
} from '../../lib/ipmcEngine';

interface MetricsTabProps {
  simulationResult: SimulationResult;
  dt: number;
  thresholds: number[];
  weights: number[];
  plantParams: { K: number; zeta: number; wn: number };
  controllerParams: {
    Kp: number;
    Ki: number;
    Kt: number;
    antiWindupMode: string;
    saturationLimit: number;
    B_drag: number;
    sensorNoiseFraction: number;
  };
}

export const MetricsTab: React.FC<MetricsTabProps> = ({
  simulationResult,
  dt,
  thresholds,
  weights,
  plantParams,
  controllerParams,
}) => {
  const [testResults, setTestResults] = useState<TestResult[]>(() => runAcceptanceTests());
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [page, setPage] = useState(0);

  const { openLoop, ffOnly, fbOnly, hybrid, errorReductionFF, errorReductionFB, errorReductionHybrid } =
    simulationResult;

  // Run PRD Acceptance Tests (§7)
  const handleRunAcceptanceTests = () => {
    setIsRunningTests(true);
    setTimeout(() => {
      setTestResults(runAcceptanceTests());
      setIsRunningTests(false);
    }, 150);
  };

  // CSV Export Generation
  const handleDownloadCSV = () => {
    const headers = [
      'Time_s',
      'Desired_Displacement_mm',
      'OpenLoop_Displacement_mm',
      'OpenLoop_Error_mm',
      'OpenLoop_Voltage_V',
      'FFOnly_Displacement_mm',
      'FFOnly_Error_mm',
      'FFOnly_Voltage_V',
      'FBOnly_Displacement_mm',
      'FBOnly_Error_mm',
      'FBOnly_Voltage_V',
      'Hybrid_Displacement_mm',
      'Hybrid_Error_mm',
      'Hybrid_Voltage_V',
      'Hybrid_Drag_Force_Norm',
    ];

    const rows: string[] = [headers.join(',')];
    const N = simulationResult.t.length;

    for (let i = 0; i < N; i++) {
      rows.push(
        [
          simulationResult.t[i].toFixed(4),
          simulationResult.y_desired[i].toFixed(5),
          openLoop.y[i].toFixed(5),
          openLoop.error[i].toFixed(5),
          openLoop.V_in[i].toFixed(4),
          ffOnly.y[i].toFixed(5),
          ffOnly.error[i].toFixed(5),
          ffOnly.V_in[i].toFixed(4),
          fbOnly.y[i].toFixed(5),
          fbOnly.error[i].toFixed(5),
          fbOnly.V_in[i].toFixed(4),
          hybrid.y[i].toFixed(5),
          hybrid.error[i].toFixed(5),
          hybrid.V_in[i].toFixed(4),
          hybrid.f_drag[i].toFixed(5),
        ].join(',')
      );
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ipmc_simulation_data_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // JSON Export Generation
  const handleDownloadJSON = () => {
    const payload = {
      app_name: 'IPMC-SimWeb: Web-Based Digital Twin for IPMC Soft Actuators',
      app_version: '8.0',
      timestamp: new Date().toISOString(),
      random_seed: 42,
      sampling: {
        Ts_seconds: dt,
        frequency_Hz: 1 / dt,
      },
      prandtl_ishlinskii_model: {
        num_operators: thresholds.length,
        thresholds_ri_V: thresholds,
        weights_wi_normalized: weights,
        w1_singularity_floor: 1e-3,
      },
      plant_dynamics: {
        K: plantParams.K,
        zeta: plantParams.zeta,
        omega_n_rad_s: plantParams.wn,
        K_dc: plantParams.K / (plantParams.wn * plantParams.wn),
        B_drag_norm_per_mms: controllerParams.B_drag,
      },
      controller_parameters: {
        domain: 'normalized_actuation',
        Kp: controllerParams.Kp,
        Ki: controllerParams.Ki,
        Kt: controllerParams.Kt,
        anti_windup_mode: controllerParams.antiWindupMode,
        voltage_saturation_limit_V: controllerParams.saturationLimit,
        sensor_noise_sigma_fraction: controllerParams.sensorNoiseFraction,
      },
      performance_metrics: {
        open_loop: { rmse_mm: openLoop.rmse, max_error_mm: openLoop.maxError },
        ff_only: {
          rmse_mm: ffOnly.rmse,
          max_error_mm: ffOnly.maxError,
          error_reduction_pct: errorReductionFF,
        },
        fb_only: {
          rmse_mm: fbOnly.rmse,
          max_error_mm: fbOnly.maxError,
          error_reduction_pct: errorReductionFB,
        },
        hybrid: {
          rmse_mm: hybrid.rmse,
          max_error_mm: hybrid.maxError,
          error_reduction_pct: errorReductionHybrid,
        },
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ipmc_parameters_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const rowsPerPage = 12;
  const totalRows = simulationResult.t.length;
  const maxPage = Math.ceil(totalRows / rowsPerPage) - 1;
  const paginatedIndices = Array.from(
    { length: Math.min(rowsPerPage, totalRows - page * rowsPerPage) },
    (_, i) => page * rowsPerPage + i
  );

  return (
    <div className="space-y-6">
      {/* Top Section: Export Action Center & Table 4.1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table 4.1: Performance Metrics */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Table size={16} className="text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Table 4.1 — Actuator Closed-Loop Performance Metrics
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Transient Excluded: First 50 Samples (0.5 s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-[11px]">
                    <th className="py-2.5 px-3">Control Strategy</th>
                    <th className="py-2.5 px-3">RMSE (mm)</th>
                    <th className="py-2.5 px-3">Max Absolute Error (mm)</th>
                    <th className="py-2.5 px-3 text-right">Error Reduction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-semibold text-slate-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      Open Loop (Direct Voltage)
                    </td>
                    <td className="py-3 px-3">{openLoop.rmse.toFixed(5)}</td>
                    <td className="py-3 px-3">{openLoop.maxError.toFixed(5)}</td>
                    <td className="py-3 px-3 text-right text-slate-400">Baseline (0.0%)</td>
                  </tr>

                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-semibold text-blue-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      Feedforward Only (PI⁻¹)
                    </td>
                    <td className="py-3 px-3 font-bold text-blue-900">{ffOnly.rmse.toFixed(5)}</td>
                    <td className="py-3 px-3">{ffOnly.maxError.toFixed(5)}</td>
                    <td className="py-3 px-3 text-right font-bold text-blue-700">
                      {errorReductionFF >= 0 ? `+${errorReductionFF.toFixed(2)}%` : `${errorReductionFF.toFixed(2)}%`}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-semibold text-amber-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Feedback Only (PI Controller)
                    </td>
                    <td className="py-3 px-3 font-bold text-amber-900">{fbOnly.rmse.toFixed(5)}</td>
                    <td className="py-3 px-3">{fbOnly.maxError.toFixed(5)}</td>
                    <td className="py-3 px-3 text-right font-bold text-amber-700">
                      {errorReductionFB >= 0 ? `+${errorReductionFB.toFixed(2)}%` : `${errorReductionFB.toFixed(2)}%`}
                    </td>
                  </tr>

                  <tr className="bg-emerald-50/40 hover:bg-emerald-50/70 border-t border-emerald-200">
                    <td className="py-3 px-3 font-bold text-emerald-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      Hybrid (Cascade Linearization)
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-900">{hybrid.rmse.toFixed(5)}</td>
                    <td className="py-3 px-3 font-bold text-emerald-900">{hybrid.maxError.toFixed(5)}</td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-700 text-sm">
                      {errorReductionHybrid >= 0
                        ? `+${errorReductionHybrid.toFixed(2)}%`
                        : `${errorReductionHybrid.toFixed(2)}%`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-4 pt-2 border-t border-slate-100">
            * Cascade linearization feeds the linearizing inverse FF alongside PI feedback operating within the normalized actuation domain, neutralizing superposition failure.
          </p>
        </div>

        {/* Download Buttons Card */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <Download size={16} className="text-slate-700" />
              <h3 className="text-sm font-semibold text-slate-900">Lab Data Export Center</h3>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Export validated model weights, plant dynamics, controller gains, and high-frequency simulation trajectories for hardware LabVIEW or MATLAB/Simulink cross-validation.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleDownloadCSV}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
              >
                <FileSpreadsheet size={15} />
                Download simulation_data.csv
              </button>

              <button
                onClick={handleDownloadJSON}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-medium rounded-lg text-xs transition-colors cursor-pointer"
              >
                <FileJson size={15} />
                Download parameters.json
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 font-mono">
            IPMC-SimWeb v8.0 · Ephemeral Client Memory Processing
          </div>
        </div>
      </div>

      {/* Acceptance Criteria Validation Suite (§7 of PRD) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-600" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                §7 Verification & Acceptance Criteria Self-Test Suite
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Automated analytical checks against mathematical 2nd-order ODEs, Krejci inverse, and drag physics.
              </p>
            </div>
          </div>

          <button
            onClick={handleRunAcceptanceTests}
            disabled={isRunningTests}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <Play size={13} />
            {isRunningTests ? 'Evaluating...' : 'Re-run Validation Suite'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {testResults.map((t, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-lg border text-xs flex flex-col justify-between ${
                t.passed
                  ? 'bg-emerald-50/40 border-emerald-200/80 text-emerald-950'
                  : 'bg-rose-50/40 border-rose-200/80 text-rose-950'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-900 truncate">{t.name}</span>
                  {t.passed ? (
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle size={15} className="text-rose-600 shrink-0" />
                  )}
                </div>
                <div className="font-mono text-[11px] font-bold mb-1">{t.metric}</div>
                <p className="text-[10px] text-slate-600 leading-normal">{t.detail}</p>
              </div>
              <span
                className={`mt-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold self-start ${
                  t.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {t.passed ? 'PASSED' : 'FAILED'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CSV Time-Series Data Preview Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-slate-700" />
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
              Simulation Trajectory Data Preview (Total {totalRows} Samples)
            </h4>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-mono">
              Page {page + 1} of {maxPage + 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-medium"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
              disabled={page === maxPage}
              className="px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-medium"
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-[11px]">
                <th className="py-2 px-2.5">Time (s)</th>
                <th className="py-2 px-2.5">Target r (mm)</th>
                <th className="py-2 px-2.5">Open Loop (mm)</th>
                <th className="py-2 px-2.5 text-blue-700">FF Only (mm)</th>
                <th className="py-2 px-2.5 text-amber-700">FB Only (mm)</th>
                <th className="py-2 px-2.5 text-emerald-700">Hybrid (mm)</th>
                <th className="py-2 px-2.5 text-purple-700">Hybrid Vin (V)</th>
                <th className="py-2 px-2.5 text-cyan-700">f_drag (u)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedIndices.map((i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="py-1.5 px-2.5 text-slate-600">{simulationResult.t[i].toFixed(2)}</td>
                  <td className="py-1.5 px-2.5 font-semibold text-slate-900">
                    {simulationResult.y_desired[i].toFixed(3)}
                  </td>
                  <td className="py-1.5 px-2.5 text-slate-600">{openLoop.y[i].toFixed(3)}</td>
                  <td className="py-1.5 px-2.5 text-blue-700">{ffOnly.y[i].toFixed(3)}</td>
                  <td className="py-1.5 px-2.5 text-amber-700">{fbOnly.y[i].toFixed(3)}</td>
                  <td className="py-1.5 px-2.5 font-bold text-emerald-700">{hybrid.y[i].toFixed(3)}</td>
                  <td className="py-1.5 px-2.5 text-purple-700">{hybrid.V_in[i].toFixed(2)}</td>
                  <td className="py-1.5 px-2.5 text-cyan-700">{hybrid.f_drag[i].toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
