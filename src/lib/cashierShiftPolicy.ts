const existingShiftStores = new Set(['cafe', 'restaurant', 'bakery']);

/** Existing shift rules stay unchanged; newly created takeaway counters also use shifts. */
export function supportsCashierShifts(storeId: string, store?: { isTakeAway: boolean }): boolean {
  return existingShiftStores.has(storeId) || store?.isTakeAway === true;
}
