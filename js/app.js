/* ============================================================
 * app.js —— 页面导航与页面注册机制
 * 通过 window.App 向 js/pages/*.js 暴露接口：
 *   App.registerPage(name, renderFn)  注册页面
 *   App.goTab(tab) / App.openDetail(id, from) / App.goBack()
 * ============================================================ */
window.App = (function () {
  'use strict';

  /* ── 全局 UI 状态（数据本体永远在 store 里） ────────────── */
  var state = {
    view: 'home',           // 当前视图：home/post/search/mine/detail/success
    tab: 'home',            // 当前底部导航
  };

  var pages = {}; // name -> function(rootEl)

  /* ── 导航 ───────────────────────────────────────────────── */

  function goTab(t) {
    state.tab = t;
    state.view = t;
    render();
  }

  /* ── 底部导航 ───────────────────────────────────────────── */
  var TABS = [
    { id: 'home', label: '首页', icon: '\u{1F3E0}' },
    { id: 'post', label: '发布', icon: '➕' },
    { id: 'search', label: '搜索', icon: '\u{1F50D}' },
    { id: 'mine', label: '我的', icon: '\u{1F464}' },
  ];

  function renderNav() {
    var nav = document.getElementById('bottomnav');
    nav.style.display = '';
    nav.innerHTML = TABS.map(function (t) {
      var cls = 'navbtn' + (state.tab === t.id ? ' active' : '');
      return '<button class="' + cls + '" data-tab="' + t.id + '">' +
        '<span class="nav-icon">' + t.icon + '</span>' +
        '<span class="nav-label">' + t.label + '</span>' +
        '<span class="nav-dot"></span></button>';
    }).join('');
    var btns = nav.querySelectorAll('[data-tab]');
    for (var i = 0; i < btns.length; i++) {
      (function (el) {
        el.addEventListener('click', function () { goTab(el.getAttribute('data-tab')); });
      })(btns[i]);
    }
  }

  /* ── 主渲染 ─────────────────────────────────────────────── */
  function render() {
    renderNav();
    var root = document.getElementById('view');
    root.scrollTop = 0;
    if (pages[state.view]) {
      pages[state.view](root);
    } else {
      root.innerHTML =
        '<div class="empty"><div class="big">🏗️</div>' +
        '<p class="t1">' + ({ home: '首页', post: '发布', search: '搜索', mine: '我的' }[state.view] || '页面') + '开发中</p></div>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

  /* ── 对外接口（js/pages/*.js 使用） ─────────────────────── */
  return {
    registerPage: function (name, fn) { pages[name] = fn; },
    state: state,
    goTab: goTab,
    render: render,
  };
})();
