import {HeadersReceivedResponse, OnHeadersReceivedListenerDetails} from "electron";
import {session} from "@electron/remote";

function AllowCORSHandler(details: OnHeadersReceivedListenerDetails, callback: (resp: HeadersReceivedResponse) => void): void {
  details.responseHeaders['access-control-allow-origin'] = ['*'];
  callback({
    cancel: false,
    responseHeaders: {...details.responseHeaders}
  });
}

// noinspection HttpUrlsUsage
const filter = {
  urls: [
    'https://developer.lge.com/*',
    'https://repo.webosbrew.org/*',
    'http://*:9991/webos_rsa',
  ]
};

export function skipCORS() {
  session.defaultSession.webRequest.onHeadersReceived(filter, AllowCORSHandler);
}
