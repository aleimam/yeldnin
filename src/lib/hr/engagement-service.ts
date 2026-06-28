import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { nextUid } from "@/lib/uid";
import { getLocale } from "@/i18n/server";
import { displayName } from "@/lib/users/users-logic";

// ── Categories (admin catalog) ───────────────────────────────────────────────
export function listCategories(includeArchived = false) {
  return prisma.engagementCategory.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}
export async function createCategory(input: { name: string; nameAr?: string | null }, byUserId: number) {
  if (!input.name.trim()) throw new Error("A name is required.");
  await prisma.engagementCategory.create({ data: { name: input.name.trim(), nameAr: clean(input.nameAr), createdById: byUserId } });
}
export async function updateCategory(id: number, input: { name: string; nameAr?: string | null }, byUserId: number) {
  if (!input.name.trim()) throw new Error("A name is required.");
  await prisma.engagementCategory.update({ where: { id }, data: { name: input.name.trim(), nameAr: clean(input.nameAr), updatedById: byUserId } });
}
export async function archiveCategory(id: number, byUserId: number) {
  await prisma.engagementCategory.update({ where: { id }, data: { archivedAt: new Date(), updatedById: byUserId } });
}

// ── Templates + criteria (admin catalog) ─────────────────────────────────────
export function listTemplates() {
  return prisma.engagementTemplate.findMany({
    where: { archivedAt: null },
    include: {
      category: { select: { id: true, name: true, nameAr: true } },
      criteria: { where: { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
    orderBy: [{ name: "asc" }],
  });
}
export async function createTemplate(input: { name: string; nameAr?: string | null; categoryId?: number | null; description?: string | null }, byUserId: number) {
  if (!input.name.trim()) throw new Error("A name is required.");
  await prisma.engagementTemplate.create({
    data: { name: input.name.trim(), nameAr: clean(input.nameAr), categoryId: input.categoryId ?? null, description: clean(input.description), createdById: byUserId },
  });
}
export async function updateTemplate(id: number, input: { name: string; nameAr?: string | null; categoryId?: number | null; description?: string | null }, byUserId: number) {
  if (!input.name.trim()) throw new Error("A name is required.");
  await prisma.engagementTemplate.update({
    where: { id },
    data: { name: input.name.trim(), nameAr: clean(input.nameAr), categoryId: input.categoryId ?? null, description: clean(input.description), updatedById: byUserId },
  });
}
export async function archiveTemplate(id: number, byUserId: number) {
  await prisma.engagementTemplate.update({ where: { id }, data: { archivedAt: new Date(), updatedById: byUserId } });
}
export async function createCriterion(templateId: number, input: { name: string; nameAr?: string | null; bonusAmount: number }) {
  if (!input.name.trim()) throw new Error("A name is required.");
  await prisma.engagementCriterion.create({ data: { templateId, name: input.name.trim(), nameAr: clean(input.nameAr), bonusAmount: Math.max(0, input.bonusAmount || 0) } });
}
export async function updateCriterion(id: number, input: { name: string; nameAr?: string | null; bonusAmount: number }) {
  if (!input.name.trim()) throw new Error("A name is required.");
  await prisma.engagementCriterion.update({ where: { id }, data: { name: input.name.trim(), nameAr: clean(input.nameAr), bonusAmount: Math.max(0, input.bonusAmount || 0) } });
}
export async function archiveCriterion(id: number) {
  await prisma.engagementCriterion.update({ where: { id }, data: { archivedAt: new Date() } });
}

// ── Events (instances) ───────────────────────────────────────────────────────
export function listEvents() {
  return prisma.engagementEvent.findMany({
    where: { archivedAt: null },
    include: {
      template: { select: { name: true, nameAr: true, category: { select: { name: true, nameAr: true } } } },
      _count: { select: { eligibles: true, achievements: true } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
  });
}

export async function getEvent(id: number) {
  const event = await prisma.engagementEvent.findFirst({
    where: { id, archivedAt: null },
    include: {
      template: { select: { id: true, name: true, nameAr: true, criteria: { where: { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } },
      eligibles: { include: { employee: { select: { id: true, user: { select: { name: true, nameAr: true } } } } } },
      achievements: { select: { criterionId: true, employeeId: true } },
    },
  });
  return event;
}

export async function createEvent(input: { templateId: number; year: number; month: number; title?: string | null; notes?: string | null }, byUserId: number) {
  const uid = await nextUid("ENG");
  return prisma.engagementEvent.create({
    data: { uid, templateId: input.templateId, year: input.year, month: input.month, title: clean(input.title), notes: clean(input.notes), createdById: byUserId },
  });
}
export async function updateEvent(id: number, input: { year: number; month: number; title?: string | null; notes?: string | null }, byUserId: number) {
  await prisma.engagementEvent.update({ where: { id }, data: { year: input.year, month: input.month, title: clean(input.title), notes: clean(input.notes), updatedById: byUserId } });
}
export async function archiveEvent(id: number, byUserId: number) {
  await prisma.engagementEvent.update({ where: { id }, data: { archivedAt: new Date(), updatedById: byUserId } });
}

/** Replace the event's eligible set with the given employee ids. Achievements for
 *  anyone dropped are removed too (they can no longer earn from this event). */
export async function setEventEligibles(eventId: number, employeeIds: number[], _byUserId: number) {
  const keep = [...new Set(employeeIds)];
  await prisma.$transaction([
    prisma.engagementEligible.deleteMany({ where: { eventId, employeeId: { notIn: keep.length ? keep : [-1] } } }),
    prisma.engagementAchievement.deleteMany({ where: { eventId, employeeId: { notIn: keep.length ? keep : [-1] } } }),
    ...keep.map((employeeId) =>
      prisma.engagementEligible.upsert({ where: { eventId_employeeId: { eventId, employeeId } }, update: {}, create: { eventId, employeeId } }),
    ),
  ]);
}

/** Mark/unmark one employee as having achieved one criterion. Guards that the
 *  employee is eligible and the criterion belongs to the event's template. */
export async function setAchievement(eventId: number, criterionId: number, employeeId: number, on: boolean, byUserId: number) {
  if (on) {
    const eligible = await prisma.engagementEligible.findUnique({ where: { eventId_employeeId: { eventId, employeeId } }, select: { id: true } });
    if (!eligible) throw new Error("That employee isn't eligible for this event.");
    await prisma.engagementAchievement.upsert({
      where: { eventId_criterionId_employeeId: { eventId, criterionId, employeeId } },
      update: {},
      create: { eventId, criterionId, employeeId, byUserId },
    });
  } else {
    await prisma.engagementAchievement.deleteMany({ where: { eventId, criterionId, employeeId } });
  }
}

// ── Pickers + employee views ─────────────────────────────────────────────────
/** Active employees as eligibility options (id + localized display name). */
export async function activeEmployeeOptions(): Promise<{ id: number; label: string }[]> {
  const [locale, emps] = await Promise.all([
    getLocale(),
    prisma.employee.findMany({ where: { archivedAt: null, user: { active: true } }, select: { id: true, user: { select: { name: true, nameAr: true } } }, orderBy: { id: "asc" } }),
  ]);
  return emps.map((e) => ({ id: e.id, label: e.user ? displayName(e.user, locale) : `#${e.id}` }));
}

/** One employee's engagement: events they were eligible for, what they achieved,
 *  and the bonus earned. Feeds the profile + the My-Engagement page. */
export async function employeeEngagement(employeeId: number) {
  const eligibles = await prisma.engagementEligible.findMany({
    where: { employeeId, event: { archivedAt: null } },
    include: {
      event: {
        select: {
          id: true, year: true, month: true, title: true,
          template: { select: { name: true, nameAr: true } },
        },
      },
    },
    orderBy: { id: "desc" },
  });
  const eventIds = eligibles.map((e) => e.eventId);
  const achievements = eventIds.length
    ? await prisma.engagementAchievement.findMany({
        where: { employeeId, eventId: { in: eventIds } },
        include: { criterion: { select: { name: true, nameAr: true, bonusAmount: true } } },
      })
    : [];
  const byEvent = new Map<number, { name: string; nameAr: string | null; bonusAmount: number }[]>();
  for (const a of achievements) {
    const arr = byEvent.get(a.eventId) ?? [];
    arr.push(a.criterion);
    byEvent.set(a.eventId, arr);
  }
  return eligibles.map((e) => {
    const achieved = byEvent.get(e.eventId) ?? [];
    return {
      eventId: e.eventId,
      year: e.event.year,
      month: e.event.month,
      title: e.event.title,
      templateName: e.event.template.name,
      templateNameAr: e.event.template.nameAr,
      achieved,
      bonus: achieved.reduce((s, c) => s + c.bonusAmount, 0),
    };
  });
}

// ── Analytics ────────────────────────────────────────────────────────────────
/** Participation per event (eligible vs participated, total bonus) + the top
 *  earners across all events. Feeds the HR analytics page. */
export async function engagementAnalytics() {
  const events = await prisma.engagementEvent.findMany({
    where: { archivedAt: null },
    include: {
      template: { select: { name: true, nameAr: true, category: { select: { name: true, nameAr: true } } } },
      _count: { select: { eligibles: true } },
      achievements: { select: { employeeId: true, criterion: { select: { bonusAmount: true } } } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
  });
  const rows = events.map((e) => ({
    id: e.id,
    title: e.title,
    templateName: e.template.name,
    templateNameAr: e.template.nameAr,
    categoryName: e.template.category?.name ?? null,
    categoryNameAr: e.template.category?.nameAr ?? null,
    year: e.year,
    month: e.month,
    eligible: e._count.eligibles,
    participants: new Set(e.achievements.map((a) => a.employeeId)).size,
    bonus: Math.round(e.achievements.reduce((s, a) => s + a.criterion.bonusAmount, 0) * 100) / 100,
  }));

  const byEmp = new Map<number, number>();
  for (const e of events) for (const a of e.achievements) byEmp.set(a.employeeId, (byEmp.get(a.employeeId) ?? 0) + a.criterion.bonusAmount);
  const topIds = [...byEmp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  let top: { name: string; bonus: number }[] = [];
  if (topIds.length) {
    const [locale, emps] = await Promise.all([
      getLocale(),
      prisma.employee.findMany({ where: { id: { in: topIds.map(([id]) => id) } }, select: { id: true, user: { select: { name: true, nameAr: true } } } }),
    ]);
    const nameOf = new Map(emps.map((e) => [e.id, e.user ? displayName(e.user, locale) : `#${e.id}`]));
    top = topIds.map(([id, bonus]) => ({ name: nameOf.get(id) ?? `#${id}`, bonus: Math.round(bonus * 100) / 100 }));
  }
  return { rows, top };
}
