/**
 * Builds a map from full name → display name.
 * If two players share a first name, both get "First-L" (first name + last initial).
 * Otherwise just first name is used.
 * Deduplicates input so repeated appearances of the same player don't inflate counts.
 */
export function buildNameMap(fullNames: string[]): Map<string, string> {
  const uniqueNames = [...new Set(fullNames)];

  const firstNameCount = new Map<string, number>();
  for (const name of uniqueNames) {
    const first = name.split(" ")[0];
    firstNameCount.set(first, (firstNameCount.get(first) ?? 0) + 1);
  }

  const map = new Map<string, string>();
  for (const name of uniqueNames) {
    const parts = name.split(" ");
    const first = parts[0];
    if ((firstNameCount.get(first) ?? 0) > 1 && parts.length > 1) {
      map.set(name, `${first}-${parts[1][0]}`);
    } else {
      map.set(name, first);
    }
  }
  return map;
}

export function shortName(fullName: string, nameMap: Map<string, string>): string {
  return nameMap.get(fullName) ?? fullName.split(" ")[0];
}
