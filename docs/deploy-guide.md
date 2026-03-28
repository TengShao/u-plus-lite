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

```bash
bash <(curl -sL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/scripts/deploy.sh)
```

运行后显示局域网访问地址，管理员账号：`邵腾` / `88888888`

---

## 三、手动部署步骤

### 1. 上传代码到服务器
```bash
# 在服务器上克隆（需要先配置 GitHub SSH 访问）
git clone https://github.com/TengShao/u-plus-lite.git
cd u-plus-lite
```

### 2. 安装依赖
```bash
npm install
```

### 3. 生成 Prisma 客户端 & 构建生产版本
```bash
npx prisma generate
npm run build
```

### 4. 初始化数据库
```bash
# 创建初始数据（管理员账号邵腾/88888888）
npx prisma db push

# 可选：导入全量测试数据
npx tsx prisma/seed-full.ts
```

### 5. 安装 PM2（后台进程管理）
```bash
npm install -g pm2
```

### 6. 启动服务
```bash
pm2 start npm -- start
```

### 7. 确认运行状态
```bash
pm2 list
pm2 logs                   # 查看日志
```

### 8. 开机自启
```bash
pm2 save
pm2 startup
```
按提示执行输出的命令即可。

## 四、团队访问

### 局域网访问
同一网络下浏览器打开：
```
http://192.168.1.100:3000
```

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
