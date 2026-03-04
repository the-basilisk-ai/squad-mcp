import { useWidget } from "mcp-use/react";
import type React from "react";
import { useCallback } from "react";

/**
 * An anchor tag that delegates to the host app's openExternal when available,
 * working around sandboxed iframe restrictions that block target="_blank" clicks.
 */
export const ExternalLink: React.FC<
  React.AnchorHTMLAttributes<HTMLAnchorElement>
> = ({ onClick, href, children, ...rest }) => {
  const { openExternal } = useWidget();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (href && openExternal) {
        e.preventDefault();
        openExternal(href).catch(err => {
          console.error("[ExternalLink] openExternal failed:", err);
          window.open(href, "_blank", "noopener,noreferrer");
        });
      }
      onClick?.(e);
    },
    [href, openExternal, onClick],
  );

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
};
