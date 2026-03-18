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
