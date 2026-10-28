import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import db from '../database/db.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
}

export async function register(req, res, next) {
  try {
    const validated = registerSchema.parse(req.body);
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(validated.email.toLowerCase());

    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(validated.password, salt);

    // Public registration always assigns 'customer' role
    const now = new Date().toISOString();
    const result = db
      .prepare(`
        INSERT INTO users (name, email, password_hash, role, is_active, created_at)
        VALUES (?, ?, ?, 'customer', 1, ?)
      `)
      .run(validated.name, validated.email.toLowerCase(), passwordHash, now);

    const user = {
      id: Number(result.lastInsertRowid),
      name: validated.name,
      email: validated.email.toLowerCase(),
      role: 'customer',
    };

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    setAuthCookie(res, token);
    return res.status(201).json({
      message: 'Account registered successfully',
      user,
      token,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const validated = loginSchema.parse(req.body);
    const user = db
      .prepare('SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ?')
      .get(validated.email.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'Account has been deactivated. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(validated.password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    setAuthCookie(res, token);
    return res.json({
      message: 'Logged in successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
}

export function logout(req, res) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
  });
  return res.json({ message: 'Logged out successfully' });
}

export function getCurrentUser(req, res) {
  return res.json({ user: req.user });
}
