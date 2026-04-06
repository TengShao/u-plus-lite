/*
  Warnings:

  - You are about to drop the column `primaryPipeline` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RequirementGroup" ADD COLUMN "lastSubmittedBy" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "level" TEXT,
    "pipelines" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "id", "level", "name", "password", "role", "updatedAt") SELECT "createdAt", "id", "level", "name", "password", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");
CREATE TABLE "new_UserCyclePipeline" (
    "userId" INTEGER NOT NULL,
    "cycleId" INTEGER NOT NULL,
    "pipeline" TEXT NOT NULL,

    PRIMARY KEY ("userId", "cycleId")
);
INSERT INTO "new_UserCyclePipeline" ("cycleId", "pipeline", "userId") SELECT "cycleId", "pipeline", "userId" FROM "UserCyclePipeline";
DROP TABLE "UserCyclePipeline";
ALTER TABLE "new_UserCyclePipeline" RENAME TO "UserCyclePipeline";
CREATE TABLE "new_Workload" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "requirementGroupId" INTEGER NOT NULL,
    "billingCycleId" INTEGER NOT NULL,
    "manDays" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Workload_requirementGroupId_fkey" FOREIGN KEY ("requirementGroupId") REFERENCES "RequirementGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Workload_billingCycleId_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "BillingCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Workload" ("billingCycleId", "createdAt", "id", "manDays", "requirementGroupId", "updatedAt", "userId") SELECT "billingCycleId", "createdAt", "id", "manDays", "requirementGroupId", "updatedAt", "userId" FROM "Workload";
DROP TABLE "Workload";
ALTER TABLE "new_Workload" RENAME TO "Workload";
CREATE UNIQUE INDEX "Workload_userId_requirementGroupId_billingCycleId_key" ON "Workload"("userId", "requirementGroupId", "billingCycleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
