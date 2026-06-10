# Astro Reference

判定：`<repo>/package.json` 的 `dependencies` 或 `devDependencies` 含 `astro`。

## 总是排除的目录

- `node_modules/`
- `dist/` — Astro 默认构建输出目录（`astro build` 默认产物）
- `.astro/` — Astro 类型生成器缓存，含 `types.d.ts`、`.astro/` 缓存等
- `coverage/`
- `playwright-report/`、`test-results/`
- `.vercel/`、`.wrangler/`、`.netlify/` — 各平台本地缓存

## 询问后再决定的目录

- `public/` — Astro 静态资源，build 时被复制到 `dist/`。打包保留或排除都行；如果只是想 review 源码就排除。
- `src/content/` — 内容集合（content collections）的 markdown/MDX 数据。如果打包给合作者 review UI 改动可以保留；只 review 代码就排除。
- `src/pages/`、`src/components/`、`src/layouts/` — 框架结构代码，**保留**。

## 框架特有

- `astro.config.mjs` / `astro.config.ts` — 框架配置，**保留**
- 锁文件（`pnpm-lock.yaml`、`package-lock.json`、`yarn.lock`）默认保留
- Astro 默认构建输出是 `dist/`，可通过 `outDir` 在 `astro.config` 中修改
- 类型产物（`.astro/types.d.ts`、`*.tsbuildinfo`）可排除

## 验证命令

```bash
unzip -l <zip> | grep -E "node_modules|dist/|\.astro/" | head -10
echo "dist/ count: $(unzip -l <zip> | grep -c '<repo>/dist/')"
echo ".astro/ count: $(unzip -l <zip> | grep -c '<repo>/\.astro/')"
```
