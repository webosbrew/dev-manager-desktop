import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ElectronService } from './electron.service';

@Injectable({
  providedIn: 'root'
})
export class DevModeService {

  constructor(
    electron: ElectronService,
    private http: HttpClient
  ) {
    const session = electron.remote.session;
    const filter = {
      urls: ['https://developer.lge.com/*']
    };
    session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
      callback({
        cancel: false,
        responseHeaders: {
          ...details.responseHeaders,
          'Access-Control-Allow-Origin': ['*']
        }
      });
    });
  }

  async checkDevMode(sessionToken: string): Promise<DevModeResponse> {
    return this.http.get(`https://developer.lge.com/secure/CheckDevModeSession.dev`, {
      params: { sessionToken },
      observe: 'body',
      responseType: 'json'
    }).toPromise().then(body => body as DevModeResponse);
  }

  async resetDevMode(sessionToken: string): Promise<any> {
    return this.http.get(`https://developer.lge.com/secure/ResetDevModeSession.dev`, {
      params: { sessionToken },
      observe: 'body',
      responseType: 'json'
    }).toPromise();
  }
}

export interface DevModeResponse {
  result: string;
  errorCode: string;
  errorMsg: string;
}
