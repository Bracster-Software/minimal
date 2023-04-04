// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { setFlagsFromString } from 'v8';
import { runInNewContext } from 'vm';
import { map } from 'lodash';

type Data = {
  name: string
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
    try {
    setFlagsFromString('--expose_gc');
    const gc = runInNewContext('gc'); // nocommit
    gc();
  } catch (e) {
    console.log('`node --expose-gc index.js`');
    process.exit();
  }
  console.log(
    'Memory used: ',
    map(process.memoryUsage(), (value, key) => `${key}: ${Math.round((value / 1024 / 1024) * 100) / 100} MB`)
  );
  return res.status(200).json({ name: 'John Doe' })
}
