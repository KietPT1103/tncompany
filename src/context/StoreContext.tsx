"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { canSwitchStore, getSelectableStoreIds } from "@/lib/permissions";
import { getStores, type StoreRecord } from "@/services/stores.api";

export type StoreType = string;

interface StoreContextType {
  storeId: StoreType;
  setStoreId: (id: StoreType) => void;
  storeName: string;
  stores: StoreRecord[];
  activeStores: StoreRecord[];
  storesLoading: boolean;
  storesError: string;
  refreshStores: () => Promise<void>;
}

const STORAGE_KEY = "selected_store_id";

const getInitialStoreId = (): StoreType => {
  if (typeof window === "undefined") return "cafe";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved;
  return "cafe";
};

const StoreContext = createContext<StoreContextType>({
  storeId: "cafe",
  setStoreId: () => {},
  storeName: "Mô hình Cafe",
  stores: [], activeStores: [], storesLoading: true, storesError: "", refreshStores: async () => {},
});

export const STORE_NAMES: Record<StoreType, string> = {
  cafe: "Mô hình Cafe",
  restaurant: "Mô hình Bếp",
  bakery: "Mô hình Tiệm bánh",
  farm: "Mô hình Farm",
  warehouse: "Kho thợ",
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [storeId, setStoreIdState] = useState<StoreType>(getInitialStoreId);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState("");
  const requestVersion = useRef(0);
  const refreshStores = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!user) { setStores([]); setStoresLoading(false); return; }
    try {
      const next = await getStores(false, true);
      if (version !== requestVersion.current) return;
      setStores(next);
      setStoresError("");
    } catch (error) {
      if (version !== requestVersion.current) return;
      setStoresError(error instanceof Error ? error.message : "Không tải được danh sách quầy.");
    } finally { if (version === requestVersion.current) setStoresLoading(false); }
  }, [user]);
  useEffect(() => {
    if (!authLoading) { setStores([]); setStoresLoading(true); void refreshStores(); }
    return () => { requestVersion.current++; };
  }, [authLoading, refreshStores]);
  useEffect(() => {
    if (!user) return;
    const refresh = () => { void refreshStores(); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [user, refreshStores]);
  const activeStores = useMemo(() => stores.filter(item => item.isActive && !item.deletedAt), [stores]);

  const setStoreId = useCallback((id: StoreType) => {
    setStoreIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  useEffect(() => {
    if (!user || storesLoading) return;
    const ids = getSelectableStoreIds(user);
    const options = stores.filter(item => ids === null || ids.includes(item.id));
    const next = canSwitchStore(user)
      ? options.find(item => item.id === storeId)?.id || options.find(item => item.isActive && !item.deletedAt)?.id
      : user.storeId;
    if (next && next !== storeId) setStoreId(next);
  }, [user, stores, storesLoading, storeId, setStoreId]);

  const storeName = stores.find(item => item.id === storeId)?.name || STORE_NAMES[storeId] || "Quầy không khả dụng";

  return (
    <StoreContext.Provider value={{ storeId, setStoreId, storeName, stores, activeStores, storesLoading: authLoading || storesLoading, storesError, refreshStores }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
