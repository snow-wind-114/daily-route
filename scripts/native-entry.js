import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import {
  Directory,
  Encoding,
  Filesystem,
} from "@capacitor/filesystem";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Share } from "@capacitor/share";
const DailyRouteWidget = registerPlugin("DailyRouteWidget");
const DailyRouteDevice = registerPlugin("DailyRouteDevice");
const DailyRouteAlarmScheduler = registerPlugin("DailyRouteAlarmScheduler");

globalThis.DailyRouteNative = {
  App,
  Browser,
  Capacitor,
  DailyRouteWidget,
  DailyRouteDevice,
  DailyRouteAlarmScheduler,
  Directory,
  Encoding,
  Filesystem,
  LocalNotifications,
  Share,
};
