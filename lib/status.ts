// Status normalization helpers

export const STATUS_MAP: Record<string, string> = {
  backlog: "TODO",
  in_progress: "IN_PROGRESS",
  review: "IN_PROGRESS",
  done: "DONE",
};

export const REVERSE_STATUS_MAP: Record<string, string> = {
  TODO: "backlog",
  IN_PROGRESS: "in_progress",
  DONE: "done",
};

export function normalizeStatus(status: string): string {
  return STATUS_MAP[status] || status;
}

export function denormalizeStatus(status: string): string {
  return REVERSE_STATUS_MAP[status] || status;
}
