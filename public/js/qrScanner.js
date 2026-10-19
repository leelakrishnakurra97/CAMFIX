/**
 * CAMFIX Live Camera QR Code Scanner & Asset Identification Engine
 * Supports Front Camera (user) and Back Camera (environment) stream switching via Html5Qrcode API
 */

const qrScanner = {
  activeAsset: null,
  html5QrCode: null,
  isScanning: false,

  async openScanner() {
    app.openModal('qrScannerModal');
    this.renderSampleQrs();
    // Default to Front Camera stream as requested
    setTimeout(() => {
      this.startCamera('user');
    }, 300);
  },

  async startCamera(facingMode = 'user') {
    try {
      if (this.isScanning && this.html5QrCode) {
        await this.stopCamera();
      }

      if (typeof Html5Qrcode === 'undefined') {
        app.showToast('HTML5 QR Scanner library loading...', 'info');
        return;
      }

      this.html5QrCode = new Html5Qrcode("qrReader");
      this.isScanning = true;

      const config = {
        fps: 10,
        qrbox: { width: 220, height: 220 }
      };

      await this.html5QrCode.start(
        { facingMode: facingMode },
        config,
        (decodedText, decodedResult) => {
          this.onQrCodeScanned(decodedText);
        },
        (errorMessage) => {
          // Scanning in progress...
        }
      );

      app.showToast(`Camera active (${facingMode === 'user' ? 'Front Camera' : 'Back Camera'})`, 'info');
    } catch (err) {
      console.warn('Camera stream notice:', err);
      const qrReader = document.getElementById('qrReader');
      if (qrReader) {
        qrReader.innerHTML = `
          <div style="padding:2rem; text-align:center; color:#ffffff;">
            <strong>Live Camera Permission Required</strong>
            <p style="font-size:0.85rem; margin-top:0.5rem; color:#e2e8f0;">Allow camera access in your browser or select a sample campus QR code below.</p>
          </div>
        `;
      }
    }
  },

  async stopCamera() {
    if (this.html5QrCode && this.isScanning) {
      try {
        await this.html5QrCode.stop();
        this.html5QrCode.clear();
      } catch (err) {
        console.warn('Camera stop notice:', err);
      } finally {
        this.isScanning = false;
        this.html5QrCode = null;
      }
    }
  },

  async onQrCodeScanned(qrCodeText) {
    await this.stopCamera();
    app.closeModal('qrScannerModal');

    // Parse payload if JSON format
    let assetId = qrCodeText.trim();
    try {
      const parsed = JSON.parse(qrCodeText);
      if (parsed.asset_id) assetId = parsed.asset_id;
    } catch (e) {
      // Raw asset string identifier
    }

    app.showToast(`QR Code Scanned: ${assetId}`, 'success');
    await this.processQrScan(assetId);
  },

  async renderSampleQrs() {
    const grid = document.getElementById('sampleQrGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="text-sub">Loading campus asset QRs...</div>';

    try {
      const res = await fetch('/api/assets');
      const data = await res.json();

      if (data.success && data.assets.length > 0) {
        grid.innerHTML = data.assets.map(a => `
          <div class="qr-sample-item" onclick="qrScanner.selectQr('${a.asset_id}')">
            <strong>${a.asset_id}</strong>
            <div>${a.name}</div>
            <small class="text-sub">${a.building_code} • Room ${a.room_number}</small>
          </div>
        `).join('');
      } else {
        grid.innerHTML = '<div class="empty-state">No active asset QRs found</div>';
      }
    } catch (err) {
      grid.innerHTML = '<div class="empty-state">Failed to load asset QRs</div>';
    }
  },

  async selectQr(assetId) {
    await this.stopCamera();
    app.closeModal('qrScannerModal');
    app.showToast(`Identified Asset QR: ${assetId}`, 'info');
    await this.processQrScan(assetId);
  },

  async submitManualQr() {
    const input = document.getElementById('manualQrInput');
    const assetId = input.value.trim();
    if (!assetId) {
      app.showToast('Please enter an Asset ID', 'warning');
      return;
    }
    await this.selectQr(assetId);
    input.value = '';
  },

  async processQrScan(qrCode) {
    try {
      const res = await fetch(`/api/assets/qr/${encodeURIComponent(qrCode)}`);
      const data = await res.json();

      if (data.success) {
        this.activeAsset = data.asset;
        app.showToast(`Asset "${data.asset.name}" identified!`, 'success');
        
        // Launch report modal with auto-populated values
        studentDashboard.openReportModalWithQr(data.asset);
      } else {
        app.showToast(data.error || 'QR code not recognized', 'error');
      }
    } catch (err) {
      app.showToast('Error verifying QR Code', 'error');
    }
  }
};
