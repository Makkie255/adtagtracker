export type TagFilterMode = "description" | "specific";

export type TagFilterPlatform = {
  id: string;
  name: string;
  company?: string | null;
  category?: string | null;
};

/** Maps common filter phrases to platform name/company/category hints. */
const DESCRIPTION_HINTS: Record<string, string[]> = {
  older: ["senior", "retirement", "healthcare", "medicare", "insurance", "aarp"],
  senior: ["senior", "retirement", "healthcare", "medicare", "insurance"],
  demographic: ["audience", "targeting", "segment"],
  younger: ["tiktok", "snapchat", "youth", "gen z", "instagram"],
  youth: ["tiktok", "snapchat", "youth", "gen z"],
  ecommerce: ["retail", "shopping", "criteo", "commerce", "google ads", "meta"],
  retail: ["retail", "shopping", "criteo", "commerce"],
  b2b: ["linkedin", "business", "enterprise", "salesforce", "hubspot"],
  video: ["youtube", "tiktok", "streaming", "ctv", "video"],
  social: ["facebook", "meta", "instagram", "linkedin", "twitter", "tiktok", "snapchat", "pinterest"],
  search: ["google", "bing", "microsoft ads", "sem"],
  analytics: ["analytics", "measurement", "segment", "hotjar", "clarity"],
  privacy: ["consent", "onetrust", "cookie", "cmp"],
  healthcare: ["health", "medical", "pharma", "medicare"],
  finance: ["bank", "financial", "insurance", "fintech"],
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "for",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "with",
  "ads",
  "ad",
  "tag",
  "tags",
  "targeting",
  "target",
  "that",
  "are",
  "is",
  "at",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function expandTokens(tokens: string[]): string[] {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    expanded.add(token);
    for (const [phrase, hints] of Object.entries(DESCRIPTION_HINTS)) {
      if (token.includes(phrase) || phrase.includes(token)) {
        hints.forEach((h) => expanded.add(h));
      }
    }
    if (DESCRIPTION_HINTS[token]) {
      DESCRIPTION_HINTS[token].forEach((h) => expanded.add(h));
    }
  }
  return Array.from(expanded);
}

function scorePlatform(platform: TagFilterPlatform, needles: string[]): number {
  const haystack = [platform.name, platform.company, platform.category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const needle of needles) {
    if (haystack.includes(needle)) score += needle.length >= 4 ? 2 : 1;
  }
  return score;
}

/** Returns platforms whose metadata matches a natural-language filter description. */
export function matchPlatformsByDescription(
  description: string,
  platforms: TagFilterPlatform[],
): TagFilterPlatform[] {
  const trimmed = description.trim();
  if (!trimmed) return [];

  const tokens = expandTokens(tokenize(trimmed));
  if (tokens.length === 0) return [];

  return platforms
    .map((platform) => ({ platform, score: scorePlatform(platform, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ platform }) => platform);
}

export function getTagFilterPlatformIds(
  mode: TagFilterMode | null | undefined,
  description: string | null | undefined,
  platformIds: string[] | null | undefined,
  platforms: TagFilterPlatform[],
): Set<string> | null {
  if (mode === "specific" && platformIds && platformIds.length > 0) {
    return new Set(platformIds);
  }
  if (mode === "description" && description?.trim()) {
    const matched = matchPlatformsByDescription(description, platforms);
    if (matched.length === 0) return new Set();
    return new Set(matched.map((p) => p.id));
  }
  return null;
}
