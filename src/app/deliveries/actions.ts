"use server";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import { validateStatusChange, canOperateDeliveries, DELIVERIES_MODULE } from "@/lib/deliveries/deliveries-logic";
import { getDeliveryFor, courierIdForUser, applyStatusChange, setReviewFlag, type StatusChangeInput } from "@/lib/deliveries/deliveries-service";

export type DeliveryResult = { ok: true } | { ok: false; error: string };

/**
 * GOLDEN RULE, learned the hard way in the Codex audit: authorize the STORED
 * record, not the submitted payload, and answer identically for "missing" and
 * "not yours". `getDeliveryFor` applies the courier filter, so a courier passing
 * someone else's delivery id gets exactly what he'd get for an id that doesn't
 * exist — no way to probe which deliveries exist in the rest of the system.
 */
async function loadOwn(id: number) {
  const access = await requireModule(DELIVERIES_MODULE, "VIEW");
  const tier = access.user.tier;
  const ownCourierId = await courierIdForUser(access.user.id);
  const delivery = await getDeliveryFor(access, tier, ownCourierId, id);
  return { access, tier, delivery };
}

const NOT_FOUND = "Delivery not found.";

export async function changeDeliveryStatusAction(id: number, input: StatusChangeInput): Promise<DeliveryResult> {
  const { access, tier, delivery } = await loadOwn(id);
  if (!delivery) return { ok: false, error: NOT_FOUND };
  if (!canOperateDeliveries(access, tier)) return { ok: false, error: "You can't update deliveries." };

  const errs = validateStatusChange({
    from: delivery.status,
    to: input.to,
    failureReason: input.failureReason,
    promisedDate: input.promisedDate,
    promisedSlot: input.promisedSlot,
    // An already-assigned delivery keeps its courier when it moves on, so only a
    // fresh assignment has to supply one.
    courierId: input.courierId ?? delivery.courierId,
  });
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };

  await applyStatusChange(
    { id: delivery.id, status: delivery.status, bounceCount: delivery.bounceCount, collectPiastres: delivery.collectPiastres },
    input,
    access.user.id,
  );
  await writeAudit(access.user.id, DELIVERIES_MODULE, "delivery.status", "delivery", id, { from: delivery.status, to: input.to });
  revalidatePath("/deliveries");
  revalidatePath(`/deliveries/${id}`);
  return { ok: true };
}

export async function setDeliveryFlagAction(id: number, flag: boolean, note: string | null): Promise<DeliveryResult> {
  const { access, tier, delivery } = await loadOwn(id);
  if (!delivery) return { ok: false, error: NOT_FOUND };
  if (!canOperateDeliveries(access, tier)) return { ok: false, error: "You can't update deliveries." };
  await setReviewFlag(id, flag, note, access.user.id);
  await writeAudit(access.user.id, DELIVERIES_MODULE, flag ? "delivery.flag" : "delivery.unflag", "delivery", id, {});
  revalidatePath("/deliveries");
  revalidatePath(`/deliveries/${id}`);
  return { ok: true };
}
