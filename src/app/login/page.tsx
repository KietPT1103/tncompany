"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  CakeSlice,
  Coffee,
  EllipsisVertical,
  Tractor,
  UtensilsCrossed,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useStore, StoreType } from "@/context/StoreContext";
import { loginApi, seedDefaultUsersApi, setApiToken } from "@/lib/api";

const CASHIER_ACCOUNTS = ["thungan1", "thungan2", "thungan3"] as const;
const SERVICE_ACCOUNTS = ["phucvu1"] as const;
const ADMIN_ACCOUNTS = ["admin"] as const;
const ADMIN_DEFAULT_PASSWORD = "admin123";

type CashierAccount = (typeof CASHIER_ACCOUNTS)[number];
type ServiceAccount = (typeof SERVICE_ACCOUNTS)[number];
type AdminAccount = (typeof ADMIN_ACCOUNTS)[number];

const isCashierAccount = (value: string): value is CashierAccount =>
  CASHIER_ACCOUNTS.includes(value as CashierAccount);
const isServiceAccount = (value: string): value is ServiceAccount =>
  SERVICE_ACCOUNTS.includes(value as ServiceAccount);
const isAdminAccount = (value: string): value is AdminAccount =>
  ADMIN_ACCOUNTS.includes(value as AdminAccount);

const cashierToEmail = (cashier: string) => `${cashier}@cashier.local`;
const serviceToEmail = (account: string) => `${account}@service.local`;
const adminToEmail = (account: string) => `${account}@admin.local`;

export default function LoginPage() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isSeedingAccounts, setIsSeedingAccounts] = useState(false);
  const [seedResultMessage, setSeedResultMessage] = useState("");
  const [seedError, setSeedError] = useState("");
  const quickActionRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { setStoreId } = useStore();
  const [selectedStore, setSelectedStore] = useState<StoreType>("cafe");

  const stores: { id: StoreType; label: string; icon: React.ReactNode }[] = [
    {
      id: "cafe",
      label: "Nước",
      icon: <Coffee className="h-6 w-6 text-amber-700" />,
    },
    {
      id: "restaurant",
      label: "Bếp",
      icon: <UtensilsCrossed className="h-6 w-6 text-red-600" />,
    },
    {
      id: "bakery",
      label: "Bánh",
      icon: <CakeSlice className="h-6 w-6 text-pink-600" />,
    },
    {
      id: "farm",
      label: "Farm",
      icon: <Tractor className="h-6 w-6 text-green-700" />,
    },
  ];

  useEffect(() => {
    const normalizedAccount = account.trim().toLowerCase();
    if (isServiceAccount(normalizedAccount) && selectedStore !== "restaurant") {
      setSelectedStore("restaurant");
    }
  }, [account, selectedStore]);

  useEffect(() => {
    if (!showQuickActions) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!quickActionRef.current) return;
      const target = event.target;
      if (target instanceof Node && !quickActionRef.current.contains(target)) {
        setShowQuickActions(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showQuickActions]);

  const handleSeedDefaultAccounts = async () => {
    setSeedError("");
    setSeedResultMessage("");
    setShowQuickActions(false);
    setIsSeedingAccounts(true);

    try {
      const result = await seedDefaultUsersApi();
      setSeedResultMessage(
        `Đã xử lý ${result.total} tài khoản mặc định: tạo mới ${result.createdCount}, cập nhật ${result.updatedCount}.`
      );
    } catch (seedErr: unknown) {
      console.error(seedErr);
      setSeedError("Không thể thêm tài khoản mặc định. Hãy kiểm tra API và MySQL.");
    } finally {
      setIsSeedingAccounts(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const rawAccount = account.trim();
    const rawPassword = password.trim();
    const normalizedAccount = rawAccount.toLowerCase();
    const cashierLogin = isCashierAccount(normalizedAccount);
    const serviceLogin = isServiceAccount(normalizedAccount);
    const adminLogin = isAdminAccount(normalizedAccount);
    const isUsernameStaffLogin = cashierLogin || serviceLogin || adminLogin;

    const isValidPassword =
      (cashierLogin || serviceLogin) && rawPassword.toLowerCase() === normalizedAccount;
    const isValidAdminPassword = adminLogin && rawPassword === ADMIN_DEFAULT_PASSWORD;

    if (isUsernameStaffLogin && !isValidPassword && !isValidAdminPassword) {
      setError("Mật khẩu hoặc tên đăng nhập sai.");
      setLoading(false);
      return;
    }

    const loginEmail = cashierLogin
      ? cashierToEmail(normalizedAccount)
      : serviceLogin
      ? serviceToEmail(normalizedAccount)
      : adminLogin
      ? adminToEmail(normalizedAccount)
      : rawAccount;

    try {
      const { token } = await loginApi(loginEmail, rawPassword);
      setApiToken(token);
      await refreshUser();
      setStoreId(serviceLogin ? "restaurant" : selectedStore);
      router.push("/");
    } catch (err: unknown) {
      console.error(err);
      setError("Đăng nhập thất bại. Vui lòng kiểm tra tài khoản và mật khẩu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-slate-950">
      <div ref={quickActionRef} className="absolute left-4 top-4 z-20">
        <button
          type="button"
          onClick={() => setShowQuickActions((prev) => !prev)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label="Tùy chọn tài khoản"
          disabled={isSeedingAccounts}
        >
          <EllipsisVertical className="h-5 w-5" />
        </button>
        {showQuickActions && (
          <div className="mt-2 w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={handleSeedDefaultAccounts}
              disabled={isSeedingAccounts}
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {isSeedingAccounts ? "Đang thêm tài khoản..." : "Thêm tài khoản mặc định"}
            </button>
            <p className="px-3 pb-1 pt-2 text-xs text-gray-500 dark:text-slate-400">
              Bao gồm: thungan1, thungan2, thungan3, phucvu1, admin
            </p>
          </div>
        )}
      </div>
      <Card className="w-full max-w-md bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-bold dark:text-slate-100">
            Đăng nhập hệ thống
          </CardTitle>
          <p className="text-center text-sm text-gray-500 dark:text-slate-400">
            Chọn mô hình làm việc và đăng nhập
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="mb-6 grid grid-cols-4 gap-2">
              {stores.map((store) => (
                <div
                  key={store.id}
                  onClick={() => setSelectedStore(store.id)}
                  className={`cursor-pointer rounded-lg border p-3 text-center transition-all hover:bg-gray-50 dark:hover:bg-slate-800 ${
                    selectedStore === store.id
                      ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600 dark:bg-blue-900/30"
                      : "border-gray-200 dark:border-slate-700"
                  }`}
                >
                  <div className="mb-2 flex justify-center">{store.icon}</div>
                  <div className="text-xs font-medium text-gray-900 dark:text-slate-100">
                    {store.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="account"
                className="text-sm font-medium text-gray-700 dark:text-slate-300"
              >
                Tài khoản / Email
              </label>
              <input
                id="account"
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                placeholder="Ví dụ: Thungan1, Phucvu1 hoặc email admin"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-gray-700 dark:text-slate-300"
              >
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-500">{error}</div>
            )}
            {seedError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-500">
                {seedError}
              </div>
            )}
            {seedResultMessage && (
              <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                {seedResultMessage}
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={loading}>
              Đăng nhập vào {stores.find((s) => s.id === selectedStore)?.label}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
