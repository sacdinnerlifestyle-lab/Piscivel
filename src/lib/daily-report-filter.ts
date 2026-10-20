type ClientVisit = { pool: { client: { id: string } | null } | null };

export function filterReportVisits<T extends ClientVisit>(visits: T[], clientId?: string): T[] {
  return clientId ? visits.filter((visit) => visit.pool?.client?.id === clientId) : visits;
}