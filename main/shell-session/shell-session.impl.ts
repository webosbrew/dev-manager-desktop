import {ClientChannel} from "ssh2";
import {Shell} from "../types";
import {Buffer} from "buffer";
import {cleanupSession} from "../util/ares-utils";
import {Terminal} from 'xterm-headless';
import {promises} from '@webosbrew/ares-lib';
import Session = promises.Session;

abstract class AbsShell implements Shell {

  private terminal: Terminal;

  protected constructor(protected session: Session, protected stream: ClientChannel) {
    console.log('shell session created');
    this.terminal = new Terminal();
    this.listen('data', (chunk: string) => {
      this.terminal.write(chunk);
    });
  }

  abstract dumb(): Promise<boolean>;

  abstract write(data: string): Promise<void>;

  closed(): Promise<boolean> {
    return Promise.resolve(this.stream.destroyed);
  }

  listen(event: 'close' | 'data', callback: (...args: any[]) => void): this {
    this.stream.on(event, callback);
    return this;
  }

  async buffer(): Promise<string> {
    const active = this.terminal.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < active.length; i++) {
      lines.push(active.getLine(i).translateToString(true));
    }
    for (let i = active.length - 1; i >= 0; i--) {
      if (lines[i]) {
        lines.splice(i + 1, active.length - (i + 1));
        break;
      }
    }
    return Promise.resolve(lines.join('\r\n'));
  }

  resize(rows: number, cols: number, height: number, width: number): Promise<void> {
    this.stream.setWindow(rows, cols, height, width);
    this.terminal.resize(rows, cols);
    return Promise.resolve();
  }

  async close(): Promise<void> {
    console.log('shell session closed');
    return await new Promise<void>((resolve) => {
      this.stream.end(() => resolve());
    }).finally(() => {
      this.session.end();
      cleanupSession();
    });
  }

  protected termWrite(data: string) {
    this.stream.emit('data', data);
  }

}

export class RealShell extends AbsShell {
  constructor(session: Session, stream: ClientChannel) {
    super(session, stream);
  }

  dumb(): Promise<boolean> {
    return Promise.resolve(false);
  }

  write(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stream.write(data, 'utf-8', error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

}

export class SimulateShell extends AbsShell {
  private linebuf = '';
  private running = false;

  constructor(session: Session, stream: ClientChannel) {
    super(session, stream);
  }

  async close(): Promise<void> {
    await this.streamWrite('\x03');
    return await super.close();
  }

  dumb(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async write(data: string): Promise<void> {
    if (this.running) {
      this.termWrite(data);
      await this.streamWrite(data);
      return;
    }
    switch (data) {
      case '\r': {
        this.termWrite(data);
        this.termWrite('\n');
        await this.streamWrite(this.linebuf.trim());
        await this.streamWrite('\n');
        this.linebuf = '';
        break;
      }
      case '\u0003': { // Ctrl+C
        this.termWrite('\r');
        await this.streamWrite('\n');
        this.linebuf = '';
        break;
      }
      case '\u007F': {
        if (!this.linebuf) return;
        // Backspace (DEL)
        // Do not delete the prompt
        this.linebuf = this.linebuf.slice(0, -1);
        this.termWrite('\b \b');
        break;
      }
      case '\u001b[A':
      case '\u001b[B':
      case '\u001b[C':
      case '\u001b[D': {
        // Arrows
        break;
      }
      case '\t': {
        break;
      }
      default: {
        this.linebuf += data;
        this.termWrite(data);
        break;
      }
    }
  }

  listen(event: 'close' | 'data', callback: (...args: any[]) => void): this {
    if (event === 'data') {
      const dataCb = (data: Buffer) => {
        callback(data.toString('utf-8').replace(/\n/g, '\n\r'));
      };
      this.stream.on('data', dataCb);
      this.stream.stderr.on('data', dataCb);
      return this;
    }
    return super.listen(event, callback);
  }

  private streamWrite(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stream.write(data, 'utf-8', error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

}
