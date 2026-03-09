import * as React from "react";
import { Link as RouterLink } from "react-router-dom";
import { normalizeAdminHref } from "@/router/pathUtils";

type LinkProps = React.ComponentPropsWithoutRef<typeof RouterLink> & {
  href: string;
};

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, to, ...props }, ref) => (
    <RouterLink
      ref={ref}
      to={normalizeAdminHref(typeof href === "string" ? href : String(to || ""))}
      {...props}
    />
  )
);

Link.displayName = "NextLinkShim";

export default Link;
