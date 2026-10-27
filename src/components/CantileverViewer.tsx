import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Crosshair } from 'lucide-react';

interface CantileverViewerProps {
  t: number[];
  y_desired: number[];
  actualY: number[];
  Vin: number[];
  f_drag?: number[];
  strategyName: string;
}

export const CantileverViewer: React.FC<CantileverViewerProps> = ({
  t,
  y_desired,
  actualY,
  Vin,
  f_drag,
  strategyName,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const numPoints = t.length;

  useEffect(() => {
    // Reset to beginning if time series changes
    setCurrentIndex(0);
  }, [t]);

  useEffect(() => {
    if (!isPlaying || numPoints <= 1) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTimeRef.current = null;
      return;
    }

    const dt_target = t[1] ? (t[1] - t[0]) * 1000 : 10; // ms per step

    const step = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const elapsed = timestamp - lastTimeRef.current;
      const stepDuration = dt_target / playbackSpeed;

      if (elapsed >= stepDuration) {
        const stepsToAdvance = Math.max(1, Math.floor(elapsed / stepDuration));
        lastTimeRef.current = timestamp;
        setCurrentIndex((prev) => {
          const next = prev + stepsToAdvance;
          if (next >= numPoints) {
            return 0; // loop
          }
          return next;
        });
      }

      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, playbackSpeed, numPoints, t]);

  const idx = Math.min(currentIndex, numPoints - 1);
  const currentTime = t[idx] ?? 0;
  const currentDes = y_desired[idx] ?? 0;
  const currentAct = actualY[idx] ?? 0;
  const currentV = Vin[idx] ?? 0;
  const currentDrag = f_drag ? f_drag[idx] ?? 0 : 0;

  // Geometry dimensions in SVG coordinate space
  // Clamp origin: (80, 110). Length = 280px. Thickness = 16px.
  const clampX = 80;
  const clampY = 110;
  const beamLength = 260;
  const beamThickness = 14;

  // Scale tip deflection: 1 mm -> 18 px in SVG
  const pxPerMm = 18;
  const tipDeflectionPx = -currentAct * pxPerMm; // inverted for SVG (up is negative y)
  const desTipPx = -currentDes * pxPerMm;

  // Quadratic/cubic spline beam deflection curve: y(x) = y_tip * (x/L)^2
  const segments = 24;
  const topPathPoints: [number, number][] = [];
  const bottomPathPoints: [number, number][] = [];
  const centerPathPoints: [number, number][] = [];

  for (let i = 0; i <= segments; i++) {
    const s = i / segments; // 0 to 1
    const x = clampX + s * beamLength;
    // Standard cantilever deflection under uniform bending moment ~ s^2
    const def = tipDeflectionPx * (s * s);
    const slope = 2 * (tipDeflectionPx / beamLength) * s;
    const angle = Math.atan(slope);

    // Perpendicular normal vector for beam thickness
    const nx = -Math.sin(angle) * (beamThickness / 2);
    const ny = Math.cos(angle) * (beamThickness / 2);

    topPathPoints.push([x + nx, clampY + def + ny]);
    bottomPathPoints.push([x - nx, clampY + def - ny]);
    centerPathPoints.push([x, clampY + def]);
  }

  // Construct SVG polygon path for 3-layer IPMC
  const topElectrodePath = topPathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const bottomElectrodePath = bottomPathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');

  // Full composite outline
  const beamPolygon = `${topElectrodePath} ` +
    bottomPathPoints.slice().reverse().map((p) => `L ${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') +
    ' Z';

  // Laser sensor location (tip inspection)
  const tipCenter = centerPathPoints[centerPathPoints.length - 1];
  const laserX = clampX + beamLength;
  const laserY = 25; // Top laser sensor box

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Physical Actuator Cantilever Kinematics
          </span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs font-mono text-slate-600">
            Strategy: <strong className="text-slate-900">{strategyName}</strong>
          </span>
        </div>

        {/* Telemetry chips */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-400">t = </span>
            <span className="font-semibold text-slate-800">{currentTime.toFixed(2)} s</span>
          </div>
          <div>
            <span className="text-slate-400">V_in = </span>
            <span className={`font-semibold ${Math.abs(currentV) >= 1.99 ? 'text-amber-600' : 'text-slate-800'}`}>
              {currentV.toFixed(2)} V
            </span>
          </div>
          <div>
            <span className="text-slate-400">y_tip = </span>
            <span className="font-bold text-blue-600">{currentAct.toFixed(3)} mm</span>
          </div>
        </div>
      </div>

      {/* SVG Stage */}
      <div className="relative w-full h-[220px] bg-slate-900 overflow-hidden select-none">
        {/* Subtle engineering grid */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, #94a3b8 1px, transparent 1px)`,
            backgroundSize: '16px 16px',
          }}
        />

        <svg className="w-full h-full" viewBox="0 0 460 220" preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Platinum electrode gradient */}
            <linearGradient id="ptGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="50%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>

            {/* Polymer membrane gradient reacting to voltage */}
            <linearGradient id="polymerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop
                offset="0%"
                stopColor={currentV > 0 ? '#38bdf8' : '#818cf8'}
                stopOpacity="0.8"
              />
              <stop
                offset="100%"
                stopColor={currentV > 0 ? '#818cf8' : '#38bdf8'}
                stopOpacity="0.8"
              />
            </linearGradient>

            {/* Laser beam glow */}
            <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Neutral zero-deflection baseline */}
          <line
            x1={clampX}
            y1={clampY}
            x2={clampX + beamLength + 40}
            y2={clampY}
            stroke="#334155"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Desired reference line marker */}
          <line
            x1={clampX + beamLength - 10}
            y1={clampY + desTipPx}
            x2={clampX + beamLength + 30}
            y2={clampY + desTipPx}
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <text
            x={clampX + beamLength + 35}
            y={clampY + desTipPx + 4}
            fill="#f59e0b"
            fontSize="10"
            fontFamily="monospace"
          >
            r: {currentDes.toFixed(2)} mm
          </text>

          {/* Laser Displacement Sensor Head */}
          <rect
            x={laserX - 22}
            y={laserY - 14}
            width="44"
            height="22"
            fill="#1e293b"
            stroke="#475569"
            strokeWidth="1.5"
            rx="3"
          />
          <text
            x={laserX}
            y={laserY}
            fill="#94a3b8"
            fontSize="8"
            textAnchor="middle"
            fontFamily="monospace"
          >
            KEYENCE LASER
          </text>

          {/* Laser beam shooting down to cantilever tip */}
          <line
            x1={laserX}
            y1={laserY + 8}
            x2={tipCenter[0]}
            y2={tipCenter[1]}
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeOpacity="0.9"
            filter="url(#laserGlow)"
          />

          {/* Red reflection laser spot on cantilever */}
          <circle
            cx={tipCenter[0]}
            cy={tipCenter[1]}
            r="3"
            fill="#ef4444"
            filter="url(#laserGlow)"
          />

          {/* IPMC Cantilever Beam Membrane */}
          <path d={beamPolygon} fill="url(#polymerGrad)" stroke="#1e293b" strokeWidth="0.5" />

          {/* Top Platinum Electrode Layer */}
          <path
            d={topElectrodePath}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Bottom Platinum Electrode Layer */}
          <path
            d={bottomElectrodePath}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Cantilever Clamp Mount (x = 0) */}
          <rect
            x={clampX - 35}
            y={clampY - 35}
            width="35"
            height="70"
            fill="#1e293b"
            stroke="#475569"
            strokeWidth="1.5"
            rx="2"
          />
          {/* Clamp mounting screws */}
          <circle cx={clampX - 18} cy={clampY - 20} r="3.5" fill="#334155" stroke="#64748b" />
          <circle cx={clampX - 18} cy={clampY + 20} r="3.5" fill="#334155" stroke="#64748b" />

          {/* Electrode Contact Wires */}
          <path
            d={`M ${clampX - 5} ${clampY - 14} Q ${clampX - 12} ${clampY - 28} ${clampX - 25} ${clampY - 28}`}
            stroke={currentV >= 0 ? '#ef4444' : '#3b82f6'}
            strokeWidth="2"
            fill="none"
          />
          <text
            x={clampX - 28}
            y={clampY - 25}
            fill={currentV >= 0 ? '#ef4444' : '#3b82f6'}
            fontSize="10"
            fontWeight="bold"
            textAnchor="end"
            fontFamily="monospace"
          >
            {currentV >= 0 ? '+V' : '−V'}
          </text>

          <path
            d={`M ${clampX - 5} ${clampY + 14} Q ${clampX - 12} ${clampY + 28} ${clampX - 25} ${clampY + 28}`}
            stroke={currentV >= 0 ? '#3b82f6' : '#ef4444'}
            strokeWidth="2"
            fill="none"
          />
          <text
            x={clampX - 28}
            y={clampY + 32}
            fill={currentV >= 0 ? '#3b82f6' : '#ef4444'}
            fontSize="10"
            fontWeight="bold"
            textAnchor="end"
            fontFamily="monospace"
          >
            GND
          </text>

          {/* Hydrodynamic Drag Disturbance Vector (acting opposite to velocity) */}
          {Math.abs(currentDrag) > 0.01 && (
            <g transform={`translate(${tipCenter[0]}, ${tipCenter[1]})`}>
              <line
                x1="0"
                y1="0"
                x2="0"
                y2={currentDrag > 0 ? -24 : 24}
                stroke="#06b6d4"
                strokeWidth="2.5"
                markerEnd="url(#arrow)"
              />
              <text
                x="8"
                y={currentDrag > 0 ? -12 : 16}
                fill="#06b6d4"
                fontSize="9"
                fontFamily="monospace"
              >
                f_drag: {currentDrag.toFixed(2)}
              </text>
            </g>
          )}

          {/* Tip displacement readout HUD */}
          <g transform={`translate(${clampX + beamLength + 5}, ${clampY + 40})`}>
            <text x="0" y="0" fill="#94a3b8" fontSize="10" fontFamily="monospace">
              Deflection Δy:
            </text>
            <text x="0" y="16" fill="#38bdf8" fontSize="14" fontWeight="bold" fontFamily="monospace">
              {currentAct.toFixed(3)} mm
            </text>
            <text x="0" y="30" fill="#64748b" fontSize="9" fontFamily="monospace">
              e: {(currentDes - currentAct).toFixed(3)} mm
            </text>
          </g>

          {/* Scale bar indicator (2 mm = 36 px) */}
          <g transform="translate(20, 195)">
            <line x1="0" y1="0" x2="36" y2="0" stroke="#64748b" strokeWidth="2" />
            <line x1="0" y1="-3" x2="0" y2="3" stroke="#64748b" strokeWidth="1" />
            <line x1="36" y1="-3" x2="36" y2="3" stroke="#64748b" strokeWidth="1" />
            <text x="18" y="-6" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">
              2 mm
            </text>
          </g>
        </svg>
      </div>

      {/* Scrubbing & Playback controls */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-50 border-t border-slate-200">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shrink-0"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>

        <button
          onClick={() => {
            setCurrentIndex(0);
            setIsPlaying(true);
          }}
          className="p-1.5 text-slate-500 hover:text-slate-800 transition-colors rounded-md"
          title="Reset to 0s"
        >
          <RotateCcw size={14} />
        </button>

        {/* Timeline Scrubber */}
        <div className="flex-1 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, numPoints - 1)}
            value={idx}
            onChange={(e) => {
              setCurrentIndex(Number(e.target.value));
              setIsPlaying(false);
            }}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
          />
        </div>

        {/* Speed multiplier selector */}
        <div className="flex items-center gap-1 text-xs">
          {[0.5, 1, 2].map((spd) => (
            <button
              key={spd}
              onClick={() => setPlaybackSpeed(spd)}
              className={`px-2 py-0.5 rounded font-mono transition-colors ${
                playbackSpeed === spd
                  ? 'bg-slate-900 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
