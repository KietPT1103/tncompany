export const BAR_KDS_DRAG_THRESHOLD_PX = 4;

const BAR_KDS_DRAG_BLOCKED_TARGET_SELECTOR =
  "[data-bar-receipt='true'], button, a, input, select, textarea, [role='button']";

type ClosestTarget = {
  closest: (selector: string) => unknown;
};

export const isBarKdsDragTargetAllowed = (
  target: EventTarget | ClosestTarget | null,
) => {
  if (!target || !("closest" in target) || typeof target.closest !== "function") {
    return false;
  }

  return !target.closest(BAR_KDS_DRAG_BLOCKED_TARGET_SELECTOR);
};

export const getBarKdsDragUpdate = (
  startClientX: number,
  currentClientX: number,
  startScrollLeft: number,
) => {
  const distance = currentClientX - startClientX;
  const hasDragged = Math.abs(distance) >= BAR_KDS_DRAG_THRESHOLD_PX;

  return {
    hasDragged,
    scrollLeft: hasDragged ? startScrollLeft - distance : startScrollLeft,
  };
};
