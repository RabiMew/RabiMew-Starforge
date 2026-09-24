package com.starforge.compat.computer;

import java.util.List;

import com.mrcrayfish.furniture.refurbished.blockentity.IComputer;
import com.mrcrayfish.furniture.refurbished.computer.Program;
import com.starforge.compat.net.MonitorSnapshotPayload;

import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.neoforge.network.PacketDistributor;

/**
 * Base for Starforge's read-only console programs on the Refurbished computer.
 * While a player has the program open the server recomputes a snapshot on a
 * fixed 1 Hz cadence and pushes it as translatable lines; the client renders
 * whatever arrived, or the localized "unavailable" placeholder if a data source
 * is absent. All queries are bounded (own SavedData, the electricity network
 * the computer sits on, or a fixed-radius entity box) - no world scans.
 */
public abstract class MonitorProgram extends Program {

    private static final int REFRESH_TICKS = 20;

    private int ticks;

    protected MonitorProgram(ResourceLocation id, IComputer computer) {
        super(id, computer);
    }

    @Override
    public void tick() {
        if (!computer.isServer()) return;
        if (++ticks % REFRESH_TICKS != 0) return;
        if (!(computer.getUser() instanceof ServerPlayer player)) return;
        ServerLevel level = player.serverLevel();
        BlockPos pos = computer.getComputerPos();
        List<Component> lines = collect(player, level, pos);
        PacketDistributor.sendToPlayer(player,
            new MonitorSnapshotPayload(pos, id, lines, supportsControl()));
    }

    protected abstract List<Component> collect(ServerPlayer player, ServerLevel level, BlockPos pos);

    /** Whether this program exposes the single bounded control action. */
    protected boolean supportsControl() {
        return false;
    }
}
