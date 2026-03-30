import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as readline from 'readline'

const prisma = new PrismaClient()

type CliArgs = {
  pipelines?: string
  budgetItems?: string
}

function parseArgs(): CliArgs {
  const args: CliArgs = {}
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg.startsWith('--pipelines=')) args.pipelines = arg.replace('--pipelines=', '')
    if (arg.startsWith('--budget-items=')) args.budgetItems = arg.replace('--budget-items=', '')
  }
  return args
}

async function readCsvLines(input: string): Promise<string[]> {
  if (input === '-') {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
    const lines: string[] = []
    for await (const line of rl) lines.push(line)
    return lines
  }
  if (!fs.existsSync(input)) {
    console.error(`文件不存在: ${input}`)
    process.exit(1)
  }
  return fs.readFileSync(input, 'utf8').split('\n').filter((l) => l.trim())
}

function parsePipelinesCsv(lines: string[]): string[] {
  if (lines.length < 2) return []
  return lines.slice(1).filter((l) => l.trim())
}

function parseBudgetItemsCsv(lines: string[]): Array<{ pipeline: string; name: string }> {
  if (lines.length < 2) return []
  return lines.slice(1).map((line) => {
    const firstComma = line.indexOf(',')
    if (firstComma === -1) return { pipeline: '', name: line.trim() }
    return {
      pipeline: line.slice(0, firstComma).trim(),
      name: line.slice(firstComma + 1).split(',')[0].trim(),
    }
  })
}

async function ensureOtherPipeline(): Promise<number> {
  const existing = await prisma.pipelineSetting.findUnique({ where: { name: '其他' } })
  if (existing) return existing.id
  const created = await prisma.pipelineSetting.create({ data: { name: '其他' } })
  console.log('  自动创建"其他"管线')
  return created.id
}

async function importPipelines(args: CliArgs) {
  if (!args.pipelines) {
    console.log('跳过管线导入（未指定 --pipelines）')
    return
  }
  const lines = await readCsvLines(args.pipelines)
  const names = parsePipelinesCsv(lines)
  if (names.length === 0) {
    console.log('pipelines.csv 为空，跳过')
    return
  }
  let created = 0, skipped = 0
  for (const name of names) {
    if (!name.trim()) continue
    const existing = await prisma.pipelineSetting.findUnique({ where: { name } })
    if (existing) {
      skipped++
    } else {
      await prisma.pipelineSetting.create({ data: { name } })
      created++
    }
  }
  console.log(`管线导入完成：跳过 ${skipped}，已创建 ${created}`)
}

async function importBudgetItems(args: CliArgs) {
  if (!args.budgetItems) {
    console.log('跳过预算项导入（未指定 --budget-items）')
    return
  }
  const otherPipelineId = await ensureOtherPipeline()
  const lines = await readCsvLines(args.budgetItems)
  const items = parseBudgetItemsCsv(lines)
  if (items.length === 0) {
    console.log('budget_items.csv 为空，跳过')
    return
  }
  let created = 0, skipped = 0
  const pipelineMap = new Map<string, number>()
  const allPipelines = await prisma.pipelineSetting.findMany()
  for (const p of allPipelines) pipelineMap.set(p.name, p.id)
  for (const item of items) {
    if (!item.name.trim()) continue
    let pipelineId = item.pipeline ? pipelineMap.get(item.pipeline) : undefined
    if (!pipelineId) {
      if (item.pipeline) {
        const createdPipeline = await prisma.pipelineSetting.create({ data: { name: item.pipeline } })
        pipelineMap.set(item.pipeline, createdPipeline.id)
        pipelineId = createdPipeline.id
        console.log(`  自动创建管线: ${item.pipeline}`)
      } else {
        pipelineId = otherPipelineId
      }
    }
    const existing = await prisma.budgetItemSetting.findFirst({
      where: { pipelineId, name: item.name },
    })
    if (existing) {
      skipped++
    } else {
      await prisma.budgetItemSetting.create({ data: { pipelineId, name: item.name } })
      created++
    }
  }
  console.log(`预算项导入完成：跳过 ${skipped}，已创建 ${created}`)
}

async function main() {
  const args = parseArgs()
  console.log('')
  await importPipelines(args)
  await importBudgetItems(args)
  console.log('')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
