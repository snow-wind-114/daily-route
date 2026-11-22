package com.snowwind114.dailyroute;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "DailyRouteAlarmScheduler")
public class DailyRouteAlarmSchedulerPlugin extends Plugin {
    static final String PREFS_NAME = "daily_route_alarm_scheduler";
    static final String JOBS_KEY = "jobs";
    static final String LAST_ERROR_KEY = "last_error";
    static final String PENDING_SERIES_KEY = "pending_series_id";
    static final String PENDING_DATE_KEY = "pending_date";
    static final String PENDING_ORIGINAL_DATE_KEY = "pending_original_date";
    static final String PENDING_KIND_KEY = "pending_kind";
    static final String ACTION_FIRE =
        "com.snowwind114.dailyroute.ALARM_FIRE";
    static final String ACTION_OPEN =
        "com.snowwind114.dailyroute.ALARM_OPEN";
    static final String EXTRA_JOB_ID = "alarmJobId";
    static final String EXTRA_SOURCE_ID = "alarmSourceId";
    static final String EXTRA_DESTINATION_DATE = "alarmDestinationDate";
    static final String EXTRA_ORIGINAL_DATE = "alarmOriginalDate";
    static final String EXTRA_KIND = "alarmKind";
    static final String ALARM_CHANNEL_ID = "daily-route-alarms-v1";

    @PluginMethod
    public void syncJobs(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("闹钟任务为空");
            return;
        }
        try {
            JSONArray incoming = new JSONArray(json);
            SharedPreferences preferences = preferences();
            JSONArray previous = loadJobs(preferences);
            Set<String> previousProductionSources = new HashSet<>();
            for (int index = 0; index < previous.length(); index += 1) {
                JSONObject job = previous.optJSONObject(index);
                if (job != null && !job.optBoolean("test", false)) {
                    previousProductionSources.add(job.optString("sourceId"));
                }
            }
            for (String sourceId : previousProductionSources) {
                cancelPending(getContext(), sourceId);
            }

            JSONArray merged = new JSONArray();
            for (int index = 0; index < previous.length(); index += 1) {
                JSONObject job = previous.optJSONObject(index);
                if (job != null && job.optBoolean("test", false)) {
                    merged.put(job);
                }
            }
            for (int index = 0; index < incoming.length(); index += 1) {
                JSONObject job = incoming.optJSONObject(index);
                if (job != null) {
                    merged.put(job);
                }
            }
            preferences.edit().putString(JOBS_KEY, merged.toString()).apply();
            String error = rescheduleAll(getContext());
            preferences.edit().putString(LAST_ERROR_KEY, error).apply();
            call.resolve(diagnostics(getContext(), error));
        } catch (Exception error) {
            preferences().edit().putString(
                LAST_ERROR_KEY,
                "闹钟任务格式错误：" + error.getMessage()
            ).apply();
            call.reject("闹钟任务格式错误", error);
        }
    }

    @PluginMethod
    public void scheduleTest(PluginCall call) {
        String at = call.getString("at");
        if (at == null) {
            call.reject("测试闹钟时间无效");
            return;
        }
        try {
            if (parseDate(at).getTime() <= System.currentTimeMillis()) {
                call.reject("测试闹钟时间必须晚于当前时间");
                return;
            }
            JSONObject job = new JSONObject();
            String sourceId = "test-" + System.currentTimeMillis();
            job.put("id", sourceId);
            job.put("sourceId", sourceId);
            job.put("kind", "test");
            job.put("occurrenceDate", "");
            job.put("destinationDate", "");
            job.put("originalDate", "");
            job.put("at", at);
            job.put("title", call.getString("title", "闹钟提醒测试"));
            job.put("body", call.getString("body", "活动闹钟排程已生效。"));
            job.put("test", true);

            SharedPreferences preferences = preferences();
            JSONArray jobs = loadJobs(preferences);
            jobs.put(job);
            preferences.edit().putString(JOBS_KEY, jobs.toString()).apply();
            String error = scheduleJob(getContext(), job);
            preferences.edit().putString(LAST_ERROR_KEY, error).apply();
            if (error != null) {
                call.reject(error);
                return;
            }
            JSObject result = new JSObject();
            result.put("id", sourceId);
            result.put("at", at);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("无法安排测试闹钟", error);
        }
    }

    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        call.resolve(
            diagnostics(
                getContext(),
                preferences().getString(LAST_ERROR_KEY, null)
            )
        );
    }

    @PluginMethod
    public void clearAllJobs(PluginCall call) {
        SharedPreferences preferences = preferences();
        JSONArray jobs = loadJobs(preferences);
        for (int index = 0; index < jobs.length(); index += 1) {
            JSONObject job = jobs.optJSONObject(index);
            if (job != null) {
                cancelPending(getContext(), job.optString("sourceId"));
            }
        }
        preferences.edit().putString(JOBS_KEY, "[]").remove(LAST_ERROR_KEY).apply();
        call.resolve();
    }

    @PluginMethod
    public void consumePendingOpen(PluginCall call) {
        SharedPreferences preferences = preferences();
        String seriesId = preferences.getString(PENDING_SERIES_KEY, null);
        String date = preferences.getString(PENDING_DATE_KEY, null);
        String originalDate = preferences.getString(
            PENDING_ORIGINAL_DATE_KEY,
            null
        );
        String kind = preferences.getString(PENDING_KIND_KEY, "schedule");
        JSObject result = new JSObject();
        if (seriesId != null && date != null) {
            result.put("seriesId", seriesId);
            result.put("date", date);
            result.put(
                "originalDate",
                originalDate == null ? date : originalDate
            );
            result.put("kind", kind);
            preferences
                .edit()
                .remove(PENDING_SERIES_KEY)
                .remove(PENDING_DATE_KEY)
                .remove(PENDING_ORIGINAL_DATE_KEY)
                .remove(PENDING_KIND_KEY)
                .apply();
        }
        call.resolve(result);
    }

    @Override
    public void load() {
        JSObject pending = storePendingIntent(getActivity().getIntent());
        if (pending != null) {
            // The web layer consumes this through consumePendingOpen().
            pending.put("stored", true);
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        JSObject pending = storePendingIntent(intent);
        if (pending != null) {
            notifyListeners("alarmOpen", pending, false);
        }
    }

    private JSObject storePendingIntent(Intent intent) {
        if (
            intent == null ||
            !ACTION_OPEN.equals(intent.getAction())
        ) {
            return null;
        }
        String seriesId = intent.getStringExtra(EXTRA_SOURCE_ID);
        String date = intent.getStringExtra(EXTRA_DESTINATION_DATE);
        String originalDate = intent.getStringExtra(EXTRA_ORIGINAL_DATE);
        String kind = intent.getStringExtra(EXTRA_KIND);
        if (seriesId == null || date == null) {
            return null;
        }
        preferences()
            .edit()
            .putString(PENDING_SERIES_KEY, seriesId)
            .putString(PENDING_DATE_KEY, date)
            .putString(PENDING_ORIGINAL_DATE_KEY, originalDate)
            .putString(PENDING_KIND_KEY, kind == null ? "schedule" : kind)
            .apply();
        intent.removeExtra(EXTRA_SOURCE_ID);
        intent.removeExtra(EXTRA_DESTINATION_DATE);
        intent.removeExtra(EXTRA_ORIGINAL_DATE);
        intent.removeExtra(EXTRA_KIND);
        JSObject result = new JSObject();
        result.put("seriesId", seriesId);
        result.put("date", date);
        result.put("originalDate", originalDate == null ? date : originalDate);
        result.put("kind", kind == null ? "schedule" : kind);
        return result;
    }

    static String rescheduleAll(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(
            PREFS_NAME,
            Context.MODE_PRIVATE
        );
        JSONArray jobs = loadJobs(preferences);
        long now = System.currentTimeMillis();
        Map<String, JSONObject> nextBySource = new HashMap<>();
        for (int index = 0; index < jobs.length(); index += 1) {
            JSONObject job = jobs.optJSONObject(index);
            if (job == null) {
                continue;
            }
            try {
                long at = parseDate(job.getString("at")).getTime();
                if (at <= now) {
                    continue;
                }
                String sourceId = job.getString("sourceId");
                JSONObject current = nextBySource.get(sourceId);
                if (
                    current == null ||
                    parseDate(current.getString("at")).getTime() > at
                ) {
                    nextBySource.put(sourceId, job);
                }
            } catch (Exception ignored) {
                // Invalid jobs are ignored and reported through diagnostics.
            }
        }

        AlarmManager alarms = (AlarmManager) context.getSystemService(
            Context.ALARM_SERVICE
        );
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            (alarms == null || !alarms.canScheduleExactAlarms())
        ) {
            return "精确闹钟权限未开启";
        }
        String lastError = null;
        for (JSONObject job : nextBySource.values()) {
            String error = scheduleJob(context, job);
            if (error != null) {
                lastError = error;
            }
        }
        return lastError;
    }

    static String scheduleNextForSource(Context context, String sourceId) {
        SharedPreferences preferences = context.getSharedPreferences(
            PREFS_NAME,
            Context.MODE_PRIVATE
        );
        JSONArray jobs = loadJobs(preferences);
        long now = System.currentTimeMillis();
        JSONObject next = null;
        for (int index = 0; index < jobs.length(); index += 1) {
            JSONObject job = jobs.optJSONObject(index);
            if (
                job == null ||
                !sourceId.equals(job.optString("sourceId"))
            ) {
                continue;
            }
            try {
                long at = parseDate(job.getString("at")).getTime();
                if (at <= now) {
                    continue;
                }
                if (
                    next == null ||
                    parseDate(next.getString("at")).getTime() > at
                ) {
                    next = job;
                }
            } catch (Exception ignored) {
                // Skip an invalid occurrence and continue with later jobs.
            }
        }
        return next == null ? null : scheduleJob(context, next);
    }

    static String scheduleJob(Context context, JSONObject job) {
        try {
            AlarmManager alarms = (AlarmManager) context.getSystemService(
                Context.ALARM_SERVICE
            );
            if (
                alarms == null ||
                (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    !alarms.canScheduleExactAlarms()
                )
            ) {
                return "精确闹钟权限未开启";
            }
            long at = parseDate(job.getString("at")).getTime();
            if (at <= System.currentTimeMillis()) {
                return null;
            }
            PendingIntent pendingIntent = firePendingIntent(
                context,
                job.getString("sourceId"),
                job
            );
            alarms.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                at,
                pendingIntent
            );
            return null;
        } catch (Exception error) {
            return "安排闹钟失败：" + error.getMessage();
        }
    }

    static void showNotification(Context context, JSONObject job) {
        NotificationManager manager = context.getSystemService(
            NotificationManager.class
        );
        if (manager == null) {
            return;
        }
        ensureChannel(context);
        String sourceId = job.optString("sourceId");
        String destinationDate = job.optString("destinationDate");
        String originalDate = job.optString("originalDate", destinationDate);
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setAction(ACTION_OPEN);
        openIntent.setData(
            Uri.parse("daily-route://alarm/" + sourceId)
        );
        openIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        openIntent.putExtra(EXTRA_SOURCE_ID, sourceId);
        openIntent.putExtra(EXTRA_DESTINATION_DATE, destinationDate);
        openIntent.putExtra(EXTRA_ORIGINAL_DATE, originalDate);
        openIntent.putExtra(
            EXTRA_KIND,
            job.optString("kind", "schedule")
        );
        int notificationId = stableId(job.optString("id", sourceId));
        PendingIntent contentIntent = PendingIntent.getActivity(
            context,
            notificationId,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification notification = new NotificationCompat.Builder(
            context,
            ALARM_CHANNEL_ID
        )
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(job.optString("title", "活动闹钟"))
            .setContentText(job.optString("body", ""))
            .setStyle(
                new NotificationCompat.BigTextStyle().bigText(
                    job.optString("body", "")
                )
            )
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .build();
        manager.notify(notificationId, notification);
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = context.getSystemService(
            NotificationManager.class
        );
        if (manager == null) {
            return;
        }
        NotificationChannel existing = manager.getNotificationChannel(
            ALARM_CHANNEL_ID
        );
        if (existing != null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
            ALARM_CHANNEL_ID,
            "活动闹钟",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("尽量准点播报的活动闹钟");
        channel.enableVibration(true);
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_ALARM)
            .build();
        channel.setSound(
            Uri.parse(
                "android.resource://" +
                context.getPackageName() +
                "/" +
                R.raw.alarm_tone
            ),
            attributes
        );
        manager.createNotificationChannel(channel);
    }

    static void removeTestJob(Context context, String jobId) {
        SharedPreferences preferences = context.getSharedPreferences(
            PREFS_NAME,
            Context.MODE_PRIVATE
        );
        JSONArray jobs = loadJobs(preferences);
        JSONArray kept = new JSONArray();
        for (int index = 0; index < jobs.length(); index += 1) {
            JSONObject job = jobs.optJSONObject(index);
            if (
                job != null &&
                !(
                    jobId.equals(job.optString("id")) &&
                    job.optBoolean("test", false)
                )
            ) {
                kept.put(job);
            }
        }
        preferences.edit().putString(JOBS_KEY, kept.toString()).apply();
    }

    private static JSObject diagnostics(Context context, String error) {
        SharedPreferences preferences = context.getSharedPreferences(
            PREFS_NAME,
            Context.MODE_PRIVATE
        );
        JSONArray jobs = loadJobs(preferences);
        long now = System.currentTimeMillis();
        Set<String> sources = new HashSet<>();
        long nextAt = Long.MAX_VALUE;
        int futureJobs = 0;
        for (int index = 0; index < jobs.length(); index += 1) {
            JSONObject job = jobs.optJSONObject(index);
            if (job == null) {
                continue;
            }
            try {
                long at = parseDate(job.getString("at")).getTime();
                if (at <= now) {
                    continue;
                }
                futureJobs += 1;
                sources.add(job.getString("sourceId"));
                nextAt = Math.min(nextAt, at);
            } catch (Exception ignored) {
                // Invalid jobs are excluded from diagnostics.
            }
        }
        AlarmManager alarms = (AlarmManager) context.getSystemService(
            Context.ALARM_SERVICE
        );
        boolean exactGranted =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            (alarms != null && alarms.canScheduleExactAlarms());
        NotificationManager notifications = context.getSystemService(
            NotificationManager.class
        );
        int importance = -1;
        if (
            notifications != null &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        ) {
            NotificationChannel channel = notifications.getNotificationChannel(
                ALARM_CHANNEL_ID
            );
            importance = channel == null ? -1 : channel.getImportance();
        }
        JSObject result = new JSObject();
        result.put("plannedJobs", futureJobs);
        int scheduledSources = 0;
        for (String sourceId : sources) {
            if (hasPending(context, sourceId)) {
                scheduledSources += 1;
            }
        }
        result.put("scheduledSources", scheduledSources);
        result.put(
            "nextAt",
            nextAt == Long.MAX_VALUE ? null : formatDate(new Date(nextAt))
        );
        result.put("exactAlarmGranted", exactGranted);
        result.put("channelImportance", importance);
        if (error == null) {
            result.put("lastError", null);
        } else {
            result.put("lastError", error);
        }
        return result;
    }

    private static PendingIntent firePendingIntent(
        Context context,
        String sourceId,
        JSONObject job
    ) {
        Intent intent = new Intent(context, DailyRouteAlarmReceiver.class);
        intent.setAction(ACTION_FIRE);
        intent.setData(Uri.parse("daily-route://alarm/" + sourceId));
        intent.putExtra(EXTRA_JOB_ID, job.optString("id"));
        intent.putExtra(EXTRA_SOURCE_ID, sourceId);
        return PendingIntent.getBroadcast(
            context,
            stableId(sourceId),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    static void cancelPending(Context context, String sourceId) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(
            Context.ALARM_SERVICE
        );
        if (alarms == null) {
            return;
        }
        Intent intent = new Intent(context, DailyRouteAlarmReceiver.class);
        intent.setAction(ACTION_FIRE);
        intent.setData(Uri.parse("daily-route://alarm/" + sourceId));
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            stableId(sourceId),
            intent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (pendingIntent != null) {
            alarms.cancel(pendingIntent);
            pendingIntent.cancel();
        }
    }

    private static boolean hasPending(Context context, String sourceId) {
        Intent intent = new Intent(context, DailyRouteAlarmReceiver.class);
        intent.setAction(ACTION_FIRE);
        intent.setData(Uri.parse("daily-route://alarm/" + sourceId));
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            stableId(sourceId),
            intent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        return pendingIntent != null;
    }

    private static JSONArray loadJobs(SharedPreferences preferences) {
        String stored = preferences.getString(JOBS_KEY, "[]");
        try {
            return new JSONArray(stored);
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(
            PREFS_NAME,
            Context.MODE_PRIVATE
        );
    }

    static int stableId(String value) {
        int hash = 0x811c9dc5;
        for (int index = 0; index < value.length(); index += 1) {
            hash ^= value.charAt(index);
            hash *= 0x01000193;
        }
        return hash & 0x7fffffff;
    }

    static Date parseDate(String value) throws Exception {
        SimpleDateFormat format = new SimpleDateFormat(
            "yyyy-MM-dd'T'HH:mm:ss.SSSX",
            Locale.US
        );
        format.setLenient(false);
        return format.parse(value);
    }

    static String formatDate(Date value) {
        SimpleDateFormat format = new SimpleDateFormat(
            "yyyy-MM-dd'T'HH:mm:ss.SSSX",
            Locale.US
        );
        return format.format(value);
    }
}
