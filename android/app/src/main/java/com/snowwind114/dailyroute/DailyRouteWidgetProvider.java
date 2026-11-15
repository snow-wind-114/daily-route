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
    private static final int[] ROW_IDS = {
        R.id.widget_row_1,
        R.id.widget_row_2,
        R.id.widget_row_3,
    };
    private static final int[] ROW_TEXT_IDS = {
        R.id.widget_row_text_1,
        R.id.widget_row_text_2,
        R.id.widget_row_text_3,
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
        JSONArray events = new JSONArray();

        if (snapshotText != null) {
            try {
                JSONObject snapshot = new JSONObject(snapshotText);
                events = snapshot.optJSONObject("days") == null
                    ? new JSONArray()
                    : snapshot
                        .optJSONObject("days")
                        .optJSONArray(today);
                if (events == null) {
                    events = new JSONArray();
                }
            } catch (Exception ignored) {
                events = new JSONArray();
            }
        }

        views.setTextViewText(
            R.id.widget_date,
            new SimpleDateFormat("M月d日 EEEE", Locale.CHINA).format(
                Calendar.getInstance().getTime()
            )
        );
        int shown = Math.min(events.length(), 3);
        views.setTextViewText(
            R.id.widget_summary,
            snapshotText == null
                ? "打开应用同步活动"
                : events.length() == 0
                    ? "今天没有安排"
                    : events.length() + " 项安排"
        );

        int nowMinutes = Calendar.getInstance().get(Calendar.HOUR_OF_DAY) * 60 +
            Calendar.getInstance().get(Calendar.MINUTE);
        int nextMarked = 0;
        for (int index = 0; index < 3; index += 1) {
            int rowId = ROW_IDS[index];
            int textId = ROW_TEXT_IDS[index];
            if (index >= shown) {
                views.setViewVisibility(rowId, View.GONE);
                continue;
            }

            JSONObject event = events.optJSONObject(index);
            if (event == null) {
                views.setViewVisibility(rowId, View.GONE);
                continue;
            }

            String start = event.optString("startTime", "");
            String end = event.optString("endTime", "");
            String title = event.optString("title", "活动");
            int startMinutes = minutes(start);
            int endMinutes = minutes(end);
            String marker = "";
            if (startMinutes <= nowMinutes && nowMinutes < endMinutes) {
                marker = "进行中 · ";
            } else if (nextMarked == 0 && startMinutes >= nowMinutes) {
                marker = "下一项 · ";
                nextMarked = 1;
            }

            views.setViewVisibility(rowId, View.VISIBLE);
            views.setTextViewText(
                textId,
                marker + start + "  " + title
            );
            views.setOnClickPendingIntent(
                rowId,
                rowPendingIntent(context, appWidgetId, index, event, today)
            );
        }

        views.setViewVisibility(
            R.id.widget_more,
            events.length() > 3 ? View.VISIBLE : View.GONE
        );
        views.setTextViewText(
            R.id.widget_more,
            events.length() > 3 ? "还有 " + (events.length() - 3) + " 项" : ""
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
        String date
    ) {
        Intent intent = new Intent();
        intent.putExtra(EXTRA_SERIES_ID, event.optString("seriesId", ""));
        intent.putExtra(EXTRA_DATE, date);
        intent.putExtra(
            EXTRA_ORIGINAL_DATE,
            event.optString("originalDate", date)
        );
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
            Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP
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
