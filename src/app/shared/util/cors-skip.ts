import { HeadersReceivedResponse, OnHeadersReceivedListenerDetails } from "electron";

export function AllowCORSHandler(details: OnHeadersReceivedListenerDetails, callback: (resp: HeadersReceivedResponse) => void): void {
  details.responseHeaders['access-control-allow-origin'] = ['*'];
  console.log({ ...details.responseHeaders });
  callback({
    cancel: false,
    responseHeaders: { ...details.responseHeaders }
  });
}
