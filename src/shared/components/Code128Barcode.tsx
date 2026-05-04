/**
 * Code128Barcode — scannable Code 128 (Subset B) barcode rendered as inline SVG.
 *
 * Encodes any printable-ASCII payload (chars 32–127) into a real Code 128B
 * symbol that any standard barcode scanner / phone-camera scanner can decode.
 *
 * No external libraries (per CLAUDE.md §2 forbidden — charts/codes inline-SVG only).
 */

import { useMemo } from 'react';
import { cn } from '@/shared/lib/cn';

/**
 * Code 128 element-width patterns.
 *
 * Each entry is a sequence of widths in modules. Even indices are bars, odd
 * indices are spaces. Entries 0–106 are 6 widths summing to 11 modules.
 * Entry 106 (Stop) is 7 widths summing to 13 modules (the trailing 2-module
 * bar after the standard stop pattern).
 */
const PATTERNS: ReadonlyArray<ReadonlyArray<number>> = [
  [2, 1, 2, 2, 2, 2], [2, 2, 2, 1, 2, 2], [2, 2, 2, 2, 2, 1], [1, 2, 1, 2, 2, 3],
  [1, 2, 1, 3, 2, 2], [1, 3, 1, 2, 2, 2], [1, 2, 2, 2, 1, 3], [1, 2, 2, 3, 1, 2],
  [1, 3, 2, 2, 1, 2], [2, 2, 1, 2, 1, 3], [2, 2, 1, 3, 1, 2], [2, 3, 1, 2, 1, 2],
  [1, 1, 2, 2, 3, 2], [1, 2, 2, 1, 3, 2], [1, 2, 2, 2, 3, 1], [1, 1, 3, 2, 2, 2],
  [1, 2, 3, 1, 2, 2], [1, 2, 3, 2, 2, 1], [2, 2, 3, 2, 1, 1], [2, 2, 1, 1, 3, 2],
  [2, 2, 1, 2, 3, 1], [2, 1, 3, 2, 1, 2], [2, 2, 3, 1, 1, 2], [3, 1, 2, 1, 3, 1],
  [3, 1, 1, 2, 2, 2], [3, 2, 1, 1, 2, 2], [3, 2, 1, 2, 2, 1], [3, 1, 2, 2, 1, 2],
  [3, 2, 2, 1, 1, 2], [3, 2, 2, 2, 1, 1], [2, 1, 2, 1, 2, 3], [2, 1, 2, 3, 2, 1],
  [2, 3, 2, 1, 2, 1], [1, 1, 1, 3, 2, 3], [1, 3, 1, 1, 2, 3], [1, 3, 1, 3, 2, 1],
  [1, 1, 2, 3, 1, 3], [1, 3, 2, 1, 1, 3], [1, 3, 2, 3, 1, 1], [2, 1, 1, 3, 1, 3],
  [2, 3, 1, 1, 1, 3], [2, 3, 1, 3, 1, 1], [1, 1, 2, 1, 3, 3], [1, 1, 2, 3, 3, 1],
  [1, 3, 2, 1, 3, 1], [1, 1, 3, 1, 2, 3], [1, 1, 3, 3, 2, 1], [1, 3, 3, 1, 2, 1],
  [3, 1, 3, 1, 2, 1], [2, 1, 1, 3, 3, 1], [2, 3, 1, 1, 3, 1], [2, 1, 3, 1, 1, 3],
  [2, 1, 3, 3, 1, 1], [2, 1, 3, 1, 3, 1], [3, 1, 1, 1, 2, 3], [3, 1, 1, 3, 2, 1],
  [3, 3, 1, 1, 2, 1], [3, 1, 2, 1, 1, 3], [3, 1, 2, 3, 1, 1], [3, 3, 2, 1, 1, 1],
  [3, 1, 4, 1, 1, 1], [2, 2, 1, 4, 1, 1], [4, 3, 1, 1, 1, 1], [1, 1, 1, 2, 2, 4],
  [1, 1, 1, 4, 2, 2], [1, 2, 1, 1, 2, 4], [1, 2, 1, 4, 2, 1], [1, 4, 1, 1, 2, 2],
  [1, 4, 1, 2, 2, 1], [1, 1, 2, 2, 1, 4], [1, 1, 2, 4, 1, 2], [1, 2, 2, 1, 1, 4],
  [1, 2, 2, 4, 1, 1], [1, 4, 2, 1, 1, 2], [1, 4, 2, 2, 1, 1], [2, 4, 1, 2, 1, 1],
  [2, 2, 1, 1, 1, 4], [4, 1, 3, 1, 1, 1], [2, 4, 1, 1, 1, 2], [1, 3, 4, 1, 1, 1],
  [1, 1, 1, 2, 4, 2], [1, 2, 1, 1, 4, 2], [1, 2, 1, 2, 4, 1], [1, 1, 4, 2, 1, 2],
  [1, 2, 4, 1, 1, 2], [1, 2, 4, 2, 1, 1], [4, 1, 1, 2, 1, 2], [4, 2, 1, 1, 1, 2],
  [4, 2, 1, 2, 1, 1], [2, 1, 2, 1, 4, 1], [2, 1, 4, 1, 2, 1], [4, 1, 2, 1, 2, 1],
  [1, 1, 1, 1, 4, 3], [1, 1, 1, 3, 4, 1], [1, 3, 1, 1, 4, 1], [1, 1, 4, 1, 1, 3],
  [1, 1, 4, 3, 1, 1], [4, 1, 1, 1, 1, 3], [4, 1, 1, 3, 1, 1], [1, 1, 3, 1, 4, 1],
  [1, 1, 4, 1, 3, 1], [3, 1, 1, 1, 4, 1], [4, 1, 1, 1, 3, 1], [2, 1, 1, 4, 1, 2],
  [2, 1, 1, 2, 1, 4], [2, 1, 1, 2, 3, 2],
  /* Stop (106) — 13-module pattern */
  [2, 3, 3, 1, 1, 1, 2],
];

const START_B = 104;
const STOP = 106;

function encode(text: string): number[] {
  const codes: number[] = [START_B];
  for (const ch of text) {
    const v = ch.charCodeAt(0) - 32;
    if (v < 0 || v > 95) {
      throw new Error(`Code 128B cannot encode character: "${ch}" (0x${ch.charCodeAt(0).toString(16)})`);
    }
    codes.push(v);
  }
  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) checksum += codes[i] * i;
  codes.push(checksum % 103);
  codes.push(STOP);
  return codes;
}

export interface Code128BarcodeProps {
  /** Payload to encode. Must be printable ASCII (chars 32–127). */
  value: string;
  /** Bar height in pixels. Default 64. */
  height?: number;
  /** Width of one module in pixels. Default 1.6. */
  moduleWidth?: number;
  /** Whether to render the human-readable text below the bars. Default true. */
  showText?: boolean;
  className?: string;
}

export function Code128Barcode({
  value,
  height = 64,
  moduleWidth = 1.6,
  showText = true,
  className,
}: Code128BarcodeProps): JSX.Element {
  const { bars, totalWidth } = useMemo(() => {
    const codes = encode(value);
    let x = 0;
    const out: Array<{ x: number; w: number }> = [];
    for (const v of codes) {
      const pattern = PATTERNS[v];
      for (let i = 0; i < pattern.length; i++) {
        const w = pattern[i] * moduleWidth;
        if (i % 2 === 0) out.push({ x, w });
        x += w;
      }
    }
    return { bars: out, totalWidth: x };
  }, [value, moduleWidth]);

  const textHeight = showText ? 18 : 0;
  const totalHeight = height + textHeight;
  /* Leave a quiet zone of 10 modules either side so scanners can lock on. */
  const quietZone = 10 * moduleWidth;
  const viewWidth = totalWidth + quietZone * 2;

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${totalHeight}`}
      width={viewWidth}
      height={totalHeight}
      className={cn('select-none', className)}
      role="img"
      aria-label={`باركود: ${value}`}
      shapeRendering="crispEdges"
    >
      <rect x={0} y={0} width={viewWidth} height={totalHeight} fill="white" />
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x + quietZone}
          y={0}
          width={b.w}
          height={height}
          fill="black"
        />
      ))}
      {showText && (
        <text
          x={viewWidth / 2}
          y={totalHeight - 4}
          textAnchor="middle"
          fontFamily="JetBrains Mono, ui-monospace, monospace"
          fontSize={13}
          letterSpacing={1.5}
          fill="black"
        >
          {value}
        </text>
      )}
    </svg>
  );
}
