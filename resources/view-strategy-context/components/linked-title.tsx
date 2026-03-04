import type React from "react";
import { ExternalLink } from "../../shared/external-link";
import { entityUrl } from "../constants";

export const LinkedTitle: React.FC<{
  title: string;
  type: string;
  id: string;
  appBaseUrl?: string;
}> = ({ title, type, id, appBaseUrl }) => {
  const url = entityUrl(type, id, appBaseUrl);
  if (!url) return <>{title}</>;
  return (
    <ExternalLink
      href={url}
      className="text-inherit no-underline hover:underline"
    >
      {title}
    </ExternalLink>
  );
};
