import { TestBed } from '@angular/core/testing';

import { AppManagerService } from './app-manager.service';

describe('AppManagerService', () => {
  let service: AppManagerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppManagerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
