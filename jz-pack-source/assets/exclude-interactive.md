# 交互式问询清单

打包前用 `AskUserQuestion` 询问以下问题。`.env*`、`.dev.vars*`、`secrets.json` **不询问**（一律排除），`.env.example` 保留。

## 体积相关（建议问）

### 1. `public/`

**问题**：`public/` 是 Next.js / Astro 静态资源目录（favicon、logo、字体）。打包还是排除？

**选项**：
- 排除（zip 体积小，但对方不能直接 `pnpm dev` 看到完整 UI）
- 保留（UI 完整，但 zip 略大）

### 2. `drizzle/meta/`

**问题**：`drizzle/meta/` 含迁移快照。打包还是排除？

**选项**：
- 排除（zip 体积小，但对方不能直接跑 `drizzle-kit`）
- 保留（对方拿到完整迁移系统）

### 3. `openclaw/` 目录（如存在）

**问题**：`openclaw/` 是上游 OpenClaw 源码的本地副本（git 已忽略），可能很大。打包还是排除？

**选项**：
- 排除（推荐，AGENTS.md 通常写明这是 source analysis only）
- 包含（zip 会变大且混着上游代码）

### 4. 视频 / 产物目录

**问题**：`video/`、`src/remotion-video/`、`public/remotion/`、`.e2e-playground/` 等视频/测试产物目录怎么处理？

**选项**：
- 排除（推荐）
- 全部包含

## 不询问的项目（永远排除）

- `.env*`、`.dev.vars*`、`secrets.json`（任何子目录）
- `node_modules/`、`.next/`、`.open-next/`、`.wrangler/`、`.vercel/`、`.source/`
- `out/`、`build/`、`dist/`、`.output/`、`.nitro/`、`.astro/`、`.vinxi/`
- `coverage/`、`playwright-report/`、`test-results/`
- `.tmp*/`、`tmp/`、`logs/`、`.claude/worktrees/`、`.agents/**/.state/`
- `.git/`、`.DS_Store`
- `*.tsbuildinfo`、`next-env.d.ts`、`cloudflare-env.d.ts`

## 风格

- 选项标签简短（1-5 字）
- 描述里说明影响（zip 大小、是否影响对方使用）
- 第一个选项始终是推荐项
- 让用户能自己写"Other"补充
