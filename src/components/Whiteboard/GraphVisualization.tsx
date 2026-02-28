'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FunctionConfig, VisualizationType } from '@/types';

interface GraphVisualizationProps {
  visualizationType: VisualizationType;
  functionConfig?: FunctionConfig;
}

// Safe math expression evaluator using Function constructor with Math namespace
function createEvaluator(expression: string): ((x: number) => number) | null {
  if (!expression) return null;
  // Sanitize: only allow safe math characters
  const safe = /^[x\d\s\+\-\*\/\.\(\)Math\.,sincotanlogpowexpabsfloorceiltanh]+$/;
  const fullExpr = `Math.pow(x,0)*0+${expression}`; // Force x usage check
  if (!safe.test(expression.replace(/Math\.\w+/g, 'Math.x'))) return null;
  try {
    const fn = new Function(
      'x',
      `"use strict"; const {sin,cos,tan,log,exp,abs,pow,sqrt,PI,E,floor,ceil,tanh,sinh,cosh,asin,acos,atan} = Math; return ${expression};`
    ) as (x: number) => number;
    // Test it
    const test = fn(1);
    if (typeof test !== 'number') return null;
    void fullExpr;
    return (x: number) => {
      try {
        const v = fn(x);
        return isFinite(v) ? v : NaN;
      } catch {
        return NaN;
      }
    };
  } catch {
    return null;
  }
}

// Generate SVG path points from a function
function generatePath(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  width: number,
  height: number,
  steps = 300
): string {
  const points: string[] = [];
  let penDown = false;

  for (let i = 0; i <= steps; i++) {
    const x = xMin + (i / steps) * (xMax - xMin);
    const y = fn(x);

    if (!isFinite(y) || y < yMin - 1 || y > yMax + 1) {
      penDown = false;
      continue;
    }

    const px = ((x - xMin) / (xMax - xMin)) * width;
    const py = height - ((y - yMin) / (yMax - yMin)) * height;

    if (!penDown) {
      points.push(`M ${px.toFixed(2)} ${py.toFixed(2)}`);
      penDown = true;
    } else {
      points.push(`L ${px.toFixed(2)} ${py.toFixed(2)}`);
    }
  }

  return points.join(' ');
}

// ─── SVG Graph Canvas ─────────────────────────────────────────────────────────

const W = 480;
const H = 320;
const PAD = 40;

interface CanvasProps {
  xMin: number; xMax: number; yMin: number; yMax: number;
  toSvgX: (x: number) => number;
  toSvgY: (y: number) => number;
  fn: (x: number) => number;
  children?: React.ReactNode;
}

function GraphCanvas({ xMin, xMax, yMin, yMax, toSvgX, toSvgY, fn, children }: CanvasProps) {
  const path = useMemo(
    () => generatePath(fn, xMin, xMax, yMin, yMax, W, H),
    [fn, xMin, xMax, yMin, yMax]
  );

  // Axis ticks
  const xTicks = Array.from({ length: 5 }, (_, i) =>
    xMin + (i / 4) * (xMax - xMin)
  ).map((v) => parseFloat(v.toFixed(1)));

  const yTicks = Array.from({ length: 5 }, (_, i) =>
    yMin + (i / 4) * (yMax - yMin)
  ).map((v) => parseFloat(v.toFixed(1)));

  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${W + PAD * 2} ${H + PAD * 2}`}
      className="w-full h-full"
      style={{ fontFamily: 'monospace' }}
    >
      {/* Grid */}
      {xTicks.map((v) => (
        <line
          key={`gx-${v}`}
          x1={toSvgX(v)} y1={0} x2={toSvgX(v)} y2={H}
          stroke="#2e2e48" strokeWidth="1"
        />
      ))}
      {yTicks.map((v) => (
        <line
          key={`gy-${v}`}
          x1={0} y1={toSvgY(v)} x2={W} y2={toSvgY(v)}
          stroke="#2e2e48" strokeWidth="1"
        />
      ))}

      {/* Axes */}
      {xMin < 0 && xMax > 0 && (
        <line x1={toSvgX(0)} y1={0} x2={toSvgX(0)} y2={H} stroke="#4f4f70" strokeWidth="1.5" />
      )}
      {yMin < 0 && yMax > 0 && (
        <line x1={0} y1={toSvgY(0)} x2={W} y2={toSvgY(0)} stroke="#4f4f70" strokeWidth="1.5" />
      )}

      {/* X-axis labels */}
      {xTicks.map((v) => (
        <text
          key={`xl-${v}`}
          x={toSvgX(v)}
          y={H + 18}
          textAnchor="middle"
          fill="#666688"
          fontSize="11"
        >
          {v}
        </text>
      ))}

      {/* Y-axis labels */}
      {yTicks.map((v) => (
        <text
          key={`yl-${v}`}
          x={-8}
          y={toSvgY(v) + 4}
          textAnchor="end"
          fill="#666688"
          fontSize="11"
        >
          {v}
        </text>
      ))}

      {/* Function curve */}
      <motion.path
        d={path}
        fill="none"
        stroke="#4f9cf9"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />

      {children}
    </svg>
  );
}

// ─── Limit Visualization ──────────────────────────────────────────────────────

function LimitViz({ fn, config, toSvgX, toSvgY }: {
  fn: (x: number) => number;
  config: FunctionConfig;
  toSvgX: (x: number) => number;
  toSvgY: (y: number) => number;
}) {
  const approach = config.limit_approach ?? 2;
  const limitY = config.limit_value ?? fn(approach);
  const [pointX, setPointX] = useState(approach + 1.8);

  useEffect(() => {
    let t = 0;
    const id = setInterval(() => {
      t += 0.04;
      const x = approach + 1.8 * Math.exp(-t * 1.5);
      setPointX(x);
      if (Math.abs(x - approach) < 0.02) {
        setPointX(approach + 0.001);
        clearInterval(id);
      }
    }, 50);
    return () => clearInterval(id);
  }, [approach]);

  const px = toSvgX(pointX);
  const py = toSvgY(fn(pointX));
  const limitPx = toSvgX(approach);
  const limitPy = toSvgY(limitY);

  return (
    <>
      {/* Vertical dashed line at limit point */}
      <line
        x1={limitPx} y1={0} x2={limitPx} y2={H}
        stroke="#fbbf24" strokeWidth="1" strokeDasharray="5,4" opacity={0.6}
      />
      {/* Horizontal dashed line at limit value */}
      <line
        x1={0} y1={limitPy} x2={W} y2={limitPy}
        stroke="#fbbf24" strokeWidth="1" strokeDasharray="5,4" opacity={0.6}
      />
      {/* Approaching point */}
      <circle cx={px} cy={py} r={6} fill="#4f9cf9" opacity={0.9} />
      {/* Limit point (open circle — shows the limit exists) */}
      <circle cx={limitPx} cy={limitPy} r={7} fill="none" stroke="#34d399" strokeWidth="2" />
      <circle cx={limitPx} cy={limitPy} r={3} fill="#34d399" />
    </>
  );
}

// ─── Derivative Visualization ─────────────────────────────────────────────────

function DerivativeViz({ fn, config, toSvgX, toSvgY }: {
  fn: (x: number) => number;
  config: FunctionConfig;
  toSvgX: (x: number) => number;
  toSvgY: (y: number) => number;
}) {
  const x0 = config.derivative_point ?? 1;
  const [h, setH] = useState(1.5);

  useEffect(() => {
    let t = 0;
    const id = setInterval(() => {
      t += 0.06;
      const newH = 1.5 * Math.exp(-t * 1.2);
      setH(newH < 0.02 ? 0.001 : newH);
      if (newH < 0.02) clearInterval(id);
    }, 60);
    return () => clearInterval(id);
  }, [x0]);

  // Secant / tangent slope
  const slope = h > 0.005
    ? (fn(x0 + h) - fn(x0 - h)) / (2 * h)
    : (fn(x0 + 0.001) - fn(x0)) / 0.001; // Numerical derivative

  const y0 = fn(x0);
  const extent = 1.5;
  const x1 = x0 - extent; const y1 = y0 + slope * (-extent);
  const x2 = x0 + extent; const y2 = y0 + slope * extent;

  const color = h < 0.05 ? '#34d399' : '#fbbf24';

  return (
    <>
      {/* Tangent / secant line */}
      <line
        x1={toSvgX(x1)} y1={toSvgY(y1)}
        x2={toSvgX(x2)} y2={toSvgY(y2)}
        stroke={color} strokeWidth="2" strokeLinecap="round"
      />
      {/* Point on curve */}
      <circle cx={toSvgX(x0)} cy={toSvgY(y0)} r={6} fill="#4f9cf9" />
      {/* Second point (for secant) */}
      {h > 0.1 && (
        <circle cx={toSvgX(x0 + h)} cy={toSvgY(fn(x0 + h))} r={5} fill="#fbbf24" opacity={0.7} />
      )}
    </>
  );
}

// ─── Integral Visualization ───────────────────────────────────────────────────

function IntegralViz({ fn, config, toSvgX, toSvgY, xMin, yMin, yMax }: {
  fn: (x: number) => number;
  config: FunctionConfig;
  toSvgX: (x: number) => number;
  toSvgY: (y: number) => number;
  xMin: number; yMin: number; yMax: number;
}) {
  const a = config.integral_a ?? 0;
  const b = config.integral_b ?? 2;
  const [n, setN] = useState(4);

  useEffect(() => {
    const steps = [4, 8, 16, 32, 64, 0]; // 0 = smooth fill
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i >= steps.length) { clearInterval(id); return; }
      setN(steps[i]);
    }, 500);
    return () => clearInterval(id);
  }, [a, b]);

  const zero = toSvgY(Math.max(yMin, 0));

  if (n === 0) {
    // Smooth shaded area using SVG path
    const steps = 100;
    const pathPts: string[] = [`M ${toSvgX(a)} ${zero}`];
    for (let i = 0; i <= steps; i++) {
      const x = a + (i / steps) * (b - a);
      const y = fn(x);
      if (isFinite(y) && y >= yMin && y <= yMax) {
        pathPts.push(`L ${toSvgX(x)} ${toSvgY(y)}`);
      }
    }
    pathPts.push(`L ${toSvgX(b)} ${zero} Z`);
    return (
      <path
        d={pathPts.join(' ')}
        fill="#a78bfa"
        opacity={0.35}
        stroke="#a78bfa"
        strokeWidth="1"
      />
    );
  }

  // Riemann rectangles
  const rects: JSX.Element[] = [];
  const dx = (b - a) / n;
  for (let i = 0; i < n; i++) {
    const x = a + i * dx;
    const midX = x + dx / 2;
    const y = fn(midX);
    if (!isFinite(y)) continue;

    const svgX = toSvgX(x);
    const svgY = toSvgY(y);
    const svgW = toSvgX(x + dx) - svgX;
    const height = Math.abs(zero - svgY);

    rects.push(
      <rect
        key={i}
        x={svgX}
        y={y >= 0 ? svgY : zero}
        width={Math.abs(svgW)}
        height={height}
        fill="#a78bfa"
        opacity={0.4}
        stroke="#a78bfa"
        strokeWidth="0.5"
      />
    );
  }

  return <>{rects}</>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function GraphVisualization({ visualizationType, functionConfig }: GraphVisualizationProps) {
  const config = functionConfig ?? { expression: 'Math.pow(x, 2)' };
  const xMin = config.x_min ?? -4;
  const xMax = config.x_max ?? 4;
  const yMin = config.y_min ?? -2;
  const yMax = config.y_max ?? 10;

  const fn = useMemo(() => createEvaluator(config.expression), [config.expression]);

  const toSvgX = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
  const toSvgY = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;

  if (!fn || visualizationType === 'none') return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${visualizationType}-${config.expression}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full bg-surface-200 rounded-xl border border-surface-300 p-3 overflow-hidden"
      >
        <GraphCanvas
          xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax}
          toSvgX={toSvgX} toSvgY={toSvgY} fn={fn}
        >
          {visualizationType === 'limit' && (
            <LimitViz fn={fn} config={config} toSvgX={toSvgX} toSvgY={toSvgY} />
          )}
          {visualizationType === 'derivative' && (
            <DerivativeViz fn={fn} config={config} toSvgX={toSvgX} toSvgY={toSvgY} />
          )}
          {visualizationType === 'integral' && (
            <IntegralViz
              fn={fn} config={config}
              toSvgX={toSvgX} toSvgY={toSvgY}
              xMin={xMin} yMin={yMin} yMax={yMax}
            />
          )}
        </GraphCanvas>
      </motion.div>
    </AnimatePresence>
  );
}
