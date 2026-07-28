import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { WheelEvent } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function preventNumberInputScroll(
  event: WheelEvent<HTMLInputElement>,
) {
  event.currentTarget.blur();
}