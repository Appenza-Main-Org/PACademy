/**
 * Barcode Generation & Print (2.5)
 */
(function() {
  'use strict';

  const APP = { key: 'barcode', icon: '🏷️', title: 'إنشاء وطباعة الباركود' };

  const NAV = [{ items: [
    { key: 'generate', icon: '🏷️', label: 'إنشاء باركود', path: '/barcode' },
    { key: 'lookup',   icon: '🔍', label: 'استعلام',      path: '/barcode/lookup' },
    { key: 'batch',    icon: '🖨️', label: 'طباعة جماعية', path: '/barcode/batch' },
  ]}];

  function shell(activeKey, body) {
    return `
      <div class="shell shell-with-sidebar" data-app="barcode">
        ${Shell.appHeader(APP)}
        ${Shell.sidebar(NAV, activeKey, 'barcode')}
        <main class="main">${body}</main>
      </div>
    `;
  }

  function barcodeBars(seed) {
    // Generate 60 bars with deterministic widths
    let s = seed.toString();
    let bars = '';
    for (let i = 0; i < 60; i++) {
      const w = (parseInt(s[i % s.length], 10) || 1) * 0.5 + 1;
      const isBlack = (parseInt(s[(i+3) % s.length], 10) || 0) % 2 === 0;
      bars += `<div class="barcode-bar" style="width:${w}px;background:${isBlack ? '#0F1A2E' : 'transparent'};"></div>`;
    }
    return bars;
  }

  async function renderGenerate() {
    const sample = window.MockData.applicants[0];
    const code = await BarcodeService.generate(sample.id);

    const body = `
      ${Shell.pageHead(
        '<span style="font-size:24px;">🏷️</span> إنشاء وطباعة الباركود',
        'إنشاء كروت تردد بالباركود لكل متقدم',
        `<button class="btn btn-primary">${UI.Icons.print} طباعة جماعية</button>`
      )}

      <div class="grid" style="grid-template-columns: 1fr 380px;gap:24px;">
        <div class="card">
          <div class="card-header">
            <div class="card-title">معاينة كارت تردد</div>
            <span class="badge badge-info">جاهز للطباعة</span>
          </div>
          <div class="card-body" style="background:linear-gradient(135deg,#F7F9FC,#EEF2F8);">
            <div style="background:white;border-radius:14px;padding:24px;box-shadow:var(--shadow-md);max-width:520px;margin:0 auto;">
              <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1B3A6B;padding-bottom:12px;margin-bottom:16px;">
                <div>
                  <div style="color:#1B3A6B;font-weight:700;font-size:14px;">أكاديمية الشرطة</div>
                  <div class="text-xs text-tertiary">منظومة القبول 2026</div>
                </div>
                <div class="brand-logo" style="width:44px;height:44px;">${UI.Icons.shield}</div>
              </div>

              <div style="text-align:center;margin-bottom:14px;">
                <div class="text-xs text-tertiary mb-2">رقم التردد</div>
                <div class="mono" style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1B3A6B;">${code.code.match(/.{1,4}/g).join(' ')}</div>
              </div>

              <div class="barcode-display" style="border:none;background:transparent;">
                <div class="barcode-bars">${barcodeBars(code.code)}</div>
                <div class="barcode-num">${code.code}</div>
              </div>

              <div style="border-top:1px dashed var(--border-default);margin-top:16px;padding-top:12px;font-size:13px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                  <span class="text-tertiary">الاسم:</span>
                  <span style="font-weight:600;">${UI.escape(sample.name)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                  <span class="text-tertiary">الرقم القومي:</span>
                  <span class="mono">${sample.nationalId}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span class="text-tertiary">صالح حتى:</span>
                  <span>${UI.date(code.validUntil)}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="card-footer">
            <div style="display:flex;gap:8px;justify-content:flex-end;">
              <button class="btn btn-secondary">${UI.Icons.download} حفظ PDF</button>
              <button class="btn btn-primary">${UI.Icons.print} طباعة</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">إعدادات الباركود</div></div>
          <div class="card-body">
            <div class="field mb-4">
              <label class="field-label">رقم الطلب</label>
              <input class="input" value="${sample.id}">
            </div>
            <div class="field mb-4">
              <label class="field-label">نوع الباركود</label>
              <select class="select">
                <option>Code 128</option>
                <option>Code 39</option>
                <option>EAN-13</option>
                <option>QR Code</option>
              </select>
            </div>
            <div class="field mb-4">
              <label class="field-label">صلاحية الكارت</label>
              <select class="select">
                <option>3 شهور</option>
                <option selected>6 شهور</option>
                <option>سنة</option>
              </select>
            </div>
            <button class="btn btn-primary" style="width:100%;">إنشاء باركود جديد</button>
          </div>
        </div>
      </div>
    `;
    return shell('generate', body);
  }

  async function renderLookup() {
    const body = `
      ${Shell.pageHead('<span style="font-size:24px;">🔍</span> استعلام بالباركود', 'استعلام عن متقدم باستخدام رقم الباركود')}

      <div class="card" style="max-width:600px;margin:0 auto;">
        <div class="card-body" style="text-align:center;padding:40px;">
          <div style="font-size:64px;margin-bottom:16px;">📷</div>
          <h3 style="margin-bottom:8px;">امسح الباركود أو أدخل الرقم</h3>
          <p class="text-tertiary mb-4">يمكنك استخدام كاميرا الجهاز أو إدخال الرقم يدوياً</p>

          <input class="input mono" style="text-align:center;font-size:20px;letter-spacing:4px;margin-bottom:16px;" placeholder="0000-0000-0000">

          <div style="display:flex;gap:8px;justify-content:center;">
            <button class="btn btn-secondary">${UI.Icons.eye} مسح بالكاميرا</button>
            <button class="btn btn-primary">${UI.Icons.search} استعلام</button>
          </div>
        </div>
      </div>
    `;
    return shell('lookup', body);
  }

  async function renderBatch() {
    const sample = window.MockData.applicants.slice(0, 12);
    const body = `
      ${Shell.pageHead('<span style="font-size:24px;">🖨️</span> طباعة جماعية', 'طباعة كروت تردد لمجموعة من المتقدمين')}

      <div class="alert alert-info mb-4">
        <span class="alert-icon">ℹ️</span>
        <div class="alert-body">${sample.length} متقدم محدّد للطباعة. تأكد من توفر ورق طباعة كافٍ.</div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">قائمة الطباعة</div>
          <button class="btn btn-primary">${UI.Icons.print} طباعة الكل</button>
        </div>
        <div class="grid grid-3 gap-3" style="padding:24px;">
          ${sample.map(a => `
            <div style="background:#F7F9FC;padding:14px;border-radius:8px;border:1px solid var(--border-subtle);font-size:12px;">
              <div style="font-weight:600;">${UI.escape(a.name.split(' ').slice(0,3).join(' '))}</div>
              <div class="text-xs text-tertiary mono mt-2">${a.id}</div>
              <div style="display:flex;gap:1px;margin-top:8px;height:24px;">
                ${barcodeBars(a.id)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    return shell('batch', body);
  }

  function attach() { Shell.attachShellEvents(); }

  window.BarcodePage = { renderGenerate, renderLookup, renderBatch, attach };
})();
