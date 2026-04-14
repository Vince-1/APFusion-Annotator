# APFusion 自动配对实现方案

## 目标

为当前病人的 `GT`（标注框）和 `PR`（预测框）执行一键自动分类，生成：

- `TP`: 一对一自动匹配成功的 `GT-PR`
- `FN`: 未匹配到任何预测框的 `GT`
- `FP`: 未匹配到任何标注框的 `PR`

该方案首先支持在前端 `apfusion_viewer.html` 中直接运行，并保留人工修正能力。

---

## 输入与输出

### 输入

来自当前病人的数据结构：

- `p.gt.front`, `p.gt.back`
- `p.pred.front`, `p.pred.back`
- `p.images.front`, `p.images.back`

每个框至少包含：

```js
{ cx, cy, w, h, conf }
```

其中坐标是归一化坐标。

### 输出

写入当前病人的：

```json
{
  "TP": [{"GT":[gt_idx], "PR":[pr_idx]}],
  "FN": [{"GT":[gt_idx], "PR":[]}],
  "FP": [{"GT":[], "PR":[pr_idx]}]
}
```

---

## 总体流程

### 阶段 A：候选对打分

对每个 `GT_i` 和 `PR_j` 计算综合分数：

\[
Score = 0.40 \cdot IoU + 0.20 \cdot Center + 0.15 \cdot Size + 0.25 \cdot Patch
\]

各项定义：

- `IoU`: 框交并比
- `Center`: 中心点接近程度
- `Size`: 框面积相似度
- `Patch`: 图像局部灰度统计相似度

### 阶段 B：一对一匹配

1. 仅保留 `score >= threshold` 的候选对
2. 按 `score` 从高到低排序
3. 做贪心一对一匹配：
   - 若 `GT_i` 和 `PR_j` 都未占用，则加入 `TP`
4. 剩余：
   - 未匹配的 GT -> `FN`
   - 未匹配的 PR -> `FP`

---

## 特征计算

### 1. IoU

标准矩形交并比：

\[
IoU = \frac{Area(Intersection)}{Area(Union)}
\]

### 2. 中心距离相似度

对归一化中心点距离做归一化：

\[
Center = 1 - \frac{distance((cx_1, cy_1), (cx_2, cy_2))}{\sqrt{2}}
\]

### 3. 尺寸相似度

用面积比的对数衡量：

\[
Size = e^{- |\log(area_1 / area_2)|}
\]

### 4. 图像 patch 相似度

从对应图像中裁剪两个框的局部 patch，提取：

- 灰度均值 `mean`
- 灰度标准差 `std`
- 灰度最大值 `max`

再计算：

```text
Patch = 0.4 * meanSim + 0.3 * stdSim + 0.3 * maxSim
```

这是轻量的图像证据版本，适合先在浏览器前端直接实现。

---

## 伪代码

```js
function autoPairCurrentPatient() {
  frontResult = autoMatchSide(frontGT, frontPR, frontImage, offsets)
  backResult  = autoMatchSide(backGT, backPR, backImage, offsets)

  pairRecords[selectedPid] = {
    TP: [...frontResult.TP, ...backResult.TP],
    FN: [...frontResult.FN, ...backResult.FN],
    FP: [...frontResult.FP, ...backResult.FP]
  }
}

function autoMatchSide(gtBoxes, prBoxes, img, gtOffset, prOffset) {
  candidates = []
  for gt in gtBoxes:
    for pr in prBoxes:
      score = weightedScore(gt, pr, img)
      if score >= threshold:
        candidates.push({gt, pr, score})

  candidates.sort(desc by score)

  usedGt = set()
  usedPr = set()

  TP = []
  for candidate in candidates:
    if candidate.gt not used and candidate.pr not used:
      TP.push({GT:[gtOffset + gtIdx], PR:[prOffset + prIdx]})
      usedGt.add(gtIdx)
      usedPr.add(prIdx)

  FN = all unmatched GT
  FP = all unmatched PR

  return {TP, FN, FP}
}
```

---

## 前端集成点

建议在 `process/apfusion_viewer.html` 中新增：

- `Auto Pair Current` 按钮
- `Threshold` 输入框（默认 `0.45`）

核心函数：

- `autoPairCurrentPatient()`
- `autoMatchSide()`
- `computeBoxIoU()`
- `computeCenterSimilarity()`
- `computeSizeSimilarity()`
- `buildPatchStatsList()`
- `computePatchSimilarity()`

---

## 推荐默认参数

```js
const AUTO_PAIR_CONFIG = {
  threshold: 0.45,
  weights: {
    iou: 0.40,
    center: 0.20,
    size: 0.15,
    patch: 0.25
  },
  minIoU: 0.05,
  centerGate: 0.82
};
```

---

## 使用建议

1. 点击 `Auto Pair Current`
2. 自动生成当前病人的 `TP/FN/FP`
3. 用户再用现有手工工具微调
4. 最后保存

这样可以保证：

- 自动模式提升效率
- 人工校正保持可控
- 不会破坏现有 `stats.json` / `pairRecords` 结构

---

## 已追加的第二阶段能力

当前前端实现进一步支持：

- `Auto Pair Current`: 仅处理当前病人
- `Auto Pair All Patients`: 批量处理当前已加载病人

---

## 已追加的第三阶段能力：原因说明

为便于人工复核，当前自动配对预览面板会额外输出 `FN / FP` 的未匹配原因说明，典型包括：

- **无候选框**：当前侧别没有可对比的 `PR` 或 `GT`
- **空间门限未通过**：最佳候选的 `IoU` 与 `center` 都未达到最小门限
- **综合分数低于阈值**：虽然位置接近，但 `score < threshold`
- **一对一竞争失败**：最佳候选已被更高分的另一框占用

这样在界面中可以直接看到：

- 哪个 `GT` 被判成 `FN`
- 哪个 `PR` 被判成 `FP`
- 失败的主要原因是 `gate / threshold / competition` 中的哪一种

---

## 已追加的第四阶段能力：前后位同灶聚合

考虑到前位与后位图像来自**同一时刻扫描**，并且在镜像后理论上可以近似完全配准，当前自动配对在配对前增加了**前后位同灶聚合**步骤：

1. 先将后位框做镜像变换到前位坐标系
2. 对 `front` 与 `back` 的框按 `IoU + center + size` 做一对一合并
3. 若判定是同一个浓聚灶，则聚合成一个病灶组，例如：
   - `GT:[1] + GT:[8]` → `GT:[1,8]`
   - `PR:[2] + PR:[9]` → `PR:[2,9]`
4. 后续 TP/FN/FP 不再按单张视图计数，而是按**聚合后的病灶级别**计数

这样可以避免同一个病灶在前后位被重复统计成两个目标，更符合当前数据的成像条件与人工判读逻辑。

另外，当前实现还会对**同一视图内的 PR 多框**做一次同灶聚合：

- 若多个预测框在同一前位或同一后位上高度重叠、中心非常接近，并且尺寸相似
- 则会先被视为同一个浓聚灶并合并为一个 `PR` 组
- 之后再参与病灶级的 TP/FN/FP 自动配对

这样可以减少同一个病灶被多个预测框重复计数为多个 `FP/TP` 的情况。

---

## 已追加的第五阶段能力：方案A预处理（提升召回优先）

当前前端已支持一套“**召回优先**”的预测框预处理流程，核心包括：

- 默认**保留低置信度 PR 候选**（通过 `PRMinConf` 控制）
- 对聚合后的 `PR` 代表框做**轻度扩张**（通过 `PRExpandRatio` 控制）
- 再进入现有的病灶级自动配对与召回率统计流程

可调参数：
  - `EnableRecallFirstPreprocess`（启用方案A预处理）
  - `PRMinConf`（PR 最小置信度，默认 0.00 以保留低分候选）
  - `PRExpandRatio`（聚合后 PR 框扩张比例）
  - `Threshold`（病灶级自动配对阈值）
  - `CrossViewThreshold`（前后位同灶聚合阈值）
  - `DisableCrossViewMerge`（关闭前后聚合开关）
  - `DisableSameViewPrMerge`（关闭 PR 同视图聚合开关）
  - `IoU` 权重
  - `Center` 权重
  - `Size` 权重
  - `Patch` 权重

说明：

- 权重输入允许任意非负数，运行时会自动归一化
- `EnableRecallFirstPreprocess` 打开后，会按方案A保留低置信度 PR 候选，并对聚合后的 PR 框做适度扩张以提升召回
- `PRMinConf` 默认建议设为 `0.00 ~ 0.05`，优先保留更多候选以避免漏掉弱阳性
- `PRExpandRatio` 默认建议设为 `1.10 ~ 1.20`，可提高和真实病灶的重叠率
- `CrossViewThreshold` 越高，前后位越不容易被合并为同一病灶；越低则越容易聚合
- 勾选 `DisableCrossViewMerge` 后，会完全关闭前后位同灶聚合，恢复为前后位分别统计
- 勾选 `DisableSameViewPrMerge` 后，会关闭同一前位/后位内多个 PR 框的同灶合并
- 批量模式会覆盖已有自动/手工结果，因此执行前会弹确认框
- 批量完成后仍建议人工抽查并保存
