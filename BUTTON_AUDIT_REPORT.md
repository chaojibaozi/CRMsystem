# CRM 系统按钮全链路行为分析报告
**文件**: index.html (9,100 行)
**审计目标**: 每个按钮是否正常工作，含静态按钮和动态模态按钮

---

## 严重性分级
- 🔴 **崩溃** — 点击后报错/白屏/不可用
- 🟠 **功能降级** — 部分功能无响应
- 🟡 **体验问题** — 交互反馈不正常

---

## 一、🔴 发现：`footerHTML` vs `footer` 参数不匹配导致 4 个按钮永久失效

### 根因

`openModal()` 函数的签名是：
```javascript
function openModal({ title, bodyHTML, footer, size, onOpen, onClose })
```
参数 `footer` 是一个**回调函数**（`(f) => { f.appendChild(button) }`），不是 HTML 字符串。

但代码中有 4 处错误地传入了 `footerHTML` 字符串：
```javascript
openModal({
  ...
  footerHTML: '<button class="btn btn-primary" id="btn-xxx">确认</button>',
});
```
`footerHTML` 不匹配任何已声明的参数，**被静默忽略**。模态框没有渲染任何按钮，后续 `document.getElementById('btn-xxx').onclick = ...` 得到的 `null` → TypeError。

### 影响详情

| # | 按钮 id | 触发路径 | 影响 | 行号 |
|---|---------|---------|------|------|
| 🔴 | `btn-do-reset-pw` | 设置→手势重置密码→验证通过后弹出的"设置新密码"弹窗 | **点击"确认修改"无任何反应** | 9770 |
| 🔴 | `btn-sq-verify` | 设置→密保重置密码→回答密保问题的弹窗 | **点击"验证并重置密码"无任何反应** | 9937 |
| 🔴 | `btn-do-reset-pw-final` | (密保/当前密码验证通过后弹出的"设置新密码"弹窗) | **点击"确认修改"无任何反应** | 9969 |
| 🔴 | `btn-verify-cur-pw` | 设置→验证当前密码→输入密码弹窗 | **点击"验证"无任何反应** | 10045 |

**修复方法**（将 footerHTML 字符串转为 footer 回调）：
```javascript
function openSetNewPasswordDialog() {
  openModal({
    title: '设置新密码',
    size: 'sm',
    bodyHTML: `...`,
    footer: (f) => {   // ✅ 改为 footer 回调
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.id = 'btn-do-reset-pw';
      btn.textContent = '确认修改';
      f.appendChild(btn);
    },
  });
  // 之后的 document.getElementById 工作正常 ✅
}
```

---

## 二、全量按钮状态矩阵

### 2.1 登录/认证区（auth-view）

| 按钮 | 绑定方式 | 状态 | 备注 |
|------|---------|------|------|
| `btn-unlock` | `DOMContentLoaded.onclick` | ✅ 正常 | 用户名+密码双验证，锁定冷却支持 |
| `unlock-password` Enter | `DOMContentLoaded.keydown` | ✅ 正常 | 回车触发解锁 |
| `unlock-username` Enter | `DOMContentLoaded.keydown` | ✅ 正常 | 回车→密码框 focus |
| `btn-init` | `DOMContentLoaded.onclick` | ✅ 正常 | 用户名≥2字符，密码≥6位，确认密码比对，隐私勾选 |
| `init-password/password2` input | `DOMContentLoaded.oninput` | ✅ 正常 | 实时比对显示✅/❌ |
| `btn-back-unlock` | `DOMContentLoaded.onclick` | ✅ 正常 | 切换视图 |
| `btn-forgot` | `initAuthPage()` 动态绑定 | ✅ 正常 | 有密保→密保重置，无密保→清空重置。每次 `initAuthPage()` 重新绑定 |
| `btn-sq-hint` | `initAuthPage()` 动态绑定 | ✅ 正常 | 有密保→打开密保验证，无密保→Toast 提示先设置 |
| `btn-unlock-pw-mode` | **脚本顶层** `.onclick` | ✅ 正常 | 静态 HTML 存在，切换密码模式 |
| `btn-unlock-gesture-mode` | **脚本顶层** `.onclick` | ✅ 正常 | 静态 HTML 存在，检查 `gesturePattern` 后切手势模式 |
| `btn-unlock-gesture-reset` | **脚本顶层** `.onclick` (带 null guard) | ✅ 正常 | `if (btnUnlockGestureReset) { btnUnlockGestureReset.onclick = ... }` |

### 2.2 锁屏浮层（lock-overlay）

| 按钮 | 绑定方式 | 状态 | 备注 |
|------|---------|------|------|
| `btn-lock` | `DOMContentLoaded.onclick` | ✅ 正常 | 清除 idle timer，设置 unlocked=false，显示锁屏浮层 |
| `btn-lock-unlock` | `DOMContentLoaded.onclick` | ✅ 正常 | doUnlock + 5次锁定限制 |
| `lock-password` Enter | `DOMContentLoaded.keydown` | ✅ 正常 | 回车触发解锁 |
| `btn-lock-pw-mode` | `DOMContentLoaded.onclick` | ✅ 正常 | 切换密码模式 |
| `btn-lock-gesture-mode` | `DOMContentLoaded.onclick` | ✅ 正常 | 切换手势模式，有 `gesturePattern` 检查 |
| `btn-lock-gesture-reset` | `DOMContentLoaded.onclick` | ✅ 正常 | 重置手势绘制 |
| `btn-lock-logout` | `DOMContentLoaded.onclick` | ✅ 正常 | 退出到登录页 |
| `btn-gesture-setup-settings` | `DOMContentLoaded.onclick` | ✅ 正常 | 在设置页，打开手势设置弹窗 |

### 2.3 侧边栏 + 导航

| 按钮 | 绑定方式 | 状态 | 备注 |
|------|---------|------|------|
| `nav-item[data-page]` | `DOMContentLoaded.onclick` | ✅ 正常 | 全部10个页面(含baidu/douyin/xianyu) |
| `menu-toggle` | `DOMContentLoaded.onclick` | ✅ 正常 | 移动端侧边栏切换 |
| `theme-toggle` | `DOMContentLoaded.onclick` | ✅ 正常 | 亮暗切换 |
| `[data-nav="new"]` | `DOMContentLoaded.onclick` | ✅ 正常 | 快捷新增客户弹窗 |
| `btn-sidebar-logout` | `DOMContentLoaded.onclick` (带 null guard) | ✅ 正常 | 登出+停自动保存 |
| `sidebar-user-avatar` | `DOMContentLoaded.onclick` | ✅ 正常 | 触发文件选择上传头像 |
| `avatar-file-input` | `DOMContentLoaded.onchange` | ✅ 正常 | 头像裁剪+base64存储 |

### 2.4 客户列表页

| 按钮 | 绑定方式 | 状态 | 备注 |
|------|---------|------|------|
| `btn-new-customer` | `DOMContentLoaded.onclick` | ✅ 正常 | 新增客户弹窗 |
| `btn-apply-filter` | `DOMContentLoaded.onclick` | ✅ 正常 | 读取6个筛选项→applyListFilters→render |
| `btn-reset-filter` | `DOMContentLoaded.onclick` | ✅ 正常 | 清空DOM+listState→render |
| `page-size` | `DOMContentLoaded.onchange` | ✅ 正常 | 切换每页条数 |
| `btn-prev-page` | `DOMContentLoaded.onclick` | ✅ 正常 | 有 page>1 守卫 |
| `btn-next-page` | `DOMContentLoaded.onclick` | ✅ 正常 | 有 page<pageCount 守卫 |
| `th[data-sort]` | `DOMContentLoaded.onclick` | ✅ 正常 | 切换排序方向 |
| `check-all` | `DOMContentLoaded.onchange` | ✅ 正常 | 全选/取消 |
| `btn-batch-delete` | `DOMContentLoaded.onclick` | ✅ 正常 | confirmDialog + promptPassword 双重验证 |
| `[data-act="view"]` | 动态 `onclick` (renderCustomerTable) | ✅ 正常 | 详情弹窗 |
| `[data-act="edit"]` | 动态 `onclick` (renderCustomerTable) | ✅ 正常 | 编辑客户弹窗 |
| `[data-act="follow"]` | 动态 `onclick` (renderCustomerTable) | ✅ 正常 | 跟进记录弹窗 |
| `[data-act="del"]` | 动态 `onclick` (renderCustomerTable) | ✅ 正常 | 删除选择弹窗(作废/彻底) |
| `btn-add-to-channel` | `DOMContentLoaded.onclick` | ✅ 正常 | 支持6渠道多选，兼容新旧channel字段 |

### 2.5 客户详情弹窗（openCustomerDetail）

| 按钮 | 绑定方式 | 状态 | 备注 |
|------|---------|------|------|
| 关闭按钮 | `footer.onclick` (closeModal) | ✅ 正常 | 有 `_restoreStatPopup` 支持 |
| `editDetail` | `footer.onclick` | ✅ 正常 | closeModal→openCustomerForm |
| `exportOne` | `footer.onclick` | ✅ 正常 | ✅ 文件名安全过滤 `.replace()` |
| `delDetail` | `footer.onclick` | ✅ 正常 | confirmDialog→promptPassword 双重验证 |
| `.timeline-thumb` | `onOpen` setter | ✅ 正常 | 图片查看器 |

### 2.6 客户表单弹窗（openCustomerForm）

| 按钮 | 绑定方式 | 状态 | 备注 |
|------|---------|------|------|
| 重置`btnR` | `footer.onclick` | ✅ 正常 | 还原全部字段+标签+渠道 |
| 取消`btnC` | `footer.onclick` | ✅ 正常 | closeModal |
| 保存`btnS` | `footer.onclick` | ✅ 正常 | 必填校验+实体转义+保存+跳转 |
| `.form-section-header` | `addEventListener('click')` | ✅ 正常 | ✅ 比之前 `.onclick` 防覆盖 |
| `.tag-chip` | 动态 `onclick` | ✅ 正常 | 标签选择切换 |
| `.channel-checkbox-label` | 动态 `addEventListener` | ✅ 正常 | 复选框联动样式 |
| `.image-preview-del` | 动态 `onclick` | ✅ 正常 | 删除已上传截图 |

### 2.7 渠道页面

| 页面 | 按钮 | 状态 | 备注 |
|------|------|------|------|
| geo/360/bing/baidu/douyin/xianyu | `[data-act="view/edit"]` | ✅ 正常 | 使用 `hasChannel()` 兼容新旧字段 |

### 2.8 作废页（trash）

| 按钮 | 绑定方式 | 状态 | 备注 |
|------|---------|------|------|
| `[data-act="restore"]` | 动态 `onclick` | ✅ 正常 | 恢复客户，clear selected |
| `[data-act="purge"]` | 动态 `onclick` | ✅ 正常 | confirmDialog 二次确认 |

### 2.9 BI 看板

| 按钮 | 绑定方式 | 状态 | 备注 |
|------|---------|------|------|
| `btn-report-daily` | `DOMContentLoaded.onclick` | ✅ 正常 | 生成日报 |
| `btn-report-weekly` | `DOMContentLoaded.onclick` | ✅ 正常 | 生成周报 |
| `btn-report-monthly` | `DOMContentLoaded.onclick` | ✅ 正常 | 生成月报 |
| `btn-report-export` | `DOMContentLoaded.onclick` | ✅ 正常 | 导出 txt |
| `.bi-collapse-btn` | 事件委托 `document.addEventListener('click')` | ✅ 正常 | 折叠 BI 区块 |
| 图表拖动 | 事件委托(drag/dragover) | ✅ 正常 | 拖拽排序 + localStorage 持久化 |
| `.stat-card` | `addEventListener('click')` (renderDashboard) | ✅ 正常 | 弹出统计浮层 |
| `stat-popup-close` | `DOMContentLoaded.onclick` | ✅ 正常 | |
| `stat-popup-overlay` | `DOMContentLoaded.onclick` | ✅ 正常 | |
| `stat-popup-item` | 动态 `addEventListener` | ✅ 正常 | 点客户名→详情弹窗 |
| `customer-float-close` | `DOMContentLoaded.onclick` | ✅ 正常 | |
| `customer-float-overlay` | `DOMContentLoaded.onclick` | ✅ 正常 | |
| `float-close-btn` | 动态 `onclick` | ✅ 正常 | |
| `float-detail-btn` | 动态 `onclick` | ✅ 正常 | 跳转完整详情 |

### 2.10 设置页（settings）

| 按钮 | 绑定方式 | 状态 | 备注 |
|------|---------|------|------|
| `.frequency-option` | `renderSettingsPage()` 动态绑定 | ✅ 正常 | 跟进频率选择 |
| `btn-new-tag` | `renderSettingsPage()` 动态绑定 | ✅ 正常 | 新增标签弹窗 |
| `btn-new-level` | `renderSettingsPage()` 动态绑定 | ✅ 正常 | 新增等级弹窗 |
| `btn-new-source` | `renderSettingsPage()` 动态绑定 | ✅ 正常 | 新增来源弹窗 |
| 标签 `editBtn` | `renderTagsList()` 动态绑定 | ✅ 正常 | 编辑标签弹窗 |
| 标签 `delBtn` | `renderTagsList()` 动态绑定 | ✅ 正常 | 有 `used` 检查 |
| 等级 `editBtn` | `renderLevelsList()` 动态绑定 | ✅ 正常 | |
| 等级 `delBtn` | `renderLevelsList()` 动态绑定 | ✅ 正常 | 有 `used` 检查 |
| 来源 `editBtn` | `renderSourcesList()` 动态绑定 | ✅ 正常 | |
| 来源 `delBtn` | `renderSourcesList()` 动态绑定 | ✅ 正常 | 有 `used` 检查 |

### 2.11 数据安全页（security）

| 按钮 | 绑定方式 | 状态 | 备注 |
|------|---------|------|------|
| `qa-backup` | `DOMContentLoaded.onclick` | ✅ 正常 | 导出加密备份 |
| `qa-export` | `DOMContentLoaded.onclick` | ✅ 正常 | promptPassword 密码验证后导出 |
| `qa-import` | `DOMContentLoaded.onclick` | ✅ 正常 | CSV 解析+通道映射+手机号去重 |
| `qa-sync` | `DOMContentLoaded.onclick` | ✅ 正常 | 有 API 支持检查 |
| `btn-select-folder` | `DOMContentLoaded.onclick` | ✅ 正常 | |
| `btn-sync-now` | `DOMContentLoaded.onclick` | ✅ 正常 | |
| `btn-change-folder` | `DOMContentLoaded.onclick` | ✅ 正常 | |
| `btn-revoke-folder` | `DOMContentLoaded.onclick` | ✅ 正常 | |
| `btn-export-encrypted` | `DOMContentLoaded.onclick` | ✅ 正常 | |
| `btn-import-encrypted` | `DOMContentLoaded.onclick` | ✅ 正常 | 手机号去重合并 |
| `btn-export-masked` | `DOMContentLoaded.onclick` | ✅ 正常 | |
| `btn-export-plain` | `DOMContentLoaded.onclick` | ✅ 正常 | promptPassword 二次验证 |
| `btn-rollback` | `DOMContentLoaded.onclick` | ✅ 正常 | confirmDialog + promptPassword |
| `btn-reset-data` | `DOMContentLoaded.onclick` | ✅ 正常 | confirmDialog + promptPassword + 文件夹清理 |
| `btn-change-password` | `DOMContentLoaded.onclick` | 🟠 | **sessionStorage 未同步更新 (上一轮 N8)** |
| `btn-export-log` | `DOMContentLoaded.onclick` | ✅ 正常 | |
| `btn-reset-pw-by-sq-settings` | **脚本顶层** `.onclick` (带 null guard) | ✅ 正常 | 密保存在检查 |
| `btn-reset-pw-by-cur-pw-settings` | **脚本顶层** `.onclick` (带 null guard) | ✅ 正常 | 当前密码验证弹窗 |
| `btn-reset-pw-by-gesture-settings` | **脚本顶层** `.onclick` (带 null guard) | ✅ 正常 | 手势验证弹窗 |
| `btn-gesture-setup-settings` | **脚本顶层** `.onclick` | ✅ 正常 | 手势设置弹窗 |

### 2.12 脚本顶层绑定（手势+密保设置，带 null guards）

| 按钮 | 绑定方式 | 状态 | 备注 |
|------|---------|------|------|
| `btn-gesture-save` | 脚本顶层 `.onclick` | ✅ 正常 | 静态 HTML (行3033) |
| `btn-gesture-reset` | 脚本顶层 `.onclick` | ✅ 正常 | 静态 HTML (行3032) |
| `btn-gesture-clear` | 脚本顶层 `.onclick` | ✅ 正常 | 静态 HTML (行3043) |
| `btn-gesture-reset-all` | 脚本顶层 `.onclick` | ✅ 正常 | 静态 HTML (行3044) |
| `btn-sq-save` | 脚本顶层 `.onclick` (带 null guard) | ✅ 正常 | 静态 HTML (行3080) |
| `btn-sq-cancel` | 脚本顶层 `.onclick` (带 null guard) | ✅ 正常 | 静态 HTML (行3079) |
| `btn-sq-clear` | 脚本顶层 `.onclick` (带 null guard) | ✅ 正常 | 静态 HTML (行3092) |
| `btn-sq-edit` | 脚本顶层 `.onclick` (带 null guard) | ✅ 正常 | 静态 HTML (行3093) |

### 2.13 模态内部按钮（有缺陷）

| 按钮 id | 所在函数 | 渲染方式 | 状态 | 原因 |
|---------|---------|---------|------|------|
| `btn-do-reset-pw` | `openResetPwByGestureDialog()` | `footerHTML:` ❌ | 🔴 **失效** | openModal 不识别的参数 |
| `btn-sq-verify` | `openResetBySecurityQuestionsDialog()` | `footerHTML:` ❌ | 🔴 **失效** | 同上 |
| `btn-do-reset-pw-final` | `openSetNewPasswordDialog()` | `footerHTML:` ❌ | 🔴 **失效** | 同上 |
| `btn-verify-cur-pw` | `btnResetByCurPw.onclick` 内 | `footerHTML:` ❌ | 🔴 **失效** | 同上 |

---

## 三、动态 = 模态按钮执行流程跟踪

### 场景 A：设置→手势重置密码

```
用户点击 btn-reset-pw-by-gesture-settings
  → openResetByGestureDialog()
    → openModal({footerHTML: ''})  ← 空footerHTML被忽略(不报错)
    → 手势验证成功
      → closeModal()
        → openResetPwByGestureDialog()
          → openModal({footerHTML: '<button id="btn-do-reset-pw">'})
            ↑ footerHTML 被忽略 → 按钮不渲染
          → document.getElementById('btn-do-reset-pw') = null
          → null.onclick = fn → TypeError! ❌🔴
```

### 场景 B：设置→密保重置密码

```
用户点击 btn-reset-pw-by-sq-settings
  → openResetBySecurityQuestionsDialog()
    → openModal({footerHTML: '<button id="btn-sq-verify">'})
      ↑ footerHTML 被忽略 → 按钮不渲染
    → document.getElementById('btn-sq-verify') = null
    → null.onclick = fn → TypeError! ❌🔴
```
即使上面的不抛异常，密保答案正确后：
  → openSetNewPasswordDialog()
    → openModal({footerHTML: '<button id="btn-do-reset-pw-final">'})
      ↑ footerHTML 被忽略
    → document.getElementById('btn-do-reset-pw-final') = null
    → TypeError! ❌🔴

### 场景 C：设置→当前密码重置

```
用户点击 btn-reset-pw-by-cur-pw-settings
  → openModal({footerHTML: '<button id="btn-verify-cur-pw">'})
    ↑ footerHTML 被忽略
  → document.getElementById('btn-verify-cur-pw') = null
  → TypeError! ❌🔴
```

---

## 四、其他细节问题

### 🟡 4.1 `openResetByGestureDialog()` 内部的 `footerHTML: ''`

行 9730: 此模态框**不需要按钮**（手势验证后自动进入下一步），所以空 footerHTML 不影响功能。但参数仍然被忽略，技术上无影响。

### 🟠 4.2 `btn-change-password` 修改密码后 sessionStorage 未更新

上一轮已报（N8），仍存在：
```javascript
// ok.onclick 末尾缺少这一行：
sessionStorage.setItem('crm_session_pw', _obfuscatePw(np));
```
修改密码后 sessionStorage 持有旧密码 XOR → 页面刷新 → 旧密码解密新加密数据 → 失败 → 回到登录页。

### 🟡 4.3 `.onclick` 赋值方式的安全隐患

约 60% 的按钮使用 `.onclick = handler` 赋值方式。如果任何代码在之后覆盖了同一个元素的 onclick，前一个绑定丢失。目前代码库中没有二次绑定的情况（除 `btn-forgot` 外），但建议逐步迁移到 `addEventListener`。

### 🟡 4.4 `btn-lock-lockout` 密码锁定计数重置漏洞

锁屏密码错误 5 次后调用 `initAuthPage()`（回到登录页），`unlockFailCount` 重置为 0。攻击者可以永远尝试 5 次→回到登录页→再 5 次，无限制暴力破解。

---

## 五、修复优先级

| 优先级 | 问题 | 修复难度 |
|--------|------|---------|
| 🔴 P0 | 4个 `footerHTML` 导致密码重置/验证按钮永久失效 | 1 行改法：将 `footerHTML: ...` 改为 `footer: (f) => { f.innerHTML = '...' }` |
| 🟠 P1 | `btn-change-password` sessionStorage 未更新 | 加 1 行 |
| 🟡 P3 | `.onclick` 可被覆盖风险 | 批量替换为 `addEventListener` |
| 🟡 P3 | 锁屏暴力破解无硬限制 | 在 sessionStorage 中持久化 failCount |

---

## 六、结论

| 类别 | 数量 |
|------|------|
| ✅ 正常按钮 | ~70 个 |
| 🔴 彻底失效按钮 | **4 个** (全部是 modal 中使用 `footerHTML` 参数) |
| 🟠 功能降级按钮 | 1 个 (`btn-change-password` sessionStorage 未同步) |
| 🟡 体验问题 | 3 项 |

**所有常规流程按钮（登录、导航、客户增删改查、BI看板、设置、导出）均正常工作。**

**断裂点全部集中在「密码重置」子系统中**：手势重置、密保重置、当前密码重置这 3 条分支因为 `footerHTML` 参数不匹配无法渲染确认按钮，是同一个根因导致的连锁故障。修复方式统一且在 `openModal` 函数上加一行兜底兼容或改 4 处 `footerHTML` 为 `footer` 回调即可。
