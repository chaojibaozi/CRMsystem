# CRM 按钮绑定与页面交互逻辑审计报告

**审计范围**: `index.html` 687KB
**审计目标**: DOMContentLoaded 中所有 `document.getElementById().onclick` / `.onchange` 与 HTML id 的对应关系、事件委托正确性

---

## 一、DOMContentLoaded 块范围

实际代码: `document.addEventListener('DOMContentLoaded', function () {` 位于 **行 12325**
块内部绑定持续到约 **行 13140+**（含报表按钮等），远超预估的 12840-13100。

---

## 二、客户池页面 (page-pool)

### ✅ 正确绑定的按钮

| JS 绑定 ID | HTML 行 | JS 绑定行 | 状态 |
|---|---|---|---|
| `pool-btn-apply-filter` | 2756 | 12852 | ✅ 匹配 |
| `pool-btn-reset-filter` | 2757 | 12860 | ✅ 匹配 |
| `pool-btn-new-customer` | 2758 | 12868 | ✅ 匹配 |
| `pool-page-size` | 2785 | 12869 | ✅ 匹配（onchange） |
| `pool-btn-prev-page` | 2791 | 12870 | ✅ 匹配 |
| `pool-btn-next-page` | 2793 | 12871 | ✅ 匹配 |
| `pool-btn-batch-delete` | 2760 | 12885 | ✅ 匹配 |
| `pool-btn-transfer` | 2759 | 12897 | ✅ 匹配 |
| `pool-customer-table` | 2765 | 12876 | ✅ 匹配（click 委托排序） |
| `pool-check-all` | 2768 | 5823 | ✅ 匹配（onchange） |
| `pool-filter-source` | 2742 | 5667/12854 | ✅ 匹配 |
| `pool-filter-date-start` | 2748 | 12855 | ✅ 匹配 |
| `pool-filter-date-end` | 2752 | 12856 | ✅ 匹配 |
| `pool-filter-keyword` | 2738 | 12853 | ✅ 匹配 |

### ❌ 不存在的按钮

| 要求检查的 ID | 实际状态 |
|---|---|
| `pool-btn-export` | **不存在于 HTML 也无 JS 绑定**。客户池无独立导出按钮，需通过"数据与安全 → 数据下载"页面导出 |
| `pool-btn-export` (无) | 导出由数据下载页统一处理 |

---

## 三、主客户列表页面 (page-list)

### ✅ 正确绑定的按钮

| JS 绑定 ID | HTML 行 | JS 绑定行 | 状态 |
|---|---|---|---|
| `btn-apply-filter` | 2823 | 12798 | ✅ 匹配 |
| `btn-reset-filter` | 2824 | 12806 | ✅ 匹配 |
| `btn-new-customer` | 2825 | 12814 | ✅ 匹配 |
| `page-size` | 2853 | 12815 | ✅ 匹配（onchange） |
| `btn-prev-page` | 2859 | 12816 | ✅ 匹配 |
| `btn-next-page` | 2861 | 12817 | ✅ 匹配 |
| `customer-table` | 2833 | 12823 | ✅ 匹配（click 委托排序） |
| `check-all` | 2836 | 5610 | ✅ 匹配（onchange） |
| `btn-customize-columns` | 2827 | 12832 | ✅ 匹配 |
| `btn-batch-delete` | 2828 | 12837 | ✅ 匹配 |
| `btn-add-to-channel` | 2826 | 12671 | ✅ 匹配 |

### ❌ 不存在的按钮

| 要求检查的 ID | 实际状态 |
|---|---|
| `btn-export-all` | **不存在于 HTML 也无 JS 绑定**。无"一键导出全部"按钮，导出通过数据下载页 |
| `filter-keyword` | 2805 | 12799 | ✅ 存在 |
| `filter-source` | 2809 | 12800 | ✅ 存在 |
| `filter-date-start` | 2815 | 12801 | ✅ 存在 |
| `filter-date-end` | 2819 | 12802 | ✅ 存在 |

---

## 四、渠道页面（geo / 360 / bing / baidu / douyin / xianyu / trash）

### ✅ 自定义表头按钮绑定

| JS 绑定 ID | HTML 行 | JS 绑定行 | 状态 |
|---|---|---|---|
| `btn-customize-columns-geo` | 2871 | 12834 | ✅ 匹配 |
| `btn-customize-columns-360` | 2882 | 12834 | ✅ 匹配 |
| `btn-customize-columns-bing` | 2893 | 12834 | ✅ 匹配 |
| `btn-customize-columns-baidu` | 2904 | 12834 | ✅ 匹配 |
| `btn-customize-columns-douyin` | 2915 | 12834 | ✅ 匹配 |
| `btn-customize-columns-xianyu` | 2926 | 12834 | ✅ 匹配 |
| `btn-customize-columns-trash` | 2937 | 12834 | ✅ 匹配 |

> 使用循环 `['geo','360','bing','baidu','douyin','xianyu','trash'].forEach(...)` 批量绑定，每个都做了 `if (btn)` 保护。

### ✅ 渠道批量操作（btn-add-to-channel 弹窗内）

| 弹窗内 ID | HTML 行 | 状态 |
|---|---|---|
| `batch-move-to-pool` | 在弹窗内生成 | ✅ |
| `batch-channel-geo` | 在弹窗内生成 | ✅ |
| `batch-channel-360` | 在弹窗内生成 | ✅ |
| `batch-channel-bing` | 在弹窗内生成 | ✅ |
| `batch-channel-baidu` | 在弹窗内生成 | ✅ |
| `batch-channel-douyin` | 在弹窗内生成 | ✅ |
| `batch-channel-xianyu` | 在弹窗内生成 | ✅ |

### 渠道筛选
- 每个渠道使用 `renderFilterBar(suffix)` 生成 **动态 ID**（`filter-keyword-X`, `filter-level-X`, `filter-source-X`, `btn-filter-X`, `btn-reset-X` 等），通过 `closed-over` 闭包变量正确绑定 ✅

---

## 五、设置页面 (page-settings)

### ✅ 正确绑定的按钮

| JS 绑定 ID | HTML 行 | JS 绑定行 | 状态 |
|---|---|---|---|
| `btn-new-tag` | 3099 | 12554 | ✅ 匹配 |
| `btn-new-level` | 3100 | 12556 | ✅ 匹配 |
| `btn-new-source` | 3115 | 12558 | ✅ 匹配 |
| `btn-change-password` | 2998 | 13069 | ✅ 匹配 |
| `btn-reset-pw-by-sq-settings` | 2997 | 10345 | ✅ 匹配 |
| `btn-sq-setup` | 3006 | 10308/15366 | ✅ 匹配（有重复绑定） |
| `btn-sq-cancel` | 3031 | 10331/15327 | ✅ 匹配（有重复绑定） |
| `btn-sq-save` | 3032 | 15284 | ✅ 匹配 |
| `btn-sq-clear` | 3054 | 15340 | ✅ 匹配 |

### ❌ 命名不匹配 / 不存在的按钮

| 要求检查的 ID | 实际代码中的 ID | 状态 |
|---|---|---|
| `btn-add-tag` | `btn-new-tag` | ❌ 命名不同（功能一致） |
| `btn-add-level` | `btn-new-level` | ❌ 命名不同（功能一致） |
| `btn-add-source` | `btn-new-source` | ❌ 命名不同（功能一致） |
| `save-levels` | **不存在** | ❌ 等级编辑使用弹窗内 `ok` 按钮即时保存，无独立保存按钮 |
| `save-sources` | **不存在** | ❌ 来源编辑同理，弹窗内即时保存 |

---

## 六、存量管理页面（stock-list / brand / service / qifu）

### 工具栏按钮（运行时动态渲染）
通过 `renderStockToolbar()` 函数生成 HTML（行 6337-6342），绑定通过 `getElementById` 在 `renderStockCustomerPage()` 中完成（行 6506-6520）：

| 生成的 HTML ID | 绑定行 | 状态 |
|---|---|---|
| `_${module}_add_btn` | 6506/6508 | ✅ |
| `_${module}_col_custom_btn` | 6512/6514 | ✅ |
| `_${module}_assign_btn` | 6518/6520 | ✅ |

### 详情弹窗按钮（运行时动态渲染）
| 生成的 HTML ID | 绑定行 | 状态 |
|---|---|---|
| `editDetail` | 6653/7029 | ✅（详情弹窗内） |
| `exportOne` | 6657/7043 | ✅（详情弹窗内） |
| `delDetail` | 6662/7048 | ✅（详情弹窗内） |
| `saveStockCustomerForm` | 6883 | ✅（编辑表单内） |

---

## 七、data-act 事件委托分析

所有按钮通过 `querySelectorAll('button[data-act]')` 在渲染函数中绑定，而非事件委托。

### renderCustomerTable() — 客户列表
| data-act | 处理函数 | 行 | 状态 |
|---|---|---|---|
| `view` | `openCustomerDetail(c)` | 5533 | ✅ |
| `edit` | `openCustomerForm(c)` | 5533 | ✅ |
| `follow` | 弹窗跟进表单 | 5533 | ✅ |
| `del` | 弹窗删除选项 | 5533 | ✅ |

### renderPoolTable() — 客户池
| data-act | 处理函数 | 行 | 状态 |
|---|---|---|---|
| `view` | `openPoolCustomerDetail(c)` | 5755 | ✅ |
| `edit` | `openPoolCustomerForm(c)` | 5755 | ✅ |
| `follow` | 弹窗跟进表单（池） | 5755 | ✅ |
| `del` | 弹窗删除（仅彻底删） | 5755 | ✅ |

### renderChannelPage() — 渠道
| data-act | 处理函数 | 行 | 状态 |
|---|---|---|---|
| `view` | `openCustomerDetail(c)` | 6147 | ✅ |
| `edit` | `openCustomerForm(c)` | 6147 | ✅ |
| `follow` | 弹窗跟进表单 | 6147 | ✅ |
| `del` | 弹窗删除选项 | 6147 | ✅ |

### renderTrashPage() — 回收站
| data-act | 处理函数 | 行 | 状态 |
|---|---|---|---|
| `restore` | 恢复客户 | 6270 | ✅ |
| `purge` | 彻底删除 | 6270 | ✅ |

### renderStockCustomerPage() — 存量管理
| data-act | 处理函数 | 行 | 状态 |
|---|---|---|---|
| `view` | `openStockCustomerDetail(c, module, dataKey)` | 6524 | ✅ |
| `edit` | `openStockCustomerForm(module, dataKey, c)` | 6524 | ✅ |
| `follow` | 弹窗跟进表单 | 6524 | ✅ |
| `del` | 确认弹窗 + 密码验证删除 | 6524 | ✅ |

> 注意：`data-act` 绑定方式为**直接赋值**（`btn.onclick = ...`），非事件委托，每次重新渲染重新绑定。在渲染函数内部使用闭包变量 `c` 正确地捕获当前客户对象。

---

## 八、其他页面按钮 （数据与安全等）

| JS 绑定 ID | HTML 行 | JS 绑定行 | 状态 |
|---|---|---|---|
| `btn-select-folder` | 3147 | 12922 | ✅ |
| `btn-sync-now` | 3148 | 12926 | ✅ |
| `btn-change-folder` | 3149 | 12927 | ✅ |
| `btn-revoke-folder` | 3150 | 12931 | ✅ |
| `btn-export-encrypted` | 3158 | 12933 | ✅ |
| `btn-import-encrypted` | 3159 | 12944 | ✅ |
| `btn-export-masked` | 3160 | 13006 | ✅ |
| `btn-export-plain` | 3161 | 13015 | ✅ |
| `btn-rollback` | 3162 | 13026 | ✅ |
| `btn-reset-data` | 3163 | 13049 | ✅ |
| `btn-export-log` | 3174 | 13110 | ✅ |
| `btn-report-daily` | 2722 | 13122 | ✅ |
| `btn-report-weekly` | 2723 | 13122 | ✅ |
| `btn-report-monthly` | 2724 | 13122 | ✅ |
| `btn-report-export` | 2725 | 13129 | ✅ |
| `btn-download-selected` | 3219 | 10746 | ✅（在函数作用域内） |
| `btn-channel-select-all` | 3195 | 10743 | ✅ |
| `btn-channel-deselect-all` | 3196 | 10744 | ✅ |
| `btn-download-list-template` | 3228 | 10838 | ✅ |
| `btn-download-pool-template` | 3256 | 10863 | ✅ |
| `btn-import-list-excel` | 3236 | 10941 | ✅ |
| `btn-import-list-clear` | 3239 | 10943 | ✅ |
| `btn-confirm-import-list` | 3240 | 10947 | ✅ |
| `btn-import-pool-excel` | 3264 | 11191 | ✅ |
| `btn-import-pool-clear` | 3266 | 11193 | ✅ |
| `btn-confirm-import-pool` | 3272 | 11197 | ✅ |
| `btn-stock-download` | 3326 | 11414 | ✅ |
| `btn-stock-download-template` | 3335 | 11487 | ✅ |
| `btn-stock-import-excel` | 3343 | 11512 | ✅ |
| `btn-stock-import-clear` | 3346 | 11514 | ✅ |
| `btn-stock-confirm-import` | 3347 | 11518 | ✅ |
| `btn-stock-dedup-toggle` | 3348 | 11693 | ✅ |
| `check-all-headers` | 3213 | 10694 | ✅ |
| `stock-check-all-headers` | 3320 | 11412 | ✅ |

---

## 九、总结

### 共计检查
- **DOMContentLoaded 直绑按钮**: ~50+ 个，全部匹配
- **运行时动态生成的按钮**: ~30+ 个，正确绑定
- **data-act 按钮**: 5 个渲染函数 × 4 种动作 = ~20 种按钮类型，全部正确绑定

### 发现的问题

1. **`pool-btn-export` 不存在** — 客户池页面没有导出按钮。如需导出客户池数据，用户需通过"数据与安全 → 数据下载"页面操作。

2. **`btn-export-all` 不存在** — 客户列表没有"一键导出全部"按钮。导出同样需要通过"数据与安全 → 数据下载"页面。

3. **`btn-add-tag/btn-add-level/btn-add-source` 名称不匹配** — 实际 ID 分别为 `btn-new-tag/btn-new-level/btn-new-source`，功能完全一致但命名约定不同（`add` vs `new`）。

4. **`save-levels/save-sources` 不存在** — 等级和来源的编辑都是通过弹窗编辑器内 `ok` 按钮即时保存，没有独立保存按钮。这是设计选择而非遗漏。

5. **`pool-btn-apply-filter` 和 `pool-btn-reset-filter`** — 名称不统一（前缀 `pool-` 而非 `btn-pool-` 或其他命名模式），与主列表 `btn-apply-filter` 风格不一致。

6. **`btn-sq-setup` / `btn-sq-cancel` 有重复绑定** — 在行 10308 和行 15366（setup），以及行 10331 和行 15327（cancel）各绑定了两次。由于第二次覆盖第一次，不影响功能，但存在代码冗余。

### 发现的设计模式

- **动态按钮绑定方式**: 动态渲染的按钮（表单行操作、详情弹窗操作）遵循 `querySelectorAll('button[data-act]')` + 闭包绑定的模式，而非事件委托。这是稳健的，因为每次 `renderTable()` 或 `openModal()` 会重新生成 DOM 并重新绑定。
- **DOMContentLoaded 内绑定**: 静态按钮采用 `document.getElementById().onclick` 直接绑定，无 `if (el)` 保护（行 12814-12819 等），如果对应 HTML 被删除会报错。
- **命名不一致**: 主列表使用 `btn-` 前缀，客户池使用 `pool-btn-` 前缀，部分使用 `pool-` 直接前缀。
