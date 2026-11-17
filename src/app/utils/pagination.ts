type TPaginationOptions = {
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: string;
};

export const parsePagination = (options: TPaginationOptions) => {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 10));
  const skip = (page - 1) * limit;
  const sortBy = options.sortBy || 'createdAt';
  const sortOrder = options.sortOrder === 'asc' ? 'asc' : 'desc';
  return { page, limit, skip, sortBy, sortOrder } as const;
};

export const buildMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPage: Math.ceil(total / limit) || 1,
});
