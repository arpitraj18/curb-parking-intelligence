export const CAUSE: Record<string, { hex: string }> = {
  "Commuter overflow": { hex: "#4C9BE6" },
  "Delivery overflow": { hex: "#F0A93B" },
  "Hire / transit demand": { hex: "#9B7BE6" },
  "Safety risk": { hex: "#E5564B" },
  "Structural demand": { hex: "#3FB984" },
  "Enforcement priority": { hex: "#7C8DA6" },
};

export const TIERS = ["Chronic", "Frequent", "Occasional"] as const;

export const TIER_HEX: Record<string, string> = {
  Chronic: "#E5564B",
  Frequent: "#F0A93B",
  Occasional: "#7C8DA6",
};

export function causeHex(cause: string): string {
  return (CAUSE[cause] || CAUSE["Enforcement priority"]).hex;
}
