import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { saveMailsToGCloudStorage } from '@/utils/gmail';
import { createSupabaseAdmin } from '@/utils/supabase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.body;
  console.log('🎁 Backup User', id);
  const supabase = createSupabaseAdmin();

  try {
    const { data: user, error } = await supabase.from('workspace_users').select().eq('id', id).single();
    if (error) throw error;
    if (user) {
      const { error } = await supabase.from('workspace_users').update({ backup_status: 'saving_emails' }).eq('id', id);
      if (error) throw error;
      await saveMailsToGCloudStorage(id, user.email, `${Date.now()}`);
    } else {
      throw new Error('User not found');
    }
  } catch (err: any) {
    console.error(err?.message ?? 'Something when wrong');
    const { error } = await supabase.from('workspace_users').update({ backup_status: 'failed' }).eq('id', id);
    if (error) throw error;
    return res.status(500).json({ message: err?.message ?? 'Something when wrong' });
  }

  return res.status(200).json({ success: true });
}
