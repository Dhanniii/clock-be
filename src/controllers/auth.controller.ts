import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

const JWT_SECRET = process.env.JWT_SECRET || 'clockwork-secret-key';
const JWT_EXPIRES_IN = '7d';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { employeeId, name, password, email, photo } = req.body;

    if (!employeeId || !name || !password) {
      res.status(400).json({ error: 'Employee ID, name, and password are required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const existing = await prisma.employee.findUnique({
      where: { employeeId },
    });

    if (existing) {
      res.status(409).json({ error: 'Employee ID already exists.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const employee = await prisma.employee.create({
      data: {
        employeeId,
        name,
        password: hashedPassword,
        email: email || null,
        photo: photo || null,
      },
    });

    const token = jwt.sign(
      { id: employee.id, employeeId: employee.employeeId, role: employee.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Registration successful.',
      token,
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        role: employee.role,
        hasSchedule: employee.role !== 'EMPLOYEE',
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || !password) {
      res.status(400).json({ error: 'Employee ID and password are required.' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { employeeId },
    });

    if (!employee) {
      res.status(401).json({ error: 'Invalid employee ID or password.' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, employee.password);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid employee ID or password.' });
      return;
    }

    const token = jwt.sign(
      { id: employee.id, employeeId: employee.employeeId, role: employee.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    let hasSchedule = true;
    if (employee.role === 'EMPLOYEE') {
      const shiftCount = await prisma.shift.count({
        where: { employeeId: employee.id },
      });
      hasSchedule = shiftCount > 0;
    }

    res.status(200).json({
      message: 'Login successful.',
      token,
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        role: employee.role,
        hasSchedule,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        employeeId: true,
        name: true,
        role: true,
        photo: true,
        createdAt: true,
        email: true,
      },
    });

    if (!employee) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    let hasSchedule = true;
    if (employee.role === 'EMPLOYEE') {
      const shiftCount = await prisma.shift.count({
        where: { employeeId: employee.id },
      });
      hasSchedule = shiftCount > 0;
    }

    res.status(200).json({
      employee: {
        ...employee,
        hasSchedule,
      },
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}
