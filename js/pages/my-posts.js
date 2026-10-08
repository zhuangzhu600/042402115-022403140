/* ============================================================
 * pages/my-posts.js —— 我的发布
 * 只显示本浏览器发布的记录（ownerId 匹配），演示数据不会混入；
 * 进行中的记录可以一键“标记已找到 / 标记已归还”。
 * ============================================================ */
App.registerPage('mine', function (root) {
  'use strict';

  var mine = Core.sortItems(App.items().filter(function (it) {
    return it.ownerId === App.clientId;
  }));
  var active = mine.filter(function (p) { return p.status === 'active'; });
  var resolved = mine.filter(function (p) { return p.status === 'resolved'; });

  function activeCard(item) {
    return '<div class="card-wrap">' +
      App.cardHtml(item) +
      '<button class="quick-btn" data-resolve="' + Core.escapeHtml(item.id) + '">' +
        (item.type === 'lost' ? '已找到' : '已归还') +
      '</button>' +
    '</div>';
  }

  var listHtml;
  if (!mine.length) {
    listHtml = App.emptyHtml('\u{1F4DD}', '暂未发布信息', '发布一条寻物或招领信息吧') +
      '<div style="padding:0 40px"><button class="btn blue" id="m-gopost">去发布</button></div>';
  } else {
    listHtml =
      (active.length
        ? '<p class="sec-label">进行中（' + active.length + '）</p>' +
          active.map(activeCard).join('')
        : '') +
      (resolved.length
        ? '<p class="sec-label">已解决（' + resolved.length + '）</p>' +
          resolved.map(App.cardHtml).join('')
        : '');
  }

  root.innerHTML =
    '<div class="page-head">' +
      '<h2 class="page-title" style="font-size:18px">我的发布</h2>' +
      '<p class="page-sub">进行中 ' + active.length + ' 条 · 已解决 ' + resolved.length + ' 条</p>' +
    '</div>' +
    '<div class="scroll" style="padding-top:0">' +
      '<div class="user-card">' +
        '<div class="avatar">我</div>' +
        '<div>' +
          '<p class="user-name">当前用户</p>' +
          '<p class="user-sub">校园学生 · 共发布 ' + mine.length + ' 条信息</p>' +
        '</div>' +
      '</div>' +
      '<div style="height:12px"></div>' +
      listHtml +
    '</div>';

  App.bindCards(root, 'mine');

  var resolveBtns = root.querySelectorAll('[data-resolve]');
  for (var i = 0; i < resolveBtns.length; i++) {
    (function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        App.toggleStatus(el.getAttribute('data-resolve'));
      });
    })(resolveBtns[i]);
  }

  var goPost = root.querySelector('#m-gopost');
  if (goPost) goPost.addEventListener('click', function () { App.goTab('post'); });
});
