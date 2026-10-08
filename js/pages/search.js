/* ============================================================
 * pages/search.js —— 搜索页
 * 关键词（标题/描述/地点）+ 物品分类 + “只看进行中”组合筛选。
 * 输入时只刷新结果区，不重渲整页，避免输入框丢失焦点。
 * 搜索状态保存在模块内，离开页面再回来条件不丢。
 * ============================================================ */
(function () {
  'use strict';

  var query = '';
  var category = 'all';
  var onlyActive = false;

  App.registerPage('search', function (root) {
    var CATS = Core.CATS;

    var chipsHtml = [{ id: 'all', label: '全部', emoji: '' }]
      .concat(Object.keys(CATS).map(function (c) {
        return { id: c, label: CATS[c].label, emoji: CATS[c].emoji };
      }))
      .map(function (c) {
        var cls = 'chip outline' + (category === c.id ? ' active' : '');
        return '<button class="' + cls + '" data-scat="' + c.id + '">' +
          (c.emoji ? '<span>' + c.emoji + '</span>' : '') + c.label + '</button>';
      }).join('');

    root.innerHTML =
      '<div class="page-head">' +
        '<h2 class="page-title" style="font-size:18px;margin-bottom:12px">搜索</h2>' +
        '<div class="search-wrap">' +
          '<span class="s-icon">\u{1F50D}</span>' +
          '<input id="s-input" class="input search-input" type="text" ' +
            'placeholder="搜索物品、地点或描述…" value="' + Core.escapeHtml(query) + '">' +
          (query ? '<button id="s-clear" class="search-clear">✕</button>' : '') +
        '</div>' +
        '<div class="chips scroll-x">' + chipsHtml + '</div>' +
        '<div class="switch-row">' +
          '<button id="s-active" class="switch' + (onlyActive ? ' on' : '') + '" role="switch" ' +
            'aria-checked="' + onlyActive + '"></button>' +
          '<span>只看进行中（隐藏已找到 / 已归还）</span>' +
        '</div>' +
      '</div>' +
      '<div class="scroll" id="s-results"></div>';

    var resultsEl = root.querySelector('#s-results');
    var inputEl = root.querySelector('#s-input');

    function hasSearch() {
      return !!(query.trim() || category !== 'all' || onlyActive);
    }

    function refreshResults() {
      if (!hasSearch()) {
        resultsEl.innerHTML = App.emptyHtml('\u{1F50D}', '搜索失物或招领信息', '输入关键词，或按分类筛选');
        return;
      }
      var list = Core.sortItems(Core.searchItems(App.items(), {
        query: query,
        category: category,
        onlyActive: onlyActive,
      }));
      if (!list.length) {
        resultsEl.innerHTML = App.emptyHtml('\u{1F615}', '没有找到相关信息', '试试其他关键词或扩大分类范围');
        return;
      }
      resultsEl.innerHTML =
        '<p class="result-count">找到 ' + list.length + ' 条相关信息</p>' +
        list.map(App.cardHtml).join('');
      App.bindCards(resultsEl, 'search');
    }

    inputEl.addEventListener('input', function (e) {
      query = e.target.value;
      // 清除按钮的出现/消失需要更新头部，但不动输入框
      var clearBtn = root.querySelector('#s-clear');
      if (query && !clearBtn) {
        var b = document.createElement('button');
        b.id = 's-clear';
        b.className = 'search-clear';
        b.textContent = '✕';
        b.addEventListener('click', clearQuery);
        root.querySelector('.search-wrap').appendChild(b);
      } else if (!query && clearBtn) {
        clearBtn.parentNode.removeChild(clearBtn);
      }
      refreshResults();
    });

    function clearQuery() {
      query = '';
      inputEl.value = '';
      var clearBtn = root.querySelector('#s-clear');
      if (clearBtn) clearBtn.parentNode.removeChild(clearBtn);
      refreshResults();
      inputEl.focus();
    }

    var chipEls = root.querySelectorAll('[data-scat]');
    for (var i = 0; i < chipEls.length; i++) {
      (function (el) {
        el.addEventListener('click', function () {
          category = el.getAttribute('data-scat');
          var all = root.querySelectorAll('[data-scat]');
          for (var j = 0; j < all.length; j++) all[j].classList.remove('active');
          el.classList.add('active');
          refreshResults();
        });
      })(chipEls[i]);
    }

    var clearBtn0 = root.querySelector('#s-clear');
    if (clearBtn0) clearBtn0.addEventListener('click', clearQuery);

    root.querySelector('#s-active').addEventListener('click', function () {
      onlyActive = !onlyActive;
      this.classList.toggle('on', onlyActive);
      this.setAttribute('aria-checked', String(onlyActive));
      refreshResults();
    });

    refreshResults();
  });
})();
