package com.starforge.compat.computer;

import java.util.ArrayList;
import java.util.List;

import com.mrcrayfish.furniture.refurbished.blockentity.IComputer;
import com.starforge.compat.HordeAlarmData;
import com.starforge.compat.ModContent;

import dev.entropy159.taczturrets.turret.TurretEntity;
import tallestegg.guardvillagers.common.entities.Guard;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.neoforged.fml.ModList;

/**
 * Security — defense status panel on the Refurbished computer. Reports the
 * horde flag, alarm lamps registered with {@link HordeAlarmData}, TaCZ turrets
 * and Guard Villagers within a fixed radius of the computer. The one control
 * is a bounded alarm toggle: it flips ACTIVE on registered alarm blocks near
 * the computer (horde events keep overwriting it naturally).
 */
public class SecurityProgram extends MonitorProgram {

    private static final String L10N = "computer_program.starforge_compat.security.";
    public static final String ACTION_TOGGLE_ALARMS = "toggle_alarms";

    /** Defense perimeter read by the app; the toggle control shares it. */
    static final int RADIUS = 48;

    private static final boolean TURRETS = ModList.get().isLoaded("taczturrets");
    private static final boolean GUARDS = ModList.get().isLoaded("guardvillagers");

    public SecurityProgram(ResourceLocation id, IComputer computer) {
        super(id, computer);
    }

    @Override
    protected List<Component> collect(ServerPlayer player, ServerLevel level, BlockPos pos) {
        List<Component> lines = new ArrayList<>();
        HordeAlarmData alarms = HordeAlarmData.get(level);
        lines.add(Component.translatable(L10N + "horde",
            Component.translatable(alarms.active() ? L10N + "horde.active" : L10N + "horde.calm")));

        int alarmCount = alarmsNear(level, pos).size();
        lines.add(Component.translatable(L10N + "alarms", alarmCount));

        if (TURRETS) {
            AABB box = new AABB(pos).inflate(RADIUS);
            int total = 0, armed = 0, ready = 0, enabled = 0;
            for (TurretEntity turret : level.getEntitiesOfClass(TurretEntity.class, box)) {
                total++;
                if (turret.hasGun()) armed++;
                if (turret.gunHasAmmo()) ready++;
                if (turret.isEnabled()) enabled++;
            }
            lines.add(Component.translatable(L10N + "turrets", total, enabled, armed, ready));
        } else {
            lines.add(Component.translatable(L10N + "turrets.unavailable"));
        }

        if (GUARDS) {
            int guards = level.getEntitiesOfClass(Guard.class,
                new AABB(pos).inflate(RADIUS)).size();
            lines.add(Component.translatable(L10N + "guards", guards));
        } else {
            lines.add(Component.translatable(L10N + "guards.unavailable"));
        }
        return lines;
    }

    @Override
    protected boolean supportsControl() {
        return true;
    }

    /** Alarm positions registered for this dimension that are inside range and
     *  still alarm blocks (stale entries are skipped, not trusted). */
    static List<BlockPos> alarmsNear(ServerLevel level, BlockPos pos) {
        List<BlockPos> out = new ArrayList<>();
        double maxSqr = (double) RADIUS * RADIUS;
        for (BlockPos alarm : HordeAlarmData.get(level).alarms()) {
            if (alarm.distSqr(pos) > maxSqr) continue;
            if (level.getBlockState(alarm).getBlock() != ModContent.HORDE_ALARM.get()) continue;
            out.add(alarm);
        }
        return out;
    }

    /** Server-side handler for the app's one action: flip ACTIVE on every
     *  alarm in range of the given computer. Returns affected count. */
    public static int toggleAlarms(ServerLevel level, BlockPos computerPos) {
        int flipped = 0;
        for (BlockPos alarm : alarmsNear(level, computerPos)) {
            BlockState state = level.getBlockState(alarm);
            level.setBlock(alarm, state.setValue(com.starforge.compat.HordeAlarmBlock.ACTIVE,
                !state.getValue(com.starforge.compat.HordeAlarmBlock.ACTIVE)), 3);
            flipped++;
        }
        return flipped;
    }
}
