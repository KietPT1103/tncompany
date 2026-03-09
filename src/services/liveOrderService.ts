import { db } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";

export type LiveOrderStatus = "open" | "closed";

export type LiveOrderItem = {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
  category?: string;
};

export type LiveOrder = {
  id: string;
  storeId: string;
  orderKey: string;
  tableNumber: string;
  status: LiveOrderStatus;
  items: LiveOrderItem[];
  updatedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedById?: string;
  updatedByName?: string;
  updatedByRole?: string;
};

export type UpsertLiveOrderInput = {
  storeId: string;
  orderKey: string;
  tableNumber: string;
  items: LiveOrderItem[];
  updatedById?: string;
  updatedByName?: string;
  updatedByRole?: string;
};

const LIVE_ORDER_COLLECTION = "pos_orders";

const toDocId = (storeId: string, orderKey: string) =>
  `${storeId}__${encodeURIComponent(orderKey.trim().toLowerCase())}`;

export function subscribeLiveOrders(
  storeId: string,
  onChange: (orders: LiveOrder[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, LIVE_ORDER_COLLECTION),
    where("storeId", "==", storeId),
    where("status", "==", "open")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const mapped = snapshot.docs.map(
        (item) =>
          ({
            id: item.id,
            ...(item.data() as Omit<LiveOrder, "id">),
          } as LiveOrder)
      );
      mapped.sort((a, b) => {
        const aSec = a.updatedAt?.seconds || 0;
        const bSec = b.updatedAt?.seconds || 0;
        return bSec - aSec;
      });
      onChange(mapped);
    },
    (error) => {
      if (onError) {
        onError(error as Error);
      } else {
        console.error("Failed to subscribe live orders", error);
      }
    }
  );
}

export async function upsertLiveOrder(input: UpsertLiveOrderInput) {
  const normalizedItems = input.items
    .filter((item) => item.menuId && item.quantity > 0)
    .map((item) => ({
      menuId: item.menuId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      note: item.note?.trim() || "",
      category: item.category || "",
    }));

  if (normalizedItems.length === 0) {
    await clearLiveOrder(input.storeId, input.orderKey);
    return;
  }

  const docRef = doc(
    db,
    LIVE_ORDER_COLLECTION,
    toDocId(input.storeId, input.orderKey)
  );

  await setDoc(
    docRef,
    {
      storeId: input.storeId,
      orderKey: input.orderKey.trim(),
      tableNumber: input.tableNumber.trim(),
      status: "open",
      items: normalizedItems,
      updatedAt: serverTimestamp(),
      updatedById: input.updatedById || "",
      updatedByName: input.updatedByName || "",
      updatedByRole: input.updatedByRole || "",
    },
    { merge: true }
  );
}

export async function clearLiveOrder(storeId: string, orderKey: string) {
  const docRef = doc(db, LIVE_ORDER_COLLECTION, toDocId(storeId, orderKey));
  await deleteDoc(docRef);
}
