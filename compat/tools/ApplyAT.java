// Applies NeoForge's accesstransformer.cfg to a copy of the Minecraft server
// jar so javac sees the same (public) member access the runtime has after AT
// transformation. Runtime is untouched - this is a compile-classpath artifact.
// Usage: java -cp <atlib+asm+antlr> ApplyAT <at.cfg> <in.jar> <out.jar>
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.Type;
import org.objectweb.asm.tree.ClassNode;

import net.neoforged.accesstransformer.AccessTransformerEngineImpl;

public class ApplyAT {
    public static void main(String[] args) throws Exception {
        Path cfg = Path.of(args[0]);
        Path in = Path.of(args[1]);
        Path out = Path.of(args[2]);

        AccessTransformerEngineImpl engine = new AccessTransformerEngineImpl();
        engine.loadATFromPath(cfg);
        Set<Type> targets = engine.getTargets();
        int transformed = 0;

        try (ZipFile zin = new ZipFile(in.toFile());
             ZipOutputStream zout = new ZipOutputStream(Files.newOutputStream(out))) {
            var entries = zin.entries();
            while (entries.hasMoreElements()) {
                ZipEntry e = entries.nextElement();
                String name = e.getName();
                byte[] data;
                try (InputStream is = zin.getInputStream(e)) {
                    data = is.readAllBytes();
                }
                if (name.endsWith(".class")) {
                    Type t = Type.getObjectType(name.substring(0, name.length() - 6));
                    if (targets.contains(t)) {
                        ClassReader cr = new ClassReader(data);
                        ClassNode node = new ClassNode();
                        cr.accept(node, 0);
                        if (engine.transform(node, t)) {
                            ClassWriter cw = new ClassWriter(0);
                            node.accept(cw);
                            data = cw.toByteArray();
                            transformed++;
                        }
                    }
                }
                zout.putNextEntry(new ZipEntry(name));
                zout.write(data);
                zout.closeEntry();
            }
        }
        System.out.println("ApplyAT: transformed " + transformed + " classes -> " + out);
    }
}
