# CRM 系统二次深度审计报告（2026-06-24）

**文件**: D:\GitHub-tongbuwenjianjia\CRMsystem\CRMsystem\index.html
**版本行数**: 14,395 行
**审计范围**: 基于 2026-06-23 优化版 + 历史报告 Bug 的回归验证 + 全面深度交互逻辑测试

---

## 📋 修复回归验证

| 上次 Bug | 状态 | 详细 |
|----------|:----:|------|
| refreshUI() AI 定时器生命周期缺失 | ✅ **已修复** | 增加了 stopAIRefresh/stopChannelAIRefresh/stopStockAIRefresh + restoreTopbar |
| _saveVersionSnapshot 缺少存量字段 + 回滚缺少客户等级/来源 | ✅ **已修复** | 快照和回滚均包含全部 9 个数据字段 |
| 加密备份导入仅合并 customers/tags | ✅ **已修复** | 使用 mergeById 合并全部数据类型（含 pool、4 个存量模块、等级、来源） |
| 客户池表单无 company 字段 | ✅ **已修复** | 已在 basic 字段组添加 company 输入 |
| page-detail 死代码 | ❌ **未修复** | HTML 中仍存在无用 section |

---

## 🔴 P0 — 立即修复（5 个）

### Bug 1: refreshUI() 仪表盘/BI 选项卡切换（伪修复）

**严重性**: 🔴 **高** — 同上期报告 Bug 1

**位置**: refreshUI() 行 13262-13268 / navigate() 行 11937

**问题**: 代码已增加对 `window._dashboardMode` 和 `window._biMode` 的判断，但 `_dashboardMode` 和 `_biMode` 是用 `let` 声明的局部变量，**不会挂载到 `window` 对象上**。因此 `window._dashboardMode` 始终为 `undefined`，使修改后的判断逻辑永久走 `else` 分支。

```javascript
// 行 11288（示例位置）：_dashboardMode 用 let 声明
let _dashboardMode = 'sales';
// ...但在 refreshUI() 行 13262 检查的是：
if (window._dashboardMode === 'stock') // 永远为 false！
```

**影响**: 用户在 Stock Dashboard 或 Stock BI 视图时触发 refreshUI（定时刷新/数据变更），画面强制切回 Sales 视图。

**修复方向**: 将 `_dashboardMode` 改为 `window._dashboardMode`，或统一使用 `window._dashboardMode` 赋值。

---

### Bug 2: renderStockDashboard() 调用 renderStockAISummary 缺参

**严重性**: 🔴 **高** — AI 摘要全空

**位置**: renderStockDashboard() 行 ~7383

**问题**: `renderStockDashboard()` 内部调用 `renderStockAISummary()` 时**没有传入 `module` 参数**：

```javascript
renderStockAISummary();  // 缺 module 参数
```

而 `renderStockAISummary(module)` 内部依赖 `module` 参数去 `_stockDataKeys[module]` 查找数据源。传 `undefined` 导致 `dataKey = ''`，`Store.data['']` 为 `undefined`，所有存量 AI 摘要显示 0/空白。

---

### Bug 3: navigate() Dashboard 分支总是启动 startAIRefresh()

**严重性**: 🔴 **中-高** — 定时器监听错误数据

**位置**: navigate() 行 11937

**问题**: 无论是 Sales 还是 Stock 模式，`navigate()` 到 dashboard 页面都调用 `startAIRefresh()`（监听 `Store.data.customers`）。存量模式下应调用 `startStockAIRefresh()`（监听 4 个存量数据集）。

---

### Bug 4: showStatPopup() 不处理存量统计类型

**严重性**: 🔴 **中-高** — 存量统计浮层空白

**位置**: showStatPopup() 行 ~7836

**问题**: 函数对 `type` 参数进行 switch-case 处理，只覆盖了销售/渠道相关的统计类型（`all`, `geo`, `360`, `bing`, `baidu`, `douyin`, `xianyu`, `trash`），**没有 `stock-*` 类型的 case**。点击存量 Dashboard 的所有统计卡片，浮层弹出后内容为空。

---

### Bug 5: 存量客户表单零字段验证

**严重性**: 🔴 **高** — 数据质量风险

**位置**: openStockCustomerForm() 行 ~6641 的保存逻辑

**问题**: 主客户表单和客户池表单都有验证：
```javascript
if (!d.name || !d.name.trim()) { showToast('姓名不能为空', 'error'); return; }
if (d.phone && !validatePhone(d.phone)) { ... }
if (d.email && !validateEmail(d.email)) { ... }
if (d.age && !validateAge(d.age)) { ... }
```

但存量表单的保存函数**完全没有这些验证**，直接执行：
```javascript
const updates = {};
document.querySelectorAll('#modal-box .input, #modal-box .textarea, #modal-box .select[data-key]').forEach(el => {
  updates[el.dataset.key] = el.value;
});
Object.assign(c, updates);
```

**修复方向**: 复制主表单的验证逻辑到存量表单保存函数中。

---

## 🟠 P1 — 建议本迭代修复（6 个）

### Issue 6: 客户池删除无密码验证 + 无操作日志

**严重性**: 🟠 **中**

**位置**: openPoolCustomerDetail() 行 6092-6100

```javascript
document.getElementById('poolDelDetail').onclick = () => {
  confirmDialog('删除客户', '确认删除客户 "' + c.name + '" ？操作不可恢复。', true, async () => {
    Store.data.poolCustomers = Store.data.poolCustomers.filter(x => x.id !== c.id);
    await Store.save();  // 用 save() 而非 saveWithLog()
    ...
  });
};
```

对比主客户删除（`openCustomerDetail`）的双层防护 + `saveWithLog`，池删除存在两个安全隐患。

---

### Issue 7: 客户池跟进记录无图片支持

**严重性**: 🟠 **低-中**

**位置**: openPoolCustomerDetail() 行 6049-6055

池详情时间线仅渲染 `r.text`，主客户详情还渲染了 `r.images`（缩略图 + 图片浏览器）。

---

### Issue 8: 存量表单 Object.assign 导致 channelData 数据冗余

**严重性**: 🟠 **中**

**位置**: openStockCustomerForm() 保存逻辑

`Object.assign(c, updates)` 将存量客户的所有字段写入顶层对象。由于存量客户结构既有顶层字段又有 `c.channelData` 子对象，这种保存方式可能导致同一字段在顶层和 channelData 中重复存在，未来重构时可能出现不一致。

---

### Issue 9: 存量表单无 HTML 转义

**严重性**: 🟠 **低-中**

**位置**: openStockCustomerForm() 保存逻辑

主客户表单和客户池表单都使用了 `escapeHTML(d[k])` 进行输出转义，存量表单直接存储原始值。

---

### Issue 10: 客户池操作使用 Store.save() 而非 saveWithLog()

**严重性**: 🟠 **低**

**位置**: 客户池增删改操作（openPoolCustomerForm、openPoolCustomerDetail 删除）

导致客户池变更不会生成操作日志。

---

### Issue 11: 设置页按钮命名不一致

**严重性**: 🟠 **很低**

**位置**: DOMContentLoaded 绑定 / HTML 设置页

按钮 ID 为 `btn-new-tag`/`btn-new-level`/`btn-new-source`，但命名习惯更接近 `btn-add-*`。影响维护阅读。

---

## 🟡 P2 — 建议后续迭代（4 个）

### Issue 12: 客户池/主列表缺少一键导出按钮

HTML 中没有 `pool-btn-export` 和 `btn-export-all` 按钮 DOM。可能需要设计新增：

- 客户池导出当前只能通过安全页的 "导出脱敏数据" 附带导出
- 主列表无 "一键导出全部"

### Issue 13: 客户池批量删除无密码保护

主列表批量删除（`btn-batch-delete`）有 `promptPassword()` 二次验证，客户池批量删除没有。

### Issue 14: btn-sq-setup / btn-sq-cancel 重复绑定

`btn-sq-setup` 和 `btn-sq-cancel` 在 `initSecurityPage()`（行 10308/10331）和 `initSecurityQuestionsUI()`（行 15366/15327）中各绑定一次。虽不影响功能（后绑定覆盖前绑定），但代码冗余。

### Issue 15: page-detail 死代码

HTML 行 2988 仍有 `<section class="page" id="page-detail">`，任何页面路由都不使用它。

---

## ✅ 已验证正确的功能

| 功能模块 | 验证项 | 结果 |
|----------|--------|:----:|
| 按钮绑定 | 50+ 静态按钮完整匹配 HTML | ✅ |
| 按钮绑定 | 动态按钮（data-act 事件委托）正确 | ✅ |
| 按钮绑定 | 零幽灵绑定、零悬空按钮 | ✅ |
| 页面路由 | navigate() 19 页面全覆盖 | ✅ |
| 页面路由 | refreshUI() 全覆盖（除 page-detail） | ✅ |
| 页面路由 | titleMap 对应所有 page section | ✅ |
| 主客户详情 | 20 字段全部正确渲染 | ✅ |
| 主客户表单 | 21 字段 + 标签/平台/渠道选择 + 验证 | ✅ |
| 主客户表单 | 图片上传（base64） | ✅ |
| 主客户表单 | HTML 转义 + 草稿保存 | ✅ |
| 主客户删除 | confirmDialog + promptPassword 双层防护 + saveWithLog | ✅ |
| 跟进记录 | addChannelRemark 图片上传 + 时间线缩略图 | ✅ |
| 存量模块 | 4 个模块全部 navigate/refreshUI/nav-item 路由正确 | ✅ |
| 存量模块 | 渲染函数/筛选/详情/表单/CRUD/列自定义全部正确 | ✅ |
| 版本快照 | 含所有 9 个数据类型 | ✅ |
| 版本回滚 | 回滚 9 个数据类型 + 当前数据快照 | ✅ |
| 加密导入 | 合并 customers/poolCustomers/4 个存量/levels/sources/tags | ✅ |
| 加密导出 | 完整 localStorage 加密 blob | ✅ |
| 清空数据 | 重置结构完整（含 4 个存量字段） | ✅ |
| 密码修改 | 重加密 + 更新 sessionStorage + SQ_PW_VAULT_KEY | ✅ |
| 安全模块 IIFE | 独立 try/catch，3 个 window 接口 | ✅ |
| 主题切换 | 持久化到 Store.settings | ✅ |
| 登录/锁屏 | 正确停止 auto-save + 清理 session | ✅ |
| 仪表盘 | renderDashboard/renderStockDashboard 数据源正确 | ✅ |
| BI 看板 | renderBIPage/renderStockBIPage 数据源正确 | ✅ |
| 导航计数 | updateNavCounts 与 Dashboard 数据一致 | ✅ |
| 导入导出映射 | 字段名匹配 + 别名支持 + 脱敏逻辑 | ✅ |
| 存量模块 | 客户池分配功能正确 | ✅ |

---

## 🚨 修复优先级总结

```
本期立即修复（P0 - 5个）：
  Bug 1:  refreshUI() window._dashboardMode 用 let 声明 → window 上永远 undefined（伪修复）
  Bug 2:  renderStockDashboard() → renderStockAISummary() 缺 module 参数
  Bug 3:  navigate() Dashboard 分支总启动 startAIRefresh() 而非 startStockAIRefresh()
  Bug 4:  showStatPopup() 不处理 stock-* 类型 → 存量统计浮层空白
  Bug 5:  存量客户表单零字段验证

建议本迭代修复（P1 - 6个）：
  Issue 6:  客户池删除无 promptPassword + 无 saveWithLog
  Issue 7:  客户池跟进记录无图片支持
  Issue 8:  存量表单 Object.assign 导致 channelData 数据冗余
  Issue 9:  存量表单无 HTML 转义
  Issue 10: 客户池操作使用 Store.save() 而非 saveWithLog()
  Issue 11: 设置页按钮命名不一致

后续迭代（P2 - 4个）：
  Issue 12-15: 导出按钮缺失、池批量删除无密码保护、重复绑定、死代码
```
