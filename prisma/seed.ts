import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  const resetMode = args.includes('--reset')
  const providedName = resetMode ? args[1] : process.argv[2]
  const providedPassword = resetMode ? args[2] : process.argv[3]

  if (resetMode) {
    // 绕过外键约束删除管理员（用户可能有关联的 workload 记录）
    await prisma.$executeRaw`DELETE FROM User WHERE role = 'ADMIN'`
    console.log('已删除所有管理员账号')
  }

  if (providedName && providedPassword) {
    const hashedPassword = await bcrypt.hash(providedPassword, 10)
    await prisma.user.upsert({
      where: { name: providedName },
      update: {},
      create: {
        name: providedName,
        password: hashedPassword,
        role: 'ADMIN',
      },
    })
    console.log(`Seed complete: admin user "${providedName}" created`)
  } else {
    const hashedPassword = await bcrypt.hash('88888888', 10)
    await prisma.user.upsert({
      where: { name: '邵腾' },
      update: {},
      create: {
        name: '邵腾',
        password: hashedPassword,
        role: 'ADMIN',
      },
    })
    console.log('Seed complete: admin user "邵腾" created (default)')
  }

  // Seed pipeline & budget item settings
  const BUDGET_ITEMS: Record<string, string[]> = {
    'UGC研发': [
      'UGC商业化功能', '编辑器WEB端功能开发', '移动端交互兼容PC端', 'UGC功能规范整理',
      'UGC编辑器日常维护Q1', 'UGC编辑器日常维护Q2', 'UGC编辑器日常维护Q3', 'UGC编辑器日常维护Q4',
      'UGC编辑器能力拓展H1', 'UGC编辑器能力拓展H2',
      'UGC长线复玩支持Q1', 'UGC长线复玩支持Q2', 'UGC长线复玩支持Q3', 'UGC长线复玩支持Q4',
      'UGCPC编辑器设计', 'UGCPC优化',
    ],
    'UGC运营': [
      '乐园会员体系', '乐园AI陪玩系统', '蛋仔shorts设计', '嘉年华活动设计',
      '日常运营活动H1', '日常运营活动H2', 'UGC长线复玩设计',
      'UGC运营日常维护Q1', 'UGC运营日常维护Q2', 'UGC运营日常维护Q3', 'UGC运营日常维护Q4',
    ],
    '玩法': [
      '玩法体验日常维护Q1', '玩法体验日常维护Q2', '玩法体验日常维护Q3', '玩法体验日常维护Q4',
      '超燃相关体验设计与优化Q1', '超燃相关体验设计与优化Q2', '超燃相关体验设计与优化Q3', '超燃相关体验设计与优化Q4',
      '惊魂夜相关体验设计与优化Q1', '惊魂夜相关体验设计与优化Q2', '惊魂夜相关体验设计与优化Q3', '惊魂夜相关体验设计与优化Q4',
      '碰碰棋相关体验设计与优化Q1', '碰碰棋相关体验设计与优化Q2', '碰碰棋相关体验设计与优化Q3', '碰碰棋相关体验设计与优化Q4',
      '寻宝队相关体验设计与优化Q1', '寻宝队相关体验设计与优化Q2', '寻宝队相关体验设计与优化Q3', '寻宝队相关体验设计与优化Q4',
      '捣蛋鬼相关体验设计与优化Q1', '捣蛋鬼相关体验设计与优化Q2', '捣蛋鬼相关体验设计与优化Q3', '捣蛋鬼相关体验设计与优化Q4',
      '新S级玩法设计与落地Q1', '新S级玩法设计与落地Q2', '新S级玩法设计与落地Q3', '新S级玩法设计与落地Q4',
      '主城互动相关设计Q1', '主城互动相关设计Q2', '主城互动相关设计Q3', '主城互动相关设计Q4',
      '副玩法主城设计与维护Q1', '副玩法主城设计与维护Q2', '副玩法主城设计与维护Q3', '副玩法主城设计与维护Q4',
    ],
    '系统': [
      '农场矿洞系统设计及体验优化', '农场社交向系统内容丰富及体验优化', '农场商业化系统内容丰富及体验优化',
      '农场养成深度广度扩展', '农场活跃向玩法及活动维护', '农场基建及基础玩法体验维护优化',
      '疯狂农场玩法体验优化迭代', '疯狂农场玩法功能扩展', '疯狂农场商业化',
      '艾比PVE相关系统内容丰富及体验优化', '艾比PVP相关系统内容丰富及体验优化',
      '艾比养成深度广度扩展', '艾比活跃向玩法及活动维护', '艾比大陆等级优化',
      '艾比营地建造系统', '艾比探险小队', '艾比小市场', '艾比GTA玩法',
      '新赛事扩展', '赛事相关体验优化', '个人信息迭代', '蛋壳蛋圈整体迭代',
      '房间系统迭代', '玩法选择系统体验维护优化', '各类玩法通用结算界面体验维护优化',
      '回流系统体验优化', '社交系统相关体验优化', '聊天系统相关体验优化',
      '相机相册相关系统体验维护优化', '小组件扩展', '设置系统及包体维护相关优化', '常规通用系统相关优化',
    ],
    'IP': [
      '商城、背包相关规范整合', '副玩法商业化规范', 'IP&商业化模板化', '日常商业化系统优化',
      '已有商业化系统优化与维护', '商业化内容海外覆盖式合入', '商城相关功能拓展', '背包相关功能扩展', '预览相关功能扩展',
      '核心赛季奖池付费Q1', '核心赛季奖池付费Q2', '核心赛季奖池付费Q3', '核心赛季奖池付费Q4',
      'IP联动奖池付费Q1', 'IP联动奖池付费Q2', 'IP联动奖池付费Q3', 'IP联动奖池付费Q4',
      '节日限定奖池付费Q1', '节日限定奖池付费Q2', '节日限定奖池付费Q3', '节日限定奖池付费Q4',
      '热销相关活动Q1', '热销相关活动Q2', '热销相关活动Q3', '热销相关活动Q4',
      '周年庆大事件', '年末春晚', 'IP蛋仔岛玩法', '玩具及多形态道具',
      '副玩法商业化支持', 'UGC商业化支持', '系统商业化支持', '蛋仔岛玩法商业化',
    ],
    '海外': [
      '海外-优化与跑查', '海外-覆盖式合入',
      '海外-merge多语言处理Q1', '海外-merge多语言处理Q2', '海外-merge多语言处理Q3', '海外-merge多语言处理Q4',
      '海外-本地化设计',
    ],
  }

  for (const [pipelineName, items] of Object.entries(BUDGET_ITEMS)) {
    const pipeline = await prisma.pipelineSetting.upsert({
      where: { name: pipelineName },
      update: {},
      create: { name: pipelineName },
    })
    for (const itemName of items) {
      await prisma.budgetItemSetting.upsert({
        where: { pipelineId_name: { pipelineId: pipeline.id, name: itemName } },
        update: {},
        create: { name: itemName, pipelineId: pipeline.id },
      })
    }
  }
  console.log('Seed complete: pipeline & budget item settings created')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
