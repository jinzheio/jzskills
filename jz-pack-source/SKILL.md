---
name: jz-pack-source
version: "0.2.0"
description: "把当前仓库的源代码和文档打包成 zip（排除构建产物、密钥、依赖目录），并生成一份排除清单说明。默认输出到仓库根目录。用于把当前改动打包给合作者或 review agent。"
---

# jz-pack-source

把工作区的源代码、配置和文档打包成 zip，同时生成一份 markdown 说明文件，列出哪些路径被排除以及为什么。

## 何时使用

用户说"打包源码"、"把代码打包给我"、"打 zip"、"把仓库发我"等场景。仅打包源码/文档，不包含 `node_modules`、`.next/`、构建产物或密钥。常见动机：把当前改动打包给合作者或交给 review agent。

## 强制规则（不要询问用户）

- **`.env*`、`.dev.vars*`、`secrets.json` 永远排除**，包括任何子目录下的。`zip -x` 默认 `*` 只匹配单层，必须用 `**` 跨目录。
- **`.env.example` 保留**（不包含真实密钥的模板）。
- **锁文件默认保留**（保证对方能复现依赖）。如果用户明确要求缩小体积再排除。
- **`node_modules/`、`build/`、`dist/`、`.next/`、`.open-next/`、`.wrangler/`、`.vercel/` 等构建产物永远排除**。

## 步骤

### 1. 判断当前框架

先检查缓存 `<skill-dir>/.cache/<repo-name>/exclude-choices.json` 中是否有 `framework` 字段。如果有，直接使用，跳过框架判断。

如果没有缓存，读取 `package.json` 的 `dependencies` / `devDependencies`，按以下规则判断：

| 命中 | 框架 |
|---|---|
| `next` | Next.js |
| `@tanstack/react-start` 或 `@tanstack/start` | TanStack Start |
| `astro` | Astro |
| 都不命中 | 通用 Web 项目（使用 `assets/exclude-defaults.md` 的通用清单） |

加载对应的 reference：

- Next.js → `reference/nextjs.md`
- TanStack Start → `reference/tanstackstart.md`
- Astro → `reference/astro.md`
- 其他 → 仅用 `assets/exclude-defaults.md`

判断后，将框架类型写入缓存（创建或更新 `exclude-choices.json` 的 `framework` 字段）。

### 2. 检查缓存

先检查 skill 目录下的缓存：`<skill-dir>/.cache/<repo-name>/exclude-choices.json`。

如果存在，读取并直接使用缓存的排除选择，**跳过步骤 3（询问）**，直接进入步骤 4（打包）。

### 3. 询问可选排除项

`.env`、密钥、构建产物这些**不询问**。仅就"看起来像源码但可能是产物"或"会显著影响 zip 用途"的项目询问，参考 `assets/exclude-interactive.md`。

用户做出选择后，将排除项记录到 `<skill-dir>/.cache/<repo-name>/exclude-choices.json`，格式：

```json
{
  "repo": "<repo-name>",
  "framework": "nextjs",
  "date": "<ISO date>",
  "exclude": ["public/", "video/", "drizzle/meta/", "content/", "official-skills/", "fromonline/", ".e2e-playground/"]
}
```

`exclude` 数组记录用户选择**排除**的目录。`framework` 记录项目框架类型，避免重复判断。

### 4. 用 `zip` 打包

```bash
cd <parent-of-repo> && zip -r <repo>/tmp/<repo>-source-$(date +%Y%m%d).zip <repo> \
  -x "<repo>/node_modules/*" \
  -x "<repo>/.next/*" \
  ...  # 见 exclude 清单
```

**重要**：`zip -x` 模式中的 `*` 默认只匹配单层目录，跨子目录匹配必须用 `**`（如 `**/.env`）。

打包完成后放在仓库的 `tmp/` 目录下：

```bash
cp /tmp/<repo>-source-<date>.zip <repo>/tmp/
```

### 5. 验证排除

打包后用以下命令逐一检查关键风险项：

```bash
echo "scripts/.env: $(unzip -l <zip> | grep -c 'scripts/.env')"
echo ".env (anywhere): $(unzip -l <zip> | grep -cE '<repo>/\.env$|<repo>/.+/\.env$')"
echo "secrets.json (anywhere): $(unzip -l <zip> | grep -cE '<repo>/.+/secrets.json$')"
echo "public/ count: $(unzip -l <zip> | grep -c '<repo>/public/')"
echo "node_modules count: $(unzip -l <zip> | grep -c 'node_modules')"
```

任何一个大于 0 都必须重新打包。

### 6. 生成说明 markdown

在 zip 同目录生成 `<repo>-source-<date>.md`，结构见 `assets/exclude-defaults.md` 的格式。必须包含：

- zip 路径、大小、文件数
- 包含项（`src/`、`docs/`、`drizzle/*.sql` 等）
- 排除项（按类别分组：构建/密钥/临时/上游/VCS/锁/数据库等）
- 排除 `drizzle/meta/` 后的限制（不能直接跑 `drizzle-kit`）

### 7. 向用户汇报

- zip 路径
- 文件数和大小
- 关键排除项确认结果
- 任何限制（如 drizzle/meta 排除的影响）

## 常见陷阱

1. **`-x` 模式不递归**：`-x "clawsimple/.env"` 不会排除 `clawsimple/scripts/.env`。必须用 `clawsimple/**/.env`。
2. **子目录里散落的密钥文件**：很多项目在 `scripts/`、`workers/`、`api/` 下都有自己的 `.env`，不能假设根目录是唯一来源。
3. **`drizzle/meta/` 删除后 `drizzle-kit` 会拒绝运行**：如果对方要继续开发，需要先恢复 meta 快照。在说明文档里写清楚。
4. **大目录先看体积再决定**：`du -sh <dir>` 跑一下，避免打包完才发现包有 5 GB。
