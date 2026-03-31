// prisma/export.ts
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  const outDir = path.join(__dirname, 'exports')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  // 导出管线
  const pipelines = await prisma.pipelineSetting.findMany({
    orderBy: { id: 'asc' },
  })
  const pipelineCsv = ['name', ...pipelines.map((p) => p.name)].join('\n')
  fs.writeFileSync(path.join(outDir, 'pipelines.csv'), '\uFEFF' + pipelineCsv, 'utf8')
  console.log(`导出管线: ${pipelines.length} 条 -> prisma/exports/pipelines.csv`)

  // 导出预算项
  const budgetItems = await prisma.budgetItemSetting.findMany({
    orderBy: { id: 'asc' },
    include: { pipeline: true },
  })
  const budgetCsv = [
    'pipeline,name',
    ...budgetItems.map((b) => `${b.pipeline?.name ?? ''},${b.name}`),
  ].join('\n')
  fs.writeFileSync(path.join(outDir, 'budget_items.csv'), '\uFEFF' + budgetCsv, 'utf8')
  console.log(`导出预算项: ${budgetItems.length} 条 -> prisma/exports/budget_items.csv`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())