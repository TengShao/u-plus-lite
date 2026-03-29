-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
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
