# CRM 系统深度审计报告
**系统**: crm.subz.cn — 客户关系管理系统（本地加密存储版）
**审计日期**: 2026-06-18
**文件**: index.html (7,195 行，单页 SPA)
**审计类型**: 安全审计 + 逻辑错误 + Bug 发现

---

## 严重性分级
- 🔴 **严重** — 数据损坏 / 逻辑崩溃 / 安全泄露
- 🟠 **中** — 功能异常 / 数据不一致
- 🟡 **轻** — 视觉 / 可用性 / 边界情况

---

## 一、安全漏洞

### 🔴 S1: 密码明文存储于 sessionStorage

**位置**: `DOMContentLoaded` → `enterApp()` 行 ~5940
**代码**:
```javascript
// enterApp 中
sessionStorage.setItem('crm_session_pw', password);

// DOMContentLoaded 中
const savedPassword = sessionStorage.getItem('crm_session_pw');
if (savedPassword) { doUnlock(savedPassword)... }
```
**问题**: 解锁密码以明文写入 `sessionStorage`，页面刷新时自动读取并直接传入 `doUnlock()`，无需用户再次输入。任何人通过 DevTools → Application → Session Storage 即可获取完整密码。
**建议**: 存密码校验哈希（而非密码原文）到 sessionStorage，校验时重计算哈希比对。

### 🔴 S2: 密码校验哈希使用固定 Salt

**位置**: `passwordHash()` 行 ~2135
```javascript
const salt = strToBytes('crm_password_check_salt_v1_fixed');
```
**问题**: 用于密码校验的 PBKDF2 派生使用硬编码固定 salt，使得同一密码在不同系统的校验值完全相同。攻击者可建立彩虹表实施离线破解。
**影响**: 虽然加密密钥的盐是随机的（`crypto.getRandomValues`），但校验哈希暴露了密码的预计算攻击面。
**建议**: 校验哈希也使用随机 salt 并存储 salt。

### 🔴 S3: Web Crypto API 依赖未定义 fallback

**位置**: 行 ~5930
```javascript
if (!window.crypto || !crypto.subtle) {
  document.body.innerHTML = '...';
  return;
}
```
**问题**: 在不支持 Web Crypto API 的浏览器（旧 Safari / Firefox ESR 早期版）直接呈现白屏。无渐进降级策略。
**影响**: 无加密场景下，应用完全不可用。
**建议**: 提供不加密的 localStorage-only 降级模式（含警示）。

### 🟠 S4: 明文 CSV 导出仅有单层密码验证

**位置**: `btn-export-plain` 行 ~6360
**问题**: 导出明文 CSV 时调用 `promptPassword` 验证密码，但验证逻辑存在隐患：
```javascript
const actual = await passwordHash(val);
if (actual !== expected) { ... } // expected = passwordHash(Store.password)
```
如果 `Store.password` 在内存中被篡改（非正常流程），比对逻辑失效。
**风险**: 敏感客户数据（姓名、手机号、身份证、微信、地址）以 CSV 明文导出后可被任意传播。

### 🟠 S5: CSP 完全缺失

**位置**: 整个应用
**问题**: 应用没有 Content-Security-Policy 头部。作为 GitHub Pages 托管的 SPA，若任何第三方库被注入，攻击者可以执行任意脚本、建立外连。
**建议**: 通过 `<meta http-equiv="Content-Security-Policy">` 添加至少 `script-src 'self' 'unsafe-inline'; img-src 'self' data:;` 等安全策略。

### 🟡 S6: 忘记密码重置后文件夹残留数据

**位置**: `btn-forgot` 行 ~5990
```javascript
localStorage.removeItem(STORAGE_KEY);
localStorage.removeItem(SETTINGS_KEY);
localStorage.removeItem(DRAFT_KEY);
```
**问题**: 清空了 localStorage，但未检查或清除文件夹授权下的 `customer_data_encrypted.dat` 文件。重新设置密码后，`mergeFromFolder()` 可能尝试加载旧数据导致冲突。
**建议**: 重置时一并提示用户取消文件夹授权或清空同步文件。

---

## 二、逻辑 Bug（本次审计新发现）

### 🔴 B1: 渠道页面永不显示通过表单保存的客户

**位置**: `renderChannelPage()` 行 ~3170
```javascript
// renderChannelPage 筛选逻辑
const customers = Store.data.customers.filter(c => c.deleted !== true && c.channel === channel);
```
**问题**: 客户表单的渠道字段名为 `channels`（数组类型），保存时写入 `c.channels`（数组）。但渠道页面检查的是 `c.channel`（单字符串）。新增/编辑客户时表单保存了 `c.channels = ['geo']`，但 `c.channel = undefined`，导致：
- 通过表单分配的客户 **永远不会出现在渠道页面**
- 旧版本单渠道客户（`c.channel = 'geo'`）正常显示
- 数据存在严重的 **新旧字段不一致**

**修复**:
```javascript
// renderChannelPage 中改为：
const customers = Store.data.customers.filter(c => {
  if (c.deleted === true) return false;
  const channels = c.channels || (c.channel ? [c.channel] : []);
  return channels.includes(channel);
});
```

### 🔴 B2: `showStatPopup` 引用未定义的局部变量

**位置**: `showStatPopup()` 行 ~3530
```javascript
case 'vip':
  customers = list.filter(c => topLevelNames.includes(c.level));
  title = topLevelLabel + ' 级客户 (' + customers.length + ')';
  break;
```
**问题**: `topLevelNames` 和 `topLevelLabel` 是 `renderDashboard()` 的局部变量，`showStatPopup()` 作用域内不存在。执行到 `vip` 分支时抛出 **ReferenceError**。整个 `showStatPopup` 在 try/catch 外，将直接导致统计浮层崩溃白屏。
**注意**: 不同写法下 `topLevelNames` 也有可能被意外挂到全局（如果未使用 `"use strict"`），但当前代码严格模式下必崩溃。
**修复**: 在 `showStatPopup` 顶部重新获取或作为参数传入。

### 🟠 B3: 猫咪跳转列表后搜索不生效

**位置**: 猫咪模块 `PET.showBubble()` 行 ~6990
```javascript
if (window.listState) {
  window.listState.searchQ = name;
  window.listState.page = 1;
}
const searchInput = document.getElementById('search-input');
if (searchInput) searchInput.value = name;
if (typeof navigate === 'function') navigate('list');
```
**问题**: 
1. 设置了 `listState.searchQ` 但 `applyListFilters()` 读取的是 `listState.keyword`，`searchQ` 毫无影响
2. 填充了 `#search-input` DOM 元素的值，但 `navigate('list')` 不会触发表单提交 / 筛选应用
3. 实际搜索结果为空 → 用户点客户行后看到"暂无符合条件的客户"

**修复**: 
```javascript
// 改为
listState.keyword = name;
listState.page = 1;
const searchInput = document.getElementById('filter-keyword');
if (searchInput) searchInput.value = name;
navigate('list');
// 或调用 applyListFilters + renderCustomerTable
```

### 🟠 B4: `form-section-header` 事件绑定可能重复或丢失

**位置**: `openCustomerForm()` 行 ~2755
```javascript
document.querySelectorAll('.form-section-header').forEach(h => {
  h.onclick = () => h.parentElement.classList.toggle('open');
});
```
**问题**: 使用 `.onclick` 赋值（而非 `addEventListener`），多次调用 `openCustomerForm` 时前一次绑定被覆盖。且在关闭模态框时未清理这些监听器。模态框 DOM 被移除后，旧节点上的监听器垃圾回收 OK，但如果模态框是复用同一个 DOM（`#modal-box`），旧的事件监听不会清除，可能导致多次打开表单时行为异常。
**影响**: 低概率，但在连续快速操作表单时可能导致折叠/展开逻辑紊乱。

### 🟡 B5: CSV 导入 `age` 字段可能存为 `NaN`

**位置**: CSV 解析行 ~6155
```javascript
age: row[2] ? parseInt(row[2]) : null,
```
**问题**: 如果 CSV 中年龄字段为 `"abc"`，`parseInt("abc")` 返回 `NaN`，直接存入数据库。影响年龄分布图表和年龄统计。
**建议**: `parseInt(row[2]) || null` 或 `const a = parseInt(row[2]); isNaN(a) ? null : a`

### 🟡 B6: CSS 变量引用错误 `var(--primary)` 未定义

**位置**: CSS + JS（统计浮层 hover 等）
```css
border-color: var(--primary);
```
**问题**: `:root` 中定义的是 `--accent` 而非 `--primary`。`--primary` 在所有环境下均为 `undefined`，hover 时边框颜色不会变化。
**影响**: 视觉交互效果丢失。

### 🟡 B7: `getDefaultTags` 中的默认标签与客户迁移逻辑标签 ID 不一致

**位置**: `getDefaultTags()` 行 ~2695 vs `Store.load()` 行 ~2265
```javascript
// getDefaultTags:
{ id: 't_a', name: 'A级客户', color: '#dc2626' },
{ id: 't_b', name: 'B级客户', color: '#d97706' },

// Store.load 迁移逻辑:
if (tagId === 't_vip') return 't_a';
if (tagId === 't_hot') return 't_b';
```
**问题**: 迁移逻辑中 `t_vip` → `t_a`、`t_hot` → `t_b`，但默认标签中 `t_a` 显示为 "A级客户"、`t_b` 显示为 "B级客户"。旧数据中标记为 `VIP` / `热` 标签的客户，迁移后显示为 "A级客户" / "B级客户"，但级别系统是 A/B/C/D 等级，与标签名称重复混淆。不是功能 Bug 但容易让用户困惑。

### 🟡 B8: 单客户导出文件名可能含非法字符

**位置**: `openCustomerDetail()` 行 ~3445
```javascript
downloadCSV(`${c.name}_客户资料.csv`, row);
```
**问题**: `c.name` 可能包含 `\/:*?"<>|` 等 Windows 文件名非法字符，导致 `download` 失败或自动截断。
**建议**: 对 `c.name` 做文件名安全过滤：`c.name.replace(/[\/:*?"<>|]/g, '_')`

---

## 三、已确认修复的 Bug（来自今日工作日志）

以下为 2026-06-18 工作日志记录并在当前代码中已修复的 Bug，留存参考：

| # | 严重性 | 描述 | 修复状态 |
|---|--------|------|---------|
| 1 | 🔴 | `renderBIAnalysisGrid` IIFE 引用未传入的 `todayStart` | ✅ 已修复 |
| 2 | 🔴 | 标签排行函数命名约定不匹配 `drawBITagRank` 无 `Chart` 后缀 | ✅ 已修复 |
| 3 | 🟠 | 业绩缺口预警使用 `total * 15%` 期望值不合理 | ✅ 已修复 |
| 4 | 🟠 | 跟进时效包含已成交/流失客户 | ✅ 已修复 |
| 5 | 🟠 | 性别环形图 rightX 坐标偏移画布 | ✅ 已修复 |
| 6 | 🟠 | 预算分布图 rightX 与 left halfW 分割不统一 | ✅ 已修复 |
| 7 | 🟡 | CSV 报表无 BOM 导致中文乱码 | ✅ 已修复 |
| 8 | 🟡 | churnList DOM 判空缺失 | ✅ 已修复 |
| 9 | 🟡 | 深色模式环形图内圈读白 | ✅ 已修复 |
| 10 | 🟠 | `drawSourcePie` / `drawTrendBar` 未过滤软删除 | ✅ 已修复 |
| 11 | 🔴 | `selectedIds.clear()` 调用 Array 不存在的方法 | ✅ 已修复 |
| 12 | 🟠 | CSV 导入缺少 `remarkHistory` 初始化 | ✅ 已修复 |
| 13 | 🟠 | `renderAlertSection` ES6 解构语法错误（`_isOverdue` 等缺少属性值） | ✅ 已修复 |
| 14 | 🟠 | `upcomingList` 同样解构错误 | ✅ 已修复 |
| 15 | 🟠 | `Store.settings.followupDays` 无短路保护 | ✅ 已修复 |

---

## 四、数据一致性风险

### 🟡 D1: 等级重命名已存储客户未全量刷新

**位置**: `openLevelEditor()` 行 ~5575
```javascript
(Store.data.customers || []).forEach(c => {
  if (c.level === oldNameVal) c.level = l.name;
});
```
**分析**: 重命名等级时遍历全部客户同步更新 `c.level`，逻辑正确。但在 `showStatPopup` 及 BI 图表场景中，客户的 level 是字符串，如果等级被删除（used check）但客户仍持有该字符串，则这些客户会落入 `getLevelByName` 的 `undefined` 且 `levelColor` 返回 `#9ca3af`。当前已有 `used` 检查阻止删除使用中的等级，风险可控。

### 🟡 D2: 历史版本快照不包括 `customerLevels` 和 `customerSources`

**位置**: `Store.save()` 行 ~2280
```javascript
const snapshot = JSON.parse(JSON.stringify({
  customers: this.data.customers,
  tags: this.data.tags,
  customerLevels: this.data.customerLevels,
  customerSources: this.data.customerSources,
  createdAt: Date.now()
}));
```
**分析**: 版本快照包含了等级和来源，回滚时 `latest.tags` 也被恢复。但在 `ensureSeedData()` 中未检查 `customerLevels` 回滚后的完整性。如果回滚到一个版本 `customerLevels` 为空，再次调用 `getLevels()` 可能返回空数组。

---

## 五、架构与设计建议

### 1. 内存数据保护

当前所有客户明文数据在解锁后驻留内存（`Store.data.customers`），在使用者离开设备后（自动锁屏前）存在侧信道泄露风险（内存转储、浏览器扩展访问）。

**建议**: 不使用数据时主动清除敏感字段引用，或实现"敏感数据视图"仅按需解密当前渲染的客户。

### 2. 数据层统一抽象

当前存在两套数据模型字段：
- 旧：`c.channel` (string)
- 新：`c.channels` (array)
- 旧：`c.remark` (string)
- 新：`c.remarkHistory` (array)

**建议**: 在 `Store.load()` 中建立统一迁移层，确保所有客户数据的字段结构一致后再下发到渲染层。

### 3. Token / 认证改进

- sessionStorage 密码存储 → 改用校验哈希
- 锁屏后应清除 sessionStorage 中的密码缓存
- 建议增加：密码强度指示器、支持 TouchID/Windows Hello（WebAuthn）

---

## 六、总结

| 类别 | 数量 |
|------|------|
| 🔴 安全漏洞 | 3 |
| 🟠 安全风险 | 2 |
| 🟡 安全建议 | 1 |
| 🔴 逻辑 Bug（新发现） | 2 |
| 🟠 逻辑 Bug（新发现） | 2 |
| 🟡 逻辑 Bug / 可用性问题 | 4 |
| 已确认修复（今日） | 15 |

**优先级修复建议**:
1. 🔴 **S1(SessionStorage密码)** + **B1(渠道页面)** = 立即修复
2. 🔴 **B2(showStatPopup ReferenceError)** = 立即修复
3. 🟠 **B3(猫咪跳转搜索)** + **B4(CSV age NaN)** = 尽快修复
4. 🟠 **S2(固定salt)** + **S4(CSP)** = 中等优先级
