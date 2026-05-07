/**
 * Tiny hash router.
 * Routes registered as { path, handler }.
 * Handler receives (params, query) and returns HTML string or DOM node.
 */
(function() {
  'use strict';

  const routes = [];
  let notFoundHandler = () => '<div class="empty"><div class="empty-title">الصفحة غير موجودة</div></div>';
  let beforeHook = null;

  function compile(path) {
    const keys = [];
    const pattern = path
      .replace(/:[^/]+/g, m => { keys.push(m.slice(1)); return '([^/]+)'; })
      .replace(/\//g, '\\/');
    return { regex: new RegExp('^' + pattern + '$'), keys };
  }

  function register(path, handler) {
    const compiled = compile(path);
    routes.push({ path, handler, ...compiled });
  }

  function parseHash() {
    const h = (location.hash || '#/').slice(1);
    const [pathname, qs] = h.split('?');
    const query = {};
    if (qs) {
      qs.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    return { pathname: pathname || '/', query };
  }

  function navigate(path) {
    location.hash = '#' + path;
  }

  function back() { history.back(); }

  function resolve() {
    const { pathname, query } = parseHash();

    if (beforeHook && beforeHook(pathname, query) === false) return;

    for (const r of routes) {
      const m = pathname.match(r.regex);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
        const result = r.handler(params, query);
        renderInto(result);
        window.scrollTo(0, 0);
        return;
      }
    }
    renderInto(notFoundHandler());
  }

  function renderInto(content) {
    const root = document.getElementById('app');
    if (!root) return;
    root.innerHTML = '';
    if (typeof content === 'string') {
      root.innerHTML = content;
    } else if (content instanceof Node) {
      root.appendChild(content);
    }
    // Trigger page enter animation
    const main = root.querySelector('.main') || root.firstElementChild;
    if (main) main.classList.add('page-enter');
  }

  function start() {
    window.addEventListener('hashchange', resolve);
    window.addEventListener('DOMContentLoaded', resolve);
    if (document.readyState !== 'loading') resolve();
  }

  window.Router = { register, navigate, back, start, before: h => beforeHook = h };
})();
