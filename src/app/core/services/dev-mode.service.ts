import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DevModeService {

  constructor(private http: HttpClient) {
  }

  async checkDevMode(sessionToken: string): Promise<DevModeResponse> {
    return this.http.get<DevModeResponse>(`https://developer.lge.com/secure/CheckDevModeSession.dev`, {
      params: {sessionToken},
      observe: 'body',
      responseType: 'json'
    }).toPromise();
  }

  async resetDevMode(sessionToken: string): Promise<any> {
    return this.http.get(`https://developer.lge.com/secure/ResetDevModeSession.dev`, {
      params: {sessionToken},
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
