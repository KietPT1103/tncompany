export const shouldShowBarReceiptPin = (segment: {
  isContinuation: boolean;
}) => !segment.isContinuation;
