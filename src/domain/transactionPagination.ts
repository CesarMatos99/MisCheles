export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export const TRANSACTION_PAGE_SIZES = [10, 20, 50] as const;

export function paginate<T>(records: readonly T[], requestedPage: number, requestedPageSize: number): PageResult<T> {
  const pageSize = TRANSACTION_PAGE_SIZES.includes(requestedPageSize as typeof TRANSACTION_PAGE_SIZES[number])
    ? requestedPageSize
    : 20;
  const totalItems = records.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage) || 1), totalPages);
  const start = (page - 1) * pageSize;
  return { items: records.slice(start, start + pageSize), page, pageSize, totalItems, totalPages };
}
