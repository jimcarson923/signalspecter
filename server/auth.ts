import type { Express, Request, Response, NextFunction } from 'express';
import { storage, verifyPassword } from './storage';
import { insertUserSchema } from '@shared/schema';
import { z } from 'zod';

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function registerAuthRoutes(app: Express) {
  // Register
  app.post('/api/auth/register', (req, res) => {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' });
    }
    const { email, password, name } = parsed.data;

    // Check if email already taken
    const existing = storage.getUserByEmail(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    try {
      const user = storage.createUser({ email: email.toLowerCase(), password, name, plan: 'free' });
      req.session.userId = user.id;
      return res.status(201).json({
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
      });
    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ error: 'Failed to create account' });
    }
  });

  // Login
  app.post('/api/auth/login', (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const { email, password } = parsed.data;

    const user = storage.getUserByEmail(email.toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.userId = user.id;
    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    });
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {});
    res.json({ ok: true });
  });

  // Get current user
  app.get('/api/auth/me', (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    });
  });

  // Upgrade plan
  app.post('/api/auth/upgrade', (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const schema = z.object({
      plan: z.enum(['starter', 'professional', 'elite', 'enterprise']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    try {
      const user = storage.updateUserPlan(req.session.userId, parsed.data.plan);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
      });
    } catch (err) {
      console.error('Upgrade error:', err);
      return res.status(500).json({ error: 'Failed to upgrade plan' });
    }
  });
}
