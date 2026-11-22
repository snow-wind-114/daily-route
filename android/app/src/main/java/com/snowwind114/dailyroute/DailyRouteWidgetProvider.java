package com.snowwind114.dailyroute;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

public class DailyRouteWidgetProvider extends AppWidgetProvider {
    static final String EXTRA_SERIES_ID = "dailyRouteSeriesId";
    static final String EXTRA_DATE = "dailyRouteDate";
    static final String EXTRA_ORIGINAL_DATE = "dailyRouteOriginalDate";
    static final String EXTRA_KIND = "dailyRouteKind";
    private static final int[] SCHEDULE_TEXT_IDS = {
        R.id.widget_schedule_1,
        R.id.widget_schedule_2,
        R.id.widget_schedule_3,
    };
    private static final int[] TODO_TEXT_IDS = {
        R.id.widget_todo_1,
        R.id.widget_todo_2,
    };

    @Override
    public void onUpdate(
        Context context,
        AppWidgetManager appWidgetManager,
        int[] appWidgetIds
    ) {
        for (int appWidgetId : appWidgetIds) {
            appWidgetManager.updateAppWidget(
                appWidgetId,
                buildViews(context, appWidgetId)
            );
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (
            Intent.ACTION_DATE_CHANGED.equals(action) ||
            Intent.ACTION_TIME_CHANGED.equals(action) ||
            Intent.ACTION_TIMEZONE_CHANGED.equals(action)
        ) {
            updateAll(context);
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(
            context,
            DailyRouteWidgetProvider.class
        );
        int[] ids = manager.getAppWidgetIds(provider);
        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context, id));
        }
    }

    private static RemoteViews buildViews(Context context, int appWidgetId) {
        RemoteViews views = new RemoteViews(
            context.getPackageName(),
            R.layout.daily_route_widget
        );
        SharedPreferences preferences = context.getSharedPreferences(
            DailyRouteWidgetPlugin.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        String snapshotText = preferences.getString(
            DailyRouteWidgetPlugin.SNAPSHOT_KEY,
            null
        );
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(
            Calendar.getInstance().getTime()
        );
        JSONArray schedules = new JSONArray();
        JSONArray todos = new JSONArray();
        int checkinTotal = 0;
        int checkinChecked = 0;

        if (snapshotText != null) {
            try {
                JSONObject snapshot = new JSONObject(snapshotText);
                JSONObject days = snapshot.optJSONObject("days");
                Object dayValue = days == null ? null : days.opt(today);
                if (dayValue instanceof JSONObject) {
                    JSONObject day = (JSONObject) dayValue;
                    schedules = day.optJSONArray("schedules");
                    todos = day.optJSONArray("todos");
                    if (schedules == null) {
                        schedules = new JSONArray();
                    }
                    if (todos == null) {
                        todos = new JSONArray();
                    }
                    JSONObject checkins = day.optJSONObject("checkins");
                    if (checkins != null) {
                        checkinTotal = checkins.optInt("total", 0);
                        checkinChecked = checkins.optInt("checked", 0);
                    }
                } else if (dayValue instanceof JSONArray) {
                    // v0.4 snapshot: preserve today's schedule list until first sync.
                    schedules = (JSONArray) dayValue;
                }
            } catch (Exception ignored) {
                schedules = new JSONArray();
                todos = new JSONArray();
            }
        }

        views.setTextViewText(
            R.id.widget_date,
            new SimpleDateFormat("M月d日 EEEE", Locale.CHINA).format(
                Calendar.getInstance().getTime()
            )
        );
        int totalItems =
            schedules.length() + todos.length() + checkinTotal;
        views.setTextViewText(
            R.id.widget_summary,
            snapshotText == null
                ? "打开应用同步"
                : totalItems == 0
                    ? "今天没有安排"
                    : totalItems + " 项"
        );

        int nowMinutes =
            Calendar.getInstance().get(Calendar.HOUR_OF_DAY) * 60 +
            Calendar.getInstance().get(Calendar.MINUTE);
        views.setTextViewText(
            R.id.widget_schedule_label,
            schedules.length() > 3
                ? "定期 · +" + (schedules.length() - 3)
                : "定期"
        );
        int scheduleShown = Math.min(schedules.length(), 3);
        for (int index = 0; index < SCHEDULE_TEXT_IDS.length; index += 1) {
            int textId = SCHEDULE_TEXT_IDS[index];
            if (index >= scheduleShown) {
                views.setTextViewText(textId, index == 0 ? "无定期安排" : "");
                views.setViewVisibility(textId, View.VISIBLE);
                continue;
            }
            JSONObject event = schedules.optJSONObject(index);
            if (event == null) {
                views.setTextViewText(textId, "");
                continue;
            }
            String start = event.optString("startTime", "");
            String title = event.optString("title", "活动");
            int startMinutes = minutes(start);
            String marker = "";
            if (
                startMinutes <= nowMinutes &&
                nowMinutes < minutes(event.optString("endTime", ""))
            ) {
                marker = "进行中 · ";
            }
            views.setTextViewText(
                textId,
                marker + start + "  " + title
            );
            views.setOnClickPendingIntent(
                textId,
                rowPendingIntent(
                    context,
                    appWidgetId,
                    index,
                    event,
                    today,
                    "schedule"
                )
            );
        }

        views.setTextViewText(
            R.id.widget_todo_label,
            todos.length() > 2
                ? "今日截止 · +" + (todos.length() - 2)
                : "今日截止"
        );
        int todoShown = Math.min(todos.length(), 2);
        for (int index = 0; index < TODO_TEXT_IDS.length; index += 1) {
            int textId = TODO_TEXT_IDS[index];
            if (index >= todoShown) {
                views.setTextViewText(textId, index == 0 ? "无今日截止" : "");
                views.setViewVisibility(textId, View.VISIBLE);
                continue;
            }
            JSONObject event = todos.optJSONObject(index);
            if (event == null) {
                views.setTextViewText(textId, "");
                continue;
            }
            views.setTextViewText(
                textId,
                event.optString("startTime", "") +
                "  " +
                event.optString("title", "待办")
            );
            views.setOnClickPendingIntent(
                textId,
                rowPendingIntent(
                    context,
                    appWidgetId,
                    index + 3,
                    event,
                    today,
                    "todo"
                )
            );
        }

        views.setTextViewText(
            R.id.widget_checkin_summary,
            checkinTotal == 0
                ? "无打卡项目"
                : checkinTotal +
                    "项 · 已打卡" +
                    checkinChecked
        );
        JSONObject checkinTarget = new JSONObject();
        try {
            checkinTarget.put("seriesId", "checkin-summary");
        } catch (Exception ignored) {
            // A synthetic target is optional; root click still opens the app.
        }
        views.setOnClickPendingIntent(
            R.id.widget_checkin_summary,
            rowPendingIntent(
                context,
                appWidgetId,
                8,
                checkinTarget,
                today,
                "checkinSummary"
            )
        );
        views.setOnClickPendingIntent(
            R.id.widget_root,
            launchPendingIntent(context, appWidgetId * 10, new Intent())
        );
        return views;
    }

    private static PendingIntent rowPendingIntent(
        Context context,
        int appWidgetId,
        int rowIndex,
        JSONObject event,
        String date,
        String kind
    ) {
        Intent intent = new Intent();
        intent.putExtra(EXTRA_SERIES_ID, event.optString("seriesId", ""));
        intent.putExtra(EXTRA_DATE, date);
        intent.putExtra(
            EXTRA_ORIGINAL_DATE,
            event.optString("originalDate", date)
        );
        intent.putExtra(EXTRA_KIND, kind);
        return launchPendingIntent(
            context,
            appWidgetId * 10 + rowIndex + 1,
            intent
        );
    }

    private static PendingIntent launchPendingIntent(
        Context context,
        int requestCode,
        Intent intent
    ) {
        intent.setClass(context, MainActivity.class);
        intent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP
        );
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static int minutes(String value) {
        try {
            String[] parts = value.split(":");
            return Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
        } catch (Exception ignored) {
            return Integer.MAX_VALUE;
        }
    }
}
