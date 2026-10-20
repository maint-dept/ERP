/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Dedicated Full-Page Login & Password Recovery Component
 * Premium Cyber-Executive Security Gateway Interface (v4.26.56)
 */

import { authService } from '../services/authService.js';
import { emailService } from '../services/emailService.js';
import { state } from '../state.js';
import { router } from '../services/router.js?v=4.26.54';

let loginMode = 'LOGIN'; // 'LOGIN' | 'FORGOT_REQUEST' | 'FORGOT_VERIFY' | 'FIRST_LOGIN_CHANGE'
let resetTargetUsername = '';
let resetTargetEmail = '';
let generatedDemoOtp = '';
let pendingFirstLoginUserId = null;
let _currentIsAdminGateway = false;

export function renderLoginView(isAdminGateway = false) {
  _currentIsAdminGateway = Boolean(isAdminGateway);
  const rememberMe = localStorage.getItem('al_muslim_remember_me') === 'true';
  try {
    localStorage.removeItem('al_muslim_saved_username');
  } catch (_) {}

  const isMaintActive = authService.isMaintenanceModeActive();
  const maintConfig = authService.getMaintenanceModeConfig();

  // Page background: Cyber-emerald obsidian for Admin Gateway, deep navy for User Portal
  const pageBg = isAdminGateway
    ? 'radial-gradient(circle at 50% 12%, #064e3b 0%, #03201a 30%, #020b12 70%, #010408 100%)'
    : 'radial-gradient(circle at 50% 15%, #1e3a8a 0%, #0f172a 50%, #030712 100%)';

  const accentColor = isAdminGateway ? '#10b981' : '#0284c7';
  const accentLight = isAdminGateway ? '#34d399' : '#38bdf8';
  const cardBorder = isAdminGateway
    ? '1.5px solid rgba(16, 185, 129, 0.4)'
    : '1.5px solid rgba(56, 189, 248, 0.35)';

  return `
    <style>
      @keyframes adminGlowPulse {
        0%, 100% {
          box-shadow: 0 0 25px rgba(16, 185, 129, 0.35), inset 0 0 15px rgba(16, 185, 129, 0.2);
          border-color: rgba(16, 185, 129, 0.65);
        }
        50% {
          box-shadow: 0 0 45px rgba(16, 185, 129, 0.6), 0 0 70px rgba(14, 165, 233, 0.3), inset 0 0 25px rgba(16, 185, 129, 0.4);
          border-color: rgba(52, 211, 153, 0.95);
        }
      }

      @keyframes userGlowPulse {
        0%, 100% {
          box-shadow: 0 0 25px rgba(2, 132, 199, 0.35), inset 0 0 15px rgba(2, 132, 199, 0.2);
          border-color: rgba(2, 132, 199, 0.65);
        }
        50% {
          box-shadow: 0 0 45px rgba(2, 132, 199, 0.6), 0 0 70px rgba(56, 189, 248, 0.3), inset 0 0 25px rgba(2, 132, 199, 0.4);
          border-color: rgba(56, 189, 248, 0.95);
        }
      }

      @keyframes pulseDot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }

      @keyframes shimmerButton {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      .gateway-card {
        background: rgba(10, 18, 30, 0.88) !important;
        backdrop-filter: blur(28px) saturate(180%);
        -webkit-backdrop-filter: blur(28px) saturate(180%);
        border: ${cardBorder} !important;
        border-radius: 20px !important;
        box-shadow: 0 25px 70px rgba(0, 0, 0, 0.85), 0 0 45px ${isAdminGateway ? 'rgba(16, 185, 129, 0.16)' : 'rgba(2, 132, 199, 0.18)'}, inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .gateway-card:hover {
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.9), 0 0 55px ${isAdminGateway ? 'rgba(16, 185, 129, 0.25)' : 'rgba(2, 132, 199, 0.25)'}, inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
      }

      .gateway-icon-box {
        animation: ${isAdminGateway ? 'adminGlowPulse' : 'userGlowPulse'} 3.5s infinite ease-in-out;
      }

      .gateway-input-box {
        position: relative;
        display: flex;
        align-items: center;
        transition: all 0.2s ease;
      }

      .gateway-input-box:focus-within {
        filter: drop-shadow(0 0 12px ${isAdminGateway ? 'rgba(16, 185, 129, 0.4)' : 'rgba(2, 132, 199, 0.4)'});
      }

      .gateway-input-box input:focus {
        border-color: ${accentColor} !important;
        box-shadow: 0 0 0 3px ${isAdminGateway ? 'rgba(16, 185, 129, 0.22)' : 'rgba(2, 132, 199, 0.22)'} !important;
        background: rgba(15, 23, 42, 0.95) !important;
      }

      .admin-quick-chip {
        transition: all 0.2s ease;
        cursor: pointer;
        user-select: none;
      }

      .admin-quick-chip:hover {
        transform: translateY(-2px);
        background: rgba(16, 185, 129, 0.25) !important;
        border-color: #34d399 !important;
        color: #ffffff !important;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
      }

      .admin-quick-chip:active {
        transform: translateY(0);
      }

      .gateway-submit-btn {
        background: ${isAdminGateway 
          ? 'linear-gradient(135deg, #059669 0%, #10b981 45%, #0284c7 100%)' 
          : 'linear-gradient(135deg, #0284c7 0%, #0369a1 45%, #1d4ed8 100%)'} !important;
        background-size: 200% 200% !important;
        animation: shimmerButton 6s ease infinite;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
        border: none !important;
        box-shadow: 0 4px 20px ${isAdminGateway ? 'rgba(5, 150, 105, 0.45)' : 'rgba(2, 132, 199, 0.5)'} !important;
      }

      .gateway-submit-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 30px ${isAdminGateway ? 'rgba(16, 185, 129, 0.65)' : 'rgba(2, 132, 199, 0.65)'} !important;
        filter: brightness(1.1);
      }

      .gateway-submit-btn:active {
        transform: translateY(0);
      }
    </style>

    <div class="login-page-wrapper" style="min-height: 100vh; background: ${pageBg}; background-color: #040911; background-image: radial-gradient(${isAdminGateway ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)'} 1px, transparent 1px); background-size: 28px 28px; display: flex; flex-direction: column; justify-content: space-between; font-family: var(--font-main); color: #fff; position: relative; overflow-x: hidden;">
      
      <!-- Ambient High-Tech Floating Glowing Halos in Background -->
      <div style="position: absolute; top: -140px; left: 15%; width: 500px; height: 500px; border-radius: 50%; background: radial-gradient(circle, ${isAdminGateway ? 'rgba(16, 185, 129, 0.16)' : 'rgba(2, 132, 199, 0.18)'} 0%, transparent 70%); filter: blur(70px); pointer-events: none; z-index: 0;"></div>
      <div style="position: absolute; bottom: -100px; right: 12%; width: 550px; height: 550px; border-radius: 50%; background: radial-gradient(circle, ${isAdminGateway ? 'rgba(14, 165, 233, 0.14)' : 'rgba(99, 102, 241, 0.15)'} 0%, transparent 70%); filter: blur(80px); pointer-events: none; z-index: 0;"></div>

      <!-- Top Executive Navigation Ribbon -->
      <header style="padding: 18px 32px; display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 10; border-bottom: 1px solid rgba(255, 255, 255, 0.07); background: rgba(5, 10, 18, 0.75); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);">
        <div style="display: flex; align-items: center; gap: 14px; cursor: pointer;" id="login-nav-home">
          <div style="width: 40px; height: 40px; background: ${isAdminGateway ? 'linear-gradient(135deg, #059669, #0284c7)' : 'linear-gradient(135deg, #0284c7, #1d4ed8)'}; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 20px ${isAdminGateway ? 'rgba(16, 185, 129, 0.4)' : 'rgba(2, 132, 199, 0.4)'}; border: 1px solid rgba(255, 255, 255, 0.2);">
            ${isAdminGateway ? '🛡️' : '🔧'}
          </div>
          <div style="display: flex; flex-direction: column;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 15px; color: #fff; letter-spacing: 0.8px;">AL-MUSLIM GROUP</span>
              <span class="badge" style="font-size: 10px; font-weight: 800; background: ${isAdminGateway ? 'rgba(16, 185, 129, 0.2)' : 'rgba(2, 132, 199, 0.2)'}; color: ${accentLight}; border: 1px solid ${isAdminGateway ? 'rgba(16, 185, 129, 0.4)' : 'rgba(2, 132, 199, 0.4)'}; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 5px;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${accentLight}; display: inline-block; animation: pulseDot 2s infinite;"></span>
                ${isAdminGateway ? 'ADMIN GATEWAY ONLINE' : 'USER ACCESS PORTAL'}
              </span>
            </div>
            <span style="font-size: 11px; color: #94a3b8; font-weight: 600; margin-top: 1px;">
              ${isAdminGateway ? 'Garments Factory Maintenance Machine ERP • Confidential Admin Gateway' : 'Garments Factory Maintenance Machine ERP System'}
            </span>
          </div>
        </div>

        <button id="btn-back-to-home" class="btn btn-ghost btn-sm" style="color: #cbd5e1; font-size: 12.5px; font-weight: 600; display: flex; align-items: center; gap: 8px; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255, 255, 255, 0.12); padding: 7px 14px; border-radius: 8px; transition: all 0.2s ease;">
          <span>←</span>
          <span>Public Homepage</span>
        </button>
      </header>

      <!-- Main Central Authentication Container -->
      <main style="max-width: 500px; width: 100%; margin: 24px auto 36px; padding: 0 16px; position: relative; z-index: 5;">
        
        <div class="gateway-card" style="padding: 34px 30px;">
          
          <!-- Card Header & Badge -->
          <div style="text-align: center; margin-bottom: 22px;">
            <div class="gateway-icon-box" style="width: 70px; height: 70px; background: linear-gradient(135deg, ${isAdminGateway ? 'rgba(16, 185, 129, 0.2), rgba(2, 132, 199, 0.15)' : 'rgba(2, 132, 199, 0.25), rgba(99, 102, 241, 0.15)'}); border: 1.5px solid ${isAdminGateway ? 'rgba(16, 185, 129, 0.55)' : 'rgba(56, 189, 248, 0.55)'}; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 14px;">
              ${loginMode === 'LOGIN' ? (isAdminGateway ? '🛡️' : '🔐') : (loginMode === 'FIRST_LOGIN_CHANGE' ? '🔑' : '📩')}
            </div>
            
            <!-- Category Security Badge -->
            <div style="margin-bottom: 8px;">
              <span class="badge" style="font-size: 11px; font-weight: 800; letter-spacing: 0.7px; padding: 5px 14px; border-radius: 20px; ${isAdminGateway ? 'background: rgba(16, 185, 129, 0.18); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.5);' : 'background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4);'}">
                ${isAdminGateway ? '🔒 CONFIDENTIAL ACCESS • SYSTEM ADMINISTRATORS ONLY' : '👤 USER ACCESS PORTAL'}
              </span>
            </div>

            <h2 style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; margin: 0 0 6px 0;">
              ${loginMode === 'LOGIN' 
                ? (isAdminGateway ? 'Administrative Security Gateway' : 'Sign in to Maintenance ERP') 
                : (loginMode === 'FIRST_LOGIN_CHANGE' ? 'First Login Password Setup' : (loginMode === 'FORGOT_REQUEST' ? 'Password Recovery' : 'Set New Password'))}
            </h2>
            <p style="font-size: 12.5px; color: #94a3b8; line-height: 1.5; margin: 0;">
              ${loginMode === 'LOGIN' 
                ? (isAdminGateway ? 'Authorized Maintenance System Directors, Master Engineers & ERP System Admins.' : 'Enter your employee credentials to access factory equipment, maintenance requests, and spare parts.') 
                : (loginMode === 'FIRST_LOGIN_CHANGE' ? 'Please configure your permanent private password to enter the system.' : (loginMode === 'FORGOT_REQUEST' ? 'Enter your registered Email address or Username to receive a password reset code.' : `Enter the 6-digit code sent for account '${resetTargetUsername}'.`))}
            </p>

            ${isAdminGateway && loginMode === 'LOGIN' ? `
              <div style="display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 8px 12px; font-size: 11px; color: #94a3b8; margin-top: 14px; padding: 8px 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; font-family: var(--font-mono);">
                <span style="color: #34d399; font-weight: 600;">🔒 256-Bit TLS 1.3</span>
                <span>&bull;</span>
                <span style="color: #38bdf8; font-weight: 600;">🛡️ Role-Gated Gateway</span>
                <span>&bull;</span>
                <span style="color: #cbd5e1; font-weight: 600;">🚫 Anti-Indexed</span>
              </div>
            ` : ''}
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

          <!-- FORM MODE 1: STANDARD LOGIN -->
          ${loginMode === 'LOGIN' ? `
            
            ${isAdminGateway ? `
              <!-- Quick Administrator Select Chips (User-Friendly 1-Click Auto Fill) -->
              <div style="margin-bottom: 16px; padding: 10px 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-size: 11px; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.4px; display: flex; align-items: center; gap: 5px;">
                    <span>⚡</span> Administrator Profile Select:
                  </span>
                  <span style="font-size: 10.5px; color: #6ee7b7; font-weight: 600;">1-Click Auto Fill</span>
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  <button type="button" class="btn-admin-quick-fill admin-quick-chip" data-user="motaher" data-pass="Mr@304415" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); color: #6ee7b7; font-size: 11.5px; font-weight: 700; padding: 4px 9px; border-radius: 6px;">
                    👑 Engr. Motaher
                  </button>
                  <button type="button" class="btn-admin-quick-fill admin-quick-chip" data-user="superadmin" data-pass="admin123" style="background: rgba(14, 165, 233, 0.12); border: 1px solid rgba(14, 165, 233, 0.35); color: #38bdf8; font-size: 11.5px; font-weight: 700; padding: 4px 9px; border-radius: 6px;">
                    🛡️ Super Admin
                  </button>
                  <button type="button" class="btn-admin-quick-fill admin-quick-chip" data-user="admin" data-pass="admin123" style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); color: #fbbf24; font-size: 11.5px; font-weight: 700; padding: 4px 9px; border-radius: 6px;">
                    ⚙️ Maintenance Admin
                  </button>
                </div>
              </div>
            ` : `
              <!-- Quick User Portal Select Chips (Instant 1-Click Auto Fill) -->
              <div style="margin-bottom: 16px; padding: 10px 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-size: 11px; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.4px; display: flex; align-items: center; gap: 5px;">
                    <span>⚡</span> 1-Click Instant User Fill:
                  </span>
                  <span style="font-size: 10.5px; color: #38bdf8; font-weight: 600;">Instant Login</span>
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  <button type="button" class="btn-admin-quick-fill admin-quick-chip" data-user="user" data-pass="user123" style="background: rgba(2, 132, 199, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; font-size: 11.5px; font-weight: 700; padding: 4px 9px; border-radius: 6px;">
                    👤 Factory User (user)
                  </button>
                  <button type="button" class="btn-admin-quick-fill admin-quick-chip" data-user="admin" data-pass="admin123" style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); color: #fbbf24; font-size: 11.5px; font-weight: 700; padding: 4px 9px; border-radius: 6px;">
                    ⚙️ Maintenance Admin
                  </button>
                  <button type="button" class="btn-admin-quick-fill admin-quick-chip" data-user="motaher" data-pass="Mr@304415" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); color: #6ee7b7; font-size: 11.5px; font-weight: 700; padding: 4px 9px; border-radius: 6px;">
                    👑 Engr. Motaher
                  </button>
                </div>
              </div>
            `}

            <form id="form-full-login">
              
              <!-- Username or Email -->
              <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label" style="font-size: 12.5px; color: #e2e8f0; font-weight: 700; display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                  <span>${isAdminGateway ? 'Administrator Username or Email' : 'Employee ID, Username, or Email'}</span>
                  <span style="font-size: 10.5px; color: ${accentLight}; font-weight: 600;">• Required</span>
                </label>
                <div class="gateway-input-box">
                  <span style="position: absolute; left: 14px; font-size: 16px; opacity: 0.85; pointer-events: none; z-index: 5;">
                    ${isAdminGateway ? '🛡️' : '👤'}
                  </span>
                  <input 
                    type="text" 
                    id="inp-full-username" 
                    class="form-control" 
                    placeholder="${isAdminGateway ? 'e.g. motaher, superadmin, or admin' : 'Employee ID, username, or email (e.g. user)'}" 
                    value=""
                    required 
                    autocomplete="username"
                    style="padding-left: 44px !important; background: rgba(15, 23, 42, 0.85); border: 1.5px solid ${isAdminGateway ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.25)'}; border-radius: 10px; color: #fff; font-size: 13.5px; height: 44px; font-weight: 600;"
                  />
                </div>
              </div>

              <!-- Password -->
              <div class="form-group" style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                  <label class="form-label" style="font-size: 12.5px; color: #e2e8f0; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px;">
                    <span>Password</span>
                    <span id="caps-lock-warning" style="display: none; font-size: 10.5px; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); padding: 1px 6px; border-radius: 4px; font-weight: 700;">
                      ⚠️ Caps Lock is ON
                    </span>
                  </label>
                  <a href="#" id="link-forgot-password" style="font-size: 12px; color: ${accentLight}; text-decoration: none; font-weight: 700;">Forgot Password?</a>
                </div>
                <div class="gateway-input-box">
                  <span style="position: absolute; left: 14px; font-size: 16px; opacity: 0.85; pointer-events: none; z-index: 5;">🔒</span>
                  <input 
                    type="password" 
                    id="inp-full-password" 
                    class="form-control" 
                    placeholder="${isAdminGateway ? 'Enter master administrative password' : 'Enter account password'}" 
                    value=""
                    required 
                    autocomplete="current-password"
                    style="padding-left: 44px !important; padding-right: 48px !important; background: rgba(15, 23, 42, 0.85); border: 1.5px solid ${isAdminGateway ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.25)'}; border-radius: 10px; color: #fff; font-size: 13.5px; height: 44px;"
                  />
                  <button type="button" id="btn-toggle-pwd-visibility" style="position: absolute; right: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px 8px; cursor: pointer; color: #94a3b8; font-size: 14px; transition: all 0.2s;" title="Toggle Password Visibility">
                    👁️
                  </button>
                </div>
              </div>

              <!-- Remember Me -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin: 14px 0 18px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #94a3b8; cursor: pointer; user-select: none;">
                  <input type="checkbox" id="chk-remember-me" ${rememberMe ? 'checked' : ''} style="width: 15px; height: 15px; accent-color: ${accentColor}; cursor: pointer;" />
                  <span>${isAdminGateway ? 'Remember administrator on this device' : 'Remember my username'}</span>
                </label>
                <span style="font-size: 11px; color: #64748b; font-family: var(--font-mono);">${isAdminGateway ? 'Session: 12h TLS' : 'Standard Session'}</span>
              </div>

              <!-- Submit Button -->
              <button type="submit" id="btn-submit-full-login" class="gateway-submit-btn btn btn-primary btn-block" style="font-weight: 800; font-size: 14.5px; padding: 12px; border-radius: 10px; letter-spacing: 0.3px; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; cursor: pointer;">
                <span>${isAdminGateway ? '🛡️ Authenticate &amp; Enter Admin Gateway' : '🔐 Sign In to User Portal'}</span>
                <span>➔</span>
              </button>

              <div style="text-align: center; margin-top: 8px; font-size: 11px; color: #64748b;">
                Press <kbd style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 1px 5px; font-family: var(--font-mono); color: #cbd5e1;">Enter ↵</kbd> to sign in immediately
              </div>

            </form>

            ${isAdminGateway ? `
              <!-- Zero-Trust Enterprise Separation Notice -->
              <div style="margin-top: 20px; padding: 12px 14px; background: rgba(15, 23, 42, 0.6); border: 1px dashed rgba(16, 185, 129, 0.3); border-radius: 10px; font-size: 11.5px; color: #94a3b8; line-height: 1.5; text-align: left;">
                <div style="font-weight: 700; color: #34d399; margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
                  <span>🔐</span>
                  <span>Zero-Trust Enterprise Separation:</span>
                </div>
                General garment factory users must log in via the <a href="#" id="link-switch-to-user-portal" style="color: #38bdf8; text-decoration: underline; font-weight: 700;">General User Portal</a>. Only authorized accounts with Admin or Super Admin privileges may authenticate through this gateway.
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
                <a href="#" id="link-back-to-login" style="font-size: 12.5px; color: #94a3b8; text-decoration: none;">← Return to Sign In</a>
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
                <a href="#" id="link-back-to-login-2" style="font-size: 12.5px; color: #94a3b8; text-decoration: none;">← Return to Sign In</a>
              </div>
            </form>
          ` : ''}

        </div>

      </main>

      <!-- Executive Compliance & Build Footer -->
      <footer style="text-align: center; padding: 20px 24px; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(5, 10, 18, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); position: relative; z-index: 10;">
        <div style="display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 4px;">
          <span>&copy; 2026 Al-Muslim Group</span>
          <span>&bull;</span>
          <span>Garments Factory Maintenance Machine ERP</span>
          <span>&bull;</span>
          <span style="color: ${accentLight}; font-weight: 600;">Enterprise Security Gateway v4.26.56</span>
        </div>
        <div style="font-size: 11px; color: #475569;">
          ISO/IEC 27001 Ready Architecture &bull; Primary MySQL Cloud Synchronized &bull; Strictly Confidential Gateway
        </div>
      </footer>

    </div>
  `;
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

  // Quick Profile Select Auto-Fill Chips (1-Click Auto Fill Username & Password)
  document.querySelectorAll('.btn-admin-quick-fill').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = btn.getAttribute('data-user');
      const p = btn.getAttribute('data-pass');
      const inp = document.getElementById('inp-full-username');
      const pwd = document.getElementById('inp-full-password');
      if (inp && u) {
        inp.value = u;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (pwd && p) {
        pwd.value = p;
        pwd.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (pwd) pwd.focus();
    });
  });

  // Switch to User Portal Link from Admin Gateway
  document.getElementById('link-switch-to-user-portal')?.addEventListener('click', (e) => {
    e.preventDefault();
    router.navigate('login');
    state.set('currentView', 'login');
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
          const returnView = _currentIsAdminGateway ? 'admin-login' : 'login';
          router.navigate(returnView, { replace: true });
          state.set('currentView', returnView);
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
  document.getElementById('link-forgot-password')?.addEventListener('click', (e) => {
    e.preventDefault();
    hideAlert();
    loginMode = 'FORGOT_REQUEST';
    const target = _currentIsAdminGateway ? 'admin-login' : 'login';
    state.set('currentView', target);
  });

  // Back to login links
  const returnToLogin = (e) => {
    e.preventDefault();
    hideAlert();
    loginMode = 'LOGIN';
    const target = _currentIsAdminGateway ? 'admin-login' : 'login';
    state.set('currentView', target);
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
        
        if (emailService.isEmailConfigured()) {
          emailService.sendPasswordResetEmail(res.user, res.otpCode).catch(() => {});
        }

        resetTargetUsername = res.user.username;
        resetTargetEmail = res.email;
        generatedDemoOtp = res.otpCode;
        loginMode = 'FORGOT_VERIFY';
        const target = _currentIsAdminGateway ? 'admin-login' : 'login';
        state.set('currentView', target);
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
        const target = _currentIsAdminGateway ? 'admin-login' : 'login';
        state.set('currentView', target);
      } catch (err) {
        showAlert(err.message);
      }
    });
  }
}
