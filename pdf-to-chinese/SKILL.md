---
name: pdf-to-chinese
description: 当用户要求把外语 PDF 翻译成中文 PDF，并保留原 PDF 的页面尺寸、配色、图片、页码、标题层级和版式时使用。包括“保留原样式只替换文字”“先翻译几页看看效果”“外文 PDF 中文化”“英文手册转中文 PDF”等请求。
---

# PDF To Chinese

把外语 PDF 转成中文 PDF，目标是“视觉上像原稿的中文版”，不是重新排版成文档。

## 工作流

1. 先检查 PDF：

```bash
pdfinfo "$PDF"
pdffonts "$PDF"
pdftotext -layout -f 1 -l 4 "$PDF" -
```

2. 抽样渲染页面，用截图确认背景色、图片、标题、页码、胶囊标签、表格和双栏结构：

```bash
mkdir -p /tmp/pdf-cn-preview
pdftoppm -png -f 1 -l 4 -r 120 "$PDF" /tmp/pdf-cn-preview/page
```

3. 先做小样。用户没有指定页数时，默认先做前 3-5 页，不要直接处理全稿。
4. 复制原 PDF 的目标页，清除原文字，保留图片、矢量图形、背景和页码。
5. 按原坐标写入中文。中文比英文短时，不要把文本块拉满；中文比英文长时，优先调行宽、字号和行距，保持原版式密度。
6. 渲染新 PDF 的截图，对比原稿截图。重点检查：
   - 彩色背景页没有白色文字底。
   - 章节标签文字在圆角矩形里居中。
   - 页码没有被擦掉。
   - 标题没有裁切、溢出或压到图片。
   - 正文没有超过原栏宽。
7. 把 PDF 路径发给用户，让用户确认字体、语气和版式后再继续全稿。

## 脚本

优先使用脚本辅助抽取页面结构和覆盖写入：

```bash
uv run --with pymupdf --with fonttools python \
  "$CODEX_HOME/skills/pdf-to-chinese/scripts/pdf_translate_overlay.py" \
  inspect "$PDF" --pages 1-4 --out /tmp/pdf-cn-blocks.json
```

编辑 JSON 里的 `translation`、`font_role`、`align`、`keep`、`background` 后再应用：

```bash
uv run --with pymupdf --with fonttools python \
  "$CODEX_HOME/skills/pdf-to-chinese/scripts/pdf_translate_overlay.py" \
  apply "$PDF" --spec /tmp/pdf-cn-blocks.json --out "$OUT_PDF"
```

脚本只负责 PDF 几何和覆盖写入；翻译质量、语气和断行仍由 agent 判断。

## 翻译规则

- 默认中文，保留必要英文技术名词、产品名、命令、API、状态字段。
- 保留原文语气：手册就像手册，白皮书就像白皮书，产品页就像产品页。
- 不把英文逐词硬译成中文长句。中文要自然，但不要添加原文没有的信息。
- 避免中文 UI/手册里的空话：少用“赋能”“颠覆”“极致”“全面提升”等泛化词。
- 阶段名、目录、章节名要短；如果标题过长，优先压缩译文，而不是缩小到难读。

## 版式规则

- 彩色背景页：清除英文时用页面背景色填充，不要用白色。
- 白底正文页：可用白色填充，但 redaction 范围要紧，不要擦到边框和细线。
- 圆角矩形、标签、页码、logo、插图优先保留原图形；只替换其中的文字。
- 胶囊标签内文字必须水平、垂直居中。
- 原 PDF 使用英文字体时，中文可选择系统中文字体替代。优先用细宋体对应 serif 标题/正文，用细黑体对应 sans 标签/目录。
- 如果 macOS 有中文 TTC 字体，优先抽出具体字重的 TTF 子字体，避免 PDF 库默认选到黑体或粗体。
- 保存前对嵌入字体做 subset，避免输出文件过大。
- 同一页多栏排版时，每一栏按独立页面处理。栏内 section 之间的间距要跟随中文内容的实际结束位置，不要为了对齐英文原稿坐标而在段落和下一节标题之间留下大段空白。整栏内容全部结束后的底部留白可以变大。
- section 只有跨页延续时才标“（续）”；同一页内从左栏延续到右栏，不要加“（续）”。
- 术语选择要以中文自然度为准，例如 problem hypothesis 可译为“问题假设”，pressure-testing 可按语境译为“压测”，标题里优先用“压测问题假设”。

## 常用字体

macOS 上常用：

- Serif：`/System/Library/Fonts/Supplemental/Songti.ttc` 的 `Songti SC Light`
- Sans：`/System/Library/Fonts/STHeiti Light.ttc` 的 `Heiti SC Light`

如果字体不合适，先生成 1-2 页样张给用户看，不要全稿处理。

## 输出

完成后给出 PDF 链接，并简述检查结果：

```markdown
已生成试译版：
[文件名.pdf](/absolute/path/file.pdf)

已检查：中文渲染正常；彩色页无白底；章节标签居中；正文未溢出。
```
