import {WebLinksAddon} from "xterm-addon-web-links";
import {open} from "@tauri-apps/plugin-shell";
import {noop} from "rxjs";

export class AppWebLinksAddon extends WebLinksAddon {
  constructor() {
    super((event, uri) => {
      event.preventDefault();
      open(uri).then(noop);
    });
  }
}
