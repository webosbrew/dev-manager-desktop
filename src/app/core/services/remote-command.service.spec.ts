import {RemoteCommandService} from "./remote-command.service";
import {TestBed} from "@angular/core/testing";
import {NewDeviceWithLocalPrivateKey} from "../../types";
import objectContaining = jasmine.objectContaining;

describe('RemoteCommandService', () => {
  let service: RemoteCommandService;
  let device = <NewDeviceWithLocalPrivateKey>{
    name: 'test',
    host: '192.168.89.33',
    port: 22,
    username: 'root',
    profile: 'ose',
    privateKey: {
      openSsh: 'id_rsa'
    }
  };

  beforeEach(() => {
    service = TestBed.inject(RemoteCommandService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should successfully perform uname command', async () => {
    let output = service.exec(device, 'uname -a', 'utf-8');
    await expectAsync(output).toBeResolved();
  });

  it('should run false command with exception', async () => {
    let output = service.exec(device, 'false', 'utf-8');
    await expectAsync(output).toBeRejected();
  });
});
