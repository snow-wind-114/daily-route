package com.snowwind114.dailyroute;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.util.Date;
import org.json.JSONArray;
import org.json.JSONObject;

public class DailyRouteAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (
            intent == null ||
            !DailyRouteAlarmSchedulerPlugin.ACTION_FIRE.equals(
                intent.getAction()
            )
        ) {
            return;
        }
        String jobId = intent.getStringExtra(
            DailyRouteAlarmSchedulerPlugin.EXTRA_JOB_ID
        );
        String sourceId = intent.getStringExtra(
            DailyRouteAlarmSchedulerPlugin.EXTRA_SOURCE_ID
        );
        if (jobId == null || sourceId == null) {
            return;
        }
        JSONObject job = findJob(context, jobId);
        if (job != null) {
            DailyRouteAlarmSchedulerPlugin.showNotification(context, job);
            if (job.optBoolean("test", false)) {
                DailyRouteAlarmSchedulerPlugin.removeTestJob(context, jobId);
            }
        }
        DailyRouteAlarmSchedulerPlugin.scheduleNextForSource(
            context,
            sourceId
        );
    }

    private JSONObject findJob(Context context, String jobId) {
        String stored = context
            .getSharedPreferences(
                DailyRouteAlarmSchedulerPlugin.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            .getString(DailyRouteAlarmSchedulerPlugin.JOBS_KEY, "[]");
        try {
            JSONArray jobs = new JSONArray(stored);
            for (int index = 0; index < jobs.length(); index += 1) {
                JSONObject job = jobs.optJSONObject(index);
                if (job != null && jobId.equals(job.optString("id"))) {
                    return job;
                }
            }
        } catch (Exception ignored) {
            // Invalid storage is handled by the next foreground sync.
        }
        return null;
    }
}
