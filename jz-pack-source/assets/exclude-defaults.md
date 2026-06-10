# 默认排除清单（zip -x 参数模板）

把 `<repo>` 替换为仓库根目录名。`.env*` 和密钥**永远排除**（不要询问用户），`.env.example` 保留。

## 构建 / 产物

```
<repo>/node_modules/*
<repo>/.next/*
<repo>/.open-next/*
<repo>/.wrangler/*
<repo>/.vercel/*
<repo>/.source/*
<repo>/out/*
<repo>/build/*
<repo>/dist/*
<repo>/coverage/*
<repo>/playwright-report/*
<repo>/test-results/*
<repo>/.e2e-playground/*
<repo>/.playwright-auth/*
<repo>/.gstack/*
<repo>/.output/*           # TanStack Start (Nitro)
<repo>/.nitro/*            # Nitro 中间产物
<repo>/.astro/*            # Astro 类型生成器缓存
```

## 类型产物

```
<repo>/*.tsbuildinfo
<repo>/next-env.d.ts
<repo>/cloudflare-env.d.ts
```

## 环境 / 密钥（递归排除，不询问用户）

```
<repo>/**/.env
<repo>/**/.env.*
<repo>/**/.dev.vars
<repo>/**/.dev.vars.*
<repo>/**/secrets.json
```

注意：`.env.example` 模板**保留**（不含真实密钥）。

## 临时 / 日志

```
<repo>/tmp/*
<repo>/.tmp/*
<repo>/.tmp_*/*
<repo>/logs/*
<repo>/.claude/worktrees/*
<repo>/.agents/**/.state/*
```

## VCS / 锁文件 / 元数据

```
<repo>/.git/*
<repo>/.DS_Store
```

锁文件（`pnpm-lock.yaml`、`package-lock.json`、`yarn.lock`）**默认保留**，保证对方能复现依赖。如下游场景需要更小体积再排除。

## 体积大的非源码目录（需先和用户确认）

```
<repo>/openclaw/*          # 上游源码本地副本
<repo>/public/*            # Next.js / Astro 静态资源（删了 UI 缺失）
<repo>/video/*             # 视频产物
<repo>/src/remotion-video/*
<repo>/public/remotion/*
<repo>/content/*           # blog 等内容
<repo>/official-skills/*   # 上游 skills
<repo>/fromonline/*        # 其他项目的本地参考
```

## 数据库（drizzle）

```
<repo>/drizzle/meta/*      # 快照 + journal，删除后无法跑 drizzle-kit
```

## 验证命令

```bash
echo "scripts/.env: $(unzip -l <zip> | grep -c 'scripts/.env')"
echo ".env (anywhere): $(unzip -l <zip> | grep -cE '<repo>/\.env$|<repo>/.+/\.env$')"
echo "secrets.json: $(unzip -l <zip> | grep -cE '<repo>/.+/secrets.json$')"
echo "public/: $(unzip -l <zip> | grep -c '<repo>/public/')"
echo "node_modules: $(unzip -l <zip> | grep -c 'node_modules')"
echo "drizzle/meta/: $(unzip -l <zip> | grep -c '<repo>/drizzle/meta/')"
```

## 完整 zip 命令模板

```bash
cd <parent-of-repo> && zip -r <repo>/tmp/<repo>-source-$(date +%Y%m%d).zip <repo> \
  -x "<repo>/node_modules/*" \
  -x "<repo>/.next/*" \
  -x "<repo>/.open-next/*" \
  -x "<repo>/.wrangler/*" \
  -x "<repo>/.vercel/*" \
  -x "<repo>/.source/*" \
  -x "<repo>/.tmp/*" \
  -x "<repo>/.tmp_*/*" \
  -x "<repo>/tmp/*" \
  -x "<repo>/logs/*" \
  -x "<repo>/fromonline/*" \
  -x "<repo>/content/*" \
  -x "<repo>/official-skills/*" \
  -x "<repo>/drizzle/meta/*" \
  -x "<repo>/out/*" \
  -x "<repo>/build/*" \
  -x "<repo>/dist/*" \
  -x "<repo>/coverage/*" \
  -x "<repo>/playwright-report/*" \
  -x "<repo>/test-results/*" \
  -x "<repo>/.e2e-playground/*" \
  -x "<repo>/.playwright-auth/*" \
  -x "<repo>/.gstack/*" \
  -x "<repo>/openclaw/*" \
  -x "<repo>/video/*" \
  -x "<repo>/public/*" \
  -x "<repo>/src/remotion-video/*" \
  -x "<repo>/**/.env" \
  -x "<repo>/.env" \
  -x "<repo>/.env.*" \
  -x "<repo>/**/.env.*" \
  -x "<repo>/**/.dev.vars" \
  -x "<repo>/**/.dev.vars.*" \
  -x "<repo>/**/secrets.json" \
  -x "<repo>/.DS_Store" \
  -x "<repo>/*.tsbuildinfo" \
  -x "<repo>/next-env.d.ts" \
  -x "<repo>/cloudflare-env.d.ts" \
  -x "<repo>/.claude/worktrees/*" \
  -x "<repo>/.agents/**/.state/*" \
  -x "<repo>/.git/*"

cp <repo>/tmp/<repo>-source-<date>.zip <repo>/tmp/
```
