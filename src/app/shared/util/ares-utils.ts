import {EventEmitter} from 'node:events';

function isNovacomListener(f: any): boolean {
  return f.prototype != null;
}

export function cleanupSession(): void {
  const emitter: EventEmitter = process;
  for (const ev of ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGTERM', 'exit']) {
    emitter.listeners(ev)
      .filter(f => isNovacomListener(f))
      // eslint-disable-next-line
      .forEach(fn => emitter.removeListener(ev, fn as any));
  }
}
