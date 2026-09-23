package com.starforge.compat;

import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import net.smileycorp.hordes.common.event.HordeEndEvent;
import net.smileycorp.hordes.common.event.HordeStartEvent;

/**
 * Flips every registered horde alarm in the affected level on horde start/end.
 * Runs only on The Hordes' own events - no tick polling.
 *
 * Loaded only when the hordes mod is present (guarded in the mod constructor),
 * so the hard class references here are safe.
 */
public final class HordeHooks {
    private HordeHooks() {}

    public static void onHordeStart(HordeStartEvent event) {
        setActive(event.getPlayer().level(), true);
    }

    public static void onHordeEnd(HordeEndEvent event) {
        setActive(event.getPlayer().level(), false);
    }

    private static void setActive(Level level, boolean on) {
        if (!(level instanceof ServerLevel server)) return;
        HordeAlarmData data = HordeAlarmData.get(server);
        data.setActive(on);
        for (BlockPos pos : data.alarms()) {
            if (!server.isLoaded(pos)) continue;
            BlockState state = server.getBlockState(pos);
            if (state.is(ModContent.HORDE_ALARM.get())
                && state.getValue(HordeAlarmBlock.ACTIVE) != on) {
                server.setBlock(pos, state.setValue(HordeAlarmBlock.ACTIVE, on), 3);
            }
        }
    }
}
