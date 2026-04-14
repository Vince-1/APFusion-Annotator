#!/usr/bin/env python3
from __future__ import annotations

"""双模型推理脚本：全身模型 + 四肢专精模型。

流程：
1. 用全身模型对整张 front/back 图像推理
2. 用 `limbWithLabel/*.nii.gz` 生成四肢 ROI
3. 仅在 ROI 内运行四肢专精模型
4. 将 ROI 预测映射回原图
5. 做“区域优先 + NMS”融合
6. 输出 `pred_txt/`、`data.json`、`stats.json`、`summary.json`，可选保存可视化

示例：
    python process/infer_dual_model.py \
        --img-dir /home/wenhao/trains/review_datas/1982Single/images/test \
        --lbl-dir /home/wenhao/trains/review_datas/1982Single/labels/test \
        --full-model /path/to/full/weights/best.pt \
        --limb-model /path/to/limb/weights/best.pt \
        --output-dir /home/wenhao/trains/prediction/1982dual \
        --device 1 \
"""

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import cv2
import nibabel as nib
import numpy as np
import torch
from ultralytics import YOLO

# 避免部分环境下 cuDNN 初始化异常
torch.backends.cudnn.enabled = False


@dataclass
class Box:
    cls: int
    cx: float
    cy: float
    w: float
    h: float
    conf: float = 1.0
    source: str = "full"

    def to_xyxy(self, img_h: int, img_w: int) -> tuple[float, float, float, float]:
        x1 = (self.cx - self.w / 2.0) * img_w
        y1 = (self.cy - self.h / 2.0) * img_h
        x2 = (self.cx + self.w / 2.0) * img_w
        y2 = (self.cy + self.h / 2.0) * img_h
        return x1, y1, x2, y2

    @classmethod
    def from_xyxy(
        cls,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        img_h: int,
        img_w: int,
        conf: float,
        klass: int = 0,
        source: str = "full",
    ) -> "Box":
        x1 = max(0.0, min(float(img_w - 1), float(x1)))
        x2 = max(0.0, min(float(img_w - 1), float(x2)))
        y1 = max(0.0, min(float(img_h - 1), float(y1)))
        y2 = max(0.0, min(float(img_h - 1), float(y2)))
        if x2 <= x1 or y2 <= y1:
            raise ValueError("invalid xyxy box")
        cx = ((x1 + x2) / 2.0) / img_w
        cy = ((y1 + y2) / 2.0) / img_h
        w = (x2 - x1) / img_w
        h = (y2 - y1) / img_h
        return cls(cls=klass, cx=cx, cy=cy, w=w, h=h, conf=float(conf), source=source)


def load_yolo_gt(txt_path: Path) -> list[Box]:
    boxes: list[Box] = []
    if not txt_path.exists():
        return boxes
    with open(txt_path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 5:
                continue
            klass = int(float(parts[0]))
            cx, cy, w, h = map(float, parts[1:5])
            conf = float(parts[5]) if len(parts) >= 6 else 1.0
            boxes.append(Box(cls=klass, cx=cx, cy=cy, w=w, h=h, conf=conf, source="gt"))
    return boxes


def write_pred_txt(path: Path, boxes: list[Box]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for b in boxes:
            f.write(f"{b.cls} {b.cx:.6f} {b.cy:.6f} {b.w:.6f} {b.h:.6f} {b.conf:.6f}\n")


def read_report(report_path: Path) -> str:
    if not report_path.exists():
        return ""
    with open(report_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def write_stats_template(json_path: Path) -> None:
    if json_path.exists():
        return
    json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        f.write("{}\n")


def to_rel(path: Path, root: Path) -> str:
    try:
        return str(path.resolve().relative_to(root.resolve()))
    except Exception:
        return str(path)


def collect_patients(img_dir: Path) -> list[str]:
    return sorted({p.stem[:-6] for p in img_dir.glob("*_front.png")})


def preprocess_mask_slice(slice_data: np.ndarray) -> np.ndarray:
    arr = (slice_data > 0).astype(np.uint8) * 255
    rotated = np.rot90(arr, k=3)  # 顺时针 90°
    return np.fliplr(rotated).astype(np.uint8)


def load_limb_mask_2d(mask_path: Path, view: str, target_w: int, target_h: int) -> np.ndarray | None:
    if not mask_path.exists():
        return None

    data = np.squeeze(nib.load(str(mask_path)).get_fdata())
    if data.ndim < 2:
        return None

    if data.ndim == 2:
        raw = data
    else:
        idx = 0 if view == "front" else 1
        if data.shape[2] <= idx:
            idx = 0
        raw = data[:, :, idx]

    mask = preprocess_mask_slice(raw)
    mask = cv2.resize(mask, (target_w, target_h), interpolation=cv2.INTER_NEAREST)
    return (mask > 0).astype(np.uint8)


def find_roi_bbox(mask2d: np.ndarray, expand_ratio: float = 0.12) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(mask2d > 0)
    if len(xs) == 0 or len(ys) == 0:
        return None

    x1, x2 = int(xs.min()), int(xs.max())
    y1, y2 = int(ys.min()), int(ys.max())
    h, w = mask2d.shape[:2]
    dx = max(4, int((x2 - x1 + 1) * expand_ratio))
    dy = max(4, int((y2 - y1 + 1) * expand_ratio))

    x1 = max(0, x1 - dx)
    y1 = max(0, y1 - dy)
    x2 = min(w - 1, x2 + dx)
    y2 = min(h - 1, y2 + dy)

    if x2 <= x1 or y2 <= y1:
        return None
    return x1, y1, x2, y2


def predict_boxes(model: YOLO, image: Any, conf: float, device: str) -> list[Box]:
    results = model.predict(image, conf=conf, device=device, verbose=False)
    out: list[Box] = []
    if not results or results[0].boxes is None:
        return out

    img_h, img_w = results[0].orig_shape[:2]
    for b in results[0].boxes:
        x1, y1, x2, y2 = b.xyxy[0].detach().cpu().numpy().tolist()
        score = float(b.conf[0]) if b.conf is not None else 1.0
        klass = int(b.cls[0]) if b.cls is not None else 0
        try:
            out.append(Box.from_xyxy(x1, y1, x2, y2, img_h, img_w, score, klass, source="full"))
        except ValueError:
            continue
    return out


def remap_limb_boxes(
    local_boxes: list[Box],
    roi_bbox: tuple[int, int, int, int],
    img_h: int,
    img_w: int,
) -> list[Box]:
    x0, y0, _, _ = roi_bbox
    remapped: list[Box] = []
    roi_w = max(1, int((roi_bbox[2] - roi_bbox[0] + 1)))
    roi_h = max(1, int((roi_bbox[3] - roi_bbox[1] + 1)))

    for box in local_boxes:
        lx1, ly1, lx2, ly2 = box.to_xyxy(roi_h, roi_w)
        gx1, gy1 = lx1 + x0, ly1 + y0
        gx2, gy2 = lx2 + x0, ly2 + y0
        try:
            remapped.append(
                Box.from_xyxy(gx1, gy1, gx2, gy2, img_h, img_w, box.conf, box.cls, source="limb")
            )
        except ValueError:
            continue
    return remapped


def box_center_in_mask(box: Box, mask2d: np.ndarray | None, img_h: int, img_w: int) -> bool:
    if mask2d is None:
        return False
    x = int(round(box.cx * img_w))
    y = int(round(box.cy * img_h))
    x = min(max(x, 0), img_w - 1)
    y = min(max(y, 0), img_h - 1)
    return bool(mask2d[y, x] > 0)


def iou(box1: Box, box2: Box, img_h: int, img_w: int) -> float:
    x1a, y1a, x2a, y2a = box1.to_xyxy(img_h, img_w)
    x1b, y1b, x2b, y2b = box2.to_xyxy(img_h, img_w)
    xi1, yi1 = max(x1a, x1b), max(y1a, y1b)
    xi2, yi2 = min(x2a, x2b), min(y2a, y2b)
    if xi2 <= xi1 or yi2 <= yi1:
        return 0.0
    inter = (xi2 - xi1) * (yi2 - yi1)
    area1 = (x2a - x1a) * (y2a - y1a)
    area2 = (x2b - x1b) * (y2b - y1b)
    union = area1 + area2 - inter
    return inter / union if union > 0 else 0.0


def nms(boxes: list[Box], img_h: int, img_w: int, iou_thr: float = 0.45) -> list[Box]:
    if not boxes:
        return []
    order = sorted(range(len(boxes)), key=lambda i: boxes[i].conf, reverse=True)
    keep: list[Box] = []
    while order:
        idx = order.pop(0)
        current = boxes[idx]
        keep.append(current)
        remaining: list[int] = []
        for j in order:
            if boxes[j].cls != current.cls:
                remaining.append(j)
                continue
            if iou(current, boxes[j], img_h, img_w) < iou_thr:
                remaining.append(j)
        order = remaining
    return keep


def nms_prefer_full(boxes: list[Box], img_h: int, img_w: int, iou_thr: float = 0.45) -> list[Box]:
    """NMS with source-aware priority: prefer full-model boxes over limb boxes."""
    if not boxes:
        return []

    def sort_key(i: int) -> tuple[float, float]:
        b = boxes[i]
        # Full boxes are processed first to protect global recall.
        source_bias = 1.0 if b.source == "full" else 0.0
        return (source_bias, b.conf)

    order = sorted(range(len(boxes)), key=sort_key, reverse=True)
    keep: list[Box] = []
    while order:
        idx = order.pop(0)
        current = boxes[idx]
        keep.append(current)
        remaining: list[int] = []
        for j in order:
            if boxes[j].cls != current.cls:
                remaining.append(j)
                continue
            if iou(current, boxes[j], img_h, img_w) < iou_thr:
                remaining.append(j)
        order = remaining
    return keep


def box_mask_overlap_ratio(box: Box, mask2d: np.ndarray | None, img_h: int, img_w: int) -> float:
    """Return the fraction of box area covered by limb mask pixels."""
    if mask2d is None:
        return 0.0

    x1, y1, x2, y2 = box.to_xyxy(img_h, img_w)
    xi1 = max(0, min(img_w - 1, int(np.floor(x1))))
    yi1 = max(0, min(img_h - 1, int(np.floor(y1))))
    xi2 = max(0, min(img_w - 1, int(np.ceil(x2))))
    yi2 = max(0, min(img_h - 1, int(np.ceil(y2))))
    if xi2 <= xi1 or yi2 <= yi1:
        return 0.0

    patch = mask2d[yi1:yi2 + 1, xi1:xi2 + 1]
    if patch.size == 0:
        return 0.0
    return float(np.mean(patch > 0))


def fuse_predictions(
    full_boxes: list[Box],
    limb_boxes: list[Box],
    mask2d: np.ndarray | None,
    img_h: int,
    img_w: int,
    replace_iou: float = 0.25,
    fuse_iou: float = 0.45,
    replace_conf_margin: float = 0.08,
    min_mask_overlap: float = 0.25,
) -> list[Box]:
    fused: list[Box] = []

    for fb in full_boxes:
        in_limb = box_center_in_mask(fb, mask2d, img_h, img_w)
        if not in_limb:
            fused.append(fb)
            continue

        mask_overlap = box_mask_overlap_ratio(fb, mask2d, img_h, img_w)
        if mask_overlap < min_mask_overlap:
            # Center-only hit can be noisy near boundaries; keep full box.
            fused.append(fb)
            continue

        best_overlap = 0.0
        best_limb_conf = -1.0
        for lb in limb_boxes:
            overlap = iou(fb, lb, img_h, img_w)
            if overlap >= replace_iou and overlap > best_overlap:
                best_overlap = overlap
                best_limb_conf = lb.conf

        if best_overlap < replace_iou:
            # 回退保留，避免 limb 模型没检出时直接丢失召回
            fused.append(fb)
            continue

        # Only replace when limb prediction is clearly stronger.
        if best_limb_conf < (fb.conf + replace_conf_margin):
            fused.append(fb)

    fused.extend(limb_boxes)
    return nms_prefer_full(fused, img_h, img_w, iou_thr=fuse_iou)


def process_view(
    pid: str,
    view: str,
    img_path: Path,
    mask_path: Path,
    full_model: YOLO,
    limb_model: YOLO,
    full_conf: float,
    limb_conf: float,
    replace_iou: float,
    fuse_iou: float,
    roi_expand: float,
    replace_conf_margin: float,
    min_mask_overlap: float,
    device: str,
) -> dict[str, Any]:
    if not img_path.exists():
        return {
            "roi_bbox": None,
            "pred_full": [],
            "pred_limb": [],
            "pred_final": [],
            "error": f"image not found: {img_path}",
        }

    img = cv2.imread(str(img_path), cv2.IMREAD_UNCHANGED)
    if img is None:
        return {
            "roi_bbox": None,
            "pred_full": [],
            "pred_limb": [],
            "pred_final": [],
            "error": f"failed to read image: {img_path}",
        }

    img_h, img_w = img.shape[:2]
    full_boxes = predict_boxes(full_model, str(img_path), conf=full_conf, device=device)

    mask2d = load_limb_mask_2d(mask_path, view, target_w=img_w, target_h=img_h)
    roi_bbox = find_roi_bbox(mask2d, expand_ratio=roi_expand) if mask2d is not None else None

    limb_boxes_global: list[Box] = []
    if roi_bbox is not None:
        x1, y1, x2, y2 = roi_bbox
        roi_img = img[y1:y2 + 1, x1:x2 + 1]
        if roi_img.size > 0:
            if roi_img.ndim == 2:
                roi_img = cv2.cvtColor(roi_img, cv2.COLOR_GRAY2BGR)
            limb_boxes_local = predict_boxes(limb_model, roi_img, conf=limb_conf, device=device)
            for box in limb_boxes_local:
                box.source = "limb"
            limb_boxes_global = remap_limb_boxes(limb_boxes_local, roi_bbox, img_h, img_w)

    final_boxes = fuse_predictions(
        full_boxes=full_boxes,
        limb_boxes=limb_boxes_global,
        mask2d=mask2d,
        img_h=img_h,
        img_w=img_w,
        replace_iou=replace_iou,
        fuse_iou=fuse_iou,
        replace_conf_margin=replace_conf_margin,
        min_mask_overlap=min_mask_overlap,
    )

    return {
        "roi_bbox": list(roi_bbox) if roi_bbox is not None else None,
        "pred_full": [asdict(b) for b in full_boxes],
        "pred_limb": [asdict(b) for b in limb_boxes_global],
        "pred_final": [asdict(b) for b in final_boxes],
        "error": None,
    }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Dual-model inference for full-body + limb-specialist YOLO")
    p.add_argument("--img-dir", type=str, default="/home/wenhao/trains/review_datas/1982Single/images/test")
    p.add_argument("--lbl-dir", type=str, default="/home/wenhao/trains/review_datas/1982Single/labels/test")
    p.add_argument("--limb-mask-dir", type=str, default="/home/DataCollection/Project/RadiSmart/metastasis/WB2D/limbWithLabel")
    p.add_argument("--report-dir", type=str, default="/home/DataCollection/Project/RadiSmart/metastasis/WB2D/Report")
    p.add_argument("--full-model", type=str, required=True, help="全身模型权重路径")
    p.add_argument("--limb-model", type=str, required=True, help="四肢模型权重路径")
    p.add_argument("--output-dir", type=str, default="/home/wenhao/trains/prediction/1982dual")
    p.add_argument("--workspace-root", type=str, default="/home/wenhao/train")
    p.add_argument("--device", type=str, default="0")
    p.add_argument("--full-conf", type=float, default=0.12)
    p.add_argument("--limb-conf", type=float, default=0.18)
    p.add_argument("--replace-iou", type=float, default=0.25, help="四肢框替换全身框的 IoU 阈值")
    p.add_argument("--fuse-iou", type=float, default=0.45, help="最终 NMS IoU 阈值")
    p.add_argument("--roi-expand", type=float, default=0.12, help="四肢 ROI 外扩比例")
    p.add_argument("--replace-conf-margin", type=float, default=0.08, help="四肢替换全身所需的最小置信度优势")
    p.add_argument("--min-mask-overlap", type=float, default=0.25, help="允许替换时全身框在四肢 mask 内的最小覆盖率")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    img_dir = Path(args.img_dir)
    lbl_dir = Path(args.lbl_dir)
    limb_mask_dir = Path(args.limb_mask_dir)
    report_dir = Path(args.report_dir)
    full_model_path = Path(args.full_model)
    limb_model_path = Path(args.limb_model)
    out_dir = Path(args.output_dir)
    workspace_root = Path(args.workspace_root)

    if not img_dir.exists():
        raise FileNotFoundError(f"Image dir not found: {img_dir}")
    if not full_model_path.exists():
        raise FileNotFoundError(f"Full model not found: {full_model_path}")
    if not limb_model_path.exists():
        raise FileNotFoundError(f"Limb model not found: {limb_model_path}")
    if not limb_mask_dir.exists():
        raise FileNotFoundError(f"Limb mask dir not found: {limb_mask_dir}")

    out_dir.mkdir(parents=True, exist_ok=True)
    pred_txt_dir = out_dir / "pred_txt"
    pred_full_dir = out_dir / "pred_txt_full"
    pred_limb_dir = out_dir / "pred_txt_limb"

    print("Loading models...")
    full_model = YOLO(str(full_model_path))
    limb_model = YOLO(str(limb_model_path))

    pids = collect_patients(img_dir)
    print(f"Patients found: {len(pids)}")

    patients: list[dict[str, Any]] = []
    totals = {
        "patients": len(pids),
        "views": 0,
        "full_boxes": 0,
        "limb_boxes": 0,
        "final_boxes": 0,
        "roi_views": 0,
    }

    for idx, pid in enumerate(pids, start=1):
        report_path = report_dir / f"{pid}.txt"
        patient_item: dict[str, Any] = {
            "patient_id": pid,
            "images": {},
            "gt": {},
            "pred": {},
            "pred_full": {},
            "pred_limb": {},
            "pred_final": {},
            "roi_bbox": {},
            "report": {
                "path": to_rel(report_path, workspace_root),
                "text": read_report(report_path),
            },
        }

        for view in ("front", "back"):
            img_path = img_dir / f"{pid}_{view}.png"
            lbl_path = lbl_dir / f"{pid}_{view}.txt"
            mask_path = limb_mask_dir / f"{pid}.nii.gz"

            result = process_view(
                pid=pid,
                view=view,
                img_path=img_path,
                mask_path=mask_path,
                full_model=full_model,
                limb_model=limb_model,
                full_conf=args.full_conf,
                limb_conf=args.limb_conf,
                replace_iou=args.replace_iou,
                fuse_iou=args.fuse_iou,
                roi_expand=args.roi_expand,
                replace_conf_margin=args.replace_conf_margin,
                min_mask_overlap=args.min_mask_overlap,
                device=args.device,
            )

            pred_full = [Box(**b) for b in result["pred_full"]]
            pred_limb = [Box(**b) for b in result["pred_limb"]]
            pred_final = [Box(**b) for b in result["pred_final"]]

            write_pred_txt(pred_full_dir / f"{pid}_{view}.txt", pred_full)
            write_pred_txt(pred_limb_dir / f"{pid}_{view}.txt", pred_limb)
            write_pred_txt(pred_txt_dir / f"{pid}_{view}.txt", pred_final)

            patient_item["images"][view] = to_rel(img_path, workspace_root)
            patient_item["gt"][view] = [asdict(b) for b in load_yolo_gt(lbl_path)] if lbl_dir.exists() else []
            patient_item["pred"][view] = result["pred_final"]
            patient_item["pred_full"][view] = result["pred_full"]
            patient_item["pred_limb"][view] = result["pred_limb"]
            patient_item["pred_final"][view] = result["pred_final"]
            patient_item["roi_bbox"][view] = result["roi_bbox"]

            totals["views"] += 1
            totals["full_boxes"] += len(pred_full)
            totals["limb_boxes"] += len(pred_limb)
            totals["final_boxes"] += len(pred_final)
            if result["roi_bbox"] is not None:
                totals["roi_views"] += 1

        patients.append(patient_item)
        print(
            f"[{idx:03d}/{len(pids):03d}] {pid} done | "
            f"front={len(patient_item['pred_final'].get('front', []))} "
            f"back={len(patient_item['pred_final'].get('back', []))}"
        )

    data_json = {
        "meta": {
            "created_at": datetime.now().isoformat(timespec="seconds"),
            "img_dir": str(img_dir),
            "lbl_dir": str(lbl_dir),
            "limb_mask_dir": str(limb_mask_dir),
            "report_dir": str(report_dir),
            "full_model": str(full_model_path),
            "limb_model": str(limb_model_path),
            "device": args.device,
            "full_conf": args.full_conf,
            "limb_conf": args.limb_conf,
            "replace_iou": args.replace_iou,
            "fuse_iou": args.fuse_iou,
            "roi_expand": args.roi_expand,
            "replace_conf_margin": args.replace_conf_margin,
            "min_mask_overlap": args.min_mask_overlap,
        },
        "patients": patients,
    }

    with open(out_dir / "data.json", "w", encoding="utf-8") as f:
        json.dump(data_json, f, ensure_ascii=False, indent=2)

    write_stats_template(out_dir / "stats.json")

    with open(out_dir / "summary.json", "w", encoding="utf-8") as f:
        json.dump(totals, f, ensure_ascii=False, indent=2)

    print("Done.")
    print(f"Final pred txt : {pred_txt_dir}")
    print(f"Full pred txt  : {pred_full_dir}")
    print(f"Limb pred txt  : {pred_limb_dir}")
    print(f"Data JSON      : {out_dir / 'data.json'}")
    print(f"Stats JSON     : {out_dir / 'stats.json'}")
    print(f"Summary JSON   : {out_dir / 'summary.json'}")


if __name__ == "__main__":
    main()
