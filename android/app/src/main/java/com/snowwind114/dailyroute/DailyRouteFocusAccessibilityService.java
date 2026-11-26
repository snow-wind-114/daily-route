package com.snowwind114.dailyroute;

import android.accessibilityservice.AccessibilityService;
import android.app.KeyguardManager;
import android.content.Intent;
import android.os.PowerManager;
import android.view.accessibility.AccessibilityEvent;
import java.util.Set;

public class DailyRouteFocusAccessibilityService extends AccessibilityService {
    private long lastBlockAt = 0L;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (
            event == null ||
            event.getEventType() !=
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
            !DailyRouteFocusLock.isActive(this)
        ) {
            return;
        }
        PowerManager power = getSystemService(PowerManager.class);
        if (power == null || !power.isInteractive()) {
            return;
        }
        KeyguardManager keyguard = getSystemService(KeyguardManager.class);
        if (keyguard != null && keyguard.isKeyguardLocked()) {
            return;
        }
        CharSequence eventPackage = event.getPackageName();
        String packageName = eventPackage == null
            ? ""
            : eventPackage.toString();
        Set<String> allowedPackages =
            DailyRouteFocusLock.getAllowedPackages(this);
        if (
            !DailyRouteFocusLock.shouldBlock(
                this,
                packageName,
                allowedPackages
            )
        ) {
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastBlockAt < 700L) {
            return;
        }
        lastBlockAt = now;
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_SINGLE_TOP |
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        );
        startActivity(intent);
    }

    @Override
    public void onInterrupt() {}
}
