package com.snowwind114.dailyroute;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DailyRouteWidget")
public class DailyRouteWidgetPlugin extends Plugin {
    static final String PREFS_NAME = "daily_route_widget";
    static final String SNAPSHOT_KEY = "snapshot";
    static final String PENDING_SERIES_KEY = "pending_series_id";
    static final String PENDING_DATE_KEY = "pending_date";
    static final String PENDING_ORIGINAL_DATE_KEY = "pending_original_date";
    static final String PENDING_KIND_KEY = "pending_kind";

    @PluginMethod
    public void setSnapshot(PluginCall call) {
        String json = call.getString("json");
        if (json == null || json.isBlank()) {
            call.reject("桌面组件数据为空");
            return;
        }

        try {
            new org.json.JSONObject(json);
        } catch (Exception error) {
            call.reject("桌面组件数据格式不正确", error);
            return;
        }

        preferences().edit().putString(SNAPSHOT_KEY, json).apply();
        DailyRouteWidgetProvider.updateAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void clearSnapshot(PluginCall call) {
        preferences().edit().remove(SNAPSHOT_KEY).apply();
        DailyRouteWidgetProvider.updateAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void consumePendingOpen(PluginCall call) {
        SharedPreferences prefs = preferences();
        String seriesId = prefs.getString(PENDING_SERIES_KEY, null);
        String date = prefs.getString(PENDING_DATE_KEY, null);
        String originalDate = prefs.getString(PENDING_ORIGINAL_DATE_KEY, null);
        String kind = prefs.getString(PENDING_KIND_KEY, "schedule");
        JSObject result = new JSObject();

        if (seriesId != null && date != null) {
            result.put("seriesId", seriesId);
            result.put("date", date);
            result.put("originalDate", originalDate == null ? date : originalDate);
            result.put("kind", kind);
            prefs
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
    protected void handleOnNewIntent(Intent intent) {
        JSObject pending = storePendingIntent(intent);
        if (pending != null) {
            notifyListeners("widgetOpen", pending, false);
        }
    }

    @Override
    public void load() {
        storePendingIntent(getActivity().getIntent());
    }

    private JSObject storePendingIntent(Intent intent) {
        if (intent == null) {
            return null;
        }
        String seriesId = intent.getStringExtra(DailyRouteWidgetProvider.EXTRA_SERIES_ID);
        String date = intent.getStringExtra(DailyRouteWidgetProvider.EXTRA_DATE);
        String originalDate = intent.getStringExtra(
            DailyRouteWidgetProvider.EXTRA_ORIGINAL_DATE
        );
        String kind = intent.getStringExtra(DailyRouteWidgetProvider.EXTRA_KIND);
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
        intent.removeExtra(DailyRouteWidgetProvider.EXTRA_SERIES_ID);
        intent.removeExtra(DailyRouteWidgetProvider.EXTRA_DATE);
        intent.removeExtra(DailyRouteWidgetProvider.EXTRA_ORIGINAL_DATE);
        intent.removeExtra(DailyRouteWidgetProvider.EXTRA_KIND);
        JSObject result = new JSObject();
        result.put("seriesId", seriesId);
        result.put("date", date);
        result.put("originalDate", originalDate == null ? date : originalDate);
        result.put("kind", kind == null ? "schedule" : kind);
        return result;
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }
}
