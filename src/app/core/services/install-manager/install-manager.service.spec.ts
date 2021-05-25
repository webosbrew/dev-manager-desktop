import { TestBed } from '@angular/core/testing';

import { InstallManagerService } from './install-manager.service';

describe('InstallManagerService', () => {
  let service: InstallManagerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InstallManagerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
