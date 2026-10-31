-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Conversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subject" TEXT NOT NULL,
    "title" TEXT,
    "model1" TEXT NOT NULL,
    "model2" TEXT NOT NULL,
    "reviewerModel" TEXT,
    "persona1" TEXT NOT NULL DEFAULT 'None',
    "persona2" TEXT NOT NULL DEFAULT 'None',
    "mode" TEXT NOT NULL DEFAULT 'discussion',
    "responseLength" TEXT NOT NULL DEFAULT 'medium',
    "totalTurns" INTEGER NOT NULL,
    "devilsAdvocate" BOOLEAN NOT NULL DEFAULT false,
    "forkedFromId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "generationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Conversation" ("createdAt", "generationId", "id", "mode", "model1", "model2", "persona1", "persona2", "responseLength", "reviewerModel", "status", "subject", "title", "totalTurns", "updatedAt") SELECT "createdAt", "generationId", "id", "mode", "model1", "model2", "persona1", "persona2", "responseLength", "reviewerModel", "status", "subject", "title", "totalTurns", "updatedAt" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

