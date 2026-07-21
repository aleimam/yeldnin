import "server-only";
import { prisma } from "@/lib/db";
import { integrationEnabled } from "@/lib/integration/config";
import { recordOutbox } from "@/lib/integration/integration-service";
import { buildShipmentWire, type ShipmentUnit } from "@/lib/integration/shipment-wire";

/**
 * Outbound Incoming-Shipments channel (YeldnIN → Veeey), `shipment.received`.
 *
 * Fired when Ops mark a shipment **WEBSITE** ("In Website"). It only REPORTS
 * what arrived — Veeey's Sales still review the expiry dates against the photos
 * and approve, and that approval is what creates sellable stock. So this is
 * safe to emit even if nobody acts on it.
 *
 * Best-effort like `emitDeliveryTracking`: the stock move must never fail
 * because the outbox did.
 */
export async function emitShipmentReceived(shipmentId: number, at: Date): Promise<void> {
  try {
    if (!(await integrationEnabled())) return;
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, uid: true, scope: true },
    });
    if (!shipment) return;
    // Deliveries/stock-in are a VEEEY-line concept; never leak another scope's
    // goods across the integration.
    if (shipment.scope !== "VEEEY") return;

    const items = await prisma.item.findMany({
      where: { containerType: "SHIPMENT", containerId: shipmentId, exceptionFlag: null },
      select: {
        productId: true,
        expiryDate: true,
        lotCode: true,
        purchasePrice: true,
        purchaseCurrency: true,
        product: { select: { sku: true, veeeyWpId: true, name: true } },
      },
    });
    if (!items.length) return;

    const units: ShipmentUnit[] = items.map((i) => ({
      productId: i.productId,
      sku: i.product?.sku ?? null,
      veeeyWpId: i.product?.veeeyWpId ?? null,
      productName: i.product?.name ?? "",
      expiryDate: i.expiryDate,
      lotCode: i.lotCode,
      purchasePrice: i.purchasePrice,
      purchaseCurrency: i.purchaseCurrency,
    }));

    const photos = await prisma.shipmentPhoto.findMany({
      where: { shipmentId },
      orderBy: { id: "asc" },
      select: { assetId: true },
    });

    const wire = buildShipmentWire(shipment, units, photos.map((p) => p.assetId), at);
    await recordOutbox("shipment.received", wire.shipmentUid ?? String(wire.shipmentId), wire);
  } catch {
    // best-effort — reporting the arrival must never block the arrival
  }
}
