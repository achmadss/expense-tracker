-- CreateTable
CREATE TABLE "ExpenseHistory" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseHistory_expenseId_idx" ON "ExpenseHistory"("expenseId");

-- AddForeignKey
ALTER TABLE "ExpenseHistory" ADD CONSTRAINT "ExpenseHistory_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
