import { buildMetrics, fmtMoney, greeting, latestPerFeed, queueMeta, syncSummary } from "./overviewModel";

const kpis = {
  pipeline: { value: 1250000, count: 3 },
  wip: { value: 0, count: 0 },
  inventory: { value: 48200000, count: 6232 },
  sold_mtd: { value: 0, count: 0 },
  tasks_today: { count: 4, overdue: 1 },
  items_ready: { count: 0 },
  new_leads: { new_7d: 2, new_30d: 9 },
  occasions: { today: 0, this_week: 1 },
};

describe("buildMetrics", () => {
  it("gives reps only their own numbers", () => {
    expect(buildMetrics(kpis, { isRep: true }).map((r) => r.id)).toEqual(["pipeline", "tasks", "leads", "occasions"]);
  });

  it("adds stock for admins and skips empty workshop figures", () => {
    expect(buildMetrics(kpis, { isRep: false }).map((r) => r.id)).toEqual([
      "pipeline", "tasks", "leads", "occasions", "stones",
    ]);
  });

  it("shows workshop figures when they hold something", () => {
    const rows = buildMetrics({ ...kpis, wip: { value: 9000, count: 2 }, sold_mtd: { value: 0, count: 1 } }, { isRep: false });
    expect(rows.map((r) => r.id)).toEqual(["pipeline", "tasks", "leads", "occasions", "stones", "wip", "sold"]);
  });

  it("words values and flags overdue tasks", () => {
    const rows = buildMetrics(kpis, { isRep: false });
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.pipeline.value).toBe("$1.3M");
    expect(by.pipeline.detail).toBe("3 open deals");
    expect(by.tasks.detail).toBe("1 overdue");
    expect(by.tasks.tone).toBe("warn");
    expect(by.stones.value).toBe("6,232");
    expect(by.stones.detail).toBe("$48.2M total value");
  });

  it("survives a missing payload", () => {
    const rows = buildMetrics(undefined, { isRep: false });
    expect(rows.find((r) => r.id === "pipeline").detail).toBe("0 open deals");
    expect(rows.find((r) => r.id === "tasks").tone).toBeUndefined();
  });
});

describe("formatting", () => {
  it("formats money compactly", () => {
    expect(fmtMoney(950)).toBe("$950");
    expect(fmtMoney(9500)).toBe("$9,500");
    expect(fmtMoney(48000)).toBe("$48k");
  });

  it("greets by time of day", () => {
    expect(greeting(new Date(2026, 9, 6, 9))).toBe("Good morning");
    expect(greeting(new Date(2026, 9, 6, 14))).toBe("Good afternoon");
    expect(greeting(new Date(2026, 9, 6, 21))).toBe("Good evening");
  });

  it("labels queue severity", () => {
    expect(queueMeta({ severity: "overdue", type: "task" })).toEqual({ text: "Overdue", tone: "warn" });
    expect(queueMeta({ severity: "today", type: "task" })).toEqual({ text: "Today" });
    expect(queueMeta({ severity: "today", type: "occasion" })).toBe(null);
  });
});

describe("sync", () => {
  const runs = [
    { id: 3, sync_type: "stones", success: true, stones_count: 6232, duration_ms: 125000, source: "cron", started_at: "2026-10-06T06:00:00Z" },
    { id: 2, sync_type: "stones", success: false, message: "timeout", source: "manual", started_at: "2026-10-05T06:00:00Z" },
    { id: 1, sync_type: "jewelry", success: true, stones_count: 1, duration_ms: 4000, source: "manual", started_at: "2026-10-04T06:00:00Z" },
  ];

  it("keeps the newest run of each feed", () => {
    expect(latestPerFeed(runs).map((r) => r.id)).toEqual([3, 1]);
    expect(latestPerFeed([])).toEqual([]);
  });

  it("summarises success and failure", () => {
    expect(syncSummary(runs[0])).toMatchObject({ title: "Stones", value: "6,232 stones" });
    expect(syncSummary(runs[0]).detail).toMatch(/Automatic · 2m 5s$/);
    expect(syncSummary(runs[2]).value).toBe("1 item");
    expect(syncSummary(runs[1])).toMatchObject({ title: "Stones", error: "timeout" });
  });
});
