import { type ClassValue, clsx } from "clsx";
import type React from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function preventNumberInputScroll(
  event: React.WheelEvent<HTMLInputElement>
) {
  event.currentTarget.blur();
}
