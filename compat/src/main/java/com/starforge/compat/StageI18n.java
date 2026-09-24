package com.starforge.compat;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.locale.Language;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.neoforged.fml.loading.FMLPaths;

import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.Function;

/**
 * Render-time localization for ProgressiveStages display strings.
 *
 * <p>ProgressiveStages stores {@code display_name}/{@code description}/
 * {@code category}/{@code unlock_message} as literal text with no
 * translatable-key support, so the pack generator writes bilingual
 * "zh / en" literals and emits {@code config/starforge/stage_i18n.json}
 * mapping each literal to a lang key. Mixins call into this class so every
 * client renders its own locale while the stored text stays a readable
 * fallback for anything we cannot intercept.</p>
 */
public final class StageI18n {
    private record Pair(String literal, String key) {}

    // <ps:name> markers embedded in ProgressiveStages messages.* config values.
    // Unlike bilingual literals they survive {placeholder} substitution anywhere
    // in the string, so lock tooltips / denial messages / command feedback can
    // all render per-locale via Component.translatable("modpack.ps.<name>").
    private static final java.util.regex.Pattern MSG =
        java.util.regex.Pattern.compile("<ps:([a-z0-9_]+)>");

    private static volatile List<Pair> pairs;

    private StageI18n() {}

    private static List<Pair> pairs() {
        List<Pair> p = pairs;
        if (p == null) {
            synchronized (StageI18n.class) {
                if (pairs == null) pairs = load();
                p = pairs;
            }
        }
        return p;
    }

    private static List<Pair> load() {
        List<Pair> out = new ArrayList<>();
        Path file = FMLPaths.CONFIGDIR.get().resolve("starforge").resolve("stage_i18n.json");
        try (Reader r = Files.newBufferedReader(file)) {
            JsonArray arr = new Gson().fromJson(r, JsonObject.class).getAsJsonArray("pairs");
            for (JsonElement e : arr) {
                JsonObject o = e.getAsJsonObject();
                out.add(new Pair(o.get("literal").getAsString(), o.get("key").getAsString()));
            }
        } catch (Exception ignored) {
            // Missing/malformed map: every consumer falls back to the raw literal.
        }
        // Longest first so overlapping literals resolve deterministically.
        out.sort(Comparator.comparingInt((Pair p) -> p.literal().length()).reversed());
        return out;
    }

    /** Exact-match localization for String render paths (map labels, search). */
    public static String localize(String raw) {
        if (raw == null || raw.isEmpty() || !raw.contains(" / ")) return raw;
        for (Pair p : pairs()) {
            if (p.literal().equals(raw)) {
                Language lang = Language.getInstance();
                return lang.has(p.key()) ? lang.getOrDefault(p.key()) : raw;
            }
        }
        return raw;
    }

    /** Fast pre-check so component paths skip work unless a literal is present. */
    public static boolean containsPair(String raw) {
        if (raw == null || !raw.contains(" / ")) return false;
        for (Pair p : pairs()) {
            if (raw.contains(p.literal())) return true;
        }
        return false;
    }

    /** True when raw embeds a {@code <ps:key>} message marker. */
    public static boolean containsMarker(String raw) {
        return raw != null && MSG.matcher(raw).find();
    }

    /**
     * Rebuilds {@code raw} into a component where each registered bilingual
     * literal becomes a translatable component; unmatched segments go through
     * {@code plain} (keeps PS '&' colour-code handling or plain literals).
     */
    public static MutableComponent translateInline(String raw, Function<String, Component> plain) {
        List<Pair> ps = pairs();
        MutableComponent result = Component.empty();
        StringBuilder seg = new StringBuilder();
        int i = 0;
        while (i < raw.length()) {
            Pair hit = null;
            for (Pair p : ps) {
                if (raw.startsWith(p.literal(), i)) { hit = p; break; }
            }
            if (hit == null) {
                seg.append(raw.charAt(i++));
            } else {
                if (seg.length() > 0) {
                    result.append(plain.apply(seg.toString()));
                    seg.setLength(0);
                }
                result.append(Component.translatable(hit.key()));
                i += hit.literal().length();
            }
        }
        if (seg.length() > 0) result.append(plain.apply(seg.toString()));
        return result;
    }

    /**
     * Rebuilds {@code raw} into a component where each {@code <ps:key>} marker
     * becomes {@code Component.translatable("modpack.ps." + key)}; unmatched
     * segments go through {@code plain}. Used for messages.* config strings —
     * markers sit outside substituted placeholders, so unlike bilingual
     * literals they work for any placeholder position, and the translatable
     * components localize per-client even when produced server-side.
     */
    public static MutableComponent translateMarkers(String raw, Function<String, Component> plain) {
        MutableComponent result = Component.empty();
        StringBuilder seg = new StringBuilder();
        java.util.regex.Matcher m = MSG.matcher(raw);
        int i = 0;
        while (m.find()) {
            seg.append(raw, i, m.start());
            if (seg.length() > 0) {
                result.append(plain.apply(seg.toString()));
                seg.setLength(0);
            }
            result.append(Component.translatable("modpack.ps." + m.group(1)));
            i = m.end();
        }
        if (i < raw.length()) result.append(plain.apply(raw.substring(i)));
        return result;
    }

    /** String arg -> composite component when it embeds a registered literal. */
    public static Object localizeArg(Object arg) {
        if (arg instanceof String s && containsPair(s)) {
            return translateInline(s, Component::literal);
        }
        return arg;
    }
}
