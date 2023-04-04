import type { NextApiRequest, NextApiResponse } from 'next';
import { composeFilesInBucket, getFilesInFolder, copyFile, cleanFolder } from '@/utils/storage';
import { createSupabaseAdmin } from '@/utils/supabase-admin';
import { createCloudTask } from '@/utils/task-queue';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId, email, oldFolder, newFolder, index = 0, pageToken } = req.body;
  console.log('🎁 Create zip file task for user:', { userId, email, oldFolder, newFolder, index });
  const supabaseAdmin = createSupabaseAdmin();

  try {
    const filePaginate = await getFilesInFolder(userId, oldFolder, pageToken);

    // all files combined
    if (index === 0 && filePaginate.files.length === 1 && !filePaginate.pageToken) {
      await copyFile(userId, `${oldFolder}/${index}.mbox`, `${email}--at--${oldFolder}.mbox`);
      await cleanFolder(userId, oldFolder);
      const { data: user, error } = await supabaseAdmin.from('workspace_users').select().eq('id', userId).single();
      if (error) throw error;
      if (user) {
        const { error } = await supabaseAdmin
          .from('workspace_users')
          .update({
            backup_status: 'complete',
            backup_links: [...(user.backup_links ?? []), `${email}--at--${oldFolder}.mbox`],
            last_backup: new Date().toISOString(),
          })
          .eq('id', userId);
        if (error) throw error;
      } else {
        throw new Error('User not found');
      }
    } else if (filePaginate.files.length > 0) {
      await composeFilesInBucket(userId, filePaginate.files, `${newFolder}/${index}.mbox`);

      if (filePaginate.pageToken) {
        const task = await createCloudTask(
          {
            httpMethod: 'POST',
            url: (process.env.NGROK_URL ?? process.env.BASE_URL) + '/api/zip-jobs/verifyFileCreated',
            headers: { 'Content-type': 'application/json' },
            body: Buffer.from(
              JSON.stringify({
                userId,
                email,
                oldFolder,
                newFolder,
                index: index + 1,
                pageToken: filePaginate.pageToken,
                fileName: `${newFolder}/${index}.mbox`,
              })
            ).toString('base64'),
          },
          5,
          process.env.ZIP_FILE_QUEUE
        );
        console.log('Task combine file in old folder created', task);
      } else {
        const task = await createCloudTask(
          {
            httpMethod: 'POST',
            url: (process.env.NGROK_URL ?? process.env.BASE_URL) + '/api/zip-jobs/verifyFileCreated',
            headers: { 'Content-type': 'application/json' },
            body: Buffer.from(
              JSON.stringify({
                userId,
                email,
                oldFolder: newFolder,
                newFolder: `${Date.now()}`,
                deleteFolder: oldFolder,
                fileName: `${newFolder}/${index}.mbox`,
              })
            ).toString('base64'),
          },
          5,
          process.env.ZIP_FILE_QUEUE
        );
        console.log('Task combine file in new folder created', task);
      }
    } else {
      console.log('Folder is empty', oldFolder);
      const { error } = await supabaseAdmin
        .from('workspace_users')
        .update({ backup_status: 'failed' })
        .eq('id', userId);
      if (error) throw error;
    }
  } catch (err: any) {
    console.error(err?.message ?? 'Something when wrong');
    const { error } = await supabaseAdmin.from('workspace_users').update({ backup_status: 'failed' }).eq('id', userId);
    if (error) throw error;
    return res.status(500).json({ message: err?.message ?? 'Something when wrong' });
  }
  return res.status(200).json({ success: true });
}
