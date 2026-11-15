package com.snowwind114.dailyroute;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DailyRouteWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
