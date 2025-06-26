import 'dotenv/config';
import pino from "pino";

const transport = pino.transport({
    target: '@serdnam/pino-cloudwatch-transport',
    options: {
        logGroupName: 'test2',
        logStreamName: 'test2-stream',
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY
    }
});

const logger = pino(transport);

logger.info('Hello, OpenWatch Logs!');