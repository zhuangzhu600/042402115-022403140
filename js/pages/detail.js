/* ============================================================
 * pages/detail.js —— 物品详情页
 * 用物品 ID 从同一份数据里取，列表和详情不会出现两套内容；
 * 联系方式支持一键复制；自己的发布可以在这里更新状态。
 * ============================================================ */
App.registerPage('detail', function (root) {
  'use strict';

  var item = App.byId(App.state.selectedId);

  /* 找不到记录（例如 ID 不存在）时给出明确提示和出口 */
  if (!item) {
    root.innerHTML =
      '<div class="detail-head">' +
        '<button class="back-btn" id="d-back">‹</button>' +
        '<h2 class="detail-title">物品详情</h2>' +
      '</div>' +
      App.emptyHtml('\u{1F50E}', '没有找到这条信息', '它可能已被移除') +
      '<div style="padding:0 24px"><button class="btn blue" id="d-home">返回首页</button></div>';
    root.querySelector('#d-back').addEventListener('click', App.goBack);
    root.querySelector('#d-home').addEventListener('click', function () { App.goTab('home'); });
    return;
  }

  var cat = Core.CATS[item.category];
  var own = App.isOwn(item);

  function infoRow(icon, label, value) {
    return '<div class="info-row">' +
      '<span class="info-icon">' + icon + '</span>' +
      '<span class="info-label">' + label + '</span>' +
      '<span class="info-value">' + Core.escapeHtml(value) + '</span></div>';
  }

  var manageHtml = '';
  if (own) {
    var isActive = item.status === 'active';
    manageHtml =
      '<div class="panel">' +
        '<p class="manage-kicker">管理我的发布</p>' +
        '<button id="d-toggle" class="btn small ' + (isActive ? 'resolve' : 'reopen') + '">' +
          (isActive ? Core.resolveActionLabel(item) : '↩ 重新开启信息') +
        '</button>' +
        '<p class="manage-tip">' +
          (isActive
            ? (item.type === 'lost' ? '物品找回后，可将信息标记为已找到' : '物品归还后，可将信息标记为已归还')
            : '若仍在寻找，可重新开启这条信息') +
        '</p>' +
      '</div>';
  }

  root.innerHTML =
    '<div class="detail-head">' +
      '<button class="back-btn" id="d-back">‹</button>' +
      '<h2 class="detail-title">物品详情</h2>' +
      App.typeBadge(item.type) +
      '<button class="home-link" id="d-home">首页</button>' +
    '</div>' +
    '<div class="scroll">' +
      '<div class="panel">' +
        '<div class="panel-head">' +
          '<div class="cat-icon big ' + item.type + '">' + cat.emoji + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<h3 class="detail-name">' + Core.escapeHtml(item.title) + '</h3>' +
            '<div class="badges" style="margin:0">' +
              App.typeBadge(item.type) + App.statusPill(item) +
            '</div>' +
          '</div>' +
        '</div>' +
        (item.description
          ? '<p class="detail-desc">' + Core.escapeHtml(item.description) + '</p>'
          : '') +
      '</div>' +
      '<div class="panel">' +
        infoRow('\u{1F4C1}', '分类', cat.label) +
        infoRow('\u{1F4CD}', '地点', item.location) +
        infoRow('\u{1F4C5}', '日期', Core.fmtDate(item.date)) +
        infoRow('\u{1F464}', '发布者', own ? '我' : item.poster) +
      '</div>' +
      '<div class="contact-box ' + item.type + '">' +
        '<p class="contact-kicker">联系发布者</p>' +
        '<div class="contact-row">' +
          '<p class="contact-text">' + Core.escapeHtml(item.contact) + '</p>' +
          '<button class="btn-copy" id="d-copy">复制联系方式</button>' +
        '</div>' +
        '<p class="contact-tip">联系前请先核对物品特征，注意保护个人信息</p>' +
      '</div>' +
      manageHtml +
    '</div>';

  root.querySelector('#d-back').addEventListener('click', App.goBack);
  root.querySelector('#d-home').addEventListener('click', function () { App.goTab('home'); });
  root.querySelector('#d-copy').addEventListener('click', function () {
    App.copyContact(item.contact);
  });
  if (own) {
    root.querySelector('#d-toggle').addEventListener('click', function () {
      App.toggleStatus(item.id);
    });
  }
});
