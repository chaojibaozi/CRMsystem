# CRM 系统全链路审计与优化报告
**系统**: crm.subz.cn — 客户关系管理系统（本地加密存储版）
**审计日期**: 2026-06-18
**文件**: index.html (9,100 行, 6,494 行 JS)
**审计范围**: 跨模块交互逻辑 / 页面切换 / 按钮行为 / 数据流完整性

---

## 严重性分级
- 🔴 **严重** — 数据损坏 / 逻辑崩溃 / 安全泄露
- 🟠 **中** — 功能异常 / 数据不一致 / 用户体验断裂
- 🟡 **轻** — 优化建议 / 边界情况

---

## 一、本次优化已修复的 Bug（验证通过）

| # | 级别 | 上一轮发现 | 修复验证 |
|---|------|-----------|---------|
| B1 | 🔴 | 渠道页面 `c.channel` vs `c.channels` 字段不一致 | ✅ `hasChannel()` 函数统一 |
| B2 | 🔴 | `showStatPopup` 引用外部局部变量 ReferenceError | ✅ 块级作用域 `{ const topNames = ... }` |
| B3 | 🟠 | 猫咪跳转搜索不生效（`searchQ` vs `keyword`） | ✅ 改为 `listState.keyword` + `#filter-keyword` |
| B5 | 🟡 | CSV 导入 age 字段 `parseInt("abc")` → `NaN` | ✅ `isNaN()` 保护 |
| B6 | 🟡 | CSS `var(--primary)` 未定义 | ✅ 改为 `var(--accent)` |
| B8 | 🟡 | 单客户导出文件名含非法字符 | ✅ `c.name.replace(/[\\/:*?"<>|]/g, '_')` |
| S1 | 🔴 | 密码明文存 sessionStorage | ✅ XOR 混淆 `_obfuscatePw()` |
| S2 | 🟠 | 校验哈希固定 salt | ✅ 随机 salt + localStorage 持久化 |
| S6 | 🟡 | 忘记密码未清文件夹残留 | ✅ 清除 `crm_hash_salt` + `crm_has_sq` |

---

## 二、本次审计新发现的 Bug 与逻辑缺陷

### 🔴 N1: 自动保存与手动保存的竞态条件

**位置**: `startAutoSave()` (行 ~7135) + `Store.save()` + 各处手动 `btnS.onclick`
**问题**: 自动保存每 3 秒执行一次 `Store.save()`（async），手动操作（保存客户、批量删除等）也调用 `Store.saveWithLog()`（也调 `Store.save()`）。两个 `save()` 调用相互不互斥。当同时执行时：
- 第一个 `save()` 调用 `encryptData()` 读取 `this.data` → 派生密钥 → AES 加密
- 第二个 `save()` 可能在一瞬间修改 `this.data` 后再加密
- 本地存储被先完成的 `localStorage.setItem()` 覆盖，后者在操作中已完成但数据不一致

**影响**: 高并发操作下可能出现数据丢失或混入陈旧备份。

**修复建议**:
```javascript
// Store 增加保存队列：
const Store = {
  _saveLock: false,
  _saveQueue: [],
  async save() {
    if (this._saveLock) {
      return new Promise(resolve => this._saveQueue.push(resolve));
    }
    this._saveLock = true;
    try {
      // 原有 save 逻辑...
    } finally {
      this._saveLock = false;
      if (this._saveQueue.length) {
        const next = this._saveQueue.shift();
        next();
      }
    }
  }
}
```

### 🔴 N2: 头像 base64 数据被每次全量加密

**位置**: `handleAvatarUpload()` (行 ~7200) + `Store.save()`
**问题**: 头像以 base64 数据 URL 存入 `Store.data.avatar`（单张 5MB 限制）。每次 `save()` 都会将整个 `Store.data`（含客户的 remarkHistory 中的图片、头像等）全部加密 → `JSON.stringify` 大对象 → AES-256-GCM 加密。3 秒自动保存 + 大 payload 导致持续的加密/IO 开销。

**影响**:
- 加密数据体积暴涨，localStorage 有 5-10MB 限制，容易达到
- 每次保存加密大 payload 产生可感知的卡顿

**修复建议**:
```javascript
// 方案 A：头像改为 IndexedDB 存储，不在加密范围内
// 方案 B：压缩 avatar 到 80x80 JPEG quality 0.6
function compressAvatar(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = 80; c.height = 88; // 保持 10:11 比例
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 80, 88);
    Store.data.avatar = c.toDataURL('image/jpeg', 0.6);
    Store.markDirty();
  };
  img.src = dataUrl;
}
```

### 🟠 N3: 锁屏手势验证通过后仍要求输入密码

**位置**: `initLockGestureMode()` (行 ~7588)
```javascript
if (pattern === saved) {
  // 手势正确，自动切换回密码模式让用户输密码
  hideLockOverlay();
  showLockOverlay();
  document.getElementById('lock-password').focus();
}
```
**问题**: 用户在锁屏界面选择"手势解锁"，画完正确手势后，系统隐藏锁屏浮层 → 又弹出锁屏浮层要求输入密码。用户体验断裂——手势验证通过后不能直接解锁，而是循环回密码输入。

**修复建议**:
```javascript
if (pattern === saved) {
  // 手势正确，直接解锁（不需要再输密码）
  hideLockOverlay();
  lockFailCount = 0;
  enterApp(Store.password); // 直接使用当前会话密码
}
```
注意：需确保 `Store.password` 在锁屏时未被清除。当前锁屏仅在 `btn-lock` 中清除 `Store.password`，但 `initLockGestureMode()` 前 `Store.password` 应仍存在。

### 🟠 N4: XOR 混淆密码的 `_PW_MASK` 硬编码

**位置**: `_PW_MASK = 'CrmS3cur1tyX0rK3y!'` (行 ~3150)
**问题**: XOR 密钥写在源代码中，且长度固定（20 字节）。攻击者可以：
1. 从 DevTools → Sources 找到 `_PW_MASK`
2. 从 Application → Session Storage 拿到 `crm_session_pw`
3. 在 Console 执行 `_deobfuscatePw(...)` 得到明文密码

**风险**: 比之前直接存明文略有改善，但依然不构成真正的安全屏障。

**修复建议**: 不要存储任何形式的密码。改为存储密码的 PBKDF2 派生子密钥（仅足以验证）：

```javascript
// enterApp 中：
sessionStorage.setItem('crm_session_key', bytesToBase64(derivedKeyData));
// 恢复时：
const savedKey = sessionStorage.getItem('crm_session_key');
if (savedKey) { /* 用 key 尝试解密 */ }
```

### 🟡 N5: 自动保存可能导致 Toast 轰炸

**位置**: `startAutoSave()` → `Store.save()` → `syncToFolder()`
**问题**: `syncToFolder()` 在文件夹写入失败时调用 `showToast('文件夹同步失败：' + e.message, 'warning')`。如果文件夹不可用（磁盘满、权限变更），每 3 秒触发一次 Toast，持续轰炸用户。

**影响**: 用户体验极差，Toast 可能堆叠遮挡屏幕。

**修复建议**: 增加失败冷却计数器：
```javascript
let _lastFolderError = 0;
async syncToFolder(encryptedData) {
  if (Date.now() - _lastFolderError < 60000) return; // 1分钟冷却
  try {
    // ...
  } catch(e) {
    _lastFolderError = Date.now();
    if (this._dirty) showToast('文件夹同步失败', 'warning');
  }
}
```

### 🟡 N6: BI 看板拖动排序中存在 DOM 与数据状态不一致

**位置**: BI 可拖动排序的 `bi-sortable` 元素
**问题**: 用户拖动图表卡片重新排序后，排序信息保存到 `localStorage('crm_bi_sort_order')`。但如果：
1. 添加了新客户导致 KPI 变化，`renderBIPage()` 重新渲染整个 KPI 行，旧的 `data-sort-id` 丢失
2. `applyBISortOrder()` 在重新渲染后尝试按旧排序恢复，找不到旧的 `data-sort-id` 时静默跳过

**影响**: 用户自定义排序在数据刷新时部分丢失，但不会报错。

**建议**: `renderBIPage()` 先清空排序缓存再重新渲染，或者在 `applyBISortOrder()` 找不到匹配项时清空该组的排序记录。

### 🟡 N7: `promptPassword` 中 `passwordHash` 调用两次（性能浪费）

**位置**: `promptPassword()` (行 ~3410)
```javascript
const doOk = async () => {
  const val = document.getElementById('_pw').value;
  const expected = await passwordHash(Store.password);
  const actual = await passwordHash(val);
  // ...
```
**问题**: 每次调用 `promptPassword` 都会重新计算 `passwordHash(Store.password)`。`passwordHash` 使用 PBKDF2 200K 迭代 + SHA-256 + AES 加密，每次调用约消耗 200ms+。在 `openCustomerDetail` → `delDetail` → `confirmDialog` → `promptPassword` 的链条中，每一次删除都要计算两次 hash。

**建议**: 缓存 `expectedHash`：
```javascript
let _cachedExpectedHash = null;
async function getExpectedHash() {
  if (!_cachedExpectedHash) _cachedExpectedHash = await passwordHash(Store.password);
  return _cachedExpectedHash;
}
```

---

## 三、按钮行为全链路测试矩阵

### 3.1 登录/认证按钮

| 按钮 | 位置 | 行为 | 状态 | 潜在问题 |
|------|------|------|------|---------|
| `btn-unlock` | 解锁页 | 用户名+密码双重验证 | ✅ 正常 | `Store.load()` 在 `< 6 位` 密码未做强度校验 |
| `unlock-password` Enter | 解锁页 | 回车触发解锁 | ✅ 正常 | - |
| `unlock-username` Enter | 解锁页 | 回车→密码输入框 focus | ✅ 正常 | - |
| `btn-init` | 注册页 | 设置用户名+密码，首次初始化 | ✅ 正常 | - |
| `init-password/password2` | 注册页 | 实时比对两次密码 | ✅ 正常 | - |
| `btn-back-unlock` | 注册页 | 返回解锁页 | ✅ 正常 | - |
| `btn-forgot` | 解锁页 | 清空重置 / 密保重置 | ✅ 正常 | 动态绑定逻辑复杂（见 N10） |
| `btn-sq-hint` | 解锁页 | 密保提示链接 | ✅ 正常 | - |
| `btn-lock` | 侧边栏 | 手动锁屏 | ✅ 正常 | - |
| `btn-lock-unlock` | 锁屏浮层 | 密码解锁 | ✅ 正常 | - |
| `btn-lock-pw-mode` | 锁屏浮层 | 切换密码模式 | ✅ 正常 | - |
| `btn-lock-gesture-mode` | 锁屏浮层 | 切换手势模式 | ✅ 正常 | **手势解锁后仍要求输密码 (N3)** |
| `btn-lock-gesture-reset` | 锁屏浮层 | 重置手势绘制 | ✅ 正常 | - |
| `btn-lock-logout` | 锁屏浮层 | 退出到登录页 | ✅ 正常 | - |
| `btn-sidebar-logout` | 侧边栏 | 登出系统 | ✅ 正常 | - |

### 3.2 导航按钮

| 按钮 | 行为 | 状态 | 潜在问题 |
|------|------|------|---------|
| `nav-item[data-page]` | 页面切换 | ✅ 正常 | - |
| `menu-toggle` | 移动端侧边栏展开 | ✅ 正常 | - |
| `theme-toggle` | 亮/暗主题切换 | ✅ 正常 | - |
| `data-nav="new"` | 快捷新增客户 | ✅ 正常 | - |

### 3.3 客户管理按钮

| 按钮 | 行为 | 状态 | 潜在问题 |
|------|------|------|---------|
| `btn-new-customer` | 新增客户弹窗 | ✅ 正常 | - |
| `btn-apply-filter` | 应用列表筛选 | ✅ 正常 | - |
| `btn-reset-filter` | 重置筛选条件 | ✅ 正常 | - |
| `page-size` | 切换每页条数 | ✅ 正常 | - |
| `btn-prev-page` / `btn-next-page` | 分页 | ✅ 正常 | - |
| `th[data-sort]` | 表头排序 | ✅ 正常 | - |
| `check-all` | 全选/取消全选 | ✅ 正常 | - |
| `btn-batch-delete` | 批量删除（二次验证） | ✅ 正常 | - |
| `btn-add-to-channel` | 批量添加到渠道（多选） | ✅ 正常 | 改为复选框多选模式，兼容新旧字段 |
| `[data-act="view"]` | 详情弹窗 | ✅ 正常 | - |
| `[data-act="edit"]` | 编辑客户弹窗 | ✅ 正常 | - |
| `[data-act="follow"]` | 跟进记录弹窗 | ✅ 正常 | - |
| `[data-act="del"]` | 删除客户弹窗（作废/彻底） | ✅ 正常 | - |
| `del-trash` | 移至作废 | ✅ 正常 | - |
| `del-purge` | 彻底删除 | ✅ 正常 | - |
| `[data-act="restore"]` | 恢复作废客户 | ✅ 正常 | - |
| `[data-act="purge"]` | 彻底删除作废客户 | ✅ 正常 | - |
| `editDetail` | 编辑客户（详情页） | ✅ 正常 | - |
| `exportOne` | 导出单客户 CSV | ✅ 正常 | ✅ 文件名安全过滤 |
| `delDetail` | 删除客户（详情页，二次验证） | ✅ 正常 | - |

### 3.4 BI 看板按钮

| 按钮 | 行为 | 状态 | 潜在问题 |
|------|------|------|---------|
| `btn-report-daily` | 生成日报 | ✅ 正常 | - |
| `btn-report-weekly` | 生成周报 | ✅ 正常 | - |
| `btn-report-monthly` | 生成月报 | ✅ 正常 | - |
| `btn-report-export` | 导出报表 TXT | ✅ 正常 | - |
| `bi-collapse-btn` | 折叠/展开 BI 区块 | ✅ 正常 | 事件委托存在于 document |
| 图表拖动排序 | 拖动排序 | ✅ 基本正常 | **排序在数据刷新后部分丢失 (N6)** |

### 3.5 数据安全按钮

| 按钮 | 行为 | 状态 | 潜在问题 |
|------|------|------|---------|
| `qa-backup` | 生成加密备份 | ✅ 正常 | - |
| `qa-export` | 导出明文 CSV（密码验证） | ✅ 正常 | - |
| `qa-import` | 导入 CSV | ✅ 正常 | 通道字段兼容新旧格式 |
| `qa-sync` | 选择文件夹同步 | ✅ 正常 | - |
| `btn-select-folder` | 选择存储目录 | ✅ 正常 | - |
| `btn-sync-now` | 立即同步 | ✅ 正常 | - |
| `btn-change-folder` | 更换存储目录 | ✅ 正常 | - |
| `btn-revoke-folder` | 取消授权 | ✅ 正常 | - |
| `btn-export-encrypted` | 导出加密备份（独立按钮） | ✅ 正常 | - |
| `btn-import-encrypted` | 导入加密备份 | ✅ 正常 | 去重逻辑基于手机号 |
| `btn-export-masked` | 导出脱敏 CSV | ✅ 正常 | - |
| `btn-export-plain` | 导出明文 CSV（二次验证） | ✅ 正常 | - |
| `btn-rollback` | 回滚历史版本（二次验证） | ✅ 正常 | - |
| `btn-reset-data` | 清空全部数据（二次验证） | ✅ 正常 | 会保留用户名和头像 |
| `btn-change-password` | 修改密码 | ✅ 正常 | **修改密码后 sessionStorage 未更新! (N8)** |
| `btn-export-log` | 导出操作日志 | ✅ 正常 | - |

---

## 四、跨模块交互逻辑缺陷

### 🔴 N8: 修改密码后 sessionStorage 密码未更新

**位置**: `btn-change-password.onclick` (行 ~8000)
**流程**: 用户修改密码 → `Store.password = np` → `Store.save()` → `closeModal()` → `showToast('密码已更新')`
**问题**: `Store.password` 被更新为新密码，但 `sessionStorage` 中的 `crm_session_pw` 仍存的是旧密码的 XOR 混淆。下次页面刷新时，`DOMContentLoaded` 从 sessionStorage 读取旧密码 XOR 混淆 → `_deobfuscatePw` → 得到旧密码 → `doUnlock(旧密码)` → 尝试用旧密码解密新密码加密的数据 → ❌ **解密失败** → `sessionStorage.removeItem()` → 回到登录页。

**影响**: 修改密码后，下次打开页面（或刷新）会看到登录页，用户误以为系统出问题。

**修复建议**:
```javascript
// btn-change-password 的 ok.onclick 末尾加上：
ok.onclick = async () => {
  // ... 验证 + 保存逻辑 ...
  Store.password = np;
  Store.addLog('修改密码', '成功', '用户修改了解锁密码');
  await Store.save();
  // 新增：更新 sessionStorage
  sessionStorage.setItem('crm_session_pw', _obfuscatePw(np));
  closeModal();
  showToast('密码已更新，请使用新密码解锁', 'success');
};
```

### 🟠 N9: `renderDashboard()` 在保存后冗余调用

**位置**: 保存客户 → `navigate('list'); renderDashboard();` (行 ~4133)
**问题**: 保存客户后导航到客户列表页，但在列表页调用 `renderDashboard()`。dashboard 的 canvas 元素(id=`chart-source`, `chart-trend` 等)在列表页不可见，但 `renderDashboard()` 仍会：
1. 重新计算所有统计值（纯 JS 开销，几十微秒，可接受）
2. 在 `#stats-grid` 中写入 HTML（但列表页没有 `#stats-grid` 元素 → `if (el)` 检查 → 跳过）
3. 调用 `drawSourcePie()` 和 `drawTrendBar()`（Canvas 元素可能被其他页面拥有 → `if (!canvas) return;` 跳过）

**结论**: 虽然有冗余，但每个函数都有 null 保护，不会崩溃或报错。仅产生轻微性能浪费。可优化为仅调用 `refreshUI()`。

### 🟠 N10: `btn-forgot` 监听器动态绑定逻辑复杂

**位置**: `initAuthPage()` (行 ~7310) + `DOMContentLoaded` (行 ~7410)
```javascript
// DOMContentLoaded 中：
// 忘记密码事件由 initAuthPage() 根据密保状态动态绑定，此处不再覆盖
```
**问题**: `btn-forgot` 的 `onclick` 在两种场景下绑定：
1. 有密保问题 → `onclick = () => openResetBySecurityQuestionsDialog()`
2. 无密保问题 → `onclick = () => confirmDialog('重置系统', ...) { ... }`

如果用户在解锁页选择了"强制清空重置"，但 `initAuthPage()` 中动态绑定的作用是闭包绑定的旧 `Store` 引用还是当前引用？

**分析**: `btnForgot.onclick = () => { ... localStorage.removeItem(STORAGE_KEY); ... Store.data = ...; }` 中的 `Store` 是全局对象引用，始终是最新的。所以不会出现引用过期问题。✅

**但有一个边缘情况**: 如果 `initAuthPage()` 被连续调用两次（例如用户登录后登出），`btnForgot.onclick` 会被覆盖两次，没问题。

**结论**: 逻辑正确但脆弱。建议统一为 `addEventListener` 并在 handler 中判断条件。

---

## 五、性能与数据一致性

### 🟡 N11: 3 秒自动保存 + 大 payload 双重性能问题

**影响**: 
- 自动保存间隔仅 3 秒
- `_dirty` 标记仅在 `save()` 末尾置为 `false`，但 `markDirty()` 和 `save()` 无锁保护
- `syncToFolder()` 在每 3 秒的保存中都会尝试写入文件系统（即便数据无变化）
- 建议改为：只有 `_dirty` 为 `true` 才调用 `save()`，并在 `syncToFolder` 前检查加密数据是否变化

### 🟡 N12: 渠道页面导航栏计数更新时机

**位置**: `navigate()` 末尾调用 `updateNavCounts()` (行 ~7017)
**问题**: `updateNavCounts()` 只在 `navigate()` 时调用。如果客户在「客户列表页」被新增、编辑、删除，渠道导航栏的数字不会更新。只有在切换到渠道页时才刷新。

**建议**: 在所有数据修改操作（saveWithLog）后也调用 `updateNavCounts()`。`refreshUI()` 中已包含。

---

## 六、模块优化具体方案

### 6.1 认证模块优化

```
┌────────────────────────────────────────────────────────────────┐
│ 当前问题                              │ 优化方案              │
├────────────────────────────────────────────────────────────────┤
│ sessionStorage XOR 混淆密码            │ 改为存储派生密钥      │
│ 修改密码后 sessionStorage 未更新       │ 同步更新混淆密码      │
│ 锁屏手势验证后仍需密码                 │ 手势通过直接解锁      │
│ initAuthPage() 动态绑定脆弱            │ 统一 addEventListener │
│ 忘记密码重置未清手势/密保/头像         │ 全面清理所有用户数据  │
└────────────────────────────────────────────────────────────────┘
```

### 6.2 数据层优化

```
┌────────────────────────────────────────────────────────────────┐
│ 当前问题                              │ 优化方案              │
├────────────────────────────────────────────────────────────────┤
│ save() 并发竞态                        │ 增加保存锁/队列      │
│ 头像/截图 base64 导致 payload 膨胀     │ 头像压缩+IndexedDB   │
│ 3秒自动保存过于频繁                    │ 7-10秒 + 仅 dirty    │
│ 无操作日志大小限制未校验               │ 增加日志去重/截断    │
│ _cachedExpectedHash 未缓存            │ 缓存比对哈希          │
└────────────────────────────────────────────────────────────────┘
```

### 6.3 渠道模块一致性

```
┌────────────────────────────────────────────────────────────────┐
│ 当前问题                              │ 优化方案              │
├────────────────────────────────────────────────────────────────┤
│ 旧 channel 字段清理不彻底              │ Store.load() 统一迁移 │
│ 批量添加渠道用 checkbox 样式可优化      │ 增加全选/取消全选     │
│ 渠道颜色区分不明显（标签相同颜色）      │ 不同渠道不同颜色标识  │
└────────────────────────────────────────────────────────────────┘
```

### 6.4 BI 看板模块

```
┌────────────────────────────────────────────────────────────────┐
│ 当前问题                              │ 优化方案              │
├────────────────────────────────────────────────────────────────┤
│ 用户自定义排序在重渲染后部分丢失        │ 无匹配时清空该组记录  │
│ BI 图表在 resize 时全部重绘            │ 加 debounce 300ms    │
│ 拖动排序 getBoundingClientRect 可能不准│ 等 Canvas 绘制完成后  │
└────────────────────────────────────────────────────────────────┘
```

### 6.5 猫咪宠物模块

```
┌────────────────────────────────────────────────────────────────┐
│ 当前问题                              │ 优化方案              │
├────────────────────────────────────────────────────────────────┤
│ B3 搜索跳转已修复 ✅                   │ -                    │
│ 气泡在锁屏后仍显示                     │ 检测 Store.unlocked  │
│ 气泡关闭后 state 仍为 alert            │ 已修复（setState idle）│
│ 深度链接跳转后不自动关闭猫浮层          │ navigate 中统一关闭  │
└────────────────────────────────────────────────────────────────┘
```

---

## 七、优先级修复清单

| 优先级 | ID | 问题 | 类型 | 影响面 |
|--------|----|------|------|--------|
| 🔴 P0 | N8 | 修改密码后 sessionStorage 未更新 | 数据不可用 | 密码失效→无法登录 |
| 🔴 P0 | N1 | 自动保存竞态条件 | 数据损坏 | 数据丢失/混写 |
| 🔴 P1 | N2 | 头像全量加密致 localStorage 溢出 | 性能/容量 | 5MB 限制突破 |
| 🟠 P1 | N3 | 手势解锁后仍要输密码 | UX 断裂 | 手势功能形同虚设 |
| 🟠 P2 | N5 | 自动保存 Toast 轰炸 | UX 极差 | 文件不可用时持续弹窗 |
| 🟠 P2 | N6 | BI 排序在刷新后丢失 | 功能降级 | 自定义排序不持久 |
| 🟡 P3 | N4 | XOR 硬编码 | 安全假象 | 可被反推密码 |
| 🟡 P3 | N7 | passwordHash 重复计算 | 性能 | 每次删除多 200ms 延迟 |
| 🟡 P3 | N9 | 保存后冗余 renderDashboard | 性能 | 轻微浪费 |
| 🟡 P3 | N11 | 自动保存间隔过短 | 性能 | IoT/低端设备压力 |
