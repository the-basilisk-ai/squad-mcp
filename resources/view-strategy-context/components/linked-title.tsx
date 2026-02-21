import type React from "react";
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
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-inherit no-underline hover:underline"
    >
      {title}
    </a>
  );
};
