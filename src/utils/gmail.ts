import { Buffer } from 'node:buffer';
import { JWT } from 'google-auth-library';
import { gmail_v1, google } from 'googleapis';
import { cleanFolder, createBucketIfNotExist, uploadFile } from './storage';
import { createCloudTask } from './task-queue';
import { createSupabaseAdmin } from './supabase-admin';

export async function saveMailsToGCloudStorage(
  userId: string,
  email: string,
  folder: string,
  pageToken?: string,
  index: number = 0
) {
  const supabaseAdmin = createSupabaseAdmin();
  const auth = new JWT({
    email: process.env.SERVICE_ACCOUNT_CLIENT,
    key: process.env.SERVICE_ACCOUNT_KEY?.split(String.raw`\n`).join('\n'),
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    subject: userId,
  });
  const gmail = google.gmail({ version: 'v1', auth: auth });

  let parsedEmails = [] as gmail_v1.Schema$Message[];
  let nextPageToken: string | null | undefined = null;
  try {
    const messageList = await gmail.users.messages.list({
      maxResults: Number(process.env.GMAIL_THREAD_LIMIT ?? 50), //limit must > 1
      userId: 'me',
      pageToken: pageToken,
      q: 'label: sent OR label:inbox',
    });

    parsedEmails = await Promise.all(
      messageList.data.messages
        ? messageList.data.messages.map(async (val: any) => {
            const response = await gmail.users.messages.get({ userId: 'me', id: val.id as string, format: 'raw' });
            return response.data;
          })
        : []
    );
    nextPageToken = messageList.data.nextPageToken;
  } catch (error) {
    await cleanFolder(userId, folder);
  }

  if (parsedEmails.length > 0) {
    const mbox = { value: '' };
    mbox.value = parsedEmails.map((mail) => {
      if (mail.raw && mail.threadId) {
        const threadDecimal = parseInt(mail.threadId, 16);
        return `From ${threadDecimal}@xxx Wed Mar 22 03:26:41 +0000 2023
X-GM-THRID: ${threadDecimal}
${Buffer.from(mail.raw, 'base64').toString('utf8')}`;
      }
      return '';
    }).join(`
      `);

    if (index === 0) {
      await createBucketIfNotExist(userId);
    }

    await uploadFile(userId, `${folder}/${index}.mbox`, mbox.value);
    mbox.value = '';
  }

  if (nextPageToken) {
    const task = await createCloudTask(
      {
        httpMethod: 'POST',
        url: (process.env.NGROK_URL ?? process.env.BASE_URL) + '/api/zip-jobs/createFileTask',
        headers: { 'Content-type': 'application/json' },
        body: Buffer.from(
          JSON.stringify({ userId, email, folder, pageToken: nextPageToken, index: index + 1 })
        ).toString('base64'),
      },
      0,
      process.env.TASK_FILE_QUEUE
    );
    console.log('Task created', task);
  } else {
    const { error } = await supabaseAdmin
      .from('workspace_users')
      .update({ backup_status: 'merging_files' })
      .eq('id', userId);
    if (error) throw error;

    const task = await createCloudTask(
      {
        httpMethod: 'POST',
        url: (process.env.NGROK_URL ?? process.env.BASE_URL) + '/api/zip-jobs/verifyFileCreated',
        headers: { 'Content-type': 'application/json' },
        body: Buffer.from(
          JSON.stringify({
            userId,
            email,
            oldFolder: folder,
            newFolder: `${Date.now()}`,
            fileName: `${folder}/${index}.mbox`,
          })
        ).toString('base64'),
      },
      5,
      process.env.ZIP_FILE_QUEUE
    );
    console.log('Task combine file in new folder created', task);
  }
}

export async function getUserProfile(userId: string) {
  const auth = new JWT({
    email: process.env.SERVICE_ACCOUNT_CLIENT,
    key: process.env.SERVICE_ACCOUNT_KEY?.split(String.raw`\n`).join('\n'),
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    subject: userId,
  });
  const gmail = google.gmail({ version: 'v1', auth: auth });

  const response = await gmail.users.getProfile({ userId: 'me' });

  return response ? response.data : null;
}
