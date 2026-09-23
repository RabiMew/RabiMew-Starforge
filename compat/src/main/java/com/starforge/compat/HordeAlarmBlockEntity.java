package com.starforge.compat;

import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;

/**
 * Registers this alarm's position in the per-level SavedData on load and
 * unregisters on removal, and reconciles its ACTIVE state with the recorded
 * horde flag (covers hordes that ended while the chunk was unloaded).
 */
public class HordeAlarmBlockEntity extends BlockEntity {

    public HordeAlarmBlockEntity(BlockPos pos, BlockState state) {
        super(ModContent.HORDE_ALARM_BE.get(), pos, state);
    }

    @Override
    public void setLevel(net.minecraft.world.level.Level level) {
        super.setLevel(level);
        if (level instanceof ServerLevel server) {
            HordeAlarmData data = HordeAlarmData.get(server);
            data.addAlarm(getBlockPos());
            reconcile(server, data);
        }
    }

    @Override
    public void setRemoved() {
        if (level instanceof ServerLevel server) {
            HordeAlarmData.get(server).removeAlarm(getBlockPos());
        }
        super.setRemoved();
    }

    private void reconcile(ServerLevel level, HordeAlarmData data) {
        BlockState state = getBlockState();
        if (state.getValue(HordeAlarmBlock.ACTIVE) != data.active()) {
            level.setBlock(getBlockPos(),
                state.setValue(HordeAlarmBlock.ACTIVE, data.active()), 3);
        }
    }
}
