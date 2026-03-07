-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL,
    "description" TEXT,
    "aiDescription" TEXT,
    "text" TEXT NOT NULL,
    "imageUrls" TEXT[],
    "channelId" TEXT,
    "isDm" BOOLEAN NOT NULL DEFAULT false,
    "ocrText" TEXT,
    "extractedData" TEXT,
    "interactionToken" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'pending',
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
