import {ClientChannel} from "ssh2";
import {Shell} from "../../types";
import {Buffer} from "buffer";
import {cleanupSession} from "../../app/shared/util/ares-utils";

abstract class AbsShell {
  protected constructor(protected stream: ClientChannel) {
    console.log('shell session created');
  }

  closed(): Promise<boolean> {
    return Promise.resolve(this.stream.destroyed);
  }

  close(): Promise<void> {
    console.log('shell session closed');
    return new Promise<void>((resolve) => {
      this.stream.end(() => resolve());
    }).finally(() => cleanupSession());
  }

  listen(event: 'close' | 'data', callback: (...args: any[]) => void): this {
    this.stream.on(event, callback);
    return this;
  }

}

export class RealShell extends AbsShell implements Shell {
  constructor(stream: ClientChannel) {
    super(stream);
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

export class SimulateShell extends AbsShell implements Shell {
  private linebuf = '';
  private running = false;

  constructor(stream: ClientChannel) {
    super(stream);
  }

  dumb(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async write(data: string): Promise<void> {
    if (this.running) {
      if (data == '\r') {
        await this.streamWrite('\n');
      } else {
        await this.streamWrite(data);
      }
      return;
    }
    switch (data) {
      case '\r': {
        this.stream.emit('data', data);
        await this.streamWrite(this.linebuf.trim());
        await this.streamWrite('\n');
        this.linebuf = '';
        break;
      }
      case '\u0003': { // Ctrl+C
        this.stream.emit('data', '\r');
        await this.streamWrite('\n');
        this.linebuf = '';
        break;
      }
      case '\u007F': {
        if (!this.linebuf) return;
        // Backspace (DEL)
        // Do not delete the prompt
        this.linebuf = this.linebuf.slice(0, -1);
        this.stream.emit('data', '\b \b');
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
        this.stream.emit('data', data);
        break;
      }
    }
  }

  listen(event: 'close' | 'data', callback: (...args: any[]) => void): this {
    if (event === 'data') {
      this.stream.on('data', (data: Buffer) => {
        callback(data.toString('utf-8').replace(/\n/g, '\n\r'));
      });
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
