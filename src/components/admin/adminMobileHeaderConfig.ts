export type AdminMobileHeaderAction = {
  href: string;
  label: string;
  icon: "plus";
};

const routeActions: Readonly<Record<string, AdminMobileHeaderAction>> = {
  "/seo-articles": {
    href: "/seo-articles/new",
    label: "Tạo bài viết mới",
    icon: "plus",
  },
};

export function getAdminMobileHeaderAction(pathname: string) {
  return routeActions[pathname] ?? null;
}
