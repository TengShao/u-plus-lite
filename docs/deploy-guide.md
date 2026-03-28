# U-Minus (结了吗你) 部署指南

## 环境要求

- macOS 作为服务器
- Node.js 18+
- 团队成员在同一局域网内

## 一、服务器配置（Mac）

### 1. 确认 Node.js 版本
```bash
node -v   # 需要 v18 以上
npm -v
```

### 2. 获取局域网 IP
```bash
hostname -I
```
记录输出的 IP，例如 `192.168.1.100`，后续团队成员通过此地址访问。

### 3. 开放端口
macOS 默认防火墙会阻止非 App Store 应用使用端口 3000。确认方法：

**方式一：临时关闭防火墙（推荐测试时用）**
- 系统设置 → 隐私与安全性 → 防火墙 → 关闭

**方式二：永久允许**
```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node
```

## 二、一键部署（推荐）

脚本自动完成：代码拉取 → 依赖安装 → 构建 → 数据库初始化 → PM2 启动。

**前提：服务器 Mac 需配置 GitHub SSH 访问（见下方"服务器配置"第四步）**

```bash
bash <(curl -sL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/scripts/deploy.sh)
```

运行后显示局域网访问地址，管理员账号：`邵腾` / `88888888`

---

## 三、手动部署步骤

### 1. 配置 GitHub SSH 访问（私有仓库必需）

如果仓库是 private，必须通过 SSH 方式访问。

**生成 SSH 密钥：**
```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```
连续回车使用默认路径和空密码。

**查看公钥：**
```bash
cat ~/.ssh/id_rsa.pub
```

**添加到 GitHub：**
- 打开 https://github.com/settings/keys
- 点击 "New SSH key"
- Title 填入描述（如 "Mac Server"）
- Key 填入上面 `cat` 命令输出的完整内容

**验证连接：**
```bash
ssh -T git@github.com
```
显示 "Hi TengShao! You've successfully authenticated" 即成功。

### 2. 上传代码到服务器
```bash
# 通过 SSH 方式克隆（私有仓库必须用此格式）
git clone git@github.com:TengShao/u-plus-lite.git
cd u-plus-lite
```

### 3. 安装依赖
```bash
npm install
```

### 4. 生成 Prisma 客户端 & 构建生产版本
```bash
npx prisma generate
npm run build
```

### 5. 初始化数据库
```bash
# 创建初始数据（管理员账号邵腾/88888888）
npx prisma db push

# 可选：导入全量测试数据
npx tsx prisma/seed-full.ts
```

### 6. 安装 PM2（后台进程管理）
```bash
npm install -g pm2
```

### 7. 启动服务
```bash
pm2 start npm -- start
```

### 8. 确认运行状态
```bash
pm2 list
pm2 logs                   # 查看日志
```

### 9. 开机自启
```bash
pm2 save
pm2 startup
```
按提示执行输出的命令即可。

## 四、团队访问

### 局域网访问

部署完成后，在服务器 Mac 上运行以下命令获取局域网 IP：

```bash
hostname -I | awk '{print $1}'
```

将输出的 IP 告知团队成员。同一网络下浏览器打开：

```
http://<服务器IP>:3000
```

例如输出是 `192.168.1.100`，则访问地址为 `http://192.168.1.100:3000`

### 管理员登录
- 账号：`邵腾`
- 密码：`88888888`

## 五、远程成员访问（临时方案）

目前远程成员需要先连 VPN 回办公室网络，再通过局域网 IP 访问。

## 六、数据备份

SQLite 数据库文件位置：
```
/Users/xxx/u-plus-lite/prisma/dev.db
```

建议定期备份此文件，可加入 crontab：
```bash
# 每天凌晨 3 点备份
0 3 * * * cp /path/to/prisma/dev.db /path/to/backup/dev.db.$(date +\%Y\%m\%d)
```

## 七、后续功能更新（不丢失数据）

本地开发新功能并推送到 GitHub 后，在服务器 Mac 上运行：

```bash
bash ~/u-plus-lite/scripts/update.sh
```

脚本自动完成：拉取代码 → 重构建 → 重启服务，数据库文件完全不受影响。

---

## 八、重启服务器后恢复服务

如果 PM2 已配置开机自启，服务会自动恢复。否则手动：
```bash
cd ~/u-plus-lite
pm2 start npm -- start
```

## 九、后续优化方向

- **HTTPS**：用 Nginx 反向代理 + Let's Encrypt 证书，外网访问更安全
- **域名**：配置局域网域名（如 `uplus.internal`），避免记 IP
- **数据库迁移**：从 SQLite 迁到 PostgreSQL，支持多实例部署
- **CI/CD**：GitHub Actions 自动构建部署
