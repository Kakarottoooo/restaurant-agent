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

---

## 阶段三：决策引擎升级

> 目标：从"好看的搜索框"升级为真正的决策引擎。
> 现在的系统做的是：自然语言 → Google Places 搜索 → AI 写推荐理由。
> 这一阶段要做到：自然语言 → 候选召回 → 评论信号提取 → 结构化打分 → 个性化解释 → 偏好记忆。
> 三个核心改造点，按顺序实施。

---

### Phase 3.1 — 评论语义信号提取

**背景与问题**

当前 Tavily 搜索返回的是博客文章和新闻片段，不是真实用户评论。`rankAndExplain` 拿到这些信息后，只能写出笼统的推荐理由，无法回答用户真正在意的问题：这家餐厅周末有多吵？适合约会吗？等位要多久？招牌菜是什么？有没有我需要注意的雷点？

**目标**

对进入最终排名前的每家候选餐厅，提取来自真实用户评论的结构化信号，将其注入排序和解释层，让推荐理由从"AI 猜测"变成"有用户证据支撑的判断"。

**新增类型（`lib/types.ts`）**

```typescript
export interface ReviewSignals {
  noise_level: "quiet" | "moderate" | "loud" | "unknown";
  wait_time: string;           // e.g. "30-45min on weekends", "no wait on weekdays"
  date_suitability: number;    // 1-10，约会适合度
  service_pace: string;        // e.g. "attentive but not rushed", "slow service"
  notable_dishes: string[];    // e.g. ["duck confit", "truffle pasta"]
  red_flags: string[];         // e.g. ["loud on weekends", "cash only", "rude staff"]
  best_for: string[];          // e.g. ["date night", "business lunch", "groups"]
  review_confidence: "high" | "medium" | "low"; // 信号可信度
}
```

在 `Restaurant` 接口中添加 `review_signals?: ReviewSignals`。

**新增工具函数（`lib/tools.ts`）**

新增 `fetchReviewSignals(restaurants: Restaurant[], query: string, cityFullName: string): Promise<Map<string, ReviewSignals>>` 函数，实现逻辑如下：

1. 对传入的餐厅列表（最多 12 家），构造一条专门针对评论的 Tavily 搜索：
   ```
   query: "{restaurant1}, {restaurant2}, ... reviews {cityFullName} noise atmosphere date experience"
   ```
   使用 `search_depth: "advanced"` 和 `max_results: 10`，优先抓 Yelp、Google Reviews、TripAdvisor、Reddit 页面。

2. 将 Tavily 返回的原始文本连同餐厅名单一起传给 MiniMax，用以下 system prompt 提取结构化信号：

   ```
   You are extracting review signals for restaurants. For each restaurant mentioned below, analyze the provided review text and extract structured signals. Return a JSON object where keys are restaurant names and values match the ReviewSignals schema. If a signal cannot be determined from the text, use "unknown" for strings and [] for arrays. Be conservative: only report signals that have clear evidence in the text.
   ```

3. 返回 `Map<restaurantName, ReviewSignals>`，供后续步骤消费。

**修改 `lib/agent.ts`**

在 `gatherCandidates` 完成初筛（过滤评分 < 3.5）后、进入 `rankAndExplain` 之前，插入新步骤：

```typescript
// 对初筛后的前 12 家候选提取评论信号（并发，不阻塞主流程）
const reviewSignalsMap = await fetchReviewSignals(
  filtered.slice(0, 12),
  tavilyQuery,
  cityFullName
).catch(() => new Map()); // 失败时不影响主流程

// 将信号注入到对应餐厅对象
const candidatesWithSignals = filtered.slice(0, 12).map(r => ({
  ...r,
  review_signals: reviewSignalsMap.get(r.name),
}));
```

在 `rankAndExplain` 的 prompt 中，将 review_signals 格式化后加入候选餐厅的描述：

```
3. Bella Cucina | Italian | $$$ | ⭐4.6 (420 reviews) | 123 Main St
   Review signals: noise=quiet, wait=no reservation needed weekdays/45min Fri-Sat,
   date_suitability=9/10, red_flags=["cash only parking"], notable=["handmade pasta","tiramisu"]
```

**修改 `components/RecommendationCard.tsx`**

在"Watch out"框下方，当 `review_signals` 存在时，新增一个"Real reviews say"区块，展示：
- 噪音等级（图标 + 文字）
- 等位预期
- 2-3 条 notable dishes（如有）
- red_flags（如有，用琥珀色标注）

**成功标准**

推荐理由从"这家餐厅氛围适合约会"变成"根据近期 Yelp 评论，周五晚等位约 45 分钟，包间区域更安静，招牌菜 handmade pasta 被多次提及，注意只收现金停车"。

---

### Phase 3.2 — 结构化评分框架

**背景与问题**

当前 `rankAndExplain` 完全依赖 AI 自由给出 `score` 字段，没有任何约束。这导致：同样的输入两次排序结果不稳定；无法解释为什么 A 排在 B 前面；无法按用户偏好动态调整权重；无法在 UI 上展示"为什么这个分数"。

**目标**

引入维度化评分：AI 负责填写每个维度的原始分，系统负责按权重计算总分，让排序过程可解释、可调整、可审计。

**新增类型（`lib/types.ts`）**

```typescript
export interface ScoringDimensions {
  budget_match: number;         // 0-10：实际价位 vs 用户预算匹配度
  scene_match: number;          // 0-10：用途/氛围/场景契合度
  review_quality: number;       // 0-10：评分 + 评论信号综合质量
  location_convenience: number; // 0-10：距离/交通便利度
  preference_match: number;     // 0-10：与用户历史偏好的契合度（初期可默认 5）
  red_flag_penalty: number;     // 0-5：扣分项（有重大雷点时扣分）
  weighted_total: number;       // 系统计算，不由 AI 填写
}
```

在 `RecommendationCard` 接口中添加 `scoring?: ScoringDimensions`。

**新增评分工具（`lib/agent.ts`）**

新增 `computeWeightedScore(dimensions: Omit<ScoringDimensions, "weighted_total">, weights?: Partial<typeof DEFAULT_WEIGHTS>): number` 函数：

```typescript
const DEFAULT_WEIGHTS = {
  budget_match: 0.25,
  scene_match: 0.30,
  review_quality: 0.20,
  location_convenience: 0.15,
  preference_match: 0.10,
};

function computeWeightedScore(dimensions, weights = DEFAULT_WEIGHTS): number {
  const raw =
    dimensions.budget_match * weights.budget_match +
    dimensions.scene_match * weights.scene_match +
    dimensions.review_quality * weights.review_quality +
    dimensions.location_convenience * weights.location_convenience +
    dimensions.preference_match * weights.preference_match;
  const penalized = raw - dimensions.red_flag_penalty;
  return Math.round(Math.max(0, Math.min(10, penalized)) * 10) / 10;
}
```

**修改 `rankAndExplain` prompt**

将 AI 的返回格式从自由打分改为维度打分：

```
Return a JSON array. For each restaurant, fill in the scoring dimensions honestly:
[
  {
    "rank": 1,
    "restaurant_index": 0,
    "scoring": {
      "budget_match": 8,        // How well does the price level match the user's stated budget? 0-10
      "scene_match": 9,         // How well does atmosphere/purpose/occasion fit? 0-10
      "review_quality": 7,      // Rating + review signal quality combined. 0-10
      "location_convenience": 6, // Distance and accessibility. 0-10
      "preference_match": 5,    // Match with user preferences (use 5 if unknown). 0-10
      "red_flag_penalty": 1     // Deduct 1-5 if there are serious red flags, else 0
    },
    "why_recommended": "...",
    "best_for": "...",
    "watch_out": "...",
    "not_great_if": "...",
    "estimated_total": "..."
  }
]
```

**修改 `rankAndExplain` 后处理**

AI 返回后，系统调用 `computeWeightedScore` 填充 `weighted_total`，并按 `weighted_total` 重新排序（不依赖 AI 给出的 `rank` 字段）：

```typescript
const cards = parsed.data
  .filter(item => item.restaurant_index < restaurants.length)
  .map(item => {
    const scoring = {
      ...item.scoring,
      weighted_total: computeWeightedScore(item.scoring),
    };
    return { ...item, scoring, restaurant: restaurants[item.restaurant_index] };
  })
  .sort((a, b) => b.scoring.weighted_total - a.scoring.weighted_total)
  .map((item, i) => ({ ...item, rank: i + 1 }));
```

**修改 `components/RecommendationCard.tsx`**

在卡片底部评分区添加维度分可视化（折叠展示，点击展开）：

```
综合评分 8.4  [展开]
  ↳ 场景契合  ████████░░ 9.0
  ↳ 预算匹配  ████████░░ 8.0
  ↳ 口碑质量  ███████░░░ 7.0
  ↳ 位置便利  ██████░░░░ 6.0
```

**修改 Zod Schema（`lib/schemas.ts`）**

新增 `ScoringDimensionsSchema`，在 `RankedItemSchema` 中加入 `scoring` 字段验证，确保每个维度在 0-10 范围内、`red_flag_penalty` 在 0-5 内。

**成功标准**

两次相同输入的排序结果稳定。用户可以看到每家餐厅为什么得这个分。可以通过修改 `DEFAULT_WEIGHTS` 快速实验不同的偏好权重。

---

### Phase 3.3 — 用户偏好记忆

**背景与问题**

当前每次搜索完全无状态。用户说"我不喜欢太吵的地方"，下次还得重说。系统不知道这个用户历史上偏好安静还是热闹、是价格敏感还是体验优先、有没有饮食禁忌。没有这层记忆，推荐永远是"对所有人差不多准"，而不是"对这个人特别准"。

分三个层次实现，从易到难：

---

#### 3.3a — 会话内偏好累积（Session Memory）

**目标**：在一次会话中，用户的每条 refinement 消息应该累积成偏好信号，传入下一次搜索。

**新增类型（`lib/types.ts`）**

```typescript
export interface SessionPreferences {
  noise_preference?: "quiet" | "moderate" | "lively";
  budget_ceiling?: number;       // per person
  exclude_chains: boolean;
  excluded_cuisines: string[];
  required_features: string[];   // e.g. ["outdoor seating", "private room"]
  occasion?: string;
  refined_from_query_count: number; // 用户已经精炼了几轮
}
```

**修改 `useChat.ts`**

新增 `sessionPreferences` 状态，初始为默认值。每次 `sendMessage` 后，调用新函数 `extractRefinements(newMessage, currentPreferences): SessionPreferences` 更新偏好：

```typescript
// 在 sendMessage 成功返回后更新 session preferences
const updatedPrefs = await extractRefinements(text, sessionPreferences);
setSessionPreferences(updatedPrefs);
```

`extractRefinements` 是一个轻量 AI 调用，system prompt 如下：

```
You are updating a user preference profile based on their latest refinement message.
Current preferences: {JSON}
New message: "{text}"
Extract any preference updates implied by the message. Return updated preferences JSON.
Only update fields that are clearly implied. Do not invent preferences.
Examples:
- "more quiet" → noise_preference: "quiet"
- "cheaper options" → budget_ceiling reduced by ~30%
- "no chains please" → exclude_chains: true
- "remove Thai from results" → excluded_cuisines: [..., "Thai"]
```

将 `sessionPreferences` 作为额外参数传入 `runAgent`，在 `parseIntent` 和 `rankAndExplain` 的 prompt 中注入：

```
User session preferences (accumulated from conversation):
- Noise preference: quiet
- Exclude chains: yes
- Budget ceiling: $45/person
Please factor these into your recommendations, overriding any contradictions in the latest message.
```

---

#### 3.3b — 跨会话偏好存储（Persistent Preferences）

**目标**：用户的核心偏好跨会话持久化，每次打开 App 不需要重新说明。

**新增类型（`lib/types.ts`）**

```typescript
export interface UserPreferenceProfile {
  version: 1;
  updated_at: string;           // ISO timestamp
  noise_preference?: "quiet" | "moderate" | "lively";
  typical_budget_per_person?: number;
  dietary_restrictions: string[]; // e.g. ["vegetarian", "no shellfish"]
  cuisine_dislikes: string[];
  always_exclude_chains: boolean;
  preferred_occasions: string[]; // e.g. ["date", "business", "family"]
  dislike_tourist_traps: boolean;
  // 搜索历史摘要（最近 20 次搜索的关键词，不存完整结果）
  recent_search_keywords: string[];
  // 收藏的餐厅元信息（cuisine + price + purpose，不存全量数据）
  favorite_signals: Array<{
    cuisine: string;
    price: string;
    purpose?: string;
    saved_at: string;
  }>;
}
```

**新增 Hook（`app/hooks/usePreferences.ts`）**

实现 `usePreferences()` hook，提供：
- `profile: UserPreferenceProfile`：从 localStorage 加载，没有则返回默认值
- `updateProfile(patch: Partial<UserPreferenceProfile>): void`：合并更新并持久化
- `learnFromFavorite(card: RecommendationCard): void`：每次用户收藏，自动提取并学习信号
- `learnFromSearch(query: string): void`：记录搜索关键词（最多保留 20 条）
- `resetProfile(): void`：清空所有偏好

**修改 `useFavorites.ts`**

每次 `toggleFavorite`（添加收藏时），调用 `learnFromFavorite` 更新偏好 profile。

**修改 `useChat.ts`**

`sendMessage` 时将 `profile` 格式化后传入 `runAgent`：

```typescript
const profileContext = formatProfileForPrompt(profile);
// 格式化示例：
// User preference profile: prefers quiet restaurants, typical budget $40-60/person,
// vegetarian, dislikes tourist traps, frequently searches for date night options.
// Recent favorites: Italian ($$), Japanese ($$), French ($$$)
```

在 `parseIntent` 的 prompt 中注入 `profileContext` 作为用户背景。

**在 Page UI 中**

在 header 区或设置面板中提供简单的偏好快速设置入口（4-5 个核心字段），让用户主动配置。不需要复杂的 Profile 页面，一个 modal 即可：
- 饮食限制（多选标签）
- 噪音偏好（3 选 1）
- 是否排除连锁（toggle）
- 每人预算区间（slider）

---

#### 3.3c — 基础反馈闭环（Feedback Loop）

**目标**：用户最终选择后能给一次信号，这个信号反向提升未来推荐质量。

**新增组件**

在 `RecommendationCard` 底部（Reserve 按钮同行）新增一个轻量反馈入口：

```
[Reserve →]  [去了？]
```

点击"去了？"后弹出 inline 反馈：

```
实际体验如何？
[👍 符合推荐] [👎 不太对]

如果不太对，是哪里没达预期？（可多选）
□ 比描述的吵  □ 价格偏高  □ 等位太久  □ 氛围不符  □ 服务差  □ 食物普通
```

**反馈数据结构**

```typescript
interface FeedbackRecord {
  restaurant_id: string;
  restaurant_name: string;
  query: string;              // 当时的搜索词
  satisfied: boolean;
  issues?: string[];          // 不满意时的具体问题
  created_at: string;
}
```

存入 localStorage（`restaurant-feedback`），最多保留 50 条。

**将反馈信号注入偏好**

当用户标记"比描述的吵"时，自动加强 `noise_preference: "quiet"` 信号。当用户标记"等位太久"时，在下次搜索的约束里加入"avoid long waits"。当用户连续对多家 $$$$ 餐厅标记"价格偏高"时，自动降低 `typical_budget_per_person`。

---

### Phase 3 执行顺序

```
Phase 3.1 评论信号提取（约 3-4 天）
  ├── 新增 ReviewSignals 类型
  ├── 修改 tools.ts：新增 fetchReviewSignals
  ├── 修改 agent.ts：插入信号提取步骤
  ├── 修改 schemas.ts：新增 ReviewSignals Zod schema
  └── 修改 RecommendationCard：展示信号

Phase 3.2 结构化评分框架（约 2-3 天）
  ├── 新增 ScoringDimensions 类型
  ├── 新增 computeWeightedScore 函数
  ├── 修改 rankAndExplain：维度打分 prompt + 后处理排序
  ├── 修改 schemas.ts：新增 ScoringDimensionsSchema
  └── 修改 RecommendationCard：展示维度分

Phase 3.3a 会话内偏好累积（约 2 天）
  ├── 新增 SessionPreferences 类型
  ├── 新增 extractRefinements 函数（轻量 AI 调用）
  ├── 修改 useChat.ts：维护 sessionPreferences 状态
  └── 修改 runAgent：接受并注入 sessionPreferences

Phase 3.3b 跨会话偏好存储（约 3 天）
  ├── 新增 UserPreferenceProfile 类型
  ├── 新增 usePreferences hook
  ├── 修改 useFavorites：收藏时学习信号
  ├── 修改 useChat：搜索时注入 profile
  └── 新增偏好设置 Modal UI

Phase 3.3c 反馈闭环（约 2 天）
  ├── 修改 RecommendationCard：新增反馈入口
  ├── 新增 FeedbackRecord 类型 + localStorage 持久化
  └── 修改 usePreferences：将反馈转化为偏好更新
```

### Phase 3 成功标准

| 指标 | 当前 | Phase 3 完成后 |
|------|------|---------------|
| 推荐理由来源 | AI 猜测 | 用户评论有据可查 |
| 相同输入排序稳定性 | 不稳定 | 稳定（系统计算） |
| 个性化程度 | 对所有人一样 | 区分偏好安静/热闹、预算高低 |
| 系统学习能力 | 零 | 随收藏和反馈逐步提升 |
| 推荐可解释性 | "AI 说好" | 5 维度分数 + 评论原文证据 |

---

## 阶段四：从"推荐工具"到"决策引擎"

> 更新日期：2026-03-18
> 前提：Phase 3 已完成。Phase 4 的目标是补上六个核心缺口，让产品真正兑现"替用户完成搜索→比较→筛选→总结→推荐"这条完整链路的承诺，并建立通用 AI 和传统 App 无法复制的壁垒。

---

### Phase 4.1 — 流式渐进加载（Streaming Response）

**背景与问题**

用户提交 query 后，当前系统要等 Pipeline 全部完成才返回结果，通常需要 8-15 秒。这是用户流失的最大单点。进度条虽然存在，但屏幕上没有实际内容出现，体验远差于 ChatGPT 这类流式输出产品。

**目标**

将结果改为流式/分批返回：先展示前 3 张卡片，后台继续补全剩余卡片，最终呈现完整 Top 10。用户在 2-3 秒内看到第一个结果。

**修改 `app/api/chat/route.ts`**

将 `Response` 改为 `ReadableStream`，使用 Next.js `StreamingTextResponse` 或原生 `TransformStream`：

```typescript
// 伪代码结构
const stream = new TransformStream();
const writer = stream.writable.getWriter();

// 立即发送前 3 个候选（跳过 review signal 提取）
const quickCards = await rankAndExplain(topCandidates.slice(0, 3), requirements, "quick");
writer.write(encodeChunk({ type: "partial", cards: quickCards }));

// 后台补充：提取评论信号 + 完整排序
const fullCards = await rankAndExplain(candidatesWithSignals, requirements, "full");
writer.write(encodeChunk({ type: "complete", cards: fullCards }));
writer.close();

return new Response(stream.readable, { headers: { "Content-Type": "text/event-stream" } });
```

**修改 `app/hooks/useChat.ts`**

将 `fetch` 改为流式消费，使用 `ReadableStream.getReader()`：

```typescript
// 读取 partial 事件 → 立即渲染前 3 张卡片
// 读取 complete 事件 → 替换/追加为完整 Top 10
// 在 complete 到达前，卡片列表末尾展示"正在加载更多..."骨架屏
```

**修改 `app/page.tsx`**

新增骨架屏组件（3 个占位卡片，与真实卡片等高），在 `partial` 结果加载完成后替换为真实卡片，`complete` 后无缝追加剩余结果。

**成功标准**

| 指标 | 当前 | Phase 4.1 完成后 |
|------|------|----------------|
| 首屏内容出现时间 | 8-15s | ≤3s |
| 用户等待体验 | 黑屏 + 进度条 | 2-3 秒出现真实卡片 |
| 完整结果加载时间 | 同上 | 8-12s（后台继续） |

---

### Phase 4.2 — 服务端遥测（Server-Side Telemetry）

**背景与问题**

当前完全不知道：哪些 query 成功了、哪些失败了、Top 1 的推荐被采纳了多少次、排名第几的结果最受欢迎、哪个城市的请求最多、延迟分布如何。没有这些数据，排序权重永远只能靠猜。

**目标**

在 API 层加入结构化日志，记录每次请求的关键信号，为 Phase 4.4 的排序权重优化提供数据基础。

**修改 `app/api/chat/route.ts`**

每次请求完成后，写入结构化日志：

```typescript
interface RequestLog {
  request_id: string;           // nanoid
  timestamp: string;
  city: string;
  query_length: number;
  intent_parsed: {
    cuisine?: string;
    purpose?: string;
    budget_per_person?: number;
    noise_level?: string;
  };
  candidates_fetched: number;
  results_returned: number;
  top3_scores: number[];        // weighted_total of rank 1-3
  pipeline_ms: {
    intent_parse: number;
    gather_candidates: number;
    review_signals: number;
    rank_explain: number;
    total: number;
  };
  error?: string;
}
```

**MVP 实现方式**

不引入数据库，将日志写入 Vercel Edge Config 或直接通过 `console.log` 结构化输出（Vercel 会自动捕获到 Log Drain）。后续可迁移到 Vercel Postgres 或 PlanetScale。

**新增客户端信号上报**

在 `RecommendationCard.tsx` 中，用户点击"Map"或"Reserve →"时，向 `/api/telemetry` 发送一个 fire-and-forget 请求：

```typescript
interface SelectionEvent {
  request_id: string;   // 从父组件传入
  rank_selected: number; // 用户选择了第几名
  action: "map" | "reserve";
}
```

这个信号是后续"哪个排名被采纳最多"分析的核心数据源。

**成功标准**

运行一周后能回答：平均延迟多少、Top 1 被选中的比例、哪类 query 失败率最高。

---

### Phase 4.3 — 持续协作式交互（Collaborative Refinement UI）

**背景与问题**

当前用户只能通过"重新输入"来 refine 结果。没有任何 UI 引导用户继续协作。结果返回后，产品就变成了一个"展示板"而非"持续决策工具"。

**目标**

在结果返回后，主动提供 refine 入口，让用户一键调整策略，不需要重新输入完整 query。

**4.3a — Refine 快捷 Chip**

结果卡片列表顶部（筛选 chip 行下方），新增一行动态 refine chip，根据当前结果自动生成建议：

```
[更安静一点] [再便宜一点] [排除连锁] [离我更近] [更适合约会]
```

生成逻辑：在 `rankAndExplain` 返回时，让 AI 额外输出 3-5 个 `suggested_refinements: string[]`（基于当前结果的分布，例如"当前结果中有 3 家嘈杂，建议提供安静选项"）。

点击 chip 时，以该 chip 文字作为新 message 触发 `sendMessage`，同时保留 session preferences。

**4.3b — 对比视图（Compare View）**

在每张 RecommendationCard 上新增"对比"按钮（最多选 2 张）。选中 2 张后，页面底部弹出抽屉式对比面板，展示：

```
                        餐厅 A          餐厅 B
场景契合                   9.0             7.5
预算匹配                   8.0             9.5
口碑质量                   7.0             8.0
噪音等级                   安静            中等
招牌菜                 手工意面, 提拉米苏   烤鸭, 北京卷饼
主要风险               周末等位 45 分钟    只收现金
```

**新增类型（`lib/types.ts`）**

```typescript
// 在 RecommendationCard 中新增
suggested_refinements?: string[];  // AI 给出的 refine 建议
```

**修改 `app/page.tsx`**

新增 compare 状态：`compareSelection: [RecommendationCard?, RecommendationCard?]`。对比面板以 bottom sheet 形式呈现，移动端友好。

**成功标准**

结果返回后，用户不需要重新输入，可以通过 1 次点击完成 refinement。对比视图让用户无需自己提炼"这两家有什么区别"。

---

### Phase 4.4 — 候选召回层升级（Wider Funnel）

**背景与问题**

当前 `googlePlacesSearch()` 每次只召回最多 20 个候选，直接过滤到 10 个。这违背了产品愿景中"先广撒网 30-100 个，再漏斗压缩"的设计。只有一个数据源，召回的候选集合过小，优质但不热门的餐厅容易被漏掉。

**目标**

扩大候选池，改为真正的三阶段漏斗：召回 → 初筛 → 精排。

**修改 `lib/tools.ts`**

`googlePlacesSearch` 支持分页，连续调用 2 次（利用 Google Places API 的 `pageToken`），最多召回 40 个候选。同时并行发起第二路搜索（换关键词，例如将用户的 `cuisine` 替换为相邻类别），合并去重后得到 40-60 个候选池：

```typescript
// 第一路：精确匹配（当前逻辑）
const primary = await googlePlacesSearch(query, location, priceLevel);

// 第二路：扩展搜索（放宽菜系或价位约束）
const expanded = await googlePlacesSearch(broadenedQuery, location, undefined);

// 合并去重（按 place_id）
const pool = deduplicateByPlaceId([...primary, ...expanded]);
// 通常得到 30-60 个候选
```

**修改 `lib/agent.ts`**

将初筛逻辑拆分为明确的三阶段：

```
Stage 1 召回（Recall）：pool = 30-60 个原始候选
Stage 2 初筛（Pre-filter）：
  - 排除评分 < 3.5 且评论数 < 30 的（放宽之前过于严格的 10 条门槛）
  - 排除距离 > 用户指定范围 * 1.5 的
  - 按 (rating × log(review_count)) 简单排序，取前 15 个
Stage 3 精排（Re-rank）：
  - 对 15 个候选提取 review signals
  - 调用 rankAndExplain 维度打分
  - 按 weighted_total 输出 Top 10
```

**成功标准**

| 指标 | 当前 | Phase 4.4 完成后 |
|------|------|----------------|
| 候选池大小 | 最多 20 | 30-60 |
| 精排前候选数 | 直接拿全部 | 明确的 15 个精选 |
| 数据源数量 | 1（Google Places） | 2（主搜索 + 扩展搜索） |

---

### Phase 4.5 — 结果分享卡片（Shareable Decision Card）

**背景与问题**

用户得到推荐结果后，最自然的行为是"发给朋友确认"或"发给另一半选"。当前只有 URL 分享，没有可视化的分享卡片，缺乏社交传播路径。

**目标**

允许用户将 Top 3 推荐生成一张可分享的图片卡片，或生成带预览的分享链接。

**4.5a — 分享链接（MVP）**

在结果标题行右侧新增分享按钮。点击后，将当前 Top 3 结果的核心字段（名称、分数、推荐理由摘要）序列化为 URL 参数（Base64 编码），生成可分享的短链接：

```
https://folio.app/share?r=eyJjYXJkcyI6W3...
```

接收方打开链接后，直接展示对应的推荐卡片（无需重新搜索），并在顶部显示"由 Folio. 生成的推荐"标识。

**4.5b — 图片卡片（可选）**

使用 `html2canvas` 或 Vercel OG Image 生成图片卡片，包含：
- Folio. 品牌标识
- Top 3 餐厅名 + 推荐理由一句话摘要
- 原始搜索词

**修改 `app/api/share/route.ts`（新增路由）**

```typescript
// GET /api/share?r=<encoded>
// 解码参数，返回分享页面数据
// POST /api/share
// 接收 Top 3 卡片数据，生成短 token，存入 KV（Vercel KV 或 Edge Config）
```

**成功标准**

用户能一键生成分享链接，接收方打开后直接看到推荐结果，无需重新搜索。

---

### Phase 4.6 — 排序权重闭环（Feedback → Ranking Improvement）

**背景与问题**

这是产品愿景中最核心的壁垒：排序权重应该随着真实用户行为不断优化，而不是永远靠经验拍板。当前虽然有反馈记录（`FeedbackRecord`），但这些数据存在 localStorage，从未被用于改进排序逻辑。

**目标**

建立从"用户行为 → 信号分析 → 权重调整"的闭环，让系统随着使用变得更准。

**闭环数据流**

```
用户选择了第几名（Phase 4.2 遥测）
    ↓
用户给出 👍/👎 反馈（Phase 3.3c）
    ↓
统计：哪个维度高分的结果被选中更多？
哪个维度被用户负反馈最多？
    ↓
动态调整 DEFAULT_WEIGHTS
```

**4.6a — 客户端权重自适应（MVP）**

在 `usePreferences.ts` 中，新增 `learnWeightsFromFeedback()` 函数。每次满足条件时（≥10 条反馈记录），分析反馈模式并微调本地权重：

```typescript
interface LearnedWeights {
  budget_match: number;
  scene_match: number;
  review_quality: number;
  location_convenience: number;
  preference_match: number;
  updated_at: string;
  sample_size: number;
}
```

例如：若 8/10 次不满意都集中在"场景不符"（对应 scene_match 低分），则将 `scene_match` 权重从 0.30 上调至 0.35，相应缩减其他权重。

**4.6b — 服务端聚合权重（长期）**

将 Phase 4.2 收集的服务端选择信号（哪个 rank 被采纳）汇总，每周分析一次维度分分布与被选中相关性，手动或自动更新 `lib/agent.ts` 中的 `DEFAULT_WEIGHTS`。这一步是手动运营 + 数据驱动的，不需要复杂的 ML 管道。

**成功标准**

| 指标 | 当前 | Phase 4.6 完成后 |
|------|------|----------------|
| 权重来源 | 经验拍板，永不变化 | 随用户反馈动态更新（客户端） |
| 反馈利用率 | 0%（存 localStorage 无用） | 100%（直接影响下次排序） |
| 可解释性 | 权重不透明 | 用户可在设置中看到"你的个人权重" |

---

### Phase 4 执行顺序

```
Phase 4.1 流式加载（约 3 天）
  ├── 修改 api/chat/route.ts：ReadableStream 分批返回
  ├── 修改 useChat.ts：流式消费 partial/complete 事件
  └── 修改 page.tsx：骨架屏 + 渐进追加卡片

Phase 4.2 服务端遥测（约 2 天）
  ├── 修改 api/chat/route.ts：结构化日志写入
  ├── 新增 api/telemetry/route.ts：接收选择事件
  └── 修改 RecommendationCard：点击 Map/Reserve 时上报 rank

Phase 4.3 协作式交互（约 3-4 天）
  ├── 修改 rankAndExplain：返回 suggested_refinements
  ├── 修改 page.tsx：渲染 refine chip 行
  ├── 修改 RecommendationCard：新增"对比"按钮
  └── 修改 page.tsx：compare 状态 + bottom sheet 对比面板

Phase 4.4 候选召回升级（约 2 天）
  ├── 修改 tools.ts：googlePlacesSearch 支持扩展搜索
  └── 修改 agent.ts：三阶段漏斗（召回 → 初筛 → 精排）

Phase 4.5 分享卡片（约 2-3 天）
  ├── 新增 api/share/route.ts
  ├── 修改 page.tsx：分享按钮 + 链接生成
  └── 新增 app/share/[token]/page.tsx：分享结果展示页

Phase 4.6 排序权重闭环（约 3 天）
  ├── 修改 usePreferences.ts：learnWeightsFromFeedback
  ├── 修改 agent.ts/api：接受客户端传入的自定义权重
  └── 修改 computeWeightedScore：支持外部 weights 注入
```

---

### Phase 4 成功标准

| 指标 | Phase 3 完成后 | Phase 4 完成后 |
|------|--------------|--------------|
| 首屏内容出现时间 | 8-15s | ≤3s |
| 候选池大小 | 最多 20 | 30-60 |
| 排序权重 | 固定经验值 | 随反馈动态调整 |
| Refine 方式 | 重新输入 query | 一键 chip 或继续追问 |
| 对比能力 | 无 | 并排展示 2 家 |
| 数据可见性 | 零（无日志） | 延迟分布、rank 采纳率、失败率 |
| 社交传播 | URL 复制 | 结构化分享卡片/短链接 |
| 用户留存信号 | 无 | 选择事件 + 反馈 → 权重闭环 |
