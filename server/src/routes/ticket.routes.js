import { Router } from 'express';
import {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  getTicketMessages,
  createMessage,
  downloadAttachment,
  getAiCategorySuggestion,
  getAiDraft,
} from '../controllers/ticket.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadAttachment } from '../utils/upload.js';

const router = Router();

// Apply authentication to all ticket routes
router.use(authenticate);

router.post('/', uploadAttachment.single('attachment'), createTicket);
router.get('/', getTickets);
router.get('/:id', getTicketById);
router.patch('/:id', updateTicket);

// Messages and attachments
router.get('/:id/messages', getTicketMessages);
router.post('/:id/messages', uploadAttachment.single('attachment'), createMessage);
router.get('/:id/attachments/:filename', downloadAttachment);

// AI features (restricted to staff: agent & admin)
router.post('/:id/ai-category', requireRole('agent', 'admin'), getAiCategorySuggestion);
router.post('/:id/ai-draft', requireRole('agent', 'admin'), getAiDraft);

export default router;
