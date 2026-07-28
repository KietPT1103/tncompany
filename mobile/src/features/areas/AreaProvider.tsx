import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadSelectedArea, saveSelectedArea } from "@/storage/selection";
import type { Area } from "@/types";

type Value = { area: Area | null; selectArea(area: Area): Promise<void> };
const Context = createContext<Value | null>(null);
export function AreaProvider({ children }: { children: React.ReactNode }) {
  const [area, setArea] = useState<Area | null>(null);
  useEffect(() => { loadSelectedArea().then(setArea); }, []);
  const value = useMemo(() => ({
    area, async selectArea(next: Area) { setArea(next); await saveSelectedArea(next); }
  }), [area]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useArea() {
  const value = useContext(Context);
  if (!value) throw new Error("useArea must be inside AreaProvider");
  return value;
}
