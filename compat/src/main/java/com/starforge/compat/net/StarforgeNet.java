package com.starforge.compat.net;

import com.starforge.compat.computer.SecurityProgram;
import com.starforge.compat.computer.client.ClientPrograms;

import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.neoforge.network.event.RegisterPayloadHandlersEvent;
import net.neoforged.neoforge.network.handling.IPayloadContext;
import net.neoforged.neoforge.network.registration.PayloadRegistrar;

/** Payload registration + handlers for the computer monitor programs. */
public final class StarforgeNet {
    private StarforgeNet() {}

    public static void register(RegisterPayloadHandlersEvent event) {
        PayloadRegistrar r = event.registrar("1");
        r.playToClient(MonitorSnapshotPayload.TYPE, MonitorSnapshotPayload.CODEC,
            StarforgeNet::handleSnapshot);
        r.playToServer(MonitorActionPayload.TYPE, MonitorActionPayload.CODEC,
            StarforgeNet::handleAction);
    }

    private static void handleSnapshot(MonitorSnapshotPayload payload, IPayloadContext ctx) {
        // Client-bound: resolved lazily so the dedicated server never links the class.
        ctx.enqueueWork(() -> ClientPrograms.onSnapshot(payload));
    }

    private static void handleAction(MonitorActionPayload payload, IPayloadContext ctx) {
        ctx.enqueueWork(() -> {
            if (!(ctx.player() instanceof ServerPlayer player)) return;
            if (player.distanceToSqr(payload.computer().getX() + 0.5,
                    payload.computer().getY() + 0.5, payload.computer().getZ() + 0.5) > 64) return;
            if (!SecurityProgram.ACTION_TOGGLE_ALARMS.equals(payload.action())) return;
            if (!(player.level() instanceof ServerLevel level)) return;
            SecurityProgram.toggleAlarms(level, payload.computer());
        });
    }
}
