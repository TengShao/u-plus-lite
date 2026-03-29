-- CreateTable
CREATE TABLE "PipelineSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BudgetItemSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "pipelineId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetItemSetting_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "PipelineSetting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PipelineSetting_name_key" ON "PipelineSetting"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetItemSetting_pipelineId_name_key" ON "BudgetItemSetting"("pipelineId", "name");
