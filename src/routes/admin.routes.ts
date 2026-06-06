import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { getLiveEmployees, getAllAttendanceHistory } from '../controllers/admin.controller.js';

const router = Router();

router.get('/live', authenticateToken as any, getLiveEmployees);
router.get('/history', authenticateToken as any, getAllAttendanceHistory);

export default router;
