import {Device, promises} from '@webosbrew/ares-lib';
import AsyncLock from 'async-lock';
import {ProtocolRequest, ProtocolResponse} from "electron";
import {Client, ClientChannel, ConnectConfig} from 'ssh2';
import util from 'util';
import Resolver = promises.Resolver;


const lock: AsyncLock = new AsyncLock();

export function AresPullProtoHandler(request: ProtocolRequest, callback: ((response: Buffer | ProtocolResponse) => void)): void {
  const url = new URL(request.url);
  lock.acquire(url.hostname, async (done) => {
    try {
      const ssh = await obtainSession(url.hostname);
      const exec = util.promisify(Client.prototype.exec).bind(ssh);
      const channel: ClientChannel = await exec(`cat ${url.pathname}`, {pty: false});
      const buffers: Buffer[] = [];
      channel.on('data', (data: Buffer) => {
        buffers.push(data);
      });
      channel.on('close', () => {
        done(null, Buffer.concat(buffers));
      });
    } catch (e) {
      done(e, null);
    }
  }).then((buffer) => callback(buffer), (reason) => {
    console.log(reason);
    callback(null);
  });
}

const sessions: Map<string, Client> = new Map();

async function obtainSession(target: string): Promise<Client> {
  if (sessions.has(target)) {
    return Promise.resolve(sessions.get(target));
  }
  const resolver = new Resolver();
  await resolver.load();
  const device = resolver.devices.find((device: Device) => device.name == target);
  if (!device) {
    throw new Error(`Device ${target} not found`);
  }
  const client = new Client();
  return new Promise<Client>((resolve, reject) => {
    client.on('ready', () => {
      resolve(client);
      sessions.set(target, client);
    });
    client.on('error', (error) => {
      reject(error);
    });
    client.on('close', () => {
      sessions.delete(target);
    });

    const config: ConnectConfig = {
      host: device.host,
      port: device.port,
      username: device.username,
      keepaliveInterval: 0, // disable keep-alive
    };
    if (device.privateKey) {
      config.privateKey = device.privateKey;
      config.passphrase = device.passphrase;
    } else {
      config.password = device.password;
    }
    client.connect(config);
  });
}
