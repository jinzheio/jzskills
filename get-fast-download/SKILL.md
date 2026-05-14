---
name: get-fast-download
description: 当用户需要给 software/ 目录里的安装包、压缩包或课堂资源生成快速临时下载链接时使用。包括“快速下载链接”“临时下载地址”“上传 software”“给国内/课堂下载链接”“Node.js 直连太慢”等请求。该 skill 会上传 software/ 下尚未登记的文件，返回 3 天有效的下载链接，并提示过期时间。
---

# Get Fast Download

为仓库里的 `software/` 文件生成临时下载链接。默认使用 `storage.to`，免登录，链接默认 3 天有效。

## 工作流

1. 确认当前目录是目标仓库；如果用户指定路径，切到该路径。
2. 检查 `software/` 是否存在。
3. 运行脚本上传新增文件：

```bash
python3 "$CODEX_HOME/skills/get-fast-download/scripts/upload_software.py"
```

4. 返回脚本输出中的 Markdown 链接和过期时间。
5. 如果要写入手册，把链接写成“临时下载”，避免写成长期镜像。

## 规则

- 只上传 `software/` 下的普通文件，跳过 `.DS_Store`、隐藏文件和已经登记的文件。
- 登记文件是仓库根目录的 `.fast-download-links.tsv`，用于跳过已上传路径。
- 不上传密钥、配置、用户数据、私密文档。
- 链接适合公开安装包和课堂资料；私密文件需先加密。
- 不承诺长期可用；输出中写明过期时间。
- 如果 `storage.to` 上传失败，重试一次；仍失败则说明失败文件。

## 输出格式

```markdown
临时下载链接（有效到 YYYY-MM-DD HH:mm，北京时间）：

- Windows x64：[file.exe](https://storage.to/r/xxx)
- macOS ARM：[file.tar.xz](https://storage.to/r/yyy)
```

如果没有新增文件：

```markdown
没有发现需要上传的新增文件。已有链接在 `.fast-download-links.tsv`。
```
