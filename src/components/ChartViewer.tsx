import React, { useState, useMemo } from 'react';

export interface ChartTrace {
  name: string;
  data: [number, number][]; // [x, y]
  color: string;
  strokeDasharray?: string;
  strokeWidth?: number;
  isScatter?: boolean;
  opacity?: number;
}

export interface ChartReferenceLine {
  y?: number;
  x?: number;
  label?: string;
  color: string;
  strokeDasharray?: string;
}

export interface ShadedRegion {
  xMin: number;
  xMax: number;
  label?: string;
  color?: string;
}

interface ChartViewerProps {
  title: string;
  xLabel: string;
  yLabel: string;
  traces: ChartTrace[];
  refLines?: ChartReferenceLine[];
  shadedRegions?: ShadedRegion[];
  height?: number;
  yMinFixed?: number;
  yMaxFixed?: number;
}

export const ChartViewer: React.FC<ChartViewerProps> = ({
  title,
  xLabel,
  yLabel,
  traces,
  refLines = [],
  shadedRegions = [],
  height = 260,
  yMinFixed,
  yMaxFixed,
}) => {
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number; pixelX: number } | null>(null);
  const [hiddenTraces, setHiddenTraces] = useState<Record<string, boolean>>({});

  // Compute bounding boxes
  const { xMin, xMax, yMin, yMax } = useMemo<{
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  }>(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = yMinFixed !== undefined ? yMinFixed : Infinity;
    let maxY = yMaxFixed !== undefined ? yMaxFixed : -Infinity;

    for (const trace of traces) {
      if (hiddenTraces[trace.name]) continue;
      for (const [x, y] of trace.data) {
        if (!isNaN(x) && isFinite(x)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
        if (yMinFixed === undefined && !isNaN(y) && isFinite(y)) {
          if (y < minY) minY = y;
        }
        if (yMaxFixed === undefined && !isNaN(y) && isFinite(y)) {
          if (y > maxY) maxY = y;
        }
      }
    }

    if (minX === Infinity) minX = 0;
    if (maxX === -Infinity) maxX = 10;
    if (minY === Infinity) minY = -1;
    if (maxY === -Infinity) maxY = 1;

    // Add padding to y if not fixed
    const dy = maxY - minY || 1.0;
    if (yMinFixed === undefined) minY -= 0.08 * dy;
    if (yMaxFixed === undefined) maxY += 0.08 * dy;

    return { xMin: minX, xMax: maxX, yMin: minY, yMax: maxY };
  }, [traces, hiddenTraces, yMinFixed, yMaxFixed]);

  // Layout margins
  const margin = { top: 20, right: 24, bottom: 36, left: 54 };
  const width = 640; // Reference viewBox width
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const scaleX = (x: number) => {
    const range = xMax - xMin || 1;
    return margin.left + ((x - xMin) / range) * plotWidth;
  };

  const scaleY = (y: number) => {
    const range = yMax - yMin || 1;
    return margin.top + plotHeight - ((y - yMin) / range) * plotHeight;
  };

  const unscaleX = (pixelX: number) => {
    const range = xMax - xMin || 1;
    return xMin + ((pixelX - margin.left) / plotWidth) * range;
  };

  // Generate grid ticks
  const xTicks = useMemo(() => {
    const count = 5;
    const ticks: number[] = [];
    const step = (xMax - xMin) / count;
    for (let i = 0; i <= count; i++) {
      ticks.push(xMin + i * step);
    }
    return ticks;
  }, [xMin, xMax]);

  const yTicks = useMemo(() => {
    const count = 4;
    const ticks: number[] = [];
    const step = (yMax - yMin) / count;
    for (let i = 0; i <= count; i++) {
      ticks.push(yMin + i * step);
    }
    return ticks;
  }, [yMin, yMax]);

  const toggleTrace = (name: string) => {
    setHiddenTraces((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col">
      {/* Top Header & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
        <h4 className="text-xs font-semibold text-slate-800 tracking-tight">{title}</h4>

        {/* Legend pills */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {traces.map((tr) => {
            const isHidden = hiddenTraces[tr.name];
            return (
              <button
                key={tr.name}
                onClick={() => toggleTrace(tr.name)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-opacity cursor-pointer ${
                  isHidden ? 'opacity-40 line-through' : 'opacity-100 hover:bg-slate-100'
                }`}
              >
                <span
                  className="w-3 h-0.5 inline-block rounded"
                  style={{
                    backgroundColor: tr.color,
                    borderTop: tr.strokeDasharray ? `1px dashed ${tr.color}` : undefined,
                  }}
                />
                <span className="font-mono text-[11px] text-slate-700">{tr.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative p-2 w-full select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;
            if (relX >= margin.left && relX <= margin.left + plotWidth) {
              const valX = unscaleX(relX);
              setHoverPoint({ x: valX, y: 0, pixelX: relX });
            }
          }}
          onMouseLeave={() => setHoverPoint(null)}
        >
          {/* Shaded Regions (e.g. transient 0-50 samples) */}
          {shadedRegions.map((reg, idx) => {
            const x1 = Math.max(margin.left, scaleX(reg.xMin));
            const x2 = Math.min(margin.left + plotWidth, scaleX(reg.xMax));
            const w = Math.max(0, x2 - x1);
            return (
              <g key={idx}>
                <rect
                  x={x1}
                  y={margin.top}
                  width={w}
                  height={plotHeight}
                  fill={reg.color || '#94a3b8'}
                  fillOpacity="0.12"
                />
                {reg.label && (
                  <text
                    x={x1 + 6}
                    y={margin.top + 14}
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {reg.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Grid lines */}
          {xTicks.map((xVal, i) => {
            const xPos = scaleX(xVal);
            return (
              <line
                key={`gx-${i}`}
                x1={xPos}
                y1={margin.top}
                x2={xPos}
                y2={margin.top + plotHeight}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
            );
          })}

          {yTicks.map((yVal, i) => {
            const yPos = scaleY(yVal);
            return (
              <line
                key={`gy-${i}`}
                x1={margin.left}
                y1={yPos}
                x2={margin.left + plotWidth}
                y2={yPos}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
            );
          })}

          {/* Reference Lines (e.g. Saturation +/-2V, 0 line, etc.) */}
          {refLines.map((ref, i) => {
            if (ref.y !== undefined) {
              const yPos = scaleY(ref.y);
              return (
                <g key={`ref-${i}`}>
                  <line
                    x1={margin.left}
                    y1={yPos}
                    x2={margin.left + plotWidth}
                    y2={yPos}
                    stroke={ref.color}
                    strokeWidth="1.2"
                    strokeDasharray={ref.strokeDasharray || '4 3'}
                  />
                  {ref.label && (
                    <text
                      x={margin.left + plotWidth - 4}
                      y={yPos - 4}
                      fill={ref.color}
                      fontSize="9"
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      {ref.label}
                    </text>
                  )}
                </g>
              );
            }
            return null;
          })}

          {/* Plot Traces */}
          {traces.map((trace) => {
            if (hiddenTraces[trace.name] || trace.data.length === 0) return null;

            if (trace.isScatter) {
              // Scatter dots
              return (
                <g key={trace.name} opacity={trace.opacity || 0.6}>
                  {trace.data.map(([x, y], idx) => {
                    const cx = scaleX(x);
                    const cy = scaleY(y);
                    if (isNaN(cx) || isNaN(cy)) return null;
                    return (
                      <circle
                        key={idx}
                        cx={cx}
                        cy={cy}
                        r="1.8"
                        fill={trace.color}
                      />
                    );
                  })}
                </g>
              );
            }

            // Line path
            let d = '';
            for (let i = 0; i < trace.data.length; i++) {
              const [x, y] = trace.data[i];
              const px = scaleX(x);
              const py = scaleY(y);
              if (isNaN(px) || isNaN(py)) continue;
              d += (i === 0 || d === '' ? 'M' : 'L') + ` ${px.toFixed(1)},${py.toFixed(1)}`;
            }

            return (
              <path
                key={trace.name}
                d={d}
                fill="none"
                stroke={trace.color}
                strokeWidth={trace.strokeWidth || 1.8}
                strokeDasharray={trace.strokeDasharray}
                opacity={trace.opacity || 1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {/* Interactive Crosshair Hover Line */}
          {hoverPoint && (
            <line
              x1={hoverPoint.pixelX}
              y1={margin.top}
              x2={hoverPoint.pixelX}
              y2={margin.top + plotHeight}
              stroke="#64748b"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}

          {/* Hairline Axes */}
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={margin.top + plotHeight}
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          <line
            x1={margin.left}
            y1={margin.top + plotHeight}
            x2={margin.left + plotWidth}
            y2={margin.top + plotHeight}
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          {/* Ticks and Axis Labels */}
          {xTicks.map((xVal, i) => (
            <text
              key={`xt-${i}`}
              x={scaleX(xVal)}
              y={margin.top + plotHeight + 14}
              fontSize="9"
              fill="#64748b"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {Math.abs(xVal) < 0.001 && Math.abs(xVal) > 0 ? '0' : xVal.toFixed(2)}
            </text>
          ))}

          {yTicks.map((yVal, i) => (
            <text
              key={`yt-${i}`}
              x={margin.left - 6}
              y={scaleY(yVal) + 3}
              fontSize="9"
              fill="#64748b"
              textAnchor="end"
              fontFamily="monospace"
            >
              {yVal.toFixed(2)}
            </text>
          ))}

          {/* Axis Titles */}
          <text
            x={margin.left + plotWidth / 2}
            y={height - 4}
            fontSize="10"
            fill="#475569"
            textAnchor="middle"
            fontWeight="500"
          >
            {xLabel}
          </text>
          <text
            x={-(margin.top + plotHeight / 2)}
            y="14"
            fontSize="10"
            fill="#475569"
            textAnchor="middle"
            fontWeight="500"
            transform="rotate(-90)"
          >
            {yLabel}
          </text>
        </svg>

        {/* Live Hover Probe values HUD */}
        {hoverPoint && (
          <div
            className="absolute top-2 right-4 bg-slate-900/90 text-white rounded-md px-2.5 py-1.5 text-[11px] font-mono shadow-md backdrop-blur-xs pointer-events-none z-10"
          >
            <div className="text-slate-400 border-b border-slate-700 pb-0.5 mb-1">
              {xLabel}: <span className="text-white font-bold">{hoverPoint.x.toFixed(3)}</span>
            </div>
            {traces
              .filter((tr) => !hiddenTraces[tr.name])
              .map((tr) => {
                // Find nearest point
                const pt = tr.data.reduce((prev, curr) =>
                  Math.abs(curr[0] - hoverPoint.x) < Math.abs(prev[0] - hoverPoint.x) ? curr : prev
                );
                return (
                  <div key={tr.name} className="flex items-center justify-between gap-3">
                    <span style={{ color: tr.color }}>{tr.name}:</span>
                    <span className="font-semibold">{pt ? pt[1].toFixed(3) : '—'}</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};
