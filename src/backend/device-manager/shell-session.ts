import {ClientChannel} from "ssh2";
import {Shell} from "../../types";

export class RealShell implements Shell {
  constructor(private stream: ClientChannel) {
  }

  get dumb(): boolean {
    return false;
  }

  get closed(): boolean {
    return this.stream.destroyed;
  }

  write(data: string): void {
    this.stream.write(data);
  }


  on(event: 'close' | 'data', callback: (...args: any[]) => void): this {
    this.stream.on(event, callback);
    return this;
  }


  close(): void {
    this.stream.end();
  }
}

export class SimulateShell implements Shell {
  private linebuf = '';
  private running = false;

  constructor(private stream: ClientChannel) {
  }

  get dumb(): boolean {
    return true;
  }

  get closed(): boolean {
    return this.stream.destroyed;
  }

  write(data: string): void {
    if (this.running) {
      if (data == '\r') {
        this.stream.write('\n', 'utf-8');
      } else {
        this.stream.write(data, 'utf-8');
      }
      return;
    }
    switch (data) {
      case '\r': {
        this.stream.emit('data', data);
        this.stream.write(this.linebuf.trim());
        this.stream.write('\n');
        this.linebuf = '';
        break;
      }
      case '\u0003': { // Ctrl+C
        this.stream.emit('data', '\r');
        this.stream.write('\n');
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

  on(event: 'close' | 'data', callback: (...args: any[]) => void): this {
    function convertData(this: Buffer) {
      return this.toString('utf-8').replace(/\n/g, '\n\r');
    }

    switch (event) {
      case 'data': {
        this.stream.on('data', (data: Buffer) => callback(convertData.bind(data)));
        break;
      }
      default:
        this.stream.on(event, callback);
    }
    return this;
  }


  close(): void {
    this.stream.end();
  }

}
