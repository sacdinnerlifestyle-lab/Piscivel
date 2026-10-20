import { describe, it, expect } from "vitest";
import { filterReportVisits } from "@/lib/daily-report-filter";

const visits = [
  { id: "visit-1", pool: { client: { id: "client-1" } } },
  { id: "visit-2", pool: { client: { id: "client-2" } } },
  { id: "visit-3", pool: { client: { id: "client-1" } } },
];

describe("daily report client selection", () => {
  it("includes only the selected client's visits, across their pools", () => {
    expect(filterReportVisits(visits, "client-1").map((visit) => visit.id)).toEqual(["visit-1", "visit-3"]);
  });
  it("includes all clients when no individual client is selected", () => {
    expect(filterReportVisits(visits).map((visit) => visit.id)).toEqual(["visit-1", "visit-2", "visit-3"]);
  });
  it("returns no visits when the client has none that day", () => {
    expect(filterReportVisits(visits, "client-3")).toEqual([]);
  });
});