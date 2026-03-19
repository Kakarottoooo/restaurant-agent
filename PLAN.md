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

---

## 阶段五：护城河三件套 — 真实评论信号 · 语音输入 · 用户账号

> 更新日期：2026-03-18
> 前提：Phase 4 已完成。
> 目标：补上与通用 AI 和传统 App 的三条真正差异化壁垒。Phase 4 完成后系统已经在功能层面完整，Phase 5 解决的是"为什么用户会持续来用你、而不去用 ChatGPT"这个问题：真实的评论数据让推荐结果更可信，语音输入让 refinement 体验快到不值得离开，账号系统让个性化真正跨设备积累。

---

### Phase 5.1 — 真实评论信号（Real Review Signals）

**背景与问题**

当前 `fetchReviewSignals` 用 Tavily 搜索博客/新闻片段作为"评论信号"来源，抓到的是营销内容而非真实用户反馈。AI 用这些信息生成的 noise_level、wait_time 等字段大量依赖推断，而非用户亲历。用户说"根据近期 Yelp 评论"，但实际数据并不是 Yelp 评论，这是信任风险。真正的壁垒在于：我们能提取出 Google Maps/Yelp 真实用户评论里的信号，而通用 AI 做不到这一点（它没有实时结构化评论数据）。

**目标**

对进入精排阶段的每家候选餐厅，抓取来自 Google Places Reviews API 的真实用户评论（最近 5 条，按 newest 排序），用 AI 从原文中提取结构化信号，替换当前 Tavily 摘要方案。

**数据源选择**

| 方案 | 优点 | 限制 |
|------|------|------|
| Google Places Reviews API（`reviews` 字段） | 已有 API Key，每次 Place Detail 调用自带最多 5 条评论，无额外费用 | 每家只有 5 条，且 Google 不允许批量抓取 |
| Yelp Fusion API（`reviews` endpoint） | 每家最多 3 条精选评论，免费 | 需单独 API Key，评论截断严重 |
| Tavily `site:` 定向搜索（现有方案改进） | 零新增 API 依赖 | 非结构化，依赖网页抓取质量 |

**MVP 方案：优先用 Google Places Review 字段 + Tavily 定向 Reddit/Yelp 补充**

**第一步：复用 Place Details 调用中的 `reviews` 字段**

Google Places Detail API 响应中自带 `reviews[]` 数组（最多 5 条）。当前 `lib/tools.ts` 的 `googlePlacesSearch` 只取了 `name / rating / price_level / types` 等字段，未取 `reviews`。

修改 `getPlaceDetails(placeId)` 调用，在 `fields` 参数中加入 `reviews`：

```typescript
// lib/tools.ts
const fields = [
  "place_id", "name", "rating", "user_ratings_total",
  "price_level", "formatted_address", "geometry",
  "opening_hours", "photos", "website", "types",
  "reviews"   // ← 新增
].join(",");
```

每条 review 结构：
```typescript
interface GoogleReview {
  author_name: string;
  rating: number;         // 1-5
  relative_time_description: string; // "a month ago"
  text: string;           // 用户原文，最多约 300 字
}
```

将 5 条 review 原文拼接后，传给 MiniMax 提取 `ReviewSignals`，替换当前 Tavily 搜索方案。

**第二步：Tavily 定向补充（当 Google 评论 < 3 条时）**

```typescript
// 当某家餐厅 Google 评论少于 3 条时，补一次定向搜索
const tavilyQuery = `"${restaurant.name}" ${cityName} site:reddit.com OR site:yelp.com reviews`;
```

**修改 `fetchReviewSignals` 函数签名**

```typescript
async function fetchReviewSignals(
  restaurants: Restaurant[],  // 每个 restaurant 对象此时已携带 google_reviews?
  query: string,
  cityFullName: string
): Promise<Map<string, ReviewSignals>>
```

**新增 `Restaurant.google_reviews` 字段（`lib/types.ts`）**

```typescript
export interface GoogleReview {
  author_name: string;
  rating: number;
  relative_time_description: string;
  text: string;
}

// 在 Restaurant 接口中新增
google_reviews?: GoogleReview[];
```

**AI 提取 Prompt 改进**

将当前笼统的"analyze review text"改为原文直传：

```
You are extracting structured signals from real Google Maps user reviews.
Below are up to 5 recent user reviews for "{restaurant_name}":

[Review 1 - 5 stars - "a week ago"]
"The pasta is handmade and the candlelight makes it feel intimate.
 A bit loud on Friday nights but weekday dinners are peaceful."

[Review 2 - 2 stars - "2 months ago"]
"They only accept cash. Waited 50 minutes on a Saturday."

Extract ReviewSignals from this evidence. Only report signals that appear in the text.
Be conservative: if noise level is mentioned once in a 5-star review but twice in 1-star reviews, weight the negative signal more.
```

**修改 `RecommendationCard.tsx`**

"Real reviews say"区块新增原始评论引用（最多 1-2 条摘录），用引号标注来源（"Google 用户评论"），增加可信度背书：

```
Real reviews say
🤫 安静（工作日）/ 🔊 周五嘈杂
⏱ 周末等位约 50 分钟
⚠ 只收现金

用户原话：
"The candlelight makes it feel intimate...
 A bit loud on Friday nights" — Google Maps, 1 周前
```

**成功标准**

| 指标 | 当前 | Phase 5.1 完成后 |
|------|------|----------------|
| 评论数据来源 | Tavily 博客摘要 | Google Places 真实用户评论 |
| 信号可信度 | 低（AI 推断） | 高（原文直提取） |
| 每家候选评论数 | 0 | 最多 5 条（Google） + Reddit/Yelp 补充 |
| UI 透明度 | "Real reviews say" 无来源 | 显示来源和时间 |

---

### Phase 5.2 — 语音输入（Voice Input）

**背景与问题**

用户做 refinement 时，说"更便宜一点"比打"更便宜一点"快 3-5 倍，在移动端 PWA 场景下尤其明显。底部输入栏已有麦克风按钮（Phase 1 设计），但目前只是 UI 占位，没有接真正的语音识别。语音输入是移动端最自然的 refinement 方式，接通后可以让 refine 轮次从"懒得再打字"变成"随口一句话"。

**目标**

接通底部输入栏麦克风按钮，用 Web Speech API 实现浏览器端语音识别，识别结果直接填入输入框并自动发送。支持中英文混合输入。

**技术方案**

使用浏览器原生 `SpeechRecognition` API（Chrome/Edge/Safari 均支持），不依赖外部语音服务，无额外 API 费用：

```typescript
// app/hooks/useVoiceInput.ts（新增）
export function useVoiceInput(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  function startListening() {
    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("该浏览器不支持语音输入");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";           // 中文优先
    recognition.interimResults = false;   // 只取最终结果
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  return { isListening, error, startListening, stopListening };
}
```

**交互设计**

- **短按**麦克风按钮：开始录音，按钮变为脉冲动效金色圆圈（`isListening` 状态）
- **再次点击 / 自动停止**：识别结果填入输入框，**自动触发发送**（不需要用户再点发送）
- **识别中显示**：输入框出现"正在聆听..."占位文字
- **不支持时**：麦克风按钮隐藏（`useEffect` 检测 `window.SpeechRecognition` 是否存在）
- **lang 自适应**：若 `navigator.language` 为 `en-*` 则切换为 `en-US`，支持中英混合城市名

**修改 `app/page.tsx`**

将麦克风按钮从静态 UI 改为接入 `useVoiceInput`：

```typescript
const { isListening, error: voiceError, startListening, stopListening } = useVoiceInput(
  (transcript) => {
    setInputValue(transcript);   // 填入输入框
    setTimeout(() => handleSubmit(transcript), 100);  // 自动发送
  }
);
```

麦克风按钮样式：
- 默认：深棕填充，金色麦克风图标
- `isListening`：金色填充，白色脉冲圆圈，scale 动效

**不支持浏览器的降级处理**

`useVoiceInput` 在不支持的环境返回 `isSupported: false`，`page.tsx` 据此隐藏麦克风按钮，输入栏自动扩宽填满空间。

**成功标准**

| 指标 | 当前 | Phase 5.2 完成后 |
|------|------|----------------|
| 麦克风按钮 | UI 占位，无功能 | 点击即录音，识别后自动发送 |
| Refinement 路径 | 打字 → 点发送（2 步） | 说话 → 自动发送（1 步） |
| 支持语言 | — | 中文 / 英文（自动切换） |
| 额外 API 费用 | — | 零（浏览器原生） |

---

### Phase 5.3 — 用户账号系统（Anonymous + OAuth）

**背景与问题**

目前所有个性化数据（偏好 profile、收藏、反馈、学习权重）全部存在 localStorage，换设备归零，无法在服务端积累任何关于真实用户的数据。没有用户身份，就没有：跨设备个性化、用户级推荐质量分析、后续产品的留存/转化指标、任何形式的用户增长数据。但强制注册是用户流失最大的单点——所以默认匿名，账号只在用户想保存/跨设备同步时出现。

**目标**

默认匿名使用（零门槛），自愿升级为账号（Google OAuth 或邮箱一键注册），账号注册后自动将本地数据上传合并，实现无缝过渡。使用 **Clerk** 作为账号服务（Next.js 一等支持，免费额度覆盖早期阶段，内置 Google OAuth + Email Magic Link）。

**匿名 → 账号升级流程**

```
首次打开 App
    ↓
匿名使用（localStorage 存偏好、收藏、反馈）
    ↓
触发升级提示（任意时机之一）：
  - 用户主动点击 Header 右侧"登录/保存数据"按钮
  - 用户收藏第 3 家餐厅时：弹出"创建账号以跨设备同步收藏"
  - 反馈累积 5 条时：弹出"登录以保留你的偏好记忆"
    ↓
Clerk 注册弹窗：Google 一键登录 / Email Magic Link
    ↓
注册成功后：本地 localStorage 数据迁移上云
```

**技术架构**

```
Clerk（身份认证）
    ↓
Vercel Postgres / PlanetScale（用户数据存储）
    ↓
新增 API Routes：
  /api/user/profile    — 读写 UserPreferenceProfile（替代 localStorage）
  /api/user/favorites  — 读写收藏列表
  /api/user/feedback   — 读写 FeedbackRecord
```

**新增文件**

```
app/
  api/
    user/
      profile/route.ts    — GET/PATCH UserPreferenceProfile
      favorites/route.ts  — GET/POST/DELETE 收藏
      feedback/route.ts   — GET/POST FeedbackRecord
  hooks/
    useAuth.ts            — 封装 Clerk useUser，暴露 isSignedIn / userId / isAnonymous
middleware.ts             — Clerk 中间件（保护需要登录的路由）
lib/
  db.ts                   — Vercel Postgres 连接
  schema.sql              — users / favorites / feedback / preference_profiles 表结构
```

**数据库表设计**

```sql
-- 用户偏好（替代 localStorage）
CREATE TABLE preference_profiles (
  user_id       TEXT PRIMARY KEY,   -- Clerk userId
  profile_json  JSONB NOT NULL,     -- UserPreferenceProfile
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 收藏
CREATE TABLE favorites (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  card_json     JSONB NOT NULL,     -- 快照：RecommendationCard
  saved_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, restaurant_id)
);

-- 反馈
CREATE TABLE feedback (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL,
  restaurant_id   TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  query           TEXT,
  satisfied       BOOLEAN NOT NULL,
  issues          TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**匿名用户数据迁移**

注册成功后，客户端自动执行一次迁移：

```typescript
// app/hooks/useAuth.ts
async function migrateLocalDataToCloud(userId: string) {
  const localProfile = localStorage.getItem("restaurant-preferences");
  const localFavorites = localStorage.getItem("restaurant-favorites");
  const localFeedback = localStorage.getItem("restaurant-feedback");

  await Promise.all([
    localProfile && fetch("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ profile: JSON.parse(localProfile) })
    }),
    localFavorites && fetch("/api/user/favorites", {
      method: "POST",
      body: JSON.stringify({ bulk: JSON.parse(localFavorites) })
    }),
    localFeedback && fetch("/api/user/feedback", {
      method: "POST",
      body: JSON.stringify({ bulk: JSON.parse(localFeedback) })
    }),
  ]);

  // 迁移完成后清除本地存储（数据已在云端）
  localStorage.removeItem("restaurant-preferences");
  localStorage.removeItem("restaurant-favorites");
  localStorage.removeItem("restaurant-feedback");
}
```

**修改现有 Hooks**

`usePreferences`、`useFavorites` 改为双轨模式：
- 未登录：继续读写 localStorage（零改动用户体验）
- 已登录：读写云端 API，localStorage 作为乐观更新缓存

```typescript
// 伪代码
const { isSignedIn } = useAuth();

function updateProfile(patch) {
  // 本地立即更新（乐观）
  setProfile(prev => merge(prev, patch));
  localStorage.setItem("restaurant-preferences", JSON.stringify(profile));

  // 已登录则同步云端
  if (isSignedIn) {
    fetch("/api/user/profile", { method: "PATCH", body: JSON.stringify(patch) });
  }
}
```

**Header UI 变化**

当前 Header 右侧是"Powered by Claude"文字。Phase 5.3 后：

```
Folio.  [📍 New York]  [登录]          ← 未登录
Folio.  [📍 New York]  [头像 缩写]     ← 已登录（点击展开：我的收藏 / 偏好设置 / 退出）
```

登录按钮点击 → 触发 Clerk `<SignIn>` modal，支持：
- Google 一键登录
- Email Magic Link（无需密码）

**升级触发时机（不强制，自愿）**

| 触发事件 | 提示文案 |
|---------|---------|
| 收藏第 3 家餐厅 | "保存到云端，换设备也能看到你的收藏" |
| 反馈累积 5 条 | "登录以保留你的口味记忆，让推荐越来越准" |
| 点击分享按钮 | "创建账号以查看分享给你的收藏夹" |
| 主动点击 Header 登录按钮 | — |

提示以 toast 或底部 banner 形式出现，一次会话只出现一次，不打扰用户。

**成功标准**

| 指标 | 当前 | Phase 5.3 完成后 |
|------|------|----------------|
| 个性化持久化 | localStorage，换设备归零 | 云端，跨设备同步 |
| 注册门槛 | — | Google 一键或 Email，< 30 秒 |
| 匿名可用 | 是 | 是（默认匿名，自愿升级） |
| 用户数据积累 | 零（无法分析） | 可分析真实用户偏好分布、留存、反馈模式 |
| 匿名数据迁移 | — | 注册后自动上云，无数据损失 |

---

### Phase 5 执行顺序

```
Phase 5.1 真实评论信号（约 3 天）
  ├── 修改 tools.ts：getPlaceDetails 加入 reviews 字段
  ├── 新增 GoogleReview 类型（lib/types.ts）
  ├── 修改 fetchReviewSignals：优先用 Google 评论，Tavily 补充
  ├── 改进提取 Prompt：原文直传，保守提取
  └── 修改 RecommendationCard：显示评论来源 + 原文摘录

Phase 5.2 语音输入（约 2 天）
  ├── 新增 useVoiceInput hook（app/hooks/useVoiceInput.ts）
  ├── 修改 page.tsx：接入 hook，麦克风按钮激活 + 自动发送
  └── 处理不支持浏览器的降级（隐藏按钮）

Phase 5.3 用户账号系统（约 5-7 天）
  ├── 安装 Clerk（@clerk/nextjs），配置 Google OAuth + Email Magic Link
  ├── 新增 middleware.ts
  ├── 新增数据库：Vercel Postgres，建表（preference_profiles / favorites / feedback）
  ├── 新增 lib/db.ts
  ├── 新增 api/user/profile、favorites、feedback 路由
  ├── 新增 useAuth hook
  ├── 修改 usePreferences + useFavorites：双轨模式（localStorage / 云端）
  ├── 修改 Header：未登录显示「登录」，已登录显示头像
  └── 实现匿名数据迁移逻辑（migrateLocalDataToCloud）
```

---

### Phase 5 成功标准

| 指标 | Phase 4 完成后 | Phase 5 完成后 |
|------|--------------|--------------|
| 评论数据来源 | Tavily 博客摘要 | Google Places 真实用户评论 |
| 语音 refinement | 不支持 | 说一句话自动触发搜索 |
| 个性化持久化 | localStorage，换设备归零 | 云端跨设备 |
| 注册门槛 | — | Google 一键，< 30 秒 |
| 匿名可用 | 是（默认） | 是（依然默认） |
| 可分析的用户数据 | 零 | 偏好分布、留存率、反馈模式 |
| 与通用 AI 差异化 | 中（评论信号可疑） | 高（真实评论 + 个人记忆） |

---

## 阶段六：生产部署 & 基础设施打通

> 完成日期：2026-03-18
> 状态：✅ 全部完成，线上可访问

### 完成内容

**6.1 Vercel 生产部署**
- 连接 GitHub 仓库（`Kakarottoooo/restaurant-agent`），master 分支自动部署
- 生产 URL：`https://folio-7k2fjudb1-kakarottos-projects-a3fbf575.vercel.app`
- 每次 `git push origin master` 自动触发 Redeploy

**6.2 Bug 修复**
- `proxy.ts`（Next.js 16 middleware 文件名约定）Clerk middleware 用占位符 key 时导致全站 500 → 修复为真实 key + `createRouteMatcher` 只保护 `/api/user/*`
- Reserve 按钮之前条件渲染（依赖 `opentable_url`，实际从未有值）→ 改为始终显示，链接至 Google Maps：`google.com/maps/search/?query_place_id=<place_id>`

**6.3 Clerk + Neon 全链路打通**
- Clerk Development Instance 配置完成（Google OAuth）
- Neon Postgres 数据库建表（`preference_profiles` / `favorites` / `feedback`）
- 登录、收藏、数据写入 Neon 全部验证通过

### 当前完整技术栈

| 层次 | 服务 |
|------|------|
| 前端 + API | Next.js 16 on Vercel |
| AI 推荐引擎 | MiniMax-Text-01（Anthropic 备用）|
| 地点数据 | Google Places API (New) |
| 评论信号 | Google Places Reviews + Tavily |
| 身份认证 | Clerk（Google OAuth + Email Magic Link）|
| 数据库 | Neon Postgres |
| 部署 | Vercel（GitHub 自动触发）|

### 下一阶段优先级

| 顺序 | 任务 |
|------|------|
| 1 | 邀请 3-5 个真实用户试用，收集反馈 |
| 2 | 根据真实反馈调整推荐 prompt 和评分权重 |
| 3 | 建立基础 eval 框架（固定 10 个 query，每周手工评估结果质量）|

---

## 阶段七：多品类决策引擎架构 + 酒店支持

> 规划日期：2026-03-18
> 状态：待开发
> 前提：Phase 6 生产部署完成

### 核心产品决策（已确定）

1. **单一入口，AI 自动判断品类** — 主页不做 tab 切换，用户说什么，系统自己识别是找餐厅、酒店还是其他，对话框始终是唯一入口
2. **两层 Intent 架构** — 先建好可扩展的架构，再加酒店，未来加商品/医生等无需改骨架
3. **酒店数据源：SerpApi Google Hotels** — 免费 250 次/月，注册即可用，支持实时价格+可用性
4. **日期输入：对话优先 + 日历辅助** — 用户说"下周五入住两晚"自动解析填入日历；也可直接点日历选
5. **结果：Top 10，对话式 refinement** — 不做刷新，用户继续说一句话缩小范围
6. **城市范围：全美** — 27 个大城市快捷选保留，输入框支持任意城市/地点自由输入
7. **主页示例更新** — 放两个示例，一个找餐厅、一个找酒店，用户一看就懂产品能做什么

---

### Phase 7.1 — 两层 Intent 架构重构

**目标：** 把现有的餐厅专用 `parseIntent` 改造为可扩展的两层结构，为所有未来品类打地基。

**新增类型（`lib/types.ts`）**

```typescript
// 第一层：所有品类共用
export type CategoryType = "restaurant" | "hotel" | "product" | "doctor" | "unknown";

export interface BaseIntent {
  category: CategoryType;
  budget_per_person?: number;
  budget_total?: number;
  location?: string;
  purpose?: string;             // date, business, family, solo...
  constraints?: string[];       // no chains, quiet, pet-friendly...
  priorities?: string[];        // what matters most to this user
}

// 第二层：餐厅专属（现有字段迁移过来）
export interface RestaurantIntent extends BaseIntent {
  category: "restaurant";
  cuisine?: string;
  noise_level?: "quiet" | "moderate" | "lively" | "any";
  atmosphere?: string[];
  party_size?: number;
  neighborhood?: string;
  near_location?: string;
}

// 第二层：酒店专属
export interface HotelIntent extends BaseIntent {
  category: "hotel";
  check_in?: string;            // ISO date string
  check_out?: string;
  nights?: number;
  guests?: number;
  star_rating?: number;         // 最低星级要求
  room_type?: string;           // single, double, suite...
  amenities?: string[];         // pool, gym, parking, breakfast...
  neighborhood?: string;
}

export type ParsedIntent = RestaurantIntent | HotelIntent;
```

**修改 `lib/agent.ts`**

`parseIntent` 第一步先判断 `category`，再根据 category 调用对应的专属解析逻辑：

```typescript
async function parseIntent(message, history, city, sessionPreferences, profileContext): Promise<ParsedIntent> {
  // Step 1: 判断品类（轻量调用，只返回 category）
  const category = await detectCategory(message);

  // Step 2: 根据品类解析专属字段
  if (category === "restaurant") return parseRestaurantIntent(message, ...);
  if (category === "hotel") return parseHotelIntent(message, ...);
  // 未来：if (category === "product") return parseProductIntent(...)
}
```

**修改 `runAgent`**

根据 `intent.category` 分发到对应 pipeline：

```typescript
if (intent.category === "restaurant") return runRestaurantPipeline(intent, ...);
if (intent.category === "hotel") return runHotelPipeline(intent, ...);
```

---

### Phase 7.2 — 酒店搜索 Pipeline

**新增工具（`lib/tools.ts`）**

```typescript
async function searchHotels(intent: HotelIntent): Promise<Hotel[]>
// 调用 SerpApi Google Hotels API
// 参数：q（城市/地点）, check_in_date, check_out_date, adults, hotel_class
// 返回：name, price, rating, reviews, location, amenities, thumbnail, link
```

**新增类型（`lib/types.ts`）**

```typescript
export interface Hotel {
  id: string;                   // SerpApi property_token
  name: string;
  star_rating: number;
  price_per_night: number;      // 用户选定日期的实时价格
  total_price: number;          // 含税总价
  rating: number;
  review_count: number;
  address: string;
  neighborhood?: string;
  distance_to_center?: string;
  amenities: string[];
  thumbnail?: string;
  booking_link: string;         // Google Hotels 预订链接
  description?: string;
}
```

**新增 `HotelRecommendationCard`（`lib/types.ts`）**

```typescript
export interface HotelRecommendationCard {
  hotel: Hotel;
  rank: number;
  score: number;
  why_recommended: string;
  best_for: string;
  watch_out: string;
  not_great_if: string;
  price_summary: string;        // "$189/晚，3晚共 $567（含税）"
  location_summary: string;     // "距时代广场步行 3 分钟"
  scoring?: ScoringDimensions;
  suggested_refinements?: string[];
}
```

**酒店评分维度（复用 `ScoringDimensions`，调整权重）**

```typescript
const HOTEL_DEFAULT_WEIGHTS = {
  budget_match: 0.30,           // 酒店价格敏感度更高
  scene_match: 0.25,            // 场景匹配（商务/蜜月/家庭）
  review_quality: 0.20,
  location_convenience: 0.20,   // 位置对酒店更重要
  preference_match: 0.05,
};
```

---

### Phase 7.3 — 日期输入组件

**对话解析（修改 `parseHotelIntent`）**

从用户自然语言中提取日期：
- "下周五入住两晚" → `check_in: "2026-03-27"`, `check_out: "2026-03-29"`, `nights: 2`
- "3月底" → 解析为最近的3月底日期
- 未提及日期 → `check_in: undefined`（搜索时用默认"今晚"）

**日历组件（`components/DateRangePicker.tsx`）**

- 仅在品类为酒店时显示，餐厅搜索不出现
- 对话解析出日期后自动填入日历
- 用户也可直接点击日历选日期，选完后填入对话框："入住 3月27日，退房 3月29日"
- 移动端友好，bottom sheet 形式弹出

---

### Phase 7.4 — 主页更新

**示例更新（`app/page.tsx`）**

```typescript
const DEFAULT_EXAMPLES = [
  "Romantic dinner for two, ~$80/person, quiet, no chains, Manhattan",
  "4-star hotel in Chicago downtown, $200/night, check in Friday, 2 nights, business trip",
];
```

**城市选择器扩展**

27 个大城市保留快捷选，搜索框支持自由输入任何美国城市/地区（对话框已支持，城市选择器下拉搜索也扩展为全美）。

---

### Phase 7.5 — 酒店结果卡片 UI

新增 `HotelCard.tsx` 组件，结构与 `RecommendationCard.tsx` 相似但字段不同：

```
[酒店图片]
[序号] 希尔顿时代广场  ★★★★  ⭐4.6 (2,847 reviews)
曼哈顿中城 · 距时代广场步行 3 分钟

$189/晚  ·  3晚共 $567（含税）

──────────────────────────────
Why it fits
适合商务出差：大堂有安静工作区，评论提到 WiFi 稳定，
距会议中心步行可达。

Watch out
周末噪音较大（百老汇区域）；停车 $65/晚额外收费。

[Map]  [Book on Google Hotels →]
```

---

### 执行顺序

```
Phase 7.1 两层 Intent 架构（约 3 天）
  ├── 新增 BaseIntent / RestaurantIntent / HotelIntent 类型
  ├── 修改 parseIntent：detectCategory + 分发逻辑
  ├── 修改 runAgent：按 category 分发 pipeline
  └── 确保餐厅功能回归测试通过（不破坏现有功能）

Phase 7.2 酒店搜索 Pipeline（约 3 天，需 SerpApi key）
  ├── 新增 Hotel 类型 + HotelRecommendationCard 类型
  ├── 新增 searchHotels 工具函数
  ├── 新增 runHotelPipeline（召回→初筛→AI评分→解释）
  └── 新增 /api/chat 对酒店结果的处理

Phase 7.3 日期输入组件（约 2 天）
  ├── 新增 DateRangePicker 组件
  ├── 修改 parseHotelIntent：自然语言日期解析
  └── 联动：对话解析 ↔ 日历显示

Phase 7.4 主页更新（约 1 天）
  ├── 更新示例文案（一餐厅一酒店）
  └── 城市选择器支持全美自由输入

Phase 7.5 酒店卡片 UI（约 2 天）
  ├── 新增 HotelCard.tsx 组件
  └── page.tsx 根据 category 渲染不同卡片组件
```

---

### 待接入 API

| API | 用途 | 注册地址 |
|-----|------|---------|
| SerpApi Google Hotels | 酒店实时价格 + 可用性 | https://serpapi.com |

### Phase 7 成功标准

| 指标 | 完成后 |
|------|--------|
| 品类识别 | 用户说"找酒店"自动走酒店 pipeline，说"找餐厅"走餐厅 pipeline |
| 日期解析 | "下周五两晚"正确解析为具体日期 |
| 实时价格 | 酒店卡片显示用户所选日期的真实价格 |
| 架构可扩展 | 新增商品/医生品类只需加新的 Intent 类型 + Pipeline，不改核心代码 |
| 餐厅功能 | 完全不受影响，回归测试全过 |

---

## 2026-03-18 改动记录

### Hero 封面轮播
- 新增 4 条品牌标语（方向 1/2/3/5），随机起始，每 4.5s 循环切换
- 动画：fade + translateY，副标题 60ms 延迟跟随
- 修复 hydration 错误：SSR 固定从第 0 条开始，`Math.random()` 移至 `useEffect`

### 酒店搜索 Location Bug 修复
- 根因：intent 解析 prompt 把 `cityFullName` 硬填为默认值，AI 不提取用户消息里的地点
- 修复：prompt 明确要求从用户消息提取地点（含 typo 容错），只在无地点时 fallback

---

## Phase 8 — 机票功能设计决策（2026-03-18 定稿）

### 数据源
- **SerpApi Google Flights**（已有 key，与酒店同一套 API）
- 火车票暂不做（Amtrak 无公开 API，不稳定）

### 搜索逻辑
- 信息不完整（缺出发地/目的地/日期任一）→ 先追问用户补全，再触发搜索
- 多机场城市（如纽约 JFK/LGA/EWR）→ 返回**最常用机场** + **最便宜机场**两个选项
- 默认**单程**；用户提到"往返/round trip"→ 切换为往返
- 默认**经济舱**；用户指定商务/头等→ 切换对应舱位

### 结果分组与数量
| 情况 | 返回规则 |
|------|---------|
| 默认搜索 | 直飞×3、中转1次×1、中转2次×1 |
| 用户指定直飞 | 直飞最优×5 |

### 卡片展示字段
航司 · 出发时间 · 到达时间 · 飞行总时长 · 价格 · 中转城市 + 中转时长

### 购买跳转
点击卡片 → 跳转 **Google Flights 预填链接**（出发地/目的地/日期已填好），用户一键选座支付
- 不做自动购买（需存储信用卡/账号密码，安全与合规成本过高）

### 地图模式
- 入口与餐厅/酒店相同（list/map 切换按钮）
- 地图视图：出发地 → 目的地**航线连线** + 两端标注起飞/降落时间
- 新增 `resultCategory = "flight"`，MapView 接收航线数据渲染弧线
- SerpApi `q` 参数从 `"Las Vegas"` 改为 `"hotels in Las Vegas"`，提升搜索精准度

---

## Phase 9 — 信用卡 Agent（Credit Card Recommender）

> 设计定稿日期：2026-03-18
> 核心差异点：个性化净收益计算，而非泛泛评分排序

### 背景与定位

现有产品（NerdWallet、The Points Guy）推荐信用卡的方式是"旅行类最佳：Amex Platinum"——基于通用评分，与用户真实消费结构无关。本模块的差异点是：

> 用户输入消费结构 → 系统计算每张卡对该用户的**实际年度净收益**（返现/积分价值 − 年费）→ 输出"适合你的前5张卡 + 具体多赚多少 + 开卡奖励值多少 + 注意事项"

---

### 9.1 数据层

#### 信用卡静态数据库

自己维护 `lib/creditCards.ts`（或 `data/credit-cards.json`），覆盖美国市场 30–50 张主流卡（Chase、Amex、Citi、Capital One、Discover）。

每张卡的数据结构：

```ts
interface CreditCard {
  id: string;
  name: string;                         // e.g. "Chase Sapphire Preferred"
  issuer: string;                       // e.g. "Chase"
  annual_fee: number;                   // USD，如 95
  rewards_currency: string;             // e.g. "Chase UR", "Amex MR", "cash"
  // 各消费类别积分倍率
  category_rates: {
    dining: number;                     // e.g. 3
    groceries: number;
    travel: number;
    gas: number;
    online_shopping: number;
    streaming: number;
    pharmacy: number;
    other: number;
  };
  // 积分货币兑换率（固定保守估值）
  point_value_cash: number;             // 换现金，e.g. 0.01
  point_value_travel: number;           // 换旅行，e.g. 0.015
  // 开卡奖励（与经常性收益分开）
  signup_bonus_points: number;          // e.g. 60000
  signup_bonus_spend_requirement: number; // 3个月内需消费额，e.g. 4000
  signup_bonus_timeframe_months: number; // e.g. 3
  // 注意事项
  foreign_transaction_fee: boolean;
  min_credit_score?: number;            // e.g. 700
  notes?: string[];                     // 其他坑
  // 数据时效
  last_verified: string;                // ISO date, e.g. "2026-02-01"
}
```

#### 数据维护策略

- **稳定数据**（积分率、年费）：人工录入，每季度扫一遍更新
- **开卡奖励**：定期参考 NerdWallet / The Points Guy 页面更新，标注 `last_verified`
- **不使用爬虫或第三方 API**：数据准确性是核心竞争力，宁可保守也不要引入不可控来源

#### 消费类别（与卡数据对齐）

| 类别 | 英文 key |
|------|---------|
| 餐饮 | `dining` |
| 超市 | `groceries` |
| 旅行（机票+酒店） | `travel` |
| 加油 | `gas` |
| 网购 | `online_shopping` |
| 流媒体 | `streaming` |
| 药店 | `pharmacy` |
| 其他 | `other` |

---

### 9.2 计算逻辑

#### 核心算法：边际价值计算

```
现有卡组合年度净收益 =
  Σ 每个消费类别 × 当前组合中该类别最高积分率 × 月均消费 × 12 × 积分价值
  − Σ 现有所有卡年费

候选新卡边际价值 =
  加入该卡后重新计算的年度净收益 − 现有卡组合年度净收益
```

推荐列表按**边际价值从高到低**排序，输出前5张。

#### 积分价值估值（固定保守值）

| 积分货币 | 换现金 | 换旅行 |
|---------|--------|--------|
| Chase UR | $0.010/pt | $0.015/pt |
| Amex MR | $0.010/pt | $0.015/pt |
| Citi TY | $0.010/pt | $0.014/pt |
| Capital One Miles | $0.010/pt | $0.013/pt |
| 纯现金返还卡 | 直接按比例 | — |

用户在对话开始时选择偏好（换现金 / 换旅行），计算时使用对应列。

#### 开卡奖励展示规则

**经常性年度净收益**与**开卡奖励**完全分开展示，不合并，不摊销：

```
年度经常性净收益：+$340/年（持卡每年稳定获得）
首年开卡奖励：60,000 点 ≈ $900（一次性，需3个月内消费 $4,000）
```

原因：合并会让数字虚高，用户第二年发现收益骤降体验很差；分开展示对 churner 和长期持卡用户都诚实。

---

### 9.3 用户流程

#### 首次进入（2问题快速推荐）

```
问题1：你每个月大概在哪几个类别花钱？各花多少？
       （主要类别直接列出让用户填金额，其余归入"其他"）

问题2：你现在有哪些信用卡？
       （主流卡多选列表，10秒完成）

→ 立即给出推荐结果（30秒以内）
→ 结果页底部："细化你的消费结构，让推荐更准确" 入口
```

#### 结果卡片字段

每张推荐卡展示：
- 卡名 + 发卡行 + 年费
- **加入后哪些类别分工改变**（e.g. "你的超市消费从 2x 升至 4x"）
- **每个类别具体多赚多少**
- **年度经常性净收益**（含年费抵扣后）
- **开卡奖励**（积分数 + 估值 + 消费门槛 + 时限）
- 注意事项（外汇手续费、信用分要求等）

#### 积分盘活场景（与机票/酒店联动）

当用户在机票或酒店流程中出现时，系统发出提示：

> "你之前办过 Chase Sapphire Preferred，如果告诉我你现在有多少 UR 积分，我可以帮你看能否抵扣这次旅行费用。"

- 用户提供积分余额 → 计算是否够兑换 + 差多少
- 用户忽略 → 正常走机票/酒店搜索流程，不重复追问

---

### 9.4 架构设计（与现有系统集成）

遵循现有多品类架构模式（参见 Phase 7），信用卡作为独立 module：

#### 新增类型（`lib/types.ts`）

```ts
export interface CreditCardIntent extends BaseIntent {
  category: "credit_card";
  spending_profile?: SpendingProfile;   // 用户消费结构
  existing_cards?: string[];            // 现有卡 id 列表
  reward_preference?: "cash" | "travel"; // 积分偏好
}

export interface SpendingProfile {
  dining: number;           // 月均消费 USD
  groceries: number;
  travel: number;
  gas: number;
  online_shopping: number;
  streaming: number;
  pharmacy: number;
  other: number;
}

export interface CreditCardRecommendationCard {
  card: CreditCard;
  rank: number;
  annual_net_benefit: number;           // 经常性年度净收益
  marginal_value: number;               // vs 当前卡组合
  category_breakdown: {                 // 各类别收益明细
    category: string;
    old_rate: number;
    new_rate: number;
    monthly_spend: number;
    annual_gain: number;
  }[];
  signup_bonus_value: number;           // 开卡奖励估值
  why_recommended: string;
  watch_out: string[];
}
```

#### 新增文件

| 文件 | 职责 |
|------|------|
| `data/credit-cards.json` | 信用卡静态数据库 |
| `lib/creditCardEngine.ts` | 边际价值计算核心逻辑 |
| `components/CreditCardCard.tsx` | 推荐结果卡片渲染 |
| `app/api/chat/route.ts` | 新增 `credit_card` 分支（复用现有 SSE 框架） |

#### 意图识别

在现有 `parseIntent()` 中新增 `credit_card` 分支。关键词：
- "信用卡"、"credit card"、"哪张卡好"、"积分卡"、"返现卡"、"推荐卡"

意图识别升级为**模型分类**（不用关键词匹配），避免与餐厅/酒店/机票意图产生歧义。

---

### 9.5 责任边界处理

**数据透明（比免责声明更重要）**

- 每张卡数据旁标注：`最后验证：2026年2月`
- 推荐结果末尾注明：`积分率和开卡奖励以银行官网为准，建议办卡前确认`

**页脚免责声明**

```
本工具提供信息参考，不构成金融建议，最终决策请以银行官方条款为准。
```

简短，不吓人，但必须存在。前台体验不受影响，不在每个推荐结果上堆警告。

---

### Phase 9 成功标准

| 指标 | 完成后 |
|------|--------|
| 意图识别 | 用户说"帮我找适合的信用卡"→ 走信用卡 pipeline，不误触其他品类 |
| 计算准确 | 边际价值与手算结果一致，经常性收益与开卡奖励分开展示 |
| 30秒首结果 | 用户回答2个问题后立即看到推荐，无需填完所有细项 |
| 积分联动 | 机票/酒店流程中正确触发积分余额提示，用户忽略时不阻塞流程 |
| 现有功能 | 餐厅、酒店、机票功能完全不受影响，回归测试全过 |
| 数据时效 | 每张卡标注 `last_verified`，用户可感知数据新鲜度 |

---

## Phase 9 实现总结：信用卡推荐系统架构

> 更新日期：2026-03-19
> 状态：已完成并通过 10 个场景测试验证

---

### 数据流全貌

```
用户自然语言输入
        │
        ▼
detectCategory()           ← lib/agent.ts
  关键词 + 正则双重识别
  spending context regex → "credit_card"
        │
        ▼
parseCreditCardIntent()    ← lib/agent.ts
  MiniMax LLM 解析，返回 CreditCardIntent：
  · spending_profile (10 个类别，月均 USD)
  · reward_preference: "cash" | "travel"
  · existing_cards: string[]        (已知卡 id)
  · has_existing_cards: boolean     (是否提过有卡但未命名)
  · credit_score: number | null     (0 = 无信用记录)
  · prefer_no_annual_fee: "hard" | "soft" | false
  · prefer_flat_rate: boolean
  · needs_spending_info: boolean    (消费信息不足 → 触发追问)
        │
        ▼  (needs_spending_info = true 时提前返回，UI 展示追问)
        │
        ▼
runCreditCardPipeline()    ← lib/agent.ts
  调用 recommendCreditCards()，聚合结果
        │
        ▼
recommendCreditCards()     ← lib/creditCardEngine.ts
  ┌─────────────────────────────────────────────┐
  │  1. 数据加载：ALL_CARDS = JSON → normalizeCard()  │
  │  2. 过滤层（按顺序）：                            │
  │     · 已持有的卡排除                             │
  │     · 信用分过滤（effectiveScore + 10 buffer）    │
  │     · 年费过滤（hard = 严格排除，soft = 保留+提示）│
  │     · 奖励类型过滤（travel → 排除纯 cash + CDCash）│
  │     · 平单率过滤（prefer_flat_rate）              │
  │     · 互斥卡过滤（CSP ↔ CSR 不可同时持有）        │
  │  3. 对每张候选卡调用 computeMarginalValue()       │
  │  4. 按 marginalValue 降序，取 Top 5              │
  └─────────────────────────────────────────────┘
        │
        ▼
SSE complete event         ← app/api/chat/route.ts
  · creditCardRecommendations: CreditCardRecommendationCard[]
  · missing_credit_card_fields / missing_flight_fields
  · category: "credit_card"
        │
        ▼
useChat.ts → UI 分支判断
  · needs_spending_info → 3 个追问问题
  · creditScore === 0   → 无信用记录提示 + 入门卡建议
  · creditScore < 650   → 低信用分拦截提示
  · hasUnnamedCards     → 1× 基准免责声明
  · portfolioOptimized  → "当前组合已优化"提示
  · 正常推荐            → Top N 卡片 + CreditCardCard 组件
```

---

### 核心模块说明

#### normalizeCard() — 原始数据标准化

将 `credit-cards.json` 的富结构（嵌套 sub-key、portal 费率、cap 字段）转换为引擎统一使用的扁平 `CreditCard` 结构。

**关键规则：**

| 规则 | 说明 |
|------|------|
| `maxByPrefix(rates, prefix)` | 取所有以该前缀开头的 key 的最大值 |
| `excludePortal = true`（travel） | 排除 `*_portal*` key，避免 Venture X 10x / Chase 5x 误算 |
| `isCapField()` | `value > 20` 或含 `_cap/_limit/_max` → 是上限字段，不是倍率 |
| `isSpecialtyMerchant()` | `_whole_foods/_costco/_warehouse` → 特定商户费率，不计入通用类别 |
| `rent / entertainment` | 默认 0（大多数卡不在这两项上赚积分） |

**portal 排除的影响：**
- Capital One Venture X: travel 10x → **2x**（直接订票正确费率）
- Chase Sapphire Reserve: travel 8x → **4x**
- Chase Freedom Unlimited: travel 5x → **1x**
- Amex Platinum: `travel_flights_direct_or_amex` 5x 保留 ✓

---

#### computeMarginalValue() — 边际价值计算

**核心思路：** 投资组合 delta 法

```
marginalValue = portfolioNetBenefit([...currentCards, candidate])
              - portfolioNetBenefit(currentCards)
```

**基准费率 (oldRate) 规则：**

| 场景 | 基准 |
|------|------|
| 用户已命名现有卡 | 现有卡组合对该类别的最高费率 |
| 有卡但未命名（hasExistingCards=true） | 1x（泛型 1% 现金返还卡） |
| 真正无卡（noCardsAtAll=true） | 0x（所有类别，包括 dining/groceries） |
| 租金 / 娱乐类别 | 0x（无论是否有卡，大多数卡不赚） |

**annualGain 精确计算（已修正）：**

```
annualGain = monthlySpend × 12 × (newRate × candidateCpp − oldRate × oldCpp)
```

`oldCpp` 取现有组合中该类别最优卡的积分价值，而非 candidateCpp。  
修正前为 `(newRate − oldRate) × candidateCpp`，当候选卡积分价值高于现有卡时会低估收益（Bilt 1.25cpp vs 普通卡 1.0cpp 相差 $9/yr）。

---

#### buildWatchOut() — 风险提示生成

按以下顺序追加提示（均为 string[]，UI 全量展示）：

1. **资质前置条件**（`eligibility_notes`）— 始终第一条，不可省略  
   例："Business card — requires business income"
2. **信用分风险**（`userCreditScore > 0 && score < min_credit_score`）  
   无信用记录（score=0）不触发，UI 层已有专属提示
3. **开卡奖励消费门槛**（`totalMonthlySpend × months < requirement`）  
   例：Amex Business Gold $15k/3 个月对月消费 $3.2k 用户的警告
4. **年费软偏好**（preferNoAnnualFee = "soft"）
5. **可转积分 ≠ 现金返还**（cash 用户看到可转积分卡时）
6. **外汇手续费**
7. **信用分要求 ≥ 720**（优质信用提示）
8. **年费 ≥ $400**（高年费提示）
9. **卡片 notes 中的上限/限制条款**（含 "up to" / "only" / "limit" / "require"）
10. **数据验证日期**（始终最后一条）

---

#### 过滤层详解

```
候选卡集合 = ALL_CARDS（34张）
      ↓ 排除已持有的卡
      ↓ 信用分过滤
          effectiveScore = max(creditScore, 640)
          通过条件：min_credit_score ≤ effectiveScore + 10
          注意：Discover it / C1 Quicksilver / C1 SavorOne min_credit_score = 640
                （Capital One / Discover 明确接受 fair credit 申请人）
      ↓ 年费过滤（hard）
          仅保留 annual_fee = 0 的卡
      ↓ 奖励类型过滤
          travel 用户：排除 rewards_currency = "cash" 及 EFFECTIVE_CASH_CARDS（citi-double-cash）
          cash 用户：排除 HOTEL_AIRLINE_CURRENCIES（hilton_honors / marriott_bonvoy / delta_skymiles）
      ↓ 平单率过滤（prefer_flat_rate）
          保留所有非零 category_rates 值相同的卡
      ↓ 互斥过滤
          CSP 与 CSR 不可同时持有（mutually_exclusive_with 字段）
```

---

#### 消费类别映射规则（LLM Prompt）

| 用户描述 | 映射类别 | 说明 |
|---------|---------|------|
| transit / subway / Uber / Lyft | `travel` | 不是 gas；Bilt/CSR 在 travel 下赚积分 |
| rent / apartment / housing cost | `rent` | 明确排除 other，Bilt 唯一在 rent 上赚积分的卡 |
| software / SaaS / cloud / AWS | `online_shopping` | IBP 3x internet/advertising 类别 |
| client entertainment | `dining` | 不进 entertainment 类别 |
| streaming services | `streaming` | |
| gas station / fuel | `gas` | 与 transit 分开 |
| 剩余金额 | `other` | 不要凭空发明类别 |

---

#### 数据库（credit-cards.json）结构

```
{
  "meta": { "last_updated": "..." },
  "point_currencies": {
    "chase_ur":          { cpp_cash, cpp_travel_portal }
    "amex_mr":           { cpp_cash, cpp_travel }
    "capital_one_miles": { cpp_cash, cpp_travel }
    "bilt_points":       { cpp_cash: 0.0125, cpp_travel: 0.015 }
    "cash":              { cpp_cash: 0.01 }
    ...
  },
  "cards": [  // 34 张卡
    {
      "id": "chase-sapphire-preferred",
      "annual_fee": 95,
      "rewards_currency": "chase_ur",
      "category_rates": {
        "dining": 3,
        "travel_chase_portal": 5,   // portal 费率（normalizeCard 时排除）
        "travel_other": 3,          // 直接订票费率（实际使用）
        ...
      },
      "signup_bonus": { "points", "spend_requirement", "timeframe_months" },
      "eligibility_notes": ["Subject to Chase 5/24 rule"],
      "mutually_exclusive_with": ["chase-sapphire-reserve"],
      "min_credit_score": 700,
      "last_verified": "2026-03-19"
    },
    ...
  ]
}
```

**关键设计决策：**
- portal 费率保存在 JSON 中（如 `travel_chase_portal: 5`），但 `normalizeCard` 时用 `excludePortal=true` 排除，确保比较的是真实直接订票费率
- `online_advertising` key（Ink Business Preferred / Amex Business Gold）等价于 `online_shopping`，在引擎中通过共同前缀匹配合并
- `top_two_categories_auto_4x` 等复杂机制在 JSON 中保留为数字，引擎按固定费率处理，watch_out 补充说明动态规则

---

### 已验证的 10 个场景

| # | 场景 | 关键验证点 | 状态 |
|---|------|-----------|------|
| 1 | 重度差旅，已有 Amex Plat + CSR | 边际价值接近 0，不推重复卡 | ✅ |
| 2 | 学生，第一张卡，无信用记录 | noHistory 提示 + 入门卡推荐 | ✅ |
| 3 | 家庭主力，软拒年费，娱乐消费 | entertainment 类别，SavorOne 排名 | ✅ |
| 4 | 有 4 张卡但不知名字 | hasUnnamedCards 免责声明，1x 基准 | ✅ |
| 5 | Freelancer，软件支出 $1.5k | IBP 3x 确认 + SaaS watch-out | ✅ |
| 6 | 夫妻共同消费，组合优化 | 多卡协同边际值 | ✅ |
| 7 | 信用分 650，无卡，要现金返还 | lowCredit 拦截 + 仅推 640 门槛卡 | ✅ |
| 8 | NYC 租房，外出就餐，偏好积分 | Bilt #1，transit→travel 映射 | ✅ |
| 9 | 已有完整卡组合测试边际价值 | 开卡奖励门槛 watch-out，边际≈0 | ✅ |
| 10 | 信息模糊，容错测试 | 基准卡推断，has_spending_info 追问 | ✅ |

---

### 已知边界与局限

| 问题 | 当前处理 | 理想方案 |
|------|---------|---------|
| Amex Business Gold "top 2 categories" 动态机制 | 按固定 4x 处理 + watch_out 说明 | 需对每月消费动态计算 top 2 |
| 用户描述的卡无法匹配 existing_cards id | MiniMax 解析失败时退化为 hasExistingCards=true | 模糊匹配或更完整卡名映射表 |
| Case 10 卡片推断不透明 | 接受推断结果 | UI 展示"我们假设你持有 X 卡，基于..." |
| CDCash TY 积分对 travel 用户的价值 | 过滤掉（EFFECTIVE_CASH_CARDS） | 若配合 Strata Premier 则可转积分，需要联动判断 |
| 门店 portal 费率（C1/Chase portal 5x/10x） | normalizeCard 排除，watch_out 说明 | 可对"习惯通过 portal 订票"用户展示 portal 费率版本 |

---

---

## Phase 10：笔记本电脑推荐系统

Phase 10
笔记本电脑推荐系统
执行计划 v2  ·  2026-03-19
状态：设计完成，开始实现前必读
在写第一行代码之前，必须先完成三件事
1.  填完本文档中的归一化规则表（每个 signal_type 的 0-10 换算规则）
2.  填完权重矩阵表（7 种用途 × 8 种信号维度 = 56 个数字）
3.  手动跑 5 台机器的信号提取流程，验证 LLM prompt 质量

这三件事不做，Milestone 2 和 3 写到一半会因为基础没打好返工。


0  相对原计划的改动

改动汇总（相对原 Phase 10 文档）
① raw_quote 字段  —  device_review_signals 补加 raw_quote TEXT，Watch Out 展示和 debug 必须
② Milestone 顺序调整  —  手动验证前置于爬虫自动化之前，避免带着 bug 跑自动化
③ Milestone 3+4 并行  —  意图解析和评分引擎接口定义后可同时开发，不再串行
④ 归一化规则表  —  补全所有 signal_type 的具体换算规则（原文档缺失）
⑤ 权重矩阵  —  补全全部 7 种用途的权重（原文档仅有 software_dev 示例）
⑥ Fallback 逻辑  —  补充信号不足时的降级处理规则（原文档未覆盖）
⑦ Citi Double Cash 警告修正  —  等价于 cash back，Watch Out 不应标注为 transferable points


1  数据库 Schema

1.1  四张核心表

与原文档一致，新增 raw_quote 字段。

device_review_signals  —  新增字段
raw_quote  TEXT  —  提取来源的原始句子，用于 Watch Out 展示和人工 debug
示例："The keyboard feels mushy and the key travel is disappointingly shallow"

此字段是 Watch Out 功能的基础。没有 raw_quote，用户只能看到一个数字，无法判断来源是否可信。

1.2  sku_performance_signals  的 applies_to 字段

原文档 sku_performance_signals 挂在 sku_id 下，但评测文章里的配置建议通常是范围性的（"8GB 不够"而非针对某个具体 SKU）。建议改为挂在 device_id + ram 范围下：

•applies_to_ram_max: INTEGER  —  适用上限，NULL 表示不限
•applies_to_ram_min: INTEGER  —  适用下限，NULL 表示不限
•applies_to_storage_min: INTEGER  —  存储下限，NULL 表示不限
•use_case: VARCHAR  —  适用用途标签，NULL 表示通用

⚠ sku_id 作为 FK 保留，但 applies_to 范围字段是主要查询路径。8GB 的 MacBook Air M3 做视频剪辑这类查询应走范围查询而非 sku_id 精确匹配。


2  归一化规则表（实现前必须填完）

为什么单独列出这张表
原文档写了"各 signal_type 独立规则"但没有写规则内容。
提取层输出 value_raw，归一化层独立运行 —— 两步必须分开，否则出错时无法定位。
LLM 提取时不直接输出 value_normalized，只输出 value_raw + value_label。

Signal Type	原始值形式	归一化规则
battery_life	小时数  e.g. "11.5h"	≥12h=10 / 10-12h=8 / 8-10h=6 / 6-8h=4 / <6h=2
display_brightness	nits  e.g. "1200 nits"	≥1000=10 / 800-1000=8 / 600-800=6 / 400-600=4 / <400=2
display_quality	标签  excellent/good/average/poor	excellent=9 / good=7 / average=5 / poor=2
keyboard_feel	标签  excellent/good/mediocre/poor	excellent=9 / good=7 / mediocre=3.5 / poor=2
trackpad_feel	标签  excellent/good/average/poor	excellent=9 / good=7 / average=5 / poor=2
thermal_performance	标签 + 噪音 dB	无限速+静音=10 / 轻微限速=7 / 明显限速=4 / 严重=2
fan_noise	dB 或标签	静音(<35dB)=10 / 轻(35-40)=7 / 中(40-45)=5 / 响(>45)=2
build_quality	标签  premium/solid/plasticky/flimsy	premium=9 / solid=7 / plasticky=4 / flimsy=2
port_selection	接口数量 + 类型	USB-C×2+USB-A+HDMI+SD=10，每缺一项-1.5，无 USB-A=-2
weight_portability	kg 实测值	≤1.2kg=10 / 1.2-1.5=8 / 1.5-1.8=6 / 1.8-2.2=4 / >2.2=2
value_for_money	LLM 综合判断	exceptional=9 / good=7 / fair=5 / poor=2
repairability	iFixit 分或标签	≥8=10 / 6-7=8 / 4-5=5 / ≤3=2

⚠ CPU/GPU 跑分使用 log-scale 归一化（见原文档 1.6 节），不在此表重复。


3  权重矩阵（实现前必须填完）

7 种用途 × 8 个信号维度。绿色 = 高权重（≥0.20），红色 = 低权重（≤0.05）。所有行横向加总应等于 1.00。

用途	续航	散热/噪音	键盘	屏幕	做工	接口	重量	性价比
light_productivity	0.20	0.05	0.15	0.15	0.10	0.10	0.15	0.10
software_dev	0.20	0.20	0.15	0.10	0.10	0.10	0.10	0.05
video_editing	0.10	0.25	0.10	0.20	0.10	0.05	0.10	0.10
3d_creative	0.05	0.30	0.10	0.15	0.10	0.05	0.10	0.15
gaming	0.05	0.30	0.10	0.15	0.15	0.05	0.05	0.15
data_science	0.15	0.25	0.10	0.10	0.10	0.10	0.10	0.10
business_travel	0.25	0.05	0.15	0.10	0.15	0.10	0.15	0.05

⚠ 此矩阵是初始版本，基于领域判断手工填写。积累用户反馈后可替换为数据驱动的权重。


4  Fallback 逻辑（原文档缺失）

MVP 初期数据稀疏，信号不足是常态而非边缘情况。必须在实现前定义降级规则。

4.1  信号覆盖度惩罚

•1 条信号：score × 0.6，UI 展示「仅 1 个来源，仅供参考」
•2 条信号：score × 0.8
•3 条及以上：不惩罚
•0 条信号：该维度权重转移给 value_for_money，不显示该维度评分

4.2  信号全部超过 6 个月

•time_decay 已经处理分数衰减
•UI 额外显示橙色 badge「评测数据较旧，建议查阅最新评测」
•不阻止推荐，但降低该设备的整体排名置信度

4.3  用途匹配信号为 0

•use_case_fit 退化为纯规格参数估算
•CPU 基准分 × 0.5 + 内存规格分 × 0.3 + 存储速度 × 0.2
•UI 标注「基于规格估算，无实测评价」

4.4  数据库中无匹配设备

•返回「当前数据库未收录符合条件的机型」提示
•引导用户放宽预算或调整用途
•不允许返回空列表而不给任何说明


5  信号冲突处理（补充细节）

原文档已定义变异系数阈值，此处补充 Watch Out 展示规则。

5.1  加权合并公式

weighted_score 计算
score = Σ(value_normalized × source_weight × signal_type_weight × time_decay)
         / Σ(source_weight × signal_type_weight × time_decay)

time_decay = e^(-0.1 × months_since_review)
signal_type_weight = 来源 × signal_type 的交叉权重（不同媒体在不同维度专长不同）

示例：RTINGS 的 display_brightness 权重 = 0.98，keyboard_feel 权重 = 0.70
      Wirecutter 的 keyboard_feel 权重 = 0.88

5.2  冲突披露规则

•conflict_score = std_dev(values) / mean(values)  （变异系数）
•conflict_score > 0.4：不合并为单一分数，改为展示区间
•展示格式：「键盘手感：Wirecutter 评分 8.2 / NotebookCheck 评分 5.1 — 评测存在分歧，建议亲自试用」
•同时展示各来源 raw_quote，让用户判断哪个评测条件和自己更接近

⚠ 冲突本身是有价值的信息。隐藏分歧然后给用户一个平均值，比展示分歧更容易误导用户。


6  手动验证流程（Milestone 0）

为什么手动验证要单独列为 Milestone 0
爬虫自动化是在手动验证跑通之后才值得做的事。
先跑通 5 台机器，发现 prompt 问题 → 修 prompt → 再跑 → 确认稳定 → 再做自动化。
不做这一步，Milestone 2 的爬虫跑出来的数据质量无法保证。

执行步骤

选 5 台有代表性的机器（建议：MacBook Air M3 / ThinkPad X1 Carbon / Dell XPS 15 / ASUS Zenbook 14 / Lenovo IdeaPad Slim 5）

•手动找每台机器的 Wirecutter 和 NotebookCheck 评测全文
•把评测全文喂给 LLM，运行 signal 提取 prompt
•检查输出：value_raw 准确吗？value_label 合理吗？raw_quote 有没有截断？
•把 value_raw 手动代入归一化规则，确认 value_normalized 计算正确
•把两个来源的信号 INSERT 进数据库，运行 weighted_score 函数
•检查最终评分是否符合直觉（MacBook Air 续航应该高，XPS 15 散热应该中等）
•发现问题 → 修 prompt 或归一化规则 → 重跑 → 确认稳定

⚠ 整个流程大概 1-2 天。这是最便宜的返工机会 — 比写完爬虫之后发现数据质量不对要便宜得多。

Phase 10 扩展架构：多品类支持
核心设计原则
引擎不知道品类，品类不知道引擎。所有品类特定的知识（信号类型、归一化规则、权重矩阵、来源列表）都封装在 CategoryConfig 里，引擎只接收配置和数据，执行计算。新增品类 = 新增一个 CategoryConfig 模块，引擎代码零改动。

数据库层改动
device_models 和 device_review_signals 加一个 category 字段：
sqlALTER TABLE device_models ADD COLUMN category TEXT NOT NULL DEFAULT 'laptop';
-- 取值: laptop / smartphone / headphones / monitor / tablet

ALTER TABLE device_review_signals ADD COLUMN category TEXT NOT NULL DEFAULT 'laptop';
signal_type 不再是全局枚举，改为品类内有效值由 CategoryConfig 校验。数据库层只存字符串，校验逻辑在应用层。
device_skus 不需要改，SKU 的差异化字段（ram、storage、cpu_variant）已经足够通用，手机/耳机的 SKU 差异（颜色、存储容量）也能用同样的字段表达。

CategoryConfig 接口定义
typescriptinterface CategoryConfig {
  // 品类标识
  category: CategoryType;
  displayName: string;

  // 该品类支持的信号类型（枚举）
  signalTypes: string[];

  // 归一化规则：value_raw → value_normalized (0-10)
  // 每个 signal_type 一个函数
  normalizers: Record<string, (raw: string | number) => number>;

  // 来源权重（该品类专属，同一媒体在不同品类专长不同）
  sourceWeights: Record<string, number>;

  // 来源 × signal_type 的交叉权重
  sourceSignalWeights: Record<string, Record<string, number>>;

  // 用途标签
  useCaseLabels: string[];

  // 权重矩阵：用途 → signal_type → 权重
  useCaseWeightMatrix: Record<string, Record<string, number>>;

  // Intent 解析的 prompt 片段（品类特定的字段提取规则）
  intentParseHints: string;

  // 爬取来源列表（评测媒体的文章列表页 URL）
  crawlSources: CrawlSource[];
}

interface CrawlSource {
  name: string;
  listPageUrl: string;
  tier: 1 | 2 | 3;  // 1=权威 2=专业 3=用户
}

评分引擎接口
引擎函数签名加一个 config 参数，其余逻辑不变：
typescriptfunction recommendDevices(
  intent: DeviceIntent,
  config: CategoryConfig,      // 新增，替代原来硬编码的笔记本逻辑
  spending?: SpendingProfile   // 信用卡场景复用，设备场景不用
): DeviceRecommendationCard[]

function computeWeightedScore(
  signals: ReviewSignal[],
  signalType: string,
  config: CategoryConfig       // 从 config 取 sourceWeights 和 normalizers
): SignalScore

function computeUseCaseFit(
  device: DeviceModel,
  signals: ReviewSignal[],
  useCases: string[],
  config: CategoryConfig       // 从 config 取 useCaseWeightMatrix
): number

各品类的 CategoryConfig 填写时机
现在填（笔记本）：就是执行计划正文第 2、3 节的归一化规则表和权重矩阵，笔记本作为第一个 CategoryConfig 实现。
等笔记本跑稳后再填：
品类核心 signal_type 差异主要来源建议启动时机smartphonecamera_main / camera_video / 5g_performance / gaming_performance / software_support_yearsMKBHD / GSMArena / The Verge / AnandTech笔记本 MVP 上线后headphonesnoise_cancellation / soundstage / bass_response / comfort_long_wear / call_quality / codec_supportRTINGS / The Verge / WirecutterAudio / rtings.com笔记本 MVP 上线后monitorcolor_accuracy / response_time / refresh_rate / hdr_quality / reflection_handling / input_lagRTINGS / TFTCentral / Hardware Unboxed有用户需求时tabletapple_pencil_latency / keyboard_cover_quality / software_ecosystem / battery_life / portabilityThe Verge / Wirecutter / NotebookCheck有用户需求时
耳机之所以和手机同优先级，是因为 RTINGS 对耳机的数据覆盖是所有品类里最完整的，信号提取质量最容易保证，冷启动成本低。

意图解析层的扩展方式
每个品类有自己的 IntentType，但共用同一个 detectCategory 路由函数：
typescripttype DeviceCategory = 'laptop' | 'smartphone' | 'headphones' | 'monitor' | 'tablet';

// 路由函数，按关键词判断品类，复用现有 detectCategory 模式
async function detectDeviceCategory(message: string): Promise<DeviceCategory>

// 每个品类独立的 Intent 类型
interface LaptopIntent extends BaseDeviceIntent {
  os_preference: 'mac' | 'windows' | 'linux' | 'any';
  gaming_required: boolean;
  display_size_preference: '<14' | '14-15' | '15+' | 'any';
}

interface SmartphoneIntent extends BaseDeviceIntent {
  os_preference: 'ios' | 'android' | 'any';
  camera_priority: 'critical' | 'preferred' | 'flexible';
  size_preference: 'compact' | 'standard' | 'large' | 'any';
}

interface HeadphonesIntent extends BaseDeviceIntent {
  form_factor: 'over_ear' | 'in_ear' | 'on_ear' | 'any';
  anc_required: boolean;
  primary_use: 'commute' | 'office' | 'gym' | 'studio' | 'any';
  wired_ok: boolean;
}

interface BaseDeviceIntent {
  category: DeviceCategory;
  budget_usd_max: number | null;
  budget_usd_min: number | null;
  use_cases: string[];
  portability_priority: 'critical' | 'preferred' | 'flexible';
  avoid_brands?: string[];
  existing_device?: string;
}

新增品类的完整工作量
以后要加手机，需要做的事情：

填写 SmartphoneCategoryConfig（signal 枚举 + 归一化规则 + 权重矩阵 + 来源列表），参考笔记本的格式
手动验证 5 台手机的信号提取（同 Milestone 0 的流程）
填写 SmartphoneIntent 的 parse prompt hints
在 detectDeviceCategory 里加手机关键词
加 UI 的 SmartphoneCard 组件

引擎代码、爬虫框架、数据库 schema、评分函数——全部不动。


7  执行 Milestones

共 6 个 Milestone。M0 和 M1 串行，M3 和 M4 并行，M5 依赖 M3+M4。

Milestone 0  手动验证	前置必做

目标：在写爬虫之前，手动跑通 5 台机器的完整链路，验证 prompt 质量和归一化规则。

□选定 5 台测试机型
□填完第 2 节归一化规则表（本文档）
□填完第 3 节权重矩阵（本文档）
□手动提取 5 × 2 来源 = 10 篇评测的信号
□INSERT 进数据库，运行 weighted_score，检查结果符合直觉
□修复 prompt 问题，重跑直到 5 台机器结果稳定

Milestone 1  数据层	待实现

目标：建好数据库，填入初始数据。价格先用 MSRP，不等 API。

□建立 PostgreSQL schema（四张核心表 + source_sitemap 表）
□device_models 初始数据录入（20 款主流机型）
□device_skus 初始数据录入（每款 2-3 个 SKU）
□价格字段填入 MSRP，price_source = "msrp"
□source_sitemap 表建立，录入 Wirecutter / NotebookCheck / RTINGS 的文章列表页 URL
□把 M0 手动验证的 10 条信号导入 device_review_signals

Milestone 2  爬取与提取 Pipeline	待实现

目标：自动化信号采集。在 M0 验证 prompt 稳定后才开始此 Milestone。

□实现列表页爬虫（抓取文章索引，对比 source_sitemap，发现新 URL）
□实现单文章爬取 + content_hash 计算
□实现 LLM 信号提取 Prompt（输入：文章全文；输出：signal JSON 含 value_raw + value_label + raw_quote）
□提取层与归一化层分离 — 提取层只输出 raw，归一化层独立运行
□实现归一化函数（按第 2 节规则表，每个 signal_type 独立）
□实现 30 天重爬调度（cron job + content_hash diff + is_stale 标记）
□实现新 URL 发现 → 加入爬取队列的逻辑
□冲突监控：conflict_score 从 <0.3 升到 >0.5 时触发 review_needed 标记

Milestone 3 和 4 可并行开发  —  接口定义后互不阻塞

Milestone 3  评分与排序引擎	待实现

目标：给定用户的 LaptopIntent，输出排序后的推荐列表。

□实现 weighted_score() 聚合函数（含 time_decay + source_weight + signal_type_weight）
□实现覆盖度惩罚（1 条信号 × 0.6，2 条 × 0.8，0 条转移权重）
□实现冲突检测（变异系数 > 0.4 触发分歧披露，保留 raw_quote 供展示）
□实现权重矩阵加载（按第 3 节，7 用途 × 8 信号）
□实现 use_case_fit 计算
□实现 final_score 排序（含 portability_priority 动态权重调整）
□实现 Fallback 逻辑（按第 4 节规则）
□实现 CPU/GPU 基准归一化（log-scale 相对参考点）
□单元测试：5 台手动验证机型的评分结果符合预期

Milestone 4  意图解析	待实现

目标：把用户自然语言转成结构化 LaptopIntent，复用 credit card agent 的 parse 模式。

□实现 LaptopIntent 解析 Prompt
□实现用途多标签分类（一次查询可包含多个用途）
□实现 os_preference / budget / portability_priority / display_size 提取
□实现追问逻辑：budget 缺失时追问，用途完全模糊时给选项让用户选
□接口对齐：LaptopIntent → recommendLaptops(intent) 输入格式确认

Milestone 5  UI 组件	待实现

目标：把推荐结果渲染成可用的卡片界面。依赖 M3 + M4 完成。

□LaptopCard 组件：型号名 / 用途匹配分 / 价格 / 关键信号条形图
□信号冲突 Watch Out 展开区域（各来源原始值 + raw_quote + 分歧区间）
□低覆盖度提示 badge（1 个来源 / 数据较旧）
□last_verified 日期 badge + 「数据有误？」反馈入口
□价格展示：MSRP + Associates 链接，注明「参考价，点击查看最新」
□SKU 升级提示：检测到 sku_performance_signals 负面信号时，自动展示「建议升级到 16GB 版本 +$200」


8  已解决的关键设计决策

决策点	选定方案	原因
设备粒度	device_models + device_skus 两层	型号属性稳定，SKU 价格每日变动，评测信号挂在 model 层
raw_quote	必须存储，不可省略	Watch Out 展示和 debug 的基础，没有它分数无法被用户验证
信号冲突	变异系数 >0.4 触发披露，展示区间而非强制合并	保留信息完整性，隐藏分歧比展示分歧更容易误导用户
过时检测	content_hash + 30 天重爬 + 列表页发现 + 冲突异常监控	无法实时感知无声修改，组合防御将伤害控制在可接受范围
价格冷启动	MSRP 硬编码，Associates 申请中，Keepa API 备选	PA API 门槛高，先跑通产品逻辑，价格实时化是第二阶段
基准归一化	log-scale 相对参考点，Intel i5-1235U = 5.0/10	避免跑分数值域差异，每翻倍 +1 分，可解释性强
权重矩阵	静态矩阵 7 用途 × 8 信号，手工填写	初期可控，积累用户反馈后可机器学习替代
Milestone 顺序	M0 手动验证前置于 M2 爬虫自动化	手动验证是最便宜的返工机会，不做这步爬虫跑出来的数据质量无保证
M3+M4 并行	接口定义后同时开发评分引擎和意图解析	两者无数据依赖，串行开发浪费时间
Fallback	信号不足时降级到规格估算，UI 明确标注	MVP 初期数据稀疏是常态，必须预先定义降级规则


Folio.  ·  Phase 10 执行计划  ·  2026-03-19