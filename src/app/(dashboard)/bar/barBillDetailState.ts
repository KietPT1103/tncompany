export type BarBillDetailState = string | null;
type BarBillWorkflowStatus = "new" | "preparing" | "ready" | "collected";

export type BarBillDetailAdvance = {
  label: string;
  targetStatus: BarBillWorkflowStatus;
};

export type BarBillDetailAction =
  | { type: "open"; jobId: string }
  | { type: "close" };

export const initialBarBillDetailState: BarBillDetailState = null;

export function barBillDetailReducer(
  state: BarBillDetailState,
  action: BarBillDetailAction,
): BarBillDetailState {
  if (action.type === "open") return action.jobId;
  return null;
}

export function getBarBillDetailAdvance(
  status: BarBillWorkflowStatus,
): BarBillDetailAdvance | null {
  if (status === "collected") return null;
  return {
    label: "Hoàn thành",
    targetStatus: "collected",
  };
}

export function shouldOpenBarBillDetailFromCard(didDrag: boolean): boolean {
  return !didDrag;
}
