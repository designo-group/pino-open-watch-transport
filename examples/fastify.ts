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