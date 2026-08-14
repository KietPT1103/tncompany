import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { WheelEvent } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .trim()
    .toLowerCase();
}

export function preventNumberInputScroll(
  event: WheelEvent<HTMLInputElement>,
) {
  event.currentTarget.blur();
}
