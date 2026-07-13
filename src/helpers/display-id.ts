/**
 * Typed display IDs are the interchange currency of the tool surface:
 * agents pass "AC-12" / "IN-4" exactly as humans write them. Prefixes must
 * match the platform's display-id conventions.
 */

export type EntityType =
  | "signal"
  | "insight"
  | "action"
  | "goal"
  | "one_pager"
  | "document"
  | "research_question"
  | "cluster";

const PREFIX_TO_TYPE: Record<string, EntityType> = {
  SI: "signal",
  IN: "insight",
  AC: "action",
  GL: "goal",
  OP: "one_pager",
  DC: "document",
  RQ: "research_question",
  CL: "cluster",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DISPLAY_PATTERN = /^([A-Za-z]{2})-(\d+)$/;

export type EntityRef =
  | { kind: "uuid"; id: string }
  | {
      kind: "display";
      type: EntityType;
      displayId: number;
      formatted: string;
    };

export class InvalidEntityIdError extends Error {
  constructor(input: string) {
    super(
      `"${input}" is not a valid entity ID. Pass a UUID or a display ID such as ` +
        `SI-1 (signal), IN-1 (insight), AC-1 (action), GL-1 (goal), OP-1 (decision brief), ` +
        `DC-1 (document), RQ-1 (research question) or CL-1 (cluster).`,
    );
    this.name = "InvalidEntityIdError";
  }
}

export function parseEntityRef(input: string): EntityRef {
  const trimmed = input.trim();

  if (UUID_PATTERN.test(trimmed)) {
    return { kind: "uuid", id: trimmed.toLowerCase() };
  }

  const match = DISPLAY_PATTERN.exec(trimmed);
  if (match) {
    const prefix = match[1].toUpperCase();
    const type = PREFIX_TO_TYPE[prefix];
    if (!type) {
      throw new InvalidEntityIdError(trimmed);
    }
    return {
      kind: "display",
      type,
      displayId: Number.parseInt(match[2], 10),
      formatted: `${prefix}-${match[2]}`,
    };
  }

  throw new InvalidEntityIdError(trimmed);
}

export function formatDisplayId(type: EntityType, displayId: number): string {
  const prefix = Object.entries(PREFIX_TO_TYPE).find(
    ([, t]) => t === type,
  )?.[0];
  return `${prefix}-${displayId}`;
}
