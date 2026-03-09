export type UserRole = "admin" | "user" | "server";

export type AppUser = {
  id: string;
  uid: string;
  email: string;
  username?: string | null;
  displayName?: string | null;
  role: UserRole;
  storeId?: string | null;
};
