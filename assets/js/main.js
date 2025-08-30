// main.js - DraftBuddy interface with automatic device discovery

class DeviceConnection {
    constructor() {
        this.baseUrl = null;
        this.deviceInfo = null;
        this.isConnected = false;
        this.checkInterval = null;
        this.discoveredDevices = [];
    }

    // NEW: Scan local network for DraftBuddy devices
    async scanForDevices(progressCallback = null) {
        console.log('🔍 Scanning for DraftBuddy devices on local network...');
        
        this.discoveredDevices = [];
        
        // Common home network IP ranges
        const ranges = [
            '192.168.1.',   // Most common
            '192.168.0.',   // Second most common  
            '192.168.2.',   // Some routers
            '10.0.0.',      // Some corporate/advanced setups
            '10.0.1.',      // Alternative
            '172.16.0.'     // Less common but possible
        ];
        
        const totalIPs = ranges.length * 100;
        let scannedIPs = 0;
        
        // Scan all ranges in parallel for speed
        const scanPromises = ranges.map(async (range) => {
            const rangePromises = [];
            
            // Scan IPs 100-199 (most likely for DHCP devices)
            for (let i = 100; i < 200; i++) {
                const ip = `${range}${i}`;
                rangePromises.push(this.checkSingleIP(ip, progressCallback, () => {
                    scannedIPs++;
                    if (progressCallback) {
                        const progress = Math.round((scannedIPs / totalIPs) * 100);
                        progressCallback(progress, scannedIPs, totalIPs);
                    }
                }));
            }
            
            await Promise.all(rangePromises);
        });
        
        await Promise.all(scanPromises);
        
        console.log(`✓ Scan complete: Found ${this.discoveredDevices.length} DraftBuddy device(s)`);
        this.discoveredDevices.forEach((device, index) => {
            console.log(`  Device ${index + 1}: ${device.name} at ${device.ip}`);
        });
        
        return this.discoveredDevices;
    }

    // Check a single IP for DraftBuddy device
    async checkSingleIP(ip, progressCallback, countCallback) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 800); // 800ms timeout
            
            const response = await fetch(`http://${ip}/status`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                
                // Check if this is a DraftBuddy device
                if (data.device && (data.device.includes('DraftBuddy') || data.service === 'draftbuddy')) {
                    const device = {
                        ip: ip,
                        name: data.device || 'DraftBuddy Device',
                        mode: data.mode || 'unknown',
                        uptime: data.uptime || 0,
                        wifi_ssid: data.wifi_ssid || 'unknown',
                        slave_count: data.slave_count || 0,
                        free_heap: data.free_heap || 0,
                        found_at: new Date().toLocaleTimeString()
                    };
                    
                    this.discoveredDevices.push(device);
                    console.log(`✓ Found DraftBuddy at ${ip}: ${device.name}`);
                }
            }
            
        } catch (error) {
            // Expected for most IPs - they won't respond
        } finally {
            if (countCallback) countCallback();
        }
    }

    // NEW: Auto-discover and connect to primary device
    async autoConnect() {
        this.updateConnectionStatus('Scanning for devices...', 'scanning');
        
        try {
            const devices = await this.scanForDevices((progress, scanned, total) => {
                this.updateConnectionStatus(`Scanning network... ${progress}% (${scanned}/${total})`, 'scanning');
            });
            
            if (devices.length === 0) {
                this.updateConnectionStatus('No DraftBuddy devices found', 'disconnected');
                this.isConnected = false;
                return false;
            }
            
            // Connect to the first device found (or prefer masters)
            const primaryDevice = devices.find(d => d.mode === 'service') || devices[0];
            this.baseUrl = `http://${primaryDevice.ip}`;
            this.deviceInfo = primaryDevice;
            
            // Test the connection
            const connected = await this.checkConnection();
            if (connected) {
                this.updateConnectionStatus(`Connected to ${primaryDevice.name} (${primaryDevice.ip})`, 'connected');
                return true;
            } else {
                this.updateConnectionStatus('Failed to connect to discovered device', 'disconnected');
                return false;
            }
            
        } catch (error) {
            console.error('Auto-connect failed:', error);
            this.updateConnectionStatus('Network scan failed', 'disconnected');
            this.isConnected = false;
            return false;
        }
    }

    // UPDATED: Enhanced connection checking
    async checkConnection() {
        if (!this.baseUrl) {
            // No device discovered yet - try auto-connect
            return await this.autoConnect();
        }
        
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
            
            if (this.isConnected && !this.deviceInfo) {
                // Update device info if we don't have it
                const data = await response.json();
                this.deviceInfo = {
                    ip: this.baseUrl.replace('http://', ''),
                    name: data.device || 'DraftBuddy Device',
                    mode: data.mode || 'unknown'
                };
            }
            
            this.updateConnectionStatus();
            return this.isConnected;
        } catch (error) {
            this.isConnected = false;
            this.updateConnectionStatus();
            return false;
        }
    }

    // UPDATED: Enhanced status updates
    updateConnectionStatus(message = null, status = null) {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement) return;
        
        if (message && status) {
            statusElement.textContent = message;
            statusElement.className = `status ${status}`;
        } else {
            // Default status based on connection state
            if (this.isConnected && this.deviceInfo) {
                statusElement.textContent = `Connected to ${this.deviceInfo.name} (${this.deviceInfo.ip})`;
                statusElement.className = 'status connected';
            } else {
                statusElement.textContent = 'Device Offline';
                statusElement.className = 'status disconnected';
            }
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

    // UPDATED: Use discovered device URL
    async apiCall(endpoint, options = {}) {
        if (!this.isConnected || !this.baseUrl) {
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

    // NEW: Get info about discovered devices
    getDiscoveredDevices() {
        return this.discoveredDevices;
    }

    // NEW: Switch to a different discovered device
    async switchToDevice(ip) {
        const device = this.discoveredDevices.find(d => d.ip === ip);
        if (!device) return false;
        
        this.baseUrl = `http://${ip}`;
        this.deviceInfo = device;
        
        const connected = await this.checkConnection();
        if (connected) {
            console.log(`Switched to device: ${device.name} at ${ip}`);
        }
        return connected;
    }
}

// Global utilities (unchanged)
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

// Convert RGB565 binary data to displayable image (unchanged)
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

// Initialize device connection on page load (unchanged)
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

// Cleanup on page unload (unchanged)
window.addEventListener('beforeunload', function() {
    device.stopMonitoring();
});
