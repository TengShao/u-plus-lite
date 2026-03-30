/*
  Warnings:

  - You are about to drop the column `isDraft` on the `RequirementGroup` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BudgetItemSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "pipelineId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetItemSetting_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "PipelineSetting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BudgetItemSetting" ("createdAt", "id", "name", "pipelineId", "updatedAt") SELECT "createdAt", "id", "name", "pipelineId", "updatedAt" FROM "BudgetItemSetting";
DROP TABLE "BudgetItemSetting";
ALTER TABLE "new_BudgetItemSetting" RENAME TO "BudgetItemSetting";
CREATE UNIQUE INDEX "BudgetItemSetting_pipelineId_name_key" ON "BudgetItemSetting"("pipelineId", "name");
CREATE TABLE "new_RequirementGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "rating" TEXT,
    "module" TEXT,
    "pipeline" TEXT,
    "types" TEXT,
    "budgetItem" TEXT,
    "canClose" BOOLEAN NOT NULL DEFAULT true,
    "isBuilt" BOOLEAN NOT NULL DEFAULT false,
    "funcPoints" INTEGER,
    "pageCount" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdInCycleId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSubmittedAt" DATETIME,
    CONSTRAINT "RequirementGroup_createdInCycleId_fkey" FOREIGN KEY ("createdInCycleId") REFERENCES "BillingCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RequirementGroup_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RequirementGroup" ("budgetItem", "canClose", "createdAt", "createdBy", "createdInCycleId", "funcPoints", "id", "isBuilt", "lastSubmittedAt", "module", "name", "pageCount", "pipeline", "rating", "status", "types", "updatedAt", "version") SELECT "budgetItem", "canClose", "createdAt", "createdBy", "createdInCycleId", "funcPoints", "id", "isBuilt", "lastSubmittedAt", "module", "name", "pageCount", "pipeline", "rating", "status", "types", "updatedAt", "version" FROM "RequirementGroup";
DROP TABLE "RequirementGroup";
ALTER TABLE "new_RequirementGroup" RENAME TO "RequirementGroup";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
