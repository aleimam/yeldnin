-- Veeey Sales' verdict on a stock-in, sent back so Ops can act on it.
-- A REJECTED shipment reopens at PHOTOS_SENT for correction (owner rule:
-- bounce to Ops in YeldnIN). Additive.
ALTER TABLE "Shipment" ADD COLUMN "reviewStatus" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "reviewedAt" DATETIME;
