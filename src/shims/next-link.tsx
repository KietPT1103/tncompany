import * as React from "react";
import { Link as RouterLink } from "react-router-dom";
import { normalizeAdminHref } from "@/router/pathUtils";

type LinkProps = Omit<React.ComponentPropsWithoutRef<typeof RouterLink>, "to"> & {
  href: string;
};

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, ...props }, ref) => (
    <RouterLink
      ref={ref}
      to={normalizeAdminHref(href)}
      {...props}
    />
  )
);

Link.displayName = "NextLinkShim";

export default Link;
