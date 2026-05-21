---
name: vercel-to-cloudflare-migration
description: 将 Web 项目从 Vercel 迁移到 Cloudflare Workers、Pages 或 Cloudflare 原生托管。适用于用户要求迁移、发布、重新部署或把站点从 Vercel 移到 Cloudflare，尤其涉及自定义域名、Vercel GitHub 自动部署、Vercel 平台资源、vercel.json、Cloudflare DNS、Workers custom domains、D1、R2、Queues、Vectorize、Wrangler 或域名交接时。
---

# Vercel 到 Cloudflare 迁移

## 目标

把生产流量从 Vercel 迁到 Cloudflare，同时避免泄露密钥、误删 DNS 记录、遗漏 Vercel 平台能力，或让 Vercel 在下一次 GitHub push 后重新接管生产域名。

优先使用 CLI/API。只有 CLI/API 无法完成时，才使用浏览器自动化。

当操作 Vercel、GitHub 或 Cloudflare 需要 API token、登录态或权限时，先检查可用的本地凭据，再向用户索要：

1. 当前项目的 `.env`、`.env.local`、`.env.production`、`.env.development`、`.dev.vars`、`.vercel/` 等。
2. 团队约定的共享凭据文件或安全存储位置。
3. 用户级 CLI 或浏览器登录态，例如 `vercel whoami`、`gh auth status`、`wrangler whoami`。

检查 env 文件时只探测目标变量是否存在、来源路径、是否被 Git 忽略，以及是否纳入 Git 管理。不要读取、复制、输出或总结完整 env 文件内容。不要输出 token 值。只说明是否找到、来源路径或登录态，以及缺少的最小权限。

## 启动前必须先做

在执行任何会改变线上状态的操作前，先完成评估并向用户列出步骤，请用户确认后再继续。

评估内容：

- 当前项目是否能直接部署到 Cloudflare。
- 是否使用了 Vercel 平台资源。
- 是否存在 Vercel 配置文件或项目设置会影响迁移。
- 域名当前由谁托管、Vercel 绑定在哪里、GitHub 自动部署是否仍会触发。

必须向用户展示：

```text
我会按这些步骤执行：
1. 检查项目能否迁到 Cloudflare。
2. 检查 Vercel 平台资源和配置文件。
3. 移除 Vercel 生产域名绑定。
4. 创建或复用 Cloudflare 资源。
5. 清理指向 Vercel 的 DNS 记录。
6. 构建、迁移数据库并部署到 Cloudflare。
7. 验证线上域名。
8. 按需删除 Vercel 项目或断开 GitHub 集成。

请确认是否继续。
```

如果用户已经明确说“中间不要确认”“直接执行”“我确认”，可以继续非破坏性操作；否则先停下等确认。

这类一次性确认不能覆盖破坏性操作。任何删除 Vercel project、移除生产 alias、删除 DNS 记录、断开 GitHub 集成或清除线上资源的动作，都必须在执行前列出具体对象并再次等待用户确认。

## 迁移可行性检查

先读这些文件，存在就重点检查：

```bash
rg --files | rg '(^|/)(vercel\\.json|next\\.config\\.(js|mjs|ts)|package\\.json|wrangler\\.(jsonc|toml)|\\.env\\.example|env\\.example)$'
rg -n 'Vercel|VERCEL|@vercel|next/image|ImageResponse|Edge Config|KV|Blob|Postgres|Analytics|Speed Insights|Cron|rewrites|redirects|headers|functions|regions|runtime|vercel' .
```

重点判断：

- Next.js 是否依赖 Node-only API、ISR、Image Optimization、Middleware、Route Handlers、Server Actions。
- 是否使用 `@vercel/analytics`、`@vercel/speed-insights`、`@vercel/blob`、`@vercel/postgres`、Vercel KV、Edge Config。
- 是否依赖 Vercel Cron、Vercel rewrites/redirects/headers、环境变量、Build/Install/Output 设置。
- 是否使用 Vercel 域名、Vercel 自动 GitHub 部署、Preview URL、Protection、Skew Protection。
- 是否能用 Cloudflare Workers/Pages 直接承载，还是要改代码、换存储、换图片方案、换定时任务。

如果不能直接迁移，先列出改造项和风险，不要直接发布。

## 安全规则

- 不输出 token、`.env` 值、含密钥的 API 响应或 `wrangler secret` 值。
- Vercel、GitHub、Cloudflare 需要 token 或登录态时，先检查可用的本地凭据；只探测目标变量是否存在和来源，不读取完整 env 文件；只有查不到或权限不足时才向用户索要。
- 删除 Vercel 项目、生产 alias、DNS 记录、GitHub 集成或线上资源前，必须先从 CLI/API 输出确认 project、domain、record id、record value 或 integration 名称，并再次等待用户确认。用户说过“直接执行”也不能跳过这次确认。
- 只删除目标 hostname 上指向 Vercel 的 Web 访问记录。保留 MX、SPF、DKIM、DMARC、Google verification 和无关 TXT。
- 在 Vercel 自定义域名或项目集成被处理前，不要 push。
- 本地部署凭据放 `.env.local`。确认 `.env.local` 被忽略且未纳入 Git 管理。
- 如果旧项目已纳入 Git 管理 `env.local`，用 `git rm --cached env.local` 从索引移除，只保留本地凭据。
- 使用 OpenNext for Cloudflare 时，绝不能用包含生产私密变量的完整 `.env` 直接构建或部署。OpenNext 会把构建时读取到的 env 写入 `.open-next/cloudflare/next-env.mjs`，并可能进入 Worker bundle。
- Vercel 生产 env 可以先同步到本地 `.env` 防止丢失，但 Cloudflare Worker 运行时变量必须写入 Worker vars/secrets；构建时只暴露 `NEXT_PUBLIC_*` 和确实必须在构建期使用的最小变量。
- 如果 SSG 构建必须读取私密变量，优先改代码使用公开只读凭据或受限 build-only 凭据；不要把生产 service role、支付密钥、邮件密钥、OIDC token 等带入 OpenNext 构建。
- OpenNext 部署后必须扫描 `.open-next` 产物，确认没有嵌入私密变量值或 Vercel 平台变量。扫描脚本只输出命中的变量名，不输出变量值。

## 流程

### 1. 识别当前状态

如果 Vercel CLI 未登录或权限不足，先查找 `VERCEL_TOKEN`、`.vercel/` project 信息或可用 CLI 登录态。查找 token 时只探测变量是否存在，不读取完整 env 文件。找到 token 时在单条命令的环境变量中使用，不写入仓库，不输出值。

运行：

```bash
git remote -v
git branch --show-current
git status --short --branch
for f in .env .env.local .env.production .env.development .dev.vars; do test -f "$f" && awk -F= -v file="$f" '/^(VERCEL_TOKEN|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|GITHUB_TOKEN)=/{print file ":" $1}' "$f"; done
for f in .env .env.local .env.production .env.development .dev.vars; do test -f "$f" && git check-ignore -q "$f" && echo "$f ignored" || true; done
for f in .env .env.local .env.production .env.development .dev.vars; do test -f "$f" && git ls-files --error-unmatch "$f" >/dev/null 2>&1 && echo "$f tracked" || true; done
vercel whoami
gh auth status
vercel teams ls
vercel projects ls --scope <scope>
vercel alias ls --scope <scope> --limit 100
```

找出：

- 旧 Vercel project 所在 scope。
- Vercel project 名称。
- 自定义域名 alias，例如 `example.com` 和 `www.example.com`。
- 用户是要删除 Vercel project，还是只移除 alias / 断开 GitHub。

### 2. 准备 Cloudflare 凭据

先查找 Cloudflare 凭据。优先使用当前项目 env；没有时检查团队约定的共享凭据文件或安全存储位置；再检查 `wrangler whoami` 或用户级配置。

查找 env 时只输出变量名和来源文件，不输出值，不读取完整文件到对话上下文。

可识别的变量：

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

如果需要把凭据给 Wrangler 使用，放到当前项目 `.env.local` 或在单条命令环境变量中注入。不要输出值。只验证变量名、数量、ignore 状态和 tracked 状态：

`.env.local` 使用简单 `KEY=value` 格式。不要使用 `export KEY=value` 或多行值。

```bash
awk -F= '/^(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)=/{print $1; c++} END{print "count=" c+0}' .env.local
git check-ignore -v .env.local
git ls-files --error-unmatch .env.local >/dev/null 2>&1 && echo ".env.local tracked" || echo ".env.local untracked"
```

用 `scripts/with-cloudflare-env.mjs` 给 Wrangler 注入 `.env.local`：

```bash
node <skill-dir>/scripts/with-cloudflare-env.mjs pnpm exec wrangler whoami
```

如果项目需要长期复用，把这个脚本复制到仓库内。

### 3. 处理 Vercel 生产域名

如果移除 alias 或删除 project 需要 token，先查找 `VERCEL_TOKEN` 或可用 Vercel CLI 登录态。确认 token 所属 scope 有目标 project 权限后再执行。

执行移除生产 alias 或删除 project 前，必须先列出将删除的具体对象，并等待用户再次确认。不要因为用户已经说过“直接执行”而跳过。

确认文本使用：

```text
将删除以下 Vercel 对象：
- project: <project-name>
- alias: <domain>
- alias: <www-domain>

请确认是否删除这些对象。
```

移除生产 alias：

```bash
vercel alias remove example.com --scope <scope> --yes
vercel alias remove www.example.com --scope <scope> --yes
vercel alias ls --scope <scope> --limit 100 | rg 'example\.com|www\.example\.com' || true
```

如果用户要求停止 GitHub 触发的 Vercel 自动部署，删除 project：

```bash
printf 'y\n' | vercel project remove <project-name> --scope <scope>
vercel project inspect <project-name> --scope <scope>
```

成功信号：

```text
There is no project for "<project-name>"
```

### 4. 创建或复用 Cloudflare 资源

如果创建 D1、R2、Queues、Vectorize、Workers route 或 Pages project 需要权限，先查找 Cloudflare token。确认 token 至少有目标账户和目标 zone 的读写权限；权限不足时只向用户索要缺失权限。

Workers 内容型应用常用资源：

```bash
node <skill-dir>/scripts/with-cloudflare-env.mjs pnpm exec wrangler d1 list --json
node <skill-dir>/scripts/with-cloudflare-env.mjs pnpm exec wrangler d1 create <db-name>
node <skill-dir>/scripts/with-cloudflare-env.mjs pnpm exec wrangler r2 bucket list
node <skill-dir>/scripts/with-cloudflare-env.mjs pnpm exec wrangler r2 bucket create <bucket-name>
node <skill-dir>/scripts/with-cloudflare-env.mjs pnpm exec wrangler queues list
node <skill-dir>/scripts/with-cloudflare-env.mjs pnpm exec wrangler queues create <queue-name>
node <skill-dir>/scripts/with-cloudflare-env.mjs pnpm exec wrangler vectorize list
node <skill-dir>/scripts/with-cloudflare-env.mjs pnpm exec wrangler vectorize create <index-name> --dimensions=<n> --metric=cosine
```

把真实 D1 `database_id` 写回 `wrangler.jsonc`。

Workers 自定义域名配置：

```jsonc
"routes": [
  { "pattern": "example.com", "custom_domain": true },
  { "pattern": "www.example.com", "custom_domain": true }
]
```

### 5. 清理旧 Vercel DNS 记录

如果需要通过 Cloudflare API 读写 DNS，先查找 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。如果 token 缺少 Zone read、DNS edit 或 Workers Routes edit，只说明缺少的权限，不要求用户重新提供无关凭据。

部署 custom domain 前，列出 Cloudflare DNS：

```bash
CF_CURL_CONFIG="$(mktemp)"
trap 'rm -f "$CF_CURL_CONFIG"' EXIT
chmod 600 "$CF_CURL_CONFIG"
printf 'header = "Authorization: Bearer %s"\n' "$CLOUDFLARE_API_TOKEN" > "$CF_CURL_CONFIG"

curl -sS --config "$CF_CURL_CONFIG" \
  "https://api.cloudflare.com/client/v4/zones?name=example.com"
```

只删除旧 Web 记录：

- `A example.com -> Vercel IP`
- `CNAME www.example.com -> *.vercel-dns-*`
- 服务旧 Vercel app 的 `AAAA` 或 `CNAME`

删除 DNS 记录前，必须列出每条记录的 `id`、`name`、`type`、`content`、`proxied` 和删除原因，并等待用户再次确认。不要因为用户已经说过“直接执行”而跳过。

确认文本使用：

```text
将删除以下 Cloudflare DNS 记录：
- <id> <type> <name> -> <content> proxied=<true|false>，原因：指向旧 Vercel 服务

请确认是否删除这些 DNS 记录。
```

保留：

- MX
- TXT SPF/DKIM/DMARC
- 站点验证 TXT
- 无关子域名

如果 Wrangler 报：

```text
Hostname '<domain>' already has externally managed DNS records
```

删除冲突的 A/AAAA/CNAME 后重新部署。

为 Cloudflare Pages 或 Workers 绑定自定义域名时，DNS 记录优先使用 Cloudflare `proxied` 模式：

- Pages 常用 `CNAME example.com -> <project>.pages.dev` 和 `CNAME www.example.com -> <project>.pages.dev`，默认设为 `proxied: true`。
- Workers routes/custom domains 默认走 Cloudflare 代理，不要改成 DNS only。
- 如果 Pages custom domain 验证报 `CNAME record not set` 或长期停在 pending，可临时把目标 CNAME 改为 DNS only，让 Pages 看到真实 CNAME。
- Pages domain 进入 `active` 后，再把 CNAME 切回 `proxied: true`，并重新验证正式域名可达。

### 6. 构建、迁移、部署

如果部署由 GitHub 集成触发，先检查 `gh auth status` 或 `GITHUB_TOKEN` 是否可用于查看/调整仓库集成。不要在 Vercel 自定义域名或项目集成处理完成前 push。

#### OpenNext 环境变量安全构建

如果项目使用 `@opennextjs/cloudflare`，先做环境变量分流：

- `NEXT_PUBLIC_*`：可在构建期暴露，Next.js 会内联到客户端。
- 运行时私密变量：用 `wrangler secret put` 或 `wrangler secret bulk` 写入 Cloudflare Worker。
- Vercel 平台变量：例如 `VERCEL`、`VERCEL_ENV`、`VERCEL_URL`、`VERCEL_OIDC_TOKEN`、`VERCEL_GIT_*`，不要带入 Cloudflare 构建。

上传 Worker secrets 时，不输出变量值：

```bash
node - <<'NODE' | node <skill-dir>/scripts/with-cloudflare-env.mjs npx wrangler secret bulk
const fs = require("fs");
const keep = new Set([
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "MAILGUN_API_KEY",
  "MAILGUN_DOMAIN",
  "RECIPIENT_EMAIL",
]);
const out = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  if (!line || line.trimStart().startsWith("#")) continue;
  const index = line.indexOf("=");
  if (index < 0) continue;
  const key = line.slice(0, index).trim();
  if (!keep.has(key)) continue;
  let value = line.slice(index + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  out[key] = value;
}
process.stdout.write(JSON.stringify(out));
NODE
```

给仓库增加安全构建脚本，避免完整 `.env` 进入 OpenNext 产物：

```js
// scripts/build-cloudflare.mjs
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const envPath = ".env";
const hasEnv = existsSync(envPath);
const originalEnv = hasEnv ? readFileSync(envPath, "utf8") : null;

function publicOnlyEnv(source) {
  return (
    source
      .split(/\r?\n/)
      .filter((line) => {
        if (!line || line.trimStart().startsWith("#")) return false;
        const index = line.indexOf("=");
        if (index < 0) return false;
        return line.slice(0, index).trim().startsWith("NEXT_PUBLIC_");
      })
      .join("\n") + "\n"
  );
}

try {
  if (hasEnv) writeFileSync(envPath, publicOnlyEnv(originalEnv));
  const result = spawnSync("npx", ["opennextjs-cloudflare", "build"], {
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (hasEnv) writeFileSync(envPath, originalEnv);
}
```

把 npm 脚本改成先安全构建，再部署并保留 Cloudflare 已设置的 vars/secrets：

```json
{
  "scripts": {
    "build:cloudflare": "node scripts/build-cloudflare.mjs",
    "deploy": "npm run build:cloudflare && opennextjs-cloudflare deploy -- --keep-vars"
  }
}
```

如果项目使用 pnpm/yarn/bun，按项目已有包管理器替换命令，不要为了迁移更换包管理器。

构建后扫描产物。不要用会输出匹配行的 `rg <secret> .open-next`；只输出变量名：

```bash
node - <<'NODE'
const fs = require("fs");
const path = require("path");
const sensitiveValuePattern = /^(?!NEXT_PUBLIC_).*(TOKEN|SECRET|KEY|PASSWORD|PRIVATE|SERVICE_ROLE|DATABASE_URL)/;
const embeddedNamePattern = /^(?!NEXT_PUBLIC_).*(TOKEN|SECRET|PASSWORD|PRIVATE|SERVICE_ROLE|DATABASE_URL|^VERCEL$|^VERCEL_)/;
const items = [];
const sensitiveNames = [];
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const index = line.indexOf("=");
  if (index < 0) continue;
  const key = line.slice(0, index).trim();
  if (embeddedNamePattern.test(key)) sensitiveNames.push(key);
  if (!sensitiveValuePattern.test(key)) continue;
  let value = line.slice(index + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (value.length >= 16) items.push([key, value]);
}
const hits = new Set();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile()) {
      const stat = fs.statSync(file);
      if (stat.size > 20 * 1024 * 1024) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const [key, value] of items) {
        if (text.includes(value)) hits.add(key);
      }
    }
  }
}
walk(".open-next");
const nextEnvPath = ".open-next/cloudflare/next-env.mjs";
if (fs.existsSync(nextEnvPath)) {
  const nextEnv = fs.readFileSync(nextEnvPath, "utf8");
  for (const key of sensitiveNames) {
    if (nextEnv.includes(key)) hits.add(key);
  }
}
console.log("embedded_sensitive_keys=" + (hits.size ? [...hits].sort().join(",") : "none"));
process.exitCode = hits.size ? 1 : 0;
NODE
```

如果扫描命中任何私密变量，停止部署，删除 `.open-next`，修正构建环境后重新构建。已部署过的情况下，先把正确版本重新部署，再考虑轮换被嵌入的密钥。

生产前运行项目检查：

```bash
pnpm lint
pnpm typecheck
pnpm build
```

应用远端迁移：

```bash
node <skill-dir>/scripts/with-cloudflare-env.mjs pnpm exec wrangler d1 migrations apply <db-name> --remote
```

部署：

```bash
# OpenNext for Cloudflare
node <skill-dir>/scripts/with-cloudflare-env.mjs pnpm exec opennextjs-cloudflare deploy -- --keep-vars

# 普通 Workers 项目
node <skill-dir>/scripts/with-cloudflare-env.mjs pnpm exec wrangler deploy
```

确认 Wrangler 输出包含：

```text
Deployed <worker> triggers
  example.com (custom domain)
  www.example.com (custom domain)
```

### 7. 验证生产

生产验证以正式域名 HTTPS 可达为准，不要只看本地 DNS 解析结果。本地 DNS 记录可能被缓存或污染；如果普通 `curl` 因本地解析失败，但 Cloudflare 权威 DNS 已返回边缘 IP，可用 `curl --resolve` 指定 IP，同时保持 Host/SNI 为正式域名。

运行：

```bash
curl -sSIL --max-time 20 https://example.com
curl -sSIL --max-time 20 https://www.example.com
curl -sSL --max-time 20 https://example.com | rg -o '<title>[^<]+'
curl -sS --max-time 20 https://example.com/robots.txt
curl -sS --max-time 20 https://example.com/sitemap.xml | sed -n '1,20p'
```

如果本地解析异常，先取 Cloudflare 权威解析结果，再用 `--resolve` 验证访问：

```bash
dig @1.1.1.1 example.com A +short
curl -sSIL --max-time 20 --resolve example.com:443:<edge-ip> https://example.com/
curl -sSL --max-time 20 --resolve example.com:443:<edge-ip> https://example.com | rg -o '<title>[^<]+'
```

验证 Cloudflare domain 状态和 DNS 记录：

```bash
CF_CURL_CONFIG="$(mktemp)"
trap 'rm -f "$CF_CURL_CONFIG"' EXIT
chmod 600 "$CF_CURL_CONFIG"
printf 'header = "Authorization: Bearer %s"\n' "$CLOUDFLARE_API_TOKEN" > "$CF_CURL_CONFIG"

# Pages custom domains 应为 active；DNS 记录优先保持 proxied。
curl -sS --config "$CF_CURL_CONFIG" \
  "https://api.cloudflare.com/client/v4/accounts/<account-id>/pages/projects/<project-name>/domains"

curl -sS --config "$CF_CURL_CONFIG" \
  "https://api.cloudflare.com/client/v4/zones/<zone-id>/dns_records?name=example.com"
```

验证 D1：

```bash
node <skill-dir>/scripts/with-cloudflare-env.mjs pnpm exec wrangler d1 execute <db-name> --remote --command "select name from sqlite_master where type='table' order by name;"
```

复查 Vercel：

```bash
vercel project inspect <project-name> --scope <scope>
vercel alias ls --scope <scope> --limit 100 | rg 'example\.com|www\.example\.com' || true
```

## 常见失败

- `--env-file` 后仍 `Not logged in`：Wrangler 的认证并不总是读取 `--env-file`。使用 `scripts/with-cloudflare-env.mjs`。
- Vectorize 返回 `Authentication error [code: 10000]`：给 Cloudflare token 增加 Vectorize 权限。
- `/workers/routes` 或 `/domains/records` 返回认证错误：给目标 zone 增加 Workers Routes edit 和 Zone read。
- `externally managed DNS records`：删除目标 hostname 上旧 A/AAAA/CNAME。
- OpenNext 部署后 Worker 还能读到 `.env` 私密变量：说明构建时完整 `.env` 被嵌入了 `.open-next/cloudflare/next-env.mjs` 或 Worker bundle。改用只含 `NEXT_PUBLIC_*` 的安全构建脚本，runtime secrets 用 Cloudflare Worker secrets，并用 `--keep-vars` 部署。
- Pages custom domain 报 `CNAME record not set`：临时改成 DNS only，active 后切回 proxied 并验证 HTTPS。
- 本地 `dig` 或普通 `curl` 显示域名不可解析：不要只按本地 DNS 判断；用权威解析或 `curl --resolve` 直接验证域名 HTTPS 可达。
- `www` 刚部署后 TLS 失败：等待并重试，custom domain 证书和 DNS 可能有短暂延迟。

## 最终汇报

汇报：

- Vercel alias 已移除，或 project 已删除。
- Cloudflare 资源创建/复用情况。
- Worker deployment version id。
- 生产 URL 和 HTTP 状态。
- 已运行的验证命令。
- OpenNext 产物扫描结果，例如 `embedded_sensitive_keys=none`。
- 剩余风险，例如缺少模型/支付 secret、项目代码仍依赖 Vercel 平台能力、尚未 push。
