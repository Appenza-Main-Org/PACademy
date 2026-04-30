/**
 * Shared shell components for all app pages.
 * Renders the consistent header + sidebar + main wrapper.
 */
(function() {
  'use strict';

  function appHeader(opts = {}) {
    const auth = Store.get('auth');
    if (!auth) return '';
    return `
      <header class="header">
        <div class="header-left">
          <a href="#/" class="brand" style="text-decoration:none;">
            <div class="brand-logo">${UI.Icons.shield}</div>
            <div class="brand-text">
              <span>منظومة القبول</span>
              <span>أكاديمية الشرطة</span>
            </div>
          </a>
          ${opts.appKey ? `
            <span class="app-pill">
              <span>${opts.appIcon || ''}</span>
              <span>${UI.escape(opts.appTitle || '')}</span>
            </span>
          ` : ''}
        </div>
        <div class="header-right">
          <button class="btn btn-ghost btn-icon" title="الإشعارات">${UI.Icons.bell}</button>
          <a href="#/" class="btn btn-secondary btn-sm">${UI.Icons.home} الرئيسية</a>
          <div class="user-menu">
            <div class="avatar">${UI.escape(auth.name.split(' ')[0][0] || 'U')}</div>
            <div class="user-menu-info">
              <span class="user-menu-name">${UI.escape(auth.name.split(' ').slice(0,3).join(' '))}</span>
              <span class="user-menu-role">${UI.escape(auth.roleLabel)}</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-icon" id="logout-btn" title="تسجيل الخروج">${UI.Icons.logout}</button>
        </div>
      </header>
    `;
  }

  function sidebar(items, activeKey, appKey) {
    return `
      <aside class="sidebar" data-app="${appKey}">
        ${items.map(section => `
          <div class="sidebar-section">
            ${section.label ? `<div class="sidebar-label">${UI.escape(section.label)}</div>` : ''}
            ${section.items.map(it => `
              <a href="#${it.path}" class="nav-item ${it.key === activeKey ? 'active' : ''}" style="text-decoration:none;">
                <span class="nav-item-icon">${it.icon}</span>
                <span class="nav-item-label">${UI.escape(it.label)}</span>
                ${it.badge ? `<span class="nav-item-badge">${it.badge}</span>` : ''}
              </a>
            `).join('')}
          </div>
        `).join('')}
      </aside>
    `;
  }

  function pageHead(title, subtitle, actions = '') {
    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">${title}</h1>
          ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ''}
        </div>
        ${actions ? `<div class="page-actions">${actions}</div>` : ''}
      </div>
    `;
  }

  function attachShellEvents() {
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      if (await UI.confirmDialog('هل تريد تسجيل الخروج من المنظومة؟')) {
        await AuthService.logout();
        Router.navigate('/login');
      }
    });
  }

  window.Shell = { appHeader, sidebar, pageHead, attachShellEvents };
})();
