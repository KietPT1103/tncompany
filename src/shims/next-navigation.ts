import {
  useLocation,
  useNavigate,
  useParams as useRouteParams,
} from "react-router-dom";
import {
  denormalizeAdminPathname,
  normalizeAdminHref,
} from "@/router/pathUtils";

export function useRouter() {
  const navigate = useNavigate();

  return {
    push: (href: string) => navigate(normalizeAdminHref(href)),
    replace: (href: string) =>
      navigate(normalizeAdminHref(href), { replace: true }),
    back: () => navigate(-1),
  };
}

export function usePathname() {
  const location = useLocation();
  return denormalizeAdminPathname(location.pathname);
}

export function useParams() {
  return useRouteParams();
}
