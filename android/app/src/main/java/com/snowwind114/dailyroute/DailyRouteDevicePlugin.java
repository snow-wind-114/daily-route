package com.snowwind114.dailyroute;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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
