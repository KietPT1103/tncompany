"use client";

import { createContext, useContext, useState } from "react";

export type StoreType = "cafe" | "restaurant" | "farm" | "bakery";

interface StoreContextType {
  storeId: StoreType;
  setStoreId: (id: StoreType) => void;
  storeName: string;
}

const STORAGE_KEY = "selected_store_id";

const isStoreType = (value: string): value is StoreType =>
  value === "cafe" ||
  value === "restaurant" ||
  value === "farm" ||
  value === "bakery";

const getInitialStoreId = (): StoreType => {
  if (typeof window === "undefined") return "cafe";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && isStoreType(saved)) return saved;
  return "cafe";
};

const StoreContext = createContext<StoreContextType>({
  storeId: "cafe",
  setStoreId: () => {},
  storeName: "Mô hình Cafe",
});

export const STORE_NAMES: Record<StoreType, string> = {
  cafe: "Mô hình Cafe",
  restaurant: "Mô hình Bếp",
  bakery: "Mô hình Tiệm bánh",
  farm: "Mô hình Farm",
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [storeId, setStoreIdState] = useState<StoreType>(getInitialStoreId);

  const setStoreId = (id: StoreType) => {
    setStoreIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const storeName = STORE_NAMES[storeId] || "Cửa hàng";

  return (
    <StoreContext.Provider value={{ storeId, setStoreId, storeName }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
