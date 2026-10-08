/* ============================================================
 * storage.js —— 浏览器本地保存与共用数据接口
 * 所有页面读写同一份数据（localStorage 键 campus-lostfound.v1），
 * 首页 / 搜索 / 详情 / 我的发布看到的永远是同一个状态。
 * 后端可注入，因此可以在 Node.js 中用内存假后端做单元测试。
 * ============================================================ */
(function (root, factory) {
  var Core = (typeof module !== 'undefined' && module.exports)
    ? require('./core.js')
    : root.Core;
  var api = factory(Core);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Storage = api;
  }
})(typeof self !== 'undefined' ? self : globalThis, function (Core) {
  'use strict';

  var KEY = 'campus-lostfound.v1';
  var CID_KEY = 'campus-lostfound.v1.cid';

  /* 首次打开时展示的虚构演示记录，ownerId 固定为 demo，
     因此不会出现在任何浏览器的“我的发布”里。 */
  var SEED = [
    {
      id: '1', type: 'lost', category: 'card',
      title: '遗失校园卡',
      description: '在主图书馆附近遗失校园卡，卡上有本人照片和学号 2021xxxxx。最后一次使用是在周四下午二楼自习室，如有拾到请联系我！',
      location: '主图书馆', date: '2026-10-05',
      contact: '微信：小张同学', poster: '张伟', status: 'active', ownerId: 'demo',
    },
    {
      id: '2', type: 'found', category: 'keys',
      title: '拾到一串钥匙',
      description: '在第一食堂入口附近拾到一串三把钥匙，挂有蓝色猫头鹰钥匙扣。现存放于食堂前台，请携带校园卡认领。',
      location: '第一食堂', date: '2026-10-06',
      contact: '电话：138-xxxx-2847', poster: '李梅', status: 'active', ownerId: 'demo',
    },
    {
      id: '3', type: 'lost', category: 'headphones',
      title: '遗失索尼 WH-1000XM5 耳机',
      description: '将黑色索尼降噪耳机遗落在图书馆 302 自习室，装在深灰色收纳盒内，贴有本人姓名贴。如有拾到，感谢联系！',
      location: '主图书馆', date: '2026-10-04',
      contact: 'QQ：8823****47', poster: '王芳', status: 'active', ownerId: 'demo',
    },
    {
      id: '4', type: 'found', category: 'umbrella',
      title: '拾到蓝色折叠伞',
      description: '在体育中心更衣室拾到一把蓝色折叠伞，伞面有浅色格纹。已交至体育中心服务台。',
      location: '体育中心', date: '2026-10-06',
      contact: '微信：刘洋同学', poster: '刘洋', status: 'active', ownerId: 'demo',
    },
    {
      id: '5', type: 'lost', category: 'book',
      title: '遗失《高等数学（下册）》',
      description: '遗失一本有大量荧光笔标记和页边批注的高数教材，封面内页写有本人学号。',
      location: '工程实验楼', date: '2026-10-03',
      contact: '电话：137-xxxx-5519', poster: '陈静', status: 'active', ownerId: 'demo',
    },
    {
      id: '6', type: 'found', category: 'card',
      title: '拾到图书馆门禁卡',
      description: '在 B 区宿舍门口附近拾到一张图书馆门禁卡，可看到部分姓名信息。现存放在 B 区宿舍门卫处。',
      location: 'B 区宿舍', date: '2026-10-05',
      contact: '微信：B区宿舍门卫', poster: '徐明', status: 'active', ownerId: 'demo',
    },
    {
      id: '7', type: 'lost', category: 'bag',
      title: '遗失黑色双肩包',
      description: '将黑色双肩包遗落在学生活动中心外的长椅上，内有笔记本电脑、笔记本和充电线。如有线索请尽快联系！',
      location: '学生活动中心', date: '2026-10-02',
      contact: '电话：135-xxxx-7723', poster: '赵磊', status: 'resolved', ownerId: 'demo',
    },
    {
      id: '8', type: 'found', category: 'bottle',
      title: '拾到绿色保温杯',
      description: '在理科楼 A 座外拾到一个深绿色不锈钢保温杯，杯底附近有卡通贴纸。已放至楼宇前台。',
      location: '理科楼 A 座', date: '2026-10-06',
      contact: '微信：理科楼服务台', poster: '杨华', status: 'active', ownerId: 'demo',
    },
    {
      id: '9', type: 'lost', category: 'keys',
      title: '遗失宿舍钥匙',
      description: '在食堂至 A 区宿舍之间遗失宿舍钥匙，钥匙圈上挂有皮卡丘小挂件。目前无法进宿舍，急寻！',
      location: 'A 区宿舍', date: '2026-10-06',
      contact: '电话：136-xxxx-8844', poster: '孙莉', status: 'active', ownerId: 'demo',
    },
    {
      id: '10', type: 'found', category: 'book',
      title: '拾到《算法导论》',
      description: '在理科楼 B 座 203 教室拾到一本较厚的计算机教材《算法导论》，内有少量铅笔批注。请联系认领。',
      location: '理科楼 B 座', date: '2026-10-04',
      contact: '微信：何楠同学', poster: '何楠', status: 'active', ownerId: 'demo',
    },
  ];

  /* 内存假后端：浏览器 localStorage 不可用（隐私模式等）时兜底，
     也是 Node.js 单元测试使用的后端形态。 */
  function memoryBackend() {
    var m = {};
    return {
      getItem: function (k) { return k in m ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; },
    };
  }

  function defaultBackend() {
    try {
      if (typeof localStorage !== 'undefined') {
        var t = '__lf_probe__';
        localStorage.setItem(t, '1');
        localStorage.removeItem(t);
        return localStorage;
      }
    } catch (e) { /* localStorage 被禁用 */ }
    return memoryBackend();
  }

  /**
   * 创建数据仓库。backend 是符合 localStorage 接口的对象，可注入。
   * 方法：load / add / toggle / update / getClientId / reset
   */
  function createStore(backend) {
    var db = backend || defaultBackend();
    var cache = null;

    /** 本浏览器的标识，用于区分“我发布的”与“别人的” */
    function getClientId() {
      var cid = db.getItem(CID_KEY);
      if (!cid) {
        cid = 'cid-' + Date.now().toString(36) +
          Math.random().toString(36).slice(2, 8);
        db.setItem(CID_KEY, cid);
      }
      return cid;
    }

    function persist(items) {
      try {
        db.setItem(KEY, JSON.stringify({ version: 1, items: items }));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: '本地保存失败：' + (e && e.message ? e.message : '存储空间不足') };
      }
    }

    /**
     * 读取全部信息。首次或数据损坏时回退到演示数据；
     * 读到的记录逐条过 isValidItem 护栏，坏记录直接丢弃。
     */
    function load() {
      if (cache) return cache;
      var items = null;
      try {
        var raw = db.getItem(KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.items)) {
            items = parsed.items.filter(Core.isValidItem);
          }
        }
      } catch (e) {
        items = null; // JSON 损坏，按首次打开处理
      }
      if (!items) {
        items = SEED.map(function (it) {
          var c = {}; for (var k in it) c[k] = it[k]; return c;
        });
        persist(items);
      }
      cache = items;
      return items;
    }

    /** 新增一条，返回写入结果 */
    function add(item) {
      var items = load();
      items.unshift(item);
      return persist(items);
    }

    /**
     * 按 id 更新一条记录。fn 是 (item, requesterId) -> { ok, item|error }。
     * 写入失败时回滚内存中的修改，保证页面与存储一致。
     */
    function update(id, fn, requesterId) {
      var items = load();
      var idx = -1;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) { idx = i; break; }
      }
      if (idx === -1) return { ok: false, error: '没有找到这条信息' };
      var old = items[idx];
      var res = fn(old, requesterId);
      if (!res.ok) return res;
      items[idx] = res.item;
      var p = persist(items);
      if (!p.ok) {
        items[idx] = old; // 回滚
        return { ok: false, error: p.error };
      }
      return res;
    }

    /** 切换“已找到 / 已归还”状态，带发布者权限校验 */
    function toggle(id, requesterId) {
      return update(id, Core.toggleStatus, requesterId);
    }

    /** 清空全部数据（测试与调试用） */
    function reset() {
      cache = null;
      db.removeItem(KEY);
    }

    return {
      KEY: KEY,
      load: load,
      add: add,
      update: update,
      toggle: toggle,
      getClientId: getClientId,
      reset: reset,
    };
  }

  return { createStore: createStore, SEED: SEED, KEY: KEY, memoryBackend: memoryBackend };
});
