export function uniqueSorted(list) {
  return Array.from(new Set(list)).sort((a, b) => a - b);
}

export function parseIdxList(text) {
  if (!text || !text.trim()) return [];
  return text
    .split(",")
    .map((x) => parseInt(x.trim(), 10))
    .filter((x) => !Number.isNaN(x));
}

export function toIdxArray(val) {
  if (!val && val !== 0) return [];
  if (Array.isArray(val)) return val;
  return parseIdxList(String(val));
}

export function parseGroups(text) {
  if (!text || !text.trim()) return [];
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((g) =>
        Array.isArray(g)
          ? g.map((v) => parseInt(v, 10)).filter((v) => !Number.isNaN(v))
          : []
      )
      .filter((g) => g.length > 0);
  } catch {
    return [];
  }
}
