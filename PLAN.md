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
