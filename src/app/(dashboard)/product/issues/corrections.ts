export function canEditIssue(role: string | null, status: string) {
  return status === "draft" || (role === "admin" && status === "completed");
}

export function availableIssueStock(stock: number, status?: string, original?: { baseQuantity?: number; quantity: number; stockBefore?: number | null }) {
  return stock + (status === "completed" && original?.stockBefore != null ? original.baseQuantity ?? original.quantity : 0);
}
