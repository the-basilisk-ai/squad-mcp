export class InvalidCursorError extends Error {
  constructor() {
    super(
      "Invalid pagination cursor. Pass the nextCursor value from a previous response, or omit it to start from the beginning.",
    );
    this.name = "InvalidCursorError";
  }
}

export type CursorPayload = {
  sortKey: string;
  id: string;
};

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as CursorPayload).sortKey === "string" &&
      typeof (parsed as CursorPayload).id === "string"
    ) {
      return parsed as CursorPayload;
    }
  } catch {
    // fall through to the friendly error
  }
  throw new InvalidCursorError();
}
