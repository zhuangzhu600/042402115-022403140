/* core.js 的白盒单元测试：校验、创建、检索、状态流转、转义与文案 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/core.js');

const GOOD_FORM = {
  category: 'card',
  title: '遗失校园卡',
  description: '卡面有卡通贴纸',
  location: '主图书馆',
  contact: '微信：test123',
};

/* ── validatePost：必填与边界 ────────────────────────────── */

test('合法表单通过校验', () => {
  const r = Core.validatePost(GOOD_FORM);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, {});
});

test('缺少标题 / 地点 / 联系方式分别报错', () => {
  const r = Core.validatePost({ category: 'card', title: '', location: '', contact: '' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.title);
  assert.ok(r.errors.location);
  assert.ok(r.errors.contact);
});

test('纯空格标题视为未填写', () => {
  const r = Core.validatePost({ ...GOOD_FORM, title: '   ' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.title);
});

test('标题超长被拒绝', () => {
  const r = Core.validatePost({ ...GOOD_FORM, title: 'a'.repeat(Core.TITLE_MAX + 1) });
  assert.equal(r.ok, false);
  assert.ok(r.errors.title);
});

test('地点必须在预设范围内', () => {
  const r = Core.validatePost({ ...GOOD_FORM, location: '火星基地' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.location);
});

test('非法分类被拒绝', () => {
  const r = Core.validatePost({ ...GOOD_FORM, category: 'spaceship' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.category);
});

/* ── createItem ──────────────────────────────────────────── */

test('createItem 生成完整字段并去除首尾空格', () => {
  const now = new Date(2026, 9, 7); // 2026-10-07 本地时间
  const r = Core.createItem({ ...GOOD_FORM, title: '  遗失校园卡  ' }, 'lost', 'cid-test', now);
  assert.equal(r.ok, true);
  assert.equal(r.item.title, '遗失校园卡');
  assert.equal(r.item.status, 'active');
  assert.equal(r.item.ownerId, 'cid-test');
  assert.equal(r.item.date, '2026-10-07');
  assert.ok(r.item.id);
});

test('createItem 拒绝非法类型', () => {
  const r = Core.createItem(GOOD_FORM, 'stolen', 'cid-test');
  assert.equal(r.ok, false);
  assert.ok(r.errors.type);
});

/* ── searchItems：组合检索 ───────────────────────────────── */

const ITEMS = [
  { id: '1', type: 'lost', category: 'card', title: '遗失校园卡', description: '有贴纸', location: '主图书馆', contact: 'a', status: 'active' },
  { id: '2', type: 'found', category: 'keys', title: '拾到钥匙', description: '蓝色钥匙扣', location: '第一食堂', contact: 'b', status: 'active' },
  { id: '3', type: 'lost', category: 'keys', title: '遗失宿舍钥匙', description: '皮卡丘挂件', location: 'A 区宿舍', contact: 'c', status: 'resolved' },
];

test('关键词命中标题 / 描述 / 地点任一字段', () => {
  assert.equal(Core.searchItems(ITEMS, { query: '校园卡' }).length, 1); // 标题
  assert.equal(Core.searchItems(ITEMS, { query: '钥匙扣' }).length, 1); // 描述
  assert.equal(Core.searchItems(ITEMS, { query: '食堂' }).length, 1);   // 地点
});

test('关键词首尾空格不影响查询，大小写不敏感', () => {
  assert.equal(Core.searchItems(ITEMS, { query: '  校园卡  ' }).length, 1);
  const items = [{ ...ITEMS[0], title: 'Lost AirPods' }];
  assert.equal(Core.searchItems(items, { query: 'airpods' }).length, 1);
});

test('关键词与分类、类型可叠加，且为“与”关系', () => {
  const r = Core.searchItems(ITEMS, { query: '钥匙', category: 'keys', type: 'lost' });
  assert.deepEqual(r.map(i => i.id), ['3']);
});

test('只看进行中会过滤已解决记录', () => {
  const r = Core.searchItems(ITEMS, { query: '钥匙', onlyActive: true });
  assert.deepEqual(r.map(i => i.id), ['2']);
});

test('无匹配返回空数组而不是报错', () => {
  assert.deepEqual(Core.searchItems(ITEMS, { query: '不存在的东西' }), []);
});

/* ── sortItems ───────────────────────────────────────────── */

test('进行中的记录排在已解决之前，同状态按日期新到旧', () => {
  const sorted = Core.sortItems([
    { id: 'a', status: 'resolved', date: '2026-10-06' },
    { id: 'b', status: 'active', date: '2026-10-01' },
    { id: 'c', status: 'active', date: '2026-10-05' },
  ]);
  assert.deepEqual(sorted.map(i => i.id), ['c', 'b', 'a']);
});

/* ── toggleStatus：状态流转与权限 ────────────────────────── */

test('发布者可以将进行中标记为已解决，且不修改原对象', () => {
  const item = { id: '1', type: 'lost', status: 'active', ownerId: 'me' };
  const r = Core.toggleStatus(item, 'me');
  assert.equal(r.ok, true);
  assert.equal(r.item.status, 'resolved');
  assert.equal(item.status, 'active'); // 原对象不变
});

test('已解决的信息可以重新开启', () => {
  const item = { id: '1', type: 'found', status: 'resolved', ownerId: 'me' };
  const r = Core.toggleStatus(item, 'me');
  assert.equal(r.ok, true);
  assert.equal(r.item.status, 'active');
});

test('非发布者无权修改状态', () => {
  const item = { id: '1', type: 'lost', status: 'active', ownerId: 'demo' };
  const r = Core.toggleStatus(item, 'someone-else');
  assert.equal(r.ok, false);
  assert.match(r.error, /只能修改自己/);
});

test('对不存在的记录操作返回错误', () => {
  const r = Core.toggleStatus(null, 'me');
  assert.equal(r.ok, false);
});

/* ── 文案与转义 ──────────────────────────────────────────── */

test('已解决文案：寻物为已找到，招领为已归还', () => {
  assert.equal(Core.resolvedLabel({ type: 'lost' }), '已找到');
  assert.equal(Core.resolvedLabel({ type: 'found' }), '已归还');
});

test('escapeHtml 转义注入字符', () => {
  assert.equal(
    Core.escapeHtml('<script>"x"&\'y\'</script>'),
    '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;'
  );
});

test('fmtDate 正常转换，非法输入原样返回', () => {
  assert.equal(Core.fmtDate('2026-03-14'), '3月14日');
  assert.equal(Core.fmtDate('垃圾数据'), '垃圾数据');
});
