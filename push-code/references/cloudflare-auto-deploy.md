# Cloudflare 自动部署

只在主流程已经确认以下两点时读取：

- 项目是 Cloudflare 公开站点。
- 仓库没有能在 `push` 到生产分支后部署 Cloudflare 的 GitHub Actions workflow。

目标是让 Cloudflare 站点通过 GitHub Actions 自动部署。不要保留“push 后本机 wrangler 发布”的流程。

## Workflow 模板

Cloudflare Pages 项目默认使用这个 workflow。按项目实际包管理器、生产分支和部署脚本调整。

```yaml
name: Deploy Cloudflare Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: cloudflare-pages-production
  cancel-in-progress: true

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

jobs:
  deploy:
    if: ${{ github.event_name != 'push' || !contains(join(github.event.commits.*.message, ' '), '[skip deploy]') }}
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.23.0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Check
        run: pnpm run check

      - name: Deploy Cloudflare Pages
        run: pnpm run pages:deploy
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## 适配规则

- 项目不是 pnpm 时，按仓库已有包管理器改安装、缓存和命令。
- 生产分支不是 `main` 时，按项目实际分支改。
- 项目没有 `check` script 时，使用已有 build/test 命令；没有适用命令时删除 `Check` step。
- Cloudflare Workers 项目用已有 Workers 发布脚本替换 `pnpm run pages:deploy`。
- workflow 必须保留 `[skip deploy]` 判断，并检查本次 push 的完整 commit range。

## Secrets 检查

添加 workflow 后检查 GitHub repo secrets：

```bash
gh secret list --repo OWNER/REPO
```

Cloudflare 自动部署通常需要：

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

缺少 secrets 时，不要 push 后声称会自动部署。先使用本机 `infra-credential-lookup` skill 查找凭据：

1. 检查当前项目 env 文件。
2. 检查相邻的 `../jinzheceo/.env`。
3. 检查本机 Cloudflare / GitHub CLI 登录状态。

找到 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 后，先验证目标 Cloudflare API 权限。Workers 项目至少验证账号级 API 可访问；如果 workflow 会执行 D1 migration，还要验证 D1 API 可访问。验证通过后用 `gh secret set` 写入缺失的 repo secrets。不要输出 secret 值。

只有本机没有可用凭据，或 token 权限不足时，才询问用户是否现在提供最小所需凭据。
