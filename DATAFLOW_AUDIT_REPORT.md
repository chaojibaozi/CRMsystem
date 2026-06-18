# CRM 系统输入输出与模块关联审计报告

## 审计范围
- 数据入口 → Store → 数据出口 的完整链路
- 模块间的数据共享与一致性
- 持久化（save/load/export/import）的字段完整性

---

## 一、数据模型总览

```
Store.data = {
  customers:  Customer[],     // 核心数据
  tags:       Tag[],          // 客户标签定义
  customerLevels: Level[],    // 客户等级定义
  customerSources: Source[],  // 客户来源定义
  logs:       Log[],          // 操作日志
  versions:   Version[],      // 历史版本快照（最多3个）
  username:   string,         // 用户名
  avatar:     string,         // 头像 base64
  gesturePattern: string,     // 手势密码序列
  securityQuestions: Q&A[]    // 密保问题（2个）
}

Store.settings = {
  folderHandleKey, theme, followupDays
}
```

---

## 二、输入输出链路验证

### 2.1 客户数据链路

```
                        ┌──────────────────────┐
  ┌─────────┐          │   Store.data.customers │──────→ 客户列表
  │ 新增表单 │─────────→│         Customer[]      │──────→ 客户详情
  └─────────┘          │                        │──────→ 仪表盘统计
  ┌─────────┐          │                        │──────→ BI 看板图表
  │ 编辑表单 │─────────→│                        │──────→ 渠道页面
  └─────────┘          │                        │──────→ 预警模块
  ┌─────────┐          │                        │──────→ 猫咪宠物
  │ CSV导入  │─────────→│                        │──────→ CSV 导出
  └─────────┘          │                        │──────→ 加密备份/导入
  ┌─────────┐          │                        │──────→ 作废/恢复
  │ 演示数据 │─────────→│                        │
  └─────────┘          └──────────────────────┘
```

**状态**: ✅ 所有路径完整联通

### 2.2 元数据链路（标签/等级/来源）

```
  Store.data.tags ─────────→ 客户表单(标签选择) → 客户详情(标签显示) → 标签管理(增删改)
  Store.data.customerLevels → 客户表单(等级下拉) → 列表/详情(等级勋章) → 等级管理(增删改)
                                → BI各级分布图表
  Store.data.customerSources → 客户表单(来源下拉) → 仪表盘(来源饼图) → 来源管理(增删改)
```

**状态**: ✅ 所有元数据变更后通过 `renderSettingsPage()` → `renderTagsList()` 等函数同步更新，保存后用 `saveWithLog` 持久化

### 2.3 渠道链路

```
  客户表单(channels复选框) ─→ Store.data.customers[i].channels (数组)
  旧数据兼容 ─────────────────→ Store.data.customers[i].channel (字符串)，hasChannel() 统一处理
  批量添加渠道 ──────────────→ c.channels = [...旧值, ...新值]; delete c.channel
  
  渠道页面(6个) ────────────→ hasChannel(c, 'geo') 等
  BI渠道分布 ──────────────→ hasChannel(c, ch) 过滤
  导航栏计数 ──────────────→ hasChannel(c, item.key)
  CSV导出 ────────────────→ getCustomerChannels(c) → 中文名映射 → join('|')
  CSV导入 ────────────────→ split('|') → 中文名逆映射 → channels数组
```

**状态**: ✅ 新旧字段兼容处理贯穿全链路，无一遗漏

### 2.4 手势密码/密保问题链路

```
  设置手势 ─→ Store.data.gesturePattern ─→ 锁屏手势验证 ─→ 手势重置密码对话框
  设置密保 ─→ Store.data.securityQuestions ─→ 忘记密码 → 密保验证 → 重置密码
```

**状态**: ✅ 设置→存储→验证→使用 全链路完整

---

## 三、🔴 CSV 导出/导入字段不匹配（严重数据损坏）

**严重性**: 导出后无法导入，属 **数据循环断裂**。

**导出** (`exportCustomerRows`, 行 4863) 现在有 **24 列**：
```
['姓名','性别','年龄','手机号','微信','邮箱',
 '省','市','区','详细地址','来源','等级','成交状态',
 '一级行业','二级行业','客户网址','客户在投平台',     ← 新增4列
 '意向产品','预算','下次跟进日期','录入时间','标签','备注','渠道']
```

**导入** (`qa-import`, 行 8168) 的 expectedHeader 仍然是 **20 列**：
```javascript
const expectedHeader = ['姓名','性别','年龄','手机号','微信','邮箱',
 '省','市','区','详细地址','来源','等级','成交状态',
 '意向产品','预算','下次跟进日期','录入时间','标签','备注','渠道'];
```

**影响**: 
1. 导出得到 24 列 → header.length(24) !== expectedHeader.length(20) → **拒绝导入**
2. 即使用户手动修复表头，列索引也全乱：`row[13]` 被当作"意向产品"但实际是"一级行业"

### 修复方案

**方案 A**（推荐，与旧格式兼容）：
```javascript
// 导入时根据 header 长度动态检测格式
const isNewFormat = header.length >= 24;
if (isNewFormat) {
  // 新格式映射
  customer.product     = row[17];
  customer.budget      = row[18];
  customer.nextFollowDate = row[19];
  // ...
} else if (header.length === 20) {
  // 旧格式映射
  customer.product     = row[13];
  customer.budget      = row[14];
  // ...
}
```

**方案 B**：仅检查列数，用映射表实现列位置无关：
```javascript
const expectedHeader = [...]; // 24列
const colMap = {};
header.forEach((h, i) => { colMap[h.trim()] = i; });
const missing = expectedHeader.filter(h => colMap[h] === undefined);
if (missing.length) { showToast('缺少列：' + missing.join(','), 'error'); return; }
customer.product = row[colMap['意向产品']] || '';
customer.channels = (row[colMap['渠道']] || '').split('|')...
```

---

## 四、其他数据流验证

### 4.1 保存/加载完整性

| 操作 | 序列化范围 | 验证 |
|------|-----------|------|
| `Store.save()` | `JSON.stringify(this.data)` — 全量 | ✅ 包含所有字段 |
| `Store.load()` | `Object.assign({defaults}, parsed)` | ✅ 缺失字段用默认值填充 |
| 版本快照 | customers, tags, levels, sources | ✅ 用户名/头像不参与回滚(正确) |
| CSV导出 | 自建行(24列手动拼接) | ❌ 见第三节 |
| CSV导入 | 逐列解析(20列固定) | ❌ 同上 |

### 4.2 模块关联验证

| 从/到 | 客户列表 | 仪表盘 | BI看板 | 渠道页 | 详情弹窗 | CSV导出 |
|-------|---------|--------|--------|--------|---------|--------|
| 新增客户 | ✅ 跳转并刷新 | ✅ | 下次进入刷新 | ✅ hasChannel | ✅ | ✅ |
| 编辑客户 | ✅ 刷新 | ✅ | ✅ | ✅ | ✅ | — |
| 软删除 | ✅ 过滤 | ✅ 过滤 | ✅ 过滤 | ✅ 过滤 | — | ✅ 不包含 |
| 标签修改 | ✅ 下次渲染 | — | — | — | ✅ 刷新 | ✅ |
| 等级修改 | ✅ tag颜色 | ✅ | ✅ 图表 | ✅ | ✅ | ✅ |
| 来源修改 | ✅ | ✅ 饼图 | ✅ | ✅ | ✅ | ✅ |

### 4.3 `hasChannel()` 兼容检查点分布

| 位置 | 行号 | 检查内容 |
|------|------|---------|
| `hasChannel()` 定义 | 3965 | 先查 `c.channels` (数组)，再查 `c.channel` (字符串) |
| 客户表单初始渲染 | 4049 | `c.channels || (c.channel ? [c.channel] : [])` |
| 客户表单重置 | 4323 | 同上 |
| 新增客户保存 | 4401 | `delete newC.channel` — 清理旧字段 |
| 编辑客户保存 | 4387 | `delete old.channel` — 清理旧字段 |
| 渠道页面渲染 | 4625 | `hasChannel(c, channel)` |
| BI渠道统计 | 5799-5804 | `hasChannel()` 用于6个渠道 |
| BI分析矩阵 | 6174-6179 | `hasChannel()` |
| BI渠道对比图 | 6524-6526 | `hasChannel()` |
| 导航栏计数 | 8544 | `hasChannel(c, item.key)` |
| 演示数据 | 7361 | `channels: ['geo']` — 新格式 |
| 批量添加渠道 | 8106-8107 | `c.channel` → `c.channels` 迁移 |
| CSV导出 | 4886 | `getCustomerChannels(c).map(...)` |
| CSV导入 | 8205 | `split('|')` → 逆映射 → `channels` |

**结论**: 渠道迁移层覆盖完整，无遗漏点。 ✅

---

## 五、总结

| 类别 | 状态 |
|------|------|
| 客户数据完整链路 (表单→Store→所有渲染器) | ✅ 全部正确 |
| 标签/等级/来源元数据 CRUD + 渲染 | ✅ 全部正确 |
| 渠道新旧字段兼容 | ✅ 19处统一用 `hasChannel()` |
| 手势密码/密保问题设置→验证→重置 | ✅ 全部正确 |
| 保存/加载/版本回滚 | ✅ 全部正确 |
| 加密备份/导入 (手机号去重) | ✅ 全部正确 |
| 🔴 **CSV导出/导入字段不一致** | ❌ **24列导出 vs 20列导入 → 直接拒绝** |
| 🔴 CSV列索引偏移 | ❌ 即使绕过表头检查，数据也会错位 |

**唯一需要修复的问题**: `qa-import` 的 `expectedHeader` 和列索引映射需要同步更新为新格式（兼容旧格式可选但更佳）。
