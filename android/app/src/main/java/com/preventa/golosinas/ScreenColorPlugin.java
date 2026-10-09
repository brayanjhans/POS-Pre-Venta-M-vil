package com.preventa.golosinas;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Pinta el fondo de la ventana con el color de la cabecera de la pantalla actual.
 * En WebViews antiguos (< 140) Capacitor deja libre la zona de la hora y la batería con un
 * margen nativo: ese margen muestra el fondo de la ventana, así que debe tener el mismo color
 * que la cabecera para que no quede una franja vacía.
 */
@CapacitorPlugin(name = "ScreenColor")
public class ScreenColorPlugin extends Plugin {

    @PluginMethod
    public void setColor(PluginCall call) {
        String value = call.getString("color");
        if (value == null) {
            call.reject("Falta el color");
            return;
        }
        final int color;
        try {
            color = Color.parseColor(value);
        } catch (IllegalArgumentException e) {
            call.reject("Color inválido: " + value);
            return;
        }
        getActivity().runOnUiThread(() -> {
            getActivity().getWindow().setBackgroundDrawable(new ColorDrawable(color));
            getActivity().getWindow().getDecorView().setBackgroundColor(color);
            call.resolve();
        });
    }
}
