import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export async function createLeaveRequest(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { type, startDate, endDate, reason } = req.body;

    if (!type || !startDate || !endDate || !reason) {
      res.status(400).json({ error: 'Type, startDate, endDate, and reason are required.' });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ error: 'Invalid date formats.' });
      return;
    }

    if (end < start) {
      res.status(400).json({ error: 'End date cannot be before start date.' });
      return;
    }

    const leave = await prisma.leave.create({
      data: {
        employeeId: req.user!.id,
        type,
        startDate: start,
        endDate: end,
        reason,
        status: 'PENDING',
      },
    });

    res.status(201).json({ message: 'Leave request submitted successfully.', leave });
  } catch (err) {
    console.error('Error creating leave request:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getMyLeaves(req: AuthRequest, res: Response): Promise<void> {
  try {
    const leaves = await prisma.leave.findMany({
      where: {
        employeeId: req.user!.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({ leaves });
  } catch (err) {
    console.error('Error fetching my leaves:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getAllLeaves(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Access denied. Admins only.' });
      return;
    }

    const leaves = await prisma.leave.findMany({
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({ leaves });
  } catch (err) {
    console.error('Error fetching all leaves:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function updateLeaveStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Access denied. Admins only.' });
      return;
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status || (status !== 'APPROVED' && status !== 'REJECTED')) {
      res.status(400).json({ error: 'Valid status (APPROVED or REJECTED) is required.' });
      return;
    }

    const existingLeave = await prisma.leave.findUnique({
      where: { id },
    });

    if (!existingLeave) {
      res.status(404).json({ error: 'Leave request not found.' });
      return;
    }

    const updatedLeave = await prisma.leave.update({
      where: { id },
      data: {
        status: status as any,
      },
    });

    res.status(200).json({ message: `Leave request status updated to ${status}.`, leave: updatedLeave });
  } catch (err) {
    console.error('Error updating leave status:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}
