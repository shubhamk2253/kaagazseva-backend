import bcrypt                   from 'bcrypt';
import { createHash }           from 'crypto';
import { AuthRepository }       from './auth.repository';
import { JwtService }           from '../modules/auth/jwt.service';
import { AppError, ErrorCodes } from '../../core/AppError';
import { redis }                from '../../config/redis';
import { env }                  from '../../config/env';
import logger                   from '../../core/logger';

/**
 * KAAGAZSEVA - Auth Service
 * Email + Password authentication
 */

const BCRYPT_ROUNDS    = 12;
const REFRESH_TTL_SECS = 30 * 24 * 60 * 60; // 30 days

export class AuthService {

  /* =====================================================
     REGISTER
  ===================================================== */

  static async register(data: {
    name?:        string;
    email:        string;
    password:     string;
    phoneNumber?: string;
  }) {
    // 1. Check email not already taken
    const exists = await AuthRepository.emailExists(data.email);
    if (exists) {
      throw new AppError(
        'An account with this email already exists',
        409, true, ErrorCodes.DUPLICATE_EMAIL
      );
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    // 3. Create user + wallet atomically
    const user = await AuthRepository.createWithWallet({
      name:        data.name,
      email:       data.email.toLowerCase(),
      password:    hashedPassword,
      phoneNumber: data.phoneNumber,
    });

    // 4. Generate tokens
    const tokens = JwtService.generateTokenPair({
      userId: user.id,
      role:   user.role,
      email:  user.email!,
    });

    // 5. Store refresh token in Redis
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    logger.info({
      event:  'USER_REGISTERED',
      userId: user.id,
      email:  user.email,
    });

    return {
      user: this.formatUser(user),
      tokens,
    };
  }

  /* =====================================================
     LOGIN
  ===================================================== */

  static async login(email: string, password: string) {

    // 1. Find user by email
    const user = await AuthRepository.findByEmail(email.toLowerCase());

    if (!user || !user.password) {
      throw new AppError(
        'Invalid email or password',
        401, true, ErrorCodes.INVALID_CREDENTIALS
      );
    }

    // 2. Check account status
    if (!user.isActive) {
      throw AppError.forbidden(
        'Account is inactive. Please contact support.',
        ErrorCodes.USER_INACTIVE
      );
    }

    if (user.isSuspended) {
      throw AppError.userSuspended(user.suspensionReason ?? undefined);
    }

    // 3. Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      logger.warn({
        event:  'LOGIN_FAILED',
        email,
        reason: 'invalid_password',
      });
      throw new AppError(
        'Invalid email or password',
        401, true, ErrorCodes.INVALID_CREDENTIALS
      );
    }

    // 4. Generate tokens
    const tokens = JwtService.generateTokenPair({
      userId: user.id,
      role:   user.role,
      email:  user.email!,
    });

    // 5. Store refresh token in Redis
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    logger.info({
      event:  'USER_LOGIN',
      userId: user.id,
      email:  user.email,
    });

    return {
      user:   this.formatUser(user),
      tokens,
    };
  }

  /* =====================================================
     REFRESH SESSION
  ===================================================== */

  static async refreshSession(refreshToken: string) {

    // 1. Verify refresh token signature
    const decoded = JwtService.verifyRefreshToken(refreshToken);

    // 2. Check token exists in Redis (not logged out)
    const stored = await redis.get(
      `refresh:${decoded.userId}:${this.hashToken(refreshToken)}`
    );

    if (!stored) {
      throw new AppError(
        'Session expired. Please login again.',
        401, true, ErrorCodes.SESSION_EXPIRED
      );
    }

    // 3. Check user still active
    const user = await AuthRepository.findById(decoded.userId);

    if (!user || !user.isActive) {
      throw new AppError(
        'Account no longer active',
        401, true, ErrorCodes.UNAUTHORIZED
      );
    }

    // 4. Rotate — invalidate old, issue new access token
    const newAccessToken = JwtService.signAccessToken({
      userId: user.id,
      role:   user.role,
      email:  user.email!,
    });

    return {
      accessToken: newAccessToken,
      expiresIn:   15 * 60,
    };
  }

  /* =====================================================
     LOGOUT
  ===================================================== */

  static async logout(refreshToken: string, userId: string) {

    // 1. Blacklist the access token hash
    const tokenHash   = createHash('sha256').update(refreshToken).digest('hex');
    const blacklistKey = `blacklist:token:${tokenHash}`;

    // Expire after access token TTL (15 minutes)
    await redis.set(blacklistKey, '1', 'EX', 15 * 60);

    // 2. Remove refresh token from Redis
    await redis.del(
      `refresh:${userId}:${this.hashToken(refreshToken)}`
    );

    logger.info({ event: 'USER_LOGOUT', userId });
  }

  /* =====================================================
     GET ME
  ===================================================== */

  static async getMe(userId: string) {
    const user = await AuthRepository.findById(userId);

    if (!user) {
      throw AppError.notFound('User not found', ErrorCodes.USER_NOT_FOUND);
    }

    return this.formatUser(user);
  }

  /* =====================================================
     CHANGE PASSWORD
  ===================================================== */

  static async changePassword(
    userId:          string,
    currentPassword: string,
    newPassword:     string
  ) {
    const user = await AuthRepository.findById(userId);

    if (!user || !user.password) {
      throw AppError.notFound('User not found', ErrorCodes.USER_NOT_FOUND);
    }

    // Verify current password
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      throw new AppError(
        'Current password is incorrect',
        400, true, ErrorCodes.INVALID_CREDENTIALS
      );
    }

    // Hash and store new password
    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await AuthRepository.updatePassword(userId, hashed);

    // Invalidate all user status cache
    await redis.del(`user:status:${userId}`);

    logger.info({ event: 'PASSWORD_CHANGED', userId });
  }

  /* =====================================================
     PRIVATE HELPERS
  ===================================================== */

  private static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private static async storeRefreshToken(
    userId: string,
    token:  string
  ): Promise<void> {
    const key = `refresh:${userId}:${this.hashToken(token)}`;
    await redis.set(key, '1', 'EX', REFRESH_TTL_SECS);
  }

  private static formatUser(user: any) {
    return {
      id:            user.id,
      name:          user.name,
      email:         user.email,
      role:          user.role,
      phoneNumber:   user.phoneNumber,
      walletBalance: Number(user.wallet?.balance ?? 0),
      isActive:      user.isActive,
    };
  }
}