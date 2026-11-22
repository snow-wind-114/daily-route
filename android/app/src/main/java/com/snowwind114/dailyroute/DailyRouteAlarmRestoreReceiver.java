package com.snowwind114.dailyroute;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class DailyRouteAlarmRestoreReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        DailyRouteAlarmSchedulerPlugin.rescheduleAll(context);
    }
}
