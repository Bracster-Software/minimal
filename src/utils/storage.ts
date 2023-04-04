import { File, Storage } from '@google-cloud/storage';
import moment from 'moment';

function createStorage() {
  return new Storage({
    projectId: process.env.GCLOUD_PROJECT_ID ?? 'saletend',
    credentials: {
      client_email: process.env.SERVICE_ACCOUNT_CLIENT,
      private_key: process.env.SERVICE_ACCOUNT_KEY?.split(String.raw`\n`).join('\n'),
    },
  });
}

export async function createBucketIfNotExist(bucketName: string) {
  try {
    const isBucketExist = await bucketExist(bucketName);
    if (!isBucketExist) {
      const storage = createStorage();
      await storage.createBucket(bucketName);
      // Creates the new bucket
      console.log(`Bucket ${bucketName} created.`);
    }
  } catch (error) {
    console.log('Create bucket failed', error);
    throw error;
  }
}

export async function uploadFile(bucketName: string, fileName: string, fileContent: string) {
  try {
    const storage = createStorage();
    const bucket = storage.bucket(bucketName);

    const file = bucket.file(fileName);
    await new Promise((res, rej) => {
      file.save(fileContent, { contentType: 'application/mbox' }, (err) => {
        if (!err) {
          res(null);
        } else {
          rej(err);
        }
      });
    });
  } catch (error) {
    console.log('File upload failed', error);
    throw error;
  }
}

export async function downloadFile(bucketName: string, fileName: string) {
  try {
    const storage = createStorage();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    const isExist = await file.exists();
    if (isExist) return file;
    throw new Error(`File ${fileName} not exist`);
  } catch (error) {
    console.log('File upload failed', error);
    throw error;
  }
}

export async function createSignedUrl(bucketName: string, fileName: string) {
  try {
    const storage = createStorage();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    const isExist = await file.exists();
    if (isExist) {
      const result = await file.getSignedUrl({
        action: 'read',
        expires: moment().add(1, 'days').toDate(),
      });
      return result[0];
    }
    throw new Error(`File ${fileName} not exist`);
  } catch (error) {
    console.log('File upload failed', error);
    throw error;
  }
}

export async function isFileExist(bucketName: string, fileName: string) {
  try {
    const storage = createStorage();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    const isExist = await file.exists();
    return isExist[0];
  } catch (error) {
    console.log('File upload failed', error);
    throw error;
  }
}

export async function copyFile(bucketName: string, file: string, target: string) {
  try {
    console.log('Copy file', file, target);
    const storage = createStorage();
    const bucket = storage.bucket(bucketName);
    const fromFile = bucket.file(file);
    const isExist = await fromFile.exists();
    if (isExist[0]) {
      await fromFile.copy(bucket.file(target));
    } else {
      throw new Error('File not existed to copy');
    }
  } catch (error) {
    console.log('File upload failed', error);
    throw error;
  }
}

export async function deleteFile(bucketName: string, fileName: string) {
  try {
    const storage = createStorage();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    await file.delete({ ignoreNotFound: true });
  } catch (error) {
    console.log('File upload failed', error);
    throw error;
  }
}

export async function bucketExist(bucketName: string) {
  try {
    const storage = createStorage();
    const bucket = storage.bucket(bucketName);
    const result = await bucket.exists();
    return result?.[0];
  } catch (error) {
    console.log('File upload failed', error);
    throw error;
  }
}

export async function getFilesInFolder(bucketName: string, folder: string, pageToken?: string) {
  try {
    const storage = createStorage();
    const bucket = storage.bucket(bucketName);
    const data = await bucket.getFiles({
      prefix: `${folder}`,
      maxResults: Number(process.env.ZIP_FILE_COMBINE_LIMIT) ?? 32,
      pageToken,
    });
    const result = { files: [] as File[], pageToken: null } as { files: File[]; pageToken: string | null };
    if (data[0]) {
      result.files = data[0];
    }
    if ((data?.[1] as any)?.pageToken) {
      result.pageToken = (data[1] as any).pageToken as string;
    }

    return result;
  } catch (error) {
    console.error('File upload failed', error);
    throw error;
  }
}

export async function cleanFolder(bucketName: string, folder: string) {
  try {
    const storage = createStorage();
    const bucket = storage.bucket(bucketName);
    await bucket.deleteFiles({ prefix: `${folder}/` });
  } catch (error) {
    console.error('File upload failed', error);
    throw error;
  }
}

export async function composeFilesInBucket(bucketName: string, files: File[], fileName: string) {
  try {
    const storage = createStorage();
    const bucket = storage.bucket(bucketName);
    const sources = files.sort();
    console.log("Combine files", sources.map(f => f.name))
    const resultFile = bucket.file(fileName);
    bucket.combine(sources, resultFile).then(function (data) {
      console.log('Combined file successed');
    });
    // Sleep to wait for api sent
    await new Promise((r) => setTimeout(r, 2000));
  } catch (error) {
    console.error('File upload failed', error);
    throw error;
  }
}
