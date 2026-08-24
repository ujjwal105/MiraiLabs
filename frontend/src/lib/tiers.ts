import type { CompanyTier } from "../api/types";

// Fixed categorical order — never cycled or reassigned when the data changes.
export const TIER_ORDER: CompanyTier[] = ["day1_mass_recruiter", "dream", "regular", "niche"];

export const TIER_LABEL: Record<CompanyTier, string> = {
  day1_mass_recruiter: "Day-1 mass recruiter",
  dream: "Dream company",
  regular: "Regular",
  niche: "Niche",
};

export const TIER_COLOR_VAR: Record<CompanyTier, string> = {
  day1_mass_recruiter: "var(--series-1)",
  dream: "var(--series-2)",
  regular: "var(--series-3)",
  niche: "var(--series-4)",
};
