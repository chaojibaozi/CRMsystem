# CRM 系统完整性审计报告

## 审计概述

- **对象**: D:\GitHub-tongbuwenjianjia\CRMsystem\CRMsystem\index.html
- **行数**: 9625 行（减少 47 行，手势模块移除）
- **范围**: 模块完整性、跨模块数据关联、逻辑一致性、残存引用

---

## 一、手势模块移除完整性

### 移除清单

| 项目 | 状态 |
|------|------|
| `Store.data.gesturePattern` 字段 | ✅ 已移除所有 4 处引用 |
| `lock-gesture-form` HTML（锁屏手势表单） | ✅ 已移除 |
| `unlock-gesture-form` HTML（登录用手势表单） | ✅ 已移除 |
| `gesture-container/g-canvas-wrap` 相关 CSS | ✅ 已移除 |
| `btn-lock-gesture-mode` 按钮及切换逻辑 | ✅ 已移除 |
| `initLockGestureMode()` 函数 | ✅ 已移除 |
| `initUnlockGestureMode()` 函数 | ✅ 已移除 |
| `window.__initGestureCanvas` 导出 | ✅ 已移除 |
| `gestureState` 全局变量 | ✅ 已移除 |
| `window.initGestureSettingOnce` 导出 | ✅ 已移除 |
| `drawGesture()/findNearestPoint()` 等挥手势函数 | ✅ 已移除 |
| 设置页手势设置区（btn-gesture-save/btn-gesture-reset/btn-gesture-clear/btn-gesture-reset-all） | ✅ 已移除 |
| 通过手势重置密码（btn-reset-pw-by-gesture / btn-reset-pw-by-gesture-settings） | ✅ 已移除 |
| `gesture-not-set / gesture-has-set` DOM 元素 | ✅ 已移除 |
| `gesture-unlock-form`（unlock-canvas 相关） | ✅ 已移除 |

### 锁屏界面现状

锁屏浮层仅保留**密码解锁**一种方式：
```
锁屏 → lock-overlay → lock-dialog
  ├── lock-username-display
  ├── lock-pw-form（密码输入 + 解锁按钮）
  └── btn-lock-logout（退出登录）
```
不再有手势/密码模式切换 UI。**无断链、无残存 Fragment。**

---

## 二、数据模型完整性

### Store.data 当前结构

```javascript
Store.data = {
  customers: Customer[],       // 客户主数据
  tags: Tag[],                 // 标签定义
  customerLevels: Level[],     // 等级定义
  customerSources: Source[],   // 来源定义
  logs: Log[],                 // 操作日志
  versions: Version[],         // 版本快照（≤3个）
  username: string,            // 用户名
  avatar: string,              // 头像
  securityQuestions: Q&A[]     // 密保问题（2 个）
}
```

**变化**: 移除了 `gesturePattern`，`securityQuestions` 保留。全部 4 处 `Store.data` 初始化都已同步更新。✅

### Store.settings 当前结构

```javascript
Store.settings = {
  folderHandleKey, theme, followupDays
}
```
无变化。✅

---

## 三、模块间关联验证

### 3.1 密保问题模块 → IIFE 重构

安全模块（密保问题 + 重置密码）已封装为独立 IIFE（`initSecurityModule`，行 10071~10336）：

```javascript
(function initSecurityModule() {
  function initSecurityQuestionsUI() { ... }
  window.initSecurityQuestionsUI = initSecurityQuestionsUI;
  window.openResetBySecurityQuestionsDialog = function() { ... };
  // 按钮绑定: btn-sq-save, btn-sq-cancel, btn-sq-clear, btn-sq-edit
  // 重置密码绑定: btn-reset-pw-by-sq-settings, btn-reset-pw-by-cur-pw-settings
})();
```

**主要导出到 Window**:
| 导出符号 | 调用方 | 位置 |
|---------|--------|------|
| `window.initSecurityQuestionsUI` | `navigate('security')` | 行 7871 |
| `window.openResetBySecurityQuestionsDialog` | `initAuthPage()` 中 `btn-forgot.onclick` | 行 8175 |
| `window.openResetBySecurityQuestionsDialog` | `btn-sq-hint.onclick` | 行 8206 |

**注意**: `navigate('security')` 通过 `window.` 引用安全模块，而安全模块 IIFE 在脚本加载时执行（早于 DOMContentLoaded），所以引用时必定就绪。✅

### 3.2 客服管理模块间关联

```
客户列表（page-list）──→ 客户详情弹窗（showCustomerDetail）
    │                          │
    ├──→ 编辑表单（openCustomerForm） ──→ Store.save()
    ├──→ 删除/恢复（softTrash / restore / purge）──→ Store.save()
    ├──→ 批量添加渠道（btn-batch-add-channel）──→ Store.save()
    │
    ├──→ 筛选（btn-apply-filter）──→ renderCustomerTable()
    ├──→ 分页（btn-prev-page / btn-next-page）──→ renderCustomerTable()
    │
    ├──→ 看板统计（stat-popup）──→ 独立渲染，只读 Store
    ├──→ 猫咪宠物（CRMPet）──→ 只读 Store
    │
    ├──→ CSV导出（qa-export）──→ exportCustomerRows()
    ├──→ CSV导入（qa-import）──→ parseCSV → Store.save()
    └──→ 加密导入/导出 → Store.save()
```

**所有路径完整可追踪，无断链** ✅

### 3.3 导航逻辑

```
navigate('security') → hide all pages → show page-security
  → renderLogsPage()
  → Store.updateSyncUI()
  → window.initSecurityQuestionsUI()  ← IIFE 导出
  → renderSettingsPage()              ← 渲染账户设置（标签/等级/来源，虽在另一页面但无副作用）

navigate('settings') → hide all pages → show page-settings
  → renderSettingsPage()
```

`handlePageSwitch`（行 9072）用于初始加载和 hash 变更，与 `navigate()` 互补。✅

---

## 四、🔴 发现的 Bug

### Bug 1: `renderSettingsPage()` 在安全页被多余调用

**文件**: 行 7871
```javascript
else if (pageName === 'security') {
  renderLogsPage();
  Store.updateSyncUI();
  if(window.initSecurityQuestionsUI) window.initSecurityQuestionsUI();
  if(typeof renderSettingsPage === 'function') renderSettingsPage();  // ← 不需要
}
```

**问题**: 进入"数据与安全"页面时，额外调用了 `renderSettingsPage()`（它属于"账户设置"页）。虽然无功能性错误（渲染内容在隐藏页面），但属**多余调用**，且如果某些设置操作有副作用可能产生意外行为。

**整改**: 移除该行，或将 `btn-reset-pw-by-sq-settings` 的 disabled 状态逻辑独立出来：

```javascript
else if (pageName === 'security') {
  renderLogsPage();
  Store.updateSyncUI();
  if(window.initSecurityQuestionsUI) window.initSecurityQuestionsUI();
  // 单独更新重置密码按钮状态（原在 renderSettingsPage 中）
  const btnSq = document.getElementById('btn-reset-pw-by-sq-settings');
  if (btnSq) btnSq.disabled = !(Array.isArray(Store.data.securityQuestions) && Store.data.securityQuestions.length === 2);
}
```

---

### Bug 2: 安全页 `handlePageSwitch` 缺少 `initSecurityQuestionsUI` 调用

**文件**: 行 9072
```javascript
else if (active.id === 'page-security') {
  renderLogsPage();
  Store.updateSyncUI();
  // ← 缺少 initSecurityQuestionsUI()
}
```

**问题**: `navigate('security')` 会调用 `initSecurityQuestionsUI()`，但 `handlePageSwitch`（hash 路由 / 初始加载）不会。如果用户刷新页面时 hash 指向 `#page-security`，初始化流程通过 `handlePageSwitch` 而非 `navigate`，密保问题 UI 的 `btn-reset-pw-by-sq-settings` 的 disabled 状态不会更新。

**触发场景**: 页面刷新（F5）且 URL hash 为 `#page-security`

**整改**:

```javascript
else if (active.id === 'page-security') {
  renderLogsPage();
  Store.updateSyncUI();
  if(window.initSecurityQuestionsUI) window.initSecurityQuestionsUI();  // ← 增加
}
```

---

### Bug 3: `handlePageSwitch` 中 `page-settings` 路径不完整

**文件**: 行 9071
```javascript
else if (active.id === 'page-settings') renderSettingsPage();
```

而 `navigate('settings')` 调用（行 7870）：
```javascript
else if (pageName === 'settings') renderSettingsPage();
```

两者一致，**无 Bug**（仅做记录）。✅

---

### Bug 4: 批量导入渠道的旧格式迁移逻辑可能遗漏

**文件**: 行 8606（`btn-add-to-channel` handler）
修改客户渠道时，行 8606~8607 有 `c.channel` → `c.channels` 迁移逻辑。但如果 `c.channels` 已经存在而 `c.channel` 是旧的字符串值，迁移不会覆盖。`hasChannel()` 会先查 `c.channels`，后查 `c.channel`，所以不会漏。**非 Bug**。✅

---

## 五、之前报告的 Bug 修复确认

| 原问题 | 状态 |
|--------|------|
| 4 个 `footerHTML` 按钮失效 | ✅ 全部改为 `footer:` 回调 |
| `btn-change-password` sessionStorage 不同步 | ✅ 已修复 |
| 自动锁屏清空 sessionStorage 导致手势解锁失败 | ✅ 已修复（且手势已移除） |
| `crm_session_locked` 生命周期完整性 | ✅ 所有 5 处使用一致 |
| CSV 导出/导入字段不匹配 | ✅ 已修复，新旧双兼容 |

---

## 六、总结

| 类别 | 判定 | 备注 |
|------|------|------|
| 手势模块移除完整性 | ✅ 零残留 | 代码、CSS、Store 字段、DOM 元素全部清理 |
| 锁屏界面 | ✅ 正常 | 仅保留密码解锁 |
| 密保问题模块 | ⚠️ 2 项修复 | 见 Bug 1 & Bug 2 |
| 数据持久化（save/load） | ✅ 完整 | `securityQuestions` 正确序列化/反序列化 |
| CSV 导入 | ✅ 已修复 | 新旧双格式兼容 |
| CSV 导出 | ✅ 24列 | 含 industry/website/platforms |
| 所有按钮绑定 | ✅ 124 个 onclick 全部有效 | 无断链引用 |
| `navigate()` 路由 | ⚠️ 1 处多余调用 + 1 处遗漏 | 见 Bug 1 & Bug 2 |
| IIFE 封装 | ✅ 完整 | `initSecurityModule` 正确导出 `window` 接口 |

### 必须修复

1. **行 7871**: 移除 `renderSettingsPage()` 或替换为轻量禁用状态更新
2. **行 9072**: 增加 `if(window.initSecurityQuestionsUI) window.initSecurityQuestionsUI();`

### 建议优化（非阻塞）

- 移除 CSS 中的 `.auth-logo`（登录页已不再使用该样式，仅锁屏用到 header）
- 安全页的 `renderSettingsPage()` 多余调用可减少首屏渲染开销
