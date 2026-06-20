# CRM 系统模块关联性深度审计报告

**文件**: D:\GitHub-tongbuwenjianjia\CRMsystem\CRMsystem\index.html
**当前行数**: 11,152 行（较上次 9,625 行增加了 1,527 行）
**审计范围**: 模块间数据关联 / 跨模块调用链 / 之前报告的 Bug 修复确认 / 新增问题
**审计日期**: 2026-06-20 18:39

---

## 一、之前报告 Bug 修复确认

| 原问题 | 来源报告 | 当前状态 | 说明 |
|--------|---------|---------|------|
| ① 4 个 `footerHTML` 按钮失效 | BUTTON_AUDIT | ✅ **已修复** | 全部改为 `footer:` 回调, 含密保 IIFE 中的新密码弹窗 |
| ② CSV 导出 24 列 vs 导入 20 列 | DATAFLOW_AUDIT | ✅ **已修复** | 导入改用 `IMPORT_FIELD_MAP` 基于列名匹配，不再依赖列位置 |
| ③ 密码明文存 sessionStorage | SECURITY_AUDIT | ✅ **已修复** | XOR 混淆 `_obfuscatePw()` |
| ④ 校验哈希固定 salt | SECURITY_AUDIT | ✅ **已修复** | 随机 16B salt，localStorage 持久化 (`crm_hash_salt`) |
| ⑤ Store.save 竞态条件 | OPTIMIZATION_AUDIT N1 | ✅ **部分修复** | 加了 `_saving` 锁 + `_pendingSave` 队列 |
| ⑥ `navigate('settings')` 未调 `initSecurityQuestionsUI` | OPTIMIZATION_AUDIT N2 | ✅ **已修复** | `renderSettingsPage()` 内部第 1 行即调用 |
| ⑦ `renderLogsPage()` 在 pool 页被多余调用 | OPTIMIZATION_AUDIT N3 | ✅ **已修复** | 已不在 pool 路由中调用 |
| ⑧ `btn-change-password` sessionStorage 不同步 | SYSTEM_AUDIT | ✅ **已修复** | 改密码后同步更新 sessionStorage |
| ⑨ 手势模块移除完整性 | SYSTEM_AUDIT | ✅ **零残留** | 全部清理 |

---

## 二、🔴 仍未修复的 Bug（从之前报告延续）

### Bug A: `navigate('security')` 仍多余调用 `renderSettingsPage()`

**位置**: 行 9049
```javascript
else if (pageName === 'security') {
  renderLogsPage();
  Store.updateSyncUI();
  if(window.initSecurityQuestionsUI) window.initSecurityQuestionsUI();
  if(typeof renderSettingsPage === 'function') renderSettingsPage();  // ← 多余
}
```

**影响**: 进入"数据与安全"页时无意义地渲染"账户设置"页内容。当前无功能性 Bug，但产生不必要的 DOM 操作开销。

---

### Bug B: `refreshUI()` 中 `page-security` 缺少 `initSecurityQuestionsUI()` 调用

**位置**: 行 10231
```javascript
else if (active.id === 'page-security') {
  renderLogsPage();
  Store.updateSyncUI();
  // ← 缺少 initSecurityQuestionsUI()
}
```

**触发场景**: 用户 F5 刷新页面且 URL hash 为 `#page-security` 时，密保 UI 状态不会更新。

**修复**:
```javascript
else if (active.id === 'page-security') {
  renderLogsPage();
  Store.updateSyncUI();
  if (typeof window.initSecurityQuestionsUI === 'function') {
    window.initSecurityQuestionsUI();
  }
}
```

---

## 三、🟠 新增跨模块关联性问题

### 3.1 客户池（Pool）数据不参与版本回滚

`_saveVersionSnapshot()` 仅保存 `customers` / `tags` / `customerLevels` / `customerSources`，**不包含 `poolCustomers`**。回滚后客户池数据无法恢复。

### 3.2 数据下载页不支持客户池导出

`btnDownload.onclick` 仅处理 `Store.data.customers`，完全不读取 `Store.data.poolCustomers`。客户池数据无法通过"数据下载与导入"页批量导出。

### 3.3 修改密码功能模块位置不当

"修改解锁密码"按钮在 **账户设置页（page-settings）**，但备份/导出功能在 **数据与安全页（page-security）**。修改密码后无引导重新加密文件夹同步文件。

### 3.4 客户池与客户列表导入模板完全相同

两个模板 header 完全一致（11 列），文件名和内容无区分度，可能造成用户混淆。

---

## 四、关键跨模块数据流验证结果

| 数据流 | 状态 | 详情 |
|--------|------|------|
| 客户主数据全链路 (表单→Store→列表→详情→导出) | ✅ | 全部完整 |
| 渠道数据兼容 (19 处 `hasChannel()`) | ✅ | 新旧格式全覆盖 |
| 客户池 ↔ 客户列表双向迁移 | ✅ | 手机号去重 + 姓名校验 |
| CSV 导入/导出匹配 | ✅ | 列名匹配模式，不再依赖位置 |
| 密保问题全链路 (设置→存储→验证→重置) | ✅ | 功能完整，但路由层面有遗漏 |
| 之前报告修复 (9/9 项) | ✅ 7项已修 / ⚠️ 2项未修 | Bug A & B |

---

## 五、建议立即修复

1. **🔴 Bug B (行 10231)**: `refreshUI()` 中 `page-security` 增加 `initSecurityQuestionsUI()` 调用
2. **🟠 Bug A (行 9049)**: 移除 `navigate('security')` 中多余 `renderSettingsPage()` 调用
3. **🟠 版本快照**: 将 `poolCustomers` 加入 `_saveVersionSnapshot()` 序列化

## 六、建议下一迭代优化

4. 🟡 修改密码后检测 `folderHandle` 存在，提示用新密码重新同步
5. 🟡 数据下载页增加客户池批量导出
6. 🟡 导入模板文件名/内容加区分标识
7. 🟡 `save()` 的 `_pendingSave` 改为真正 Promise 链队列
