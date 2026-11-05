/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Mobile-First Ergonomic Camera QR & Barcode Scanner Modal Component
 * Optimized for Factory Floor Handheld Smart Phones
 */

let activeScanner = null;
let scanAudio = null;
let isTorchOn = false;

/**
 * Synthesizes specialized audio frequencies & haptic vibration patterns
 * for verified scans, floor mismatches, and duplicate records.
 */
export function playScanBeep(type = 'success') {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;

      if (type === 'error' || type === 'mismatch') {
        // Low Warning Buzz: 260Hz -> 180Hz sawtooth wave (Location Mismatch / Invalid ID)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.28);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
        if (navigator.vibrate) navigator.vibrate([220, 80, 220]);
      } else if (type === 'warning' || type === 'already_scanned') {
        // Neutral Double Chirp: 587Hz triangle wave (Already Scanned in this session)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.14);
        if (navigator.vibrate) navigator.vibrate([90]);
      } else {
        // Crisp High Double-Chime: 880Hz -> 1046Hz sine wave (Machine Verified ✓)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1046, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      }
    }
  } catch (_) {}
}

export function renderQrScannerModal() {
  return `
    <div class="modal-overlay qr-scanner-modal-overlay" id="modal-qr-scanner-overlay" style="z-index: 10050; background: rgba(0, 0, 0, 0.92); backdrop-filter: blur(8px); padding: 0;">
      
      <div class="qr-scanner-modal-card" style="display: flex; flex-direction: column; background: #0b1120; border: 1.5px solid #38bdf8; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.9);">
        
        <!-- Header -->
        <div class="qr-scanner-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.12); background: #0f172a; flex-shrink: 0; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <div style="font-size: 20px; width: 36px; height: 36px; border-radius: 8px; background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              📷
            </div>
            <div style="min-width: 0;">
              <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #fff; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Scan Machine QR Code</h3>
              <div style="font-size: 11px; color: #38bdf8; margin-top: 1px;">Point camera at QR / Barcode tag</div>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <!-- Rapid Multi-Scan Mode Toggle -->
            <button type="button" id="btn-toggle-batch-scan" class="btn btn-sm" style="background: rgba(255,255,255,0.06); border: 1.5px solid rgba(56, 189, 248, 0.4); color: #cbd5e1; border-radius: 20px; font-size: 11px; font-weight: 700; padding: 4px 10px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; transition: all 0.2s ease;" title="Continuous Rapid Scanning Mode (No modal closing on scan)">
              <span id="qr-batch-mode-indicator" style="width: 8px; height: 8px; border-radius: 50%; background: #64748b; display: inline-block;"></span>
              <span id="qr-batch-mode-label">⚡ Rapid Multi-Scan</span>
            </button>

            <button type="button" id="btn-close-qr-scanner" class="btn btn-ghost" style="font-size: 18px; color: #94a3b8; width: 38px; height: 38px; padding: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.06);" aria-label="Close Scanner">
              ✕
            </button>
          </div>
        </div>

        <!-- Camera Viewport Area -->
        <div class="qr-scanner-viewport-wrap" style="position: relative; flex: 1; min-height: 320px; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center;">
          
          <!-- Scanner Container for Html5Qrcode -->
          <div id="qr-reader-container" style="width: 100%; height: 100%; position: absolute; inset: 0;"></div>

          <!-- Camera facing mode badge (indicates Back vs Front camera, can click to toggle) -->
          <button type="button" id="qr-camera-mode-badge" style="position: absolute; top: 12px; z-index: 15; background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(8px); border: 1.5px solid #38bdf8; border-radius: 20px; padding: 6px 14px; font-size: 11.5px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; box-shadow: 0 4px 14px rgba(0,0,0,0.6);" title="Tap to switch camera">
            <span id="qr-camera-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; display: inline-block; box-shadow: 0 0 6px #22c55e;"></span>
            <span id="qr-camera-mode-text">📷 Back Camera (Rear)</span>
            <span style="font-size: 10px; opacity: 0.75; margin-left: 2px;">⇄ Flip</span>
          </button>

          <!-- Batch HUD Live Badge -->
          <div id="qr-batch-hud" style="display: none; position: absolute; top: 52px; z-index: 15; background: rgba(15, 23, 42, 0.94); backdrop-filter: blur(8px); border: 1.5px solid #22c55e; border-radius: 20px; padding: 5px 14px; font-size: 11.5px; font-weight: 800; color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,0.6); align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e;"></span>
            <span>⚡ Rapid Multi-Scan Active &bull; Scanned:</span>
            <span id="qr-batch-count-badge" style="background: #22c55e; color: #000; font-weight: 900; font-family: monospace; padding: 1px 7px; border-radius: 10px; font-size: 11px;">0</span>
          </div>

          <!-- Live Scan Notification Toast -->
          <div id="qr-scan-toast" style="display: none; position: absolute; top: 96px; z-index: 18; background: rgba(34, 197, 94, 0.95); color: #000; font-weight: 800; font-size: 12px; padding: 6px 16px; border-radius: 20px; box-shadow: 0 4px 14px rgba(0,0,0,0.6); pointer-events: none; transition: opacity 0.3s ease;"></div>

          <!-- Crosshair / Aiming Box -->
          <div class="qr-aiming-box" style="position: absolute; width: min(72vw, 250px); height: min(72vw, 250px); border: 2.5px solid #38bdf8; border-radius: 18px; box-shadow: 0 0 0 4000px rgba(0,0,0,0.55); pointer-events: none; display: flex; align-items: center; justify-content: center; transition: border-color 0.15s ease, box-shadow 0.15s ease;">
            <!-- Laser scanning sweep -->
            <div class="qr-scanline" style="position: absolute; width: 92%; height: 3px; background: linear-gradient(90deg, transparent 0%, #38bdf8 20%, #ffffff 50%, #38bdf8 80%, transparent 100%); box-shadow: 0 0 16px 2px #38bdf8, 0 0 4px #fff; border-radius: 2px; animation: qrScanline 2.2s infinite ease-in-out;"></div>
            
            <!-- Corner accent brackets -->
            <div style="position: absolute; top: -3px; left: -3px; width: 18px; height: 18px; border-top: 4px solid #fff; border-left: 4px solid #fff; border-top-left-radius: 8px;"></div>
            <div style="position: absolute; top: -3px; right: -3px; width: 18px; height: 18px; border-top: 4px solid #fff; border-right: 4px solid #fff; border-top-right-radius: 8px;"></div>
            <div style="position: absolute; bottom: -3px; left: -3px; width: 18px; height: 18px; border-bottom: 4px solid #fff; border-left: 4px solid #fff; border-bottom-left-radius: 8px;"></div>
            <div style="position: absolute; bottom: -3px; right: -3px; width: 18px; height: 18px; border-bottom: 4px solid #fff; border-right: 4px solid #fff; border-bottom-right-radius: 8px;"></div>
          </div>

          <!-- Camera Loading Indicator -->
          <div id="qr-camera-loading" style="position: absolute; color: #fff; font-size: 13px; text-align: center; pointer-events: none; z-index: 10;">
            <div style="font-size: 36px; margin-bottom: 10px; animation: spin 2s infinite linear; display: inline-block;">⚙️</div>
            <div style="font-weight: 700; color: #38bdf8;">Initializing Camera Sensor...</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Please grant camera permission if prompted</div>
          </div>

          <!-- Error Alert View -->
          <div id="qr-camera-error" style="display: none; position: absolute; inset: 0; background: rgba(15,23,42,0.96); padding: 24px; text-align: center; flex-direction: column; align-items: center; justify-content: center; gap: 14px; z-index: 20;">
            <div style="font-size: 42px;">📷⚠️</div>
            <div style="color: #f87171; font-weight: 800; font-size: 15px;" id="qr-camera-error-msg">Camera Access Blocked or Not Available</div>
            <div style="color: #cbd5e1; font-size: 12.5px; line-height: 1.5; max-width: 320px;">
              Please grant camera permission in your phone browser, check if another app is using the camera, or tap retry below.
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 8px;">
              <button type="button" id="btn-qr-retry-camera" class="btn btn-primary btn-sm" style="padding: 10px 18px; font-weight: 800; background: #0284c7; border: 1.5px solid #38bdf8; display: inline-flex; align-items: center; gap: 6px;">
                🔄 Tap to Retry
              </button>
              <label class="btn btn-secondary btn-sm" style="cursor: pointer; padding: 10px 16px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                📁 Upload QR Image
                <input type="file" id="file-qr-upload" accept="image/*" style="display: none;" />
              </label>
              <button type="button" id="btn-qr-error-manual" class="btn btn-secondary btn-sm" style="padding: 10px 16px; font-weight: 700;">
                🔎 Manual Search
              </button>
            </div>
          </div>

          <!-- Recent scanned tags horizontal scroll strip -->
          <div id="qr-batch-recent-strip" style="display: none; position: absolute; bottom: 8px; left: 8px; right: 8px; z-index: 15; max-height: 40px; overflow-x: auto; overflow-y: hidden; background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(8px); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 10px; padding: 4px 8px; align-items: center; gap: 6px; white-space: nowrap;">
            <span style="font-size: 10px; font-weight: 700; color: #38bdf8; flex-shrink: 0;">Recent:</span>
            <div id="qr-batch-chips" style="display: flex; gap: 6px; align-items: center;"></div>
          </div>

          <!-- Helpful floor hint pill -->
          <div id="qr-floor-hint" style="position: absolute; bottom: 12px; z-index: 5; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(6px); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 6px 14px; font-size: 11px; color: #cbd5e1; pointer-events: none; text-align: center;">
            💡 Hold phone 6-12 inches away from tag
          </div>
        </div>

        <!-- Camera Controls Bar -->
        <div class="qr-scanner-controls" style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 8px; background: #0f172a; border-top: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
          
          <div style="display: flex; gap: 8px; align-items: center;">
            <!-- Torch / Flashlight Toggle -->
            <button type="button" id="btn-qr-torch" class="btn btn-secondary btn-sm" style="min-height: 42px; min-width: 44px; padding: 6px 12px; font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; gap: 5px;" title="Toggle Flashlight / Torch">
              🔦 <span class="btn-text-torch">Torch</span>
            </button>

            <!-- Flip Camera (Front / Back) -->
            <button type="button" id="btn-qr-switch-camera" class="btn btn-secondary btn-sm" style="min-height: 42px; min-width: 44px; padding: 6px 12px; font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; gap: 5px; border-color: #38bdf8;" title="Switch between Back and Front Camera">
              🔄 <span class="btn-text-flip">Switch to Front</span>
            </button>

            <!-- File Upload -->
            <label class="btn btn-secondary btn-sm" style="min-height: 42px; padding: 6px 12px; font-weight: 700; font-size: 12px; cursor: pointer; margin: 0; display: inline-flex; align-items: center; gap: 5px;" title="Upload QR Photo">
              📁 <span class="btn-text-file">File</span>
              <input type="file" id="file-qr-upload-btn" accept="image/*" style="display: none;" />
            </label>
          </div>

          <div style="display: flex; gap: 8px; align-items: center;">
            <!-- Batch Done Button -->
            <button type="button" id="btn-qr-batch-done" class="btn btn-success btn-sm" style="display: none; min-height: 42px; padding: 6px 14px; font-weight: 800; font-size: 12px; background: #16a34a; border: 1.5px solid #4ade80; color: #fff; border-radius: 8px; align-items: center; gap: 6px;">
              ✓ Done (<span id="qr-batch-btn-count">0</span>)
            </button>

            <!-- Fallback to manual search -->
            <button type="button" id="btn-qr-manual-fallback" class="btn btn-ghost btn-sm" style="min-height: 42px; font-size: 12.5px; color: #38bdf8; font-weight: 800; padding: 6px 12px;">
              🔎 Search
            </button>
          </div>
        </div>

      </div>

    </div>

    </div>

    <style>
      @keyframes qrScanline {
        0% { transform: translateY(-108px); opacity: 0.25; }
        50% { transform: translateY(108px); opacity: 1; }
        100% { transform: translateY(-108px); opacity: 0.25; }
      }

      #qr-reader-container video {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        transform: translateZ(0);
      }
      #qr-reader-container {
        overflow: hidden;
      }
      #qr-shaded-region {
        display: none !important;
      }

      /* Desktop layout */
      .qr-scanner-modal-card {
        width: 95%;
        max-width: 500px;
        border-radius: 16px;
        max-height: 88vh;
      }
      .qr-scanner-viewport-wrap {
        height: 420px;
      }

      /* Mobile layout (<= 640px) */
      @media (max-width: 640px) {
        .qr-scanner-modal-overlay {
          padding: 0 !important;
        }
        .qr-scanner-modal-card {
          width: 100% !important;
          max-width: 100% !important;
          height: 100% !important;
          height: 100dvh !important;
          max-height: 100dvh !important;
          border-radius: 0 !important;
          border: none !important;
        }
        .qr-scanner-viewport-wrap {
          height: auto !important;
          flex: 1 1 auto !important;
        }
        .qr-scanner-controls {
          padding-bottom: max(16px, env(safe-area-inset-bottom, 16px)) !important;
        }
        .qr-scanner-header {
          padding-top: max(12px, env(safe-area-inset-top, 12px)) !important;
        }
      }
    </style>
  `;
}

export async function initQrScannerModalEvents({ onScanSuccess, onManualSearchRequest, onClose, initialBatchMode = false }) {
  const overlay = document.getElementById('modal-qr-scanner-overlay');
  const closeBtn = document.getElementById('btn-close-qr-scanner');
  const loadingEl = document.getElementById('qr-camera-loading');
  const errorEl = document.getElementById('qr-camera-error');
  const errorMsgEl = document.getElementById('qr-camera-error-msg');
  const retryBtn = document.getElementById('btn-qr-retry-camera');
  const flipBtn = document.getElementById('btn-qr-switch-camera');
  const badgeBtn = document.getElementById('qr-camera-mode-badge');
  const torchBtn = document.getElementById('btn-qr-torch');
  const manualBtn = document.getElementById('btn-qr-manual-fallback');
  const errorManualBtn = document.getElementById('btn-qr-error-manual');
  const fileUploadInp = document.getElementById('file-qr-upload');
  const fileUploadBtnInp = document.getElementById('file-qr-upload-btn');
  const toggleBatchBtn = document.getElementById('btn-toggle-batch-scan');
  const doneBatchBtn = document.getElementById('btn-qr-batch-done');
  const batchIndicator = document.getElementById('qr-batch-mode-indicator');
  const batchLabel = document.getElementById('qr-batch-mode-label');
  const batchHud = document.getElementById('qr-batch-hud');
  const batchRecentStrip = document.getElementById('qr-batch-recent-strip');
  const batchCountBadge = document.getElementById('qr-batch-count-badge');
  const batchBtnCount = document.getElementById('qr-batch-btn-count');
  const batchChipsContainer = document.getElementById('qr-batch-chips');
  const scanToast = document.getElementById('qr-scan-toast');
  const floorHint = document.getElementById('qr-floor-hint');

  let isScanningActive = false;
  let isBackFacing = true; // Always default to Rear / Environment Camera
  let isSwitching = false;
  let isBatchMode = Boolean(initialBatchMode);
  const scannedBatchSet = new Set();
  const batchList = [];
  let lastScannedText = '';
  let lastScannedTimestamp = 0;
  isTorchOn = false;

  const updateBatchUI = () => {
    if (isBatchMode) {
      if (batchIndicator) {
        batchIndicator.style.background = '#22c55e';
        batchIndicator.style.boxShadow = '0 0 8px #22c55e';
      }
      if (batchLabel) batchLabel.textContent = '⚡ Batch Mode (ON)';
      if (toggleBatchBtn) {
        toggleBatchBtn.style.background = 'rgba(34, 197, 94, 0.18)';
        toggleBatchBtn.style.borderColor = '#22c55e';
        toggleBatchBtn.style.color = '#4ade80';
      }
      if (batchHud) batchHud.style.display = 'flex';
      if (batchRecentStrip) batchRecentStrip.style.display = 'flex';
      if (doneBatchBtn) doneBatchBtn.style.display = 'inline-flex';
      if (floorHint) floorHint.style.display = 'none';
    } else {
      if (batchIndicator) {
        batchIndicator.style.background = '#64748b';
        batchIndicator.style.boxShadow = 'none';
      }
      if (batchLabel) batchLabel.textContent = '⚡ Rapid Multi-Scan';
      if (toggleBatchBtn) {
        toggleBatchBtn.style.background = 'rgba(255,255,255,0.06)';
        toggleBatchBtn.style.borderColor = 'rgba(56, 189, 248, 0.4)';
        toggleBatchBtn.style.color = '#cbd5e1';
      }
      if (batchHud) batchHud.style.display = 'none';
      if (batchRecentStrip) batchRecentStrip.style.display = 'none';
      if (doneBatchBtn) doneBatchBtn.style.display = 'none';
      if (floorHint) floorHint.style.display = 'block';
    }
  };

  if (toggleBatchBtn) {
    toggleBatchBtn.addEventListener('click', () => {
      isBatchMode = !isBatchMode;
      updateBatchUI();
    });
  }

  // Initial batch UI setup
  updateBatchUI();

  // Thorough, hardware-level media stream and scanner release
  const destroyScanner = async () => {
    if (activeScanner) {
      try {
        if (typeof activeScanner.getState === 'function') {
          const s = activeScanner.getState();
          // Html5QrcodeScannerState: 2 = SCANNING, 3 = PAUSED
          if (s === 2 || s === 3) {
            await activeScanner.stop();
          }
        } else if (isScanningActive) {
          await activeScanner.stop();
        }
      } catch (e) {
        console.warn('Scanner stop notice:', e);
      }
      try {
        activeScanner.clear();
      } catch (_) {}
      activeScanner = null;
    }
    isScanningActive = false;

    // Release all media stream tracks across the DOM to guarantee camera hardware unlocks
    try {
      const videos = document.querySelectorAll('video');
      videos.forEach(v => {
        if (v && v.srcObject && typeof v.srcObject.getTracks === 'function') {
          v.srcObject.getTracks().forEach(track => {
            try { track.stop(); } catch (_) {}
          });
          v.srcObject = null;
        }
      });
    } catch (_) {}
  };

  const closeScannerModal = async () => {
    await destroyScanner();
    if (overlay && overlay.parentNode) {
      overlay.remove();
    }
    if (onClose) onClose();
  };

  if (closeBtn) closeBtn.addEventListener('click', closeScannerModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeScannerModal();
    });
  }

  if (doneBatchBtn) {
    doneBatchBtn.addEventListener('click', async () => {
      await closeScannerModal();
      if (onScanSuccess) {
        onScanSuccess(null, {
          isBatch: true,
          isDone: true,
          count: scannedBatchSet.size,
          items: Array.from(scannedBatchSet)
        });
      }
    });
  }

  const triggerManualFallback = async () => {
    await closeScannerModal();
    if (onManualSearchRequest) onManualSearchRequest();
  };

  if (manualBtn) manualBtn.addEventListener('click', triggerManualFallback);
  if (errorManualBtn) errorManualBtn.addEventListener('click', triggerManualFallback);

  // Handle successful scan
  const handleDecoded = async (decodedText) => {
    if (!decodedText) return;
    const now = Date.now();

    // Debounce duplicate camera trigger within 2000ms
    if (decodedText === lastScannedText && (now - lastScannedTimestamp) < 2000) {
      return;
    }
    lastScannedText = decodedText;
    lastScannedTimestamp = now;

    playScanBeep();

    const aimingBox = document.querySelector('.qr-aiming-box');
    if (aimingBox) {
      aimingBox.style.borderColor = '#22c55e';
      aimingBox.style.boxShadow = '0 0 28px rgba(34, 197, 94, 0.85), 0 0 0 4000px rgba(0,0,0,0.65)';
      setTimeout(() => {
        if (aimingBox) {
          aimingBox.style.borderColor = '#38bdf8';
          aimingBox.style.boxShadow = '0 0 0 4000px rgba(0,0,0,0.55)';
        }
      }, 400);
    }

    if (!isBatchMode) {
      await new Promise(r => setTimeout(r, 120));
      await closeScannerModal();
      if (onScanSuccess) onScanSuccess(decodedText, { isBatch: false });
      return;
    }

    // Rapid Multi-Scan Batch Mode: keep camera running!
    const isDuplicate = scannedBatchSet.has(decodedText);
    if (scanToast) {
      if (isDuplicate) {
        scanToast.style.background = 'rgba(245, 158, 11, 0.95)';
        scanToast.style.color = '#000';
        scanToast.textContent = `⚠️ Already scanned: ${decodedText.length > 20 ? decodedText.substring(0, 20) + '…' : decodedText}`;
      } else {
        scanToast.style.background = 'rgba(34, 197, 94, 0.95)';
        scanToast.style.color = '#000';
        scanToast.textContent = `✓ Scanned: ${decodedText.length > 20 ? decodedText.substring(0, 20) + '…' : decodedText}`;
      }
      scanToast.style.display = 'block';
      clearTimeout(scanToast.__timer);
      scanToast.__timer = setTimeout(() => {
        if (scanToast) scanToast.style.display = 'none';
      }, 1600);
    }

    if (!isDuplicate) {
      scannedBatchSet.add(decodedText);
      batchList.push({ code: decodedText, time: now });

      if (batchCountBadge) batchCountBadge.textContent = scannedBatchSet.size;
      if (batchBtnCount) batchBtnCount.textContent = scannedBatchSet.size;

      if (batchChipsContainer) {
        const chip = document.createElement('span');
        chip.style.cssText = 'background: rgba(34,197,94,0.25); border: 1px solid #22c55e; color: #4ade80; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; display: inline-flex; align-items: center; gap: 4px;';
        chip.textContent = `✓ ${decodedText.length > 14 ? decodedText.substring(0, 14) + '…' : decodedText}`;
        batchChipsContainer.prepend(chip);
      }
    }

    if (onScanSuccess) {
      onScanSuccess(decodedText, {
        isBatch: true,
        isDone: false,
        isDuplicate,
        count: scannedBatchSet.size,
        items: Array.from(scannedBatchSet)
      });
    }
  };

  // Image file QR decoding fallback
  const handleFileUpload = async (file) => {
    if (!file || typeof Html5Qrcode === 'undefined') return;
    try {
      if (loadingEl) {
        loadingEl.style.display = 'block';
        const msg = loadingEl.querySelector('div:nth-child(2)');
        if (msg) msg.textContent = 'Analyzing Photo...';
      }
      await destroyScanner();
      const html5Qr = new Html5Qrcode('qr-reader-container');
      const result = await html5Qr.scanFile(file, true);
      if (result) {
        handleDecoded(result);
      }
    } catch (err) {
      if (loadingEl) loadingEl.style.display = 'none';
      alert('Could not detect QR code in uploaded image: ' + (err.message || 'Unrecognized barcode'));
      // Restart camera after failed image scan
      startCamera(isBackFacing ? 'environment' : 'user');
    }
  };

  if (fileUploadInp) fileUploadInp.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));
  if (fileUploadBtnInp) fileUploadBtnInp.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));

  // Torch / Flashlight Toggle Controller
  if (torchBtn) {
    torchBtn.addEventListener('click', async () => {
      try {
        const videoEl = document.querySelector('#qr-reader-container video');
        if (videoEl && videoEl.srcObject) {
          const track = videoEl.srcObject.getVideoTracks()[0];
          if (track) {
            isTorchOn = !isTorchOn;
            await track.applyConstraints({
              advanced: [{ torch: isTorchOn }]
            });
            torchBtn.style.background = isTorchOn ? '#fbbf24' : '';
            torchBtn.style.color = isTorchOn ? '#000' : '';
            torchBtn.style.borderColor = isTorchOn ? '#f59e0b' : '';
            return;
          }
        }
        if (activeScanner && typeof activeScanner.applyVideoConstraints === 'function') {
          isTorchOn = !isTorchOn;
          await activeScanner.applyVideoConstraints({
            advanced: [{ torch: isTorchOn }]
          });
          torchBtn.style.background = isTorchOn ? '#fbbf24' : '';
          torchBtn.style.color = isTorchOn ? '#000' : '';
        } else {
          alert('Flashlight torch is not supported on this camera/browser.');
        }
      } catch (err) {
        console.warn('Torch toggle not supported:', err);
        alert('Flashlight torch is not available on this camera hardware.');
      }
    });
  }

  const updateCameraUI = (isBack) => {
    const modeText = document.getElementById('qr-camera-mode-text');
    const dot = document.getElementById('qr-camera-dot');
    const flipText = document.querySelector('.btn-text-flip');

    if (isBack) {
      if (modeText) modeText.textContent = '📷 Back Camera (Rear)';
      if (dot) {
        dot.style.background = '#22c55e';
        dot.style.boxShadow = '0 0 6px #22c55e';
      }
      if (flipText) flipText.textContent = 'Switch to Front';
      if (torchBtn) {
        torchBtn.disabled = false;
        torchBtn.style.opacity = '1';
        torchBtn.title = 'Toggle Flashlight / Torch';
      }
    } else {
      if (modeText) modeText.textContent = '🤳 Front Camera';
      if (dot) {
        dot.style.background = '#38bdf8';
        dot.style.boxShadow = '0 0 6px #38bdf8';
      }
      if (flipText) flipText.textContent = 'Switch to Back';
      if (torchBtn) {
        torchBtn.disabled = true;
        torchBtn.style.opacity = '0.45';
        torchBtn.title = 'Torch only available on Back Camera';
      }
    }
  };

  // Helper to ensure Html5Qrcode is loaded on-demand
  const ensureHtml5Qrcode = async () => {
    if (typeof Html5Qrcode !== 'undefined') return true;
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'lib/html5-qrcode.min.js';
      s.async = true;
      s.onload = () => resolve(typeof Html5Qrcode !== 'undefined');
      s.onerror = () => {
        const fb = document.createElement('script');
        fb.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
        fb.async = true;
        fb.onload = () => resolve(typeof Html5Qrcode !== 'undefined');
        fb.onerror = () => resolve(false);
        document.head.appendChild(fb);
      };
      document.head.appendChild(s);
    });
  };

  let isStartingCamera = false;

  // Robust Camera Startup Engine
  const startCamera = async (targetFacing = 'environment') => {
    if (isStartingCamera) return;
    isStartingCamera = true;
    try {
      // 1. Release previous camera cleanly
      await destroyScanner();

      if (typeof Html5Qrcode === 'undefined') {
        if (loadingEl) {
          loadingEl.style.display = 'block';
          const textNode = loadingEl.querySelector('div:nth-child(2)');
          if (textNode) textNode.textContent = 'Loading Camera Engine...';
        }
        const loaded = await ensureHtml5Qrcode();
        if (!loaded || typeof Html5Qrcode === 'undefined') {
          if (loadingEl) loadingEl.style.display = 'none';
          if (errorEl) {
            errorEl.style.display = 'flex';
            errorMsgEl.textContent = 'Camera scanner library not loaded. Please use Manual Search.';
          }
          return;
        }
      }

      if (loadingEl) {
        loadingEl.style.display = 'block';
        const textNode = loadingEl.querySelector('div:nth-child(2)');
        if (textNode) textNode.textContent = targetFacing === 'environment' ? 'Opening Rear Camera...' : 'Opening Front Camera...';
      }
      if (errorEl) errorEl.style.display = 'none';

      // Allow DOM to compute real viewport dimensions
      await new Promise(resolve => setTimeout(resolve, 80));

      const containerEl = document.getElementById('qr-reader-container');
      if (!containerEl) return;

      try {
        activeScanner = new Html5Qrcode('qr-reader-container');

        const config = {
          fps: 20,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minDim = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.max(180, Math.floor(minDim * 0.72));
            return { width: boxSize, height: boxSize };
          }
        };

        // Cascade Strategy:
        // Step A: Standard standard WebRTC mobile facing constraint: { facingMode: "environment" } or "user"
        try {
          await activeScanner.start({ facingMode: targetFacing }, config, handleDecoded, () => {});
        } catch (errA) {
          console.warn(`Direct facingMode ${targetFacing} failed, trying ideal constraint:`, errA);
          // Step B: Ideal facingMode constraint
          try {
            await activeScanner.start({ facingMode: { ideal: targetFacing } }, config, handleDecoded, () => {});
          } catch (errB) {
            console.warn('Ideal constraint failed, querying camera device IDs:', errB);
            // Step C: Specific Camera deviceId
            const cams = await Html5Qrcode.getCameras().catch(() => []);
            if (cams && cams.length > 0) {
              let chosenCam = null;
              if (targetFacing === 'environment') {
                chosenCam = cams.find(c => {
                  const l = (c.label || '').toLowerCase();
                  return l.includes('back') || l.includes('rear') || l.includes('environment');
                }) || cams[cams.length - 1];
              } else {
                chosenCam = cams.find(c => {
                  const l = (c.label || '').toLowerCase();
                  return l.includes('front') || l.includes('user') || l.includes('selfie');
                }) || cams[0];
              }
              await activeScanner.start(chosenCam.id, config, handleDecoded, () => {});
            } else {
              // Step D: Any camera (boolean true)
              await activeScanner.start(true, config, handleDecoded, () => {});
            }
          }
        }

        isScanningActive = true;
        if (loadingEl) loadingEl.style.display = 'none';
        isBackFacing = (targetFacing === 'environment');
        updateCameraUI(isBackFacing);

      } catch (finalErr) {
        console.error('All camera attempts failed:', finalErr);
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) {
          errorEl.style.display = 'flex';
          const msg = (finalErr && finalErr.message) ? finalErr.message : String(finalErr);
          if (errorMsgEl) {
            if (msg.includes('Permission') || msg.includes('NotAllowed')) {
              errorMsgEl.textContent = 'Camera Permission Blocked: Tap the lock icon in your browser address bar to allow camera access.';
            } else if (msg.includes('NotReadable') || msg.includes('busy') || msg.includes('Could not start')) {
              errorMsgEl.textContent = 'Camera Sensor Busy: Tap Retry below or close any background apps using camera.';
            } else {
              errorMsgEl.textContent = 'Camera Sensor Initialization Failed (' + msg.substring(0, 60) + '). Tap Retry below.';
            }
          }
        }
      }
    } finally {
      isStartingCamera = false;
    }
  };

  // Flip Camera Action
  const switchCameraFacing = async () => {
    if (isSwitching) return;
    isSwitching = true;
    try {
      const nextFacing = isBackFacing ? 'user' : 'environment';
      await startCamera(nextFacing);
    } catch (err) {
      console.error('Camera switch error:', err);
    } finally {
      isSwitching = false;
    }
  };

  if (flipBtn) flipBtn.addEventListener('click', switchCameraFacing);
  if (badgeBtn) badgeBtn.addEventListener('click', switchCameraFacing);
  if (retryBtn) retryBtn.addEventListener('click', () => startCamera(isBackFacing ? 'environment' : 'user'));

  // Start with Rear Camera by default
  isBackFacing = true;
  updateCameraUI(true);
  await startCamera('environment');
}
