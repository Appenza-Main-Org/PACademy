/**
 * FourLayerDiagram — interactive inline-SVG four-layer architecture diagram.
 *
 * Each layer is clickable; selecting one expands an inline detail panel
 * below the diagram showing what runs at that layer, the security boundary,
 * data-flow direction, and the karasa citation.
 *
 * Inline SVG only — per Tasks/DESIGN_SYSTEM.md no third-party chart libs.
 * Honors prefers-reduced-motion via CSS-driven transitions only.
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { LayerSpec } from '../data';

interface Props {
  layers: readonly LayerSpec[];
}

const ROW_HEIGHT = 88;
const ROW_GAP = 22;
const SVG_WIDTH = 760;
const SVG_PADDING_X = 12;

export function FourLayerDiagram({ layers }: Props): JSX.Element {
  const [openId, setOpenId] = useState<string>(layers[0]?.id ?? '');
  const totalHeight =
    layers.length * ROW_HEIGHT + (layers.length - 1) * ROW_GAP + 4;

  return (
    <div className="arch-layer-diagram">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${totalHeight}`}
          width="100%"
          height={totalHeight}
          role="img"
          aria-label="Four-layer architecture diagram"
          className="block"
        >
          {layers.map((layer, idx) => {
            const y = idx * (ROW_HEIGHT + ROW_GAP);
            const isOpen = layer.id === openId;
            return (
              <g
                key={layer.id}
                onClick={() => setOpenId(layer.id)}
                style={{ cursor: 'pointer' }}
                tabIndex={0}
                role="button"
                aria-pressed={isOpen}
                aria-label={`Layer ${idx + 1}: ${layer.title}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpenId(layer.id);
                  }
                }}
              >
                <rect
                  x={SVG_PADDING_X}
                  y={y}
                  width={SVG_WIDTH - SVG_PADDING_X * 2}
                  height={ROW_HEIGHT}
                  rx={10}
                  ry={10}
                  fill={isOpen ? 'var(--teal-50)' : 'var(--surface-card)'}
                  stroke={isOpen ? 'var(--teal-500)' : 'var(--border-default)'}
                  strokeWidth={isOpen ? 1.75 : 1}
                  data-chart-stroke
                  className="transition-colors"
                />
                {/* Index pill */}
                <circle
                  cx={SVG_PADDING_X + 28}
                  cy={y + ROW_HEIGHT / 2}
                  r={16}
                  fill={isOpen ? 'var(--teal-500)' : 'var(--ink-100)'}
                />
                <text
                  x={SVG_PADDING_X + 28}
                  y={y + ROW_HEIGHT / 2 + 5}
                  fontSize={14}
                  fontWeight={700}
                  textAnchor="middle"
                  fontFamily="var(--font-en)"
                  fill={isOpen ? '#FFFFFF' : 'var(--ink-700)'}
                >
                  {idx + 1}
                </text>
                {/* Title */}
                <text
                  x={SVG_PADDING_X + 56}
                  y={y + 36}
                  fontSize={17}
                  fontWeight={700}
                  fontFamily="var(--font-en)"
                  fill="var(--ink-900)"
                >
                  {layer.title}
                </text>
                {/* Surface tag */}
                <text
                  x={SVG_PADDING_X + 56}
                  y={y + 58}
                  fontSize={12}
                  fontFamily="var(--font-en)"
                  fill="var(--ink-500)"
                >
                  {layer.surface}
                </text>
                {/* Right-side: number of components */}
                <text
                  x={SVG_WIDTH - SVG_PADDING_X - 16}
                  y={y + 36}
                  fontSize={11}
                  fontFamily="var(--font-en)"
                  fontWeight={500}
                  textAnchor="end"
                  letterSpacing={0.6}
                  fill="var(--ink-500)"
                >
                  {layer.whatRuns.length} COMPONENTS
                </text>
                <text
                  x={SVG_WIDTH - SVG_PADDING_X - 16}
                  y={y + 58}
                  fontSize={11}
                  fontFamily="var(--font-en)"
                  fontWeight={500}
                  textAnchor="end"
                  fill={isOpen ? 'var(--teal-700)' : 'var(--ink-400)'}
                >
                  {isOpen ? 'EXPANDED ▾' : 'CLICK TO EXPAND'}
                </text>
                {/* Bottom hairline label inside */}
                <line
                  x1={SVG_PADDING_X + 56}
                  y1={y + 70}
                  x2={SVG_WIDTH - SVG_PADDING_X - 100}
                  y2={y + 70}
                  stroke="var(--border-subtle)"
                  data-chart-stroke
                />
                <text
                  x={SVG_PADDING_X + 56}
                  y={y + 82}
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill="var(--ink-500)"
                >
                  {layer.citation}
                </text>
              </g>
            );
          })}

          {/* Inter-layer arrows */}
          {layers.slice(0, -1).map((_, idx) => {
            const yTop = idx * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT + 2;
            const yMid = yTop + ROW_GAP / 2 - 1;
            const yBot = yTop + ROW_GAP - 4;
            return (
              <g key={`arrow-${idx}`} aria-hidden>
                <line
                  x1={SVG_WIDTH / 2}
                  y1={yTop}
                  x2={SVG_WIDTH / 2}
                  y2={yBot}
                  stroke="var(--ink-300)"
                  strokeWidth={1}
                  data-chart-stroke
                />
                {/* down chevron */}
                <polyline
                  points={`${SVG_WIDTH / 2 - 5},${yMid - 2} ${SVG_WIDTH / 2},${yMid + 3} ${SVG_WIDTH / 2 + 5},${yMid - 2}`}
                  fill="none"
                  stroke="var(--ink-400)"
                  strokeWidth={1.25}
                  data-chart-stroke
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* up chevron */}
                <polyline
                  points={`${SVG_WIDTH / 2 - 5},${yMid + 6} ${SVG_WIDTH / 2},${yMid + 1} ${SVG_WIDTH / 2 + 5},${yMid + 6}`}
                  fill="none"
                  stroke="var(--ink-400)"
                  strokeWidth={1.25}
                  data-chart-stroke
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail panel — shown for the currently-selected layer */}
      <div className="mt-5 grid gap-3">
        {layers.map((layer) => {
          const isOpen = layer.id === openId;
          return (
            <div
              key={`panel-${layer.id}`}
              data-arch-layer-panel={layer.id}
              className={cn(
                'rounded-lg border bg-surface-card transition-colors duration-fast ease-standard',
                isOpen ? 'border-teal-300 shadow-xs' : 'border-border-subtle opacity-90',
              )}
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? '' : layer.id)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-start"
                aria-expanded={isOpen}
                aria-controls={`layer-panel-body-${layer.id}`}
              >
                <span className="flex items-baseline gap-3">
                  <span className="font-numeric tnum text-xs text-ink-500">
                    Layer {layers.indexOf(layer) + 1}
                  </span>
                  <span className="text-md font-bold text-ink-900">{layer.title}</span>
                  <span className="text-xs text-ink-500">— {layer.surface}</span>
                </span>
                <ChevronDown
                  size={16}
                  strokeWidth={1.75}
                  className={cn(
                    'flex-none text-ink-500 transition-transform duration-fast ease-standard',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>
              {isOpen && (
                <div
                  id={`layer-panel-body-${layer.id}`}
                  className="grid gap-4 border-t border-border-subtle px-4 py-4 md:grid-cols-2"
                >
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                      What runs at this layer
                    </p>
                    <ul className="list-disc pl-5 text-sm text-ink-700">
                      {layer.whatRuns.map((item) => (
                        <li key={item} className="leading-snug">{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                        Security boundary
                      </p>
                      <p className="text-sm leading-relaxed text-ink-700">{layer.boundary}</p>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                        Data flow
                      </p>
                      <p className="text-sm leading-relaxed text-ink-700">{layer.flow}</p>
                    </div>
                    <p className="font-mono text-[11px] text-ink-500">{layer.citation}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
