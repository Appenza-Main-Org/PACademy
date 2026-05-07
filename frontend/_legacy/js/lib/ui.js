/**
 * UI helpers: toasts, modals, formatters, icons, escape.
 */
(function() {
  'use strict';

  // ── Escape HTML ──────────────────────────────────────────
  function escape(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Format number with Arabic-Western digits ─────────────
  function num(n, opts) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-US', opts);
  }

  // ── Format date ──────────────────────────────────────────
  const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  function date(d, fmt) {
    if (!d) return '—';
    d = new Date(d);
    if (isNaN(d)) return '—';
    if (fmt === 'short') return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
    if (fmt === 'time') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (fmt === 'rel') return relTime(d);
    return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  function relTime(d) {
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'الآن';
    if (diff < 3600) return `منذ ${Math.floor(diff/60)} د`;
    if (diff < 86400) return `منذ ${Math.floor(diff/3600)} س`;
    if (diff < 604800) return `منذ ${Math.floor(diff/86400)} ي`;
    return date(d, 'short');
  }

  // ── Toast notifications ──────────────────────────────────
  let toastEl;
  function ensureToastContainer() {
    if (toastEl) return toastEl;
    toastEl = document.createElement('div');
    toastEl.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:200;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;';
    document.body.appendChild(toastEl);
    return toastEl;
  }
  function toast(msg, type = 'info', duration = 3500) {
    const el = ensureToastContainer();
    const t = document.createElement('div');
    const colors = {
      info:    { bg: '#DDE7F2', fg: '#2D5BA0', icon: 'ℹ️' },
      success: { bg: '#D7F0E1', fg: '#1A8754', icon: '✓' },
      warning: { bg: '#FBE9CC', fg: '#B8770A', icon: '⚠️' },
      danger:  { bg: '#FBD6D6', fg: '#B82C2C', icon: '✗' },
    }[type] || { bg: '#fff', fg: '#000', icon: '' };
    t.style.cssText = `
      background:${colors.bg};color:${colors.fg};padding:12px 20px;
      border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);
      font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px;
      pointer-events:auto;animation:slideDown 0.25s ease-out;border:1px solid currentColor;
    `;
    t.innerHTML = `<span>${colors.icon}</span><span>${escape(msg)}</span>`;
    el.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity 0.2s, transform 0.2s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(-10px)';
      setTimeout(() => t.remove(), 200);
    }, duration);
  }

  // Add CSS for slide animation
  if (!document.getElementById('ui-anim-css')) {
    const s = document.createElement('style');
    s.id = 'ui-anim-css';
    s.textContent = '@keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }';
    document.head.appendChild(s);
  }

  // ── Modal ────────────────────────────────────────────────
  function modal({ title, body, footer, size = 'md' }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const widths = { sm: 420, md: 560, lg: 800 };
    backdrop.innerHTML = `
      <div class="modal" style="max-width:${widths[size]}px;">
        <div class="card-header">
          <div>
            <div class="card-title">${escape(title || '')}</div>
          </div>
          <button class="btn btn-ghost btn-icon" data-close>✕</button>
        </div>
        <div class="card-body">${body || ''}</div>
        ${footer ? `<div class="card-footer">${footer}</div>` : ''}
      </div>
    `;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close();
    });
    backdrop.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    return { close, el: backdrop };
  }

  // ── Confirm dialog ───────────────────────────────────────
  function confirmDialog(message, opts = {}) {
    return new Promise(resolve => {
      const m = modal({
        title: opts.title || 'تأكيد العملية',
        body: `<p style="font-size:15px;line-height:1.9;">${escape(message)}</p>`,
        footer: `
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button class="btn btn-secondary" data-cancel>${escape(opts.cancelText || 'إلغاء')}</button>
            <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${escape(opts.confirmText || 'تأكيد')}</button>
          </div>
        `
      });
      m.el.querySelector('[data-confirm]').addEventListener('click', () => { m.close(); resolve(true); });
      m.el.querySelector('[data-cancel]').addEventListener('click', () => { m.close(); resolve(false); });
    });
  }

  // ── Common Icons (inline SVGs) ───────────────────────────
  const Icons = {
    home:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M3 12l9-9 9 9v9a2 2 0 01-2 2h-3a2 2 0 01-2-2v-4h-4v4a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>',
    user:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M16 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>',
    users:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M13 7a4 4 0 11-8 0 4 4 0 018 0zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
    search:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    bell:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>',
    settings:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
    logout:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    plus:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    edit:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>',
    check:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>',
    x:           '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    arrowLeft:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    arrowRight:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    download:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
    upload:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
    eye:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    print:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    filter:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    chart:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    pieChart:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z"/></svg>',
    fileText:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    shield:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    calendar:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    activity:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    creditCard:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    fingerprint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M6 18.7a4 4 0 003.42-2.33M10 5.93A6 6 0 0118 12c0 1.59-.45 3.07-1.22 4.32M6.34 17.66a8 8 0 01-2.34-5.66M2.05 11.06A10 10 0 0112 2.05c2.5 0 4.79.92 6.55 2.45M22 12c0 5.52-4.48 10-10 10M14 18.92a4 4 0 01-1-2.92M18 14a2 2 0 11-4 0c0-2.21-1.79-4-4-4-1.18 0-2.24.51-2.97 1.32"/></svg>',
    stethoscope: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6v0a6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3M8 15v1a6 6 0 006 6v0a6 6 0 006-6v-4M14 12a2 2 0 100-4 2 2 0 000 4z"/></svg>',
    barcode:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="5" width="2" height="14"/><rect x="7" y="5" width="3" height="14"/><rect x="12" y="5" width="2" height="14"/><rect x="16" y="5" width="3" height="14"/><rect x="21" y="5" width="0.5" height="14"/></svg>',
    gavel:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14 4l6 6M14 4l-4 4 6 6 4-4M11 11l-7 7 3 3 7-7M21 21H8"/></svg>',
    book:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
    layers:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    db:          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    lock:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
  };

  // ── Loading skeleton ──
  function skeleton(opts = {}) {
    const { lines = 3, width = '100%' } = opts;
    return Array.from({ length: lines }).map((_, i) => `
      <div style="background:linear-gradient(90deg,#EEF2F8 0%,#F7F9FC 50%,#EEF2F8 100%);background-size:200% 100%;animation:skeleton 1.5s infinite;border-radius:6px;height:14px;width:${width};margin-bottom:8px;"></div>
    `).join('');
  }
  if (!document.getElementById('skeleton-css')) {
    const s = document.createElement('style');
    s.id = 'skeleton-css';
    s.textContent = '@keyframes skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }';
    document.head.appendChild(s);
  }

  window.UI = { escape, num, date, toast, modal, confirmDialog, Icons, skeleton };
})();
