-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "topicModel" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "topicsThroughMessageId" INTEGER;

-- CreateTable
CREATE TABLE "Topic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER NOT NULL,
    "messageId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Topic_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Topic_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Topic_messageId_key" ON "Topic"("messageId");

-- CreateIndex
CREATE INDEX "Topic_conversationId_idx" ON "Topic"("conversationId");
