import { Router } from 'express';
import {
  getOverview,
  getAgents,
  updateAgentStatus,
  getAnalytics,
} from '../controllers/admin.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Restrict all admin routes to users with role = 'admin'
router.use(authenticate, requireRole('admin'));

router.get('/overview', getOverview);
router.get('/agents', getAgents);
router.patch('/agents/:id', updateAgentStatus);
router.get('/analytics', getAnalytics);

export default router;
