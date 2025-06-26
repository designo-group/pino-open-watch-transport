# @designo/pino-open-watch-transport

### Pino v7+ transport for sending logs to [Øpen Watch](https://github.com/designo-group/designo-open-watch) logs, built using [pino-abstract-transport](https://github.com/pinojs/pino-abstract-transport)

## Install

```
npm i pino-open-watch-transport
```

## Configuration

This transport expects the following options:

```ts
export interface PinoOpenwatchTransportOptions { 
  logGroupName: string,
  logStreamName: string,
  awsRegion?: string,
  awsAccessKeyId?: string,
  awsSecretAccessKey?: string,
  interval?: number
}
```
The transport, upon initialization, will create the LogGroup and LogStream with the names `logGroupName` and `logStreamName`, respectively, if they don't already exist.

After initializing the transport will start receiving logs from Pino formatting them in the format expected by OpenWatch:

```js
{
    timestamp: 1645381110905
    message: '{"level":30,"time":1645381110905,"pid":320325,"hostname":"service101","msg":"Hello, OpenWatch Logs!"}'
}
```

The transport will use the `time` property of the received log as the `timestamp` if it finds it, otherwise, it will use `Date.now()`.

The transport will store received logs in a buffer, and will flush them out to CloudWatch using a `PutLogEvents` call when one of the following conditions is met:

* The buffer has reached the size limit described in the AWS CloudWatch documentation.

* The number of logs in the buffer has reached the size limit of 10,000 logs as described in the AWS CloudWatch documentation.

* The transport has just received a log, and the last time a log has been stored before this one was longer than `interval` miliseconds.


## Usage

After installing, you can use the transport as follows:

```ts
import 'dotenv/config';
import pino from "pino";

const transport = pino.transport({
    target: 'pino-open-watch-transport',
    options: {
        logGroupName: 'pino-open-watch-test',
        logStreamName: 'pino-open-watch-test-stream',
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
        interval: 1_000, // this is the default
    }
});

const logger = pino(transport);

logger.info('Hello, OpenWatch Logs!');

```

With Fastify:

```ts
import Fastify from 'fastify';
import { request } from 'undici';
import pino from 'pino';

const transport = pino.transport({
    target: '@serdnam/pino-open-watch-transport',
    options: {
        logGroupName: 'pino-open-watch-test',
        logStreamName: 'pino-open-watch-test-stream',
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY
    }
});

const logger = pino(transport);

const server = Fastify({ logger });

server.get('/', async function(req, reply){
    req.log.info('Hello, OpenWatch Logs!');
    return { message: 'OK' };
});

await server.listen(8888);

await request('http://localhost:8888/');

await server.close();

```

## Credits

Adpated from [pino-cloudwatch-transport](https://github.com/serdnam/pino-cloudwatch-transport/tree/master) to fit for [OpenWatch](https://github.com/designo-group/designo-open-watch).


## License

Code licensed under the [MIT License](./LICENSE)
