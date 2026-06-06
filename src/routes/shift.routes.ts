import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  assignShift,
  bulkAssignShifts,
  getEmployeeShifts,
  getMyShifts,
  getTeamShifts,
} from '../controllers/shift.controller.js';

const router = Router();

// Employee routes
router.get('/my', authenticateToken as any, getMyShifts);
router.get('/team', authenticateToken as any, getTeamShifts);

// Admin routes
router.post('/assign', authenticateToken as any, assignShift);
router.post('/assign-bulk', authenticateToken as any, bulkAssignShifts);
router.get('/employee/:employeeId', authenticateToken as any, getEmployeeShifts);

export default router;
