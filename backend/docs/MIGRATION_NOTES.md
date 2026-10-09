# Password Security & Recovery Architecture Plan

## Problem Statement
Previously, the `users` table maintained a `viewable_password` column which was populated with plaintext passwords upon registration and password changes. This exposed passwords to serialization risks in API responses (`GET /auth/me`, `GET /platform/tenants/:id`) and direct database inspection.

## Remediation Plan

### 1. ORM & API Scope Hardening (Immediate)
- **Model defaultScope Exclusion**: Added `'viewable_password'` to `User.defaultScope.attributes.exclude` in `backend/src/models/user.model.js`.
- **API Serialization Stripping**: Explicitly removed `viewable_password` from `backend/src/controllers/auth.controller.js` (`me()` handler) and `backend/src/controllers/platformTenant.controller.js` (`getTenantDetails` and `updateSellerPassword`).
- **Service Assignment Removal**: Eliminated assignment of plaintext passwords in `backend/src/services/auth.service.js` during registration and reset flows.

### 2. Database Schema Migration
- Migration file: `backend/src/migrations/20260925000001-drop-viewable-password-from-users.js`
- Operation: Drops the `viewable_password` column from the `users` table via `queryInterface.removeColumn('users', 'viewable_password')`.

### 3. Password Recovery Architecture (Standard Cryptographic Reset Flow)
Without storing plaintext/reversible passwords, user authentication and recovery operate strictly through industry-standard cryptographic primitives:

1. **One-Way Password Hashing**:
   - All passwords are encrypted using bcrypt (`hashUtils.hashPassword`, 12 salt rounds).
   - Only `password_hash` is stored.

2. **Self-Service Password Recovery (Token & OTP)**:
   - **Step 1 (Request)**: User submits email or phone at `/api/v1/auth/forgot-password`.
   - **Step 2 (Token / OTP Generation)**:
     - A cryptographically random, high-entropy 6-digit numeric OTP or SHA-256 token is generated.
     - Stored with an explicit expiration (10 minutes) in Redis (`pwd_reset_otp:${cleanEmail}`) or `password_reset_tokens` table.
     - Dispatched out-of-band via verified communication channels: SMTP Email, official WhatsApp BSP, or transactional SMS.
   - **Step 3 (Validation & Reset)**:
     - User submits the OTP/token along with their new password to `/api/v1/auth/reset-password`.
     - System validates the OTP from cache, verifies single-use, and immediately purges the OTP from Redis.
     - The new password is encrypted via bcrypt into `password_hash`.
     - `token_version` on the user record is incremented to immediately invalidate any existing sessions and JWT refresh tokens.
     - Active sessions in `refresh_tokens` are destroyed.

3. **Platform Admin Assisted Password Overwrite**:
   - Super admins can trigger a password overwrite for a seller via `/api/v1/platform/tenants/:id/password` (governed by RBAC `super_admin`).
   - The password is encrypted before saving.
   - The response confirms success and logs an audit record, but never returns or retains the plaintext password.
   - The seller's active sessions are terminated immediately via `token_version` increment, requiring re-login.
