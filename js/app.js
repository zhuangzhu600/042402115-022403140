/* ============================================================
 * app.js —— 页面导航、首页、发布、发布成功页与共用卡片渲染
 * 通过 window.App 向 js/pages/*.js 暴露接口：
 *   App.registerPage(name, renderFn)  注册页面
 *   App.goTab(tab) / App.openDetail(id, from) / App.goBack()
 *   App.cardHtml(item) / App.bindCards(root)
 *   App.toggleStatus(id) / App.copyContact(text) / App.toast(msg)
 * ============================================================ */
window.App = (function () {
  'use strict';

  var CATS = Core.CATS;
  var LOCATIONS = Core.LOCATIONS;
  var escapeHtml = Core.escapeHtml;
  var fmtDate = Core.fmtDate;

  var store = Storage.createStore();
  var clientId = store.getClientId();

  /* ── 全局 UI 状态（数据本体永远在 store 里） ────────────── */
  var state = {
    view: 'home',           // 当前视图：home/post/search/mine/detail/success
    tab: 'home',            // 当前底部导航
    selectedId: null,       // 详情页物品 id
    detailFrom: 'home',     // 进入详情前的页面，用于返回定位
    homeFilter: 'all',      // 首页类型筛选
    postType: 'lost',
    postForm: { category: 'card', title: '', description: '', location: '', contact: '' },
    postErrors: {},
    newItemId: null,
  };

  var pages = {}; // name -> function(rootEl)

  /* ── 数据便捷访问 ───────────────────────────────────────── */
  function items() { return store.load(); }
  function byId(id) {
    var all = items();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function isOwn(item) { return !!item && item.ownerId === clientId; }

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

  /* ── 轻提示 ─────────────────────────────────────────────── */
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 2200);
  }

  /* ── 复制联系方式（附加特点） ────────────────────────────── */
  function copyContact(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) toast('联系方式已复制，快去联系对方吧');
      else toast('复制失败，请长按或 Ctrl+C 手动复制');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('联系方式已复制，快去联系对方吧');
      }, fallback);
    } else {
      fallback();
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
    state.detailFrom = from || state.tab;
    state.view = 'detail';
    render();
  }

  function goBack() {
    var to = state.detailFrom || 'home';
    if (to === 'success') to = 'home';
    state.view = to;
    if (to === 'home' || to === 'post' || to === 'search' || to === 'mine') state.tab = to;
    render();
  }

  /* ── 状态更新（我的发布 / 详情页共用入口） ───────────────── */
  function toggleStatus(id) {
    var res = store.toggle(id, clientId);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    if (res.item.status === 'resolved') {
      toast('已标记为「' + Core.resolvedLabel(res.item) + '」，感谢你的更新');
    } else {
      toast('信息已重新开启');
    }
    render();
  }

  /* ── 发布提交 ───────────────────────────────────────────── */
  function submitPost() {
    var v = Core.validatePost(state.postForm);
    if (!v.ok) {
      state.postErrors = v.errors;
      render();
      toast('请先完善标红的必填项');
      return;
    }
    var r = Core.createItem(state.postForm, state.postType, clientId);
    var p = store.add(r.item);
    if (!p.ok) {
      toast(p.error);
      return;
    }
    state.newItemId = r.item.id;
    state.postForm = { category: 'card', title: '', description: '', location: '', contact: '' };
    state.postErrors = {};
    state.tab = 'home';
    state.view = 'success';
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

  /* ── 发布页 ─────────────────────────────────────────────── */
  function renderPost(root) {
    var f = state.postForm;
    var type = state.postType;
    var errs = state.postErrors;

    var typeBtns = [
      { id: 'lost', emoji: '\u{1F61F}', main: '我要寻物', sub: '我遗失了物品' },
      { id: 'found', emoji: '\u{1F60A}', main: '我要招领', sub: '我拾到了物品' },
    ].map(function (t) {
      var cls = 'type-btn' + (type === t.id ? ' active ' + t.id : '');
      return '<button class="' + cls + '" data-ptype="' + t.id + '">' +
        '<span class="t-emoji">' + t.emoji + '</span>' +
        '<span class="t-main">' + t.main + '</span>' +
        '<span class="t-sub">' + t.sub + '</span></button>';
    }).join('');

    var catBtns = Object.keys(CATS).map(function (c) {
      var cls = 'cat-btn' + (f.category === c ? ' active ' + type : '');
      return '<button class="' + cls + '" data-cat="' + c + '">' +
        '<span class="c-emoji">' + CATS[c].emoji + '</span>' +
        '<span class="c-label">' + CATS[c].label + '</span></button>';
    }).join('');

    var locOptions = '<option value="">请选择地点…</option>' + LOCATIONS.map(function (l) {
      return '<option value="' + escapeHtml(l) + '"' +
        (f.location === l ? ' selected' : '') + '>' + escapeHtml(l) + '</option>';
    }).join('');

    function errMsg(key) {
      return errs[key] ? '<p class="err-msg">' + escapeHtml(errs[key]) + '</p>' : '';
    }
    function errCls(key) { return errs[key] ? ' has-err' : ''; }

    root.innerHTML =
      '<div class="page-head">' +
        '<h2 class="page-title" style="font-size:18px">发布信息</h2>' +
        '<p class="page-sub">帮助校园里的物品回到主人身边</p>' +
      '</div>' +
      '<div class="scroll">' +
        '<div><span class="field-label">信息类型</span>' +
          '<div class="type-grid">' + typeBtns + '</div></div>' +
        '<div><span class="field-label">物品分类</span>' +
          '<div class="cat-grid">' + catBtns + '</div>' +
          errMsg('category') + '</div>' +
        '<div><span class="field-label">标题 *</span>' +
          '<input id="f-title" class="input' + errCls('title') + '" type="text" maxlength="60" ' +
            'placeholder="' + (type === 'lost' ? '例如：遗失蓝色校园卡' : '例如：图书馆附近拾到黑色钥匙') + '" ' +
            'value="' + escapeHtml(f.title) + '">' +
          errMsg('title') + '</div>' +
        '<div><span class="field-label">物品描述</span>' +
          '<textarea id="f-desc" class="textarea' + errCls('description') + '" rows="3" ' +
            'placeholder="请描述物品颜色、品牌、特征和具体位置…">' + escapeHtml(f.description) + '</textarea>' +
          errMsg('description') + '</div>' +
        '<div><span class="field-label">地点 *</span>' +
          '<select id="f-loc" class="select' + errCls('location') + '">' + locOptions + '</select>' +
          errMsg('location') + '</div>' +
        '<div><span class="field-label">联系方式 *</span>' +
          '<input id="f-contact" class="input' + errCls('contact') + '" type="text" maxlength="60" ' +
            'placeholder="微信号、手机号、QQ 等" value="' + escapeHtml(f.contact) + '">' +
          errMsg('contact') + '</div>' +
        '<button id="f-submit" class="btn ' + type + '">' +
          (type === 'lost' ? '\u{1F4E2} 发布寻物信息' : '\u{1F4E2} 发布招领信息') +
        '</button>' +
        '<p class="form-hint">带 * 为必填项，联系方式仅在详情页展示</p>' +
      '</div>';

    // 输入只更新状态，不重渲染，避免丢失焦点
    var ptBtns = root.querySelectorAll('[data-ptype]');
    for (var i = 0; i < ptBtns.length; i++) {
      (function (el) {
        el.addEventListener('click', function () {
          state.postType = el.getAttribute('data-ptype');
          render();
        });
      })(ptBtns[i]);
    }
    var catBtnsEls = root.querySelectorAll('[data-cat]');
    for (var j = 0; j < catBtnsEls.length; j++) {
      (function (el) {
        el.addEventListener('click', function () {
          state.postForm.category = el.getAttribute('data-cat');
          delete state.postErrors.category;
          render();
        });
      })(catBtnsEls[j]);
    }
    root.querySelector('#f-title').addEventListener('input', function (e) {
      state.postForm.title = e.target.value;
    });
    root.querySelector('#f-desc').addEventListener('input', function (e) {
      state.postForm.description = e.target.value;
    });
    root.querySelector('#f-loc').addEventListener('change', function (e) {
      state.postForm.location = e.target.value;
    });
    root.querySelector('#f-contact').addEventListener('input', function (e) {
      state.postForm.contact = e.target.value;
    });
    root.querySelector('#f-submit').addEventListener('click', submitPost);
  }

  /* ── 发布成功页 ─────────────────────────────────────────── */
  function renderSuccess(root) {
    var item = byId(state.newItemId);
    if (!item) { goTab('home'); return; }
    var cat = CATS[item.category];

    root.innerHTML =
      '<div class="success-wrap">' +
        '<div class="success-circle ' + item.type + '">✅</div>' +
        '<h2 class="success-title">发布成功！</h2>' +
        '<p class="success-sub">你的信息已发布至校园公告栏，祝你尽快找回或送回物品！</p>' +
        '<div class="card success-card" style="cursor:default">' +
          '<div class="card-row">' +
            '<div class="cat-icon ' + item.type + '">' + cat.emoji + '</div>' +
            '<div class="card-main">' +
              '<p class="card-title">' + escapeHtml(item.title) + '</p>' +
              '<div class="badges">' + typeBadge(item.type) +
                '<span class="card-date">' + fmtDate(item.date) + '</span></div>' +
              '<p class="card-loc">\u{1F4CD}<span>' + escapeHtml(item.location) + '</span></p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="success-btns">' +
          '<button id="s-view" class="btn blue">查看我的发布</button>' +
          '<button id="s-home" class="btn ghost">返回首页</button>' +
        '</div>' +
      '</div>';

    root.querySelector('#s-view').addEventListener('click', function () {
      openDetail(item.id, 'success');
    });
    root.querySelector('#s-home').addEventListener('click', function () {
      goTab('home');
    });
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
    var show = state.view !== 'detail' && state.view !== 'success';
    nav.style.display = show ? '' : 'none';
    if (!show) return;
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
    switch (state.view) {
      case 'home': renderHome(root); break;
      case 'post': renderPost(root); break;
      case 'success': renderSuccess(root); break;
      default:
        if (pages[state.view]) pages[state.view](root);
        else renderHome(root);
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
    store: store,
    clientId: clientId,
    items: items,
    byId: byId,
    isOwn: isOwn,
    goTab: goTab,
    openDetail: openDetail,
    goBack: goBack,
    toggleStatus: toggleStatus,
    copyContact: copyContact,
    toast: toast,
    render: render,
    cardHtml: cardHtml,
    bindCards: bindCards,
    typeBadge: typeBadge,
    statusPill: statusPill,
    emptyHtml: emptyHtml,
  };
})();
