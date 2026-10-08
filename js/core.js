/* ============================================================
 * core.js —— 可独立测试的数据规则
 * 只包含纯函数：表单校验、检索过滤、状态流转、文案规则。
 * 不访问 DOM 与 localStorage，因此既能在浏览器中作为全局
 * `Core` 使用，也能在 Node.js 中 require 后做单元测试。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;               // Node.js（单元测试）
  } else {
    root.Core = api;                    // 浏览器全局
  }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  /* ── 常量 ─────────────────────────────────────────────── */

  var CATS = {
    card:       { label: '校园卡', emoji: '\u{1FAAA}' },
    keys:       { label: '钥匙',   emoji: '\u{1F511}' },
    bottle:     { label: '水杯',   emoji: '\u{1F9F4}' },
    umbrella:   { label: '雨伞',   emoji: '\u2602\uFE0F' },
    headphones: { label: '耳机',   emoji: '\u{1F3A7}' },
    book:       { label: '书籍',   emoji: '\u{1F4DA}' },
    bag:        { label: '背包',   emoji: '\u{1F392}' },
    other:      { label: '其他',   emoji: '\u{1F4E6}' },
  };

  var LOCATIONS = [
    '主图书馆', '理科楼 A 座', '理科楼 B 座',
    '第一食堂', '第二食堂', '体育中心',
    '学生活动中心', 'A 区宿舍', 'B 区宿舍',
    '行政楼', '工程实验楼',
  ];

  var TITLE_MAX = 30;
  var DESC_MAX = 200;
  var CONTACT_MAX = 50;

  /* ── 工具 ─────────────────────────────────────────────── */

  /** 所有来自用户输入的字符串写入 HTML 前必须转义 */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** '2026-03-14' -> '3月14日'；格式不符时原样返回 */
  function fmtDate(d) {
    var parts = String(d || '').split('-');
    if (parts.length !== 3) return String(d || '');
    var m = +parts[1], day = +parts[2];
    if (!m || !day) return String(d || '');
    return m + '月' + day + '日';
  }

  /** 本地时区的 YYYY-MM-DD（不用 toISOString，避免时区差一天） */
  function localDateStr(d) {
    var dt = d instanceof Date ? d : new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate());
  }

  /* ── 校验 ─────────────────────────────────────────────── */

  /**
   * 校验发布表单。返回 { ok, errors }，errors 以字段名为键。
   * 标题/联系方式允许首尾空格但拒绝纯空格；超长输入被拒绝。
   */
  function validatePost(form) {
    var errors = {};
    form = form || {};
    var title = String(form.title || '').trim();
    var contact = String(form.contact || '').trim();

    if (!title) errors.title = '请填写标题';
    else if (title.length > TITLE_MAX) errors.title = '标题不能超过 ' + TITLE_MAX + ' 字';

    if (!form.location) errors.location = '请选择地点';
    else if (LOCATIONS.indexOf(form.location) === -1) errors.location = '地点不在可选范围内';

    if (!contact) errors.contact = '请填写联系方式';
    else if (contact.length > CONTACT_MAX) errors.contact = '联系方式不能超过 ' + CONTACT_MAX + ' 字';

    if (String(form.description || '').length > DESC_MAX) {
      errors.description = '描述不能超过 ' + DESC_MAX + ' 字';
    }
    if (!form.category || !CATS[form.category]) errors.category = '请选择物品分类';

    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  /* ── 创建 ─────────────────────────────────────────────── */

  var counter = 0;

  /**
   * 由表单生成一条信息。now 可注入（测试用），默认取当前时间。
   * 校验失败返回 { ok:false, errors }，成功返回 { ok:true, item }。
   */
  function createItem(form, type, ownerId, now) {
    if (type !== 'lost' && type !== 'found') {
      return { ok: false, errors: { type: '信息类型不正确' } };
    }
    var v = validatePost(form);
    if (!v.ok) return { ok: false, errors: v.errors };

    var id = 'p' + Date.now().toString(36) +
      (counter++).toString(36) +
      Math.random().toString(36).slice(2, 6);

    return {
      ok: true,
      item: {
        id: id,
        type: type,
        category: form.category,
        title: String(form.title).trim(),
        description: String(form.description || '').trim(),
        location: form.location,
        date: localDateStr(now),
        contact: String(form.contact).trim(),
        poster: '我',
        status: 'active',
        ownerId: ownerId || 'anonymous',
      },
    };
  }

  /* ── 检索与过滤 ───────────────────────────────────────── */

  /** 关键词命中标题 / 描述 / 地点任一字段（大小写不敏感） */
  function matchesQuery(item, q) {
    if (!q) return true;
    var s = (item.title + ' ' + item.description + ' ' + item.location).toLowerCase();
    return s.indexOf(String(q).toLowerCase()) !== -1;
  }

  /**
   * 组合检索。opts: { query, category, type, onlyActive }
   * 查询前去掉关键词首尾空格；type: 'all' | 'lost' | 'found'
   */
  function searchItems(items, opts) {
    opts = opts || {};
    var q = String(opts.query || '').trim();
    var cat = opts.category || 'all';
    var type = opts.type || 'all';
    return (items || []).filter(function (it) {
      if (opts.onlyActive && it.status !== 'active') return false;
      if (type !== 'all' && it.type !== type) return false;
      if (cat !== 'all' && it.category !== cat) return false;
      return matchesQuery(it, q);
    });
  }

  /** 列表排序：进行中的排前，同状态按日期新到旧 */
  function sortItems(items) {
    return (items || []).slice().sort(function (a, b) {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });
  }

  /* ── 状态流转 ─────────────────────────────────────────── */

  /**
   * 切换信息状态。只有发布者本人（ownerId 匹配）可以操作。
   * 返回 { ok:true, item: 新对象 } 或 { ok:false, error }，不修改原对象。
   */
  function toggleStatus(item, requesterId) {
    if (!item) return { ok: false, error: '没有找到这条信息' };
    if (item.ownerId !== requesterId) {
      return { ok: false, error: '只能修改自己发布的信息' };
    }
    var next = item.status === 'active' ? 'resolved' : 'active';
    var copy = {};
    for (var k in item) copy[k] = item[k];
    copy.status = next;
    return { ok: true, item: copy };
  }

  /** 已解决状态的文案：寻物 -> 已找到，招领 -> 已归还 */
  function resolvedLabel(item) {
    return item.type === 'lost' ? '已找到' : '已归还';
  }

  /** 进行中的操作按钮文案 */
  function resolveActionLabel(item) {
    return item.type === 'lost' ? '✓ 标记已找到' : '✓ 标记已归还';
  }

  /* ── 数据合法性（持久层读取时的护栏） ────────────────── */

  function isValidItem(it) {
    return !!it &&
      typeof it.id === 'string' &&
      (it.type === 'lost' || it.type === 'found') &&
      !!CATS[it.category] &&
      typeof it.title === 'string' &&
      typeof it.location === 'string' &&
      typeof it.contact === 'string' &&
      (it.status === 'active' || it.status === 'resolved');
  }

  return {
    CATS: CATS,
    LOCATIONS: LOCATIONS,
    TITLE_MAX: TITLE_MAX,
    DESC_MAX: DESC_MAX,
    CONTACT_MAX: CONTACT_MAX,
    escapeHtml: escapeHtml,
    fmtDate: fmtDate,
    localDateStr: localDateStr,
    validatePost: validatePost,
    createItem: createItem,
    matchesQuery: matchesQuery,
    searchItems: searchItems,
    sortItems: sortItems,
    toggleStatus: toggleStatus,
    resolvedLabel: resolvedLabel,
    resolveActionLabel: resolveActionLabel,
    isValidItem: isValidItem,
  };
});
