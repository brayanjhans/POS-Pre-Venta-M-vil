package com.preventa.golosinas;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propio de la app: color de la franja de la hora/batería según la pantalla.
        registerPlugin(ScreenColorPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
