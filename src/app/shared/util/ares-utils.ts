import { EventEmitter } from 'node:events';

function isNovacomListener(f: Function): boolean {
  return f.prototype != null;
}

export function cleanupSession() {
  let emitter: EventEmitter = process;
  for (let ev of ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGTERM', 'exit']) {
    emitter.listeners(ev)
      .filter(f => isNovacomListener(f))
      .forEach(fn => emitter.removeListener(ev, fn as any));
  }
}
