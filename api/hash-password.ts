import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    res.json({ hashedPassword });
  } catch (error: any) {
    console.error('Error hashing password:', error);
    res.status(500).json({ error: error.message || 'Failed to hash password' });
  }
}
