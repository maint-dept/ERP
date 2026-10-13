/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Secure Login & User Authentication Modal Component
 */

import { authService } from '../services/authService.js';
import { emailService } from '../services/emailService.js';
import { state } from '../state.js';
import { storage } from '../db/storage.js';

let modalMode = 'LOGIN'; // 'LOGIN' or 'FIRST_PASSWORD_CHANGE'
let pendingUserId = null;

export function renderLoginModal() {
  const activeUser = authService.getCurrentUser();

  return `
    <div class="modal-overlay" id="modal-login-overlay" style="display: flex; align-items: center; justify-content: center; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(8px); z-index: 9999;">
      <div class="modal-card" style="width: 520px; max-width: 95vw; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-xl); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7); overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.15);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center; font-size: 20px;">
              ${modalMode === 'LOGIN' ? '🔐' : '🔑'}
            </div>
            <div>
              <h2 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0; letter-spacing: 0.3px;">
                ${modalMode === 'LOGIN' ? 'User Authentication &amp; Access' : 'First-Time Password Setup'}
              </h2>
              <div style="font-size: 11.5px; color: #e0f2fe; margin-top: 2px;">
                Al-Muslim Group &bull; Industrial Machine &amp; Assets System
              </div>
            </div>
          </div>

          <button type="button" id="btn-close-login-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 18px; padding: 4px 8px;" title="Close">
            ✕
          </button>
        </div>

        <!-- Body -->
        <div style="padding: 24px; display: flex; flex-direction: column; gap: 18px; max-height: 80vh; overflow-y: auto;">
          
          ${modalMode === 'LOGIN' ? `
            <!-- Currently Logged In Banner -->
            <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div class="user-avatar-circle" style="width: 38px; height: 38px; font-size: 15px;">
                  ${activeUser?.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Current Active Session</div>
                  <div style="font-size: 13px; font-weight: 800; color: #fff;">${activeUser?.name || 'Guest'}</div>
                  <div style="font-size: 11px; color: #38bdf8; font-family: var(--font-mono);">${activeUser?.username} &bull; [${activeUser?.role}]</div>
                </div>
              </div>

              <button type="button" id="btn-modal-logout" class="btn btn-danger btn-sm" style="font-size: 11px; padding: 4px 10px;">
                🚪 Logout
              </button>
            </div>

            <!-- Direct Username / Password Form -->
            <form id="form-user-login" style="display: flex; flex-direction: column; gap: 14px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Username or Email <span class="req">*</span></label>
                <input 
                  type="text" 
                  id="login-input-username" 
                  class="form-control" 
                  placeholder="Enter registered username or email" 
                  required 
                  style="font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: #fff;"
                />
              </div>

              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff; margin: 0;">Account Password <span class="req">*</span></label>
                  <a href="#" id="modal-link-forgot-password" style="font-size: 11.5px; color: #38bdf8; text-decoration: none; font-weight: 600;">Forgot Password?</a>
                </div>
                <input 
                  type="password" 
                  id="login-input-password" 
                  class="form-control" 
                  placeholder="••••••••" 
                  required 
                  style="font-size: 13px;"
                />
              </div>

              <div id="login-error-message" style="display: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171;"></div>

              <button type="submit" class="btn btn-primary" style="font-weight: 800; height: 42px; justify-content: center; background: linear-gradient(135deg, #0284c7, #0369a1); font-size: 13.5px; border-radius: 8px;">
                🔐 Sign In to Maintenance ERP
              </button>
            </form>
          ` : `
            <!-- First-Time Password Setup Form -->
            <form id="form-first-password" style="display: flex; flex-direction: column; gap: 14px;">
              <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 12px; font-size: 12px; color: #fbbf24; line-height: 1.4;">
                ⚠️ <strong>First Login Security Notice:</strong> The administrator requires you to set your own secure password before accessing the system.
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">New Password <span class="req">*</span></label>
                <input type="password" id="inp-first-new-password" class="form-control" placeholder="Minimum 4 characters" required minlength="4" />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Confirm New Password <span class="req">*</span></label>
                <input type="password" id="inp-first-confirm-password" class="form-control" placeholder="Repeat new password" required minlength="4" />
              </div>

              <div id="first-pwd-error-message" style="display: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171;"></div>

              <button type="submit" class="btn btn-primary" style="font-weight: 800; height: 42px; justify-content: center; background: linear-gradient(135deg, #10b981, #059669); font-size: 13.5px;">
                💾 Set Password &amp; Enter System
              </button>
            </form>
          `}

          <!-- Security Policy Callout -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px dashed var(--border-color); border-radius: 8px; padding: 10px 14px; font-size: 11px; color: var(--text-muted); line-height: 1.5;">
            🔒 <strong>Access Control Policy:</strong> Only authorized accounts created by the Super Administrator can access the ERP. Permissions are strictly enforced based on your assigned role and individual privileges.
          </div>

        </div>

      </div>
    </div>
  `;
}

export function initLoginModalEvents() {
  const overlay = document.getElementById('modal-login-overlay');
  const closeBtn = document.getElementById('btn-close-login-modal');
  const form = document.getElementById('form-user-login');
  const errBox = document.getElementById('login-error-message');
  const logoutBtn = document.getElementById('btn-modal-logout');

  const closeModal = () => {
    modalMode = 'LOGIN';
    pendingUserId = null;
    state.set('activeModal', null);
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Logout button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      try {
        storage.flushImmediate();
      } catch (_) {}
      authService.logout();
      state.set('activeModal', null);
      state.set('currentRoute', 'login');
    });
  }

  // Forgot Password click
  const forgotLink = document.getElementById('modal-link-forgot-password');
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
      try {
        window.location.hash = '#login';
      } catch (_) {}
      state.set('currentView', 'login');
      state.set('currentRoute', 'login');
    });
  }

  // Submit Login
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('login-input-username')?.value.trim();
      const password = document.getElementById('login-input-password')?.value;

      if (!username || !password) return;

      try {
        if (errBox) errBox.style.display = 'none';
        const res = authService.login(username, password);

        if (res.mustChangePassword) {
          modalMode = 'FIRST_PASSWORD_CHANGE';
          pendingUserId = res.user.id;
          state.set('activeModal', 'login-modal');
          return;
        }

        closeModal();
        state.set('currentRoute', 'dashboard');
        state.emit('inventory:updated');
      } catch (err) {
        if (errBox) {
          errBox.textContent = err.message || 'Login failed. Please check your credentials.';
          errBox.style.display = 'block';
        }
      }
    });
  }

  // First time password change form
  const firstPwdForm = document.getElementById('form-first-password');
  const firstErrBox = document.getElementById('first-pwd-error-message');

  if (firstPwdForm && pendingUserId) {
    firstPwdForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newPwd = document.getElementById('inp-first-new-password')?.value;
      const confirmPwd = document.getElementById('inp-first-confirm-password')?.value;

      if (newPwd !== confirmPwd) {
        if (firstErrBox) {
          firstErrBox.textContent = 'Passwords do not match. Please re-enter.';
          firstErrBox.style.display = 'block';
        }
        return;
      }

      try {
        authService.updateUser(pendingUserId, {
          password: newPwd,
          mustChangePassword: false
        });
        alert('✅ Password set successfully! Entering ERP dashboard...');
        closeModal();
        state.set('currentRoute', 'dashboard');
        state.emit('inventory:updated');
      } catch (err) {
        if (firstErrBox) {
          firstErrBox.textContent = err.message || 'Failed to update password.';
          firstErrBox.style.display = 'block';
        }
      }
    });
  }
}
