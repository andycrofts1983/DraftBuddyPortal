// upload.js - Upload page specific functionality

class SimpleCropper {
    constructor(container, image, viewport) {
        this.container = container;
        this.image = image;
        this.viewport = viewport;
        this.scale = 1;
        this.minScale = 0.1;
        this.maxScale = 1.25; // 25% zoom in max
        this.x = 0;
        this.y = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        
        this.setupEventListeners();
        this.setupZoomControls();
    }
    
    setupEventListeners() {
        // Mouse events
        this.viewport.addEventListener('mousedown', this.startDrag.bind(this));
        document.addEventListener('mousemove', this.drag.bind(this));
        document.addEventListener('mouseup', this.endDrag.bind(this));
        
        // Touch events
        this.viewport.addEventListener('touchstart', this.startDrag.bind(this), {passive: false});
        document.addEventListener('touchmove', this.drag.bind(this), {passive: false});
        document.addEventListener('touchend', this.endDrag.bind(this));
        
        // Wheel zoom
        this.viewport.addEventListener('wheel', this.handleWheel.bind(this), {passive: false});
    }
    
    setupZoomControls() {
        if (!this.sliderElements) {
            this.sliderElements = {
                slider: document.getElementById('zoom-slider'),
                thumb: document.getElementById('zoom-thumb'),
                track: document.getElementById('zoom-track')
            };
            
            this.isDraggingSlider = false;
            this.setupSliderEvents();
        }
        
        this.updateSliderPosition();
    }
    
    setupSliderEvents() {
        const { slider } = this.sliderElements;
        
        const setZoomFromPosition = (rect, clientX) => {
            const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
            const oldScale = this.scale;
            this.scale = this.minScale + (percent / 100) * (this.maxScale - this.minScale);
            
            if (this.scale !== oldScale) {
                const viewportRect = this.viewport.getBoundingClientRect();
                const scaleChange = this.scale / oldScale;
                
                const viewportCenterX = viewportRect.width / 2;
                const viewportCenterY = viewportRect.height / 2;
                
                this.x = viewportCenterX - (viewportCenterX - this.x) * scaleChange;
                this.y = viewportCenterY - (viewportCenterY - this.y) * scaleChange;
                
                const constrainedPos = this.constrainPosition(this.x, this.y);
                this.x = constrainedPos.x;
                this.y = constrainedPos.y;
                
                this.updateImageTransform();
            }
            
            this.updateSliderPosition();
        };
        
        slider.addEventListener('mousedown', (e) => {
            this.isDraggingSlider = true;
            const rect = slider.getBoundingClientRect();
            setZoomFromPosition(rect, e.clientX);
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingSlider) {
                const rect = slider.getBoundingClientRect();
                setZoomFromPosition(rect, e.clientX);
                e.preventDefault();
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.isDraggingSlider = false;
        });
    }
    
    updateSliderPosition() {
        if (!this.sliderElements) return;
        
        const { thumb, track } = this.sliderElements;
        const percent = ((this.scale - this.minScale) / (this.maxScale - this.minScale)) * 100;
        
        track.style.width = Math.max(0, Math.min(100, percent)) + '%';
        thumb.style.left = `calc(${Math.max(0, Math.min(100, percent))}% - 10px)`;
    }
    
    getEventPos(e) {
        if (e.touches && e.touches[0]) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }
    
    startDrag(e) {
        this.isDragging = true;
        const pos = this.getEventPos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;
        e.preventDefault();
    }
    
    drag(e) {
        if (!this.isDragging) return;
        
        const pos = this.getEventPos(e);
        const deltaX = pos.x - this.lastX;
        const deltaY = pos.y - this.lastY;
        
        const newX = this.x + deltaX;
        const newY = this.y + deltaY;
        
        const constrainedPos = this.constrainPosition(newX, newY);
        this.x = constrainedPos.x;
        this.y = constrainedPos.y;
        
        this.lastX = pos.x;
        this.lastY = pos.y;
        
        this.updateImageTransform();
        e.preventDefault();
    }
    
    constrainPosition(x, y) {
        const viewportRect = this.viewport.getBoundingClientRect();
        const scaledWidth = this.image.naturalWidth * this.scale;
        const scaledHeight = this.image.naturalHeight * this.scale;
        
        const minX = viewportRect.width - scaledWidth;
        const maxX = 0;
        const minY = viewportRect.height - scaledHeight;
        const maxY = 0;
        
        const constrainedX = Math.max(minX, Math.min(maxX, x));
        const constrainedY = Math.max(minY, Math.min(maxY, y));
        
        return { x: constrainedX, y: constrainedY };
    }
    
    endDrag(e) {
        this.isDragging = false;
    }
    
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const oldScale = this.scale;
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale + delta));
        
        if (this.scale !== oldScale) {
            const viewportRect = this.viewport.getBoundingClientRect();
            const scaleChange = this.scale / oldScale;
            
            const viewportCenterX = viewportRect.width / 2;
            const viewportCenterY = viewportRect.height / 2;
            
            this.x = viewportCenterX - (viewportCenterX - this.x) * scaleChange;
            this.y = viewportCenterY - (viewportCenterY - this.y) * scaleChange;
            
            const constrainedPos = this.constrainPosition(this.x, this.y);
            this.x = constrainedPos.x;
            this.y = constrainedPos.y;
            
            this.updateImageTransform();
            this.updateSliderPosition();
        }
    }
    
    updateImageTransform() {
        this.image.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
        this.image.style.transformOrigin = '0 0';
    }
    
    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.originalImageSrc = e.target.result;
            this.image.src = this.originalImageSrc;
            this.image.onload = () => {
                this.processImageWithBackground();
            };
        };
        reader.readAsDataURL(file);
    }
    
    processImageWithBackground() {
        if (!this.originalImageSrc) return;
        
        console.log('Processing image with background...');
        
        const tempImg = new Image();
        tempImg.onload = () => {
            console.log('Original image:', tempImg.naturalWidth, 'x', tempImg.naturalHeight);
            
            let width = tempImg.naturalWidth;
            let height = tempImg.naturalHeight;

            if (width > 1500 || height > 1500) {
                const scaleFactor = Math.max(width / 1500, height / 1500);
                width = Math.round(width / scaleFactor);
                height = Math.round(height / scaleFactor);
                console.log('Downscaled to:', width, 'x', height);
            }

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const largestDimension = Math.max(width, height);
            const canvasSize = largestDimension * 2;

            canvas.width = canvasSize;
            canvas.height = canvasSize;
            
            console.log('Canvas size:', canvasSize, 'x', canvasSize);

            const tempCanvas = document.createElement('canvas');
            const tempContext = tempCanvas.getContext('2d');
            tempCanvas.width = width;
            tempCanvas.height = height;

            tempContext.drawImage(tempImg, 0, 0, width, height);
            const imageData = tempContext.getImageData(0, 0, width, height);
            const predominantColor = this.getPredominantColor(imageData.data);
            
            console.log('Predominant color RGB:', `rgb(${predominantColor.r}, ${predominantColor.g}, ${predominantColor.b})`);

            context.fillStyle = `rgb(${predominantColor.r}, ${predominantColor.g}, ${predominantColor.b})`;
            context.fillRect(0, 0, canvas.width, canvas.height);

            const offsetX = (canvasSize - width) / 2;
            const offsetY = (canvasSize - height) / 2;
            console.log('Image offset:', offsetX, ',', offsetY);

            context.drawImage(tempImg, offsetX, offsetY, width, height);

            const newDataUrl = canvas.toDataURL();
            this.originalImageSrc = null;
            
            this.image.onload = () => {
                console.log('Final canvas loaded, natural size:', this.image.naturalWidth, 'x', this.image.naturalHeight);
                this.initializeView();
            };
            this.image.src = newDataUrl;
        };
        
        tempImg.src = this.originalImageSrc;
    }
    
    initializeView() {
        const viewportRect = this.viewport.getBoundingClientRect();
        
        console.log('Initializing view...');
        console.log('Viewport:', viewportRect.width, 'x', viewportRect.height);
        console.log('Image natural:', this.image.naturalWidth, 'x', this.image.naturalHeight);
        
        const scaleX = viewportRect.width / this.image.naturalWidth;
        const scaleY = viewportRect.height / this.image.naturalHeight;
        const fitScale = Math.min(scaleX, scaleY);
        
        console.log('Calculated fit scale:', fitScale);
        
        this.minScale = fitScale;
        this.scale = fitScale;
        
        const scaledWidth = this.image.naturalWidth * this.scale;
        const scaledHeight = this.image.naturalHeight * this.scale;
        
        this.x = (viewportRect.width - scaledWidth) / 2;
        this.y = (viewportRect.height - scaledHeight) / 2;
        
        console.log('Scaled dimensions:', scaledWidth, 'x', scaledHeight);
        console.log('Final position:', this.x, ',', this.y);
        console.log('Scale:', this.scale);
        
        this.updateImageTransform();
        this.setupZoomControls();
    }
    
    getPredominantColor(data) {
        const colorCounts = {};
        let maxCount = 0;
        let predominantColor = { r: 255, g: 255, b: 255 };
        
        for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            if (a < 128 || (r > 240 && g > 240 && b > 240)) {
                continue;
            }
            
            const key = `${r},${g},${b}`;
            colorCounts[key] = (colorCounts[key] || 0) + 1;
            
            if (colorCounts[key] > maxCount) {
                maxCount = colorCounts[key];
                predominantColor = { r, g, b };
            }
        }
        
        if (maxCount === 0) {
            console.log('No predominant color found, using grouped approach');
            return this.getPredominantColorGrouped(data);
        }
        
        return predominantColor;
    }
    
    getPredominantColorGrouped(data) {
        const colorCounts = {};
        let maxCount = 0;
        let predominantColor = { r: 255, g: 255, b: 255 };
        
        for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            const rGroup = Math.floor(r / 8) * 8;
            const gGroup = Math.floor(g / 8) * 8;
            const bGroup = Math.floor(b / 8) * 8;
            
            const key = `${rGroup},${gGroup},${bGroup}`;
            colorCounts[key] = (colorCounts[key] || 0) + 1;
            
            if (colorCounts[key] > maxCount) {
                maxCount = colorCounts[key];
                predominantColor = { r: rGroup, g: gGroup, b: bGroup };
            }
        }
        return predominantColor;
    }
    
    getCroppedImageData() {
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        
        const viewportRect = this.viewport.getBoundingClientRect();
        const imageRect = this.image.getBoundingClientRect();
        
        const scaleRatio = this.image.naturalWidth / (imageRect.width / this.scale);
        const offsetX = -(this.x) * scaleRatio / this.scale;
        const offsetY = -(this.y) * scaleRatio / this.scale;
        const cropSize = viewportRect.width * scaleRatio / this.scale;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.image.naturalWidth;
        tempCanvas.height = this.image.naturalHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.image, 0, 0);
        
        ctx.drawImage(
            tempCanvas,
            offsetX, offsetY, cropSize, cropSize,
            0, 0, 480, 480
        );
        
        return canvas;
    }
}

// Upload page initialization
function initializeUploadPage() {
    const upload = document.getElementById('upload');
    const uploadIcon = document.getElementById('upload-icon');
    const fileNameDisplay = document.getElementById('file-name');
    const cropContainer = document.getElementById('crop-container');
    const cropButton = document.getElementById('crop-button');
    const uploadArea = document.getElementById('upload-area');
    const fileInfo = document.getElementById('file-info');
    const clearFile = document.getElementById('clear-file');
    const cropViewport = document.getElementById('crop-viewport');
    const cropImage = document.getElementById('crop-image');
    
    let cropper = null;

    // Make upload icon clickable
    uploadIcon.addEventListener('click', function() {
        upload.click();
    });

    // Add drag and drop functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        uploadArea.style.borderColor = '#ffffff';
        uploadArea.style.background = 'rgba(255, 255, 255, 0.4)';
    }

    function unhighlight(e) {
        uploadArea.style.borderColor = '#ffffff';
        uploadArea.style.background = 'rgba(255, 255, 255, 0.2)';
    }

    uploadArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    upload.addEventListener('change', function(event) {
        handleFiles(event.target.files);
    });

    function handleFiles(files) {
        const file = files[0];
        if (file && file.type.startsWith('image/')) {
            processFile(file);
        }
    }

    function processFile(file) {
        fileNameDisplay.textContent = file.name;
        uploadArea.classList.add('hidden');
        fileInfo.classList.add('active');
        cropContainer.classList.add('active');
        cropButton.classList.remove('hidden');
        
        // Initialize cropper
        cropper = new SimpleCropper(cropContainer, cropImage, cropViewport);
        cropper.loadImage(file);
    }

    clearFile.addEventListener('click', function() {
        location.reload();
    });

    cropButton.addEventListener('click', async function() {
        if (!cropper) return;
        
        // Check device connection before uploading
        if (!device.isConnected) {
            showError('Device not connected. Please check your DraftBuddy connection.');
            return;
        }
        
        const overlay = showOverlay('Uploading Tap Badge', 'Processing your custom background...');

        try {
            // Get cropped image and convert to JPEG
            const canvas = cropper.getCroppedImageData();
            
            // Convert canvas to JPEG blob for reliable upload
            canvas.toBlob(async function(blob) {
                console.log('Created JPEG blob:', blob.size, 'bytes');
                
                const jpegFile = new File([blob], 'TapBadge.jpg', {
                    type: 'image/jpeg'
                });
                
                const formData = new FormData();
                formData.append('tapImage', jpegFile);

                try {
                    const response = await fetch('http://draftbuddy.local/upload', {
                        method: 'POST',
                        body: formData
                    });
                    
                    hideOverlay();
                    
                    if (response.ok) {
                        console.log('JPEG uploaded successfully');
                        showSuccess('Tap Badge uploaded successfully!');
                    } else {
                        console.log('Failed to upload JPEG');
                        showError('Failed to upload badge');
                    }
                } catch (error) {
                    console.error('Error uploading JPEG:', error);
                    hideOverlay();
                    showError('Connection failed. Please check your device.');
                }
            }, 'image/jpeg', 0.85);
        } catch (error) {
            console.error('Error processing image:', error);
            hideOverlay();
            showError('Failed to process image');
        }
    });
}

// Initialize when DOM loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUploadPage);
} else {
    initializeUploadPage();
}