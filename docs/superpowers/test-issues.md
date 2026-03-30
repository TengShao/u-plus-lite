# 测试问题记录

> 汇总时间：2026-03-30
> 测试者： Teng Shao
> 状态：✅ 功能问题已全部修复并提交（Bug 10 npm deprecated 除外，需单独评估依赖更新）

---

## 当前阻塞问题（必须先解决）

### 阻塞问题 A：ts-node 编译错误
**错误：** TS5095 - Option 'bundler' can only be used when 'module' is set to 'preserve' or to 'es2015' or later.

**原因：** `--compiler-options '{"module":"CommonJS"}'` 与 `moduleResolution: "bundler"` 不兼容。

**修复：** 改用 `npx tsx` 替代 `npx ts-node --transpile-only --compiler-options '{"module":"CommonJS"}'`

**状态：** ✅ 已修复（tsx + 内嵌 deploy.sh 覆盖 GitHub 旧版本）

---

## 已修复的问题

### 问题 1：deploy.sh 路径依赖问题
**状态：** ✅ 已修复（多次 commit 迭代）

### 问题 2：管理员密码缺少二次确认
**状态：** ✅ 已修复

### 问题 3：配置开机自启的密码提示无说明
**状态：** ✅ 已修复

### 问题 4：CSV 文件路径提示不够友好
**状态：** ✅ 已修复

### 问题 5：Step 8 选项交互不够友好（暂缓）
**状态：** ⏳ 暂不修复

### 问题 6：Step 8 提示文字括号易误解
**状态：** ✅ 已修复

### 问题 7：目录已存在提示不够友好
**状态：** ✅ 已修复

### 问题 24：退出登录后重定向到 localhost:3000
**描述：** signOut({ callbackUrl: '/' }) 的相对路径 callbackUrl 在某些 NextAuth 版本下会相对于 NEXTAUTH_URL 解析，导致重定向到错误的地址。
**修复：** Header.tsx 中 signOut 改用 `window.location.origin` 作为显式 callbackUrl。
**状态：** ✅ 已修复

---

## 待修复问题（按优先级）

### 问题 8：测试指南内容与当前脚本不同步
**描述：** 指南中的 Step 描述、步骤编号与当前脚本不一致（如 Step 8 提示格式过时）。
**状态：** ✅ 已修复（重写 test-deployment-guide.md，与当前 8 步流程同步）

### 问题 9：目录已存在时的判断逻辑不合理
**描述：** 应区分新部署（直接用）和更新（二次确认），当前逻辑会警告不需要警告的情况。
**状态：** ✅ 已修复（UPDATE_MODE 新增确认提示）

### 问题 10：npm install 大量 deprecated 警告
**描述：** 依赖包使用旧版本导致警告。
**状态：** ⏳ 外部问题（需更新依赖包，非 deploy.sh 范畴）

### 问题 11：密码输入时无任何显示，用户不确定是否输入成功
**状态：** ✅ 已修复（使用 stty echo 替代 read -sp，跨平台兼容）

### 问题 12：更新模式判断条件不严格（只检查 .git）
**状态：** ✅ 已修复（Bug 9 修复后，UPDATE_MODE 有确认提示，足以防止误操作）

### 问题 13：部署路径应自动创建项目子目录
**描述：** 用户给 `/Users/xxx/部署`，应在其中创建 `u-plus-lite/` 子目录再部署。
**状态：** ✅ 已修复（setup_path 中自动检测并追加 `/u-plus-lite` 子目录）

### 问题 14：开机自启的密码提示容易混淆
**描述：** "管理员密码" 应改为"本机管理员密码"。
**状态：** ✅ 已修复（config_nextauth 中已改为"需要输入本机管理员密码"）

### 问题 15：粘贴内容时 Ctrl+D 无法结束输入
**描述：** 粘贴内容时 stdin pipe 与 tsx 冲突，Ctrl+D 无法结束。
**状态：** ✅ 已修复（当前实现用临时文件，不需要 stdin pipe）

### 问题 16：首次部署后管理员账号未创建成功
**状态：** ✅ 已修复（tsx 后正常，2026-03-30 测试确认）
**验证：** testClean2 部署成功，admin "testadmin" 已创建

### 问题 17：ts-node 未在 package.json 中
**描述：** 需要在 devDependencies 添加 ts-node，避免 npx 每次下载。
**状态：** 已忽略（改用 tsx）

### 问题 18：.env 中 DATABASE_URL 路径错误
**描述：** deploy.sh 创建 .env 时写 `file:./dev.db`，但项目实际数据库在 `file:./prisma/dev.db`。
**影响：** 服务器连接空数据库，管线下拉为空，无法创建需求组。
**状态：** ✅ 已修复（deploy.sh 中改为 `file:./prisma/dev.db`）

### 问题 19：prisma db push 也把数据库建到错误位置
**描述：** `file:./prisma/dev.db` 被 Prisma 从 `prisma/schema.prisma` 所在目录解析，导致数据库被创建到 `prisma/prisma/dev.db`（双层 prisma）。
**修复：** 使用绝对路径 `file:$DEPLOY_DIR/prisma/dev.db`。
**状态：** ✅ 已修复

### 问题 20：HEREDOC 模板字符串在 seed.ts/import.ts 中未展开
**描述：** deploy.sh 用单引号 HEREDOC 生成 seed.ts 和 import.ts，导致 `${变量名}` 显示为字面量而非实际值（如输出 `跳过 ${skipped}，已创建 ${created}`）。**不影响数据正确性，仅为显示问题。**
**状态：** 低优先级（不影响功能）

### 问题 21：更新模式下 .next 缓存未清理导致数据库路径错误
**描述：** 在已有代码目录（UPDATE_MODE）重新部署时，残留的 `.next` 目录包含旧构建的 Prisma 客户端数据库路径，导致服务器连接错误数据库（显示管线下拉为空）。删除 .next 并重新 build 后恢复正常。
**修复：** 在 setup_code() 的 UPDATE_MODE 分支中，cd 后立即删除 .next 目录。
**状态：** ✅ 已修复

---

## 测试进度

### 测试方法
1. 解压 `~/Downloads/deploy-test.zip` 获取最新脚本
2. 创建测试目录如 `/Users/tengshao/Downloads/deploy-test/testDir`
3. 从项目父目录运行：`bash u-plus-lite/scripts/deploy.sh`
4. 输入自定义部署路径如 `/Users/tengshao/Downloads/deploy-test/testDir`

### CSV 文件
- `prisma/exports/pipelines.csv` — 7 条管线
- `prisma/exports/budget_items.csv` — 135 条预算项

### 测试流程卡点
- Step 5（创建管理员）→ ts-node 编译错误 ❌ 卡住
- Step 8（CSV 导入）→ 未测试

---

## 关键文件路径

- 部署脚本：`scripts/deploy.sh`（已多次修复）
- CSV 导出工具：`prisma/export.ts`
- CSV 导入工具：`prisma/import.ts`
- 测试指南：`docs/superpowers/test-deployment-guide.md`
- 问题记录：`docs/superpowers/test-issues.md`

---

## 下次继续

搜索关键词："继续一键部署测试"

优先解决：阻塞问题 A（ts-node bundler 编译错误），然后继续完整测试流程。
