import * as novacom from '@webosose/ares-cli/lib/base/novacom';
import { ProtocolRequest, ProtocolResponse } from "electron";
import { Client, ClientChannel, ConnectConfig } from 'ssh2';
import { Device, Resolver } from '../types/novacom';
import * as util from 'util';
export function AresPullProtoHandler(request: ProtocolRequest, callback: ((response: Buffer | ProtocolResponse) => void)): void {
  const url = new URL(request.url);
  obtainSession(url.hostname).then(async ssh => {
    const exec = util.promisify(ssh.exec.bind(ssh));
    const channel: ClientChannel = await exec(`cat ${url.pathname}`, { pty: false });
    const buffers: Buffer[] = [];
    channel.on('data', (data: Buffer) => {
      buffers.push(data);
    });
    channel.on('close', () => {
      callback(Buffer.concat(buffers));
    });
  }).catch(error => {
    console.error(error);
    callback({ error: -1 });
  });
}

const sessions: Map<string, Client> = new Map();

async function obtainSession(target: string): Promise<Client> {
  if (sessions.has(target)) {
    return sessions.get(target);
  }
  const resolver = new novacom.Resolver() as any as Resolver;
  await util.promisify(resolver.load.bind(resolver))();
  const device = resolver.devices.find((device: Device) => device.name == target);
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
      keepaliveInterval: 15000, // 15s
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
