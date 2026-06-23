# CRM 系统安全与数据流审计报告

**文件**: `D:\GitHub-tongbuwenjianjia\CRMsystem\CRMsystem\index.html`（~682 KB，单页应用）  
**审计日期**: 2026-06-23 20:33 GMT+8  
**审计范围**: 数据流完整性、版本快照/回滚、加密导入导出、密码修改、安全模块初始化、主题持久化、登出/锁屏

---

## 1. 版本快照与回滚（_saveVersionSnapshot + btn-rollback）

### 1.1 _saveVersionSnapshot() — 行 ~3914

**保存的字段**（共 6 个）：
- `customers`, `poolCustomers`, `tags`, `customerLevels`, `customerSources`, `createdAt`

**缺失的字段（问题！）**（共 4 个）：
- ❌ `stockCustomers` — 存量客户
- ❌ `brandProducts` — 品牌产品
- ❌ `serviceFees` — 服务费
- ❌ `qiFuProducts` — 企服产品

**去重逻辑缺陷**：版本比较仅基于 `customers` 字段（`JSON.stringify ==` 对比），这意味着：
- 如果只改了 poolCustomers/tags/customerLevels/customerSources，不会创建新版本
- 快照副本的超额写入：每次 `saveWithLog` 都生成完整 JSON 快照（`JSON.parse(JSON.stringify(...))`），性能开销大

### 1.2 btn-rollback — 行 ~12967

```js
const currentSnapshot = JSON.parse(JSON.stringify({
  customers: Store.data.customers,
  poolCustomers: Store.data.poolCustomers,
  tags: Store.data.tags,
  createdAt: Date.now()
}));
Store.data.customers = JSON.parse(JSON.stringify(latest.customers || []));
Store.data.poolCustomers = JSON.parse(JSON.stringify(latest.poolCustomers || []));
if (latest.tags) Store.data.tags = JSON.parse(JSON.stringify(latest.tags || []));
```

**问题**：
1. **currentSnapshot 也缺少 customerLevels、customerSources、以及 4 个存量字段** — 回滚时这些字段的当前状态不会被保存为新版本
2. **回滚后不恢复 customerLevels 和 customerSources** — 即使快照中有，回滚逻辑直接忽略
3. **不回滚 stockCustomers/brandProducts/serviceFees/qiFuProducts** — 这 4 个字段不在任何版本中，回滚前后都保持当前值（未受损但无法回退）

**字段一致性结论**：快照保存与回滚恢复字段**不一致**，四个存量字段整体缺失。回滚甚至还丢失了 customerLevels 和 customerSources。

---

## 2. 清空数据（btn-reset-data）— 行 ~13016

```js
Store.data = {
  customers: [], tags: [], customerLevels: getDefaultLevels(),
  customerSources: getDefaultSources(), logs: [], versions: [],
  username: Store.data.username || '', avatar: Store.data.avatar || '',
  securityQuestions: [],
  poolCustomers: [], stockCustomers: [], brandProducts: [],
  serviceFees: [], qiFuProducts: []
};
```

**结果**：✅ **字段结构完整**
- 包含全部 4 个存量字段（stockCustomers, brandProducts, serviceFees, qiFuProducts）初始化为空数组
- 保留 username 和 avatar
- 清除 securityQuestions（合理的，清空后应视为全新初始状态）
- 清除 logs/versions
- customerLevels 和 customerSources 重置为默认值

**潜在问题**：重置后 `ensureSeedData()` 会插入 3 条演示数据。如果这是用户不期望的行为，缺少纯空白状态的入口。

---

## 3. 加密导入导出

### 3.1 btn-export-encrypted — 行 ~12926

```js
const enc = localStorage.getItem(STORAGE_KEY);  // crm_encrypted_v1
const blob = new Blob([JSON.stringify({
  app: 'CRM_LOCAL_V1', createdAt: Date.now(), encrypted: enc
})], { type: 'application/octet-stream' });
```

✅ **数据完整性**：从 `localStorage.getItem(STORAGE_KEY)` 导出完整的加密 blob。`store.save()` 已经将所有数据字段（含全部 4 个存量字段）序列化为 JSON 并使用 AES-256-GCM 加密。  
✅ 导出文件包含了 `Store.data` 的所有字段。
✅ 包装格式包含元数据标记（app, createdAt）便于后续识别。

### 3.2 btn-import-encrypted — 行 ~12937

```js
const plain = await decryptData(encJson, pw);
const obj = JSON.parse(plain);
// ❗ 只合并 customers 和 tags
const imported = (obj.customers || []).filter(c =>
  !Store.data.customers.some(ex => ex.phone === c.phone)
);
Store.data.customers = [...imported, ...Store.data.customers];
if (obj.tags && obj.tags.length) {
  const existingIds = new Set((Store.data.tags || []).map(x => x.id));
  for (const t of obj.tags) { if (!existingIds.has(t.id)) Store.data.tags.push(t); }
}
```

**严重问题**：导入时，解密后的 `obj` 包含所有数据字段，但代码**只合并了前两个**：

| 字段 | 导入行为 | 状态 |
|---|---|---|
| customers | 按 phone 去重后合并 | ✅ |
| tags | 按 id 去重后合并 | ✅ |
| **poolCustomers** | **完全忽略** | ❌ |
| **stockCustomers** | **完全忽略** | ❌ |
| **brandProducts** | **完全忽略** | ❌ |
| **serviceFees** | **完全忽略** | ❌ |
| **qiFuProducts** | **完全忽略** | ❌ |
| customerLevels | **完全忽略** | ❌ |
| customerSources | **完全忽略** | ❌ |
| logs | **完全忽略** | ❌ |
| versions | **完全忽略** | ❌ |
| securityQuestions | **完全忽略** | ❌ |

**验证逻辑**：`decryptData` 使用 AES-GCM，认证加密确保密码错误时会直接抛异常（`crypto.subtle.decrypt` 失败），`catch` 块显示"密码错误或文件已损坏" — ✅ 正确。

**修复建议**：导入时应全量合并所有数据类型，或明确标注为"仅导入客户标签"。

---

## 4. 密码修改（btn-change-password）— 行 ~13036

```js
Store.password = np;
Store._expectedHash = null;                              // 失效旧哈希缓存 ✅
sessionStorage.setItem('crm_session_pw', _obfuscatePw(np));  // 更新 session ✅
// 更新密码保险箱
if (Array.isArray(sqMemory) && sqMemory.length === 2) {
  encryptData(np, sqAnswers).then(vault => {
    localStorage.setItem(SQ_PW_VAULT_KEY, vault);            // 更新保险箱 ✅
  }).catch(() => {});
}
await Store.save();                                          // 重新加密全部数据 ✅
```

| 检查项 | 结果 |
|---|---|
| 重新加密所有数据（含存量字段） | ✅ `Store.save()` 加密 `this.data`（含全部字段） |
| 更新 sessionStorage | ✅ `sessionStorage.setItem('crm_session_pw', ...)` |
| 更新密码保险箱 | ✅ `SQ_PW_VAULT_KEY` 用密保答案重新派生密钥加密新密码 |
| 调用 syncToFile | ❌ `syncToFile` 函数**不存在于代码库中**（不是之前存在后被移除，是完全不存在）。无调用是正常的 |

**注意**：`passwordHash(password)` 在修改密码后不会立即重算，但 `Store._expectedHash = null` 确保下次需要时重新计算——这是正确的懒加载模式。哈希的 salt 保持不变，但密码变了，新的 hash 会不同。

---

## 5. 安全模块初始化（initSecurityQuestionsUI 等 IIFE）— 行 ~15168

**IIFE 结构**：
```js
(function initSecurityModule() {
  'use strict';
  try {
    function initSecurityQuestionsUI() { ... }
    function openSetNewPasswordDialog(verifiedAnswers) { ... }
    // DOM 绑定和事件处理...
    window.initSecurityQuestionsUI = initSecurityQuestionsUI;
    window.openSetNewPasswordDialog = openSetNewPasswordDialog;
    window.openResetBySecurityQuestionsDialog = openResetBySecurityQuestionsDialog;
  } catch (e) { console.error('[initSecurityModule] 初始化异常:', e); }
})();
```

| 检查项 | 结果 |
|---|---|
| 独立 IIFE（不污染全局） | ✅ |
| try/catch 包裹 | ✅ |
| 暴露 initSecurityQuestionsUI | ✅ — 供 settings 页面渲染后调用 |
| 暴露 openResetBySecurityQuestionsDialog | ✅ — 供登录页忘记密码使用 |
| 暴露 openSetNewPasswordDialog | ✅ — 供密保验证成功后调用 |
| 密保保存 → 更新 SQ_PW_VAULT_KEY | ✅ |
| 密保清除 → 移除 SQ_PW_VAULT_KEY | ✅ |
| 密保答案存储 | ✅ 双模式兼容：明文字段 a（旧）和 SHA256 a_hash（新），读取时兼容检测 |

**安全增强**：密保问题在保存时异步计算 `sha256(答案)` 存为 `a_hash`，减少明文暴露窗口。但仍保留了旧格式兼容。

---

## 6. 主题切换（theme-toggle）— 行 ~11900 + ~12553

```js
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) safeText(btn, theme === 'dark' ? '☀️ 浅色' : '🌙 深色');
  if (Store.settings) Store.settings.theme = theme;
  Store.saveSettings();
}
```

| 检查项 | 结果 |
|---|---|
| 持久化到 localStorage | ✅ `Store.saveSettings()` → `localStorage.setItem(SETTINGS_KEY, ...)` |
| 重启后恢复 | ✅ `Store.loadSettings()` 在初始化时调用 |
| 更新 UI 元素 | ✅ 通过 `data-theme` 属性（CSS 变量驱动）+ 按钮文本更新 |
| 入口绑定 | ✅ 行 12553 绑定 `theme-toggle` onclick |
| 启动时恢复 | ✅ `enterApp()` 中调用 `applyTheme(Store.settings.theme || 'light')` |

**问题**：主题存储在 `settings.theme` 中，但 `Store.settings` 只通过 `saveSettings/loadSettings` 持久化，未经过加密。这意味着主题偏好是**明文存储**的——这是可接受的（主题非敏感数据），但与加密数据的处理不一致。

---

## 7. 登出/锁屏

### 7.1 btn-lock（手动锁屏）— 行 ~12558

```js
clearIdleTimer();
Store.unlocked = false;
sessionStorage.setItem('crm_session_locked', '1');
showLockOverlay();
```

| 检查项 | 结果 |
|---|---|
| 清除空闲定时器 | ✅ `clearIdleTimer()` |
| 标记锁定状态 | ✅ `Store.unlocked = false` |
| 设置 session flag | ✅ `crm_session_locked = '1'` |
| 停止自动保存 | ❌ **未调用 `stopAutoSave()`**（但 `autoSave` 循环检查 `if (!Store.unlocked) return;`，所以实际不会触发保存——只是不够干净） |
| 清除密码内存 | ❌ `Store.password` 保持原值（锁屏解锁复用密码验证，这实际上是必要的） |

### 7.2 btn-lock-logout（锁屏浮层退出登录）— 行 ~12624

```js
hideLockOverlay();
stopAutoSave();
Store.unlocked = false; Store.password = null;
sessionStorage.removeItem('crm_session_pw');
sessionStorage.removeItem('crm_session_locked');
initAuthPage();
```

✅ 完全清理：停止自动保存、清空密码、清除 session、返回首页。

### 7.3 btn-sidebar-logout（侧边栏登出）— 行 ~12634

```js
clearIdleTimer();
stopAutoSave();
Store.unlocked = false; Store.password = null;
sessionStorage.removeItem('crm_session_pw');
sessionStorage.removeItem('crm_session_locked');
showToast('已登出系统', 'info');
initAuthPage();
```

✅ 与 btn-lock-logout 一致，多一步显示 Toast 提示。

### 7.4 自动锁屏（空闲检测）— 行 ~12059~12082

```js
const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1小时
// ...
idleTimer = setTimeout(async () => {
  if (Store._dirty) { try { await Store.save(); } catch (e) {} }  // 登出前保存 ✅
  stopAutoSave();
  Store.unlocked = false;
  sessionStorage.setItem('crm_session_locked', '1');
  window.showLockOverlay();
}, IDLE_TIMEOUT_MS);
```

✅ 自动锁屏前保存脏数据 ✅ 1 小时无操作超时。

---

## 总结：全局数据流一致性问题矩阵

| 功能 | customers | poolCustomers | tags | levels | sources | stockCustomers | brandProducts | serviceFees | qiFuProducts |
|---|---|---|---|---|---|---|---|---|---|
| Store.load() 默认值 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Store.save() 全量加密 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| _saveVersionSnapshot | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| btn-rollback 恢复 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| btn-reset-data | ✅ | ✅ | ✅ | ✅(默认) | ✅(默认) | ✅(空) | ✅(空) | ✅(空) | ✅(空) |
| btn-export-encrypted | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| btn-import-encrypted | ✅(合并) | ❌ | ✅(合并) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**关键风险**：
1. **版本快照和回滚完全忽略 4 个存量字段** — 如果用户操作了存量模块，无法通过版本回滚恢复
2. **加密导入仅合并 customers 和 tags** — 存量数据在备份导入时被静默丢弃，用户以为是在"恢复备份"，实际上仅恢复了客户和标签
3. **回滚不恢复 customerLevels/customerSources** — 即使快照中有保存

**推荐修复优先级**：
1. **P0**: `_saveVersionSnapshot` 添加 4 个存量字段；`btn-rollback` 匹配保存和恢复全部字段
2. **P0**: `btn-import-encrypted` 全量合并所有数据类型，或明确提示仅导入部分字段
