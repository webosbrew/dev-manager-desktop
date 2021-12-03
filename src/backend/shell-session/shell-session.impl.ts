import {ClientChannel} from "ssh2";
import {Shell} from "../../types";
import {Buffer} from "buffer";
import {cleanupSession} from "../../app/shared/util/ares-utils";
import {Session} from "../device-manager/device-manager.backend";

abstract class AbsShell {
  protected constructor(protected session: Session, protected stream: ClientChannel) {
    console.log('shell session created');
  }

  closed(): Promise<boolean> {
    return Promise.resolve(this.stream.destroyed);
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

  listen(event: 'close' | 'data', callback: (...args: any[]) => void): this {
    this.stream.on(event, callback);
    return this;
  }

}

export class RealShell extends AbsShell implements Shell {
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

export class SimulateShell extends AbsShell implements Shell {
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
      this.stream.emit('data', data);
      await this.streamWrite(data);
      return;
    }
    switch (data) {
      case '\r': {
        this.stream.emit('data', data);
        this.stream.emit('data', '\n');
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
