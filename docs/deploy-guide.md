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

脚本自动完成：代码拉取 → 依赖安装 → 构建 → PM2 启动。数据库初始化请参考"手动部署"步骤。

**前提：服务器 Mac 需配置 GitHub SSH 访问（见下方"服务器配置"第四步）**

```bash
bash <(curl -sL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/scripts/deploy.sh)
```

运行后显示局域网访问地址。**首次部署后需初始化数据库并导入管线和预算项**（见下方"CSV 导入"章节）。

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

### 5. 初始化数据库 & 导入数据
```bash
# 创建数据库表结构
npx prisma db push

# 导入管线和预算项（见下方"CSV 导入"章节）
npx ts-node prisma/import.ts --pipelines=<path> --budget-items=<path>
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

---

## 四、CSV 导入（管线和预算项）

部署完成后，管线和预算项需要通过 CSV 文件导入，或在 Web 端手动添加。

### 导出当前数据

如果已有数据，可导出为 CSV 格式进行备份或迁移：

```bash
npx ts-node prisma/export.ts
```

### 导入管线和预算项

```bash
npx ts-node prisma/import.ts --pipelines=<path> --budget-items=<path>
```

**输入模式（二选一）：**

- **文件路径**：传入 CSV 文件路径，如 `--pipelines=./pipelines.csv`
- **粘贴内容**：传入 `-` 符号，然后粘贴 CSV 内容，如 `--pipelines=-`，工具会提示输入

**行为说明：**

- 管线不存在时自动创建
- 预算项关联的管线必须已存在（未创建的管线会报错）
- 预算项可选择不关联管线（留空管线字段即可）

### Web 端管理

管理员也可在 Web 端手动管理：

- 进入 **Admin Settings → 管线管理**：添加、编辑管线
- 进入 **Admin Settings → 预算项管理**：添加、编辑预算项，可选择关联或不关联管线

## 五、团队访问

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

首次部署后需通过 `npx prisma db seed` 创建管理员账号。

## 六、远程成员访问（临时方案）

目前远程成员需要先连 VPN 回办公室网络，再通过局域网 IP 访问。

## 七、数据备份

SQLite 数据库文件位置：
```
/Users/xxx/u-plus-lite/prisma/dev.db
```

建议定期备份此文件，可加入 crontab：
```bash
# 每天凌晨 3 点备份
0 3 * * * cp /path/to/prisma/dev.db /path/to/backup/dev.db.$(date +\%Y\%m\%d)
```

## 八、后续功能更新（不丢失数据）

本地开发新功能并推送到 GitHub 后，在服务器 Mac 上运行：

```bash
bash ~/u-plus-lite/scripts/update.sh
```

脚本自动完成：拉取代码 → 重构建 → 重启服务，数据库文件完全不受影响。

---

## 九、重启服务器后恢复服务

如果 PM2 已配置开机自启，服务会自动恢复。否则手动：
```bash
cd ~/u-plus-lite
pm2 start npm -- start
```

## 十、后续优化方向

- **HTTPS**：用 Nginx 反向代理 + Let's Encrypt 证书，外网访问更安全
- **域名**：配置局域网域名（如 `uplus.internal`），避免记 IP
- **数据库迁移**：从 SQLite 迁到 PostgreSQL，支持多实例部署
- **CI/CD**：GitHub Actions 自动构建部署
