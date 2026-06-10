# TanStack Start Reference

判定：`<repo>/package.json` 的 `dependencies` 或 `devDependencies` 含 `@tanstack/react-start` 或 `@tanstack/start`（或旧版的 `@tanstack/start` 系列）。

## 总是排除的目录

- `node_modules/`
- `.output/` — Nitro 服务器运行时产物（Vite 模式），含 `server/index.mjs`
- `dist/` — Rsbuild 模式或 Vite 客户端产物
  - 包含 `dist/client/`（客户端资源）
  - 包含 `dist/server/index.js`（Rsbuild 服务器入口）
- `.nitro/`、`nitro.json` — Nitro 中间产物（如存在）
- `.vinxi/` — **仅在旧版 TanStack Start（用 Vinxi 时）**才存在；新版本用 Vite/Rsbuild
- `coverage/`
- `playwright-report/`、`test-results/`
- `.vercel/`、`.wrangler/`、`.netlify/` — 各平台本地缓存

## 询问后再决定的目录

- `public/` — TanStack Start 静态资源（与 Next.js 行为类似）。
- `app/`、`src/`、`src/routes/` — 框架路由代码，**保留**。

## 框架特有

- 锁文件（`pnpm-lock.yaml`、`package-lock.json`、`yarn.lock`）默认保留
- 部署适配器：Netlify 用 `dist/client/`、Vercel/Railway 用 `.output/`、Node.js 用 `.output/server/index.mjs`、Rsbuild 用 `dist/client` + `dist/server/index.js`、Bun 用 Nitro `bun` preset
- 没有 `.vinxi` 的话说明项目用的是 Vite 或 Rsbuild（Vinxi 已被废弃）

## 验证命令

```bash
unzip -l <zip> | grep -E "node_modules|\.output/|dist/|\.vinxi/|\.nitro/" | head -10
echo ".output/ count: $(unzip -l <zip> | grep -c '<repo>/\.output/')"
echo "dist/ count: $(unzip -l <zip> | grep -c '<repo>/dist/')"
```
