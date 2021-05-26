import * as novacom from '@webosose/ares-cli/lib/base/novacom';
import { ProtocolRequest, ProtocolResponse } from "electron";
import { Config, NodeSSH } from 'node-ssh';
import { Device, Resolver } from '../src/types/novacom';

export function AresPullProtoHandler(request: ProtocolRequest, callback: ((response: Buffer | ProtocolResponse) => void)): void {
  const url = new URL(request.url);
  newSession(url.hostname).then(ssh => {
    ssh.exec('cat', [url.pathname], { stream: 'stdout', encoding: 'binary' }).then(stdout => {
      callback(Buffer.from(stdout, 'binary'));
    });
  }).catch(error => {
    console.error(error);
    callback({ error: -1 });
  });
}


async function newSession(target: string): Promise<NodeSSH> {
  return new Promise<Device>((resolve, reject) => {
    const resolver = new novacom.Resolver() as any as Resolver;
    resolver.load((error) => {
      if (error) {
        reject(error);
      } else {
        resolve(resolver.devices.find(device => device.name == target));
      }
    });
  }).then(device => {
    const config: Config = {
      host: device.host,
      port: device.port,
      username: device.username
    };
    if (device.privateKey) {
      config.privateKey = device.privateKey.toString('utf-8');
      config.passphrase = device.passphrase;
    } else {
      config.password = device.password;
    }
    return new NodeSSH().connect(config);
  });
}
