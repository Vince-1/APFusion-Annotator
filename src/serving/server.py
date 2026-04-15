#!/usr/bin/env python3
"""
Simple Flask server for AP Fusion Viewer - handles JSON saving
"""
import os
import json
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Configuration
WORKSPACE_ROOT = Path("/home/wenhao/trains/web/apfusion")


def ensure_dir(path):
    """Ensure directory exists"""
    path.parent.mkdir(parents=True, exist_ok=True)


def normalize_workspace_path(raw_path: str) -> Path:
    """Normalize relative paths and prevent escaping workspace with '..'."""
    p = Path(raw_path)
    if p.is_absolute():
        return p

    parts = []
    for part in p.parts:
        if part in ("", "."):
            continue
        if part == "..":
            if parts:
                parts.pop()
            continue
        parts.append(part)

    return WORKSPACE_ROOT.joinpath(*parts)


@app.route('/api/save-json', methods=['POST'])
def save_json():
    """Save records as JSON file"""
    try:
        data = request.get_json()
        json_path = data.get('json_path')
        stats = data.get('stats')
        if stats is None:
            stats = data.get('records', {})

        if not json_path:
            return jsonify({'error': 'json_path required'}), 400

        # Resolve path relative to workspace with safe normalization.
        full_path = normalize_workspace_path(json_path)
        ensure_dir(full_path)

        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)

        return jsonify({
            'success': True,
            'message': f'Saved to {json_path}',
            'resolved_path': str(full_path),
            'file_size': full_path.stat().st_size
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting Flask server on port {port}...")
    print(f"Workspace root: {WORKSPACE_ROOT}")
    app.run(host='0.0.0.0', port=port, debug=False)
