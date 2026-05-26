---
name: personal-context-builder
version: "1.0.0"
description: "当用户想通过访谈、苏格拉底提问或交互式方式创建 about.md、voice.md、anti-style.md，并让 Codex、ChatGPT、Claude、Claude Code 使用这些个人上下文文件时使用。触发语包括 create about me、voice profile、anti AI writing style、个人上下文、写作风格文件、全局 AI profile、-g 自动开启。不是用于写单篇文章或普通润色。"
---

# personal-context-builder

通过访谈创建三份长期上下文文件，并把它们接入常用 agent。

## 目标文件

默认创建：

- `about.md`
- `voice.md`
- `anti-style.md`

可选创建：

- `chatgpt-custom-instructions.md`
- `claude-project-instructions.md`

## 工作流

### 1. 先问输出位置和接入范围

如果用户没有指定目录，默认使用 `~/Projects/aboutme/`。三份目标文件直接放在这个目录下。

如果用户说 `-g`、`global`、`全局开启` 或 `四项都开启`，接入范围使用：

- Codex
- ChatGPT
- Claude
- Claude Code

否则先问要接入哪些入口。不要在未确认时修改全局配置文件。

### 2. 苏格拉底式访谈

每轮只问 3-5 个问题。先问事实，再问判断，再问取舍。

按这个顺序访谈：

1. `about.md`
   - 当前身份和业务
   - 正在推进的目标
   - 已经做出的决定
   - 近期约束
   - AI 不应该反复建议的方向

2. `voice.md`
   - 常写内容和读者
   - 常用句式、节奏、结构
   - 观点、判断方式和边界
   - 喜欢的表达样例
   - 不会说的话

3. `anti-style.md`
   - 禁用词
   - 禁用结构
   - 禁用语气
   - 格式规则
   - 改写前后样例

每轮问题后，先总结“已确认信息”和“仍缺信息”。如果信息足够，进入下一组；如果不足，再问一轮。

### 3. 生成文件

文件用中文写，除非用户要求英文。保留必要英文技术标识。

写法要求：

- 用事实和规则，不写产品愿景句。
- 不写空泛形容词。
- 不替用户编造经历、账号、客户、收入或项目。
- 不写真实隐私信息，除非用户明确要求本地私用。
- 对外可分享版本必须把账号、客户、路径、联系人和密钥替换成占位符。

### 4. 用户确认

生成三份文件后，先让用户检查：

- 哪些内容不准
- 哪些内容太泛
- 哪些规则会让 AI 过度收缩

用户确认后再执行安装脚本。

### 5. 安装到各入口

使用 `scripts/install-profile.mjs`。

常用命令：

```bash
node personal-context-builder/scripts/install-profile.mjs -g
```

本地 npx 入口：

```bash
npx --yes ./personal-context-builder -g
```

只接入部分入口：

```bash
node personal-context-builder/scripts/install-profile.mjs --targets codex,claude-code
```

dry run：

```bash
node personal-context-builder/scripts/install-profile.mjs -g --dry-run
```

脚本默认使用 `~/Projects/aboutme/` 作为源目录和共享 profile 目录，然后：

- 为 Codex 写入全局 `AGENTS.md` 管理块，按任务类型引用三份文件。
- 为 Claude Code 写入全局 `CLAUDE.md` 管理块，按任务类型引用三份文件。
- 为 ChatGPT 生成 custom instructions 文件。
- 为 Claude Chat/Project/Cowork 生成 project/global instructions 文件。

ChatGPT 和 Claude Chat 通常不能直接读取本机文件。对这两个入口，脚本生成可粘贴或上传到 Project knowledge 的说明文件；不要声称它们已经自动读取了本机路径。

## 完成条件

- 三份目标文件存在。
- 内容来自用户回答，未补写无法确认的事实。
- 默认位置是 `~/Projects/aboutme/`，除非用户指定其它目录。
- `-g` 时四类入口都有对应接入物。
- 全局文件只更新脚本标记的管理块，不覆盖用户已有内容。
- 最后报告安装位置、接入范围和需要用户手动粘贴/上传的文件。
