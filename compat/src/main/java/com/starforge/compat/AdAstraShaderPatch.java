package com.starforge.compat;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mojang.logging.LogUtils;
import net.neoforged.fml.loading.FMLPaths;
import org.slf4j.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Post-patch for the EuphoriaPatcher-generated Complementary shader directory.
 *
 * <p>Euphoria Patcher generates the {@code shaderpacks/ComplementaryReimagined_*}
 * plus {@code EuphoriaPatches_*} directory during mod construction. Its stock
 * dimension.properties routes only part of the Ad Astra dimension set, and the
 * {@code world0=*} wildcard sends unmapped space dimensions through the
 * overworld pipeline (aurora, clouds, atmosphere in vacuum). This class applies
 * the declarative op set bundled at {@code /starforge_compat/adastra/ops.json}
 * (mirrored by the Node-side twin {@code tools/patch-euphoria-adastra.mjs}):
 * custom Iris world folders cloned from world0, per-dimension GLSL presets,
 * dimension.properties remapping, and program/pass guards.</p>
 *
 * <p>The op set is adapted from the community "euphoria_adastra_patcher"
 * manifest (github.com/EuphoriaPatches, no license file; logic and science
 * values ported with attribution, not copied wholesale).</p>
 *
 * <p>Runs once per launch at {@code FMLClientSetupEvent}, after all mod
 * constructors (so Euphoria's output exists) and before Iris builds its first
 * pipeline. Idempotent: a marker file plus per-op content checks make re-runs
 * and mid-failure recovery safe.</p>
 */
public final class AdAstraShaderPatch {
    private static final Logger LOGGER = LogUtils.getLogger();
    private static final String RES = "/starforge_compat/adastra/";
    private static final String MARKER = ".starforge_adastra_patch";
    private static final String OVERWORLD_DEFINE = "#define OVERWORLD";

    private AdAstraShaderPatch() {}

    /** Called from the client setup event. Never throws; shader patching must
     * not take the mod down. */
    public static void apply() {
        try {
            applyChecked();
        } catch (Throwable t) {
            LOGGER.warn("Ad Astra shader patch skipped: " + t);
        }
    }

    private static void applyChecked() throws IOException {
        Path shaderpacks = FMLPaths.GAMEDIR.get().resolve("shaderpacks");
        if (!Files.isDirectory(shaderpacks)) return;

        Path pack = null;
        try (DirectoryStream<Path> ds = Files.newDirectoryStream(shaderpacks)) {
            for (Path p : ds) {
                String n = p.getFileName().toString();
                if (Files.isDirectory(p) && n.contains("EuphoriaPatches")) {
                    pack = p;
                    break;
                }
            }
        }
        if (pack == null) return; // Euphoria output not generated (shader disabled or first boot before EP ran)

        String manifestText = readRes("ops.json");
        if (manifestText == null) return;
        JsonObject manifest = JsonParser.parseString(manifestText).getAsJsonObject();
        String manifestHash = Integer.toHexString(manifestText.hashCode());

        Path marker = pack.resolve("shaders").resolve(MARKER);
        if (Files.exists(marker)) {
            String m = Files.readString(marker, StandardCharsets.UTF_8);
            if (m.contains("hash=" + manifestHash)) {
                return; // already applied
            }
        }

        JsonArray ops = manifest.getAsJsonArray("ops");
        List<String> failures = new ArrayList<>();
        for (JsonElement e : ops) {
            JsonObject op = e.getAsJsonObject();
            String id = op.get("id").getAsString();
            try {
                if (!applyOp(pack, op)) {
                    failures.add(id);
                }
            } catch (Throwable t) {
                failures.add(id + " (" + t + ")");
            }
        }
        if (!failures.isEmpty()) {
            LOGGER.warn("Ad Astra shader patch: " + failures.size()
                + " op(s) failed: " + String.join(", ", failures));
            return; // no marker -> retry next launch
        }
        Files.writeString(marker,
            "hash=" + manifestHash + "\nops=" + ops.size() + "\n", StandardCharsets.UTF_8);
        LOGGER.info("Ad Astra shader patch applied to " + pack.getFileName());
    }

    private static boolean applyOp(Path pack, JsonObject op) throws IOException {
        String type = op.get("type").getAsString();
        Path target = pack.resolve(op.get("target").getAsString());
        switch (type) {
            case "create_file": {
                String body = readRes(op.get("payload").getAsString());
                if (body == null) return false;
                Files.createDirectories(target.getParent());
                // idempotent: identical content -> skip write
                if (Files.exists(target)
                    && Files.readString(target, StandardCharsets.UTF_8).equals(body)) {
                    return true;
                }
                Files.writeString(target, body, StandardCharsets.UTF_8);
                return true;
            }
            case "insert_after": {
                String text = readNormalized(target);
                if (text == null) return false;
                String anchor = op.get("anchor").getAsString();
                String body = readRes(op.get("payload").getAsString());
                if (body == null) return false;
                if (text.contains(body.strip())) return true; // already applied
                int first = text.indexOf(anchor);
                if (first < 0 || text.indexOf(anchor, first + 1) >= 0) return false;
                int end = first + anchor.length();
                String prefix = text.substring(0, end);
                String suffix = text.substring(end);
                String lead = prefix.endsWith("\n") || body.startsWith("\n") ? "" : "\n";
                String trail = body.endsWith("\n") || suffix.startsWith("\n") ? "" : "\n";
                Files.writeString(target, prefix + lead + body + trail + suffix, StandardCharsets.UTF_8);
                return true;
            }
            case "replace_once": {
                String text = readNormalized(target);
                if (text == null) return false;
                String anchor = op.get("anchor").getAsString();
                String body = readRes(op.get("payload").getAsString());
                if (body == null) return false;
                if (!text.contains(anchor)) {
                    return text.contains(body.strip()); // already replaced
                }
                if (text.indexOf(anchor) != text.lastIndexOf(anchor)) return false;
                Files.writeString(target,
                    text.substring(0, text.indexOf(anchor)) + body
                        + text.substring(text.indexOf(anchor) + anchor.length()),
                    StandardCharsets.UTF_8);
                return true;
            }
            case "generate_world_folders": {
                Path srcRoot = pack.resolve(op.get("source_folder").getAsString());
                if (!Files.isDirectory(srcRoot)) return false;
                List<Path> files = new ArrayList<>();
                try (DirectoryStream<Path> ds = Files.newDirectoryStream(srcRoot)) {
                    for (Path p : ds) if (Files.isRegularFile(p)) files.add(p);
                }
                files.sort(null);
                JsonObject folders = op.getAsJsonObject("folders");
                for (Map.Entry<String, JsonElement> fe : folders.entrySet()) {
                    JsonArray defines = fe.getValue().getAsJsonArray();
                    if (defines.size() != 1) return false;
                    String define = defines.get(0).getAsString();
                    Path dest = srcRoot.getParent().resolve(fe.getKey());
                    Files.createDirectories(dest);
                    for (Path src : files) {
                        Path dst = dest.resolve(src.getFileName().toString());
                        String t = Files.readString(src, StandardCharsets.UTF_8)
                            .replace("\r\n", "\n");
                        String name = src.getFileName().toString();
                        boolean wrapper = name.endsWith(".vsh") || name.endsWith(".fsh")
                            || name.endsWith(".csh");
                        if (wrapper && t.contains("ADASTRA_PRESET")) {
                            // already injected: keep content
                        } else if (wrapper && countLines(t, OVERWORLD_DEFINE) == 1) {
                            t = t.replaceFirst(java.util.regex.Pattern.quote(OVERWORLD_DEFINE),
                                java.util.regex.Matcher.quoteReplacement(
                                    OVERWORLD_DEFINE + "\n#define ADASTRA_PRESET 1\n#define "
                                        + define + " 1"));
                        }
                        Files.writeString(dst, t, StandardCharsets.UTF_8);
                    }
                }
                return true;
            }
            case "remap_dimension_properties": {
                return remapDimensions(target, op);
            }
            default:
                return false;
        }
    }

    private static boolean remapDimensions(Path target, JsonObject op) throws IOException {
        String text = readNormalized(target);
        if (text == null) return false;

        List<String> addLines = new ArrayList<>();
        for (JsonElement e : op.getAsJsonArray("add_lines")) addLines.add(e.getAsString());
        if (addLines.stream().allMatch(text::contains)) return true; // already applied

        String[] lines = text.split("\n", -1);
        int guard = indexOf(lines, "#if MC_VERSION > 10710");
        int els = indexOf(lines, "#else");
        if (guard < 0 || els < 0 || els <= guard) return false;

        List<String> remove = new ArrayList<>();
        for (JsonElement e : op.getAsJsonArray("remove_ids")) remove.add(e.getAsString());
        Map<String, Integer> counts = new LinkedHashMap<>();
        remove.forEach(id -> counts.put(id, 0));

        List<String> modern = new ArrayList<>(List.of(lines).subList(guard + 1, els));
        List<String> rewritten = new ArrayList<>();
        for (int i = 0; i < modern.size(); i++) {
            String line = modern.get(i);
            boolean cont = line.stripTrailing().endsWith("\\");
            String body = cont ? line.stripTrailing()
                .substring(0, line.stripTrailing().length() - 1).stripTrailing() : line;
            String[] toks = body.trim().split("\\s+");
            List<String> matched = new ArrayList<>();
            List<String> rest = new ArrayList<>();
            for (String tok : toks) {
                if (tok.isEmpty()) continue;
                if (remove.contains(tok)) matched.add(tok); else rest.add(tok);
            }
            if (matched.isEmpty()) { rewritten.add(line); continue; }
            matched.forEach(id -> counts.merge(id, 1, Integer::sum));
            if (!rest.isEmpty()) {
                int lead = body.length() - body.stripLeading().length();
                rewritten.add(body.substring(0, lead) + String.join(" ", rest)
                    + (cont ? " \\" : ""));
            } else {
                if (!cont) return false;
                i++; // skip the paired bare "\" continuation line
            }
        }
        if (counts.values().stream().anyMatch(c -> c != 1)) return false;

        int endIdx = -1;
        for (int i = 0; i < rewritten.size(); i++) {
            if (rewritten.get(i).startsWith("dimension.world1=")) { endIdx = i; break; }
        }
        if (endIdx < 0) return false;
        while (rewritten.get(endIdx).stripTrailing().endsWith("\\")) {
            endIdx++;
            if (endIdx >= rewritten.size()) return false;
        }
        List<String> banner = new ArrayList<>();
        banner.add("");
        banner.add("#---------------------------------------------------------------------------------------------------------------------");
        banner.add("# Starforge Ad Astra custom dimension mappings");
        banner.add("#---------------------------------------------------------------------------------------------------------------------");
        banner.addAll(addLines);
        rewritten.addAll(endIdx + 1, banner);

        List<String> out = new ArrayList<>();
        for (int i = 0; i <= guard; i++) out.add(lines[i]);
        out.addAll(rewritten);
        for (int i = els; i < lines.length; i++) out.add(lines[i]);
        Files.writeString(target, String.join("\n", out), StandardCharsets.UTF_8);
        return true;
    }

    private static String readNormalized(Path p) throws IOException {
        if (!Files.exists(p)) return null;
        return Files.readString(p, StandardCharsets.UTF_8).replace("\r\n", "\n");
    }

    private static String readRes(String rel) throws IOException {
        try (InputStream in = AdAstraShaderPatch.class.getResourceAsStream(RES + rel)) {
            if (in == null) return null;
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static int indexOf(String[] lines, String want) {
        for (int i = 0; i < lines.length; i++) if (lines[i].equals(want)) return i;
        return -1;
    }

    private static int countLines(String text, String line) {
        int n = 0;
        for (String l : text.split("\n")) if (l.equals(line)) n++;
        return n;
    }
}
