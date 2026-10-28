import { Router } from 'express';
import { register, login, logout, getCurrentUser } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', register);
router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', authenticate, getCurrentUser);

export default router;
