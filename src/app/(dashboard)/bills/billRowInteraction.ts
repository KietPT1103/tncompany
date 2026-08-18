export function shouldActivateBillRow(key: string, eventStartedOnRow: boolean) {
  return eventStartedOnRow && (key === "Enter" || key === " ");
}

export function getBillActionVisibility(
  canEdit: boolean,
  canCancel: boolean,
  isCancelled: boolean,
) {
  const showEdit = canEdit;
  const showCancel = canCancel && !isCancelled;

  return {
    showEdit,
    showCancel,
    showColumn: showEdit || showCancel,
  };
}
