import { EventEmitter } from 'node:events';

function isNovacomListener(f: any): boolean {
  return f.prototype != null;
}

export function cleanupSession() {
  const emitter: EventEmitter = process;
  for (const ev of ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGTERM', 'exit']) {
    emitter.listeners(ev)
      .filter(f => isNovacomListener(f))
      .forEach(fn => emitter.removeListener(ev, fn as any));
  }
}
