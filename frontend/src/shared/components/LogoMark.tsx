/**
 * LogoMark — Egyptian Police Academy crest.
 *
 * Loads the real PNG from `/police-academy-logo.png` (drop the file into
 * `public/`). If the file is missing, falls back to an inline SVG that
 * approximates the crest (gold-on-navy circle, eagle, laurel wreath,
 * Arabic text bands) so the app never looks broken in the meantime.
 *
 * Use this anywhere you want the academy emblem (shells, login,
 * landing hero, print headers, favicon-style brand chips).
 */

import { useState } from 'react';

export interface LogoMarkProps {
  /** Pixel size; the emblem is square. Defaults to 32. */
  size?: number;
  /** Optional className passed through to the outer element. */
  className?: string;
  /** Accessible label. Defaults to the academy name. */
  ariaLabel?: string;
  /** Force the SVG fallback even if the PNG is present. */
  forceSvg?: boolean;
}

export function LogoMark({
  size = 32,
  className,
  ariaLabel = 'شعار أكاديمية الشرطة',
  forceSvg,
}: LogoMarkProps): JSX.Element {
  const [usingFallback, setUsingFallback] = useState(forceSvg ?? false);

  if (usingFallback) {
    return <LogoMarkSvg size={size} className={className} ariaLabel={ariaLabel} />;
  }

  return (
    <img
      src="/police-academy-logo.png"
      alt={ariaLabel}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', display: 'inline-block' }}
      onError={() => setUsingFallback(true)}
    />
  );
}

/**
 * Inline SVG fallback — circular gold-on-navy emblem with stylised eagle,
 * laurel wreath, top arc text "جمهورية مصر العربية" and bottom banner
 * "الشرطة". Not a pixel-perfect copy of the official crest; rendered as
 * a heritage placeholder until the PNG is dropped into /public.
 */
function LogoMarkSvg({
  size,
  className,
  ariaLabel,
}: {
  size: number;
  className?: string;
  ariaLabel: string;
}): JSX.Element {
  // Hide the inner emblem details on small renders (favicon-size) so the SVG
  // still reads as a circular gold-on-navy mark and doesn't get muddled.
  const detailed = size >= 40;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      <defs>
        <radialGradient id="logoNavy" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#1E3160" />
          <stop offset="100%" stopColor="#091633" />
        </radialGradient>
        <linearGradient id="logoGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"  stopColor="#FBE48E" />
          <stop offset="35%" stopColor="#E5BB55" />
          <stop offset="70%" stopColor="#B98C2D" />
          <stop offset="100%" stopColor="#7A5614" />
        </linearGradient>
        <linearGradient id="logoGoldShine" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  stopColor="#FFE99B" />
          <stop offset="100%" stopColor="#C39433" />
        </linearGradient>
        <path id="topArc" d="M 35 100 A 65 65 0 0 1 165 100" fill="none" />
      </defs>

      {/* Outer gold ring with metallic gradient */}
      <circle cx="100" cy="100" r="98" fill="url(#logoGold)" />
      {/* Highlight inner edge of ring */}
      <circle cx="100" cy="100" r="92" fill="none" stroke="url(#logoGoldShine)" strokeWidth="2" opacity="0.6" />
      {/* Navy disc */}
      <circle cx="100" cy="100" r="88" fill="url(#logoNavy)" />
      {/* Thin gold inner border */}
      <circle cx="100" cy="100" r="84" fill="none" stroke="#D4A445" strokeWidth="1.2" opacity="0.7" />

      {detailed && (
        <>
          {/* Top arc text — جمهورية مصر العربية */}
          <text fill="#E5BB55" fontSize="11" fontWeight="700" letterSpacing="0.3" fontFamily="Cairo, system-ui">
            <textPath href="#topArc" startOffset="50%" textAnchor="middle">
              جمهورية مصر العربية
            </textPath>
          </text>

          {/* Laurel wreath — left side, 5 leaf pairs sweeping down */}
          <g fill="#D4A445" stroke="#7A5614" strokeWidth="0.4">
            <path d="M48 95 Q 42 100 46 108 Q 52 103 50 96 Z" />
            <path d="M50 108 Q 44 116 50 124 Q 56 118 54 110 Z" />
            <path d="M54 122 Q 48 130 56 138 Q 62 132 58 124 Z" />
            <path d="M60 134 Q 54 142 64 148 Q 68 142 64 134 Z" />
            <path d="M68 144 Q 62 150 72 154 Q 74 148 70 142 Z" />
            {/* stem */}
            <path d="M48 95 Q 56 130 78 152" fill="none" stroke="#A57B1F" strokeWidth="1.5" />
          </g>
          {/* Laurel wreath — right side (mirrored) */}
          <g fill="#D4A445" stroke="#7A5614" strokeWidth="0.4">
            <path d="M152 95 Q 158 100 154 108 Q 148 103 150 96 Z" />
            <path d="M150 108 Q 156 116 150 124 Q 144 118 146 110 Z" />
            <path d="M146 122 Q 152 130 144 138 Q 138 132 142 124 Z" />
            <path d="M140 134 Q 146 142 136 148 Q 132 142 136 134 Z" />
            <path d="M132 144 Q 138 150 128 154 Q 126 148 130 142 Z" />
            <path d="M152 95 Q 144 130 122 152" fill="none" stroke="#A57B1F" strokeWidth="1.5" />
          </g>

          {/* Eagle — stylised proud stance, wings raised wide */}
          <g fill="url(#logoGoldShine)" stroke="#7A5614" strokeWidth="0.5" strokeLinejoin="round">
            {/* Left wing — sweeping curve up & out, with feather indents */}
            <path d="M 100 105
                     C 92 95, 80 80, 64 65
                     C 70 78, 76 90, 82 100
                     C 76 96, 70 92, 62 92
                     C 70 100, 80 108, 92 112
                     Z" />
            {/* Right wing — mirror */}
            <path d="M 100 105
                     C 108 95, 120 80, 136 65
                     C 130 78, 124 90, 118 100
                     C 124 96, 130 92, 138 92
                     C 130 100, 120 108, 108 112
                     Z" />
            {/* Body / chest */}
            <path d="M 92 110 Q 100 102 108 110 L 108 138 Q 100 142 92 138 Z" />
            {/* Head — facing forward and slightly down */}
            <circle cx="100" cy="98" r="6.5" />
            {/* Beak — small triangle */}
            <path d="M 94 100 L 89 102 L 94 104 Z" />
            {/* Tail feathers */}
            <path d="M 92 138 L 88 152 L 100 148 L 112 152 L 108 138 Z" />
            {/* Talons gripping pedestal */}
            <path d="M 94 148 L 94 156 L 90 156 M 100 148 L 100 156 M 106 148 L 106 156 L 110 156" stroke="#7A5614" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </g>

          {/* Bottom banner with الشرطة */}
          <g>
            <path
              d="M 56 154 Q 100 168 144 154 L 142 168 Q 100 178 58 168 Z"
              fill="url(#logoGold)"
              stroke="#7A5614"
              strokeWidth="0.6"
            />
            <text
              x="100" y="166"
              textAnchor="middle"
              fill="#091633"
              fontSize="12"
              fontWeight="900"
              fontFamily="Cairo, system-ui"
            >
              الشرطة
            </text>
          </g>

          {/* Crossed swords below banner */}
          <g stroke="#D4A445" strokeWidth="1.4" strokeLinecap="round" fill="none">
            <line x1="80" y1="172" x2="120" y2="184" />
            <line x1="120" y1="172" x2="80" y2="184" />
          </g>
        </>
      )}

      {!detailed && (
        // Compact mark for small sizes (favicon, sidebar collapsed): just the ring + a stylised eagle silhouette.
        <g fill="#E5BB55">
          <path d="M 100 70 C 80 60 60 70 50 80 C 70 75 80 85 100 90 C 120 85 130 75 150 80 C 140 70 120 60 100 70 Z" />
          <path d="M 95 88 L 100 80 L 105 88 L 105 120 L 95 120 Z" />
          <path d="M 88 120 L 100 130 L 112 120 L 108 134 L 92 134 Z" />
        </g>
      )}
    </svg>
  );
}
