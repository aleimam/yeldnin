import { describe, it, expect } from "vitest";
import { issueOpenedPayload, tripAwaitingApprovalPayload, itemsFlaggedPayload } from "./notify-logic";

describe("notify-logic payloads", () => {
  it("issue payload includes the UID and title, links to /issues", () => {
    const p = issueOpenedPayload({ uid: "ISS2606001", title: "Damaged box" });
    expect(p.body).toBe("ISS2606001 — Damaged box");
    expect(p.url).toBe("/issues");
    expect(p.tag).toBe("issue-ISS2606001");
  });

  it("issue payload tolerates a missing UID", () => {
    const p = issueOpenedPayload({ title: "No uid yet" });
    expect(p.body).toBe("No uid yet");
    expect(p.tag).toBe("issue");
  });

  it("trip-approval payload links to the trip and tags per trip", () => {
    const p = tripAwaitingApprovalPayload(42);
    expect(p.url).toBe("/trips/42");
    expect(p.tag).toBe("trip-approve-42");
    expect(p.body).toContain("#42");
  });

  it("flag payload pluralizes by count", () => {
    expect(itemsFlaggedPayload(1, "DELAYED").body).toBe("1 item flagged as DELAYED.");
    expect(itemsFlaggedPayload(3, "DAMAGED").body).toBe("3 items flagged as DAMAGED.");
  });
});
