import { DigestDuration, DispatchStatus, RiskLevel, SourceType } from "@prisma/client";
import { format } from "date-fns";

export function formatDateLabel(value: Date | string) {
  return format(new Date(value), "MMM d");
}

export function formatLongDate(value: Date | string) {
  return format(new Date(value), "yyyy-MM-dd");
}

export function parseTags(tags: string) {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function durationFromTab(tab: string) {
  return tab === "8" ? DigestDuration.EIGHT : DigestDuration.THREE;
}

export function durationLabel(duration: DigestDuration | "3" | "8") {
  if (duration === DigestDuration.EIGHT || duration === "8") {
    return "8 分钟版";
  }
  return "3 分钟版";
}

export function statusTone(status: DispatchStatus | RiskLevel | SourceType) {
  switch (status) {
    case DispatchStatus.SENT:
    case RiskLevel.LOW:
    case SourceType.RSS:
      return "good";
    case DispatchStatus.PENDING:
      return "warm";
    case DispatchStatus.FAILED:
    case RiskLevel.HIGH:
      return "danger";
    default:
      return "neutral";
  }
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
