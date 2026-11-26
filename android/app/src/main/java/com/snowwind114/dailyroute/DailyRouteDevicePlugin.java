package com.snowwind114.dailyroute;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "DailyRouteDevice")
public class DailyRouteDevicePlugin extends Plugin {
    private static final String NOTIFICATION_CHANNEL_ID =
        "daily-route-notifications-v1";
    private static final String ALARM_CHANNEL_ID = "daily-route-alarms-v1";

    @PluginMethod
    public void getReminderDiagnostics(PluginCall call) {
        Context context = getContext();
        NotificationManager notifications = context.getSystemService(
            NotificationManager.class
        );
        JSObject result = new JSObject();
        result.put("sdkInt", Build.VERSION.SDK_INT);
        result.put(
            "notificationsEnabled",
            notifications != null && notifications.areNotificationsEnabled()
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && notifications != null) {
            putChannelState(
                result,
                "notificationChannel",
                notifications.getNotificationChannel(NOTIFICATION_CHANNEL_ID)
            );
            putChannelState(
                result,
                "alarmChannel",
                notifications.getNotificationChannel(ALARM_CHANNEL_ID)
            );
        }

        AlarmManager alarms = (AlarmManager) context.getSystemService(
            Context.ALARM_SERVICE
        );
        result.put(
            "exactAlarmGranted",
            Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
                (alarms != null && alarms.canScheduleExactAlarms())
        );
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        String channelId = call.getString("channelId");
        Intent intent;
        if (
            channelId != null &&
            !channelId.isBlank() &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        ) {
            intent = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            intent.putExtra(Settings.EXTRA_CHANNEL_ID, channelId);
        } else {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getFocusLockStatus(PluginCall call) {
        call.resolve(focusLockStatus());
    }

    @PluginMethod
    public void openFocusLockSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void listLaunchableApps(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> resolved = getContext()
            .getPackageManager()
            .queryIntentActivities(intent, 0);
        Map<String, String> labels = new HashMap<>();
        for (ResolveInfo item : resolved) {
            if (item.activityInfo == null) {
                continue;
            }
            String packageName = item.activityInfo.packageName;
            if (
                packageName == null ||
                packageName.equals(getContext().getPackageName()) ||
                labels.containsKey(packageName)
            ) {
                continue;
            }
            CharSequence label = item.loadLabel(
                getContext().getPackageManager()
            );
            labels.put(
                packageName,
                label == null ? packageName : label.toString()
            );
        }
        List<JSObject> apps = new ArrayList<>();
        for (Map.Entry<String, String> entry : labels.entrySet()) {
            JSObject item = new JSObject();
            item.put("packageName", entry.getKey());
            item.put("label", entry.getValue());
            apps.add(item);
        }
        Collections.sort(
            apps,
            (left, right) ->
                left.getString("label").compareToIgnoreCase(
                    right.getString("label")
                )
        );
        JSArray result = new JSArray();
        for (JSObject item : apps) {
            result.put(item);
        }
        JSObject response = new JSObject();
        response.put("apps", result);
        call.resolve(response);
    }

    @PluginMethod
    public void setFocusLockAllowedPackages(PluginCall call) {
        DailyRouteFocusLock.setAllowedPackages(
            getContext(),
            readablePackageList(call.getArray("allowedPackages"))
        );
        call.resolve(focusLockStatus());
    }

    @PluginMethod
    public void setFocusLock(PluginCall call) {
        DailyRouteFocusLock.setAllowedPackages(
            getContext(),
            readablePackageList(call.getArray("allowedPackages"))
        );
        DailyRouteFocusLock.setActive(
            getContext(),
            Boolean.TRUE.equals(call.getBoolean("enabled"))
        );
        call.resolve(focusLockStatus());
    }

    @PluginMethod
    public void openFocusAllowedApp(PluginCall call) {
        String packageName = call.getString("packageName", "").trim();
        if (
            packageName.isEmpty() ||
            !DailyRouteFocusLock.getAllowedPackages(getContext()).contains(
                packageName
            )
        ) {
            call.reject("这个应用不在专注白名单中");
            return;
        }
        Intent launch = getContext()
            .getPackageManager()
            .getLaunchIntentForPackage(packageName);
        if (launch == null) {
            call.reject("无法打开这个应用");
            return;
        }
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(launch);
        call.resolve();
    }

    @PluginMethod
    public void setFocusMode(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled"));
        if (getActivity() == null) {
            call.reject("当前页面不可用");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (enabled) {
                getActivity().getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                );
                getActivity().getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
                    View.SYSTEM_UI_FLAG_FULLSCREEN |
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                );
            } else {
                getActivity().getWindow().clearFlags(
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                );
                getActivity().getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_VISIBLE
                );
            }
            call.resolve();
        });
    }

    private JSObject focusLockStatus() {
        JSObject result = new JSObject();
        result.put(
            "serviceEnabled",
            DailyRouteFocusLock.isServiceEnabled(getContext())
        );
        JSArray allowed = new JSArray();
        for (String packageName : DailyRouteFocusLock.getAllowedPackages(
            getContext()
        )) {
            allowed.put(packageName);
        }
        result.put("allowedPackages", allowed);
        return result;
    }

    private List<String> readablePackageList(JSArray values) {
        List<String> packages = new ArrayList<>();
        if (values == null) {
            return packages;
        }
        for (int index = 0; index < values.length(); index += 1) {
            String packageName = values.optString(index, "").trim();
            if (!packageName.isEmpty()) {
                packages.add(packageName);
            }
        }
        return packages;
    }

    private void putChannelState(
        JSObject result,
        String key,
        NotificationChannel channel
    ) {
        JSObject state = new JSObject();
        state.put("exists", channel != null);
        state.put("importance", channel == null ? -1 : channel.getImportance());
        result.put(key, state);
    }
}
