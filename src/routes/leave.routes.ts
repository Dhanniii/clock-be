import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  createLeaveRequest,
  getMyLeaves,
  getAllLeaves,
  updateLeaveStatus,
} from '../controllers/leave.controller.js';

const router = Router();

router.post('/request', authenticateToken as any, createLeaveRequest);
router.get('/my', authenticateToken as any, getMyLeaves);

router.get('/all', authenticateToken as any, getAllLeaves);
router.patch('/:id/status', authenticateToken as any, updateLeaveStatus);

export default router;
