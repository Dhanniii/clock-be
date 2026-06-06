import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

// Controller for managing employee shift schedules

// Admin: Assign or update a shift for an employee on a specific date
export async function assignShift(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Access denied. Admins only.' });
      return;
    }

    const { employeeId, date, isOff, shiftType, startTime, endTime, location, notes } = req.body;

    if (!employeeId || !date) {
      res.status(400).json({ error: 'Employee ID and date are required.' });
      return;
    }

    // Find the employee by their employeeId field
    const employee = await prisma.employee.findUnique({
      where: { employeeId },
    });

    if (!employee) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    const shiftDate = new Date(date);

    const shift = await prisma.shift.upsert({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: shiftDate,
        },
      },
      update: {
        isOff: isOff ?? false,
        shiftType: isOff ? null : (shiftType || null),
        startTime: isOff ? null : (startTime || null),
        endTime: isOff ? null : (endTime || null),
        location: location || null,
        notes: notes || null,
      },
      create: {
        employeeId: employee.id,
        date: shiftDate,
        isOff: isOff ?? false,
        shiftType: isOff ? null : (shiftType || null),
        startTime: isOff ? null : (startTime || null),
        endTime: isOff ? null : (endTime || null),
        location: location || null,
        notes: notes || null,
      },
    });

    res.status(200).json({ message: 'Shift assigned successfully.', shift });
  } catch (err) {
    console.error('Error assigning shift:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// Admin: Bulk assign shifts for a week (7 days)
export async function bulkAssignShifts(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Access denied. Admins only.' });
      return;
    }

    const { employeeId, shifts } = req.body;

    if (!employeeId || !shifts || !Array.isArray(shifts)) {
      res.status(400).json({ error: 'Employee ID and shifts array are required.' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { employeeId },
    });

    if (!employee) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    const results = [];
    for (const s of shifts) {
      const shiftDate = new Date(s.date);
      const shift = await prisma.shift.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: shiftDate,
          },
        },
        update: {
          isOff: s.isOff ?? false,
          shiftType: s.isOff ? null : (s.shiftType || null),
          startTime: s.isOff ? null : (s.startTime || null),
          endTime: s.isOff ? null : (s.endTime || null),
          location: s.location || null,
          notes: s.notes || null,
        },
        create: {
          employeeId: employee.id,
          date: shiftDate,
          isOff: s.isOff ?? false,
          shiftType: s.isOff ? null : (s.shiftType || null),
          startTime: s.isOff ? null : (s.startTime || null),
          endTime: s.isOff ? null : (s.endTime || null),
          location: s.location || null,
          notes: s.notes || null,
        },
      });
      results.push(shift);
    }

    res.status(200).json({ message: 'Shifts assigned successfully.', shifts: results });
  } catch (err) {
    console.error('Error bulk assigning shifts:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// Admin: Get shifts for a specific employee
export async function getEmployeeShifts(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Access denied. Admins only.' });
      return;
    }

    const { employeeId } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { employeeId },
    });

    if (!employee) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    const shifts = await prisma.shift.findMany({
      where: { employeeId: employee.id },
      orderBy: { date: 'asc' },
    });

    res.status(200).json({ shifts });
  } catch (err) {
    console.error('Error fetching employee shifts:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// Employee: Get my own shifts
export async function getMyShifts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const shifts = await prisma.shift.findMany({
      where: { employeeId: req.user!.id },
      orderBy: { date: 'asc' },
    });

    res.status(200).json({ shifts });
  } catch (err) {
    console.error('Error fetching my shifts:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// Employee: Get team shifts (all employees' shifts for current week)
export async function getTeamShifts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    endOfWeek.setHours(23, 59, 59, 999);

    const shifts = await prisma.shift.findMany({
      where: {
        date: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
        employeeId: { not: req.user!.id },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            photo: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    res.status(200).json({ shifts });
  } catch (err) {
    console.error('Error fetching team shifts:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}
