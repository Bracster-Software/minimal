// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { setFlagsFromString } from 'v8';
import { runInNewContext } from 'vm';
import { map } from 'lodash';
import fetch from 'node-fetch'

type Data = {
  name: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const response = await fetch('https://jsonplaceholder.typicode.com/photos', { method: "Get" });
  console.log('response', typeof (response.json()))
  console.log(
    'Memory used before 1:',
    map(process.memoryUsage(), (value, key) => `${key}: ${Math.round((value / 1024 / 1024) * 100) / 100} MB`)
  );
  console.log(
    'Memory used before 2:',
    map(process.memoryUsage(), (value, key) => `${key}: ${Math.round((value / 1024 / 1024) * 100) / 100} MB`)
  );
    try {
    setFlagsFromString('--expose-gc');
    const gc = runInNewContext('gc'); // nocommit
    gc();
  } catch (e) {
    console.log('`node --expose-gc index.js`');
    process.exit();
  }
  console.log(
    'Memory used after:',
    map(process.memoryUsage(), (value, key) => `${key}: ${Math.round((value / 1024 / 1024) * 100) / 100} MB`)
  );
  return res.status(200).json({ name: 'John Doe' })
}
