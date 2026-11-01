-- DropTable
DROP TABLE "Topic";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "topicModel";
ALTER TABLE "Conversation" DROP COLUMN "topicsThroughMessageId";
