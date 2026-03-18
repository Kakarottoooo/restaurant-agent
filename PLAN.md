# Folio. — 下一阶段开发计划

> 更新日期：2026-03-17
> 当前状态：功能完整的 MVP，进入产品打磨阶段

---

## 背景

这是一个基于 AI 的美国餐厅推荐 Web 应用，技术栈为 Next.js 16 + React 19 + TypeScript + Tailwind CSS，AI 层由 MiniMax（MiniMax-Text-01）驱动，保留 Anthropic API 备用。核心功能已全部打通：自然语言输入 → 三层 Pipeline（意图解析 → Google Places + Tavily 并行搜索 → AI 评分排序）→ 最多 10 条结果。品牌将从"餐厅推荐工具"升级为可扩展至酒店、生活方式的高端内容平台，命名为 **Folio.**。

---

## 阶段一：UI 全面重设计

### 1.1 设计原则

- **风格定位**：Warm Luxury Editorial，对标 Condé Nast Traveler + Apple
- **核心原则**：大量留白、无渐变、无阴影、无霓虹色，平静、高端、克制
- **可扩展性**：设计语言不局限于餐厅，可平迁至酒店、旅行、生活方式业务

### 1.2 Light / Dark Mode

支持自由切换，金色 `#C9A84C` 作为两个模式统一的品牌色。

#### 配色系统

| 用途 | Light Mode | Dark Mode |
|------|-----------|-----------|
| 页面背景 | `#F5F0E8`（羊皮纸米色） | `#0F0F0F`（纯黑） |
| 卡片/组件 | `#FFFFFF` | `#1C1C1C`（深炭灰） |
| 次级容器 | — | `#242424` |
| 金色点缀 | `#C9A84C` | `#C9A84C` |
| 主要文字 | `#2C2416`（深棕） | `#F0EAD6` |
| 次要文字 | `#6B5E45` | `#8A8070` |
| 辅助文字 | `#B4A89A` | — |

Dark mode 基于以上色值自动映射，不单独编写组件。

### 1.3 字体系统

| 用途 | 字体 | 大小 | 字重 |
|------|------|------|------|
| 主标题 H1 | Playfair Display | 36–48px | 700 |
| 副标题 H2 | Playfair Display | 24–28px | 600 |
| 卡片标题 | Playfair Display | 18–20px | 600 |
| 正文 | DM Sans | 15–16px | 400 |
| 标签/按钮 | DM Sans | 13–14px | 500 |
| 价格/评分 | DM Sans | 14px | 600 |

> Playfair Display 仅用于标题，不用于长段正文。正文行高 1.6–1.7。

### 1.4 组件规范

#### 顶部导航栏
- 高度 52px，白色背景，底部 0.5px 边框
- 左：品牌名 **Folio.** — Playfair Display 18px，深棕 `#2C2416`，句号金色 `#C9A84C`
- 中：城市选择器胶囊 — 羊皮纸填充，金色边框，金色小圆点 + 城市名 DM Sans 13px
- 右：「Powered by Claude」DM Sans 12px，`#B4A89A`

#### 用户查询气泡
- 右对齐，深棕 `#2C2416` 填充，羊皮纸色文字
- 圆角：18px 18px 4px 18px（右下角收窄模拟发送方气泡）
- DM Sans 14px，最大宽度 72%

#### 结果标题行
- 左对齐，「Found 10 restaurants for you.」
- DM Sans 13px，`#8B7355`

#### 筛选 Chips
- 横向可滚动
- 默认：白色填充，0.5px 金色调边框，`#6B5E45` 文字
- 激活：金色 `#C9A84C` 填充，白色文字
- DM Sans 12px，border-radius 20px，padding 5px 12px

#### 餐厅卡片
- 白色背景，border-radius 16px，0.5px 细边框，全宽展示
- **图片区**：全宽，180px 高，object-fit cover；占位符：羊皮纸底色 + 淡色景观 SVG 图标
- **卡片头部**：
  - 左：圆形序号徽章（26px，深棕填充，羊皮纸数字）
  - 中：餐厅名 Playfair Display 18px 深棕
  - 右：星级评分 DM Sans 13px 金色
- 菜系类型 + 氛围标签：DM Sans 13px，`#8B7355`
- 地址：DM Sans 12px，`#B4A89A`
- 金色分隔线：`#C9A84C`，2px 高，32px 宽
- 斜体简介：DM Sans 13px，`#6B5E45`，行高 1.5
- **Why it fits 框**：
  - 背景 `#F9F6EF`，左侧 3px 金色实边，右侧圆角
  - 标题「Why it fits」DM Sans 12px 500，`#8B6914`
  - 正文 DM Sans 13px，`#4A3F2F`，行高 1.5
- **Watch out 框**：
  - 背景 `#FDF6EC`，左侧 3px 琥珀色 `#E8A020` 实边，右侧圆角
  - 标题「Watch out」DM Sans 12px 500，`#8B5E14`
  - 正文 DM Sans 13px，`#6B4A1A`
- **Skip if 行**：DM Sans 12px，`#B4A89A`，无框
- **卡片底部**：
  - 顶部 0.5px 分隔线
  - 左：「Est. $X–Y / person」DM Sans 13px 500，`#2C2416`
  - 右：两个按钮
    - Map：透明背景，0.5px 边框，`#6B5E45` 文字
    - Reserve →：金色填充，白色文字
    - 两者 border-radius 8px，padding 7px 14px，DM Sans 13px

#### 底部输入栏
- 固定在底部，白色背景，顶部 0.5px 边框，padding 12px 16px
- 输入框：flex 1，羊皮纸填充，0.5px 金色调边框，border-radius 24px，placeholder `#B4A89A` DM Sans 13px
- 麦克风按钮：44px 圆形，深棕 `#2C2416` 填充，金色麦克风图标，长按说话
- 发送按钮：44px 圆形，金色 `#C9A84C` 填充，白色箭头图标

### 1.5 特殊状态

#### 加载中（AI 处理中）
展示 4 步进度条，将 agent pipeline 流程可视化，让用户感受到 AI 在认真工作：

```
Step 1 / 4  解析你的需求...         ████░░░░░░  25%
Step 2 / 4  搜索附近餐厅...         ████████░░  50%
Step 3 / 4  获取真实口碑信号...     ██████████  75%
Step 4 / 4  AI 评分与排序...        ██████████  100%
```

每步完成后高亮，当前步骤有动态脉冲效果。

#### 空结果（降级展示）
- 不展示空白页，降级展示最接近的结果（如"稍微超预算但最接近"）
- 在结果顶部说明偏差原因：「未找到完全匹配，以下是最接近的选项」
- 底部提供建议操作：放宽价位 / 扩大范围 / 更换菜系

### 1.6 地图视图

全屏地图 + 底部横滑缩略卡：
- 地图全屏铺满，给空间分布最大展示区域
- 底部横向可滑动缩略卡，滑动时地图自动飞行（flyTo）到对应 Pin
- 选中状态：卡片显示金色边框，对应 Pin 变为金色，两者联动高亮
- 交互模式对齐 Google Maps / Airbnb，移动端友好

### 1.7 响应式 & PWA

- 移动端和桌面端均完整适配
- 配置 PWA：
  - `manifest.json`（图标、主题色、display: standalone）
  - Service Worker（离线缓存、后台同步）
  - 支持"添加到主屏幕"安装

---

## 阶段二：新功能 — GPS 附近搜索

### 需求背景
当前仅支持从 27 个预设城市下拉选择，移动端 PWA 场景下限制明显。GPS 定位是最高优先级的新功能。

### 功能规范

**入口**
- 城市选择器下拉列表顶部新增「Use My Location」选项，图标为定位箭头

**授权成功流程**
1. 调用浏览器 `navigator.geolocation.getCurrentPosition()`
2. 获取经纬度坐标
3. 用坐标替代城市参数，调用 Google Places Nearby Search API
4. Header 城市选择器显示「Near Me」+ 定位图标

**授权失败 / 拒绝流程**
- 展示提示：「无法获取位置，请手动选择城市」
- 不做 IP 定位降级，直接引导用户手动选择

**边界情况**
- 超时（5s）：同上，提示手动选择
- 设备不支持 Geolocation API：隐藏「Use My Location」入口

---

## 执行顺序

| 顺序 | 任务 | 说明 |
|------|------|------|
| 1 | 引入字体（Playfair Display + DM Sans） | Google Fonts 或本地加载 |
| 2 | 建立 CSS 变量 / Tailwind 主题（配色系统 + Dark mode） | 所有组件依赖的基础 |
| 3 | 重构 Navbar | 品牌名、城市选择器、Powered by Claude |
| 4 | 重构底部输入栏 | 麦克风 + 发送按钮 |
| 5 | 重构用户气泡 | 右对齐样式 |
| 6 | 重构筛选 Chips | 激活状态联动 |
| 7 | 重构餐厅卡片 | 最复杂组件，Why it fits / Watch out 信息框 |
| 8 | 实现加载进度条 | 4 步 pipeline 可视化 |
| 9 | 实现空结果降级 | 展示最接近结果 + 说明 |
| 10 | 重构地图视图 | 全屏 + 底部横滑卡 + Pin 联动 |
| 11 | PWA 配置 | manifest + Service Worker |
| 12 | GPS 附近搜索 | 城市选择器新增 Use My Location |

---

## 待定功能（后续规划）

以下功能已评估，待 UI 重设计完成后按优先级排期：

- **行程单（Itinerary Builder）**：将选中餐厅/酒店组合为可分享链接的行程，天然支撑多业务扩展
- **用户账号 + 收藏云同步**：当前收藏存 localStorage，换设备丢失，加登录（Clerk）打通跨端
- **偏好记忆（Preference Profile）**：一次设置饮食限制、预算、常用场合，AI 每次自动带入
- **社区口碑聚合**：卡片内展示精选 Google/Yelp 评论摘要，为 AI 推荐提供真实人证背书
