# CRM 系统定时提醒功能审查报告（2026-06-24）

---

## 功能概览

该 CRM **没有推送通知/SMS/桌面通知**能力。提醒仅在**当前浏览器标签页内**有效，依赖以下 3 个组件：

| 组件 | 触发方式 | 作用范围 |
|------|----------|----------|
| Dashboard 客户预警面板 | 导航/刷新时渲染 | 销售客户跟进逾期/临近/议程提醒 |
| BI 看板跟进统计 | 导航/刷新时渲染 | 今日待跟进/已逾期统计 |
| 猫咪宠物气泡弹窗 | 30 分钟周期 + 解锁后主动检查 | 销售客户 + 存量客户逾期提醒 |

---

## 数据流验证

### 设置链路 ✅

```
用户在 Settings 选择天数
→ .frequency-option / .stock-frequency-option 的 click 事件
→ Store.settings.followupDays / stockFollowupDays 赋值
→ Store.saveSettings() 持久化到 localStorage
→ 所有读取端统一使用：
   const followupDays = (Store.settings && Store.settings.followupDays) || 3;  // 默认 3 天
   const stockFollowupDays = (Store.settings && Store.settings.stockFollowupDays) || 30;  // 默认 30 天
```

### 计算逻辑 ✅

**销售客户逾期判定**（`processCustomerAlerts` + `PET.scan`）:
```
超期未联系: nextFollowDate < 今日凌晨  OR  沉默天数 > followupDays
临近联系日期: nextFollowDate 在 [今日, 今日+followupDays天)
议程: nextFollowDate 在 [今日+followupDays, 今日+followupDays*2天)
```
- 已成交/流失客户自动跳过 ✅
- 新客户（创建时间 < followupDays 天）无跟进记录不计为逾期 ✅

**存量客户逾期判定**（`PET.scan`）:
```
紧急阈值: stockFollowupDays * 1.5 天
警告阈值: stockFollowupDays 天（默认30天）
```
- 使用 `remarkHistory[0].time` 或 `createdAt` 计算沉默天数 ✅
- 已成交/流失客户自动跳过 ✅

### Dashboard 面板渲染 ✅

- Dashboard AI 摘要页面：renderAISummary() → 展示逾期/临近/议程统计 ✅
- Stock Dashboard：renderStockDashboard() → 存量客户总览 + 今日新增 + 未标签提醒 ✅
- BI 看板：renderBIPage() → "跟进提醒"卡片显示今日待跟进/已逾期 ✅

### 猫咪宠物弹窗 ✅

- `PET.scan()` 每 30 分钟自动扫描一次（`setInterval`, line 15188）
- 解锁后立即触发首次扫描（enterApp → PET.check）
- 气泡显示 15 秒后自动隐藏（`bubbleTimer`, line 14641）
- 点击客户行 → 跳转到列表页 + 搜索框预填客户名（line 14625-14635）
- 无跟进客户时随机显示三条"健康报告"文案（line 14663-14668）

---

## 发现的问题

### ⚠️ Issue 1: Stock Dashboard 缺少跟进逾期提醒面板

Sales Dashboard 有 `processCustomerAlerts()` 生成的三面板提醒（超期未联系 / 临近联系日期 / 下次沟通事项），但 Stock Dashboard 只有简单的文本提醒（今日新增 / 未标签数 / 平均顾问分配），**没有逾期客户清单和分级提醒**。

**影响**: 存量用户无法在 Dashboard 上一览逾期客户。

### ⚠️ Issue 2: PET.scan() 存量扫描不完整

`PET.scan()` 扫描 `Store.data.stockCustomers` 和 `Store.data.customers`，但**没有扫描 `brandProducts`、`serviceFees`、`qiFuProducts`** 这 3 个存量模块。品牌/服务/企服模块的客户逾期不会被猫咪宠物提醒。

### ⚠️ Issue 3: 无外部推送通知

这是纯前端 SPA（localStorage 存储），所有提醒依赖当前浏览器标签页的运行状态：
- 关闭标签页 = 无提醒
- 猫咪宠物需要用户解锁后才启动 scheduleCheck
- 无 Web Notification API 或 Service Worker 推送

**这是设计限制，非 Bug**，但用户应当了解。

---

## ✅ 结论

| 检查项 | 结果 |
|--------|:----:|
| 设置保存和读取 | ✅ 正确持久化 |
| 逾期计算逻辑 | ✅ 正确，区分销售/存量/新客户 |
| Dashboard 面板渲染 | ✅ 数据正确联动 |
| BI 看板统计 | ✅ 显示今日待跟进+已逾期 |
| 猫咪宠物扫描 | ⚠️ 存量只扫 `stockCustomers`，缺 3 个模块 |
| 猫咪气泡交互 | ✅ 点击客户行跳转列表+预填搜索 |
| 猫咪定时器生命周期 | ✅ 带睡眠检测 + 15秒自动关闭 |
| 外部推送 | ❌ 纯 SPA 限制，无离线通知 |

**整体评价**: 内部的跟进提醒功能完整可用，设置→计算→展示→猫咪弹窗的数据流一致，逻辑正确。两个可优化点（Stock Dashboard 缺少逾期面板、PET 存量扫描覆盖不全）建议在下次迭代修复。
