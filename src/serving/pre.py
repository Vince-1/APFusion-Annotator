#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from ultralytics import YOLO
import torch

# 避免部分环境下出现 CUDNN_STATUS_NOT_INITIALIZED
torch.backends.cudnn.enabled = False

@dataclass
class Box:
    cls: int
    cx: float
    cy: float
    w: float
    h: float
    conf: float = 1.0


def load_yolo_gt(txt_path: Path) -> List[Box]:
    boxes: List[Box] = []
    if not txt_path.exists():
        return boxes

    with open(txt_path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 5:
                continue
            cls = int(float(parts[0]))
            cx, cy, w, h = map(float, parts[1:5])
            boxes.append(Box(cls=cls, cx=cx, cy=cy, w=w, h=h, conf=1.0))
    return boxes


def predict_yolo(model: YOLO, img_path: Path, conf: float) -> List[Box]:
    if not img_path.exists():
        return []

    results = model.predict(str(img_path), conf=conf, verbose=False)
    out: List[Box] = []

    if len(results) == 0 or results[0].boxes is None:
        return out

    h, w = results[0].orig_shape
    for b in results[0].boxes:
        x1, y1, x2, y2 = b.xyxy[0].cpu().numpy().tolist()
        cls = int(b.cls[0]) if b.cls is not None else 0
        score = float(b.conf[0]) if b.conf is not None else 1.0
        cx = ((x1 + x2) / 2) / w
        cy = ((y1 + y2) / 2) / h
        bw = (x2 - x1) / w
        bh = (y2 - y1) / h
        out.append(Box(cls=cls, cx=cx, cy=cy, w=bw, h=bh, conf=score))
    return out


def write_pred_txt(path: Path, boxes: List[Box]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for b in boxes:
            f.write(f"{b.cls} {b.cx:.6f} {b.cy:.6f} {b.w:.6f} {b.h:.6f} {b.conf:.6f}\n")


def read_report(report_path: Path) -> str:
    if not report_path.exists():
        return ""
    with open(report_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def to_rel(path: Path, root: Path) -> str:
    try:
        return str(path.resolve().relative_to(root.resolve()))
    except Exception:
        return str(path)


def collect_patients(img_dir: Path) -> List[str]:
    fronts = sorted(img_dir.glob("*_front.png"))
    return [p.stem[:-6] for p in fronts]


def build_dataset(
    model: YOLO,
    img_dir: Path,
    lbl_dir: Path,
    report_dir: Path,
    out_dir: Path,
    workspace_root: Path,
    conf: float,
) -> Dict:
    pids = collect_patients(img_dir)
    patients: List[Dict] = []

    pred_txt_dir = out_dir / "pred_txt"

    for i, pid in enumerate(pids, start=1):
        front_img = img_dir / f"{pid}_front.png"
        back_img = img_dir / f"{pid}_back.png"
        front_lbl = lbl_dir / f"{pid}_front.txt"
        back_lbl = lbl_dir / f"{pid}_back.txt"
        report_path = report_dir / f"{pid}.txt"

        gt_front = load_yolo_gt(front_lbl)
        gt_back = load_yolo_gt(back_lbl)
        pr_front = predict_yolo(model, front_img, conf=conf)
        pr_back = predict_yolo(model, back_img, conf=conf)

        write_pred_txt(pred_txt_dir / f"{pid}_front.txt", pr_front)
        write_pred_txt(pred_txt_dir / f"{pid}_back.txt", pr_back)

        patients.append(
            {
                "patient_id": pid,
                "images": {
                    "front": to_rel(front_img, workspace_root),
                    "back": to_rel(back_img, workspace_root),
                },
                "gt": {
                    "front": [asdict(b) for b in gt_front],
                    "back": [asdict(b) for b in gt_back],
                },
                "pred": {
                    "front": [asdict(b) for b in pr_front],
                    "back": [asdict(b) for b in pr_back],
                },
                "report": {
                    "path": to_rel(report_path, workspace_root),
                    "text": read_report(report_path),
                },
            }
        )
        print(f"[{i:03d}/{len(pids):03d}] {pid} done")

    return {
        "meta": {
            "created_at": datetime.now().isoformat(timespec="seconds"),
            "image_dir": str(img_dir),
            "label_dir": str(lbl_dir),
            "report_dir": str(report_dir),
            "model": str(model.ckpt_path) if hasattr(model, "ckpt_path") else "",
            "conf": conf,
            "count": len(patients),
        },
        "patients": patients,
    }


def write_stats_template(json_path: Path) -> None:
    if json_path.exists():
        return
    json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        f.write("{}\n")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate prediction package for AP fusion viewer")
#     p.add_argument("--img-dir", default="/home/wenhao/trains/review_datas/1475Single/images/test")
#     p.add_argument("--lbl-dir", default="/home/wenhao/trains/review_datas/1475Single/labels/test")
#     p.add_argument("--report-dir", default="/home/DataCollection/Project/RadiSmart/metastasis/WB2D/Report")
#     p.add_argument("--model", default="/home/wenhao/trains/runs/detect/1475single_yolo11n2/weights/best.pt")
#     p.add_argument("--output-dir", default="/home/wenhao/trains/prediction/1475single")
#     p.add_argument("--workspace-root", default="/home/wenhao/train")
    p.add_argument("--img-dir", default="/home/wenhao/trains/review_datas/APFusion31/images")
    p.add_argument("--lbl-dir", default="/home/wenhao/trains/review_datas/APFusion31/labels")
    p.add_argument("--report-dir", default="/home/DataCollection/Project/RadiSmart/metastasis/SZ_2D/Report")
    p.add_argument("--model", default="/home/gonghanmei/project/yolo/cv_review_3c_1327_10/fold2/weights/best.pt")
    p.add_argument("--output-dir", default="/home/wenhao/trains/prediction/APFusion31")
    p.add_argument("--workspace-root", default="/home/wenhao/train")
    p.add_argument("--conf", type=float, default=0.1)
    return p.parse_args()


def main() -> None:
    args = parse_args()

    img_dir = Path(args.img_dir)
    lbl_dir = Path(args.lbl_dir)
    report_dir = Path(args.report_dir)
    model_path = Path(args.model)
    out_dir = Path(args.output_dir)
    workspace_root = Path(args.workspace_root)

    if not img_dir.exists():
        raise FileNotFoundError(f"Image dir not found: {img_dir}")
    if not lbl_dir.exists():
        raise FileNotFoundError(f"Label dir not found: {lbl_dir}")
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")

    out_dir.mkdir(parents=True, exist_ok=True)

    print("Loading model...")
    model = YOLO(str(model_path))

    print("Running predictions and packaging data...")
    dataset = build_dataset(
        model=model,
        img_dir=img_dir,
        lbl_dir=lbl_dir,
        report_dir=report_dir,
        out_dir=out_dir,
        workspace_root=workspace_root,
        conf=args.conf,
    )

    data_json = out_dir / "data.json"
    with open(data_json, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    write_stats_template(out_dir / "stats.json")

    print("Done.")
    print(f"Data JSON: {data_json}")
    print(f"Pred txt dir: {out_dir / 'pred_txt'}")
    print(f"Stats JSON: {out_dir / 'stats.json'}")


if __name__ == "__main__":
    main()
