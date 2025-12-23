import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password, hashedPassword } = req.body;
    if (!password || !hashedPassword) {
      return res.status(400).json({ error: 'Password and hashedPassword required' });
    }
    const isValid = await bcrypt.compare(password, hashedPassword);
    res.json({ isValid });
  } catch (error: any) {
    console.error('Error verifying password:', error);
    res.status(500).json({ error: error.message || 'Failed to verify password' });
  }
}
