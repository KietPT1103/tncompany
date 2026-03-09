import { db } from "@/lib/firebase";
import {
  addDoc,
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

export type SurchargeType = "percent" | "fixed";

export type PosSurcharge = {
  id: string;
  storeId: string;
  name: string;
  type: SurchargeType;
  value: number;
  isEnabled: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type SurchargeDoc = {
  storeId?: string;
  name?: string;
  type?: SurchargeType;
  value?: number;
  isEnabled?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const SURCHARGE_COLLECTION = "pos_surcharges";

export function subscribeSurcharges(
  storeId: string,
  onChange: (surcharges: PosSurcharge[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, SURCHARGE_COLLECTION),
    where("storeId", "==", storeId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const mapped = snapshot.docs.map((item) => {
        const data = item.data() as SurchargeDoc;
        return {
          id: item.id,
          storeId: data.storeId || storeId,
          name: (data.name || "").trim() || "Phụ thu",
          type: data.type === "fixed" ? "fixed" : "percent",
          value: Number.isFinite(data.value) ? Number(data.value) : 0,
          isEnabled: data.isEnabled !== false,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        } as PosSurcharge;
      });

      mapped.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        if (aTime !== bTime) return aTime - bTime;
        return a.name.localeCompare(b.name, "vi", {
          sensitivity: "base",
          numeric: true,
        });
      });

      onChange(mapped);
    },
    (error) => {
      if (onError) {
        onError(error as Error);
      } else {
        console.error("Failed to subscribe surcharges", error);
      }
    }
  );
}

export async function createSurcharge(input: {
  storeId: string;
  name: string;
  type: SurchargeType;
  value: number;
  isEnabled?: boolean;
}) {
  const docRef = await addDoc(collection(db, SURCHARGE_COLLECTION), {
    storeId: input.storeId,
    name: input.name.trim(),
    type: input.type,
    value: input.value,
    isEnabled: input.isEnabled !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateSurcharge(
  surchargeId: string,
  data: {
    name?: string;
    type?: SurchargeType;
    value?: number;
    isEnabled?: boolean;
  }
) {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (data.name !== undefined) {
    payload.name = data.name.trim();
  }
  if (data.type !== undefined) {
    payload.type = data.type;
  }
  if (data.value !== undefined) {
    payload.value = data.value;
  }
  if (data.isEnabled !== undefined) {
    payload.isEnabled = data.isEnabled;
  }

  await setDoc(doc(db, SURCHARGE_COLLECTION, surchargeId), payload, {
    merge: true,
  });
}

export async function deleteSurcharge(surchargeId: string) {
  await deleteDoc(doc(db, SURCHARGE_COLLECTION, surchargeId));
}
