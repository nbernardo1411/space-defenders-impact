package com.zukito.spaceimpactdefender;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.Context;

@CapacitorPlugin(name = "LanRelay")
public class LanRelayPlugin extends Plugin {
    private static final int DEFAULT_PORT = 8787;
    private static LanRelayServer server;

    @PluginMethod
    public void start(PluginCall call) {
        int port = call.getInt("port", DEFAULT_PORT);
        if (port <= 0 || port > 65535) port = DEFAULT_PORT;

        synchronized (LanRelayPlugin.class) {
            try {
                if (server == null || server.getPort() != port) {
                    if (server != null) server.stop();
                    Context context = getContext() != null ? getContext().getApplicationContext() : null;
                    server = new LanRelayServer(context, port);
                }
                server.start();
                call.resolve(buildStatus(server));
            } catch (Exception exception) {
                call.reject("Could not start local LAN relay.", exception);
            }
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        synchronized (LanRelayPlugin.class) {
            if (server != null) server.stop();
            call.resolve(buildStatus(server));
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        synchronized (LanRelayPlugin.class) {
            call.resolve(buildStatus(server));
        }
    }

    private JSObject buildStatus(LanRelayServer currentServer) {
        JSObject result = new JSObject();
        boolean running = currentServer != null && currentServer.isRunning();
        int port = currentServer != null ? currentServer.getPort() : DEFAULT_PORT;
        String ipAddress = currentServer != null ? currentServer.getLocalIpAddress() : "";
        String url = currentServer != null ? currentServer.getUrl() : "";
        result.put("running", running);
        result.put("port", port);
        result.put("ipAddress", ipAddress);
        result.put("url", url);
        return result;
    }
}
