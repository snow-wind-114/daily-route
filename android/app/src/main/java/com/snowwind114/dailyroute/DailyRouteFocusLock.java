package com.snowwind114.dailyroute;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.text.TextUtils;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;
import org.json.JSONArray;

final class DailyRouteFocusLock {
    static final String PREFS_NAME = "daily_route_focus_lock";
    static final String ACTIVE_KEY = "active";
    static final String ALLOWED_PACKAGES_KEY = "allowed_packages";

    private DailyRouteFocusLock() {}

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    static boolean isActive(Context context) {
        return preferences(context).getBoolean(ACTIVE_KEY, false);
    }

    static void setActive(Context context, boolean active) {
        preferences(context).edit().putBoolean(ACTIVE_KEY, active).apply();
    }

    static Set<String> getAllowedPackages(Context context) {
        String stored = preferences(context).getString(
            ALLOWED_PACKAGES_KEY,
            "[]"
        );
        Set<String> packages = new LinkedHashSet<>();
        try {
            JSONArray values = new JSONArray(stored);
            for (int index = 0; index < values.length(); index += 1) {
                String packageName = values.optString(index, "").trim();
                if (!packageName.isEmpty()) {
                    packages.add(packageName);
                }
            }
        } catch (Exception ignored) {
            return new HashSet<>();
        }
        return packages;
    }

    static void setAllowedPackages(Context context, Iterable<String> values) {
        JSONArray stored = new JSONArray();
        Set<String> unique = new LinkedHashSet<>();
        for (String value : values) {
            String packageName = value == null ? "" : value.trim();
            if (!packageName.isEmpty() && unique.add(packageName)) {
                stored.put(packageName);
            }
        }
        preferences(context)
            .edit()
            .putString(ALLOWED_PACKAGES_KEY, stored.toString())
            .apply();
    }

    static boolean isServiceEnabled(Context context) {
        String enabled = Settings.Secure.getString(
            context.getContentResolver(),
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        );
        if (enabled == null || enabled.isEmpty()) {
            return false;
        }
        ComponentName expected = new ComponentName(
            context,
            DailyRouteFocusAccessibilityService.class
        );
        String flattened = expected.flattenToString();
        String shortFlattened = expected.flattenToShortString();
        TextUtils.SimpleStringSplitter splitter =
            new TextUtils.SimpleStringSplitter(':');
        splitter.setString(enabled);
        while (splitter.hasNext()) {
            String item = splitter.next();
            if (
                flattened.equalsIgnoreCase(item) ||
                shortFlattened.equalsIgnoreCase(item)
            ) {
                return true;
            }
        }
        return false;
    }

    static boolean shouldBlock(
        Context context,
        String packageName,
        Set<String> allowedPackages
    ) {
        return shouldBlock(
            context.getPackageName(),
            packageName,
            allowedPackages
        );
    }

    static boolean shouldBlock(
        String ownPackage,
        String packageName,
        Set<String> allowedPackages
    ) {
        if (
            packageName == null ||
            packageName.isEmpty() ||
            packageName.equals(ownPackage)
        ) {
            return false;
        }
        if (
            packageName.equals("com.android.systemui") ||
            packageName.contains("permissioncontroller") ||
            packageName.contains("emergency")
        ) {
            return false;
        }
        return !allowedPackages.contains(packageName);
    }
}
