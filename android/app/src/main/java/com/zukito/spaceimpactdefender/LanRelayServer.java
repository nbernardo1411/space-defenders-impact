package com.zukito.spaceimpactdefender;

import android.util.Base64;
import android.util.Log;
import android.content.Context;
import android.net.wifi.WifiManager;
import java.io.ByteArrayOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class LanRelayServer {
    private static final String TAG = "LanRelayServer";
    private static final int MAX_PAYLOAD_BYTES = 256 * 1024;
    private static final String WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    private static final Set<String> ALLOWED_SHIPS = new HashSet<>(Arrays.asList("rocket", "fast", "gatling", "laser", "dreadnought", "xwing", "spaceEt", "mesiah", "coreLander"));
    private static final Set<String> ALLOWED_VISUAL_SHIPS = new HashSet<>(Arrays.asList("rocket", "fast", "gatling", "laser", "dreadnought", "xwing", "spaceEt", "mesiah", "mesiahBlack", "mesiahWhite", "coreLander", "coreLanderBurning", "godGundam", "godGundamBurning", "spiegel"));

    private final Object roomLock = new Object();
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Peer> peers = new ConcurrentHashMap<>();
    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final Context context;
    private final int port;
    private volatile boolean running = false;
    private ServerSocket serverSocket;
    private Thread acceptThread;

    public LanRelayServer(Context context, int port) {
        this.context = context;
        this.port = port;
    }

    public synchronized void start() throws IOException {
        if (running) return;

        serverSocket = new ServerSocket();
        serverSocket.setReuseAddress(true);
        serverSocket.bind(new InetSocketAddress("0.0.0.0", port));
        running = true;
        acceptThread = new Thread(this::acceptLoop, "SpaceImpactLanRelay");
        acceptThread.setDaemon(true);
        acceptThread.start();
    }

    public synchronized void stop() {
        running = false;
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (IOException ignored) {
        }
        for (Peer peer : peers.values()) {
            peer.close();
        }
        peers.clear();
        rooms.clear();
    }

    public boolean isRunning() {
        return running;
    }

    public int getPort() {
        return port;
    }

    public String getUrl() {
        String ip = getLocalIpAddress();
        return ip.isEmpty() ? "" : "ws://" + ip + ":" + port;
    }

    public String getLocalIpAddress() {
        String wifiIp = getWifiManagerIpAddress();
        if (!wifiIp.isEmpty()) return wifiIp;

        try {
            List<InetAddress> preferredFallback = new ArrayList<>();
            List<InetAddress> fallback = new ArrayList<>();
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();
                if (!networkInterface.isUp() || networkInterface.isLoopback()) continue;

                String name = networkInterface.getName().toLowerCase(Locale.US);
                boolean preferred = name.startsWith("wlan")
                    || name.startsWith("swlan")
                    || name.startsWith("ap")
                    || name.startsWith("eth")
                    || name.startsWith("rndis")
                    || name.startsWith("p2p")
                    || name.startsWith("bt-pan");
                boolean blocked = name.startsWith("rmnet")
                    || name.startsWith("ccmni")
                    || name.startsWith("tun")
                    || name.startsWith("lo");

                Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress address = addresses.nextElement();
                    if (!(address instanceof Inet4Address) || address.isLoopbackAddress()) continue;

                    if (preferred && address.isSiteLocalAddress()) return address.getHostAddress();
                    if (preferred) preferredFallback.add(address);
                    else if (!blocked && address.isSiteLocalAddress()) fallback.add(address);
                }
            }
            if (!preferredFallback.isEmpty()) return preferredFallback.get(0).getHostAddress();
            if (!fallback.isEmpty()) return fallback.get(0).getHostAddress();
        } catch (SocketException exception) {
            Log.w(TAG, "Could not read LAN IP.", exception);
        }
        return "";
    }

    private String getWifiManagerIpAddress() {
        try {
            if (context == null) return "";
            WifiManager wifiManager = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifiManager == null || wifiManager.getConnectionInfo() == null) return "";

            int ipAddress = wifiManager.getConnectionInfo().getIpAddress();
            if (ipAddress == 0) return "";

            return String.format(
                Locale.US,
                "%d.%d.%d.%d",
                ipAddress & 0xff,
                (ipAddress >> 8) & 0xff,
                (ipAddress >> 16) & 0xff,
                (ipAddress >> 24) & 0xff
            );
        } catch (Exception exception) {
            Log.w(TAG, "Could not read Wi-Fi IP.", exception);
            return "";
        }
    }

    private void acceptLoop() {
        while (running) {
            try {
                Socket socket = serverSocket.accept();
                socket.setTcpNoDelay(true);
                Thread thread = new Thread(() -> handleSocket(socket), "SpaceImpactLanPeer");
                thread.setDaemon(true);
                thread.start();
            } catch (IOException exception) {
                if (running) Log.w(TAG, "Accept failed.", exception);
            }
        }
    }

    private void handleSocket(Socket socket) {
        String id = randomId();
        try {
            if (!handshake(socket)) {
                closeQuietly(socket);
                return;
            }

            Peer peer = new Peer(id, socket);
            peers.put(id, peer);
            send(id, new JSONObject().put("type", "hello").put("peerId", id));
            readWebSocketLoop(peer);
        } catch (Exception exception) {
            Log.w(TAG, "Peer failed.", exception);
        } finally {
            cleanupPeer(id);
            closeQuietly(socket);
        }
    }

    private boolean handshake(Socket socket) throws IOException, NoSuchAlgorithmException {
        InputStream input = socket.getInputStream();
        ByteArrayOutputStream headerBytes = new ByteArrayOutputStream();
        int match = 0;
        int current;
        byte[] end = new byte[] { '\r', '\n', '\r', '\n' };
        while ((current = input.read()) != -1) {
            headerBytes.write(current);
            match = current == end[match] ? match + 1 : (current == end[0] ? 1 : 0);
            if (match == end.length) break;
            if (headerBytes.size() > 8192) return false;
        }

        String headers = headerBytes.toString(StandardCharsets.UTF_8.name());
        if (isHealthRequest(headers)) {
            writeHealthResponse(socket);
            return false;
        }

        String key = "";
        for (String line : headers.split("\r\n")) {
            int separator = line.indexOf(':');
            if (separator <= 0) continue;
            String name = line.substring(0, separator).trim();
            if ("sec-websocket-key".equalsIgnoreCase(name)) {
                key = line.substring(separator + 1).trim();
                break;
            }
        }
        if (key.isEmpty()) return false;

        MessageDigest digest = MessageDigest.getInstance("SHA-1");
        byte[] acceptHash = digest.digest((key + WS_GUID).getBytes(StandardCharsets.UTF_8));
        String accept = Base64.encodeToString(acceptHash, Base64.NO_WRAP);
        String response = "HTTP/1.1 101 Switching Protocols\r\n"
            + "Upgrade: websocket\r\n"
            + "Connection: Upgrade\r\n"
            + "Sec-WebSocket-Accept: " + accept + "\r\n\r\n";
        socket.getOutputStream().write(response.getBytes(StandardCharsets.UTF_8));
        socket.getOutputStream().flush();
        return true;
    }

    private boolean isHealthRequest(String headers) {
        String[] lines = headers.split("\r\n", 2);
        if (lines.length == 0) return false;

        String[] requestParts = lines[0].split(" ", 3);
        if (requestParts.length < 2) return false;

        String method = requestParts[0];
        String path = requestParts[1];
        int queryStart = path.indexOf('?');
        if (queryStart >= 0) {
            path = path.substring(0, queryStart);
        }

        return ("GET".equals(method) || "OPTIONS".equals(method)) && "/health".equals(path);
    }

    private void writeHealthResponse(Socket socket) throws IOException {
        String body = "{\"ok\":true,\"service\":\"lan-relay\"}";
        String response = "HTTP/1.1 200 OK\r\n"
            + "Content-Type: application/json; charset=utf-8\r\n"
            + "Access-Control-Allow-Origin: *\r\n"
            + "Access-Control-Allow-Methods: GET, OPTIONS\r\n"
            + "Access-Control-Allow-Headers: *\r\n"
            + "Cache-Control: no-store\r\n"
            + "Connection: close\r\n"
            + "Content-Length: " + body.getBytes(StandardCharsets.UTF_8).length + "\r\n\r\n"
            + body;
        socket.getOutputStream().write(response.getBytes(StandardCharsets.UTF_8));
        socket.getOutputStream().flush();
    }

    private void readWebSocketLoop(Peer peer) throws IOException {
        ByteArrayOutputStream fragmented = null;
        InputStream input = peer.socket.getInputStream();
        while (running && !peer.socket.isClosed()) {
            Frame frame = readFrame(input);
            if (frame == null) break;

            if (frame.opcode == 0x8) break;
            if (frame.opcode == 0x9) {
                writeFrame(peer.socket, frame.payload, 0xA);
                continue;
            }
            if (frame.opcode == 0x0) {
                if (fragmented == null) continue;
                fragmented.write(frame.payload);
                if (fragmented.size() > MAX_PAYLOAD_BYTES) throw new IOException("Payload too large.");
                if (frame.fin) {
                    handleTextPayload(peer.id, fragmented.toByteArray());
                    fragmented = null;
                }
                continue;
            }
            if (frame.opcode != 0x1) continue;

            if (!frame.fin) {
                fragmented = new ByteArrayOutputStream();
                fragmented.write(frame.payload);
                continue;
            }
            handleTextPayload(peer.id, frame.payload);
        }
    }

    private Frame readFrame(InputStream input) throws IOException {
        int first = input.read();
        if (first == -1) return null;
        int second = input.read();
        if (second == -1) throw new EOFException();

        boolean fin = (first & 0x80) != 0;
        int opcode = first & 0x0F;
        boolean masked = (second & 0x80) != 0;
        long length = second & 0x7F;
        if (length == 126) {
            length = ((long) readByte(input) << 8) | readByte(input);
        } else if (length == 127) {
            length = 0;
            for (int index = 0; index < 8; index++) {
                length = (length << 8) | readByte(input);
            }
        }
        if (length > MAX_PAYLOAD_BYTES) throw new IOException("Payload too large.");

        byte[] mask = masked ? readExact(input, 4) : null;
        byte[] payload = readExact(input, (int) length);
        if (masked && mask != null) {
            for (int index = 0; index < payload.length; index++) {
                payload[index] = (byte) (payload[index] ^ mask[index % 4]);
            }
        }
        return new Frame(fin, opcode, payload);
    }

    private int readByte(InputStream input) throws IOException {
        int value = input.read();
        if (value == -1) throw new EOFException();
        return value & 0xFF;
    }

    private byte[] readExact(InputStream input, int length) throws IOException {
        byte[] data = new byte[length];
        int offset = 0;
        while (offset < length) {
            int read = input.read(data, offset, length - offset);
            if (read == -1) throw new EOFException();
            offset += read;
        }
        return data;
    }

    private void handleTextPayload(String id, byte[] payload) {
        try {
            JSONObject message = new JSONObject(new String(payload, StandardCharsets.UTF_8));
            handleMessage(id, message);
        } catch (JSONException exception) {
            sendError(id, "Invalid message.");
        }
    }

    private void handleMessage(String id, JSONObject message) throws JSONException {
        Peer peer = peers.get(id);
        if (peer == null) return;

        String type = message.optString("type", "");
        switch (type) {
            case "create-room":
                handleCreateRoom(peer, message);
                break;
            case "join-room":
                handleJoinRoom(peer, message);
                break;
            case "set-ready":
                peer.ready = message.optBoolean("ready", false);
                if (peer.roomCode != null) broadcastRoom(peer.roomCode);
                break;
            case "set-ship":
                peer.shipKey = cleanShipKey(message.optString("shipKey", ""));
                peer.visualShipKey = cleanVisualShipKey(message.optString("visualShipKey", peer.shipKey), peer.shipKey);
                peer.ready = false;
                if (peer.roomCode != null) broadcastRoom(peer.roomCode);
                break;
            case "start-game":
                handleStartGame(peer);
                break;
            case "game-message":
                handleGameMessage(peer, message.opt("payload"));
                break;
            case "leave-room":
                String previousCode = peer.roomCode;
                leaveRoom(peer);
                send(peer.id, new JSONObject().put("type", "left-room"));
                if (previousCode != null) broadcastRoom(previousCode);
                break;
            case "ping":
                send(peer.id, new JSONObject().put("type", "pong").put("at", System.currentTimeMillis()));
                break;
            default:
                sendError(peer.id, "Unknown message type.");
                break;
        }
    }

    private void handleCreateRoom(Peer peer, JSONObject message) throws JSONException {
        synchronized (roomLock) {
            leaveRoom(peer);
            peer.name = cleanName(message.optString("name", ""));
            peer.shipKey = cleanShipKey(message.optString("shipKey", ""));
            peer.visualShipKey = cleanVisualShipKey(message.optString("visualShipKey", peer.shipKey), peer.shipKey);
            peer.ready = false;
            peer.isHost = true;

            String code = createRoomCode();
            Room room = new Room(code, peer.id);
            room.peers.add(peer.id);
            rooms.put(code, room);
            peer.roomCode = code;

            send(peer.id, new JSONObject().put("type", "room-created").put("room", snapshotRoom(code)));
            broadcastRoom(code);
        }
    }

    private void handleJoinRoom(Peer peer, JSONObject message) throws JSONException {
        synchronized (roomLock) {
            String code = cleanRoomCode(message.optString("roomCode", ""));
            Room room = rooms.get(code);
            if (room == null) {
                sendError(peer.id, "Room not found.");
                return;
            }
            if (room.peers.size() >= 2 && !room.peers.contains(peer.id)) {
                sendError(peer.id, "Room is full.");
                return;
            }

            leaveRoom(peer);
            peer.name = cleanName(message.optString("name", ""));
            peer.shipKey = cleanShipKey(message.optString("shipKey", ""));
            peer.visualShipKey = cleanVisualShipKey(message.optString("visualShipKey", peer.shipKey), peer.shipKey);
            peer.ready = false;
            peer.isHost = room.hostId.equals(peer.id);
            peer.roomCode = code;
            room.peers.add(peer.id);

            send(peer.id, new JSONObject().put("type", "room-joined").put("room", snapshotRoom(code)));
            broadcastRoom(code);
        }
    }

    private void handleStartGame(Peer peer) throws JSONException {
        synchronized (roomLock) {
            if (peer.roomCode == null) {
                sendError(peer.id, "Create or join a room first.");
                return;
            }
            Room room = rooms.get(peer.roomCode);
            if (room == null || !room.hostId.equals(peer.id)) {
                sendError(peer.id, "Only the host can start co-op.");
                return;
            }
            if (room.peers.size() < 2) {
                sendError(peer.id, "Both pilots must be ready.");
                return;
            }
            for (String peerId : room.peers) {
                Peer roomPeer = peers.get(peerId);
                if (roomPeer == null || !roomPeer.ready) {
                    sendError(peer.id, "Both pilots must be ready.");
                    return;
                }
            }
            broadcast(room.code, new JSONObject().put("type", "game-started").put("room", snapshotRoom(room.code)), null);
        }
    }

    private void handleGameMessage(Peer peer, Object payload) throws JSONException {
        if (peer.roomCode == null) return;
        Room room = rooms.get(peer.roomCode);
        if (room == null || !room.peers.contains(peer.id)) return;

        Object safePayload = payload == null ? JSONObject.NULL : payload;
        JSONObject outbound = new JSONObject()
            .put("type", "game-message")
            .put("from", peer.id)
            .put("payload", safePayload);
        broadcast(room.code, outbound, peer.id);
    }

    private void cleanupPeer(String id) {
        Peer peer = peers.remove(id);
        if (peer == null) return;
        String previousCode = peer.roomCode;
        synchronized (roomLock) {
            leaveRoom(peer);
        }
        if (previousCode != null) broadcastRoom(previousCode);
    }

    private void leaveRoom(Peer peer) {
        if (peer.roomCode == null) return;

        Room room = rooms.get(peer.roomCode);
        if (room != null) {
            room.peers.remove(peer.id);
            if (room.peers.isEmpty()) {
                rooms.remove(room.code);
            } else if (room.hostId.equals(peer.id)) {
                String nextHostId = room.peers.iterator().next();
                room.hostId = nextHostId;
                Peer nextHost = peers.get(nextHostId);
                if (nextHost != null) nextHost.isHost = true;
            }
        }

        peer.roomCode = null;
        peer.ready = false;
        peer.isHost = false;
    }

    private void broadcastRoom(String code) {
        try {
            Room room = rooms.get(code);
            if (room == null) return;
            broadcast(code, new JSONObject().put("type", "room-update").put("room", snapshotRoom(code)), null);
        } catch (JSONException exception) {
            Log.w(TAG, "Could not broadcast room.", exception);
        }
    }

    private void broadcast(String code, JSONObject message, String exceptPeerId) {
        Room room = rooms.get(code);
        if (room == null) return;
        List<String> targetIds;
        synchronized (roomLock) {
            targetIds = new ArrayList<>(room.peers);
        }
        for (String peerId : targetIds) {
            if (exceptPeerId != null && exceptPeerId.equals(peerId)) continue;
            send(peerId, message);
        }
    }

    private JSONObject snapshotRoom(String code) throws JSONException {
        synchronized (roomLock) {
            Room room = rooms.get(code);
            if (room == null) return null;

            JSONArray players = new JSONArray();
            for (String peerId : room.peers) {
                Peer peer = peers.get(peerId);
                players.put(new JSONObject()
                    .put("id", peerId)
                    .put("name", peer != null ? peer.name : "Pilot")
                    .put("ready", peer != null && peer.ready)
                    .put("host", room.hostId.equals(peerId))
                    .put("shipKey", peer != null ? peer.shipKey : "rocket")
                    .put("visualShipKey", peer != null ? peer.visualShipKey : "rocket"));
            }
            return new JSONObject().put("code", room.code).put("players", players);
        }
    }

    private void sendError(String id, String message) {
        try {
            send(id, new JSONObject().put("type", "error").put("message", message));
        } catch (JSONException ignored) {
        }
    }

    private void send(String id, JSONObject message) {
        Peer peer = peers.get(id);
        if (peer == null || peer.socket.isClosed()) return;
        byte[] payload = message.toString().getBytes(StandardCharsets.UTF_8);
        try {
            writeFrame(peer.socket, payload, 0x1);
        } catch (IOException exception) {
            cleanupPeer(id);
            peer.close();
        }
    }

    private void writeFrame(Socket socket, byte[] payload, int opcode) throws IOException {
        synchronized (socket) {
            OutputStream output = socket.getOutputStream();
            int length = payload.length;
            ByteArrayOutputStream header = new ByteArrayOutputStream();
            header.write(0x80 | opcode);
            if (length < 126) {
                header.write(length);
            } else if (length < 65536) {
                header.write(126);
                header.write((length >> 8) & 0xFF);
                header.write(length & 0xFF);
            } else {
                header.write(127);
                long longLength = length;
                for (int shift = 56; shift >= 0; shift -= 8) {
                    header.write((int) ((longLength >> shift) & 0xFF));
                }
            }
            output.write(header.toByteArray());
            output.write(payload);
            output.flush();
        }
    }

    private String createRoomCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            byte[] bytes = new byte[2];
            random.nextBytes(bytes);
            String code = String.format(Locale.US, "RAID-%02X%02X", bytes[0] & 0xFF, bytes[1] & 0xFF);
            if (!rooms.containsKey(code)) return code;
        }
        return "RAID-" + Long.toString(System.currentTimeMillis(), 36).toUpperCase(Locale.US).substring(0, 4);
    }

    private String cleanRoomCode(String value) {
        String clean = value == null ? "" : value.trim().toUpperCase(Locale.US).replaceAll("[^A-Z0-9-]", "");
        return clean.length() > 12 ? clean.substring(0, 12) : clean;
    }

    private String cleanName(String value) {
        String name = value == null ? "" : value.trim().replaceAll("\\s+", " ");
        if (name.length() > 18) name = name.substring(0, 18);
        return name.isEmpty() ? "Pilot" : name;
    }

    private String cleanShipKey(String value) {
        String shipKey = value == null ? "" : value.trim();
        return ALLOWED_SHIPS.contains(shipKey) ? shipKey : "rocket";
    }

    private String cleanVisualShipKey(String value, String shipKey) {
        String visualShipKey = value == null ? "" : value.trim();
        if (!ALLOWED_VISUAL_SHIPS.contains(visualShipKey)) return shipKey;
        if ("mesiah".equals(shipKey)) {
            return ("mesiah".equals(visualShipKey) || "mesiahBlack".equals(visualShipKey) || "mesiahWhite".equals(visualShipKey))
                ? visualShipKey
                : "mesiah";
        }
        if ("coreLander".equals(shipKey)) {
            return ("coreLander".equals(visualShipKey) || "coreLanderBurning".equals(visualShipKey) || "godGundam".equals(visualShipKey) || "godGundamBurning".equals(visualShipKey) || "spiegel".equals(visualShipKey))
                ? visualShipKey
                : "coreLander";
        }
        return visualShipKey.equals(shipKey) ? visualShipKey : shipKey;
    }

    private String randomId() {
        byte[] bytes = new byte[8];
        random.nextBytes(bytes);
        StringBuilder builder = new StringBuilder();
        for (byte current : bytes) builder.append(String.format(Locale.US, "%02x", current & 0xFF));
        return builder.toString();
    }

    private void closeQuietly(Socket socket) {
        try {
            socket.close();
        } catch (IOException ignored) {
        }
    }

    private static class Frame {
        final boolean fin;
        final int opcode;
        final byte[] payload;

        Frame(boolean fin, int opcode, byte[] payload) {
            this.fin = fin;
            this.opcode = opcode;
            this.payload = payload;
        }
    }

    private static class Peer {
        final String id;
        final Socket socket;
        String roomCode = null;
        String name = "Pilot";
        boolean ready = false;
        boolean isHost = false;
        String shipKey = "rocket";
        String visualShipKey = "rocket";

        Peer(String id, Socket socket) {
            this.id = id;
            this.socket = socket;
        }

        void close() {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
        }
    }

    private static class Room {
        final String code;
        final LinkedHashSet<String> peers = new LinkedHashSet<>();
        String hostId;

        Room(String code, String hostId) {
            this.code = code;
            this.hostId = hostId;
        }
    }
}
