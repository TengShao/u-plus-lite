-- Create UserCyclePipeline table
CREATE TABLE "UserCyclePipeline" (
    "userId" INTEGER NOT NULL,
    "cycleId" INTEGER NOT NULL,
    "pipeline" TEXT NOT NULL,
    PRIMARY KEY ("userId", "cycleId"),
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY ("cycleId") REFERENCES "BillingCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);