import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export async function getAttendanceStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);

    const attendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: req.user!.id,
          date: todayDate,
        },
      },
    });

    res.status(200).json({ attendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function clockIn(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { latitude, longitude, selfie } = req.body;

    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: 'Latitude and longitude are required' });
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);

    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: req.user!.id,
          date: todayDate,
        },
      },
    });

    if (existing) {
      res.status(400).json({ error: 'Already clocked in today' });
      return;
    }

    const now = new Date();
    const isLate = now.getHours() >= 9;
    const status = isLate ? 'LATE' : 'PRESENT';

    const attendance = await prisma.attendance.create({
      data: {
        employeeId: req.user!.id,
        clockIn: now,
        date: todayDate,
        status,
        latitude,
        longitude,
        notes: selfie || null,
      },
    });

    res.status(201).json({ message: 'Clock in recorded', attendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function clockOut(req: AuthRequest, res: Response): Promise<void> {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);

    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: req.user!.id,
          date: todayDate,
        },
      },
    });

    if (!existing) {
      res.status(400).json({ error: 'You must clock in first' });
      return;
    }

    if (existing.clockOut) {
      res.status(400).json({ error: 'Already clocked out today' });
      return;
    }

    const attendance = await prisma.attendance.update({
      where: {
        id: existing.id,
      },
      data: {
        clockOut: new Date(),
      },
    });

    res.status(200).json({ message: 'Clock out recorded', attendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAttendanceHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: req.user!.id,
      },
      orderBy: {
        date: 'desc',
      },
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const employee = await prisma.employee.findUnique({
      where: { id: req.user!.id },
      select: { createdAt: true },
    });

    const earliestAttendance = await prisma.attendance.findFirst({
      where: { employeeId: req.user!.id },
      orderBy: { date: 'asc' },
      select: { date: true },
    });

    const earliestShift = await prisma.shift.findFirst({
      where: { employeeId: req.user!.id },
      orderBy: { date: 'asc' },
      select: { date: true },
    });

    const hireDate = employee?.createdAt ? new Date(employee.createdAt) : startOfMonth;
    let earliestActivityDate: Date | null = null;
    if (earliestAttendance && earliestShift) {
      earliestActivityDate = earliestAttendance.date < earliestShift.date ? earliestAttendance.date : earliestShift.date;
    } else if (earliestAttendance) {
      earliestActivityDate = earliestAttendance.date;
    } else if (earliestShift) {
      earliestActivityDate = earliestShift.date;
    }

    const startReference = earliestActivityDate || hireDate;
    const loopStartDate = startReference > startOfMonth
      ? new Date(startReference.getFullYear(), startReference.getMonth(), startReference.getDate())
      : startOfMonth;

    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const toLocalDateString = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const startOfMonthStr = toLocalDateString(startOfMonth);
    const endOfTodayStr = toLocalDateString(endOfToday);

    const currentMonthAttendances = attendances.filter((a) => {
      const aDateStr = toLocalDateString(a.date);
      return aDateStr >= startOfMonthStr && aDateStr <= endOfTodayStr;
    });

    const totalAttended = currentMonthAttendances.length;
    const lateCount = currentMonthAttendances.filter((a) => a.status === 'LATE').length;

    let absence = 0;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    if (loopStartDate <= yesterday) {
      const shifts = await prisma.shift.findMany({
        where: {
          employeeId: req.user!.id,
          date: {
            gte: loopStartDate,
            lte: yesterday,
          },
        },
      });

      const leaves = await prisma.leave.findMany({
        where: {
          employeeId: req.user!.id,
          status: 'APPROVED',
          OR: [
            {
              startDate: { lte: yesterday },
              endDate: { gte: loopStartDate },
            },
          ],
        },
      });

      const shiftMap = new Map<string, any>();
      for (const shift of shifts) {
        shiftMap.set(toLocalDateString(shift.date), shift);
      }

      const leaveDates = new Set<string>();
      for (const leave of leaves) {
        let lCurr = new Date(leave.startDate);
        const lEnd = new Date(leave.endDate);
        while (lCurr <= lEnd) {
          leaveDates.add(toLocalDateString(lCurr));
          lCurr.setDate(lCurr.getDate() + 1);
        }
      }

      let current = new Date(loopStartDate);
      while (current <= yesterday) {
        const dateStr = toLocalDateString(current);

        const hasAttendance = currentMonthAttendances.some(
          (a) => toLocalDateString(a.date) === dateStr
        );

        if (!hasAttendance) {
          const onLeave = leaveDates.has(dateStr);
          if (!onLeave) {
            const shift = shiftMap.get(dateStr);
            if (shift) {
              if (!shift.isOff) {
                absence++;
              }
            } else {
              const dayOfWeek = current.getDay();
              if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                absence++;
              }
            }
          }
        }
        current.setDate(current.getDate() + 1);
      }
    }

    res.status(200).json({
      attendances,
      stats: {
        totalAttended,
        lateCount,
        absence,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

