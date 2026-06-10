# Next.js Reference

判定：`<repo>/package.json` 的 `dependencies` 或 `devDependencies` 含 `next`。

## 总是排除的目录

- `node_modules/`
- `.next/` — Next.js 构建产物（最重要，缺这个排除项会让 zip 体积爆炸）
- `out/` — `next export` 的静态导出目录
- `.source/` — `Contentlayer` 等内容生成器的中间目录
- `coverage/`
- `playwright-report/`、`test-results/`
- `.vercel/` — Vercel 本地缓存

## 询问后再决定的目录

- `public/` — Next.js 静态资源（favicon、logo、字体）。排除会让 UI 缺失；如果打包给 review agent 看到 UI 比较重要就保留。
- `src/remotion-video/`、`public/remotion/` — 视频产物（如果项目用 Remotion）。
- `openclaw/`、其他上游源码本地副本。

## 框架特有

- `next-env.d.ts` — 自动生成，可排除
- `tsconfig.tsbuildinfo` — TypeScript 增量构建缓存，可排除
- 锁文件（`pnpm-lock.yaml`、`package-lock.json`、`yarn.lock`）默认保留，便于对方复现依赖

## 验证命令

```bash
unzip -l <zip> | grep -E "node_modules|\.next/|out/|\.source/" | head -5
echo ".next/ count: $(unzip -l <zip> | grep -c '<repo>/.next/')"
```
