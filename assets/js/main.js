// main.js - Shared utilities for DraftBuddy interface

class DeviceConnection {
    constructor() {
        this.baseUrl = 'http://draftbuddy.local';
        this.isConnected = false;
        this.checkInterval = null;
    }

    async checkConnection() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`${this.baseUrl}/status`, {
                method: 'GET',
                signal: controller.signal,
                cache: 'no-cache'
            });
            
            clearTimeout(timeoutId);
            this.isConnected = response.ok;
            this.updateConnectionStatus();
            return response.ok;
        } catch (error) {
            this.isConnected = false;
            this.updateConnectionStatus();
            return false;
        }
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = this.isConnected ? 'Device Connected' : 'Device Offline';
            statusElement.className = this.isConnected ? 'status connected' : 'status disconnected';
        }
    }

    startMonitoring() {
        this.checkConnection();
        this.checkInterval = setInterval(() => {
            this.checkConnection();
        }, 10000); // Check every 10 seconds
    }

    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    async apiCall(endpoint, options = {}) {
        if (!this.isConnected) {
            throw new Error('Device not connected');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            if (!response.ok) {
                throw new Error(`API call failed: ${response.status}`);
            }
            return response;
        } catch (error) {
            this.isConnected = false;
            this.updateConnectionStatus();
            throw error;
        }
    }
}

// Global utilities
const device = new DeviceConnection();

function showOverlay(title, subtitle = '') {
    const overlay = document.createElement('div');
    overlay.className = 'upload-overlay';
    overlay.id = 'loading-overlay';
    overlay.innerHTML = `
        <div class="overlay-content">
            <div class="logo">
                <img src="./assets/images/logo.png" alt="Logo">
            </div>
            <div class="overlay-box">
                <h1>${title}
                    ${subtitle ? `<span>${subtitle}</span>` : ''}
                </h1>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

function hideOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        document.body.removeChild(overlay);
    }
}

function showError(message, autoReload = true) {
    const container = document.querySelector('.container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="error-message">
            <div class="error-icon">
                <span style="font-size: 34px; line-height: 1; filter: grayscale(1) brightness(10);">⌫</span>
            </div>
            <h1>${message}<br>Please try again</h1>
        </div>
    `;
    
    if (autoReload) {
        setTimeout(() => {
            location.reload();
        }, 3000);
    }
}

function showSuccess(message, autoReload = true) {
    const container = document.querySelector('.container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="success-message">
            <div class="success-icon">
                <span style="font-size: 39px; line-height: 1; font-weight: 900;">✓</span>
            </div>
            <h1>${message}</h1>
        </div>
    `;
    
    if (autoReload) {
        setTimeout(() => {
            location.reload();
        }, 2000);
    }
}

// Convert RGB565 binary data to displayable image
async function loadRGB565Image(url, width, height) {
    try {
        const response = await device.apiCall(url.replace('http://draftbuddy.local', ''));
        const arrayBuffer = await response.arrayBuffer();
        const dataView = new DataView(arrayBuffer);
        
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        
        // Convert RGB565 to RGBA
        for (let i = 0; i < width * height; i++) {
            const rgb565 = dataView.getUint16(i * 2, false); // big-endian
            
            // Extract RGB components
            const r = ((rgb565 >> 11) & 0x1F) << 3; // 5 bits to 8 bits
            const g = ((rgb565 >> 5) & 0x3F) << 2;  // 6 bits to 8 bits
            const b = (rgb565 & 0x1F) << 3;         // 5 bits to 8 bits
            
            // Set pixel data
            imageData.data[i * 4] = r;
            imageData.data[i * 4 + 1] = g;
            imageData.data[i * 4 + 2] = b;
            imageData.data[i * 4 + 3] = 255; // Alpha
        }
        
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL();
    } catch (error) {
        console.error('Failed to load RGB565 image:', error);
        return null;
    }
}

// Initialize device connection on page load
document.addEventListener('DOMContentLoaded', function() {
    device.startMonitoring();
    
    // Add connection status indicator to all pages
    addConnectionStatus();
});

function addConnectionStatus() {
    // Create connection status element if it doesn't exist
    if (!document.getElementById('connection-status')) {
        const statusElement = document.createElement('div');
        statusElement.id = 'connection-status';
        statusElement.className = 'status disconnected';
        statusElement.textContent = 'Checking connection...';
        
        // Add to logo area or container
        const logo = document.querySelector('.logo');
        if (logo) {
            logo.appendChild(statusElement);
        }
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    device.stopMonitoring();
});