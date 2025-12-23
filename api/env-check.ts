import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.json({
    hasAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT,
    hasFolder: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
  });
}
