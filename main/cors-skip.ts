import {HeadersReceivedResponse, OnHeadersReceivedListenerDetails} from 'electron';

function AllowCORSHandler(details: OnHeadersReceivedListenerDetails, callback: (resp: HeadersReceivedResponse) => void): void {
  if (details.responseHeaders == null) {
    details.responseHeaders = {};
  }
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
  ]
};

export function skipCORS(session: Electron.Session) {
  session.webRequest.onHeadersReceived(filter, AllowCORSHandler);
}
