# CRMSystem 字体大小优化建议

> 生成日期：2026-06-24  
> 项目路径：`D:\GitHub-tongbuwenjianjia\CRMsystem\CRMsystem`

---

## 一、当前问题诊断

分析 `index.html` 中全部的 `font-size` 使用情况，发现三大核心问题：

### 问题 1：字号层级混乱，无统一体系

当前系统使用 `10px ~ 32px` 共 **20+ 个离散字号值**，缺乏系统性：

```
10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 15, 16, 18, 19, 20, 22, 28, 32, 48
```

**影响**：开发时靠感觉选字号，不同人写的模块字号不一致，视觉碎片化。

### 问题 2：大量 10-12px 小字影响可读性

| 位置 | 当前字号 | 问题 |
|------|---------|------|
| Badge / Tag 标签 | `10px` | 高 DPI 屏幕几乎无法辨认 |
| 侧栏辅助文字 | `11px` | 长时间使用导致视疲劳 |
| 浮层标签（customer-float-label） | `11px` | 关键信息过小 |
| KPI 辅助文字 | `11px` | 重要提示被当作装饰 |
| CTA 超链接（auth-link） | `12px` | 可点击区域过小 |
| 错误提示 | `11px` | **<font color="red">重要信息应该醒目</font>** |

### 问题 3：表格数据层级扁平

- 表头 `13px` = 数据行 `13px`，没有视觉区分
- 表格在 1920×1080 屏幕显示 20+ 行时，13px 文字累眼
- 表头无 UPPERCASE/加粗/字距等增强识别的手段

---

## 二、推荐方案：8 级字号体系

在 `:root` 中引入字体 Design Token，强制全局统一。

### 2.1 CSS 变量定义

```css
:root {
  /* ════════════════════════════════════════
     字体大小体系（8 级阶梯）
     参考: Ant Design / Salesforce 层级系统
     ════════════════════════════════════════ */

  /* 辅助级 - 最小安全字号，<11px 禁止使用 */
  --text-xs:     11px;    /* Badge、次级标签 */

  /* 注释级 */
  --text-sm:     12px;    /* 辅助说明、次要信息 */

  /* 基础级 */
  --text-base:   14px;    /* 正文、表格数据、输入框 */

  /* 强调级 */
  --text-md:     15px;    /* 副标题、强调正文 */

  /* 标题级 */
  --text-lg:     18px;    /* 卡片标题、Section 标题 */

  /* 大标题 */
  --text-xl:     22px;    /* 页面 H1、弹窗主标题 */

  /* KPI 数值 */
  --text-2xl:    28px;    /* KPI 主数值、仪表盘大数 */

  /* Hero 数值 */
  --text-3xl:    36px;    /* 大屏 Hero（备用） */
}
```

> **规则**：`<11px` 禁止使用，`10px` 一律改为 `11px`。  
> **效果**：从此所有字号从变量中取，修改一个值全系统联动。

### 2.2 行高变量

```css
:root {
  --leading-none:    1;       /* 无行距（Badge/标签） */
  --leading-tight:   1.25;    /* 标题 */
  --leading-normal:  1.5;     /* 正文 */
  --leading-relaxed: 1.75;    /* 阅读长文本 */
}
```

---

## 三、各模块具体修改方案

### 3.1 全局基础（影响最大）

```css
body {
  font-size: var(--text-base);   /* 14px */
  line-height: var(--leading-normal);
  font-family: var(--font-sans);
}

button, input, select, textarea {
  font-size: var(--text-base);   /* 全部统一 14px */
}
```

### 3.2 表格（最高优先）

这是用户每天看得最多的地方，提升最明显。

```css
/* === 当前: 数据行 13px，表头 13px，层级平 === */
/* === 改为: 数据行 14px + 表头 13px(加强) === */

.data-table th {
  font-size: 13px;              /* 维持 13px */
  font-weight: 600;
  letter-spacing: 0.03em;       /* 加宽字距 */
  color: var(--text-secondary);
}

.data-table td {
  font-size: var(--text-base);  /* 13px → 14px */
  padding: 10px 16px;           /* 垂直 padding 略缩，补偿空间 */
}
```

**效果**：数据行放大 1px → 信息瞬间清晰；表头靠 `letter-spacing + color` 区分层级。

### 3.3 表格 inline-style 覆盖修复

当前有 2 处硬编码 `font-size:12px` 覆盖了表格样式：

```html
<!-- 导入预览表格，当前: -->
<table class="data-table" style="width:100%;font-size:12px;">
<!-- 改为: 去掉 font-size 覆盖，继承 .data-table td 的 14px -->
<table class="data-table" style="width:100%;">
```

**修改位置**：`index.html` 中 2 处 import-preview-table。

### 3.4 Sidebar 导航

```css
.sidebar-title {
  font-size: 16px;              /* 15px → 16px */
  font-weight: 700;
  letter-spacing: -0.01em;
}

/* 当前 .sidebar-item 没有固定字号，继承多个容器 */
/* 建议统一: */
.sidebar-item {
  font-size: 14px;              /* 在 13px 基础上统一 */
}

.sidebar-subtitle {
  font-size: var(--text-sm);    /* 11px → 12px */
  color: var(--text-muted);
}
```

### 3.5 Topbar 页面标题

```css
.topbar-left h1 {
  font-size: 22px;              /* 18px → 22px */
  font-weight: 700;
  letter-spacing: -0.01em;
}

.topbar-left p {
  font-size: 13px;              /* 12px → 13px */
  color: var(--text-muted);
}
```

### 3.6 Section 标题（H2）统一化

当前所有 H2 都是 inline `style="font-size:18px;"`，共 **20+ 处**。

**改为 CSS 统一控制：**

```css
/* 新增 .section-title 类 */
.section-title {
  font-size: var(--text-lg);    /* 18px */
  font-weight: 700;
  margin-bottom: 16px;
  letter-spacing: -0.01em;
}
```

然后全局搜索替换 `h2 style="font-size:18px;"` → `<h2 class="section-title">`。

### 3.7 客户浮层 / 详情面板

```css
.customer-float-name {
  font-size: 18px;              /* 16px → 18px */
  font-weight: 700;
}

.customer-float-label {
  font-size: var(--text-sm);    /* 11px → 12px */
}

.customer-float-value {
  font-size: var(--text-base);  /* 13px → 14px */
}

.detail-title {
  font-size: 20px;              /* 18px → 20px */
}

.detail-label {
  font-size: var(--text-sm);    /* 11px → 12px */
}

.detail-value {
  font-size: var(--text-base);  /* 13px → 14px */
}
```

### 3.8 BI 看板 KPI 区域

```css
.bi-kpi-label {
  font-size: 13px;              /* 12px → 13px */
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.bi-kpi-value {
  font-size: var(--text-2xl);   /* 28px */
  font-weight: 700;
  line-height: var(--leading-tight);
}

.bi-kpi-sub {
  font-size: var(--text-sm);    /* 11px → 12px */
}
```

### 3.9 Badge / Tag / 角标

```css
/* 全局标签统一样式 */
.badge, .tag, .tag-chip {
  font-size: var(--text-xs);    /* 统一 11px */
  padding: 2px 8px;
  border-radius: 4px;
}

/* 当前有 10px 硬编码的地方需要全部改为 11px */
```

**搜索替换目标**（`index.html` 中约 8 处）：
- `font-size:10px` → `font-size:var(--text-xs)`  
- `font-size:10.5px` → `font-size:var(--text-xs)`

### 3.10 错误提示 / 锁屏提示

```css
.error-text {
  font-size: var(--text-sm);    /* 11px → 12px */
  color: var(--danger);
  margin-top: 2px;
}

.lock-dialog .error-text {
  font-size: var(--text-sm);    /* 12px 维持 */
}
```

### 3.11 弹窗（Modal）

```css
.modal-title {
  font-size: var(--text-lg);    /* 14px → 18px，弹窗标题应该明显 */
  font-weight: 600;
}
```

### 3.12 时间线 / 跟进记录

```css
.timeline-content {
  font-size: var(--text-base);  /* 13px → 14px */
}

.timeline-time {
  font-size: var(--text-sm);    /* 11px → 12px */
}

.log-time {
  font-size: var(--text-sm);    /* 11px → 12px */
}
```

### 3.13 登录/授权页（Auth）

```css
.auth-card .label {
  font-size: var(--text-sm);    /* 12px 维持 */
}

.auth-card .btn {
  font-size: var(--text-base);  /* 13px → 14px */
}

.auth-link {
  font-size: var(--text-sm);    /* 12px 维持 */
}
```

### 3.14 桌面猫咪模块

```css
.pet-stat-label {
  font-size: var(--text-sm);    /* 11px → 12px */
}

.pet-stat-value {
  font-size: var(--text-sm);    /* 11px → 12px */
}

/* ZZZ 动画文字 9/11/13 → 11/13/15 稍微放大 */
#crm-pet-bubble-text {
  font-size: var(--text-base);  /* 13px → 14px */
}
```

---

## 四、修改清单（按优先级排序）

| 优先级 | 模块 | 改动量 | 工作量 | 用户感知度 |
|--------|------|--------|--------|-----------|
| **P0** | 表格数据行 13→14px | 1 处 CSS | ⭐ | 🔥🔥🔥 |
| **P0** | 基础字号体系变量定义 | 1 处 CSS | ⭐ | 🔥🔥🔥 |
| **P1** | 客户浮层 label 11→12px, value 13→14px | 2 处 CSS | ⭐ | 🔥🔥 |
| **P1** | Sidebar 辅助文字 11→12px | 2 处 CSS | ⭐ | 🔥🔥 |
| **P1** | Tag/Badge 10→11px | ~8 处替换 | ⭐⭐ | 🔥🔥 |
| **P1** | 错误提示 11→12px | 2 处 CSS | ⭐ | 🔥🔥 |
| **P2** | Topbar H1 18→22px | 1 处 CSS | ⭐ | 🔥🔥 |
| **P2** | Section H2 替换为 .section-title | ~20 处 inline 替换 | ⭐⭐⭐ | 🔥 |
| **P2** | Modal 标题 14→18px | 1 处 CSS | ⭐ | 🔥 |
| **P2** | Auth 按钮 13→14px | 1 处 CSS | ⭐ | 🔥 |
| **P3** | 时间线文字 13→14px | 2 处 CSS | ⭐ | 🔥 |
| **P3** | 桌面猫宠物文字 | 4 处 CSS | ⭐ | 🔥 |
| **P3** | 导入预览表 inline 修复 | 2 处替换 | ⭐ | 🔥 |

---

## 五、可以立刻动手的改动（P0 + P1）

### Step 1：在 `:root` 添加字体变量

搜索 `--font-mono` 行，在其后插入：

```css
  /* ═══════════════════════
     字体大小体系（8 级阶梯）
     ═══════════════════════ */
  --text-xs:     11px;    /* 辅助 */
  --text-sm:     12px;    /* 注释 */
  --text-base:   14px;    /* 正文/表格 */
  --text-md:     15px;    /* 强调 */
  --text-lg:     18px;    /* 标题 */
  --text-xl:     22px;    /* 大标题 */
  --text-2xl:    28px;    /* KPI 数值 */
  --text-3xl:    36px;    /* Hero 备用 */

  --leading-none:    1;
  --leading-tight:   1.25;
  --leading-normal:  1.5;
  --leading-relaxed: 1.75;
```

### Step 2：改表格数据行字号

在 `.data-table th, .data-table td` 中：

```css
/* 改前 */
.data-table th, .data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--color-neutral-100);
  font-size: 13px;
  white-space: nowrap;
}

/* 改后 */
.data-table th {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--color-neutral-100);
  font-size: 13px;               /* 表头保持 13px */
  font-weight: 600;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.data-table td {
  padding: 10px 16px;            /* 垂直 padding 缩 2px 补偿 */
  text-align: left;
  border-bottom: 1px solid var(--color-neutral-100);
  font-size: var(--text-base);   /* 14px */
  white-space: nowrap;
}
```

### Step 3：全局替换 10px → 11px

搜索 `font-size:10px`（含 `10.5px`），统一替换为 `font-size:11px`。

---

## 六、预期效果

| 指标 | 改前 | 改后 |
|------|------|------|
| 表格可读性 | 13px 密集，需凑近屏幕 | 14px 清晰，适合长时间查看 |
| 层级感 | 扁平模糊，主次难辨 | 8 级阶梯系统，视觉层次分明 |
| 小字最小字号 | 10px (Badge 几乎不可读) | 11px (安全可读) |
| 维护成本 | 20+ 种字号散落各处 | 8 个 CSS 变量统一管理 |
| 页面标题突出度 | H1=18px vs H2=18px 同级冲突 | H1=22px / H2=18px 清晰分层 |

---

## 七、注意事项

1. **修改后刷新即可生效**，所有改动在 `index.html` 中，无构建流程
2. 建议 **分批次部署**，先改 P0（表格），观察 1-2 天再改 P1
3. 表格 `padding` 从 `12px` 缩到 `10px` **只缩垂直方向**，水平 `16px` 不变，不影响列宽
4. Inline `style="font-size:...px"` 的优先级高于 CSS 类，如需统一控制需改为 class 方式
5. 修改后检查暗色模式（`[data-theme="dark"]`）下的效果，确保对比度一致
