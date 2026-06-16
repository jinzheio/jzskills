# 项目协作规则

本项目的协作规则以 `AGENTS.md` 为准。Claude / Claude Code 在本仓库工作时，也必须遵守 `AGENTS.md` 中的要求，尤其是：

- skill 新增、改名、移动或删除时，同步维护 `~/.agents/skills/`、`~/.claude/skills/`、`~/.codex/skills/` 中指向本仓库 skill 目录的软链接。
- 提交、推送或发布前，检查新增和修改内容是否包含本机路径、个人隐私、真实账号或 secret。
- 文档中的路径、账号和配置位置使用占位符，不写本机绝对路径或真实私有信息。
