// Adapted pino-cloudwatch-transport to use a custom HTTP endpoint instead of AWS SDK
import pThrottle from 'p-throttle';
import build from 'pino-abstract-transport';
import fetch from 'node-fetch';

export interface CustomLogTransportOptions {
  logGroupName: string,
  logStreamName: string,
  accessKeyId: string,
  secretAccessKey: string,
  endpoint?: string,
  interval?: number
}

interface Log {
  timestamp: number,
  message: string
}

export default async function (options: CustomLogTransportOptions) {
  const { logGroupName, logStreamName, endpoint } = options;
  const interval = options.interval || 1000;

  let sequenceToken: string | undefined;

  const { addLog, getLogs, wipeLogs, addErrorLog, orderLogs } = (function () {
    let lastFlush = Date.now();

    const MAX_EVENT_SIZE = 256 * 1024;
    const MAX_BUFFER_LENGTH = 10000;
    const MAX_BUFFER_SIZE = 1024 * 1024;

    const bufferedLogs: Log[] = [];

    function reachedNumberOfLogsLimit(): boolean {
      return bufferedLogs.length === MAX_BUFFER_LENGTH;
    }

    function reachedBufferSizeLimit(newLog: Log): boolean {
      const currentSize = bufferedLogs.reduce((acc, curr) => acc + curr.message.length + 26, 0);
      return (currentSize + newLog.message.length + 26) >= MAX_BUFFER_SIZE;
    }

    function logEventExceedsSize(log: Log): boolean {
      return log.message.length >= MAX_EVENT_SIZE;
    }

    function getLogs(): Log[] {
      return bufferedLogs;
    }

    function orderLogs(): void {
      bufferedLogs.sort((a, b) => a.timestamp - b.timestamp);
    }

    function shouldDoAPeriodicFlush() {
      const now = Date.now();
      const timeSinceLastFlush = now - lastFlush;
      lastFlush = now;
      return timeSinceLastFlush > interval;
    }

    function addLog(log: Log): boolean {
      if (logEventExceedsSize(log)) return false;
      if (!reachedBufferSizeLimit(log)) {
        bufferedLogs.push(log);
        return reachedNumberOfLogsLimit() || shouldDoAPeriodicFlush();
      } else {
        setImmediate(() => addLog(log));
        return true;
      }
    }

    async function addErrorLog(errorLog: { message: string, error: string }) {
      const shouldFlush = addLog({ timestamp: Date.now(), message: JSON.stringify(errorLog) });
      if (shouldFlush) await flush();
    }

    function wipeLogs(): void {
      bufferedLogs.length = 0;
    }

    return { addLog, getLogs, wipeLogs, addErrorLog, orderLogs };
  })();

  async function sendHttpLogBatch(logEvents: Log[]) {
    const res = await fetch(`${endpoint}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logGroupName, logStreamName, logEvents, sequenceToken })
    });
    const data = await res.json() as { nextSequenceToken?: string };
    sequenceToken = data.nextSequenceToken;
  }

  const throttle = pThrottle({ interval: 1000, limit: 1 });

  const flush = throttle(async function () {
    try {
      orderLogs();
      await sendHttpLogBatch(getLogs());
    } catch (e: any) {
      await addErrorLog({ message: 'custom-log-transport flushing error', error: e.message });
    } finally {
      wipeLogs();
    }
  });

  return build(async function (source) {
    for await (const obj of source) {
      try {
        const shouldFlush = addLog(obj);
        if (shouldFlush) {
          await flush();
          source.emit('flushed');
        }
      } catch (e) {
        console.error('ERROR', e);
        throw e;
      }
    }
  }, {
    parseLine: (line) => {
      let value;
      try {
        value = JSON.parse(line);
      } catch (e) {
        value = '{}';
      }
      return {
        timestamp: value.time || Date.now(),
        message: line
      };
    },
    close: async () => {
      await flush();
    }
  });
}
