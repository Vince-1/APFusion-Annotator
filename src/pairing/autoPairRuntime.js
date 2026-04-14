export async function loadImageForAutoPair(imgRelPath, deps = {}) {
  const { resolveImageSrc, ImageCtor = Image } = deps;
  if (!imgRelPath) return null;
  const img = new ImageCtor();
  img.src = resolveImageSrc(imgRelPath);
  await img.decode().catch(() => null);
  return img.width ? img : null;
}

export function buildPatchStatsList(img, boxes, deps = {}) {
  const { documentRef = document } = deps;
  const list = boxes || [];
  if (!img || !list.length) return list.map(() => null);
  try {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const canvas = documentRef.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    return list.map((box) => {
      const x1 = Math.max(0, Math.floor(((box.cx || 0) - (box.w || 0) / 2) * width));
      const y1 = Math.max(0, Math.floor(((box.cy || 0) - (box.h || 0) / 2) * height));
      const x2 = Math.min(width, Math.ceil(((box.cx || 0) + (box.w || 0) / 2) * width));
      const y2 = Math.min(height, Math.ceil(((box.cy || 0) + (box.h || 0) / 2) * height));
      const patchW = Math.max(1, x2 - x1);
      const patchH = Math.max(1, y2 - y1);
      const data = ctx.getImageData(x1, y1, patchW, patchH).data;

      let sum = 0;
      let sumSq = 0;
      let maxV = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += v;
        sumSq += v * v;
        maxV = Math.max(maxV, v);
        n += 1;
      }
      const mean = n ? sum / n : 0;
      const variance = n ? Math.max(0, sumSq / n - mean * mean) : 0;
      return { mean, std: Math.sqrt(variance), max: maxV };
    });
  } catch {
    return list.map(() => null);
  }
}

export function computePatchSimilarity(a, b, deps = {}) {
  const { clamp01 } = deps;
  if (!a || !b) return 0.5;
  const meanSim = clamp01(1 - Math.abs(a.mean - b.mean) / 255);
  const stdSim = clamp01(1 - Math.abs(a.std - b.std) / 128);
  const maxSim = clamp01(1 - Math.abs(a.max - b.max) / 255);
  return clamp01(0.4 * meanSim + 0.3 * stdSim + 0.3 * maxSim);
}

export function getAutoPairConfigFromUi(documentRef, baseConfig) {
  const readNum = (id, fallback) => {
    const el = documentRef.getElementById(id);
    return el && el.value !== "" ? Number(el.value) : fallback;
  };

  const enableRecallFirstPreprocess = !!documentRef.getElementById("enableRecallFirstPreprocess")?.checked;
  const prMinConf = readNum("prMinConf", baseConfig.prMinConf);
  const prExpandRatio = readNum("prExpandRatio", baseConfig.prExpandRatio);
  const threshold = readNum("autoPairThreshold", baseConfig.threshold);
  const crossViewThreshold = readNum("crossViewThreshold", baseConfig.crossViewThreshold);
  const disableCrossViewMerge = !!documentRef.getElementById("disableCrossViewMerge")?.checked;
  const disableSameViewPrMerge = !!documentRef.getElementById("disableSameViewPrMerge")?.checked;
  const allowPrOneToMany = !!documentRef.getElementById("allowPrOneToMany")?.checked;
  const rawWeights = {
    iou: readNum("autoPairWIou", baseConfig.weights.iou),
    center: readNum("autoPairWCenter", baseConfig.weights.center),
    size: readNum("autoPairWSize", baseConfig.weights.size),
    patch: readNum("autoPairWPatch", baseConfig.weights.patch),
  };

  if (Number.isNaN(prMinConf) || prMinConf < 0 || prMinConf > 1) {
    throw new Error("PR 最小置信度必须在 0 到 1 之间");
  }
  if (Number.isNaN(prExpandRatio) || prExpandRatio < 1 || prExpandRatio > 2) {
    throw new Error("PR 扩张比例必须在 1 到 2 之间");
  }
  if (Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
    throw new Error("自动配对阈值必须在 0 到 1 之间");
  }
  if (Number.isNaN(crossViewThreshold) || crossViewThreshold < 0 || crossViewThreshold > 1) {
    throw new Error("前后聚合阈值必须在 0 到 1 之间");
  }
  if (Object.values(rawWeights).some((v) => Number.isNaN(v) || v < 0)) {
    throw new Error("自动配对权重必须是非负数");
  }

  const sum = Object.values(rawWeights).reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    throw new Error("自动配对权重之和必须大于 0");
  }

  return {
    ...baseConfig,
    enableRecallFirstPreprocess,
    prMinConf,
    prExpandRatio,
    threshold,
    crossViewThreshold,
    disableCrossViewMerge,
    disableSameViewPrMerge,
    allowPrOneToMany,
    weights: {
      iou: rawWeights.iou / sum,
      center: rawWeights.center / sum,
      size: rawWeights.size / sum,
      patch: rawWeights.patch / sum,
    },
  };
}
