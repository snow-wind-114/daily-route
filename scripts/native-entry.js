import { Capacitor } from "@capacitor/core";
import {
  Directory,
  Encoding,
  Filesystem,
} from "@capacitor/filesystem";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Share } from "@capacitor/share";

globalThis.DailyRouteNative = {
  Capacitor,
  Directory,
  Encoding,
  Filesystem,
  LocalNotifications,
  Share,
};
