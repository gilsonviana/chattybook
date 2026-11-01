-- CreateTable
CREATE TABLE "Conversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subject" TEXT NOT NULL,
    "title" TEXT,
    "model1" TEXT NOT NULL,
    "model2" TEXT NOT NULL,
    "persona1" TEXT NOT NULL DEFAULT 'None',
    "persona2" TEXT NOT NULL DEFAULT 'None',
    "mode" TEXT NOT NULL DEFAULT 'discussion',
    "responseLength" TEXT NOT NULL DEFAULT 'medium',
    "totalTurns" INTEGER NOT NULL,
    "devilsAdvocate" BOOLEAN NOT NULL DEFAULT false,
    "forkedFromId" INTEGER,
    "forkSummary" TEXT,
    "summary" TEXT,
    "summaryModel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "generationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER NOT NULL,
    "speaker" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");