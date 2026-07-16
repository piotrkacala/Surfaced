import "../../shared/settings.js";
import "../../shared/session-pause.js";
import { setCaptureReady } from "./shared/capture-state.mjs";
import { installBrowserStub } from "./shared/browser-stub.mjs";

installBrowserStub();
await import("../../shared/settings-import/settings-import.js");
setCaptureReady();
