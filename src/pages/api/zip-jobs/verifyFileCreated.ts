import type { NextApiRequest, NextApiResponse } from 'next';
import { cleanFolder, isFileExist } from '@/utils/storage';
import { createCloudTask } from '@/utils/task-queue';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fileName, userId, pageToken, deleteFolder, count = 0, ...props } = req.body;
  console.log('🎁 Check if file created:', { fileName, userId, pageToken, deleteFolder, ...props });
  try {
    const isExist = await isFileExist(userId, fileName);
    if (isExist) {
      const task = await createCloudTask(
        {
          httpMethod: 'POST',
          url: (process.env.NGROK_URL ?? process.env.BASE_URL) + '/api/zip-jobs/createZipFile',
          headers: { 'Content-type': 'application/json' },
          body: Buffer.from(JSON.stringify(req.body)).toString('base64'),
        },
        0,
        process.env.TASK_FILE_QUEUE
      );
      console.log('Task verify completed created', task);

      if (!pageToken && deleteFolder) {
        console.log('Clean folder unused', deleteFolder);
        await cleanFolder(userId, deleteFolder);
      }
    } else {
      if (count < 100) {
        const task = await createCloudTask(
          {
            httpMethod: 'POST',
            url: (process.env.NGROK_URL ?? process.env.BASE_URL) + '/api/zip-jobs/verifyFileCreated',
            headers: { 'Content-type': 'application/json' },
            body: Buffer.from(JSON.stringify({ ...req.body, count: count + 1 })).toString('base64'),
          },
          5,
          process.env.ZIP_FILE_QUEUE
        );
        console.log('Task verify failed created', task);
      } else {
        console.log('Maximum verify File created check');
      }
    }
  } catch (err: any) {
    console.error(err?.message ?? 'Something when wrong');
    return res.status(500).json({ message: err?.message ?? 'Something when wrong' });
  }
  return res.status(200).json({ success: true });
}
