package com.snowwind114.dailyroute;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Set;
import org.junit.Test;

public class DailyRouteFocusLockTest {
    @Test
    public void onlyUnknownAppsAreBlocked() {
        Set<String> allowed = Set.of("com.example.reader");
        assertTrue(
            DailyRouteFocusLock.shouldBlock(
                "com.snowwind114.dailyroute",
                "com.example.game",
                allowed
            )
        );
        assertFalse(
            DailyRouteFocusLock.shouldBlock(
                "com.snowwind114.dailyroute",
                "com.example.reader",
                allowed
            )
        );
        assertFalse(
            DailyRouteFocusLock.shouldBlock(
                "com.snowwind114.dailyroute",
                "com.snowwind114.dailyroute",
                allowed
            )
        );
    }

    @Test
    public void systemSafetyPackagesRemainAvailable() {
        Set<String> allowed = Set.of();
        for (String packageName : new String[] {
            "com.android.systemui",
            "com.android.permissioncontroller",
            "com.google.android.permissioncontroller",
            "com.android.emergency",
        }) {
            assertFalse(
                DailyRouteFocusLock.shouldBlock(
                    "com.snowwind114.dailyroute",
                    packageName,
                    allowed
                )
            );
        }
    }
}
