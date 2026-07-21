-- Cross-store customer match key: email (normalized lowercase, non-unique index).
ALTER TABLE "Customer" ADD COLUMN "email" TEXT;
CREATE INDEX "Customer_email_idx" ON "Customer"("email");
