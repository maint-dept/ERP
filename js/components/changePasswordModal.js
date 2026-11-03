/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Account Profile & Security Modal Component (Username & Password Management)
 */

import { authService } from '../services/authService.js';
import { state } from '../state.js';

let activeProfileTab = 'PROFILE'; // 'PROFILE' | 'PASSWORD'

export function renderChangePasswordModal() {
  const user = authService.getCurrentUser();
  if (!user) return '';

  const isAdminOrSuperAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || (authService.isAdmin && authService.isAdmin()) || (authService.isSuperAdmin && authService.isSuperAdmin());

  return `
    <div class="modal-overlay" id="modal-change-password-overlay" style="display: flex; align-items: center; justify-content: center; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(8px); z-index: 9999;">
      <div class="modal-dialog" style="width: 480px; max-width: 95vw; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-xl); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7); overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.15);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center; font-size: 18px;">
              👤
            </div>
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #fff; line-height: 1.2;">Account &amp; Profile Settings</div>
              <div style="font-size: 11.5px; color: #e0f2fe; margin-top: 2px;">Manage login username and account security</div>
            </div>
          </div>
          <button id="btn-close-change-pwd-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 18px; padding: 2px 6px;">✕</button>
        </div>

        <!-- Tab Navigation Buttons -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; background: rgba(15, 23, 42, 0.6); border-bottom: 1px solid var(--border-color); padding: 4px 16px;">
          <button type="button" id="tab-btn-profile-info" class="btn btn-sm ${activeProfileTab === 'PROFILE' ? 'btn-primary' : 'btn-ghost'}" style="font-weight: 700; font-size: 12.5px; border-radius: 6px; margin: 4px; ${activeProfileTab === 'PROFILE' ? 'background: #0284c7;' : 'color: #94a3b8;'}">
            👤 Profile &amp; Username
          </button>
          <button type="button" id="tab-btn-password-info" class="btn btn-sm ${activeProfileTab === 'PASSWORD' ? 'btn-primary' : 'btn-ghost'}" style="font-weight: 700; font-size: 12.5px; border-radius: 6px; margin: 4px; ${activeProfileTab === 'PASSWORD' ? 'background: #0284c7;' : 'color: #94a3b8;'}">
            🔑 Change Password
          </button>
        </div>

        <!-- Body Container -->
        <div class="modal-body" style="padding: 22px;">
          
          <!-- Alert Box -->
          <div id="change-pwd-alert" style="display: none; padding: 10px 14px; border-radius: 6px; font-size: 12.5px; margin-bottom: 16px; font-weight: 600;"></div>

          <!-- TAB 1: PROFILE & USERNAME -->
          <div id="section-tab-profile" style="display: ${activeProfileTab === 'PROFILE' ? 'block' : 'none'};">
            
            <!-- Active Account Card -->
            <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div class="user-avatar-circle" style="width: 38px; height: 38px; font-size: 15px;">
                  ${user?.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <div style="font-size: 13.5px; font-weight: 800; color: #fff;">${user.name}</div>
                  <div style="font-size: 11.5px; color: #38bdf8; font-family: var(--font-mono); font-weight: 700;">
                    @${user.username}
                  </div>
                </div>
              </div>
              <span class="badge" style="font-size: 11px; padding: 3px 8px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-weight: 800;">
                ${user.role}
              </span>
            </div>

            <form id="form-update-profile-modal">
              
              <!-- Full Name -->
              <div class="form-group" style="margin-bottom: 14px;">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #cbd5e1;">Full Name <span class="req">*</span></label>
                <input 
                  type="text" 
                  id="inp-profile-fullname" 
                  class="form-control" 
                  value="${user.name || ''}" 
                  required 
                  style="font-size: 13px;"
                />
              </div>

              <!-- Username (Regular users CANNOT change username, Admin/Super Admin can) -->
              <div class="form-group" style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                  <label class="form-label" style="font-size: 12px; font-weight: 700; color: ${isAdminOrSuperAdmin ? '#38bdf8' : '#cbd5e1'}; margin: 0;">
                    Username (Login Identifier)
                  </label>
                  ${!isAdminOrSuperAdmin ? `
                    <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); font-size: 10px; padding: 2px 7px; border-radius: 4px;">
                      🔒 Locked (Read Only)
                    </span>
                  ` : `
                    <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); font-size: 10px; padding: 2px 7px; border-radius: 4px;">
                      ⚡ Admin Editable
                    </span>
                  `}
                </div>
                <div style="position: relative;">
                  <input 
                    type="text" 
                    id="inp-profile-username" 
                    class="form-control" 
                    value="${user.username || ''}" 
                    ${!isAdminOrSuperAdmin ? 'readonly' : 'required'}
                    minlength="3"
                    maxlength="30"
                    placeholder="Enter unique username"
                    style="font-size: 13.5px; font-family: var(--font-mono); font-weight: 700; color: ${isAdminOrSuperAdmin ? '#38bdf8' : '#94a3b8'}; background: ${isAdminOrSuperAdmin ? 'rgba(14, 165, 233, 0.08)' : 'rgba(15, 23, 42, 0.6)'}; border-color: ${isAdminOrSuperAdmin ? 'rgba(56, 189, 248, 0.5)' : 'rgba(255, 255, 255, 0.12)'}; padding-left: 36px !important; ${!isAdminOrSuperAdmin ? 'cursor: not-allowed; user-select: none;' : ''}"
                  />
                  <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 14px; color: ${isAdminOrSuperAdmin ? '#38bdf8' : '#64748b'}; font-weight: 800;">@</span>
                </div>
                <div style="font-size: 11px; color: ${isAdminOrSuperAdmin ? '#94a3b8' : '#f59e0b'}; margin-top: 4px; line-height: 1.3;">
                  ${isAdminOrSuperAdmin 
                    ? '💡 Administrator control: You can update your username here.' 
                    : '🔒 Username cannot be changed by user. Contact System Administrator to request a username change.'}
                </div>
              </div>

              <!-- Email Address (Optional & Verifiable for Forgot Password) -->
              <div class="form-group" style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                  <label class="form-label" style="font-size: 12px; font-weight: 700; color: #cbd5e1; margin: 0;">
                    Email Address <span style="font-size: 11px; color: #94a3b8; font-weight: normal;">(Optional)</span>
                  </label>
                  <div id="email-verification-badge-container" style="display: inline-flex; align-items: center; gap: 5px;">
                    ${user.email ? (
                      user.emailVerified ? `
                        <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 10.5px; padding: 2px 7px;">
                          ✓ Verified
                        </span>
                      ` : `
                        <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); font-size: 10.5px; padding: 2px 7px;">
                          ⚠️ Unverified
                        </span>
                        <button type="button" id="btn-trigger-verify-email" class="btn btn-warning btn-xs" style="padding: 1px 7px; font-size: 10px; font-weight: 700; border-radius: 4px;">
                          Verify Email
                        </button>
                      `
                    ) : `
                      <span style="font-size: 10.5px; color: #64748b;">(Not Configured)</span>
                    `}
                  </div>
                </div>
                <div style="position: relative;">
                  <input 
                    type="email" 
                    id="inp-profile-email" 
                    class="form-control" 
                    value="${user.email || ''}" 
                    placeholder="e.g. employee@al-muslim.com (optional)"
                    style="font-size: 13px; background: rgba(15, 23, 42, 0.85); border: 1.5px solid rgba(255, 255, 255, 0.15); border-radius: 8px; color: #fff; height: 38px;"
                  />
                </div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; line-height: 1.35;">
                  ${user.email && user.emailVerified 
                    ? '<span style="color: #34d399;">✓ This verified email enables self-service password recovery if you forget your password.</span>'
                    : '💡 Email is optional. Adding and verifying your email allows you to recover your password if you ever forget it.'}
                </div>

                <!-- Inline OTP Verification Box -->
                <div id="box-email-verification" style="display: none; background: rgba(15, 23, 42, 0.95); border: 1.5px solid #38bdf8; border-radius: 8px; padding: 12px 14px; margin-top: 10px;">
                  <div style="font-size: 12px; font-weight: 700; color: #38bdf8; margin-bottom: 4px;">
                    📩 Verify Email Address
                  </div>
                  <div style="font-size: 11.5px; color: #cbd5e1; margin-bottom: 8px;" id="lbl-verify-target-msg">
                    Enter the 6-digit OTP code sent to your email:
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <input 
                      type="text" 
                      id="inp-email-verify-otp" 
                      class="form-control" 
                      placeholder="6-digit code" 
                      maxlength="6" 
                      style="width: 120px; text-align: center; font-family: var(--font-mono); font-size: 14px; letter-spacing: 2px; height: 32px;"
                    />
                    <button type="button" id="btn-submit-verify-otp" class="btn btn-primary btn-sm" style="font-weight: 700; height: 32px; padding: 0 12px;">
                      Confirm OTP
                    </button>
                    <button type="button" id="btn-cancel-verify-otp" class="btn btn-secondary btn-sm" style="height: 32px; padding: 0 10px;">
                      Cancel
                    </button>
                  </div>
                  <div id="box-verify-otp-hint" style="font-size: 11px; color: #fbbf24; margin-top: 6px;"></div>
                </div>

              </div>

              <!-- Buttons -->
              <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
                <button type="button" id="btn-cancel-profile-modal" class="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 8px 18px;">
                  💾 Save Profile Settings
                </button>
              </div>

            </form>
          </div>

          <!-- TAB 2: CHANGE PASSWORD -->
          <div id="section-tab-password" style="display: ${activeProfileTab === 'PASSWORD' ? 'block' : 'none'};">
            
            <form id="form-change-password-modal">
              
              <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 14px; background: rgba(56, 189, 248, 0.08); border-left: 3px solid #38bdf8; padding: 8px 12px; border-radius: 4px;">
                Update password for account: <strong>${user.name}</strong> (<code>@${user.username}</code>).
              </div>

              <!-- Current Password -->
              <div class="form-group" style="margin-bottom: 14px;">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #cbd5e1;">Current Password <span class="req">*</span></label>
                <input 
                  type="password" 
                  id="inp-change-current-pwd" 
                  class="form-control" 
                  placeholder="Enter existing password" 
                  required 
                  autocomplete="current-password"
                  style="font-size: 13px;"
                />
              </div>

              <!-- New Password -->
              <div class="form-group" style="margin-bottom: 14px;">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #cbd5e1;">New Password <span class="req">*</span></label>
                <input 
                  type="password" 
                  id="inp-change-new-pwd" 
                  class="form-control" 
                  placeholder="Minimum 4 characters" 
                  required 
                  minlength="4"
                  autocomplete="new-password"
                  style="font-size: 13px;"
                />
              </div>

              <!-- Confirm New Password -->
              <div class="form-group" style="margin-bottom: 18px;">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #cbd5e1;">Confirm New Password <span class="req">*</span></label>
                <input 
                  type="password" 
                  id="inp-change-confirm-pwd" 
                  class="form-control" 
                  placeholder="Re-enter new password" 
                  required 
                  minlength="4"
                  autocomplete="new-password"
                  style="font-size: 13px;"
                />
              </div>

              <!-- Buttons -->
              <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
                <button type="button" id="btn-cancel-pwd-modal" class="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #10b981, #059669); padding: 8px 18px;">
                  🔒 Update Password
                </button>
              </div>

            </form>
          </div>

        </div>

      </div>
    </div>
  `;
}

export function initChangePasswordModalEvents() {
  const overlay = document.getElementById('modal-change-password-overlay');
  const alertBox = document.getElementById('change-pwd-alert');

  const showAlert = (msg, isSuccess = false) => {
    if (!alertBox) return;
    alertBox.style.display = 'block';
    if (isSuccess) {
      alertBox.style.background = 'rgba(16, 185, 129, 0.15)';
      alertBox.style.border = '1px solid rgba(16, 185, 129, 0.4)';
      alertBox.style.color = '#34d399';
      alertBox.textContent = '✅ ' + msg;
    } else {
      alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
      alertBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      alertBox.style.color = '#f87171';
      alertBox.textContent = '⚠️ ' + msg;
    }
  };

  const closeModal = () => {
    state.set('activeModal', null);
  };

  const btnClose = document.getElementById('btn-close-change-pwd-modal');
  if (btnClose) btnClose.addEventListener('click', closeModal);

  const btnCancel1 = document.getElementById('btn-cancel-profile-modal');
  if (btnCancel1) btnCancel1.addEventListener('click', closeModal);

  const btnCancel2 = document.getElementById('btn-cancel-pwd-modal');
  if (btnCancel2) btnCancel2.addEventListener('click', closeModal);

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Tab switching
  const tabProfile = document.getElementById('tab-btn-profile-info');
  const tabPassword = document.getElementById('tab-btn-password-info');
  const secProfile = document.getElementById('section-tab-profile');
  const secPassword = document.getElementById('section-tab-password');

  if (tabProfile && tabPassword && secProfile && secPassword) {
    tabProfile.addEventListener('click', () => {
      activeProfileTab = 'PROFILE';
      secProfile.style.display = 'block';
      secPassword.style.display = 'none';
      tabProfile.style.background = '#0284c7';
      tabProfile.style.color = '#fff';
      tabPassword.style.background = 'none';
      tabPassword.style.color = '#94a3b8';
      if (alertBox) alertBox.style.display = 'none';
    });

    tabPassword.addEventListener('click', () => {
      activeProfileTab = 'PASSWORD';
      secProfile.style.display = 'none';
      secPassword.style.display = 'block';
      tabPassword.style.background = '#0284c7';
      tabPassword.style.color = '#fff';
      tabProfile.style.background = 'none';
      tabProfile.style.color = '#94a3b8';
      if (alertBox) alertBox.style.display = 'none';
    });
  }

  // 1. Submit Profile Update
  const formProfile = document.getElementById('form-update-profile-modal');
  if (formProfile) {
    formProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('inp-profile-fullname')?.value?.trim();
      const usernameInput = document.getElementById('inp-profile-username');
      const email = document.getElementById('inp-profile-email')?.value?.trim() || '';

      const profilePayload = { name, email };
      // Only include username if field is editable (Admin / Super Admin)
      if (usernameInput && !usernameInput.readOnly) {
        const u = usernameInput.value?.trim();
        if (u) profilePayload.username = u;
      }

      const submitBtn = formProfile.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ Saving...'; }

      try {
        const updated = await authService.updateProfile(profilePayload);
        showAlert(`Profile updated successfully!`, true);

        // Update navbar username pill in DOM immediately
        const pillUser = document.querySelector('#btn-navbar-profile-pill span');
        if (pillUser && updated.username) pillUser.textContent = updated.username;

        setTimeout(() => {
          closeModal();
          state.emit('inventory:updated');
        }, 1200);
      } catch (err) {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '💾 Save Profile Settings'; }
        showAlert(err.message || 'Failed to update profile.');
      }
    });
  }

  // 1b. Trigger Email Verification OTP
  const btnTriggerVerify = document.getElementById('btn-trigger-verify-email');
  const boxVerify = document.getElementById('box-email-verification');
  const inpEmail = document.getElementById('inp-profile-email');
  const lblTargetMsg = document.getElementById('lbl-verify-target-msg');
  const otpHint = document.getElementById('box-verify-otp-hint');

  if (btnTriggerVerify) {
    btnTriggerVerify.addEventListener('click', async () => {
      const emailVal = inpEmail?.value?.trim();
      if (!emailVal || !emailVal.includes('@') || !emailVal.includes('.')) {
        showAlert('Please enter a valid email address first.');
        return;
      }
      btnTriggerVerify.disabled = true;
      btnTriggerVerify.textContent = 'Sending...';

      try {
        const res = await authService.sendEmailVerificationOTP(emailVal);
        if (boxVerify) boxVerify.style.display = 'block';
        if (lblTargetMsg) lblTargetMsg.textContent = `A 6-digit verification code has been sent to ${emailVal}:`;
        if (otpHint) {
          otpHint.innerHTML = res.emailSent 
            ? `✓ Code dispatched to ${emailVal}. Please check your inbox and spam folder.` 
            : `💡 Offline/Demo OTP: <strong>${res.otpCode}</strong> (Email server not configured)`;
        }
        showAlert(`Verification code dispatched to ${emailVal}!`, true);
      } catch (err) {
        showAlert(err.message || 'Failed to send verification code.');
      } finally {
        btnTriggerVerify.disabled = false;
        btnTriggerVerify.textContent = 'Verify Email';
      }
    });
  }

  // Cancel OTP box
  document.getElementById('btn-cancel-verify-otp')?.addEventListener('click', () => {
    if (boxVerify) boxVerify.style.display = 'none';
  });

  // Submit OTP Verification
  const btnSubmitVerifyOtp = document.getElementById('btn-submit-verify-otp');
  if (btnSubmitVerifyOtp) {
    btnSubmitVerifyOtp.addEventListener('click', async () => {
      const code = document.getElementById('inp-email-verify-otp')?.value?.trim();
      if (!code || code.length !== 6) {
        showAlert('Please enter the 6-digit verification code.');
        return;
      }
      btnSubmitVerifyOtp.disabled = true;
      btnSubmitVerifyOtp.textContent = 'Verifying...';

      try {
        const updated = await authService.verifyEmailWithOTP(code);
        showAlert(`✅ Email '${updated.email}' successfully verified! Password recovery is now enabled for your account.`, true);
        if (boxVerify) boxVerify.style.display = 'none';

        // Update badge container
        const badgeContainer = document.getElementById('email-verification-badge-container');
        if (badgeContainer) {
          badgeContainer.innerHTML = `
            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 10.5px; padding: 2px 7px;">
              ✓ Verified
            </span>
          `;
        }
      } catch (err) {
        showAlert(err.message || 'Verification failed. Please re-check code.');
      } finally {
        btnSubmitVerifyOtp.disabled = false;
        btnSubmitVerifyOtp.textContent = 'Confirm OTP';
      }
    });
  }

  // 2. Submit Password Change
  const formPassword = document.getElementById('form-change-password-modal');
  if (formPassword) {
    formPassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = document.getElementById('inp-change-current-pwd')?.value;
      const newP = document.getElementById('inp-change-new-pwd')?.value;
      const conf = document.getElementById('inp-change-confirm-pwd')?.value;

      if (newP !== conf) {
        showAlert('New password and confirmation do not match.');
        return;
      }

      const submitBtn = formPassword.querySelector('[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ Saving...'; }

      try {
        await authService.changePassword(cur, newP);
        showAlert('✓ Password updated successfully. For your security, other active device sessions have been automatically logged out.', true);
        setTimeout(() => {
          closeModal();
        }, 1600);
      } catch (err) {
        showAlert(err.message || 'Failed to update password.');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '🔒 Update Password'; }
      }
    });
  }
}
