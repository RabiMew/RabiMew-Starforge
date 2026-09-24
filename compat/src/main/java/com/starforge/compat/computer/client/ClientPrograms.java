package com.starforge.compat.computer.client;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.mrcrayfish.furniture.refurbished.computer.Display;
import com.starforge.compat.computer.SecurityProgram;
import com.starforge.compat.computer.StarforgeControlProgram;
import com.starforge.compat.net.MonitorSnapshotPayload;

import net.minecraft.core.BlockPos;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.api.distmarker.OnlyIn;

/**
 * Client side of the monitor programs: binds the DisplayableProgram factories
 * on Refurbished's own Display registry and keeps the latest snapshot per
 * computer position. Loaded only on Dist.CLIENT (see StarforgeCompat).
 */
@OnlyIn(Dist.CLIENT)
public final class ClientPrograms {
    private ClientPrograms() {}

    private static final Map<BlockPos, MonitorSnapshotPayload> SNAPSHOTS = new ConcurrentHashMap<>();

    public static void register() {
        Display.get().bind(StarforgeControlProgram.class, StarforgeControlDisplay::new);
        Display.get().bind(SecurityProgram.class, SecurityDisplay::new);
    }

    public static void onSnapshot(MonitorSnapshotPayload payload) {
        SNAPSHOTS.put(payload.computer(), payload);
    }

    public static MonitorSnapshotPayload snapshot(BlockPos pos) {
        return SNAPSHOTS.get(pos);
    }
}
