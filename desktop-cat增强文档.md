# CRM 系统猫咪增强 · 落地实现文档

> **目标系统：** `D:\GitHub-tongbuwenjianjia\CRMsystem\CRMsystem\index.html`  
> **现有基础：** 单文件 SPA，已有 SVG 猫咪（4 种眼态、CSS 动画、拖拽、气泡提醒、客户跟进扫描）  
> **增强目标：** 猫咪形象高端化 + 眼睛追踪 + 更丰富的动画与交互

---

## 目录

1. [技术路线与实现原则](#1-技术路线与实现原则)
2. [替换 SVG 猫咪 —— 英短银渐层高质感版](#2-替换-svg-猫咪--英短银渐层高质感版)
3. [眼部动画系统](#3-眼部动画系统)
4. [动画增强](#4-动画增强)
5. [交互相应增强](#5-交互相应增强)
6. [替换或新增的完整代码块（可直接替换原文件对应位置）](#6-替换或新增的完整代码块可直接替换原文件对应位置)
7. [实施清单](#7-实施清单)

---

## 1. 技术路线与实现原则

### 1.1 现状分析

当前系统中猫咪的代码分布在 index.html 的三个位置：

| 位置 | 行号范围 | 内容 | 修改方式 |
|------|---------|------|---------|
| CSS 动画 | ~8221-8463 | `#crm-pet-widget` 及相关样式 | 追加/替换 |
| HTML 注入 | ~8464-8550 | `buildCatSVG()` 函数 | 替换 SVG 内容 |
| JS 逻辑 | ~8550-8810 | `PET` 对象（状态机/扫描/交互） | 增强 |

### 1.2 增强原则

1. **不改变现有业务逻辑**——客户扫描、气泡提醒、mini 模式保留
2. **不破坏现有接口**——保留 `window.CRMPet`、`PET.state`、`PET.setState()` 等外部调用
3. **CSS-only 动画优先**——能用 CSS 实现的动画不用 JS
4. **渐进式增强**——每步独立可回滚

---

## 2. 替换 SVG 猫咪 —— 英短银渐层高质感版

### 2.1 改动范围

**替换** `buildCatSVG()` 函数的返回值（约 8464-8550 行）。

### 2.2 替换后的猫咪对比

| 部位 | 当前（橘猫色 #f5c98a） | 替换后（银渐层） |
|------|---------------------|----------------|
| 身体 | 纯色 #f5c98a | 线性渐变 #CFD8DC → #90A4AE |
| 头部 | 纯色 #f5c98a | 径向渐变 #ECEFF1 → #B0BEC5 |
| 耳朵内部 | #f4a0b0（粉红） | #F8BBD0 → #AD1457（暗色更粉） |
| 瞳孔 | #4a3728（深棕） | #1A237E（深蓝，与CRM主色呼应） |
| 身体阴影 | 无 | 底部加上 SVG 阴影椭圆 |
| 腮红 | #f9b8c8 opacity 0.55 | 保留并加径向渐变 |

### 2.3 替换代码

```javascript
// 替换 buildCatSVG() 的整个 return 内容
function buildCatSVG() {
  return `
  <svg id="crm-pet-svg" class="idle" viewBox="0 0 84 84" width="80" height="80" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- 银渐层身体渐变 -->
      <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#CFD8DC"/>
        <stop offset="100%" stop-color="#90A4AE"/>
      </linearGradient>
      <!-- 头部渐变 -->
      <radialGradient id="headGrad" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#ECEFF1"/>
        <stop offset="70%" stop-color="#B0BEC5"/>
        <stop offset="100%" stop-color="#78909C"/>
      </radialGradient>
      <!-- 耳内渐变 -->
      <linearGradient id="earInnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F8BBD0"/>
        <stop offset="100%" stop-color="#F06292"/>
      </linearGradient>
      <!-- 肚皮渐变 -->
      <linearGradient id="bellyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#ECEFF1"/>
      </linearGradient>
      <!-- 阴影滤镜 -->
      <filter id="shadowFilter" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.12)"/>
      </filter>
    </defs>

    <!-- 底部阴影 -->
    <ellipse cx="42" cy="76" rx="30" ry="4" fill="rgba(0,0,0,0.08)" id="pet-shadow"/>

    <!-- 尾巴 -->
    <path id="pet-tail"
      d="M22 60 Q6 56 8 44 Q10 36 18 40"
      stroke="#78909C" stroke-width="5" stroke-linecap="round" fill="none"/>

    <!-- 身体 + 头部 -->
    <g id="pet-body-group" filter="url(#shadowFilter)">
      <!-- 身体 -->
      <ellipse cx="42" cy="58" rx="18" ry="14" fill="url(#bodyGrad)"/>
      <!-- 肚皮 -->
      <ellipse cx="42" cy="60" rx="11" ry="9" fill="url(#bellyGrad)"/>

      <!-- 头部 -->
      <ellipse cx="42" cy="36" rx="18" ry="16" fill="url(#headGrad)"/>

      <!-- 左耳 -->
      <polygon points="26,24 24,10 35,20" fill="#90A4AE" stroke="#78909C" stroke-width="0.5"/>
      <polygon points="27,22 26,13 34,21" fill="url(#earInnerGrad)"/>
      <!-- 右耳 -->
      <polygon points="58,24 56,10 45,20" fill="#90A4AE" stroke="#78909C" stroke-width="0.5"/>
      <polygon points="57,22 54,13 46,21" fill="url(#earInnerGrad)"/>

      <!-- 眼睛（默认睁开） -->
      <g id="pet-eyes-open">
        <!-- 眼白 -->
        <ellipse cx="36" cy="36" rx="5" ry="5.5" fill="#fff"/>
        <ellipse cx="48" cy="36" rx="5" ry="5.5" fill="#fff"/>
        <!-- 瞳孔 -->
        <circle cx="36.8" cy="36.5" r="3.2" fill="#1A237E"/>
        <circle cx="48.8" cy="36.5" r="3.2" fill="#1A237E"/>
        <!-- 高光 -->
        <circle cx="38" cy="35" r="1.2" fill="#fff"/>
        <circle cx="50" cy="35" r="1.2" fill="#fff"/>
      </g>

      <!-- 眼睛（睡眠弧形） -->
      <g id="pet-eyes-sleep" display="none">
        <path d="M31 37 Q36 32 41 37" stroke="#78909C" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M43 37 Q48 32 53 37" stroke="#78909C" stroke-width="2" fill="none" stroke-linecap="round"/>
      </g>

      <!-- 眼睛（高兴弯月） -->
      <g id="pet-eyes-happy" display="none">
        <path d="M31 35 Q36 40 41 35" stroke="#1A237E" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M43 35 Q48 40 53 35" stroke="#1A237E" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      </g>

      <!-- 眼睛（警觉大眼） -->
      <g id="pet-eyes-alert" display="none">
        <ellipse cx="36" cy="36" rx="6" ry="6.5" fill="#fff"/>
        <ellipse cx="48" cy="36" rx="6" ry="6.5" fill="#fff"/>
        <circle cx="36" cy="36.5" r="3.8" fill="#1A237E"/>
        <circle cx="48" cy="36.5" r="3.8" fill="#1A237E"/>
        <circle cx="37.5" cy="34.8" r="1.3" fill="#fff"/>
        <circle cx="49.5" cy="34.8" r="1.3" fill="#fff"/>
      </g>

      <!-- 鼻子 -->
      <ellipse cx="42" cy="42" rx="2" ry="1.5" fill="#EF9A9A"/>
      <!-- 嘴 -->
      <path d="M42 43.5 Q38 46.5 37 45.5" stroke="#EF9A9A" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M42 43.5 Q46 46.5 47 45.5" stroke="#EF9A9A" stroke-width="1.2" fill="none" stroke-linecap="round"/>

      <!-- 腮红 -->
      <ellipse cx="31" cy="42" rx="4" ry="2.5" fill="#F8BBD0" opacity="0.5"/>
      <ellipse cx="53" cy="42" rx="4" ry="2.5" fill="#F8BBD0" opacity="0.5"/>

      <!-- 胡须 -->
      <line x1="19" y1="41" x2="33" y2="42" stroke="#B0BEC5" stroke-width="0.8" stroke-linecap="round"/>
      <line x1="19" y1="44" x2="33" y2="43.5" stroke="#B0BEC5" stroke-width="0.8" stroke-linecap="round"/>
      <line x1="51" y1="42" x2="65" y2="41" stroke="#B0BEC5" stroke-width="0.8" stroke-linecap="round"/>
      <line x1="51" y1="43.5" x2="65" y2="44" stroke="#B0BEC5" stroke-width="0.8" stroke-linecap="round"/>

      <!-- 四肢 -->
      <ellipse cx="30" cy="70" rx="7" ry="5" fill="url(#bodyGrad)"/>
      <ellipse cx="54" cy="70" rx="7" ry="5" fill="url(#bodyGrad)"/>
      <ellipse cx="30" cy="72" rx="5.5" ry="3.5" fill="url(#bellyGrad)"/>
      <ellipse cx="54" cy="72" rx="5.5" ry="3.5" fill="url(#bellyGrad)"/>

      <!-- 睡眠 Zzz 文字 -->
      <text class="pet-zzz" x="60" y="25" font-size="9" fill="#60A5FA" font-weight="700" opacity="0">z</text>
      <text class="pet-zzz" x="63" y="18" font-size="11" fill="#93C5FD" font-weight="700" opacity="0">z</text>
      <text class="pet-zzz" x="67" y="10" font-size="13" fill="#BFDBFE" font-weight="700" opacity="0">Z</text>
    </g>
  </svg>`;
}
```

**修改说明：**
- 引入 `<defs>` 区定义 5 个渐变（身体/头部/耳朵/肚皮/阴影滤镜）
- 身体从纯色改为银灰色渐变 `#CFD8DC → #90A4AE`
- 头部从纯色改为径向渐变 `#ECEFF1 → #B0BEC5`
- 瞳孔颜色从深棕改为深蓝 `#1A237E`（与 CRM 主色一致）
- 增加底部阴影椭圆 `<ellipse id="pet-shadow">`
- `viewBox` 从 80x80 改为 84x84（给阴影留空间）

---

## 3. 眼部动画系统

### 3.1 方案选型

当前眼睛位置由 SVG `<circle>` 和 `<ellipse>` 的静态属性控制。

**选型：用 CSS transform + CSS 自定义属性驱动瞳孔**
- 在 SVG 瞳孔元素上应用 `transform`，通过 `style.setProperty()` 实时更新
- JS 每隔 16ms 计算瞳孔位置并更新 CSS 变量
- 兼容现有 DOM 结构，不改 SVG 组

### 3.2 替换眼睛组的 SVG

将 `buildCatSVG()` 中的眼睛组替换为支持追踪的版本：

```javascript
// 替换 pet-eyes-open 组的内容：
// 找到这一整段（约 8527-8535 行）：
<g id="pet-eyes-open">
  <ellipse cx="36" cy="36" rx="5" ry="5.5" fill="#fff"/>
  <ellipse cx="48" cy="36" rx="5" ry="5.5" fill="#fff"/>
  <circle cx="36.8" cy="36.5" r="3.2" fill="#1A237E"/>
  <circle cx="48.8" cy="36.5" r="3.2" fill="#1A237E"/>
  <circle cx="38" cy="35" r="1.2" fill="#fff"/>
  <circle cx="50" cy="35" r="1.2" fill="#fff"/>
</g>

// 替换为：
<g id="pet-eyes-open" class="pet-eyes-tracking">
  <!-- 眼白 -->
  <ellipse cx="36" cy="36" rx="5" ry="5.5" fill="#fff"/>
  <ellipse cx="48" cy="36" rx="5" ry="5.5" fill="#fff"/>
  <!-- 瞳孔（用 CSS 自定义属性驱动偏移） -->
  <g class="pupil-group">
    <circle cx="36.8" cy="36.5" r="2.8" fill="#1A237E"/>
    <circle cx="48.8" cy="36.5" r="2.8" fill="#1A237E"/>
  </g>
  <!-- 高光（跟随瞳孔反方向偏移） -->
  <g class="highlight-group">
    <circle cx="38.5" cy="35" r="1" fill="#fff"/>
    <circle cx="50.5" cy="35" r="1" fill="#fff"/>
  </g>
</g>
```

### 3.3 新增 CSS

```css
/* 添加到已有 CSS 末尾（~8463 行后面） */

/* 瞳孔追踪偏移 */
.pupil-group {
  transition: transform 80ms ease-out;
  transform: translate(var(--pupil-x, 0px), var(--pupil-y, 0px));
}

.highlight-group {
  transition: transform 80ms ease-out;
  transform: translate(var(--highlight-x, 0px), var(--highlight-y, 0px));
}
```

### 3.4 JS 追踪逻辑

在 `PET` 对象后面新增追踪功能：

```javascript
// 在 PET 对象结束后（约 8810 行），追加以下代码：

// ── 猫咪眼睛追踪模块 ──
(function initEyeTracking() {
  'use strict';

  const TRACK_RADIUS = 200;   // 最大追踪距离 px
  const PUPIL_MAX = 3;         // 瞳孔最大偏移量 px
  const HIGHLIGHT_MAX = 1.2;   // 高光最大偏移量 px
  const SMOOTH = 0.1;          // 平滑系数

  let targetX = 0, targetY = 0;
  let currentX = 0, currentY = 0;
  let rafId = null;
  let isRunning = false;

  function onMouseMove(e) {
    const widget = document.getElementById('crm-pet-widget');
    if (!widget) return;
    const rect = widget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const factor = Math.min(dist / TRACK_RADIUS, 1);

    const angle = Math.atan2(dy, dx);
    targetX = Math.cos(angle) * factor * PUPIL_MAX;
    targetY = Math.sin(angle) * factor * PUPIL_MAX;
  }

  function tick() {
    if (!isRunning) return;

    // 平滑趋近
    currentX += (targetX - currentX) * SMOOTH;
    currentY += (targetY - currentY) * SMOOTH;

    // 更新 CSS 变量
    const eyes = document.querySelector('.pet-eyes-tracking');
    if (eyes) {
      eyes.style.setProperty('--pupil-x', `${currentX}px`);
      eyes.style.setProperty('--pupil-y', `${currentY}px`);
      eyes.style.setProperty('--highlight-x', `${-currentX * 0.3}px`);
      eyes.style.setProperty('--highlight-y', `${-currentY * 0.3}px`);
    }

    rafId = requestAnimationFrame(tick);
  }

  // 睡眠时停止追踪（省电）
  const origSetState = PET.setState.bind(PET);
  PET.setState = function(s) {
    origSetState(s);
    if (s === 'sleep') {
      isRunning = false;
      if (rafId) cancelAnimationFrame(rafId);
      // 瞳孔归位
      const eyes = document.querySelector('.pet-eyes-tracking');
      if (eyes) {
        eyes.style.setProperty('--pupil-x', '0px');
        eyes.style.setProperty('--pupil-y', '0px');
      }
    } else {
      if (!isRunning) {
        isRunning = true;
        rafId = requestAnimationFrame(tick);
      }
    }
  };

  // 启动追踪
  document.addEventListener('mousemove', onMouseMove, { passive: true });
  isRunning = true;
  rafId = requestAnimationFrame(tick);

  // 暴露停止接口（可选）
  window.__eyeTracking = { stop: () => { isRunning = false; if(rafId) cancelAnimationFrame(rafId); } };
})();
```

**改动说明：**
- 在 `PET.setState` 上加了一层代理：睡眠时停止追踪，醒来恢复
- 使用 `requestAnimationFrame` 驱动，支持流畅的瞳孔平滑过渡
- 高光反方向偏移，增加立体感

---

## 4. 动画增强

### 4.1 新增 CSS 动画

在已有 CSS 之后追加（~8463 行 `</style>` 之前或追加在 style 块末尾）：

```css
/* ========== 新增动画：状态过渡 ========== */

/* 状态切换过渡：SVG 整体渐入 */
#crm-pet-svg {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              opacity 0.3s ease;
}

/* idle → alert 时：猫头微微前倾 */
#crm-pet-svg.alert #pet-body-group {
  animation: petAlert 0.6s ease-in-out infinite;
}

/* idle → happy 时：猫身轻跳 */
#crm-pet-svg.happy #pet-body-group {
  animation: petHappyBounce 0.4s ease-in-out infinite;
}

/* idle → sleep 过渡：优雅下降 */
#crm-pet-svg.sleep {
  transform: translateY(4px);
  opacity: 0.85;
  transition: transform 0.6s ease, opacity 0.6s ease;
}

/* 睡眠 → idle 唤醒过渡 */
#crm-pet-svg.sleep.waking {
  transform: translateY(0);
  opacity: 1;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
}

/* ========== 新增关键帧 ========== */
@keyframes petAlert {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

@keyframes petHappyBounce {
  0%, 100% { transform: translateY(0) scale(1); }
  25% { transform: translateY(-3px) scale(1.02); }
  50% { transform: translateY(0) scale(1); }
  75% { transform: translateY(-1.5px) scale(1.01); }
}

/* 尾巴甩动（更动态） */
@keyframes petTailSwing {
  0%   { transform: rotate(-8deg); }
  25%  { transform: rotate(12deg); }
  50%  { transform: rotate(-5deg); }
  75%  { transform: rotate(10deg); }
  100% { transform: rotate(-8deg); }
}

/* 耳朵抽动 */
@keyframes petEarAlert {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-5deg); }
  40% { transform: rotate(8deg); }
  60% { transform: rotate(-3deg); }
  80% { transform: rotate(5deg); }
}

#crm-pet-svg.alert #pet-ear-l { animation: petEarAlert 1s ease-in-out infinite; transform-origin: bottom right; }
#crm-pet-svg.alert #pet-ear-r { animation: petEarAlert 1s ease-in-out infinite; animation-delay: 0.15s; transform-origin: bottom left; }

/* 阴影呼吸 */
#pet-shadow {
  transition: rx 0.3s ease, ry 0.3s ease;
}

#crm-pet-svg.happy #pet-shadow {
  animation: shadowBounce 0.4s ease-in-out infinite;
}

@keyframes shadowBounce {
  0%, 100% { rx: 30; ry: 4; opacity: 0.08; }
  50% { rx: 25; ry: 2.5; opacity: 0.04; }
}

/* 猫在 mini 模式时尾巴保持动画 */
#crm-pet-widget.mini #pet-tail {
  animation: petTailWag 1.8s ease-in-out infinite !important;
}
```

### 4.2 新增 JS：睡眠唤醒过渡

在 `PET` 对象的 `setState` 中增加平滑过渡：

```javascript
// 找到 PET 对象中的 setState 方法（约 8560 行）
// 在切换眼睛状态的代码之前，添加过渡逻辑：

setState(s) {
  const svg = document.getElementById('crm-pet-svg');

  // ── 睡眠 → 唤醒过渡 ──
  if (this.state === 'sleep' && s !== 'sleep') {
    if (svg) {
      svg.classList.add('waking');
      setTimeout(() => svg.classList.remove('waking'), 500);
    }
  }

  // ── 新状态快速闪一下 ──
  if (s === 'alert' && this.state !== 'alert') {
    // 快速抖动
    if (svg) {
      svg.style.transition = 'transform 0.1s ease';
      svg.style.transform = 'scale(1.05)';
      setTimeout(() => {
        svg.style.transform = 'scale(1)';
        setTimeout(() => svg.style.transition = '', 300);
      }, 100);
    }
  }

  this.state = s;
  if (!svg) return;
  svg.className.baseVal = s;
  // ... 后续眼睛切换代码保持不变 ...
```

### 4.3 Mini 模式增强

找到 mini 模式的响应代码（约 8775 行），在双击判定中添加：

```javascript
// 在双击处理中添加动画
if (petClickCount >= 2) {
  const widget = document.getElementById('crm-pet-widget');
  const isMini = widget.classList.contains('mini');
  if (isMini) {
    // 展开动画
    widget.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    widget.style.transform = 'scale(0.8)';
    setTimeout(() => {
      widget.classList.remove('mini');
      widget.style.transform = 'scale(1)';
    }, 150);
    setTimeout(() => widget.style.transition = '', 450);
    // ...
  } else {
    // 收缩动画
    widget.style.transition = 'transform 0.25s ease';
    widget.style.transform = 'scale(0.6)';
    PET.hideBubble();
    setTimeout(() => {
      widget.classList.add('mini');
      widget.style.transform = '';
      setTimeout(() => widget.style.transition = '', 300);
    }, 200);
    // ...
  }
}
```

---

## 5. 交互相应增强

### 5.1 悬停反馈

在事件注册区域（约 8700 行）`document.getElementById('crm-pet-body')` 的部位追加：

```javascript
// 找到此位置（约 8700-8706 行），在 click 事件之前添加：

// ── 悬停反馈 ──
(function addHoverEffect() {
  const body = document.getElementById('crm-pet-body');
  if (!body) return;

  body.addEventListener('mouseenter', function() {
    const svg = document.getElementById('crm-pet-svg');
    if (!svg || svg.classList.contains('sleep')) return;

    // 悬停时耳朵微微竖起 + 身体放大
    svg.style.transition = 'transform 0.2s ease';
    svg.style.transform = 'scale(1.06)';

    // 改变状态呼吸速度：给 SVG 加一个临时的 class
    svg.classList.add('hovered');
  });

  body.addEventListener('mouseleave', function() {
    const svg = document.getElementById('crm-pet-svg');
    if (!svg) return;

    svg.style.transform = 'scale(1)';
    svg.classList.remove('hovered');
    setTimeout(() => svg.style.transition = '', 300);
  });
})();
```

### 5.2 新增 CSS 悬停样式

```css
#crm-pet-svg.hovered #pet-body-group {
  animation-duration: 1.5s !important;  /* 呼吸加快 */
}

#crm-pet-svg.hovered #pet-tail {
  animation-duration: 1s !important;    /* 尾巴摇快 */
}
```

### 5.3 气泡入场增强

增强气泡弹出的效果，在现有 CSS 基础上（~8261 行附近）增加：

```css
#crm-pet-bubble.show #crm-pet-bubble-title {
  animation: titleSlideIn 0.25s ease-out 0.08s both;
}

#crm-pet-bubble.show #crm-pet-bubble-text {
  animation: titleSlideIn 0.25s ease-out 0.15s both;
}

@keyframes titleSlideIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### 5.4 拖拽弹性

拖拽结束时增加一点弹性回弹效果。找到 `onUp` 函数（约 8740 行附近）：

```javascript
// 在 document.removeEventListener('mouseup', onUp); 之后追加：
function onUp() {
  document.removeEventListener('mousemove', onMove);
  document.removeEventListener('mouseup', onUp);
  
  // 弹性回弹效果
  petWidget.style.transition = 'right 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), bottom 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';
  setTimeout(() => petWidget.style.transition = '', 400);
  
  setTimeout(() => { PET.isDragging = false; }, 100);
}
```

---

## 6. 替换或新增的完整代码块（可直接替换原文件对应位置）

### 6.1 替换 `buildCatSVG()` 函数

**定位：** 文件中的 `function buildCatSVG() {`（约 8464 行）  
**操作：** 将整个函数体（从 `return \`` 到 `\`;`）替换为第 2.3 节的 SVG 代码

### 6.2 替换眼睛组 SVG

**定位：** `buildCatSVG()` 内部的 `id="pet-eyes-open"` 组  
**操作：** 替换为第 3.2 节新的眼睛组代码

### 6.3 追加 CSS

**定位：** 文件中 `</style>` 之前（约 8463 行）  
**操作：** 在第 4.1 节和第 5.2 节的 CSS 代码追加到现有 CSS 末尾

### 6.4 追加眼睛追踪 JS

**定位：** `window.CRMPet = PET;` 之后（约 8810 行）  
**操作：** 在第 3.4 节的追踪代码追加到该行后面

### 6.5 修改 `PET.setState`

**定位：** `PET.setState` 函数体内（约 8560 行）  
**操作：** 在函数开头添加第 4.2 节的过渡逻辑

### 6.6 追加悬停反馈 JS

**定位：** `PET` 对象定义结束之后，`scheduleCheck()` 之前（约 8700 行）  
**操作：** 在第 5.1 节的悬停代码追加到 click 事件绑定之前

### 6.7 修改拖拽弹性

**定位：** 拖拽逻辑中的 `onUp` 函数（约 8740 行）  
**操作：** 添加第 5.4 节的弹性回弹代码

---

## 7. 实施清单

### 实施顺序

| 步骤 | 内容 | 难度 | 风险 | 效果 |
|:----:|------|:---:|:---:|:----:|
| 1 | 替换 `buildCatSVG()` SVG 代码 | 低 | 低 | 猫咪从橘猫→银渐层 🎨 |
| 2 | 追加眼部追踪 CSS + JS | 低 | 低 | 瞳孔跟随鼠标 👀 |
| 3 | 追加状态过渡 CSS + 修改 `setState` | 低 | 低 | 睡眠/唤醒/警报有过渡动画 |
| 4 | 追加悬停反馈 CSS + JS | 低 | 极低 | 悬停猫咪放大+呼吸加快 |
| 5 | 修改拖拽弹性 | 低 | 极低 | 拖拽结束有弹性碰壁感 |
| 6 | 气泡入场动画 | 极低 | 极低 | 气泡文字顺序显现 |

### 注意事项

1. **渐变兼容性：** SVG `<linearGradient>` 和 `<radialGradient>` 在所有现代浏览器中支持良好，不需要降级
2. **暗色模式：** 银渐层猫咪在暗色模式下可见性良好，如需调整可在 `[data-theme="dark"] #crm-pet-svg` 下加 `filter: brightness(0.9)` 微调
3. **性能：** 眼睛追踪使用 `requestAnimationFrame`，仅在猫咪非睡眠态下运行；睡眠时自动停止
4. **文件大小：** 所有增强代码约 8KB，对 420KB 的 index.html 影响可忽略
