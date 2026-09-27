/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Mobile-First Ergonomic Camera QR & Barcode Scanner Modal Component
 * Optimized for Factory Floor Handheld Smart Phones
 */

let activeScanner = null;
let scanAudio = null;
let isTorchOn = false;

function playScanBeep() {
  try {
    if (!scanAudio) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.value = 880; // A5 note
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      }
    }
    if (navigator.vibrate) {
      navigator.vibrate([80, 40, 80]);
    }
  } catch (_) {}
}

export function renderQrScannerModal() {
  return `
    <div class="modal-overlay qr-scanner-modal-overlay" id="modal-qr-scanner-overlay" style="z-index: 10050; background: rgba(0, 0, 0, 0.92); backdrop-filter: blur(8px); padding: 0;">
      
      <div class="qr-scanner-modal-card" style="display: flex; flex-direction: column; background: #0b1120; border: 1.5px solid #38bdf8; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.9);">
        
        <!-- Header -->
        <div class="qr-scanner-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.12); background: #0f172a; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 20px; width: 36px; height: 36px; border-radius: 8px; background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; display: flex; align-items: center; justify-content: center;">
              📷
            </div>
            <div>
              <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #fff; line-height: 1.2;">Scan Machine QR Code</h3>
              <div style="font-size: 11px; color: #38bdf8; margin-top: 1px;">Point camera at QR / Barcode tag</div>
            </div>
          </div>
          
          <button type="button" id="btn-close-qr-scanner" class="btn btn-ghost" style="font-size: 18px; color: #94a3b8; width: 42px; height: 42px; padding: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.06);" aria-label="Close Scanner">
            ✕
          </button>
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

          <!-- Crosshair / Aiming Box -->
          <div class="qr-aiming-box" style="position: absolute; width: min(72vw, 250px); height: min(72vw, 250px); border: 2.5px solid #38bdf8; border-radius: 18px; box-shadow: 0 0 0 4000px rgba(0,0,0,0.55); pointer-events: none; display: flex; align-items: center; justify-content: center;">
            <!-- Laser scanning sweep -->
            <div class="qr-scanline" style="width: 90%; height: 2.5px; background: linear-gradient(90deg, transparent, #38bdf8, #67e8f9, #38bdf8, transparent); box-shadow: 0 0 10px #38bdf8; animation: qrScanline 1.8s infinite ease-in-out;"></div>
            
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

          <!-- Helpful floor hint pill -->
          <div style="position: absolute; bottom: 12px; z-index: 5; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(6px); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 6px 14px; font-size: 11px; color: #cbd5e1; pointer-events: none; text-align: center;">
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

          <!-- Fallback to manual search -->
          <button type="button" id="btn-qr-manual-fallback" class="btn btn-ghost btn-sm" style="min-height: 42px; font-size: 12.5px; color: #38bdf8; font-weight: 800; padding: 6px 12px;">
            🔎 Search
          </button>
        </div>

      </div>

    </div>

    <style>
      @keyframes qrScanline {
        0% { transform: translateY(-90px); opacity: 0.2; }
        50% { opacity: 1; }
        100% { transform: translateY(90px); opacity: 0.2; }
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

export async function initQrScannerModalEvents({ onScanSuccess, onManualSearchRequest, onClose }) {
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

  let isScanningActive = false;
  let isBackFacing = true; // Always default to Rear / Environment Camera
  let isSwitching = false;
  isTorchOn = false;

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

  const triggerManualFallback = async () => {
    await closeScannerModal();
    if (onManualSearchRequest) onManualSearchRequest();
  };

  if (manualBtn) manualBtn.addEventListener('click', triggerManualFallback);
  if (errorManualBtn) errorManualBtn.addEventListener('click', triggerManualFallback);

  // Handle successful scan
  const handleDecoded = async (decodedText) => {
    if (!decodedText) return;
    playScanBeep();
    await closeScannerModal();
    if (onScanSuccess) onScanSuccess(decodedText);
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

  // Robust Camera Startup Engine
  const startCamera = async (targetFacing = 'environment') => {
    // 1. Release previous camera cleanly
    await destroyScanner();

    if (typeof Html5Qrcode === 'undefined') {
      if (loadingEl) loadingEl.style.display = 'none';
      if (errorEl) {
        errorEl.style.display = 'flex';
        errorMsgEl.textContent = 'Camera scanner library not loaded. Please use Manual Search.';
      }
      return;
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
