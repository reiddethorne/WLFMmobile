const NAMED_CHARACTER_REFERENCES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  ldquo: "\u201c",
  lsquo: "'",
  lt: "<",
  nbsp: " ",
  quot: '"',
  rdquo: "\u201d",
  rsquo: "'",
};

const CHARACTER_REFERENCE = /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi;

function decodeCharacterReference(
  match: string,
  decimal: string | undefined,
  hexadecimal: string | undefined,
  named: string | undefined,
): string {
  if (named) return NAMED_CHARACTER_REFERENCES[named.toLowerCase()] ?? match;

  const codePoint = Number.parseInt(decimal ?? hexadecimal ?? "", decimal ? 10 : 16);
  if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)) return match;

  return String.fromCodePoint(codePoint);
}

/** Convert character references from radio metadata into displayable plain text. */
export function cleanMetadataText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  // Two passes also handle values escaped once for JSON and again for HTML,
  // such as `Don&amp;#39;t`.
  let decoded = value;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = decoded.replace(CHARACTER_REFERENCE, decodeCharacterReference);
    if (next === decoded) break;
    decoded = next;
  }

  // Display every apostrophe-like metadata character as a straight apostrophe.
  const cleaned = decoded.replace(/[`´‘’ʼ＇]/gu, "'").trim().replace(/\s+/g, " ");
  return cleaned.length > 0 ? cleaned : null;
}
