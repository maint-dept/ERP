/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Dedicated Full-Page Login & Password Recovery Component
 */

import { authService } from '../services/authService.js';
import { emailService } from '../services/emailService.js';
import { state } from '../state.js';

let loginMode = 'LOGIN'; // 'LOGIN' | 'FORGOT_REQUEST' | 'FORGOT_VERIFY' | 'FIRST_LOGIN_CHANGE'
let resetTargetUsername = '';
let resetTargetEmail = '';
let generatedDemoOtp = '';
let pendingFirstLoginUserId = null;

export function renderLoginView() {
  const rememberMe = localStorage.getItem('al_muslim_remember_me') === 'true';
  const savedUsername = localStorage.getItem('al_muslim_saved_username') || '';

  return `
    <div class="login-page-wrapper" style="min-height: 100vh; background: radial-gradient(circle at 50% 20%, #172554 0%, #0b0f19 75%); display: flex; flex-direction: column; justify-content: space-between; font-family: var(--font-main); color: #fff;">
      
      <!-- Top Navigation Ribbon -->
      <div style="padding: 18px 32px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" id="login-nav-home">
          <div style="width: 34px; height: 34px; background: #0284c7; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">
            🔧
          </div>
          <span style="font-weight: 800; font-size: 15px; color: #fff; letter-spacing: 0.5px;">AL-MUSLIM GROUP <span style="color: #38bdf8;">• MAINTENANCE DEPARTMENT ERP</span></span>
        </div>

        <button id="btn-back-to-home" class="btn btn-ghost btn-sm" style="color: #94a3b8; font-size: 13px; display: flex; align-items: center; gap: 6px;">
          <span>←</span>
          <span>Back to Homepage</span>
        </button>
      </div>

      <!-- Main Central Authentication Container -->
      <div style="max-width: 460px; width: 100%; margin: 20px auto 40px; padding: 0 16px;">
        
        <div style="background: rgba(15, 23, 42, 0.88); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 14px; box-shadow: 0 15px 45px rgba(0,0,0,0.65); padding: 32px; backdrop-filter: blur(16px);">
          
          <!-- Card Header -->
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 56px; height: 56px; background: rgba(2, 132, 199, 0.2); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 26px; margin-bottom: 12px; box-shadow: 0 0 20px rgba(2, 132, 199, 0.4);">
              ${loginMode === 'LOGIN' ? '🔐' : (loginMode === 'FIRST_LOGIN_CHANGE' ? '🔑' : '📩')}
            </div>
            <h2 style="font-size: 22px; font-weight: 800; color: #ffffff; margin-bottom: 4px;">
              ${loginMode === 'LOGIN' ? 'Sign in to Maintenance Department ERP' : (loginMode === 'FIRST_LOGIN_CHANGE' ? 'First Login Password Setup' : (loginMode === 'FORGOT_REQUEST' ? 'Password Recovery' : 'Set New Password'))}
            </h2>
            <p style="font-size: 12.5px; color: #94a3b8; line-height: 1.4;">
              ${loginMode === 'LOGIN' ? 'Enter your registered credentials to access machine inventory, transfers, and maintenance logs.' : (loginMode === 'FIRST_LOGIN_CHANGE' ? 'Please configure your permanent private password to enter the system.' : (loginMode === 'FORGOT_REQUEST' ? 'Enter your registered Email address or Username to receive a password reset code.' : `Enter the 6-digit code sent for account '${resetTargetUsername}'.`))}
            </p>
          </div>

          <!-- Role Selection Tabs for Admin vs User -->
          ${loginMode === 'LOGIN' ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; background: rgba(30, 41, 59, 0.6); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
              <button type="button" id="tab-login-admin" class="btn btn-sm" style="font-weight: 700; border-radius: 6px; font-size: 12.5px; background: #0284c7; color: #fff;">
                👑 Admin Login
              </button>
              <button type="button" id="tab-login-user" class="btn btn-sm btn-ghost" style="font-weight: 700; border-radius: 6px; font-size: 12.5px; color: #94a3b8;">
                👤 User Login
              </button>
            </div>
          ` : ''}

          <!-- Alert / Error Display Container -->
          <div id="login-alert-box" style="display: none; padding: 12px 14px; border-radius: 6px; font-size: 12.5px; margin-bottom: 16px; font-weight: 600; line-height: 1.4;"></div>

          <!-- FORM MODE 1: STANDARD LOGIN -->
          ${loginMode === 'LOGIN' ? `
            <form id="form-full-login">
              
              <!-- Username or Email -->
              <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label" style="font-size: 12px; color: #cbd5e1; font-weight: 600;">Email Address or Username</label>
                <div style="position: relative; display: flex; align-items: center;">
                  <span style="position: absolute; left: 14px; font-size: 15px; opacity: 0.8; pointer-events: none; z-index: 5; line-height: 1;">👤</span>
                  <input 
                    type="text" 
                    id="inp-full-username" 
                    class="form-control" 
                    placeholder="Enter username or registered email" 
                    value="${savedUsername || ''}"
                    required 
                    autocomplete="username"
                    style="padding-left: 44px !important; background: rgba(30, 41, 59, 0.8); border-color: rgba(255,255,255,0.15); color: #fff; font-size: 13.5px; height: 42px;"
                  />
                </div>
              </div>

              <!-- Password -->
              <div class="form-group" style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <label class="form-label" style="font-size: 12px; color: #cbd5e1; font-weight: 600; margin: 0;">Password</label>
                  <a href="#" id="link-forgot-password" style="font-size: 11.5px; color: #38bdf8; text-decoration: none; font-weight: 600;">Forgot Password?</a>
                </div>
                <div style="position: relative; display: flex; align-items: center;">
                  <span style="position: absolute; left: 14px; font-size: 15px; opacity: 0.8; pointer-events: none; z-index: 5; line-height: 1;">🔒</span>
                  <input 
                    type="password" 
                    id="inp-full-password" 
                    class="form-control" 
                    placeholder="Enter account password" 
                    value=""
                    required 
                    autocomplete="current-password"
                    style="padding-left: 44px !important; padding-right: 44px !important; background: rgba(30, 41, 59, 0.8); border-color: rgba(255,255,255,0.15); color: #fff; font-size: 13.5px; height: 42px;"
                  />
                  <span id="btn-toggle-pwd-visibility" style="position: absolute; right: 14px; font-size: 15px; cursor: pointer; opacity: 0.7; z-index: 5;" title="Toggle visibility">👁️</span>
                </div>
              </div>

              <!-- Remember Me -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #94a3b8; cursor: pointer; user-select: none;">
                  <input type="checkbox" id="chk-remember-me" ${rememberMe ? 'checked' : ''} style="cursor: pointer;" />
                  <span>Remember my username</span>
                </label>
              </div>

              <!-- Submit Button -->
              <button type="submit" id="btn-submit-full-login" class="btn btn-primary btn-block" style="font-weight: 800; font-size: 14px; padding: 12px; border-radius: 8px; box-shadow: 0 4px 20px rgba(2, 132, 199, 0.5);">
                🔐 Sign In to ERP
              </button>

            </form>
          ` : ''}

          <!-- FORM MODE 2: FIRST-TIME LOGIN PASSWORD SETUP -->
          ${loginMode === 'FIRST_LOGIN_CHANGE' ? `
            <form id="form-first-login-change">
              <div style="background: rgba(245, 158, 11, 0.1); border: 1px dashed rgba(245, 158, 11, 0.4); border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 12px; color: #fbbf24; line-height: 1.4;">
                ⚠️ <strong>Security Notice:</strong> The administrator requires you to set your own password on first login.
              </div>

              <div class="form-group" style="margin-bottom: 14px;">
                <label class="form-label" style="font-size: 12px; color: #cbd5e1; font-weight: 600;">New Password <span class="req">*</span></label>
                <input 
                  type="password" 
                  id="inp-first-login-new-pwd" 
                  class="form-control" 
                  placeholder="Minimum 4 characters" 
                  required 
                  minlength="4"
                  style="background: rgba(30, 41, 59, 0.8); border-color: rgba(255,255,255,0.15); color: #fff;"
                />
              </div>

              <div class="form-group" style="margin-bottom: 20px;">
                <label class="form-label" style="font-size: 12px; color: #cbd5e1; font-weight: 600;">Confirm New Password <span class="req">*</span></label>
                <input 
                  type="password" 
                  id="inp-first-login-confirm-pwd" 
                  class="form-control" 
                  placeholder="Repeat new password" 
                  required 
                  minlength="4"
                  style="background: rgba(30, 41, 59, 0.8); border-color: rgba(255,255,255,0.15); color: #fff;"
                />
              </div>

              <button type="submit" id="btn-submit-first-login-change" class="btn btn-primary btn-block" style="font-weight: 800; padding: 11px; border-radius: 8px; font-size: 13.5px; background: linear-gradient(135deg, #10b981, #059669);">
                💾 Save Password &amp; Enter ERP
              </button>
            </form>
          ` : ''}

          <!-- FORM MODE 3: FORGOT PASSWORD - REQUEST OTP -->
          ${loginMode === 'FORGOT_REQUEST' ? `
            <form id="form-forgot-request">
              <div class="form-group" style="margin-bottom: 20px;">
                <label class="form-label" style="font-size: 12px; color: #cbd5e1; font-weight: 600;">Registered Email Address or Username</label>
                <input 
                  type="text" 
                  id="inp-forgot-identifier" 
                  class="form-control" 
                  placeholder="e.g. rafiqul@al-muslim.com or superadmin" 
                  required 
                  style="background: rgba(30, 41, 59, 0.8); border-color: rgba(255,255,255,0.15); color: #fff; font-size: 13.5px;"
                />
              </div>

              <button type="submit" id="btn-submit-forgot-request" class="btn btn-primary btn-block" style="font-weight: 700; padding: 11px; border-radius: 8px; font-size: 13.5px;">
                📩 Send Password Reset Code
              </button>

              <div style="text-align: center; margin-top: 16px;">
                <a href="#" id="link-back-to-login" style="font-size: 12.5px; color: #94a3b8; text-decoration: none;">← Return to Login</a>
              </div>
            </form>
          ` : ''}

          <!-- FORM MODE 4: FORGOT PASSWORD - VERIFY & SET NEW PASSWORD -->
          ${loginMode === 'FORGOT_VERIFY' ? `
            <form id="form-forgot-verify">
              
              <div style="background: rgba(56, 189, 248, 0.08); border: 1px dashed rgba(56, 189, 248, 0.35); border-radius: 8px; padding: 14px; margin-bottom: 16px; font-size: 12.5px; color: #38bdf8;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-weight: 700; color: #fff;">Account: @${resetTargetUsername}</span>
                  <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 11px; border: 1px solid rgba(16, 185, 129, 0.4);">Verified</span>
                </div>
                <div style="margin-top: 10px; background: rgba(15, 23, 42, 0.7); padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.25); display: flex; align-items: center; justify-content: space-between;">
                  <span style="color: #cbd5e1; font-size: 12px;">🔑 Security Reset Code:</span>
                  <strong style="font-family: monospace; font-size: 17px; color: #38bdf8; letter-spacing: 3px;">${generatedDemoOtp}</strong>
                </div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">
                  Code auto-filled below. Set your new password and sign in directly!
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 14px;">
                <label class="form-label" style="font-size: 12px; color: #cbd5e1; font-weight: 600;">6-Digit Verification Code</label>
                <input 
                  type="text" 
                  id="inp-reset-otp" 
                  class="form-control" 
                  placeholder="Enter 6-digit code" 
                  value="${generatedDemoOtp}"
                  required 
                  maxlength="6"
                  style="font-family: var(--font-mono); letter-spacing: 3px; font-size: 15px; text-align: center; background: rgba(30, 41, 59, 0.8); border-color: rgba(255,255,255,0.15); color: #fff;"
                />
              </div>

              <div class="form-group" style="margin-bottom: 14px;">
                <label class="form-label" style="font-size: 12px; color: #cbd5e1; font-weight: 600;">New Password</label>
                <input 
                  type="password" 
                  id="inp-reset-new-password" 
                  class="form-control" 
                  placeholder="Minimum 4 characters" 
                  required 
                  minlength="4"
                  style="background: rgba(30, 41, 59, 0.8); border-color: rgba(255,255,255,0.15); color: #fff;"
                />
              </div>

              <div class="form-group" style="margin-bottom: 20px;">
                <label class="form-label" style="font-size: 12px; color: #cbd5e1; font-weight: 600;">Confirm New Password</label>
                <input 
                  type="password" 
                  id="inp-reset-confirm-password" 
                  class="form-control" 
                  placeholder="Repeat new password" 
                  required 
                  minlength="4"
                  style="background: rgba(30, 41, 59, 0.8); border-color: rgba(255,255,255,0.15); color: #fff;"
                />
              </div>

              <button type="submit" id="btn-submit-forgot-verify" class="btn btn-primary btn-block" style="font-weight: 700; padding: 11px; border-radius: 8px; font-size: 13.5px;">
                💾 Set Password &amp; Sign In
              </button>

              <div style="text-align: center; margin-top: 16px;">
                <a href="#" id="link-back-to-login-2" style="font-size: 12.5px; color: #94a3b8; text-decoration: none;">← Return to Login</a>
              </div>
            </form>
          ` : ''}

        </div>

      </div>

      <!-- Footer -->
      <div style="text-align: center; padding: 20px; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.06);">
        &copy; 2026 Al-Muslim Group. All rights reserved. Maintenance Department ERP &bull; Version 3.8.5
      </div>

    </div>
  `;
}

export function initLoginViewEvents() {
  const alertBox = document.getElementById('login-alert-box');

  const showAlert = (msg, type = 'danger') => {
    if (alertBox) {
      alertBox.textContent = msg;
      alertBox.style.display = 'block';
      if (type === 'danger') {
        alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
        alertBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
        alertBox.style.color = '#f87171';
      } else if (type === 'warning') {
        alertBox.style.background = 'rgba(245, 158, 11, 0.15)';
        alertBox.style.border = '1px solid rgba(245, 158, 11, 0.4)';
        alertBox.style.color = '#fbbf24';
      } else {
        alertBox.style.background = 'rgba(56, 189, 248, 0.15)';
        alertBox.style.border = '1px solid rgba(56, 189, 248, 0.4)';
        alertBox.style.color = '#38bdf8';
      }
    }
  };

  const hideAlert = () => {
    if (alertBox) {
      alertBox.style.display = 'none';
      alertBox.textContent = '';
    }
  };

  // Toggle Password Visibility
  const toggleBtn = document.getElementById('btn-toggle-pwd-visibility');
  const pwdInput = document.getElementById('inp-full-password');
  if (toggleBtn && pwdInput) {
    toggleBtn.addEventListener('click', () => {
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        toggleBtn.textContent = '🙈';
      } else {
        pwdInput.type = 'password';
        toggleBtn.textContent = '👁️';
      }
    });
  }

  // Back to Homepage Navigation
  document.getElementById('btn-back-to-home')?.addEventListener('click', () => {
    state.set('currentView', 'home');
  });
  document.getElementById('login-nav-home')?.addEventListener('click', () => {
    state.set('currentView', 'home');
  });

  // Admin vs User Tabs
  const tabAdmin = document.getElementById('tab-login-admin');
  const tabUser = document.getElementById('tab-login-user');
  const inpUser = document.getElementById('inp-full-username');
  const inpPwd = document.getElementById('inp-full-password');

  if (tabAdmin && tabUser && inpUser) {
    tabAdmin.addEventListener('click', () => {
      tabAdmin.style.background = '#0284c7';
      tabAdmin.style.color = '#fff';
      tabUser.style.background = 'none';
      tabUser.style.color = '#94a3b8';
      inpUser.placeholder = 'Admin username or email (e.g. admin or superadmin)';
      if (inpPwd) inpPwd.value = '';
    });

    tabUser.addEventListener('click', () => {
      tabUser.style.background = '#0284c7';
      tabUser.style.color = '#fff';
      tabAdmin.style.background = 'none';
      tabAdmin.style.color = '#94a3b8';
      inpUser.placeholder = 'User username or email (e.g. user)';
      if (inpPwd) inpPwd.value = '';
    });
  }

  // Submit Standard Login Form
  const loginForm = document.getElementById('form-full-login');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      hideAlert();

      const username = document.getElementById('inp-full-username')?.value.trim();
      const password = document.getElementById('inp-full-password')?.value;
      const rememberMe = document.getElementById('chk-remember-me')?.checked;

      if (!username || !password) {
        showAlert('Please enter both username/email and password.');
        return;
      }

      try {
        if (rememberMe) {
          localStorage.setItem('al_muslim_remember_me', 'true');
          localStorage.setItem('al_muslim_saved_username', username);
        } else {
          localStorage.removeItem('al_muslim_remember_me');
          localStorage.removeItem('al_muslim_saved_username');
        }

        const res = authService.login(username, password);

        if (res.mustChangePassword) {
          loginMode = 'FIRST_LOGIN_CHANGE';
          pendingFirstLoginUserId = res.user.id;
          state.set('currentView', 'login');
          return;
        }

        state.set('currentView', 'dashboard');
        state.emit('inventory:updated');
      } catch (err) {
        showAlert(err.message || 'Login failed. Please check your credentials.');
      }
    });
  }

  // Submit First Time Login Password Change
  const firstChangeForm = document.getElementById('form-first-login-change');
  if (firstChangeForm && pendingFirstLoginUserId) {
    firstChangeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      hideAlert();

      const newPwd = document.getElementById('inp-first-login-new-pwd')?.value;
      const confirmPwd = document.getElementById('inp-first-login-confirm-pwd')?.value;

      if (newPwd !== confirmPwd) {
        showAlert('Passwords do not match. Please re-enter.');
        return;
      }

      try {
        authService.updateUser(pendingFirstLoginUserId, {
          password: newPwd,
          mustChangePassword: false
        });
        alert('✅ Password configured successfully! Entering ERP dashboard...');
        loginMode = 'LOGIN';
        pendingFirstLoginUserId = null;
        state.set('currentRoute', 'dashboard');
        state.emit('inventory:updated');
      } catch (err) {
        showAlert(err.message || 'Failed to update password.');
      }
    });
  }

  // Switch to Forgot Password Form
  document.getElementById('link-forgot-password')?.addEventListener('click', (e) => {
    e.preventDefault();
    hideAlert();
    loginMode = 'FORGOT_REQUEST';
    state.set('currentRoute', 'login');
  });

  // Back to login links
  const returnToLogin = (e) => {
    e.preventDefault();
    hideAlert();
    loginMode = 'LOGIN';
    state.set('currentRoute', 'login');
  };
  document.getElementById('link-back-to-login')?.addEventListener('click', returnToLogin);
  document.getElementById('link-back-to-login-2')?.addEventListener('click', returnToLogin);

  // Submit Forgot Password Request
  const forgotReqForm = document.getElementById('form-forgot-request');
  if (forgotReqForm) {
    forgotReqForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const identifier = document.getElementById('inp-forgot-identifier')?.value.trim();
      if (!identifier) return;

      try {
        const res = authService.requestPasswordResetOTP(identifier);
        
        // Dispatch email via emailService in background if configured
        if (emailService.isEmailConfigured()) {
          emailService.sendPasswordResetEmail(res.user, res.otpCode).catch(() => {});
        }

        resetTargetUsername = res.user.username;
        resetTargetEmail = res.email;
        generatedDemoOtp = res.otpCode;
        loginMode = 'FORGOT_VERIFY';
        state.set('currentRoute', 'login');
      } catch (err) {
        showAlert(err.message);
      }
    });
  }

  // Submit Verify & Set New Password
  const verifyForm = document.getElementById('form-forgot-verify');
  if (verifyForm) {
    verifyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      hideAlert();

      const otp = document.getElementById('inp-reset-otp')?.value.trim();
      const newPwd = document.getElementById('inp-reset-new-password')?.value;
      const confirmPwd = document.getElementById('inp-reset-confirm-password')?.value;

      if (!otp || !newPwd || !confirmPwd) {
        showAlert('Please fill in all fields.');
        return;
      }

      if (newPwd !== confirmPwd) {
        showAlert('New password and confirm password do not match.');
        return;
      }

      try {
        authService.completePasswordReset(resetTargetUsername, otp, newPwd);
        alert('✅ Password reset successful! You can now sign in with your new password.');
        loginMode = 'LOGIN';
        state.set('currentRoute', 'login');
      } catch (err) {
        showAlert(err.message);
      }
    });
  }
}
