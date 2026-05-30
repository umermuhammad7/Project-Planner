import { TextUpdate } from "../types";

export function formatThreadDirection(direction: TextUpdate["direction"]): string {
  return direction === "outbound" ? "Sent from HomeThread" : "From a family text";
}

export function formatThreadConversion(convertedTo: TextUpdate["convertedTo"]): string | null {
  if (!convertedTo) {
    return null;
  }

  if (convertedTo === "event") {
    return "Saved to Plan";
  }

  if (convertedTo === "chore") {
    return "Saved to Chores";
  }

  if (convertedTo === "list") {
    return "Saved to Lists";
  }

  if (convertedTo === "meal") {
    return "Saved to Meals";
  }

  return `Saved as ${convertedTo}`;
}
