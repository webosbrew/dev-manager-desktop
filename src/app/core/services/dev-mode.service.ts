import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ElectronService} from './electron.service';
import {firstValueFrom} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class DevModeService {

  constructor(
    electron: ElectronService,
    private http: HttpClient
  ) {
  }

  async checkDevMode(sessionToken: string): Promise<DevModeResponse> {
    return firstValueFrom(this.http.get(`https://developer.lge.com/secure/CheckDevModeSession.dev`, {
      params: {sessionToken},
      observe: 'body',
      responseType: 'json'
    })).then(body => body as DevModeResponse);
  }

  async resetDevMode(sessionToken: string): Promise<any> {
    return firstValueFrom(this.http.get(`https://developer.lge.com/secure/ResetDevModeSession.dev`, {
      params: {sessionToken},
      observe: 'body',
      responseType: 'json'
    }));
  }
}

export interface DevModeResponse {
  result: string;
  errorCode: string;
  errorMsg: string;
}
