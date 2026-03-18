// ===== State =====
let images = [];       // incrementally loaded (for grid rendering)
let allNames = [];     // all image names (for popup navigation)
let favorites = new Set();
let popupIndex = -1;
let currentPage = 0;
let hasMore = true;
let isLoading = false;
let totalImages = 0;
let cacheBuster = '';
let openedFromReview = false;  // track if popup was opened from review panel

// ===== Init =====
let folderLoaded = false;

document.addEventListener('DOMContentLoaded', () => {
    checkCurrentFolder();
    setupInfiniteScroll();
});

async function checkCurrentFolder() {
    try {
        const res = await fetch('/api/current-folder');
        const data = await res.json();
        if (data.folder) {
            folderLoaded = true;
            document.getElementById('folder-picker').style.display = 'none';
            updateFolderLabel(data.folder);
            loadAllNames();
            loadNextPage();
        }
    } catch (e) { /* show picker */ }
}

function showFolderPicker() {
    document.getElementById('folder-picker').style.display = 'flex';
}

async function browseFolder() {
    showToast('Opening folder...');
    try {
        const res = await fetch('/api/browse-folder', { method: 'POST' });
        const data = await res.json();
        if (data.cancelled || !data.folder) { return; }
        // Reset state and reload
        images = [];
        allNames = [];
        favorites.clear();
        popupIndex = -1;
        currentPage = 0;
        hasMore = true;
        isLoading = false;
        totalImages = 0;
        folderLoaded = true;
        document.getElementById('grid').innerHTML = '';
        document.getElementById('folder-picker').style.display = 'none';
        updateFolderLabel(data.folder);
        updateFavCount();
        loadAllNames();
        loadNextPage();
        showToast(`Loaded ${data.count} images from folder`);
    } catch (err) {
        showToast('Error: ' + err.message);
    }
}

async function loadAllNames() {
    try {
        const res = await fetch('/api/all-names');
        allNames = await res.json();
        updateFavCount();
    } catch (e) { /* fallback: allNames stays in sync with images */ }
}

async function loadNextPage() {
    if (isLoading || !hasMore) return;
    isLoading = true;
    const loading = document.getElementById('loading');
    const grid = document.getElementById('grid');
    try {
        const res = await fetch('/api/images?page=' + currentPage);
        const data = await res.json();
        totalImages = data.total;
        hasMore = data.hasMore;

        if (currentPage === 0 && data.images.length === 0) {
            loading.style.display = 'none';
            grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:60px;color:#888;">No images found in the folder.</p>';
            return;
        }

        const startIdx = images.length;
        images.push(...data.images);
        appendGridItems(data.images, startIdx);
        currentPage++;
        loading.style.display = hasMore ? 'block' : 'none';
        loading.textContent = hasMore ? 'Loading more...' : '';
    } catch (err) {
        loading.textContent = 'Error loading images: ' + err.message;
    } finally {
        isLoading = false;
        // After loading, check if sentinel is still visible (short viewport / fast scroll)
        if (hasMore) {
            setTimeout(() => {
                const sentinel = document.getElementById('loading');
                if (sentinel) {
                    const rect = sentinel.getBoundingClientRect();
                    if (rect.top < window.innerHeight + 800) loadNextPage();
                }
            }, 100);
        }
    }
}

function setupInfiniteScroll() {
    // Use scroll event for loading more pages as user scrolls
    window.addEventListener('scroll', () => {
        if (!hasMore || isLoading) return;
        const sentinel = document.getElementById('loading');
        if (!sentinel) return;
        const rect = sentinel.getBoundingClientRect();
        if (rect.top < window.innerHeight + 800) {
            loadNextPage();
        }
    });
}

// ===== Grid Rendering =====
function appendGridItems(newImages, startIdx) {
    const grid = document.getElementById('grid');
    newImages.forEach((name, i) => {
        const idx = startIdx + i;
        const item = document.createElement('div');
        item.className = 'grid-item';
        item.setAttribute('data-name', name);
        item.innerHTML = `
            <img data-src="/api/thumb/${encodeURIComponent(name)}${cacheBuster}" alt="${escapeHtml(name)}" class="lazy-img" onclick="openPopup(${idx})">
            <button class="fav-btn grid-fav ${favorites.has(name) ? 'active' : ''}" onclick="event.stopPropagation(); toggleFav('${escapeJs(name)}', this)" title="Toggle Favorite">
                <svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </button>
            <div class="img-name">${escapeHtml(name)}</div>
        `;
        grid.appendChild(item);
        // Observe for lazy loading
        lazyObserver.observe(item.querySelector('.lazy-img'));
    });
}

// Lazy-load images via IntersectionObserver
const lazyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                lazyObserver.unobserve(img);
            }
        }
    });
}, { rootMargin: '300px' });

// ===== Favorites =====
function toggleFav(name, btnElement) {
    if (favorites.has(name)) {
        favorites.delete(name);
        btnElement.classList.remove('active');
    } else {
        favorites.add(name);
        btnElement.classList.add('active');
    }
    updateFavCount();
}

function toggleFavPopup() {
    const name = allNames[popupIndex] || images[popupIndex];
    const btn = document.getElementById('popup-fav-btn');
    if (favorites.has(name)) {
        favorites.delete(name);
        btn.classList.remove('active');
    } else {
        favorites.add(name);
        btn.classList.add('active');
    }
    updateFavCount();
    // Sync grid icon
    syncGridFavIcon(name);
}

function syncGridFavIcon(name) {
    const gridItems = document.querySelectorAll('.grid-item[data-name="' + CSS.escape(name) + '"]');
    if (gridItems.length === 0) return;
    const btn = gridItems[0].querySelector('.fav-btn');
    if (favorites.has(name)) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
}

function updateFavCount() {
    const total = allNames.length || totalImages || images.length;
    document.getElementById('fav-count').textContent = 'Selected ' + favorites.size + ' / ' + total;
}

// ===== Popup Viewer =====
function openPopup(index) {
    // Convert grid index to allNames index if needed
    if (allNames.length > 0 && index < images.length) {
        const name = images[index];
        const allIdx = allNames.indexOf(name);
        popupIndex = allIdx >= 0 ? allIdx : index;
    } else {
        popupIndex = index;
    }
    openedFromReview = false;  // opened from grid, not review
    const popup = document.getElementById('popup');
    popup.style.display = 'flex';
    updatePopup();
    document.addEventListener('keydown', popupKeyHandler);
}

function closePopup() {
    document.getElementById('popup').style.display = 'none';
    document.removeEventListener('keydown', popupKeyHandler);
    // If opened from review panel, return to it
    if (openedFromReview) {
        openedFromReview = false;
        openReview();
    }
}

function navigatePopup(direction) {
    const list = allNames.length > 0 ? allNames : images;
    popupIndex = (popupIndex + direction + list.length) % list.length;
    updatePopup();
}

function updatePopup() {
    const list = allNames.length > 0 ? allNames : images;
    const name = list[popupIndex];
    document.getElementById('popup-img').src = '/api/image/' + encodeURIComponent(name);
    document.getElementById('popup-filename').textContent = name;
    document.getElementById('popup-counter').textContent = (popupIndex + 1) + ' / ' + list.length;
    const btn = document.getElementById('popup-fav-btn');
    if (favorites.has(name)) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
}

function popupKeyHandler(e) {
    if (e.key === 'Escape') closePopup();
    else if (e.key === 'ArrowLeft') navigatePopup(-1);
    else if (e.key === 'ArrowRight') navigatePopup(1);
    else if (e.key === 'f' || e.key === 'F') toggleFavPopup();
}

function onOverlayClick(e) {
    if (e.target === document.getElementById('popup')) closePopup();
}

// ===== Review Panel =====
function openReview() {
    const overlay = document.getElementById('review-overlay');
    const grid = document.getElementById('review-grid');
    const empty = document.getElementById('review-empty');
    overlay.style.display = 'flex';

    document.getElementById('review-count').textContent = favorites.size;

    if (favorites.size === 0) {
        grid.style.display = 'none';
        empty.style.display = 'block';
        return;
    }
    grid.style.display = 'grid';
    empty.style.display = 'none';
    grid.innerHTML = '';

    const favArray = Array.from(favorites);
    favArray.forEach(name => {
        const item = document.createElement('div');
        item.className = 'grid-item';
        item.innerHTML = `
            <img src="/api/thumb/${encodeURIComponent(name)}${cacheBuster}" alt="${escapeHtml(name)}" loading="lazy" onclick="openPopupByName('${escapeJs(name)}')">
            <button class="fav-btn grid-fav active" onclick="event.stopPropagation(); removeFavReview('${escapeJs(name)}')" title="Remove from Favorites">
                <svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </button>
            <div class="img-name">${escapeHtml(name)}</div>
        `;
        grid.appendChild(item);
    });
}

function closeReview() {
    document.getElementById('review-overlay').style.display = 'none';
}

function onReviewOverlayClick(e) {
    if (e.target === document.getElementById('review-overlay')) closeReview();
}

function removeFavReview(name) {
    favorites.delete(name);
    updateFavCount();
    syncGridFavIcon(name);
    openReview(); // re-render review panel
}

function deleteAllFavorites() {
    const names = Array.from(favorites);
    favorites.clear();
    updateFavCount();
    names.forEach(name => syncGridFavIcon(name));
    openReview(); // re-render review panel
}

function openPopupByName(name) {
    const list = allNames.length > 0 ? allNames : images;
    const idx = list.indexOf(name);
    if (idx >= 0) {
        openedFromReview = true;  // track that we came from review panel
        closeReview();
        popupIndex = idx;
        document.getElementById('popup').style.display = 'flex';
        updatePopup();
        document.addEventListener('keydown', popupKeyHandler);
    }
}

// ===== Import =====
async function importFavorites(input) {
    const file = input.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        // Ensure allNames is loaded
        if (allNames.length === 0) {
            const res = await fetch('/api/all-names');
            allNames = await res.json();
        }
        const known = new Set(allNames);
        let count = 0;
        lines.forEach(name => {
            if (known.has(name)) {
                favorites.add(name);
                count++;
            }
        });
        updateFavCount();
        // Sync all grid heart icons
        document.querySelectorAll('.grid-item').forEach(item => {
            const name = item.getAttribute('data-name');
            const btn = item.querySelector('.fav-btn');
            if (favorites.has(name)) btn.classList.add('active');
        });
        showToast(`Imported ${count} of ${lines.length} favorites`);
    } catch (err) {
        showToast('Import failed: ' + err.message);
    }
    input.value = '';
}

// ===== Export =====
async function exportFavorites() {
    if (favorites.size === 0) {
        showToast('No favorites to export.');
        return;
    }
    const content = Array.from(favorites).join('\n');
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: 'favorites.txt',
            types: [{ description: 'Text Files', accept: { 'text/plain': ['.txt'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        showToast(`Exported ${favorites.size} images`);
    } catch (err) {
        if (err.name !== 'AbortError') showToast('Export failed: ' + err.message);
    }
}

// ===== Clear Cache =====
async function clearCache() {
    try {
        const res = await fetch('/api/clear-cache', { method: 'POST' });
        const data = await res.json();
        showToast(data.message);
        // Bust browser cache
        cacheBuster = '?v=' + Date.now();
        // Clear everything
        images = [];
        allNames = [];
        favorites.clear();
        popupIndex = -1;
        currentPage = 0;
        isLoading = false;
        hasMore = true;
        totalImages = 0;
        folderLoaded = false;
        document.getElementById('grid').innerHTML = '';
        document.getElementById('current-folder').textContent = 'No folder selected';
        document.getElementById('folder-picker').style.display = 'flex';
        updateFavCount();
    } catch (err) {
        showToast('Error: ' + err.message);
    }
}

// ===== Toast =====
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// ===== Utils =====
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeJs(str) {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function updateFolderLabel(fullPath) {
    const el = document.getElementById('current-folder');
    // Show drive + ... + last folder name
    const parts = fullPath.replace(/\//g, '\\').split('\\').filter(Boolean);
    let short = fullPath;
    if (parts.length > 2) {
        short = parts[0] + '\\..\\' + parts[parts.length - 1];
    }
    el.textContent = short;
    el.parentElement.title = fullPath;
}
