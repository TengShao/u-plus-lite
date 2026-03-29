import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const cycles = await prisma.billingCycle.count()
  const reqs = await prisma.requirementGroup.count()
  const workloads = await prisma.workload.count()
  console.log(`BillingCycle: ${cycles}`)
  console.log(`RequirementGroup: ${reqs}`)
  console.log(`Workload: ${workloads}`)
}
main().finally(() => prisma.$disconnect())
