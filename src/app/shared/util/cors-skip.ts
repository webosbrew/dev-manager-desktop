import { HeadersReceivedResponse, OnHeadersReceivedListenerDetails } from "electron";

export function AllowCORSHandler(details: OnHeadersReceivedListenerDetails, callback: (resp: HeadersReceivedResponse) => void): void {
  details.responseHeaders['access-control-allow-origin'] = ['*'];
  callback({
    cancel: false,
    responseHeaders: { ...details.responseHeaders }
  });
}
