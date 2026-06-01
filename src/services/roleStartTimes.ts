import { apiRequest } from "@/lib/api";

export type RoleStartTimeSetting = {
  role: string;
  shift1Start: string;
  shift2Start: string;
  shift3Start: string;
  weekendEnabled?: boolean;
  weekendShift1Start?: string;
  weekendShift2Start?: string;
  weekendShift3Start?: string;
};

type RoleStartTimeResponse = {
  items: RoleStartTimeSetting[];
};

export async function getRoleStartTimes(storeId: string) {
  const response = await apiRequest<RoleStartTimeResponse>(
    `/role-start-times.php?storeId=${encodeURIComponent(storeId)}`,
    {
      method: "GET",
    },
  );

  return response.items || [];
}

export async function saveRoleStartTimes(
  storeId: string,
  items: RoleStartTimeSetting[],
) {
  const response = await apiRequest<RoleStartTimeResponse>(
    "/role-start-times.php",
    {
      method: "PUT",
      body: JSON.stringify({
        storeId,
        items,
      }),
    },
  );

  return response.items || [];
}
