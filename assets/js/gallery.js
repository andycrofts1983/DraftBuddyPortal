// gallery.js - Gallery page specific functionality

class GalleryManager {
    constructor() {
        this.images = [];
        this.currentIndex = 0;
        this.isAnimating = false;
        this.elements = {};
    }

    async initialize() {
        this.cacheElements();
        await this.loadGallery();
        this.setupKeyboardNavigation();
    }

    cacheElements() {
        this.elements = {
            galleryContent: document.getElementById('gallery-content'),
            selectButton: document.getElementById('select-button')
        };
    }

    async loadGallery() {
        try {
            if (!device.isConnected) {
                this.showConnectionError();
                return;
            }

            const response = await device.apiCall('/api/gallery');
            const data = await response.json();
            
            if (data.images && data.images.length > 0) {
                this.images = data.images;
                await this.renderGallery();
            } else {
                this.showEmptyState();
            }
        } catch (error) {
            console.error('Failed to load gallery:', error);
            if (!device.isConnected) {
                this.showConnectionError();
            } else {
                this.showEmptyState();
            }
        }
    }

    showConnectionError() {
        this.elements.galleryContent.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <p>Device not connected</p>
                <p style="font-size: 14px; opacity: 0.7; margin-top: 10px;">Please check your DraftBuddy connection</p>
            </div>
        `;
        this.elements.selectButton.disabled = true;
    }

    showEmptyState() {
        this.elements.galleryContent.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                </svg>
                <p>No backgrounds uploaded yet</p>
                <p style="font-size: 14px; opacity: 0.7; margin-top: 10px;">Upload your first background to get started</p>
            </div>
        `;
        this.elements.selectButton.disabled = true;
    }

    async renderGallery() {
        this.elements.galleryContent.innerHTML = `
            <div class="nav-arrow left" id="nav-left">‹</div>
            <div class="nav-arrow right" id="nav-right">›</div>
            <div class="coverflow-container">
                <div class="coverflow-track" id="coverflow-track"></div>
            </div>
        `;

        const track = document.getElementById('coverflow-track');
        
        for (let index = 0; index < this.images.length; index++) {
            const image = this.images[index];
            const item = document.createElement('div');
            item.className = 'coverflow-item';
            item.dataset.index = index;
            item.onclick = () => this.selectImage(index);
            
            const img = document.createElement('img');
            img.alt = `Background ${index + 1}`;
            
            // Try to load thumbnail first (120x120)
            const thumbUrl = `/api/thumbnail/${image}`;
            const thumbDataUrl = await loadRGB565Image(thumbUrl, 120, 120);
            
            if (thumbDataUrl) {
                img.src = thumbDataUrl;
            } else {
                // Fallback to full image (480x480) if thumbnail fails
                const fullUrl = `/api/background-raw/${image}`;
                const fullDataUrl = await loadRGB565Image(fullUrl, 480, 480);
                if (fullDataUrl) {
                    img.src = fullDataUrl;
                } else {
                    // Final fallback
                    img.src = './assets/images/logo.png';
                }
            }
            
            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.confirmDelete(image, index);
            };
            
            item.appendChild(img);
            item.appendChild(deleteBtn);
            track.appendChild(item);
        }

        this.updatePositions();
        this.elements.selectButton.disabled = false;
        
        // Set up navigation after DOM is loaded
        document.getElementById('nav-left').onclick = () => this.navigate(-1);
        document.getElementById('nav-right').onclick = () => this.navigate(1);
    }

    updatePositions() {
        const items = document.querySelectorAll('.coverflow-item');
        const total = items.length;
        
        items.forEach((item, index) => {
            item.className = 'coverflow-item';
            
            let relativePos = index - this.currentIndex;
            
            if (relativePos === 0) {
                item.classList.add('center');
            } else if (relativePos === -1) {
                item.classList.add('left-1');
            } else if (relativePos === -2) {
                item.classList.add('left-2');
            } else if (relativePos === -3) {
                item.classList.add('left-3');
            } else if (relativePos === 1) {
                item.classList.add('right-1');
            } else if (relativePos === 2) {
                item.classList.add('right-2');
            } else if (relativePos === 3) {
                item.classList.add('right-3');
            } else {
                // For circular effect at the ends
                if (this.currentIndex === 0 && index === total - 1) {
                    item.classList.add('left-1');
                } else if (this.currentIndex === total - 1 && index === 0) {
                    item.classList.add('right-1');
                } else {
                    item.classList.add('hidden');
                }
            }
        });
    }

    navigate(direction) {
        if (this.isAnimating || this.images.length === 0) return;
        
        this.isAnimating = true;
        
        // Update index with wrapping
        this.currentIndex = this.currentIndex + direction;
        if (this.currentIndex < 0) {
            this.currentIndex = this.images.length - 1;
        } else if (this.currentIndex >= this.images.length) {
            this.currentIndex = 0;
        }
        
        this.updatePositions();
        
        setTimeout(() => {
            this.isAnimating = false;
        }, 500);
    }

    selectImage(index) {
        if (this.isAnimating) return;
        
        if (index !== this.currentIndex) {
            this.currentIndex = index;
            this.updatePositions();
        }
    }

    confirmDelete(filename, index) {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.innerHTML = `
            <h3>Delete Background?</h3>
            <p>Are you sure you want to delete this background image?</p>
            <div class="confirm-buttons">
                <button class="confirm-btn cancel" onclick="galleryManager.closeDialog()">Cancel</button>
                <button class="confirm-btn delete" onclick="galleryManager.deleteBackground('${filename}', ${index})">Delete</button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        this.currentOverlay = overlay;
        
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this.closeDialog();
            }
        };
    }

    closeDialog() {
        if (this.currentOverlay) {
            this.currentOverlay.remove();
            this.currentOverlay = null;
        }
    }

    async deleteBackground(filename, index) {
        this.closeDialog();
        
        const overlay = showOverlay('Deleting Background', 'Please wait...');
        
        try {
            const response = await device.apiCall('/api/delete-background', {
                method: 'POST',
                body: JSON.stringify({ filename: filename })
            });
            
            if (response.ok) {
                // Remove from images array
                this.images.splice(index, 1);
                
                // Adjust current index if needed
                if (this.currentIndex >= this.images.length) {
                    this.currentIndex = this.images.length - 1;
                }
                if (this.currentIndex < 0) {
                    this.currentIndex = 0;
                }
                
                hideOverlay();
                
                // Check if we still have images
                if (this.images.length > 0) {
                    await this.renderGallery();
                } else {
                    // Redirect to upload page if no images left
                    window.location.href = './upload.html';
                }
            } else {
                hideOverlay();
                showError('Failed to delete background');
            }
        } catch (error) {
            console.error('Failed to delete background:', error);
            hideOverlay();
            showError('Failed to delete background');
        }
    }

    async selectCurrentBackground() {
        if (this.images.length === 0 || this.currentIndex < 0 || this.currentIndex >= this.images.length) return;
        
        if (!device.isConnected) {
            showError('Device not connected');
            return;
        }
        
        const selectedImage = this.images[this.currentIndex];
        const overlay = showOverlay('Setting Background', 'Please wait...');
        
        try {
            const response = await device.apiCall('/api/set-background', {
                method: 'POST',
                body: JSON.stringify({ filename: selectedImage })
            });
            
            hideOverlay();
            
            if (response.ok) {
                showSuccess('Background set successfully!');
            } else {
                showError('Failed to set background');
            }
        } catch (error) {
            console.error('Failed to set background:', error);
            hideOverlay();
            showError('Failed to set background');
        }
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.navigate(-1);
            } else if (e.key === 'ArrowRight') {
                this.navigate(1);
            } else if (e.key === 'Enter' && !this.elements.selectButton.disabled) {
                this.selectCurrentBackground();
            }
        });
    }
}

// Global gallery manager instance
let galleryManager;

// Initialize gallery page
function initializeGalleryPage() {
    galleryManager = new GalleryManager();
    galleryManager.initialize();
    
    // Set up select button
    const selectButton = document.getElementById('select-button');
    selectButton.addEventListener('click', () => {
        galleryManager.selectCurrentBackground();
    });
}

// Initialize when DOM loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGalleryPage);
} else {
    initializeGalleryPage();
}