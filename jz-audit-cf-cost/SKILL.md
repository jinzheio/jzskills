---
name: audit-cf-cost
version: "1.0.0"
description: "当需要读取、解释或核对 Cloudflare 账单、usage、计费周期费用、运行中资源成本时使用。适用于查 Cloudflare Dashboard Billable Usage、用 GraphQL Analytics API 查当前计费周期用量、评估 Durable Objects/Workers/D1/R2/KV/Queues 等付费资源的成本、发现异常计费。"
---

# audit-cf-cost

用于把 Cloudflare usage 数据解释成可核对的数字，发现当前计费周期运行中资源的意外费用。

## 核心口径

Cloudflare 不同产品按不同计费单位收费。不要用"请求数"或"bandwidth"统一估算。

| 产品 | 计费单位 | 容易放大的路径 |
|---|---|---|
| Durable Objects | duration (GB-s)、requests、storage | `server.accept()` 让对象不能 hibernate；alarm 循环；storage 写入在循环里 |
| Workers / Pages Functions | requests、CPU time (ms) | SSR 把页面请求变 Worker invocation；无鉴权 endpoint 被爬虫打 |
| D1 | rows read、rows written、storage | 无索引全表扫描；查询扫大量行但只返回少量结果 |
| R2 | storage (GB-month)、Class A ops、Class B ops | 公开文件无 cache；频繁 list/put；误选 Infrequent Access |
| KV | read/write/delete/list ops | 每请求多次读 KV；用 list 做搜索 |
| Queues | operations | consumer 一直失败反复 retry；producer 无限写入 |
| Workers AI | tokens / units（按模型不同） | endpoint 无鉴权；循环调用 |
| Images | transformations、stored、delivered | 用户输入导致大量 unique transforms；公开 endpoint 无缓存 |
| Browser Rendering | session duration | 批量页面抓取 |
| Cache Reserve | storage、read/write ops | 大文件频繁进入和读取 |
| Stream | storage minutes、delivered minutes | 测试时反复上传；公开播放页无爬虫控制 |

核账时的关键公式（按产品分别计算）：

```text
estimated cost = billable usage × rate
monthly projection ≈ (当月用量 / 当月已过天数) × 当月总天数
```

注意：
- 不同产品免费额度不同（daily vs monthly，per account vs per plan）
- 部分产品有最低计费单位（如 R2 Infrequent Access 有最小存储计费）
- DO duration 的 GB-s 按 `wall-clock 秒 × 0.125 GB (128 MB)` 计算
- DO 的 Workers Paid plan 有 400,000 GB-s / month 免费额度

## Workflow

### 1. 确认要查的范围

- 用户要查的月份或日期范围
- 是否有特定 receipt 或扣款需要核对
- 当前计费周期到今天已消耗多少

### 2. 识别涉及的资源

先看当前仓库 `wrangler.toml` / `wrangler.json` / `wrangler.jsonc` 里的 bindings 和 resources。确认每个资源的计费单位和免费额度。

### 3. 收集用量数据

按优先级尝试：

1. 如果用户已有成本监控脚本或 JSON 输出，先读已有数据
2. 调 GraphQL Analytics API 获取当前周期细粒度数据
3. 如果 API 不可用，用 Dashboard Billing 页的 Billable Usage 数字（标注为估算值）
4. 以上都不可用时，根据已知配置和运行时长手动估算（标注为估算值）

GraphQL API 调用示例 — 查 Durable Objects daily duration：

```bash
curl -s -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/graphql" \
  -d '{
    "query": "query ($accountTag: String, $filter: AccountDurableObjectsPeriodicGroupsFilter_InputObject) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          durableObjectsPeriodicGroups(filter: $filter, limit: 10000, orderBy: [date_ASC]) {
            date: dimensions { date }
            sum { durationGBs }
          }
        }
      }
    }",
    "variables": {
      "accountTag": "'"$CLOUDFLARE_ACCOUNT_ID"'",
      "filter": { "date_geq": "2026-06-01", "date_lt": "2026-07-01" }
    }
  }'
```

需要的 API Token 权限：`Account: Analytics: Read`。

其他常用 dataset：`workersInvocationsAdaptive`、`d1AnalyticsAdaptiveGroups`、`r2OperationsAdaptiveGroups`、`kvOperationsAdaptiveGroups`。

GraphQL 注意：
- `date_geq` / `date_lt` 按 UTC 解释
- 如果没有设 filter，默认取最近 7 天
- 部分 dataset 有 1h–24h 延迟

### 4. 解释并输出

向用户报告每个产品的用量、免费额度、计费用量和预估费用。如果用量接近或超过免费额度，标注 warning 并给出月末预测。

### 5. 异常检测

检查以下信号：

```text
DO duration 预测 > 免费额度 80%   → warning，检查 DO 数量和 hibernation
DO duration 预测 > 免费额度       → critical，准备 kill switch
Workers requests 预测 > 免费额度 80% → warning
Workers CPU 预测 > 免费额度 80%   → warning
D1 rows read 突增                 → warning，检查查询计划
R2 Class B ops 突增              → warning，检查缓存
当月按量费用预测 > $5             → 建议分析
当月按量费用预测 > $10            → 立即检查，必要时关停
```

建议阈值：
- 当前账期累计按量费用 > $1 时开始关注
- 当前账期累计按量费用 > $5 时排查
- 当前账期累计按量费用 > $10 时立即检查

## DO duration 快速估算

```text
1 个 128 MB DO 在线 24 小时 = 86,400s × 0.125GB = 10,800 GB-s/day
按 paid rate $0.0001/GB-s ≈ $1.08/day/object

5 个全天在线 ≈ 54,000 GB-s/day ≈ $5.40/day
30 天 × 5 个 ≈ 1,620,000 GB-s，扣除 400,000 GB-s 免费额度 ≈ 1,220,000 GB-s billable
```

## 输出格式

报告时按产品逐项列出当前用量、免费额度、计费用量、预估费用和月末预测。

如果只查到 Dashboard 估算值，标注数据来源和精度。如果用户提供了 receipt 或扣款金额，对比并解释差异。

## 与其他流程的关系

- **push-code 的 cloudflare-billing-safety.md**：上线前检查本次变更是否新增/修改付费资源。audit-cf-cost 是上线后的事后排查和日常监控，关注"已经产生了多少费用"。
- **jz-audit-vercel-cost**：同类 skill，处理 Vercel 账单。按云平台区分。

## 注意

- Dashboard 的 Billable Usage 是估算，不是最终 invoice。如果用户要核 receipt，优先用 GraphQL API。
- Budget Alerts 只是通知，不会暂停资源或限制用量。不要因为"设了 alert"就觉得安全。
- DO + WebSocket 默认必须用 `state.acceptWebSocket(server)`（WebSocket Hibernation API），不能用 `server.accept()`。后者会让 DO 在连接期间持续产生 duration 费用，这是最常见的意外账单来源。
- 新的付费 Worker 上线后 30 分钟内复查 GraphQL usage，确认没有意外的计费单位在增长。
- 如果 API 返回 `Costs not found` 或 404，说明当前 token/account 对该区间不可查；不要记成 `$0`。
