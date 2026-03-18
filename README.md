# Wedding Image Selection App

A lightweight Flask-based web application for reviewing and selecting images from large photo collections. Perfect for wedding photography selection, portfolio curation, or any scenario where you need to review and mark favorite images from a large set.

## Features

### 🖼️ Image Management
- **Folder Browser**: Native OS dialog for selecting image folders
- **Grid View**: Responsive thumbnail grid with lazy loading
- **Infinite Scroll**: Automatically loads more images as you scroll
- **Thumbnail Caching**: Fast loading with automatic thumbnail generation
- **Supported Formats**: JPG, JPEG, PNG, GIF, BMP, WebP, TIFF

### ⭐ Selection System
- **Favorite Marking**: Click heart icon to mark/unmark favorites
- **Review Panel**: Dedicated panel to view all selected favorites
- **Quick Access**: Visual counter showing selected count
- **Persistent Selection**: Favorites persist during session

### 🔍 Image Viewer
- **Full-Size Popup**: Click any thumbnail to view full resolution
- **Keyboard Navigation**: Arrow keys to navigate, F to favorite, Esc to close
- **Context Aware**: Returns to review panel when opened from there
- **Image Counter**: Shows current position (e.g., "45 / 250")

### 💾 Import/Export
- **Export Favorites**: Save selected image filenames to .txt file
- **Import Favorites**: Load previously saved selection lists
- **Text Format**: Simple line-separated filenames for easy editing

### ⚡ Performance
- **Lazy Loading**: Images load only when visible in viewport
- **Paginated Loading**: Loads 50 images at a time
- **Efficient Caching**: Thumbnails cached in `.thumbnails` folder
- **No Database**: Pure file-based system

## Requirements

- Python 3.7+
- Flask
- Pillow (PIL)
- Modern web browser with ES6 support

## Installation

1. **Clone or download the project**
   ```bash
   cd Image_selection
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

   Or install manually:
   ```bash
   pip install flask pillow
   ```

3. **Run the application**
   ```bash
   python app.py
   ```

4. **Open in browser**
   ```
   http://localhost:5000
   ```

## Usage

### First Time Setup

1. Launch the application - you'll see a folder picker screen
2. Click to open the native folder browser dialog
3. Select your image folder
4. Wait for thumbnails to generate (first load only)

### Selecting Images

1. **Grid View**: Scroll through the image grid
2. **Mark Favorites**: Click the heart icon on any image
3. **Quick Preview**: Click an image to view full resolution
4. **Navigate**: Use arrow keys or nav buttons in popup viewer
5. **Review**: Click "Review Favorites" to see all selected images

### Keyboard Shortcuts (in Popup Viewer)

- `←` / `→` - Navigate previous/next image
- `F` - Toggle favorite on current image
- `Esc` - Close popup viewer

### Import/Export

**Export:**
1. Select your favorite images
2. Click "Export to TXT"
3. Choose save location and filename
4. File contains one filename per line

**Import:**
1. Click "Import TXT"
2. Select a previously exported .txt file
3. Matching images will be automatically favorited

### Changing Folders

- Click the folder path in the top bar
- Select a new folder from the dialog
- Previous selections are cleared automatically

### Clearing Cache

Click "Clear Cache" to:
- Delete all cached thumbnails
- Free up disk space
- Reset folder selection
- Clear current favorites

## Project Structure

```
Image_selection/
│
├── app.py                 # Flask backend server
├── requirements.txt       # Python dependencies
├── README.md             # This file
│
├── templates/
│   └── index.html        # Main HTML template
│
└── static/
    ├── app.js            # Frontend JavaScript logic
    └── style.css         # Application styles
```

## Technical Details

### Backend (Flask)
- **Endpoint-based API**: JSON responses for frontend
- **Thumbnail Generation**: Uses Pillow for efficient resizing
- **Safe Path Handling**: Prevents directory traversal attacks
- **Caching Strategy**: In-memory image list + disk thumbnails

### Frontend (Vanilla JS)
- **No Framework Dependencies**: Pure JavaScript ES6
- **IntersectionObserver**: Efficient lazy loading
- **Responsive Design**: Works on desktop and tablets
- **State Management**: Simple global state pattern

### Caching
- Thumbnails stored in `.thumbnails/` within image folder
- 300x300px JPEG thumbnails at 80% quality
- Automatic cache management
- Browser cache headers for faster repeat loads

## Configuration

Edit `app.py` to customize:

```python
THUMB_SIZE = 300      # Thumbnail dimensions (pixels)
PAGE_SIZE = 50        # Images per page load
```

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

Requires support for:
- ES6 JavaScript
- IntersectionObserver API
- File System Access API (for export)

## Tips

1. **Large Collections**: Initial thumbnail generation may take time for thousands of images
2. **Storage**: Thumbnails use ~50-100KB per image
3. **Performance**: Works smoothly with 10,000+ images
4. **Backup**: Export your favorites list periodically
5. **Multiple Sessions**: Use import/export to continue work later

## Troubleshooting

**Images not loading?**
- Check folder permissions
- Verify image format is supported
- Try clearing cache and reloading

**Slow initial load?**
- Normal for first-time thumbnail generation
- Subsequent loads use cached thumbnails

**Export not working?**
- Ensure browser supports File System Access API
- Try a different browser (Chrome recommended)

**Thumbnails too large/small?**
- Adjust `THUMB_SIZE` in `app.py`
- Clear cache after changing

## License

This project is provided as-is for personal and commercial use.

## Author

Created for wedding photography selection and image curation workflows.

---

**Version**: 1.0  
**Last Updated**: March 2026
