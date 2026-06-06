import { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export async function getLiveEmployees(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Access denied. Admins only.' });
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);

    const employees = await prisma.employee.findMany({
      where: {
        role: 'EMPLOYEE',
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        photo: true,
        attendances: {
          where: {
            date: todayDate,
          },
        },
      },
    });

    res.status(200).json({ employees });
  } catch (err) {
    console.error('Error fetching live employees:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAllAttendanceHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Access denied. Admins only.' });
      return;
    }

    const attendances = await prisma.attendance.findMany({
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            email: true,
            photo: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    res.status(200).json({ attendances });
  } catch (err) {
    console.error('Error fetching all attendance history:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteEmployee(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Access denied. Admins only.' });
      return;
    }

    const { id } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    if (employee.role === 'ADMIN') {
      res.status(400).json({ error: 'Cannot delete admin accounts.' });
      return;
    }

    await prisma.employee.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Employee deleted successfully.' });
  } catch (err) {
    console.error('Error deleting employee:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
