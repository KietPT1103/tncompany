import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadSelectedArea, saveSelectedArea } from "@/storage/selection";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Area } from "@/types";

type Value = { area: Area | null; selectArea(area: Area): Promise<void> };
const Context = createContext<Value | null>(null);
export function AreaProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [selection, setSelection] = useState<{ userId: string; area: Area | null } | null>(null);
  const area = selection?.userId === userId ? selection.area : null;
  useEffect(() => {
    let active = true;
    if (!userId) return () => { active = false; };
    loadSelectedArea(userId).then((saved) => { if (active) setSelection({ userId, area: saved }); });
    return () => { active = false; };
  }, [userId]);
  const value = useMemo(() => ({
    area, async selectArea(next: Area) {
      if (!userId) throw new Error("Phiên đăng nhập không hợp lệ.");
      setSelection({ userId, area: next });
      await saveSelectedArea(userId, next);
    }
  }), [area, userId]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useArea() {
  const value = useContext(Context);
  if (!value) throw new Error("useArea must be inside AreaProvider");
  return value;
}
