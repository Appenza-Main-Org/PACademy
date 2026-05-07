/**
 * Helpers for the mock service layer.
 * When swapping to real APIs, only these helpers and the service files change.
 */

export async function simulateLatency(min = 200, max = 500): Promise<void> {
  const delay = Math.floor(min + Math.random() * (max - min));
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export function paginate<T>(items: T[], page = 1, pageSize = 20): {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}
