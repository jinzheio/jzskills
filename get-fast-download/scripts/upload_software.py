#!/usr/bin/env python3
import argparse
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

DEFAULT_MANIFEST = ".fast-download-links.tsv"
SKIP_NAMES = {".DS_Store"}


def run(cmd, **kwargs):
    return subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current, *current.parents]:
        if (candidate / ".git").exists() or (candidate / "software").is_dir():
            return candidate
    return current


def system_asset_name() -> str:
    system = platform.system().lower()
    machine = platform.machine().lower()
    if system == "darwin":
        os_name = "darwin"
    elif system == "linux":
        os_name = "linux"
    elif system == "windows":
        os_name = "windows"
    else:
        raise SystemExit(f"不支持的系统：{platform.system()}")

    arch = "arm64" if machine in {"arm64", "aarch64"} else "amd64"
    ext = "zip" if os_name == "windows" else "tar.gz"
    return f"storageto-{os_name}-{arch}.{ext}"


def download_storageto(cache_dir: Path) -> Path:
    cache_dir.mkdir(parents=True, exist_ok=True)
    exe_name = "storageto.exe" if platform.system().lower() == "windows" else "storageto"
    cached = cache_dir / exe_name
    if cached.exists():
        return cached

    api_url = "https://api.github.com/repos/storageto/cli/releases/latest"
    with urllib.request.urlopen(api_url, timeout=30) as response:
        release = json.load(response)

    wanted = system_asset_name()
    asset_url = None
    for asset in release.get("assets", []):
        if asset.get("name") == wanted:
            asset_url = asset.get("browser_download_url")
            break
    if not asset_url:
        raise SystemExit(f"没有找到 storage.to CLI 资源：{wanted}")

    archive = cache_dir / wanted
    urllib.request.urlretrieve(asset_url, archive)

    extract_dir = cache_dir / "extract"
    if extract_dir.exists():
        shutil.rmtree(extract_dir)
    extract_dir.mkdir()

    if archive.suffix == ".zip":
        with zipfile.ZipFile(archive) as zf:
            safe_extract_zip(zf, extract_dir)
    else:
        with tarfile.open(archive) as tf:
            safe_extract_tar(tf, extract_dir)

    for path in extract_dir.rglob(exe_name):
        shutil.copy2(path, cached)
        cached.chmod(0o755)
        return cached

    raise SystemExit("storage.to CLI 下载后未找到可执行文件")


def ensure_within_dir(base: Path, target: Path) -> None:
    base_resolved = base.resolve()
    target_resolved = target.resolve()
    if target_resolved != base_resolved and base_resolved not in target_resolved.parents:
        raise SystemExit(f"压缩包包含非法路径：{target}")


def safe_extract_zip(zf: zipfile.ZipFile, extract_dir: Path) -> None:
    for member in zf.infolist():
        ensure_within_dir(extract_dir, extract_dir / member.filename)
    zf.extractall(extract_dir)


def safe_extract_tar(tf: tarfile.TarFile, extract_dir: Path) -> None:
    for member in tf.getmembers():
        ensure_within_dir(extract_dir, extract_dir / member.name)
    tf.extractall(extract_dir)


def storageto_path() -> Path:
    found = shutil.which("storageto")
    if found:
        return Path(found)
    return download_storageto(Path(tempfile.gettempdir()) / "storageto-cli")


def read_manifest(path: Path) -> set[str]:
    uploaded = set()
    if not path.exists():
        return uploaded
    for line in path.read_text(errors="ignore").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        uploaded.add(line.split("\t", 1)[0])
    return uploaded


def iter_files(software_dir: Path):
    for path in sorted(software_dir.rglob("*")):
        if not path.is_file():
            continue
        if path.name in SKIP_NAMES or path.name.startswith("."):
            continue
        yield path


def parse_upload_json(output: str) -> dict:
    match = re.search(r'\{\s*"FileInfo"\s*:', output)
    if not match:
        raise ValueError(output[-1200:])
    data, _ = json.JSONDecoder().raw_decode(output[match.start():])
    return data


def to_beijing(iso_text: str) -> str:
    dt = datetime.fromisoformat(iso_text.replace("Z", "+00:00"))
    return dt.astimezone(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M")


def upload_file(cli: Path, file_path: Path) -> dict:
    last_error = ""
    for _ in range(2):
        result = run([str(cli), "upload", str(file_path), "--json", "--no-token"])
        combined = f"{result.stdout}\n{result.stderr}"
        if result.returncode == 0:
            return parse_upload_json(combined)["FileInfo"]
        last_error = combined.strip()
    raise RuntimeError(last_error)


def main():
    parser = argparse.ArgumentParser(description="Upload new software files to storage.to")
    parser.add_argument("--root", default=".", help="仓库根目录，默认当前目录")
    parser.add_argument("--software-dir", default="software", help="软件目录，默认 software")
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST, help="链接登记文件")
    args = parser.parse_args()

    root = find_repo_root(Path(args.root))
    software_dir = root / args.software_dir
    if not software_dir.is_dir():
        raise SystemExit(f"未找到目录：{software_dir}")

    manifest = root / args.manifest
    uploaded = read_manifest(manifest)
    files = [path for path in iter_files(software_dir) if path.relative_to(root).as_posix() not in uploaded]

    if not files:
        print(f"没有发现需要上传的新增文件。已有链接在 `{manifest.name}`。")
        return

    cli = storageto_path()
    rows = []
    with manifest.open("a") as f:
        for path in files:
            rel = path.relative_to(root).as_posix()
            print(f"上传：{rel}", file=sys.stderr)
            info = upload_file(cli, path)
            row = {
                "path": rel,
                "name": info["filename"],
                "url": info["url"],
                "raw_url": info["raw_url"],
                "expires_at": info["expires_at"],
                "expires_bj": to_beijing(info["expires_at"]),
                "size": str(info.get("size", "")),
            }
            rows.append(row)
            f.write("\t".join([row["path"], row["raw_url"], row["expires_at"], row["size"]]) + "\n")
            f.flush()

    latest_expiry = max(row["expires_bj"] for row in rows)
    print(f"临时下载链接（有效到 {latest_expiry}，北京时间）：\n")
    for row in rows:
        print(f"- [{row['name']}]({row['raw_url']})")


if __name__ == "__main__":
    main()
