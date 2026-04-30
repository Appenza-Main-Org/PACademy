/**
 * Lightweight inline-SVG charts (no dependencies).
 *  Charts.bar(data, opts)  → bar chart
 *  Charts.line(data, opts) → line chart
 *  Charts.donut(data, opts) → donut/pie
 *  Charts.heatmap(data) → simple heatmap grid
 */
(function() {
  'use strict';

  const PALETTE = ['#1B3A6B','#C9A961','#1A8754','#B8770A','#2D5BA0','#7C2D8E','#0E8E8E','#C9501E','#4A5568'];

  function bar(data, opts = {}) {
    const { height = 200, color = '#2D5BA0', showValues = true } = opts;
    const w = 600, h = height, pad = 36;
    const max = Math.max(...data.map(d => d.value)) * 1.1;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const barW = innerW / data.length * 0.7;
    const gap = innerW / data.length * 0.3;

    const bars = data.map((d, i) => {
      const x = pad + (i * (barW + gap)) + (gap / 2);
      const bh = (d.value / max) * innerH;
      const y = h - pad - bh;
      const c = d.color || color;
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="4" fill="${c}" opacity="0.9">
          <animate attributeName="height" from="0" to="${bh}" dur="0.6s" fill="freeze"/>
          <animate attributeName="y" from="${h-pad}" to="${y}" dur="0.6s" fill="freeze"/>
        </rect>
        ${showValues ? `<text x="${x + barW/2}" y="${y - 6}" text-anchor="middle" font-size="11" font-family="Inter" fill="#4A5568" font-weight="600">${d.value.toLocaleString('en-US')}</text>` : ''}
        <text x="${x + barW/2}" y="${h - pad + 16}" text-anchor="middle" font-size="11" fill="#8B95A5" font-family="Noto Sans Arabic">${d.label}</text>
      `;
    }).join('');

    // Y-axis grid lines
    const grid = [0, 0.25, 0.5, 0.75, 1].map(t => {
      const y = pad + innerH * (1 - t);
      const v = Math.round(max * t);
      return `
        <line x1="${pad}" y1="${y}" x2="${w-pad}" y2="${y}" stroke="#EEF2F8" stroke-dasharray="3 3"/>
        <text x="${pad - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="#8B95A5" font-family="Inter">${v.toLocaleString('en-US')}</text>
      `;
    }).join('');

    return `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="xMidYMid meet">${grid}${bars}</svg>`;
  }

  function line(data, opts = {}) {
    const { height = 200, color = '#2D5BA0', area = true } = opts;
    const w = 600, h = height, pad = 36;
    const max = Math.max(...data.map(d => d.value)) * 1.1;
    const min = Math.min(0, ...data.map(d => d.value));
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    const points = data.map((d, i) => {
      const x = pad + (i / (data.length - 1)) * innerW;
      const y = h - pad - ((d.value - min) / (max - min)) * innerH;
      return { x, y, d };
    });

    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${path} L ${points[points.length-1].x} ${h-pad} L ${points[0].x} ${h-pad} Z`;

    const grid = [0, 0.25, 0.5, 0.75, 1].map(t => {
      const y = pad + innerH * (1 - t);
      const v = Math.round(min + (max - min) * t);
      return `
        <line x1="${pad}" y1="${y}" x2="${w-pad}" y2="${y}" stroke="#EEF2F8" stroke-dasharray="3 3"/>
        <text x="${pad - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="#8B95A5" font-family="Inter">${v.toLocaleString('en-US')}</text>
      `;
    }).join('');

    const dots = points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" stroke="white" stroke-width="2"/>`).join('');
    const labels = points.map(p => `<text x="${p.x}" y="${h - pad + 16}" text-anchor="middle" font-size="11" fill="#8B95A5" font-family="Noto Sans Arabic">${p.d.label}</text>`).join('');

    return `
      <svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="larea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${grid}
        ${area ? `<path d="${areaPath}" fill="url(#larea)"/>` : ''}
        <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
        ${labels}
      </svg>
    `;
  }

  function donut(data, opts = {}) {
    const { size = 220, hole = 0.62, palette = PALETTE } = opts;
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return '<div class="empty">لا توجد بيانات</div>';

    const cx = size / 2, cy = size / 2;
    const r = size / 2 - 10;
    const rIn = r * hole;
    let acc = 0;
    const arcs = data.map((d, i) => {
      const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
      acc += d.value;
      const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
      const large = (end - start) > Math.PI ? 1 : 0;
      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      const x3 = cx + rIn * Math.cos(end);
      const y3 = cy + rIn * Math.sin(end);
      const x4 = cx + rIn * Math.cos(start);
      const y4 = cy + rIn * Math.sin(start);
      const c = d.color || palette[i % palette.length];
      return `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rIn} ${rIn} 0 ${large} 0 ${x4} ${y4} Z" fill="${c}" opacity="0.92"/>`;
    }).join('');

    const legend = data.map((d, i) => `
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 0;">
        <span style="width:10px;height:10px;border-radius:3px;background:${d.color || palette[i % palette.length]};"></span>
        <span style="flex:1;color:#4A5568;">${d.label}</span>
        <span style="font-family:Inter;font-weight:600;color:#0F1A2E;">${d.value.toLocaleString('en-US')}</span>
      </div>
    `).join('');

    return `
      <div style="display:flex;align-items:center;gap:20px;">
        <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="flex-shrink:0;">
          ${arcs}
          <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="22" font-weight="700" font-family="Inter" fill="#0F1A2E">${total.toLocaleString('en-US')}</text>
          <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="11" fill="#8B95A5" font-family="Noto Sans Arabic">إجمالي</text>
        </svg>
        <div style="flex:1;">${legend}</div>
      </div>
    `;
  }

  function heatmap(data, opts = {}) {
    const { rows = 7, cols = 14, max = 100 } = opts;
    return `
      <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:3px;">
        ${data.slice(0, rows * cols).map(v => {
          const intensity = Math.min(1, v / max);
          const c = `rgba(45,91,160,${0.1 + intensity * 0.9})`;
          return `<div style="aspect-ratio:1;background:${c};border-radius:3px;" title="${v}"></div>`;
        }).join('')}
      </div>
    `;
  }

  window.Charts = { bar, line, donut, heatmap, PALETTE };
})();
