import { CloudTasksClient, protos } from '@google-cloud/tasks';

function createClient() {
  return new CloudTasksClient({
    projectId: process.env.GCLOUD_PROJECT_ID ?? 'saletend',
    credentials: {
      client_email: process.env.SERVICE_ACCOUNT_CLIENT,
      private_key: process.env.SERVICE_ACCOUNT_KEY?.split(String.raw`\n`).join('\n'),
    },
  });
}

export async function createCloudTask(
  httpRequest: protos.google.cloud.tasks.v2.IHttpRequest,
  inSeconds = 0,
  taskQueue = ''
) {
  const client = createClient();
  const project = process.env.GCLOUD_PROJECT_ID ?? 'saletend';
  const location = process.env.GCLOUD_LOCATION ?? 'us-central1';
  const parent = client.queuePath(project, location, taskQueue ?? '');

  const task: protos.google.cloud.tasks.v2.ITask = {
    httpRequest,
  };

  if (inSeconds) {
    task.scheduleTime = {
      seconds: inSeconds + Date.now() / 1000,
    };
  }

  const request: protos.google.cloud.tasks.v2.ICreateTaskRequest = {
    parent: parent,
    task: task,
  };

  try {
    // Send create task request.
    const [response] = await client.createTask(request);
    return response.name;
  } catch (err: any) {
    console.error(`Created task failed`, err.message);
    throw err;
  }
}

export async function createQueue(queue?: protos.google.cloud.tasks.v2.IQueue) {
  try {
    const client = createClient();
    const project = process.env.GCLOUD_PROJECT_ID ?? 'saletend';
    const location = process.env.GCLOUD_LOCATION ?? 'us-central1';
    const [response] = await client.createQueue({
      parent: client.locationPath(project, location),
      queue: { ...queue, name: client.queuePath(project, location, queue?.name ?? '') },
    });
    console.log('Queue', response.name, 'created');
    return response.name;
  } catch (err: any) {
    console.error(`Created queue failed`, err.message);
  }
}

export async function deleteQueue(queue: string) {
  try {
    const client = createClient();
    const project = process.env.GCLOUD_PROJECT_ID ?? 'saletend';
    const location = process.env.GCLOUD_LOCATION ?? 'us-central1';
    // Get the fully qualified path to the queue
    const name = client.queuePath(project, location, queue);
    // Send delete queue request.
    await client.deleteQueue({ name });
  } catch (err) {
    console.error(`Delete queue failed`);
  }
}
