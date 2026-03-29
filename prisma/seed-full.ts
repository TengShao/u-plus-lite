import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 创建测试用户
  const testUsers = [
    { name: '邵腾', password: '88888888', role: 'ADMIN', level: 'P5' },
    { name: '吴昌文', password: '123456', role: 'MEMBER', level: 'P4' },
    { name: '张三', password: '123456', role: 'MEMBER', level: 'P3' },
    { name: '李四', password: '123456', role: 'MEMBER', level: 'P4' },
    { name: '王五', password: '123456', role: 'MEMBER', level: 'P5' },
    { name: '赵六', password: '123456', role: 'MEMBER', level: 'P3' },
    { name: '孙七', password: '123456', role: 'MEMBER', level: 'P4' },
    { name: '周八', password: '123456', role: 'MEMBER', level: 'P5' },
  ]

  const users = []
  for (const userData of testUsers) {
    const existing = await prisma.user.findUnique({ where: { name: userData.name } })
    if (!existing) {
      const hashedPassword = await bcrypt.hash(userData.password, 10)
      const user = await prisma.user.create({
        data: { ...userData, password: hashedPassword }
      })
      users.push(user)
      console.log(`创建用户: ${userData.name}`)
    } else {
      users.push(existing)
    }
  }

  const admin = users.find(u => u.role === 'ADMIN') || users[0]
  const designers = users.slice(0, 8)

  // 需求组名称前缀
  const namePrefixes = [
    '首页改版', '搜索优化', '支付流程', '用户中心', '消息系统',
    '数据统计', '权限管理', '文件上传', '设置页面', '帮助中心',
    '活动页面', '推送通知'
  ]

  const pipelines = ['用户端', '商家端', '管理后台', '中台服务', '数据平台', '营销工具']
  const modules = ['交易', '营销', '履约', '会员', '财务', '商品']
  const types = [['新增'], ['优化'], ['修复'], ['新增', '优化'], ['优化', '修复']]
  const ratings = ['A', 'B', 'C', 'D', 'S']

  // 创建20个周期 (从2024年6月开始)
  for (let i = 0; i < 20; i++) {
    const cycleIndex = i + 6  // 从6月开始
    const year = 2024 + Math.floor(cycleIndex / 12)
    const month = (cycleIndex % 12) + 1
    const label = `${month}月`
    
    // 计算周期日期: 上月26日到本月25日
    const startDate = new Date(year, month - 2, 26)
    const endDate = new Date(year, month - 1, 25)

    const existing = await prisma.billingCycle.findFirst({
      where: { label }
    })

    if (existing) {
      console.log(`周期 ${label} 已存在`)
      continue
    }

    const cycle = await prisma.billingCycle.create({
      data: {
        label,
        startDate,
        endDate,
        status: i >= 18 ? 'OPEN' : 'CLOSED',
        createdBy: admin.id
      }
    })
    console.log(`创建周期: ${year}年 ${label}`)

    // 每个周期12个需求组
    for (let j = 0; j < 12; j++) {
      const nameIndex = j % namePrefixes.length
      const participantCount = [1, 2, 3, 4, 5, 6, 0][j % 7]
      const isComplete = j >= 9

      const req = await prisma.requirementGroup.create({
        data: {
          name: `${namePrefixes[nameIndex]}${i}-${j + 1}`,
          status: isComplete ? 'COMPLETE' : 'INCOMPLETE',
          rating: j % 5 === 0 ? null : ratings[j % ratings.length],
          pipeline: pipelines[j % pipelines.length],
          module: modules[j % modules.length],
          types: JSON.stringify(types[j % types.length]),
          budgetItem: `${pipelines[j % pipelines.length]}-预算项${j + 1}`,
          canClose: j % 3 === 0,
          isBuilt: j % 2 === 0,
          funcPoints: j % 4 === 0 ? 10 + j : null,
          pageCount: j % 3 === 0 ? 5 + j : null,
          version: 1,
          createdInCycleId: cycle.id,
          createdBy: admin.id,
        }
      })

      // 添加设计师工作量
      const selectedDesigners = designers.slice(0, participantCount)
      for (let k = 0; k < selectedDesigners.length; k++) {
        const designer = selectedDesigners[k]
        const manDays = Math.round((0.5 + Math.random() * 5) * 10) / 10

        await prisma.workload.create({
          data: {
            userId: designer.id,
            requirementGroupId: req.id,
            billingCycleId: cycle.id,
            manDays
          }
        })
      }

      // 随机设置最后提交时间
      if (Math.random() > 0.3) {
        const daysAgo = Math.floor(Math.random() * 20)
        const lastSubmittedAt = new Date()
        lastSubmittedAt.setDate(lastSubmittedAt.getDate() - daysAgo)
        await prisma.requirementGroup.update({
          where: { id: req.id },
          data: { lastSubmittedAt }
        })
      }
    }
  }

  console.log('测试数据创建完成!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
