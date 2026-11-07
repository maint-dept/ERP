/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Dedicated Full-Page Login & Password Recovery Component
 * Premium Cyber-Executive Security Gateway Interface (v4.26.56)
 */

import { authService } from '../services/authService.js?v=4.45.0';
import { emailService } from '../services/emailService.js?v=4.45.0';
import { state } from '../state.js?v=4.45.0';
import { router } from '../services/router.js?v=4.45.0';
import { homepageService } from '../services/homepageService.js?v=4.45.0';

let loginMode = 'LOGIN'; // 'LOGIN' | 'FORGOT_REQUEST' | 'FORGOT_VERIFY' | 'FIRST_LOGIN_CHANGE'
let resetTargetUsername = '';
let resetTargetEmail = '';
let generatedDemoOtp = '';
let pendingFirstLoginUserId = null;
let _currentIsAdminGateway = false;

function getEffectiveHomepageVisibilityMode() {
  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem('al_muslim_homepage_visibility_mode');
      if (cached) return cached;
    }
  } catch (_) {}
  try {
    if (typeof homepageService !== 'undefined' && typeof homepageService.getVisibilityMode === 'function') {
      return homepageService.getVisibilityMode();
    }
  } catch (_) {}
  try {
    if (typeof router !== 'undefined' && typeof router.getEffectiveHomepageVisibilityMode === 'function') {
      return router.getEffectiveHomepageVisibilityMode();
    }
  } catch (_) {}
  return 'login';
}

export function renderLoginView(isAdminGateway = false) {
  _currentIsAdminGateway = Boolean(isAdminGateway);
  const rememberMe = localStorage.getItem('al_muslim_remember_me') === 'true';
  try {
    localStorage.removeItem('al_muslim_saved_username');
  } catch (_) {}

  // Sync mode based on router subtab / URL
  const activeTab = state.get('loginActiveTab') || (typeof router !== 'undefined' && typeof router.getCurrentSubtab === 'function' ? router.getCurrentSubtab(isAdminGateway ? 'admin-login' : 'login') : null);
  const parsed = (typeof router !== 'undefined' && typeof router.parseCurrentRoute === 'function') ? router.parseCurrentRoute() : null;
  const isForgotPath = (activeTab === 'forgot-password' || activeTab === 'forgot') || 
                       (parsed && (parsed.tab === 'forgot-password' || parsed.tab === 'forgot' || parsed.params?.mode === 'forgot'));

  if (isForgotPath) {
    if (loginMode !== 'FORGOT_VERIFY') {
      loginMode = 'FORGOT_REQUEST';
    }
  } else if (loginMode === 'FORGOT_REQUEST' || loginMode === 'FORGOT_VERIFY') {
    loginMode = 'LOGIN';
    resetTargetUsername = '';
    resetTargetEmail = '';
    generatedDemoOtp = '';
  }

  const forgotHref = (typeof router !== 'undefined' && typeof router.buildUrl === 'function')
    ? router.buildUrl(isAdminGateway ? 'admin-login' : 'login', { tab: 'forgot-password' })
    : (isAdminGateway ? '/maint-admin/forgot-password' : '/user/forgot-password');

  const loginHref = (typeof router !== 'undefined' && typeof router.buildUrl === 'function')
    ? router.buildUrl(isAdminGateway ? 'admin-login' : 'login')
    : (isAdminGateway ? '/maint-admin' : '/login');

  const userPortalHref = (typeof router !== 'undefined' && typeof router.buildUrl === 'function')
    ? router.buildUrl('login')
    : '/login';

  const isMaintActive = authService.isMaintenanceModeActive();
  const maintConfig = authService.getMaintenanceModeConfig();

  // Determine Homepage Visibility Mode: 'public' | 'login' | 'maintenance'
  const visibilityMode = getEffectiveHomepageVisibilityMode();
  // Direct Portal mode: active on Admin Gateway OR when mode is 'login' (hides top ribbon on both)
  const isDirectPortal = isAdminGateway || (visibilityMode === 'login');

  // Page background: Cyber-emerald obsidian for Admin Gateway, deep navy for User Portal
  const pageBg = isAdminGateway
    ? 'radial-gradient(circle at 50% 12%, #064e3b 0%, #03201a 30%, #020b12 70%, #010408 100%)'
    : 'radial-gradient(circle at 50% 15%, #1e3a8a 0%, #0f172a 50%, #030712 100%)';

  const accentColor = isAdminGateway ? '#10b981' : '#0284c7';
  const accentLight = isAdminGateway ? '#34d399' : '#38bdf8';
  const cardBorder = '1px solid rgba(255, 255, 255, 0.1)';

  return `
    <style>
      .gateway-card {
        background: rgba(11, 18, 30, 0.92) !important;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: ${cardBorder} !important;
        border-radius: 16px !important;
        box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.08) !important;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      .gateway-card:hover {
        border-color: rgba(255, 255, 255, 0.15) !important;
        box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(255, 255, 255, 0.12) !important;
      }

      .gateway-icon-box {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
      }

      .gateway-input-box {
        position: relative;
        display: flex;
        align-items: center;
        transition: all 0.2s ease;
      }

      .gateway-input-box input:focus {
        border-color: ${accentColor} !important;
        box-shadow: 0 0 0 2px ${isAdminGateway ? 'rgba(16, 185, 129, 0.25)' : 'rgba(2, 132, 199, 0.25)'} !important;
        background: rgba(15, 23, 42, 0.95) !important;
      }

      .gateway-submit-btn {
        background: ${isAdminGateway 
          ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' 
          : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'} !important;
        transition: all 0.2s ease !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
      }

      .gateway-submit-btn:hover {
        transform: translateY(-1px);
        filter: brightness(1.08);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
      }

      .gateway-submit-btn:active {
        transform: translateY(0);
      }

      .login-page-wrapper {
        height: 100vh;
        height: 100dvh;
        max-height: 100vh;
        max-height: 100dvh;
        overflow: hidden;
      }

      @media (max-height: 520px) {
        .login-page-wrapper {
          height: auto !important;
          min-height: 100vh !important;
          max-height: none !important;
          overflow-y: auto !important;
        }
      }
    </style>

    <div class="login-page-wrapper" style="height: 100vh; height: 100dvh; max-height: 100vh; max-height: 100dvh; background: ${pageBg}; background-color: #040911; background-image: radial-gradient(${isAdminGateway ? 'rgba(16, 185, 129, 0.08)' : 'rgba(56, 189, 248, 0.08)'} 1px, transparent 1px); background-size: 28px 28px; display: flex; flex-direction: column; justify-content: space-between; font-family: var(--font-main); color: #fff; position: relative; overflow: hidden;">
      
      <!-- Subtle Ambient Background Accents -->
      <div style="position: absolute; top: -140px; left: 15%; width: 500px; height: 500px; border-radius: 50%; background: radial-gradient(circle, ${isAdminGateway ? 'rgba(16, 185, 129, 0.06)' : 'rgba(2, 132, 199, 0.07)'} 0%, transparent 70%); filter: blur(90px); pointer-events: none; z-index: 0;"></div>
      <div style="position: absolute; bottom: -100px; right: 12%; width: 550px; height: 550px; border-radius: 50%; background: radial-gradient(circle, ${isAdminGateway ? 'rgba(14, 165, 233, 0.05)' : 'rgba(99, 102, 241, 0.06)'} 0%, transparent 70%); filter: blur(90px); pointer-events: none; z-index: 0;"></div>

      ${!isDirectPortal ? `
        <!-- Top Executive Navigation Ribbon -->
        <header style="padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 10; border-bottom: 1px solid rgba(255, 255, 255, 0.07); background: rgba(5, 10, 18, 0.75); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 14px; cursor: pointer;" id="login-nav-home">
            <div style="width: 36px; height: 36px; background: ${isAdminGateway ? 'linear-gradient(135deg, #059669, #0284c7)' : 'linear-gradient(135deg, #0284c7, #1d4ed8)'}; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 0 20px ${isAdminGateway ? 'rgba(16, 185, 129, 0.4)' : 'rgba(2, 132, 199, 0.4)'}; border: 1px solid rgba(255, 255, 255, 0.2);">
              ${isAdminGateway ? '🛡️' : '🔧'}
            </div>
            <div style="display: flex; flex-direction: column;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 800; font-size: 14px; color: #fff; letter-spacing: 0.8px;">AL-MUSLIM GROUP</span>
                <span class="badge" style="font-size: 9.5px; font-weight: 800; background: ${isAdminGateway ? 'rgba(16, 185, 129, 0.2)' : 'rgba(2, 132, 199, 0.2)'}; color: ${accentLight}; border: 1px solid ${isAdminGateway ? 'rgba(16, 185, 129, 0.4)' : 'rgba(2, 132, 199, 0.4)'}; padding: 2px 7px; border-radius: 10px; display: inline-flex; align-items: center; gap: 5px;">
                  <span style="width: 5px; height: 5px; border-radius: 50%; background: ${accentLight}; display: inline-block; animation: pulseDot 2s infinite;"></span>
                  ${isAdminGateway ? 'ADMIN PORTAL' : 'USER PORTAL'}
                </span>
              </div>
              <span style="font-size: 10.5px; color: #94a3b8; font-weight: 600;">
                Information Management &amp; Control System
              </span>
            </div>
          </div>

          ${visibilityMode === 'public' ? `
            <button id="btn-back-to-home" class="btn btn-ghost btn-sm" style="color: #cbd5e1; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255, 255, 255, 0.12); padding: 5px 12px; border-radius: 7px; transition: all 0.2s ease;">
              <span>←</span>
              <span>Public Homepage</span>
            </button>
          ` : ''}
        </header>
      ` : ''}

      <!-- Main Central Authentication Container -->
      <main style="max-width: 440px; width: 100%; margin: auto; padding: 12px 16px; position: relative; z-index: 5;">
        
        <div class="gateway-card" style="padding: 24px 24px;">
          
          <!-- Card Header -->
          <div style="text-align: center; margin-bottom: 18px;">
            <div class="gateway-icon-box" style="width: 52px; height: 52px; background: linear-gradient(135deg, ${isAdminGateway ? 'rgba(16, 185, 129, 0.2), rgba(2, 132, 199, 0.15)' : 'rgba(2, 132, 199, 0.25), rgba(99, 102, 241, 0.15)'}); border: 1.5px solid ${isAdminGateway ? 'rgba(16, 185, 129, 0.55)' : 'rgba(56, 189, 248, 0.55)'}; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 10px;">
              ${loginMode === 'LOGIN' ? (isAdminGateway ? '🛡️' : '👤') : (loginMode === 'FIRST_LOGIN_CHANGE' ? '🔑' : '📩')}
            </div>

            <h2 style="font-size: 21px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; margin: 0 0 ${(loginMode === 'LOGIN' && !isAdminGateway) ? '0' : '4px'} 0;">
              ${loginMode === 'LOGIN' 
                ? (isAdminGateway ? 'Administrator Login' : 'User Login') 
                : (loginMode === 'FIRST_LOGIN_CHANGE' ? 'First Login Password Setup' : (loginMode === 'FORGOT_REQUEST' ? 'Forgot Password' : 'Set New Password'))}
            </h2>
            ${(loginMode === 'LOGIN' && !isAdminGateway) ? '' : `
            <p style="font-size: 12.5px; color: #94a3b8; line-height: 1.4; margin: 0;">
              ${loginMode === 'LOGIN' 
                ? 'Enter your administrative credentials to continue.' 
                : (loginMode === 'FIRST_LOGIN_CHANGE' ? 'Please configure your permanent private password to enter the system.' : (loginMode === 'FORGOT_REQUEST' ? 'Enter your registered Email address or Username to receive a password reset code.' : `Enter the 6-digit code sent for account '${resetTargetUsername}'.`))}
            </p>`}
          </div>

          <!-- Maintenance Mode Notification Box -->
          ${isMaintActive ? `
            <div style="background: rgba(245, 158, 11, 0.15); border: 1.5px solid rgba(245, 158, 11, 0.5); border-radius: 10px; padding: 12px 14px; margin-bottom: 18px; font-size: 12px; color: #fbbf24; line-height: 1.45;">
              <div style="font-weight: 800; font-size: 12.5px; display: flex; align-items: center; gap: 6px; margin-bottom: 4px; color: #fef08a;">
                <span>🛠️</span> System Maintenance Mode Active
              </div>
              <div style="color: #fef9c3;">
                ${maintConfig.message || 'Routine maintenance is in progress.'}
              </div>
              ${maintConfig.estimatedEnd ? `
                <div style="margin-top: 5px; font-size: 11.5px; color: #fde68a;">
                  ⏳ Expected completion: <strong>${maintConfig.estimatedEnd}</strong>
                </div>
              ` : ''}
              ${isAdminGateway ? `
                <div style="margin-top: 6px; font-size: 11px; color: #86efac; border-top: 1px dashed rgba(245, 158, 11, 0.3); padding-top: 5px;">
                  ✓ Admin bypass authenticated. You can log in to manage system updates.
                </div>
              ` : `
                <div style="margin-top: 6px; font-size: 11px; color: #cbd5e1; border-top: 1px dashed rgba(245, 158, 11, 0.3); padding-top: 5px;">
                  General user access is temporarily disabled during scheduled maintenance.
                </div>
              `}
            </div>
          ` : ''}

          <!-- Alert / Error Display Container -->
          <div id="login-alert-box" style="display: none; padding: 12px 14px; border-radius: 8px; font-size: 12.5px; margin-bottom: 16px; font-weight: 600; line-height: 1.45;"></div>

          <!-- FORM MODE 1: STANDARD LOGIN (Essential fields only) -->
          ${loginMode === 'LOGIN' ? `
            <form id="form-full-login">
              
              <!-- Username or Email -->
              <div class="form-group" style="margin-bottom: 13px;">
                <label class="form-label" style="font-size: 12px; color: #e2e8f0; font-weight: 700; display: block; margin-bottom: 5px;">
                  ${isAdminGateway ? 'Username or Email' : 'Employee ID, Username, or Email'}
                </label>
                <div class="gateway-input-box">
                  <span style="position: absolute; left: 14px; font-size: 15px; opacity: 0.85; pointer-events: none; z-index: 5;">
                    ${isAdminGateway ? '🛡️' : '👤'}
                  </span>
                  <input 
                    type="text" 
                    id="inp-full-username" 
                    class="form-control" 
                    placeholder="${isAdminGateway ? 'Enter administrator username or email' : 'Employee ID, username, or email'}" 
                    value=""
                    required 
                    autocomplete="username"
                    style="padding-left: 42px !important; background: rgba(15, 23, 42, 0.85); border: 1.5px solid ${isAdminGateway ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.25)'}; border-radius: 9px; color: #fff; font-size: 13px; height: 42px; font-weight: 600;"
                  />
                </div>
              </div>

              <!-- Password -->
              <div class="form-group" style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                  <label class="form-label" style="font-size: 12px; color: #e2e8f0; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px;">
                    <span>Password</span>
                    <span id="caps-lock-warning" style="display: none; font-size: 10.5px; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); padding: 1px 6px; border-radius: 4px; font-weight: 700;">
                      ⚠️ Caps Lock is ON
                    </span>
                  </label>
                  <a href="${forgotHref}" id="link-forgot-password" style="font-size: 12px; color: ${accentLight}; text-decoration: none; font-weight: 700;">Forgot Password?</a>
                </div>
                <div class="gateway-input-box">
                  <span style="position: absolute; left: 14px; font-size: 15px; opacity: 0.85; pointer-events: none; z-index: 5;">🔒</span>
                  <input 
                    type="password" 
                    id="inp-full-password" 
                    class="form-control" 
                    placeholder="Enter your password" 
                    value=""
                    required 
                    autocomplete="current-password"
                    style="padding-left: 42px !important; padding-right: 46px !important; background: rgba(15, 23, 42, 0.85); border: 1.5px solid ${isAdminGateway ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.25)'}; border-radius: 9px; color: #fff; font-size: 13px; height: 42px;"
                  />
                  <button type="button" id="btn-toggle-pwd-visibility" style="position: absolute; right: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 3px 7px; cursor: pointer; color: #94a3b8; font-size: 13px; transition: all 0.2s;" title="Toggle Password Visibility">
                    👁️
                  </button>
                </div>
              </div>

              <!-- Remember Me -->
              <div style="display: flex; justify-content: flex-start; align-items: center; margin: 10px 0 16px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #cbd5e1; cursor: pointer; user-select: none;">
                  <input type="checkbox" id="chk-remember-me" ${rememberMe ? 'checked' : ''} style="width: 15px; height: 15px; accent-color: ${accentColor}; cursor: pointer;" />
                  <span>Remember me</span>
                </label>
              </div>

              <!-- Submit Button -->
              <button type="submit" id="btn-submit-full-login" class="gateway-submit-btn btn btn-primary btn-block" style="font-weight: 800; font-size: 14px; padding: 11px; border-radius: 9px; letter-spacing: 0.3px; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; cursor: pointer;">
                <span>${isAdminGateway ? 'Login as Admin' : 'Sign In'}</span>
                <span>➔</span>
              </button>

            </form>

            <!-- Bottom Gateway Switcher (Shown ONLY on Admin Gateway) -->
            ${isAdminGateway ? `
              <div style="text-align: center; margin-top: 14px; font-size: 12px; color: #94a3b8;">
                <span>General factory user? </span>
                <a href="${userPortalHref}" id="link-switch-to-user-portal" style="color: #38bdf8; text-decoration: none; font-weight: 700;">Sign in to User Portal</a>
              </div>
            ` : ''}

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
                  style="background: rgba(15, 23, 42, 0.85); border: 1.5px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; height: 42px;"
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
                  style="background: rgba(15, 23, 42, 0.85); border: 1.5px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; height: 42px;"
                />
              </div>

              <button type="submit" id="btn-submit-first-login-change" class="gateway-submit-btn btn btn-primary btn-block" style="font-weight: 800; padding: 11px; border-radius: 8px; font-size: 13.5px; width: 100%;">
                💾 Save Password &amp; Enter System
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
                  placeholder="e.g. motaher, superadmin, or rafiqul@al-muslim.com" 
                  required 
                  style="background: rgba(15, 23, 42, 0.85); border: 1.5px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; font-size: 13.5px; height: 44px;"
                />
              </div>

              <button type="submit" id="btn-submit-forgot-request" class="gateway-submit-btn btn btn-primary btn-block" style="font-weight: 700; padding: 11px; border-radius: 8px; font-size: 13.5px; width: 100%;">
                📩 Send Password Reset Code
              </button>

              <div style="text-align: center; margin-top: 16px;">
                <a href="${loginHref}" id="link-back-to-login" style="font-size: 12.5px; color: #94a3b8; text-decoration: none;">← Return to Login</a>
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
                  <span style="font-size: 12px; color: #94a3b8;">Demo Verification OTP:</span>
                  <strong style="font-family: var(--font-mono); font-size: 15px; color: #38bdf8; letter-spacing: 2px;">${generatedDemoOtp}</strong>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 14px;">
                <label class="form-label" style="font-size: 12px; color: #cbd5e1; font-weight: 600;">6-Digit Verification Code <span class="req">*</span></label>
                <input 
                  type="text" 
                  id="inp-reset-otp" 
                  class="form-control" 
                  placeholder="Enter 6-digit OTP code" 
                  required 
                  maxlength="6"
                  style="font-family: var(--font-mono); font-size: 16px; letter-spacing: 3px; text-align: center; background: rgba(15, 23, 42, 0.85); border: 1.5px solid rgba(255,255,255,0.15); border-radius: 8px; color: #38bdf8; height: 42px;"
                />
              </div>

              <div class="form-group" style="margin-bottom: 14px;">
                <label class="form-label" style="font-size: 12px; color: #cbd5e1; font-weight: 600;">New Password <span class="req">*</span></label>
                <input 
                  type="password" 
                  id="inp-reset-new-password" 
                  class="form-control" 
                  placeholder="Minimum 4 characters" 
                  required 
                  minlength="4"
                  style="background: rgba(15, 23, 42, 0.85); border: 1.5px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; height: 42px;"
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
                  style="background: rgba(15, 23, 42, 0.85); border: 1.5px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; height: 42px;"
                />
              </div>

              <button type="submit" id="btn-submit-forgot-verify" class="gateway-submit-btn btn btn-primary btn-block" style="font-weight: 700; padding: 11px; border-radius: 8px; font-size: 13.5px; width: 100%;">
                💾 Set Password &amp; Sign In
              </button>

              <div style="text-align: center; margin-top: 16px;">
                <a href="${loginHref}" id="link-back-to-login-2" style="font-size: 12.5px; color: #94a3b8; text-decoration: none;">← Return to Login</a>
              </div>
            </form>
          ` : ''}

        </div>

      </main>

      <!-- Footer -->
      <footer style="text-align: center; padding: 12px 20px; font-size: 11.5px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(5, 10, 18, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); position: relative; z-index: 10; flex-shrink: 0;">
        <div style="display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap;">
          <span>&copy; 2026 Al-Muslim Group</span>
          <span>&bull;</span>
          <span>Information Management &amp; Control System</span>
        </div>
      </footer>

    </div>
  `;
}

export function triggerLoginReRender() {
  const container = document.getElementById('login-root-container');
  if (container) {
    container.innerHTML = renderLoginView(_currentIsAdminGateway);
    initLoginViewEvents(_currentIsAdminGateway);
  } else if (typeof window !== 'undefined' && window.app && typeof window.app.render === 'function') {
    window.app.render();
  }
}

export function initLoginViewEvents(isAdminGateway = false) {
  _currentIsAdminGateway = Boolean(isAdminGateway);
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
    if (alertBox) alertBox.style.display = 'none';
  };

  // Check if session was invalidated because password was changed on another device
  try {
    const invalidReason = sessionStorage.getItem('al_muslim_session_invalidated_reason');
    if (invalidReason === 'PASSWORD_CHANGED') {
      sessionStorage.removeItem('al_muslim_session_invalidated_reason');
      showAlert('🔒 Security Alert: Your password was changed on another device. Other active sessions have been automatically logged out for your account security. Please sign in with your new password.', 'warning');
    }
  } catch (_) {}

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

  // Real-time Caps Lock Detection on Password Field
  const capsWarning = document.getElementById('caps-lock-warning');
  if (pwdInput && capsWarning) {
    const checkCaps = (e) => {
      if (e.getModifierState) {
        capsWarning.style.display = e.getModifierState('CapsLock') ? 'inline-block' : 'none';
      }
    };
    pwdInput.addEventListener('keydown', checkCaps);
    pwdInput.addEventListener('keyup', checkCaps);
  }

  // Switch to User Portal Link from Admin Gateway
  document.getElementById('link-switch-to-user-portal')?.addEventListener('click', (e) => {
    e.preventDefault();
    loginMode = 'LOGIN';
    state.set('loginActiveTab', null);
    router.navigate('login');
    state.set('currentView', 'login');
    triggerLoginReRender();
  });

  // Switch to Admin Gateway Link from User Portal
  document.getElementById('link-switch-to-admin-gateway')?.addEventListener('click', (e) => {
    e.preventDefault();
    loginMode = 'LOGIN';
    state.set('loginActiveTab', null);
    router.navigate('admin-login');
    state.set('currentView', 'admin-login');
    triggerLoginReRender();
  });

  // Back to Homepage Navigation
  document.getElementById('btn-back-to-home')?.addEventListener('click', () => {
    router.navigate('home');
    state.set('currentView', 'home');
  });
  document.getElementById('login-nav-home')?.addEventListener('click', () => {
    router.navigate('home');
    state.set('currentView', 'home');
  });

  // Clear inputs on page load
  const inpUser = document.getElementById('inp-full-username');
  const inpPwd = document.getElementById('inp-full-password');
  if (inpUser) inpUser.value = '';
  if (inpPwd) inpPwd.value = '';

  // Submit Standard Login Form with Instant Execution
  const loginForm = document.getElementById('form-full-login');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const username = document.getElementById('inp-full-username')?.value.trim();
      const password = document.getElementById('inp-full-password')?.value;
      const rememberMe = document.getElementById('chk-remember-me')?.checked;

      if (!username || !password) {
        showAlert('Please enter both username/email and password.');
        return;
      }

      const submitBtn = document.getElementById('btn-submit-full-login');
      const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span style="display:inline-block; animation:spin 0.8s linear infinite;">⚡</span> Authenticating...';
      }

      try {
        if (rememberMe) {
          localStorage.setItem('al_muslim_remember_me', 'true');
        } else {
          localStorage.removeItem('al_muslim_remember_me');
        }
        try {
          localStorage.removeItem('al_muslim_saved_username');
        } catch (_) {}

        // Enforce strict Admin vs User gateway isolation
        const res = await authService.login(username, password, { isAdminGateway: _currentIsAdminGateway });

        if (res.mustChangePassword) {
          loginMode = 'FIRST_LOGIN_CHANGE';
          pendingFirstLoginUserId = res.user.id;
          triggerLoginReRender();
          return;
        }

        if (submitBtn) {
          submitBtn.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
          submitBtn.innerHTML = '<span style="font-size: 15px;">✓</span> Verified! Entering System...';
        }

        const redirectParam = router.parseCurrentRoute().params.redirect || 
                              (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('al_muslim_post_login_redirect') : null);
        if (typeof sessionStorage !== 'undefined') {
          try { sessionStorage.removeItem('al_muslim_post_login_redirect'); } catch (_) {}
        }

        let dest = 'dashboard';
        let destTab = null;

        if (redirectParam) {
          const parts = redirectParam.split('/');
          const candView = parts[0];
          const candTab = parts[1] || null;
          if (authService.isViewAllowed(candView, res.user)) {
            dest = candView;
            destTab = candTab;
          } else {
            dest = authService.getFirstAllowedView(res.user) || 'dashboard';
          }
        } else {
          dest = authService.getFirstAllowedView(res.user) || 'dashboard';
        }

        // Instant direct view transition into the ERP shell without double-render locks
        if (window.app && typeof window.app.switchView === 'function') {
          window.app.switchView(dest, { tab: destTab, replace: true });
        } else {
          router.navigate(dest, { tab: destTab, replace: true });
          state.set('currentView', dest);
        }
      } catch (err) {
        showAlert(err.message || 'Login failed. Please check your credentials.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnHtml;
          submitBtn.style.background = '';
        }
      }
    });
  }

  // Submit First Time Login Password Change
  const firstChangeForm = document.getElementById('form-first-login-change');
  if (firstChangeForm && pendingFirstLoginUserId) {
    firstChangeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const newPwd = document.getElementById('inp-first-login-new-pwd')?.value;
      const confirmPwd = document.getElementById('inp-first-login-confirm-pwd')?.value;

      if (!newPwd || newPwd.length < 4) {
        showAlert('New password must be at least 4 characters long.');
        return;
      }

      if (newPwd !== confirmPwd) {
        showAlert('Passwords do not match. Please re-enter.');
        return;
      }

      const targetUserId = pendingFirstLoginUserId;
      const submitBtn = document.getElementById('btn-submit-first-login-change');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving Password...';
      }

      try {
        await authService.completeFirstLoginPassword(targetUserId, newPwd);

        loginMode = 'LOGIN';
        pendingFirstLoginUserId = null;

        const activeUser = authService.getCurrentUser();
        const redirectParam = router.parseCurrentRoute().params.redirect;
        let allowedView = 'dashboard';
        if (redirectParam && authService.isViewAllowed(redirectParam, activeUser)) {
          allowedView = redirectParam;
        } else {
          allowedView = authService.getFirstAllowedView(activeUser) || 'dashboard';
        }
        router.navigate(allowedView, { replace: true });
        state.set('currentView', allowedView);
        state.emit('inventory:updated');
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '💾 Save Password';
        }
        showAlert(err.message || 'Failed to update password.');
      }
    });
  }

  // Switch to Forgot Password Form
  const switchToForgot = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    hideAlert();
    loginMode = 'FORGOT_REQUEST';
    state.set('loginActiveTab', 'forgot-password');
    if (_currentIsAdminGateway) {
      router.navigate('admin-login', { tab: 'forgot-password' });
    } else {
      router.navigate('login', { tab: 'forgot-password' });
    }
    triggerLoginReRender();
  };
  document.getElementById('link-forgot-password')?.addEventListener('click', switchToForgot);

  // Back to login links
  const returnToLogin = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    hideAlert();
    loginMode = 'LOGIN';
    state.set('loginActiveTab', null);
    if (_currentIsAdminGateway) {
      router.navigate('admin-login');
    } else {
      router.navigate('login');
    }
    triggerLoginReRender();
  };
  document.getElementById('link-back-to-login')?.addEventListener('click', returnToLogin);
  document.getElementById('link-back-to-login-2')?.addEventListener('click', returnToLogin);

  // Global delegation failsafe for link-back-to-login & forgot-password
  if (!window.__loginLinkDelegated) {
    window.__loginLinkDelegated = true;
    document.addEventListener('click', (e) => {
      const backBtn = e.target.closest('#link-back-to-login, #link-back-to-login-2');
      if (backBtn) {
        e.preventDefault();
        returnToLogin(e);
      }
      const forgotBtn = e.target.closest('#link-forgot-password');
      if (forgotBtn) {
        e.preventDefault();
        switchToForgot(e);
      }
    });
  }

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
        
        if (emailService.isEmailConfigured()) {
          emailService.sendPasswordResetEmail(res.user, res.otpCode).catch(() => {});
        }

        resetTargetUsername = res.user.username;
        resetTargetEmail = res.email;
        generatedDemoOtp = res.otpCode;
        loginMode = 'FORGOT_VERIFY';
        triggerLoginReRender();
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
        state.set('loginActiveTab', null);
        if (_currentIsAdminGateway) {
          router.navigate('admin-login');
        } else {
          router.navigate('login');
        }
        triggerLoginReRender();
      } catch (err) {
        showAlert(err.message);
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.triggerLoginReRender = triggerLoginReRender;
}
