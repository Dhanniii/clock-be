import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  getAttendanceStatus,
  clockIn,
  clockOut,
  getAttendanceHistory,
} from '../controllers/attendance.controller.js';

const router = Router();

router.get('/status', authenticateToken as any, getAttendanceStatus);
router.post('/clock-in', authenticateToken as any, clockIn);
router.post('/clock-out', authenticateToken as any, clockOut);
router.get('/history', authenticateToken as any, getAttendanceHistory);

export default router;
