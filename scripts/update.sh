#!/bin/bash
set -e

# ============================================================
# U-Minus 更新脚本（服务器上运行）
# 从 GitHub 拉取最新代码并重启服务，保留数据库数据
# ============================================================

cd ~/u-plus-lite

echo "[1/3] 拉取最新代码..."
git pull origin master

echo "[2/3] 重新构建..."
npm run build

echo "[3/3] 重启服务..."
pm2 restart u-plus-lite

echo ""
echo "更新完成，当前版本："
git log -1 --oneline
