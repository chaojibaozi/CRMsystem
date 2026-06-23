# CRM 系统全面深度审计报告（2026-06-23）

**文件**: D:\GitHub-tongbuwenjianjia\CRMsystem\CRMsystem\index.html
**版本行数**: 14,560 行
**审查范围**: 按钮绑定 / 页面路由 / 模块关联 / 导入导出 / 版本控制 / 浮层数据列 / 安全模块

---

## 📋 审计方法论

5 个子代理并行审计 + 主代理综合验证，覆盖：
1. 按钮绑定完整性（DOMContentLoaded + 动态渲染）
2. 页面路由完整性（navigate + refreshUI 双路径）
3. 导入导出数据一致性
4. 存量客户管理 4 大模块结构
5. 8 个浮层/弹窗数据列关联
6. 安全模块（版本快照/回滚/加密导入导出/密码修改/锁屏登出）

---

## 🔴 P0 — 立即修复（4 个）

### Bug 1: refreshUI() 仪表盘和 BI 分支丢失选项卡切换

**严重性**: 🔴 **高** — 数据一致性问题

**位置**: `refreshUI()` 行 13175-13176

**问题**: `navigate()` 根据 `_dashboardMode` / `_biMode` 选调 `renderDashboard()` 或 `renderStockDashboard()`、`renderBIPage()` 或 `renderStockBIPage()`。但 `refreshUI()` 始终调用 `renderDashboard()` 和 `renderBIPage()`。

**后果**: 用户在 Stock Dashboard 视图下触发 refreshUI（自动保存/定时刷新/数据变更），页面被强制切回 Sales Dashboard。

**修复方向**:
```javascript
// refreshUI() 行 13175-13176 改为：
if (active.id === 'page-dashboard') {
  const mode = window._dashboardMode;
  if (mode === 'stock') renderStockDashboard();
  else renderDashboard();
}
else if (active.id === 'page-bi') {
  const mode = window._biMode;
  if (mode === 'stock') renderStockBIPage();
  else renderBIPage();
}
```

---

### Bug 2: 版本快照和回滚不保护存量数据 + 回滚遗漏客户等级/来源

**严重性**: 🔴 **高** — 数据丢失风险

**位置**: `_saveVersionSnapshot()` 行 3882-3896 / `btn-rollback` 行 12967-12982

**问题对比**:

| 数据字段 | `_saveVersionSnapshot()` | `btn-rollback` currentSnapshot | `btn-rollback` restore |
|----------|:------------------------:|:------------------------------:|:----------------------:|
| customers | ✅ | ✅ | ✅ |
| poolCustomers | ✅ | ✅ | ✅ |
| tags | ✅ | ✅ | ✅ |
| customerLevels | ✅ | ❌ 缺失 | ❌ 缺失 |
| customerSources | ✅ | ❌ 缺失 | ❌ 缺失 |
| stockCustomers | ❌ 缺失 | ❌ 缺失 | ❌ 缺失 |
| brandProducts | ❌ 缺失 | ❌ 缺失 | ❌ 缺失 |
| serviceFees | ❌ 缺失 | ❌ 缺失 | ❌ 缺失 |
| qiFuProducts | ❌ 缺失 | ❌ 缺失 | ❌ 缺失 |

**后果**: 
- 存量客户数据不受版本保护，回滚后永久丢失
- 回滚时 `customerLevels` 和 `customerSources` 被丢弃
- `_saveVersionSnapshot` 与 `btn-rollback` 的字段不一致（快照存了但回滚不恢复）

---

### Bug 3: 加密备份导入丢失大量数据

**严重性**: 🔴 **高** — 数据迁移丢失

**位置**: `btn-import-encrypted` 行 12937-12957

**问题**: 导出加密备份使用 `localStorage.getItem(STORAGE_KEY)`，包含 `Store.data` 的全部字段（customers, poolCustomers, stockCustomers, brandProducts, serviceFees, qiFuProducts, tags, logs, versions, securityQuestions 等）。但导入时**仅合并 `customers` 和 `tags`**，丢弃其余所有字段。

**后果**: FAQ 推荐加密备份作为跨设备迁移方式。用户按此操作后将永久丢失客户池数据、全部 4 个存量模块数据、操作审计日志、版本历史和安全问题配置。

---

### Bug 4: AI 摘要定时器生命周期管理缺失

**严重性**: 🔴 **中-高** — 性能与 UI 问题

**位置**: `refreshUI()` 行 13171（全线缺失）

**问题**: `navigate()` 行 11824-11845 中执行了：
- `stopAIRefresh()` / `stopStockAIRefresh()` / `stopChannelAIRefresh()`
- `startChannelAIRefresh()` / `startStockAIRefresh()`
- `restoreTopbar()`
- `.topbar.classList.add('channel-ai-mode')`

但 `refreshUI()` **全部缺失**这些 AI 生命周期操作。

**后果**:
- 通道/存量页面离开后 AI 摘要定时器仍持续运行（setInterval 内存泄漏 + 无效 API 调用）
- topbar 样式残留（channel-ai-mode 未清除）
- 非通道页面可能错误显示 AI 摘要

---

## 🟠 P1 — 建议本迭代修复（3 个）

### Issue 5: 客户池表单缺少 company 字段

**严重性**: 🟠 **中**

**位置**: `openPoolCustomerForm()` 行 ~5823

**问题**: 客户池详情弹窗（openPoolCustomerDetail）正确显示了"公司名称"字段，但 **openPoolCustomerForm 中没有 company 输入框**。用户在详情页看到公司名称却无法在编辑表单中修改。

**对比**:
- openCustomerForm（主客户表单）: 有 company ✅
- openStockCustomerForm（存量客户表单）: 有 company ✅
- openPoolCustomerForm（池客户表单）: 无 company ❌

---

### Issue 6: 页面详情冗余 + refreshUI 缺少 page-detail 处理

**严重性**: 🟠 **低-中**

**位置**: HTML 行 2988

**问题**: `<section class="page" id="page-detail">` 存在于 HTML 中，但：
- `navigate()` 没有 `pageName === 'detail'` 路由
- `refreshUI()` 没有 `page-detail` 分支
- `titleMap` 没有 `detail` 条目
- 所有客户详情都通过 `openModal()` 弹窗渲染

**建议**: 移除该死代码（约 5 行 HTML），或添加路由用于未来扩展。

---

### Issue 7: 存量模块缺少分页逻辑

**严重性**: 🟠 **中**（数据量大时）

**位置**: `renderStockCustomerPage()` 行 ~6550

**问题**: 主客户列表有完整分页逻辑（页面大小选择、翻页），但 `renderStockCustomerPage()` 一次渲染全部数据。存量模块数据量达到 1000+ 条时会产生性能问题。

---

## 🟡 P2 — 建议后续迭代（4 个）

### Issue 8: 销售数据下载页 Excel 导出缺少"渠道"列

**严重性**: 🟡 **低**

**问题**: `renderDataDownloadPage()` 的 DOWNLOAD_FIELDS 不包含"渠道"列，但安全页的 `buildExcelData()` 导出包含该列。两条导出路径行为不一致。

---

### Issue 9: 客户池删除无二次密码验证

**严重性**: 🟡 **低**

**位置**: `openPoolCustomerDetail` 中的删除按钮

**问题**: 主客户删除（openCustomerDetail 中的 `btn-delDetail`）使用了 `promptPassword()` 二次验证。客户池的删除（`btn-poolDelDetail`）**没有密码验证**，直接执行删除。

**建议**: 池删除增加 `promptPassword()` 保护。

---

### Issue 10: 客户池详情跟进记录无图片支持

**严重性**: 🟡 **低**

**位置**: `openPoolCustomerDetail` 中的跟进记录时间线

**问题**: 主客户和存量客户详情跟进记录渲染了缩略图，但池客户详情跟进记录时间线仅显示文本，不支持 `remarkHistory.images` 显示。

---

### Issue 11: 客户池导出列格式与主客户不同

**严重性**: 🟡 **很低**

**位置**: `btn-poolExportOne`

**问题**: 池详情导出按钮使用了与主客户相同的 26 列格式，包含池数据模型没有的字段（渠道、标签、平台等），导出后这些列为空。

---

## ✅ 已验证正确的大项

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 全部 60+ 按钮绑定 | ✅ | DOMContentLoaded + 动态渲染事件委托，无遗漏 |
| 19 个 titleMap 页面全部对应 HTML | ✅ | navigate() 全覆盖 |
| refreshUI() 覆盖全部路由页面 | ✅ | 除 page-detail 死代码外 |
| 主客户详情数据列 20 字段 | ✅ | 全部正确渲染 |
| 存量客户详情 24 字段 | ✅ | channelData 隔离良好 |
| 统计浮层数据源 | ✅ | 来自 BI 统计结果 |
| 客户浮层面板 | ✅ | 字段精简合理 |
| 主客户表单 24 字段 | ✅ | 完整 |
| 存量客户表单 24 字段 | ✅ | 完整 |
| 密码修改/重加密 | ✅ | 正确更新 sessionStorage + 保险箱 |
| 安全模块 IIFE | ✅ | 3 个暴露接口完整独立 |
| 主题切换持久化 | ✅ | Store.settings 明文存储 |
| 登出/锁屏清理 | ✅ | 正确停止 auto-save + 清除 session |
| 清空数据结构完整 | ✅ | 含全部存量字段 |
| 导入导出字段映射 | ✅ | 列头名称匹配 + 别名支持 |
| 脱敏逻辑 | ✅ | phone/wechat/email/address 正确脱敏 |

---

## 🚨 修复优先级建议

```
立即修复（P0）：
  1. [Bug 1] refreshUI() 仪表盘/BI 选项卡切换丢失 ── 影响数据一致性
  2. [Bug 2] 版本快照/回滚缺少存量字段 + 客户等级/来源 ── 数据丢失风险
  3. [Bug 3] 加密导入丢弃所有非主客户的字段 ── 数据迁移丢失
  4. [Bug 4] AI 摘要定时器生命周期缺失 ── 内存泄漏 + 性能

本迭代修复（P1）：
  5. [Issue 5] 客户池表单无 company 字段 ── 功能缺失
  6. [Issue 6] page-detail 死代码 ── 代码整洁
  7. [Issue 7] 存量模块无分页 ── 性能改善

后续迭代（P2）：
  8-11. 导出列不一致、池删除验证、池跟进图片、池导出列格式
  12. 📝 poolExportOne 列格式（标注 1.12）
```
