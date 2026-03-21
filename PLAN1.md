
**多品类推荐器 → 场景化决策引擎 → 轻执行代理**
拆成了可以一步步落地的代码与产品路线。
## 这份 plan1.md 的核心内容
一共重点解决了 5 件事：

### 1. 先重构你的代码骨架
不是推倒重写，而是基于你现有结构做“加中间层”的改造：

* 保留现有 `runXxxPipeline()` 和各品类 engine
* 从 `lib/agent.ts` 里拆出：

  * `llm/`
  * `agent/category.ts`
  * `agent/scenario.ts`
  * `agent/parse/`
  * `agent/pipelines/`
  * `agent/planners/`
  * `agent/composer/`
  * `agent/execution/`

这样你后面加“场景编排”和“执行层”时，不会继续把 `agent.ts` 堆成 3000 行。
---

### 2. 新增 Scenario 层
不是用户一来就只做 category routing，而是先加一层：

* `detectScenario()`
* `parseScenarioIntent()`
* `runScenarioPlanner()`

让系统先判断：
* 这是普通单品类请求
* 还是一个真实任务场景

我在 plan 里明确先只做 3 个场景：

1. `date_night`
2. `weekend_trip`
3. `big_purchase`

因为这 3 个最适合你现有能力复用。
---

### 3. 把输出从“卡片列表”改成“方案”

我在 plan 里定义了新的类型体系：

* `ScenarioIntent`
* `DecisionPlan`
* `PlanOption`
* `PlanAction`
* `PlanExecutionRecord`
* `PlanOutcomeFeedback`

也就是说，前端以后不只是接：

* `restaurantCards`
* `hotelCards`
* `flightCards`

而是可以接：

* `primary_plan`
* `backup_plans`
* `risks`
* `next_actions`

这才是从“推荐”走向“决策”的关键。
---

### 4. 前端从 category mode 升级成 scenario mode

我在 plan 里把前端也重新定义了：
当前：

* 按 `resultCategory` 渲染
下一阶段：

* 按 `resultMode` 渲染
支持：

* `category_cards`
* `scenario_plan`
* `followup_refinement`
* `execution_actions`

然后新增这些组件：

* `ScenarioBrief.tsx`
* `PrimaryPlanCard.tsx`
* `BackupPlanCard.tsx`
* `ActionRail.tsx`
* `ScenarioEvidencePanel.tsx`

这样原来的卡片不会丢，而是从“主输出”降级成“证据层”。
---

### 5. 新增执行层和方案闭环

这是你最缺的一块，我在 plan 里也单独展开了：

#### 执行层先只做轻执行

不碰自动支付，不碰自动预订，先做：

* deep link 预填
* share
* add to calendar
* refine
* swap backup
* open / reserve / book 跳转

#### 数据库新增 3 张表

* `decision_plans`
* `plan_actions`
* `plan_outcomes`

这样你开始能追踪：

* 主方案采纳率
* 备选切换率
* 哪类方案最容易被放弃
* 哪类场景最容易满意/不满意

这一步特别关键，因为从这里开始，你的产品才真正有“方案级 learning loop”。

---
## 我帮你规划的执行顺序

不是一口气全做，而是严格按这个顺序：

1. **Phase 1：重构骨架**
2. **Phase 2：先做 Date Night OS**
3. **Phase 3：前端决策台组件化**
4. **Phase 4：再做 Weekend Trip OS**
5. **Phase 5：执行层 + 数据库**
6. **Phase 6：再做 Big Purchase OS**
7. **Phase 7：方案级 refinement**

这个顺序的核心逻辑是：

**先搭骨架 → 再做一个最容易闭环的场景 → 再扩展第二第三个场景 → 最后做真正的持续协作式 refinement**

这样风险最小，也最符合你现在已有代码资产。

---

## 你现在最应该抓住的一句话

你现在不是缺更多引擎。
你缺的是：
**把已有引擎组织成“方案”，再把方案组织成“动作”。**

这份 plan1.md 就是完全围绕这个目标写的。

如果你要，我下一步可以直接继续做第二份：
**把这份 plan1.md 再拆成 engineering task list，具体到每个文件改什么、先后顺序、接口签名怎么定义。**
