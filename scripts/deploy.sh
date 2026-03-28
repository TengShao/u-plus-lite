#!/bin/bash
set -e

# ============================================================
# U-Minus 一键部署脚本（macOS 服务器用）
# 使用方式：bash <(curl -sL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/scripts/deploy.sh)
# 或下载后在服务器上运行：bash deploy.sh
# ============================================================

REPO_URL="git@github.com:TengShao/u-plus-lite.git"
DIR_NAME="u-plus-lite"
TARGET_DIR="$HOME/$DIR_NAME"

# 自动检测可用端口（从 3000 开始）
find_port() {
    local port=3000
    while lsof -i :$port >/dev/null 2>&1; do
        port=$((port + 1))
    done
    echo $port
}

echo "=========================================="
echo " U-Minus 一键部署脚本"
echo "=========================================="

# Step 1: 获取代码
if [ -d "$TARGET_DIR" ]; then
    echo ""
    echo "[1/6] 检测到已有代码，更新中..."
    cd "$TARGET_DIR"
    git pull origin master
else
    echo ""
    echo "[1/6] 克隆代码仓库..."
    cd ~
    git clone "$REPO_URL" "$TARGET_DIR"
    cd "$TARGET_DIR"
fi

# Step 2: 安装依赖
echo ""
echo "[2/6] 安装依赖..."
npm install

# Step 3: 生成 Prisma 客户端
echo ""
echo "[3/6] 生成 Prisma 客户端..."
npx prisma generate

# Step 4: 构建生产版本
echo ""
echo "[4/6] 构建生产版本..."
npm run build

# Step 5: 初始化数据库
echo ""
echo "[5/6] 初始化数据库（初始状态）..."
npx prisma db push

# Step 6: 启动服务
echo ""
echo "[6/6] 启动服务..."
npm install -g pm2 --silent 2>/dev/null || true

# 检测可用端口
PORT=$(find_port)
echo "检测到可用端口：$PORT"

# 如果之前有运行中的实例，先停止
pm2 delete u-plus-lite 2>/dev/null || true

PORT=$PORT pm2 start npm -- start --name u-plus-lite
pm2 save

# 获取局域网 IP
LOCAL_IP=$(hostname -I | awk '{print $1}')
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "请手动查询")
fi

echo ""
echo "=========================================="
echo " 部署完成！"
echo "=========================================="
echo ""
echo "局域网访问地址：http://$LOCAL_IP:$PORT"
echo ""
echo "管理员账号：邵腾"
echo "管理员密码：88888888"
echo ""
echo "常用命令："
echo "  pm2 status              查看状态"
echo "  pm2 logs u-plus-lite   查看日志"
echo "  pm2 restart u-plus-lite 重启"
echo "=========================================="
