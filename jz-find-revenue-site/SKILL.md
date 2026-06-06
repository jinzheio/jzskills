---
name: jz-find-revenue-site
description: 获取与某个网站相似的高收入网站，或获取最近出现的高收入网站。用于用户说"获取与 xxx 相似的高收入网站""找 xxx 的相似站点里收入高的网站""查看 Similarweb 相似站点""查看 TrustMRR 同类型站点""获取最新的高收入网站""找最近赚钱的网站""按流量/收入阈值筛网站"时。默认结合 Similarweb、Semrush、TrustMRR、域名注册时间和公开页面证据。
---

# 高收入网站发现

## 目标

找出已经有流量或收入证据的网站，输出可核验的候选表。这个 skill 只负责发现、补数、筛选和判断。

## 配置与路径

本 skill 的配置文件在：

```bash
~/.config/skills/find-revenue-site/config.toml
```

凭据文件在：

```bash
~/.config/skills/find-revenue-site/.env
```

首次使用时，将 skill 目录下的 `config.example.toml` 和 `.env.example` 复制到上述路径并填入实际值。

也支持将配置文件放在 skill 本地目录（`config.toml` 和 `.env`），作为未配置全局文件时的回退。优先级：`~/.config/skills/find-revenue-site/` > skill 目录本地。

运行前先读取 config.toml。`paths.skill_root` 是 `ptr` CLI 代码所在的目录，所有 `uv run python -m ptr.cli` 命令都在这个目录下执行。`paths.data_root` 是主数据目录，sqlite、csv、raw/cache 和 reports 都在这里。配置中的路径允许使用 `~`，读取后必须展开成用户 home 目录。

运行项目命令前加载凭据，但不要输出凭据：

```bash
cd <paths.skill_root>   # 展开 ~/.claude/skills/find-revenue-site
set -a; source <credentials.env_file>; set +a   # 展开 ~/.config/skills/find-revenue-site/.env
uv run --with requests python -m ptr.cli <subcommand> ...
```

paths 展开规则：
- `paths.skill_root` → skill 代码目录，cd 到这里
- `paths.sqlite` → `--db` 参数
- `paths.trustmrr_csv` → `--trustmrr-csv` / `--export` 参数
- `paths.reports` → `--output` 的报告目录
- `paths.similarweb_raw` → `--raw-dir` 的父级（实际 raw 数据会按月份/子目录组织）

## 触发模式

### 与某站相似的高收入网站

用户给出 `example.com` 或产品名时：

1. 归一化域名，查本地库和历史报告是否已有该站、同类站或相似站：
   - `paths.sqlite`（`paid_traction_radar.sqlite3`）
   - `paths.trustmrr_csv`（`trustmrr-latest.csv`）
2. 查 Similarweb similar sites。优先用 dash API，不用 Similarweb 公网页摘要代替：
   - endpoint 读取 `dash_api.similar_sites_url`
   - 常用参数读取 `dash_api.defaults`，并传入 `key=<domain>`
   - 原始 JSON 保存到 `paths.similarweb_raw/similar-sites/`
3. 查 TrustMRR 同类型站点：
   - 优先使用最新本地快照；快照过旧或用户要当前数据时运行 `fetch-trustmrr`。
   - 按域名、产品名、category、网站 title、关键词匹配。
4. 查 Semrush 竞品和搜索流量：
   - 先读配置中的 `semrush` 段。默认使用 Semrush dash API，不使用官方 API 或 MCP。
   - 如果需要选择 Semrush 节点，使用 `semrush.preferred_node`，不要使用 `semrush.avoid_node`。
   - 如果 dash API 暂时不可用，复用 `paths.reports/*semrush*.csv`，缺口写 `unknown`，不要编数字。
5. 对候选站逐个补：
   - 月访问总量。
   - TrustMRR 30 日收入、MRR、总收入、30 日增长。
   - Semrush organic traffic、paid traffic、主要关键词或竞品关系。
   - 支付网关跳出访问。
   - 注册时间。
   - 首页 title、description、H1/H2 或公开页面说明。

### 最新高收入网站

用户要求"最新""最近出现""新站""本月/本周"时：

1. 刷新或导出 TrustMRR：

```bash
# 刷新（从 API 拉取）
uv run --with requests python -m ptr.cli fetch-trustmrr \
  --db <paths.sqlite> \
  --export <paths.trustmrr_csv>

# 或仅导出已有快照
uv run --with requests python -m ptr.cli export-trustmrr \
  --db <paths.sqlite> \
  --output <paths.trustmrr_csv>
```

2. 从 TrustMRR 取最近出现、30 日收入高、MRR 高或增长快的网站。
3. 从 payment referral 结果补充 TrustMRR 没覆盖的网站：

```bash
uv run --with requests python -m ptr.cli keyword-radar \
  --db <paths.sqlite> \
  --keyword "<category-or-task>" \
  --trustmrr-csv <paths.trustmrr_csv> \
  --min-trustmrr-revenue 5000 \
  --min-referral-visits 5000 \
  --limit 100 \
  --output <paths.reports>/high-revenue-site-candidates.csv
```

4. 用 Similarweb 和 Semrush 补流量，不要只因为 TrustMRR 未命中就删除候选。
5. 注册时间缺失时补 RDAP/WHOIS：

```bash
uv run --with requests python -m ptr.cli enrich-domain-age \
  --db <paths.sqlite> \
  --domains <comma-separated-domains> \
  --limit 200
```

## 默认阈值

用户指定阈值时使用用户阈值。用户没有指定时，用这些默认值：

- `trustmrr_revenue_30d >= 5000`
- 或 `mrr >= 1000`
- 或 `total_revenue >= 10000`
- 或 `monthly_total_visits >= 10000`
- 或 `similarweb_paid_referral_visits >= 5000`

如果是"最新高收入网站"，优先保留最近 90 天首次出现在 TrustMRR、本地报告或 Similarweb 缓存里的站点；注册时间可作为辅助，不要求必须是新域名。

## Similarweb 口径

Similarweb 只用 dash API、ptr CLI 或已保存 raw/cache。不要访问 `similarweb.com/website/<domain>` 公网页来补数。

查某个站的 outgoing referral，用：

- endpoint 读取 `dash_api.outgoing_table_url`
- 常用参数读取 `dash_api.defaults`，并传入 `key=<domain>`
- 默认先看 `3m`，再按需要查 `1m`、`6m`、`12m`

支付目标包括但不限于：

- `checkout.stripe.com`
- `buy.stripe.com`
- `billing.stripe.com`
- `checkout.paddle.com`
- `paypal.com`
- `creem.io`
- `polar.sh`

查主站 referral 或 payment target referral 时，先 dry-run 查看缓存：

```bash
uv run --with requests python -m ptr.cli fetch-similarweb \
  --db <paths.sqlite> \
  --period 1m \
  --targets <domain-or-payment-target> \
  --country 999 \
  --web-source Total \
  --all-pages \
  --max-pages 16 \
  --dry-run
```

缓存缺失且任务需要当前数据时，去掉 `--dry-run`。刷新支付目标前先确认用户确实需要，Similarweb 查询会消耗账号额度。

如果 Similarweb 返回 HTML 登录页、403 或设备数量限制：

1. 确认凭据已加载（`source <credentials.env_file>`）。
2. 使用 `dash_api.login_url` 重新登录后重试同一个接口。
3. 仍失败时记录失败源和错误类型。不要改用公网页估算。

## TrustMRR 口径

TrustMRR 是收入优先来源。默认字段：

- `trustmrr_revenue_30d`
- `mrr`
- `total_revenue`
- `growth_30d`
- `visitors_30d`
- `trustmrr_url`

`not_found` 表示查过但未命中，不表示没有收入。`unknown` 表示数据源没有稳定结果。

## Semrush 口径

Semrush 用来补：

- `semrush_organic_traffic`
- `semrush_paid_traffic`
- `organic_keywords`
- `paid_keywords`
- `referring_domains`
- `organic_competitors`
- `keyword_themes`

默认使用 Semrush dash API。不要默认使用官方 API、Semrush MCP 或套餐外接口；只有用户明确要求时才试这些路径。

### 认证与节点选择

配置中的 `semrush_dash` 段提供了 Semrush dash API 所需的所有连接参数，包括代理地址、节点 API、配置 cookie 名、节点选择策略和各页面 URL 模板。不要把这些值写死在 prompt 或回复中。运行前必须读取 config.toml 的 `semrush_dash` 段。

认证流程：

1. 用 `dash_api.login_url` 和 `credentials` 段配置的凭据登录。登录成功后会写入认证 cookie。
2. 请求 `semrush_dash.nodes_url` 获取节点列表。
3. 从列表中选择一个可用节点：`note` 必须包含 `semrush_dash.preferred_plan_label` 和 `semrush_dash.preferred_health_marker`，不能包含 `semrush_dash.avoid_plan_label`。优先选 `semrush_dash.preferred_node_index`（节点数组下标字符串），但如果对应节点状态为不可用标记则换下一个可用节点。
4. 把节点选择写入 config 中指定的 cookie，格式为 `{"<service_code>":{"node":"<index>","lang":"<default_language>"}}`。
5. 节点激活后前端会写入一个额外的激活 cookie（config 中的 `semrush_dash.activation_cookie`），Semrush 页面还需要带页面级 token 参数（config 中的 `semrush_dash.gmitm_param`）。这些值在 browser session 期间有效。

### 访问方式

#### 方式一：CDP 浏览器（优先）

用户已在 Chrome 中登录并打开 Semrush 时，直接在现有 tab 中操作：

```bash
# 导航到目标页面（URL 模板参见 config 中的 semrush_dash 段）
curl -s "http://localhost:3456/navigate?target=<TAB_ID>&url=<overview_url>?q=<domain>&searchType=<default_search_type>&<semrush_dash.gmitm_param>=<TOKEN>"

# 等待加载后提取数据
curl -s -X POST "http://localhost:3456/eval?target=<TAB_ID>" -d 'document.body.innerText'
```

也可在 tab 内用 `fetch()` 调 Semrush API（浏览器 Service Worker 自动处理认证）：

```js
var resp = await fetch('<api-url>', {credentials: 'include'});
```

#### 方式二：Python requests（需完整 cookie）

从浏览器复制完整 cookie 集合到 requests session，**不要调用 login 接口**（重登录会产生新的 session 导致设备数量冲突）。认证 cookie 名和域参见 config 中的 `semrush_dash` 段。

### 关键页面路径

URL 模板参见 config `semrush_dash` 段。从首页概览和反向链接页面可提取的数据字段包括但不限于：自然流量、付费流量、关键词数、引荐域名、反向链接、每月访问量、流量来源分布、AI 可见度、竞品列表、关键词主题、锚文本分布、外链国家/TLD 分布等。

提取时保留原始页面数值格式（如 `4.9M`、`317.9K`），缺口写 `unknown`，不要编数字。

## 输出字段

默认输出 Markdown 表；用户需要后续处理时同时写 CSV。字段至少包含：

- `domain`
- `product_name`
- `category_or_task`
- `why_matched`
- `registration_date`
- `first_seen_source`
- `monthly_total_visits`
- `monthly_total_visits_source`
- `trustmrr_revenue_30d`
- `mrr`
- `total_revenue`
- `growth_30d`
- `similarweb_paid_referral_visits`
- `semrush_organic_traffic`
- `semrush_paid_traffic`
- `source_urls`
- `data_status`
- `notes`

排序优先级：

1. 明确收入高。
2. 月访问高。
3. 近期出现或注册时间新。
4. 支付网关跳出访问高。
5. Semrush 关键词和外链能解释获客来源。

## 过滤

公开推荐或给用户做产品判断前，过滤：

- 成人内容。
- 赌博、博彩。
- 加密交易、杠杆、自动交易。
- 受管制药品、大麻、违禁品。
- 仿冒、账号黑产、明显规避平台规则的服务。
- 页面信息不足、无法确认卖什么的网站。

如果只是内部候选表，可以保留但标记 `excluded_reason`，不要放进推荐列表。

## 汇报规则

结论要区分"已确认""未命中""未知"：

- 已确认：给出来源、日期和数值。
- 未命中：说明查过哪个来源。
- 未知：说明缺哪个认证、接口或数据字段。

不要把 payment referral 访问写成网站总访问量。它只能证明从该站跳到支付目标的访问下限，不代表收入、用户数或总流量。

不要把流量或收入估算写成确定事实。没有来源时用 `unknown`，不要留空。
