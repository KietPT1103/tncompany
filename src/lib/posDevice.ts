export type PosDeviceIdentity = {
  id: string;
  name: string;
};

const DEVICE_ID_KEY = "pos:device-id";
const DEVICE_NAME_KEY = "pos:device-name";

const createDeviceId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

export function getOrCreatePosDevice(): PosDeviceIdentity {
  if (typeof window === "undefined") {
    return { id: "", name: "Thiết bị chưa xác định" };
  }

  let id = window.localStorage.getItem(DEVICE_ID_KEY)?.trim() || "";
  if (!id) {
    id = createDeviceId();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }

  let name = window.localStorage.getItem(DEVICE_NAME_KEY)?.trim() || "";
  if (!name) {
    name = `Máy POS ${id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`;
    window.localStorage.setItem(DEVICE_NAME_KEY, name);
  }

  return { id, name };
}
