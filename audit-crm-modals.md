# CRM 浮层弹窗可编辑选项保存逻辑审计报告

审计对象：`D:\GitHub-tongbuwenjianjia\CRMsystem\CRMsystem\index.html`
审计时间：2026-06-24

---

## 1. 客户池详情（openPoolCustomerDetail）— 第 6001 行

### 1.1 跟进记录时间线是否支持图片显示

**结论：❌ 不支持图片显示**

时间线渲染代码（第 6046-6052 行）仅渲染 `r.text`，完全没有读取或渲染 `r.images`字段：

```js
for (const r of c.remarkHistory) {
    html += `<div class="timeline-item">
      <div class="timeline-time">${formatDate(r.time)}</div>
      <div class="timeline-content">${escapeHTML(r.text)}</div>
    </div>`;
}
```

对比主客户详情（openCustomerDetail 第 7005-7016 行）和存量客户详情（stock detail 第 6629-6641 行）均有 `r.images` 的 `timeline-thumb` 渲染和 `openImageViewer` 绑定，**客户池详情缺失此功能**。

### 1.2 删除操作是否有 promptPassword() 二次验证

**结论：❌ 无 promptPassword 二次验证**

删除按钮绑定代码（第 6133-6141 行）：

```js
document.getElementById('poolDelDetail').onclick = () => {
    confirmDialog('删除客户', '确认删除客户 "' + c.name + '" ？操作不可恢复。', true, async () => {
        Store.data.poolCustomers = Store.data.poolCustomers.filter(x => x.id !== c.id);
        await Store.save();  // ⚠ 使用的是 Store.save() 而非 Store.saveWithLog()
        Store.markDirty();
        showToast('已删除', 'success');
        closeModal();
        renderPoolTable();
    });
};
```

- 仅有 `confirmDialog` 确认框，无 `promptPassword()` 二次密码验证
- 使用 `Store.save()` 而非 `Store.saveWithLog()`，**缺少操作日志记录**
- 对比主客户详情（openCustomerDetail 第 7050 行）和存量客户详情（stock detail 第 6664 行）均调用了 `promptPassword()`，**客户池详情存在安全薄弱点**

### 1.3 编辑按钮是否正确打开 openPoolCustomerForm

**结论：✅ 正确**

```js
document.getElementById('poolEditDetail').onclick = () => {
    closeModal();
    setTimeout(() => openPoolCustomerForm(c), 10);
};
```

延迟 10ms 关闭后打开编辑表单，逻辑正确。

### 1.4 导出按钮

```js
document.getElementById('poolExportOne').onclick = () => {
    const rows = buildExcelData([c], true);
    downloadExcel(`${c.name}_客户池客户资料.xlsx`, '客户资料', rows);
};
```
✅ 导出自定义函数 `buildExcelData`，输出完整。

---

## 2. 主客户详情（openCustomerDetail）— 第 6956 行

### 2.1 跟进记录时间线是否正确显示图片缩略图

**结论：✅ 支持图片显示**

渲染代码（第 7004-7016 行）：

```js
for (const r of c.remarkHistory) {
    let imgHtml = '';
    if (r.images && r.images.length) {
        imgHtml = `<div class="timeline-images">${r.images.map((img, idx) =>
            `<img class="timeline-thumb" src="${escapeHTML(img.dataUrl)}" alt="截图" data-img-src="${escapeHTML(img.dataUrl)}">`
        ).join('')}</div>`;
    }
    html += `<div class="timeline-item">
      <div class="timeline-time">${formatDate(r.time)}</div>
      <div class="timeline-content">${escapeHTML(r.text)}</div>
      ${imgHtml}
    </div>`;
}
```

并在 onOpen 回调中绑定了 `openImageViewer` 点击事件（第 7022-7024 行）。

### 2.2 编辑按钮是否打开 openCustomerForm

**结论：✅ 正确（含存量路由）**

代码（第 7033-7041 行）：先检查客户是否属于品牌/企服/服务费/存量列表，若是则路由到 `openStockCustomerForm`，否则走 `openCustomerForm`。

### 2.3 导出按钮是否导出正确数据

**结论：✅ 正确**

```js
document.getElementById('exportOne').onclick = () => {
    const rows = buildExcelData([c], true);
    downloadExcel(`${c.name}_客户资料.xlsx`, '客户资料', rows);
};
```

### 2.4 删除按钮是否有 promptPassword() 二次验证

**结论：✅ 有 promptPassword 二次验证**

```js
confirmDialog('删除客户', '确认删除客户 "' + c.name + '" ？操作不可恢复。', true, async () => {
    promptPassword('二次验证', '请输入解锁密码以确认删除', async () => {
        Store.data.customers = Store.data.customers.filter(x => x.id !== c.id);
        await Store.saveWithLog('删除客户', '客户：' + c.name);
        // ...
    });
});
```

双层防护：confirmDialog + promptPassword，且有 `saveWithLog` 操作日志。

---

## 3. 主客户表单（openCustomerForm）— 第 4255 行

### 3.1 所有字段列表

**基础信息（必填）区块：**

| Key | Label | Type | 必填 | 备注 |
|-----|-------|------|------|------|
| name | 姓名 | text | ✅ | max:50 |
| company | 公司名称 | text | ❌ | max:100 |
| gender | 性别 | select | ❌ | 选项: '' / 男 / 女 / 其他 |
| age | 年龄 | number | ❌ | max:3 |
| phone | 手机号 | text | ❌ | max:11 |
| wechat | 微信 | text | ❌ | max:50 |
| email | 邮箱 | email | ❌ | max:80 |
| source | 客户来源 | select | ❌ | 动态选项 |
| channels | 所属渠道（可多选）| checkbox-group | ❌ | geo/360/bing/baidu/douyin/xianyu |

**业务信息区块：**

| Key | Label | Type | 必填 | 备注 |
|-----|-------|------|------|------|
| product | 意向产品 | text | ❌ | max:100 |
| budget | 预算范围 | text | ❌ | max:50 |
| amount | 预计金额(元) | number | ❌ | max:10 |
| status | 成交状态 | select | ❌ | 未沟通/跟进中/已成交/流失 |
| nextFollowDate | 下次跟进日期 | date | ❌ | |
| website | 客户网址 | text | ❌ | max:200 |
| industryLevel1 | 一级行业 | select-industry | ❌ | 联动二级行业 |
| industryLevel2 | 二级行业 | select-industry2 | ❌ | 联动自一级行业 |
| platforms | 客户在投平台（可多选）| checkbox-group-platform | ❌ | 360/百度/必应/GEO/抖音/小红书/腾讯/闲鱼 |
| tags | 客户标签 | chip-click | ❌ | 老客户/新客户（默认预设） |

**联系地址区块：**

| Key | Label | Type | 必填 | 备注 |
|-----|-------|------|------|------|
| province | 省/直辖市 | text | ❌ | max:30 |
| city | 城市 | text | ❌ | max:30 |
| district | 区/县 | text | ❌ | max:30 |
| address | 详细住址 | textarea | ❌ | max:200 |

**沟通备注区块：**

| Key | Label | Type | 必填 | 备注 |
|-----|-------|------|------|------|
| remark | 新增跟进备注 | textarea | ❌ | max:500 |
| (images) | 截图保存 | image-dropzone | ❌ | 粘贴/拖拽图片 |

### 3.2 字段验证（保存逻辑第 4655-4662 行）

```js
const errors = [];
if (!d.name || !d.name.trim()) errors.push('姓名不能为空');
if (d.phone && !validatePhone(d.phone)) errors.push('手机号格式不正确（11位数字）');
if (d.idcard && !validateIdCard(d.idcard)) errors.push('身份证号格式不正确');
if (d.email && !validateEmail(d.email)) errors.push('邮箱格式不正确');
if (d.age && !validateAge(d.age)) errors.push('年龄需为 0-120 的数字');
if (errors.length) { showToast(errors[0], 'error'); return; }
```

验证函数（第 4130-4133 行）：
- `validatePhone`: `/^1[3-9]\d{9}$/` — 严格手机号格式
- `validateEmail`: `/^[\w.+-]+@[\w-]+\.[\w.-]+$/` — 基本邮箱格式
- `validateAge`: `/^\d+$/ && >=0 && <=120`
- `validateIdCard`: `/^\d{17}[\dXx]$/`

**注意事项：**
- 只有 `name` 是必填字段，且仅做空字符串检查
- 手机号、邮箱、年龄均为可选（空值跳过验证）
- **没有 `amount` 金额字段的验证**，不检查是否为有效数字
- **没有 `website` 网址格式验证**
- **没有 `wechat` 微信号格式验证**

### 3.3 是否允许客户标签选择

**结论：✅ 允许**

在业务信息区块尾部渲染标签选择器（第 4399-4411 行），支持点击切换选中状态，data-selected 控制选中态。选中后保存到 `d.tags` 数组（collect 函数第 4549-4552 行）。

### 3.4 是否允许客户在投平台选择

**结论：✅ 允许**

在业务信息区块渲染 `checkbox-group-platform`（第 4365-4397 行），支持 360/百度/必应/GEO/抖音/小红书/腾讯/闲鱼 多选。选中后保存到 `d.platforms` 数组（collect 函数第 4553-4556 行）。

在 `_currentChannel` 模式下，平台复选框被设为 `disabled`（第 4378 行），不可修改。

### 3.5 保存逻辑分析

- **HTML 转义**：除 `remark`、`remarkHistory`、`images` 外的字段都经过 `escapeHTML()` 转义（第 4662-4667 行）
- **编辑模式**：`_currentChannel` 模式下将渠道专属字段写入 `channelData`；非渠道模式下直接覆盖主对象字段
- **新增模式**：创建对象包含 `channels`、`platforms`、`remarkHistory: []` 默认值
- **跟进记录图片**：非渠道模式下使用 `formImages.slice()` 随 remark 一起保存到 `remarkHistory`；渠道模式下调用 `addChannelRemark(old, channel, text, formImages.slice())` 传递图片
- **⚠ 新旧 channel 字段清理**：保存时将旧 `c.channel` 删除（第 4701-4702 行），统一为 `c.channels` 数组
- **草稿自动保存**：localStorage 草稿保存（第 4540-4546 行），保存成功后清除（第 4704 行）

---

## 4. 存量客户表单（openStockCustomerForm）— 第 6704 行

### 4.1 所有字段列表

**基础信息区块：**

| Key | Label | Type | 必填 | 备注 |
|-----|-------|------|------|------|
| cid | 账户ID | text | ❌ | max:50 |
| accountName | 账户名称 | text | ❌ | max:100 |
| name | 联系人 | text | ✅ | max:50 |
| phone | 联系电话 | text | ❌ | max:11 |
| wechat | 微信号 | text | ❌ | max:50 |
| company | 公司名称 | text | ❌ | max:100 |
| consultant | 对应顾问 | text | ❌ | max:50 |

**业务信息区块：**

| Key | Label | Type | 必填 | 备注 |
|-----|-------|------|------|------|
| industryLevel1 | 一级行业 | select-industry | ❌ | |
| industryLevel2 | 二级行业 | select-industry2 | ❌ | 联动一级 |
| website | 网站URL | text | ❌ | max:200 |
| accountOpenDate | 开户日期 | date | ❌ | |
| source | 客户来源 | select | ❌ | |
| level | 客户等级 | select | ❌ | 模块专属（channelData）|
| status | 成交状态 | select | ❌ | 模块专属（channelData）|
| product | 意向产品 | select-product | ❌ | 从 productTags 动态加载 |
| budget | 预算范围 | text | ❌ | max:50 |
| amount | 预计金额(元) | number | ❌ | 模块专属（channelData）|
| nextFollowDate | 下次跟进日期 | date | ❌ | 模块专属（channelData）|
| platforms | 客户在投平台 | checkbox-group-platform | ❌ | |

**联系地址区块：** 同主客户表单（province/city/district/address）

**客户标签区块：** 标签多选，模块专属（channelData）

**沟通备注区块：** remark textarea（max:500）

### 4.2 字段验证

**结论：⚠ 验证严重不足**

保存逻辑（第 6912-6935 行）**完全没有字段验证**。对比主客户表单，这里缺失：
- ❌ 无 `name` 必填检查
- ❌ 无 `phone` 格式验证
- ❌ 无 `email` 格式验证
- ❌ 无 `age` 范围验证
- 直接 `Object.assign(c, updates)` 合并数据

```js
// 收集表单数据
const updates = {};
document.querySelectorAll('[data-key]').forEach(el => { ... });
// 直接更新，无任何验证
Object.assign(c, updates);
```

### 4.3 保存逻辑分析

- **渠道数据处理**：level、status、amount、nextFollowDate、tags 通过 `setChannelField()` 写入 `channelData[module]`
- **跟进记录**：`addChannelRemark(c, module, updates.remark.trim())` 写入模块专属的 `remarkHistory`
- **⚠ 无 HTML 实体转义**：所有字段原样写入，未调用 `escapeHTML()`
- **新增客户**：如无 cid 自动生成，remarkHistory 初始化为空数组，推入 `Store.data[dataKey]`
- **同步问题**：`Object.assign(c, updates)` 将模块专属字段（level、status、amount）覆盖到客户对象顶层，同时又通过 `setChannelField` 同步到 `channelData`。**可能导致数据冗余和一致性风险**（两处分存同样的值）
- **支持图片**：`addChannelRemark` 虽然接收 `images` 参数，但存量表单的 remark 保存调用 `addChannelRemark(c, module, updates.remark.trim())` **没有传 images 参数**，因此图片参数为空数组 `[]`，**相当于不支持图片上传**。

---

## 5. 客户池表单（openPoolCustomerForm）— 第 5838 行

### 5.1 是否有 company 字段

**结论：✅ 有**

在基础信息区块的第 2 个字段：`{ key: 'company', label: '公司名称', type: 'text', max: 100 }`。

### 5.2 所有字段列表

**基础信息区块：**

| Key | Label | Type | 必填 | 备注 |
|-----|-------|------|------|------|
| name | 姓名 | text | ✅ | max:50 |
| company | 公司名称 | text | ❌ | max:100 |
| gender | 性别 | select | ❌ | |
| age | 年龄 | number | ❌ | max:3 |
| phone | 手机号 | text | ❌ | max:11 |
| wechat | 微信 | text | ❌ | max:50 |
| email | 邮箱 | email | ❌ | max:80 |
| source | 客户来源 | select | ❌ | 动态选项 |

**业务信息区块：**

| Key | Label | Type | 必填 |
|-----|-------|------|------|
| product | 意向产品 | text | ❌ |
| budget | 预算范围 | text | ❌ |
| status | 成交状态 | select | ❌ |
| nextFollowDate | 下次跟进日期 | date | ❌ |
| website | 客户网址 | text | ❌ |
| industryLevel1 | 一级行业 | select-industry | ❌ |
| industryLevel2 | 二级行业 | select-industry2 | ❌ |

**联系地址区块：** 同主客户表单

**沟通备注区块：** remark textarea（max:500）

### 5.3 保存逻辑分析

**结论：⚠ 功能显著简化**

与主客户表单的差异：
1. **❌ 无 tags 标签选择** — 字段定义中未包含 tags
2. **❌ 无 channels 渠道选择** — 客户池不需要渠道
3. **❌ 无 platforms 在投平台选择** — 客户池不需要平台
4. **❌ 无 amount 金额字段**
5. **❌ 无图片上传支持** — 没有 image-dropzone 渲染，remark 保存不传递 images
6. **❌ 备注 HTML 不转义** — `noEscapeKeys` 只包含 `['remark']`（第 5962 行），备注不转义但同步也无需转义。不过相比主客户表单，这里更简洁
7. **✅ 字段验证正确**：检查 name/phone/email/age（第 5954-5960 行）
8. **⚠ 使用 Store.save() 而非 saveWithLog()** — 客户池的所有保存操作（新增+编辑）都使用的是 `Store.save()`，**缺少操作日志记录**
9. **❌ 无草稿自动保存机制**

---

## 6. 跟进记录（addChannelRemark / follow 功能）

### 6.1 跟进记录是否支持图片上传

**结论：分场景**

| 场景 | 支持图片？ | 实现方式 |
|------|-----------|----------|
| 主客户表单（新增/编辑）| ✅ | `formImages.slice()` → `remarkHistory.images` |
| 渠道编辑表单（_currentChannel）| ✅ | `formImages.slice()` → `addChannelRemark(c, ch, text, images)` |
| 渠道列表「跟进」快捷按钮 | ❌ | 纯文本框，无图片上传 |
| 主客户列表「跟进」快捷按钮 | ❌ | 纯文本框，无图片上传 |
| 客户池表单 | ❌ | 无 image-dropzone 渲染 |
| 存量客户表单 | ❌ | 调用 `addChannelRemark(c, module, text)` 未传 images 参数 |
| 跟进弹窗（follow 模式）| ❌ | 仅 textarea，无图片上传 |

### 6.2 跟进记录保存后是否正确更新 remarkHistory

**结论：✅ 正确**

`addChannelRemark` 函数（第 4765-4768 行）：

```js
function addChannelRemark(c, channel, text, images) {
  const cd = ensureChannelData(c, channel);
  cd.remarkHistory = cd.remarkHistory || [];
  cd.remarkHistory.unshift({ time: Date.now(), text, images: images || [] });
  cd.lastRemark = text;
}
```

渠道模式下，remark 写入 `channelData[channel].remarkHistory`（unshift 最新在前）。

非渠道模式下（主表单编辑），直接写入 `c.remarkHistory`（unshift）。

### 6.3 图片上传后的存储格式和显示逻辑

**存储格式**（第 4485 行）：

```js
formImages.push({ id, dataUrl, name: '截图_' + new Date().toLocaleString('zh-CN') });
```

- `id`: 随机 UUID
- `dataUrl`: base64 编码的图片数据（`data:image/...` 格式）
- `name`: 截图时间戳文件名

**显示流程**：
1. 表单内：`image-preview-area` 生成 \<img> 标签显示缩略图（第 4489 行）
2. 时间线渲染：`timeline-thumb` 80x60 px 缩略图（CSS 第 2098-2100 行）
3. 点击放大：`openImageViewer(dataUrl)` 全屏查看（第 7023 行、第 10280-10283 行）

**⚠ 风险提示**：base64 dataUrl 存储在 `remarkHistory.images` 中，所有数据随 `Store.data` 序列化到 localStorage（`Store.save()` 调用 `localStorage.setItem(...)`）。base64 编码图片**体积可膨胀 33%**，大量图片可能导致 localStorage 5MB 配额溢出。

---

## 总结：安全与功能弱点矩阵

| 弹窗 | Images in Timeline | promptPassword 删除 | Image Upload | Field Validation | HTML Escape | saveWithLog | 草稿保存 |
|------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 主客户详情 | ✅ | ✅ | — | — | — | — | — |
| 主客户表单 | ⚠（表单内无缩略图）| — | ✅ | ✅ | ✅ | ✅ | ✅ |
| 客户池详情 | ❌ | ❌ | — | — | — | ❌ | — |
| 客户池表单 | — | — | ❌ | ✅ | ✅ | ❌ | ❌ |
| 存量客户详情 | ✅ | ✅ | — | — | — | ✅ | — |
| 存量客户表单 | — | — | ❌ | ❌ | ❌ | ✅ | ❌ |
| 渠道跟进弹窗 | — | — | ❌ | ✅ (仅空检查) | — | — | — |

**关键风险（按严重度排序）：**

1. **🔴 客户池详情删除无 promptPassword** — 任意获得访问权限者可删除客户池数据且无操作日志
2. **🔴 存量客户表单零验证** — name/phone/email/age 等字段无任何验证即可保存
3. **🟡 客户池表单无 saveWithLog** — 所有修改无操作审计记录
4. **🟡 存量表单同步覆盖风险** — `Object.assign(c, updates)` 将模块专属字段同时写入顶层和 `channelData`，可能不一致
5. **🟡 客户池详情无图片时间线** — 与主客户/存量客户功能不一致
6. **🟡 localStorage base64 存储风险** — 所有图片以 base64 编码存储在 localStorage 中，5MB 配额容易超标
