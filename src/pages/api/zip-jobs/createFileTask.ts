import { NextApiRequest, NextApiResponse } from 'next';
import { saveMailsToGCloudStorage } from '@/utils/gmail';
import { createSupabaseAdmin } from '@/utils/supabase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId, email, folder, pageToken, index = 0 } = req.body;
  console.log('🎁 Create file task:', { userId, email, folder, pageToken, index });
  const supabaseAdmin = createSupabaseAdmin();

  try {
    await saveMailsToGCloudStorage(userId, email, folder, pageToken, index);
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error(err?.message ?? 'Something when wrong');
    const { error } = await supabaseAdmin.from('workspace_users').update({ backup_status: 'failed' }).eq('id', userId);
    if (error) throw error;
    return res.status(500).json({ message: err?.message ?? 'Something when wrong' });
  }
}
