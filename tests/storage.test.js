/* storage.js 的单元测试：持久化、损坏数据护栏、权限与回滚。
   使用内存假后端注入，不依赖浏览器 localStorage。 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Storage = require('../js/storage.js');

function freshStore() {
  return Storage.createStore(Storage.memoryBackend());
}

/* ── 首次加载与持久化 ────────────────────────────────────── */

test('首次打开回退到演示数据，且演示数据归属 demo', () => {
  const store = freshStore();
  const items = store.load();
  assert.equal(items.length, Storage.SEED.length);
  assert.ok(items.every(i => i.ownerId === 'demo'));
});

test('新发布的信息写入后可被新仓库实例读到（确实持久化）', () => {
  const backend = Storage.memoryBackend();
  const s1 = Storage.createStore(backend);
  const cid = s1.getClientId();
  s1.add({
    id: 'x1', type: 'lost', category: 'card', title: '测试物品',
    description: '', location: '主图书馆', date: '2026-10-07',
    contact: 'QQ:1', poster: '我', status: 'active', ownerId: cid,
  });
  const s2 = Storage.createStore(backend); // 模拟刷新页面
  assert.ok(s2.load().some(i => i.id === 'x1'));
});

test('clientId 在同一后端下保持稳定', () => {
  const backend = Storage.memoryBackend();
  const a = Storage.createStore(backend).getClientId();
  const b = Storage.createStore(backend).getClientId();
  assert.equal(a, b);
  assert.match(a, /^cid-/);
});

/* ── 损坏数据护栏 ────────────────────────────────────────── */

test('存储内容不是合法 JSON 时按首次打开处理，不崩溃', () => {
  const backend = Storage.memoryBackend();
  backend.setItem(Storage.KEY, '{not json!!!');
  const store = Storage.createStore(backend);
  assert.equal(store.load().length, Storage.SEED.length);
});

test('结构非法的记录被逐条过滤，合法记录保留', () => {
  const backend = Storage.memoryBackend();
  backend.setItem(Storage.KEY, JSON.stringify({
    version: 1,
    items: [
      { id: 'ok', type: 'lost', category: 'card', title: '好记录', location: '主图书馆', contact: 'x', status: 'active' },
      { id: 'bad1', type: 'stolen' },                 // 类型非法
      { id: 'bad2', type: 'lost', category: '???' },  // 分类非法
      null,
    ],
  }));
  const store = Storage.createStore(backend);
  const items = store.load();
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'ok');
});

/* ── 状态更新与权限 ──────────────────────────────────────── */

test('发布者可以结束自己的信息，状态被持久化', () => {
  const backend = Storage.memoryBackend();
  const s1 = Storage.createStore(backend);
  const cid = s1.getClientId();
  s1.add({
    id: 'mine1', type: 'found', category: 'umbrella', title: '拾到雨伞',
    description: '', location: '体育中心', date: '2026-10-07',
    contact: '微信：x', poster: '我', status: 'active', ownerId: cid,
  });
  const r = s1.toggle('mine1', cid);
  assert.equal(r.ok, true);
  assert.equal(r.item.status, 'resolved');
  const s2 = Storage.createStore(backend);
  assert.equal(s2.load().find(i => i.id === 'mine1').status, 'resolved');
});

test('无权操作演示记录：失败且存储内容不变', () => {
  const backend = Storage.memoryBackend();
  const store = Storage.createStore(backend);
  store.load(); // 先触发初始化写入
  const before = backend.getItem(Storage.KEY);
  const r = store.toggle('1', 'cid-not-demo');
  assert.equal(r.ok, false);
  assert.match(r.error, /只能修改自己/);
  assert.equal(backend.getItem(Storage.KEY), before); // 未写入
});

test('对不存在的 id 更新返回错误', () => {
  const store = freshStore();
  const r = store.toggle('no-such-id', 'cid-x');
  assert.equal(r.ok, false);
});

/* ── 写入失败回滚 ────────────────────────────────────────── */

test('存储写入失败时回滚内存修改并报告错误', () => {
  const backend = Storage.memoryBackend();
  const store = Storage.createStore(backend);
  const cid = store.getClientId();
  store.add({
    id: 'r1', type: 'lost', category: 'book', title: '测试回滚',
    description: '', location: '行政楼', date: '2026-10-07',
    contact: 'x', poster: '我', status: 'active', ownerId: cid,
  });
  // 让后续写入失败（模拟存储空间不足）
  const origSet = backend.setItem;
  backend.setItem = () => { throw new Error('QuotaExceeded'); };
  const r = store.toggle('r1', cid);
  assert.equal(r.ok, false);
  assert.match(r.error, /保存失败/);
  // 内存中的状态已回滚，页面不会显示假成功
  assert.equal(store.load().find(i => i.id === 'r1').status, 'active');
  backend.setItem = origSet;
});

test('reset 后重新加载回到演示数据', () => {
  const store = freshStore();
  store.add({
    id: 'z1', type: 'lost', category: 'bag', title: '临时',
    description: '', location: '行政楼', date: '2026-10-07',
    contact: 'x', poster: '我', status: 'active', ownerId: 'me',
  });
  store.reset();
  assert.equal(store.load().length, Storage.SEED.length);
});
