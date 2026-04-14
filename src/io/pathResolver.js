// Image path resolution utilities
// Extracted from apfusion_viewer.html (Phase 1)

export function normalizeImageRelPath(imgRelPath) {
  let p = String(imgRelPath || "").trim();
  if (!p) return "";

  // Remove leading workspace absolute prefix if present.
  p = p.replace(/^\/?home\/wenhao\/(train|trains)\//, "");

  // Remap historical review_datas roots to current workspace layout.
  const remap = [
    ["review_datas/1982Single/", "datasets/active/1982Single/"],
    ["review_datas/1982LimbSingle/", "datasets/active/1982LimbSingle/"],
    ["review_datas/1475Single/", "datasets/legacy/1475Single/"],
    ["review_datas/APFusion31Single/", "datasets/legacy/APFusion31Single/"],
  ];
  remap.forEach(([oldPrefix, newPrefix]) => {
    if (p.startsWith(oldPrefix)) p = newPrefix + p.slice(oldPrefix.length);
  });

  // Keep fetch paths relative to workspace root while serving /web/apfusion/*.html.
  if (p.startsWith("./")) p = p.slice(2);
  if (p.startsWith("../")) return p;
  return "../../" + p;
}


export function resolveImageSrc(imgRelPath) {
  return normalizeImageRelPath(imgRelPath);
}

