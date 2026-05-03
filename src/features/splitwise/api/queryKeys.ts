export const splitwiseQueryKeys = {
  all: ['splitwise'] as const,
  authStatus: (userId?: string) => [...splitwiseQueryKeys.all, 'auth-status', userId] as const,
  groups: () => [...splitwiseQueryKeys.all, 'groups'] as const,
  group: (groupId: number) => [...splitwiseQueryKeys.groups(), groupId] as const,
  friends: () => [...splitwiseQueryKeys.all, 'friends'] as const,
  categories: () => [...splitwiseQueryKeys.all, 'categories'] as const,
  expenses: () => [...splitwiseQueryKeys.all, 'expenses'] as const,
  monthlyExpenses: (userId: string | undefined, startDate: string, endDate: string) =>
    [...splitwiseQueryKeys.expenses(), 'monthly', userId, startDate, endDate] as const,
}
