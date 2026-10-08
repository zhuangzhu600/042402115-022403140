/* ============================================================
 * app.js —— 页面导航、页面注册与首页渲染
 * 通过 window.App 向 js/pages/*.js 暴露接口：
 *   App.registerPage(name, renderFn)  注册页面
 *   App.goTab(tab) / App.openDetail(id, from) / App.goBack()
 *   App.cardHtml(item) / App.bindCards(root)
 * ============================================================ */
window.App = (function () {
  'use strict';

  var CATS = Core.CATS;
  var escapeHtml = Core.escapeHtml;
  var fmtDate = Core.fmtDate;

  var store = Storage.createStore();

  /* ── 全局 UI 状态（数据本体永远在 store 里） ────────────── */
  var state = {
    view: 'home',           // 当前视图：home/post/search/mine/detail/success
    tab: 'home',            // 当前底部导航
    selectedId: null,       // 详情页物品 id
    homeFilter: 'all',      // 首页类型筛选
  };

  var pages = {}; // name -> function(rootEl)

  /* ── 数据便捷访问 ───────────────────────────────────────── */
  function items() { return store.load(); }

  /* ── 共用 HTML 片段 ─────────────────────────────────────── */

  function typeBadge(type) {
    return '<span class="badge-type ' + type + '">' +
      (type === 'lost' ? '● 失物' : '● 招领') + '</span>';
  }

  function statusPill(item) {
    if (item.status === 'active') {
      return '<span class="pill-status active">进行中</span>';
    }
    return '<span class="pill-status resolved">' + Core.resolvedLabel(item) + '</span>';
  }

  /** 列表卡片：首页 / 搜索 / 我的发布共用同一渲染器 */
  function cardHtml(item) {
    var cat = CATS[item.category];
    return '' +
      '<button class="card' + (item.status === 'resolved' ? ' resolved' : '') +
        '" data-open="' + escapeHtml(item.id) + '">' +
        '<div class="card-row">' +
          '<div class="cat-icon ' + item.type + '">' + cat.emoji + '</div>' +
          '<div class="card-main">' +
            '<p class="card-title">' + escapeHtml(item.title) + '</p>' +
            '<div class="badges">' +
              typeBadge(item.type) +
              (item.status === 'resolved' ? statusPill(item) : '') +
              '<span class="card-date">' + fmtDate(item.date) + '</span>' +
            '</div>' +
            '<p class="card-loc">\u{1F4CD}<span>' + escapeHtml(item.location) + '</span></p>' +
          '</div>' +
        '</div>' +
      '</button>';
  }

  function emptyHtml(emoji, line1, line2) {
    return '<div class="empty"><div class="big">' + emoji + '</div>' +
      '<p class="t1">' + escapeHtml(line1) + '</p>' +
      (line2 ? '<p class="t2">' + escapeHtml(line2) + '</p>' : '') +
      '</div>';
  }

  /** 绑定 root 内所有 data-open 卡片的点击进详情 */
  function bindCards(root, from) {
    var els = root.querySelectorAll('[data-open]');
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        el.addEventListener('click', function () {
          openDetail(el.getAttribute('data-open'), from);
        });
      })(els[i]);
    }
  }

  /* ── 导航 ───────────────────────────────────────────────── */

  function goTab(t) {
    state.tab = t;
    state.view = t;
    render();
  }

  function openDetail(id, from) {
    state.selectedId = id;
    state.view = 'detail';
    render();
  }

  /* ── 首页 ───────────────────────────────────────────────── */
  function renderHome(root) {
    var all = items();
    var active = all.filter(function (i) { return i.status === 'active'; });
    var lostN = active.filter(function (i) { return i.type === 'lost'; }).length;
    var foundN = active.filter(function (i) { return i.type === 'found'; }).length;
    var list = Core.sortItems(Core.searchItems(all, { type: state.homeFilter }));

    var chips = [
      { id: 'all', label: '全部' },
      { id: 'lost', label: '\u{1F534} 失物' },
      { id: 'found', label: '\u{1F7E2} 招领' },
    ].map(function (f) {
      var cls = state.homeFilter === f.id ? 'chip active ' + f.id : 'chip';
      return '<button class="' + cls + '" data-filter="' + f.id + '">' + f.label + '</button>';
    }).join('');

    root.innerHTML =
      '<div class="page-head">' +
        '<h1 class="page-title">校园失物招领</h1>' +
        '<p class="page-sub">让遗失的物品回到主人身边</p>' +
        '<div class="stats">' +
          '<div class="stat amber"><p class="num">' + lostN + '</p><p class="lab">待寻找失物</p></div>' +
          '<div class="stat emerald"><p class="num">' + foundN + '</p><p class="lab">待认领物品</p></div>' +
          '<div class="stat blue"><p class="num">' + all.length + '</p><p class="lab">全部发布</p></div>' +
        '</div>' +
        '<div class="chips">' + chips + '</div>' +
      '</div>' +
      '<div class="scroll" id="home-list">' +
        (list.length
          ? list.map(cardHtml).join('')
          : emptyHtml('\u{1F4ED}', '该分类暂无信息')) +
      '</div>';

    var btns = root.querySelectorAll('[data-filter]');
    for (var i = 0; i < btns.length; i++) {
      (function (el) {
        el.addEventListener('click', function () {
          state.homeFilter = el.getAttribute('data-filter');
          render();
        });
      })(btns[i]);
    }
    bindCards(root, 'home');
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
    if (state.view === 'home') {
      renderHome(root);
    } else if (pages[state.view]) {
      pages[state.view](root);
    } else {
      root.innerHTML =
        '<div class="empty"><div class="big">🏗️</div>' +
        '<p class="t1">' + ({ post: '发布', search: '搜索', mine: '我的', detail: '物品详情' }[state.view] || '页面') + '开发中</p></div>';
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
    items: items,
    goTab: goTab,
    openDetail: openDetail,
    render: render,
    cardHtml: cardHtml,
    bindCards: bindCards,
    typeBadge: typeBadge,
    statusPill: statusPill,
    emptyHtml: emptyHtml,
  };
})();
