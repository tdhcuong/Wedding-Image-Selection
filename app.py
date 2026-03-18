import os
import io
import json
import threading
from pathlib import Path
from flask import Flask, render_template, send_file, jsonify, request, make_response
from PIL import Image

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # No caching for static files in dev

IMAGE_FOLDER = ""
THUMB_FOLDER = None
SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'}
THUMB_SIZE = 300
PAGE_SIZE = 50

# Cache the image list in memory
_image_list_cache = None


def set_image_folder(folder_path):
    """Set the active image folder and reset caches."""
    global IMAGE_FOLDER, THUMB_FOLDER, _image_list_cache
    IMAGE_FOLDER = folder_path
    THUMB_FOLDER = Path(folder_path) / ".thumbnails" if folder_path else None
    _image_list_cache = None


def get_image_list():
    """Return sorted list of image filenames from the configured folder."""
    global _image_list_cache
    if _image_list_cache is not None:
        return _image_list_cache
    folder = Path(IMAGE_FOLDER)
    if not folder.exists():
        return []
    _image_list_cache = [
        f.name for f in sorted(folder.iterdir())
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    return _image_list_cache


def _resolve_safe(filename):
    """Resolve filename safely inside IMAGE_FOLDER, return path or None."""
    safe_name = Path(filename).name
    file_path = Path(IMAGE_FOLDER) / safe_name
    if not file_path.exists() or not file_path.is_file():
        return None
    try:
        file_path.resolve().relative_to(Path(IMAGE_FOLDER).resolve())
    except ValueError:
        return None
    return file_path


def get_or_create_thumbnail(filename):
    """Return path to a cached thumbnail, creating it if needed."""
    THUMB_FOLDER.mkdir(exist_ok=True)
    thumb_path = THUMB_FOLDER / filename
    if thumb_path.exists():
        return thumb_path
    src = _resolve_safe(filename)
    if not src:
        return None
    try:
        with Image.open(src) as img:
            img.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            img.save(thumb_path, 'JPEG', quality=80, optimize=True)
        return thumb_path
    except Exception:
        return None


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/current-folder')
def current_folder():
    """Return the current image folder path."""
    return jsonify({"folder": IMAGE_FOLDER})


@app.route('/api/set-folder', methods=['POST'])
def api_set_folder():
    """Set the image folder path."""
    data = request.get_json()
    folder = data.get('folder', '').strip()
    if not folder:
        return jsonify({"error": "No folder specified"}), 400
    p = Path(folder)
    if not p.exists() or not p.is_dir():
        return jsonify({"error": "Folder does not exist"}), 400
    set_image_folder(folder)
    count = len(get_image_list())
    return jsonify({"status": "ok", "folder": folder, "count": count})


@app.route('/api/browse-folder', methods=['POST'])
def browse_folder():
    """Open a native OS folder picker dialog and return the selected path."""
    result = {}
    def pick():
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        folder = filedialog.askdirectory(title='Select Image Folder')
        root.destroy()
        result['folder'] = folder
    t = threading.Thread(target=pick)
    t.start()
    t.join()
    folder = result.get('folder', '')
    if not folder:
        return jsonify({"folder": "", "cancelled": True})
    set_image_folder(folder)
    count = len(get_image_list())
    return jsonify({"folder": folder, "count": count, "cancelled": False})


@app.route('/api/clear-cache', methods=['POST'])
def clear_cache():
    """Delete the .thumbnails folder and reset folder selection."""
    import shutil
    if THUMB_FOLDER and THUMB_FOLDER.exists():
        shutil.rmtree(THUMB_FOLDER)
    set_image_folder("")
    return jsonify({"status": "ok", "message": "Cache cleared"})


@app.route('/api/images')
def api_images():
    """Return paginated JSON list of image filenames."""
    all_images = get_image_list()
    page = request.args.get('page', 0, type=int)
    start = page * PAGE_SIZE
    end = start + PAGE_SIZE
    page_images = all_images[start:end]
    return jsonify({
        "images": page_images,
        "total": len(all_images),
        "page": page,
        "hasMore": end < len(all_images)
    })


@app.route('/api/all-names')
def all_image_names():
    """Return all image filenames (names only, for popup navigation)."""
    return jsonify(get_image_list())


@app.route('/api/image/<path:filename>')
def serve_image(filename):
    """Serve an individual full-resolution image file."""
    file_path = _resolve_safe(filename)
    if not file_path:
        return "Not found", 404
    resp = make_response(send_file(file_path))
    resp.headers['Cache-Control'] = 'public, max-age=86400'
    return resp


@app.route('/api/thumb/<path:filename>')
def serve_thumbnail(filename):
    """Serve a small thumbnail for grid display."""
    thumb = get_or_create_thumbnail(filename)
    if not thumb:
        return "Not found", 404
    resp = make_response(send_file(thumb, mimetype='image/jpeg'))
    resp.headers['Cache-Control'] = 'public, max-age=604800'
    return resp


@app.route('/api/import', methods=['POST'])
def import_favorites():
    """Import favorite image names from an uploaded .txt file."""
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    f = request.files['file']
    content = f.read().decode('utf-8', errors='ignore')
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    known = set(get_image_list())
    valid = [name for name in lines if name in known]
    return jsonify({"favorites": valid, "count": len(valid)})


@app.route('/api/export', methods=['POST'])
def export_favorites():
    """Export favorite image names to a .txt file."""
    data = request.get_json()
    favorites = data.get('favorites', [])
    # Sanitize: only keep known image names
    known = set(get_image_list())
    safe_favorites = [f for f in favorites if f in known]

    # export_path = Path(IMAGE_FOLDER) / "favorites.txt"
    export_path = Path("./favorites.txt")
    with open(export_path, 'w', encoding='utf-8') as f:
        for name in safe_favorites:
            f.write(name + '\n')

    return jsonify({"status": "ok", "path": str(export_path), "count": len(safe_favorites)})


if __name__ == '__main__':
    print(f"Loading images from: {IMAGE_FOLDER}")
    print(f"Found {len(get_image_list())} images")
    app.run(debug=True, port=5000)
