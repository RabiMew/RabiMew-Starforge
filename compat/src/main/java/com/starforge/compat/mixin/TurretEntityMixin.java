package com.starforge.compat.mixin;

import java.util.List;
import java.util.function.Function;

import org.objectweb.asm.Opcodes;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyConstant;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.level.Level;
import net.tslat.smartbrainlib.api.core.sensor.ExtendedSensor;
import net.tslat.smartbrainlib.api.core.sensor.vanilla.NearbyLivingEntitySensor;
import net.tslat.smartbrainlib.api.core.sensor.vanilla.NearbyPlayersSensor;
import net.tslat.smartbrainlib.util.BrainUtils;

/**
 * TACZ Turrets acquisition-scan throttling.
 *
 * Upstream behaviour (2.0.0, decompiled): every turret's two Nearby* sensors do
 * a full range-radius entity scan on a flat 20-tick cadence whose phase is set
 * by first-tick alignment — so a batch of turrets loaded in one chunk tick
 * scans in lockstep forever. spreadTargets() additionally runs two
 * getEntitiesOfClass scans every 10 ticks.
 *
 * What this mixin changes (cadence only — targeting rules, trust lists, ammo
 * use and damage are untouched):
 *  - Nearby* sensors get a per-turret scan period: 20–29 ticks while the
 *    turret has no target (upstream mean, but id-dephased so batch-loaded
 *    turrets no longer spike one tick), 60–69 ticks while it does
 *    (target reuse; the spread/alert paths already cover mid-fight switching).
 *  - spreadTargets() runs every 20 ticks staggered by entity id instead of a
 *    spawn-aligned every-10.
 */
@Mixin(targets = "dev.entropy159.taczturrets.turret.TurretEntity", remap = false)
public abstract class TurretEntityMixin extends Mob {

    /** Base acquisition interval (ticks) while the turret has no target —
     *  same 20 as upstream; the win is dephasing, not higher frequency. */
    private static final int SF_ACQUIRE_INTERVAL = 20;
    /** Extra idle interval spread, derived from the entity id. */
    private static final int SF_SCAN_STAGGER = 10;
    /** Re-scan interval while a valid target is already held. */
    private static final int SF_TARGETED_INTERVAL = 60;
    /** spreadTargets cadence (upstream: 10 ticks, spawn-phase aligned). */
    private static final int SF_SPREAD_INTERVAL = 20;

    protected TurretEntityMixin(EntityType<? extends Mob> type, Level level) {
        super(type, level);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Inject(method = "getSensors", at = @At("RETURN"))
    private void starforge$tuneSensorCadence(CallbackInfoReturnable<List<?>> cir) {
        for (Object sensor : cir.getReturnValue()) {
            if (sensor instanceof NearbyLivingEntitySensor || sensor instanceof NearbyPlayersSensor) {
                ((ExtendedSensor) sensor).setScanRate(
                        (Function<LivingEntity, Integer>) TurretEntityMixin::starforge$nextScan);
            }
        }
    }

    private static int starforge$nextScan(LivingEntity turret) {
        int stagger = turret.getId() % SF_SCAN_STAGGER;
        return BrainUtils.getTargetOfEntity(turret) != null
                ? SF_TARGETED_INTERVAL + stagger
                : SF_ACQUIRE_INTERVAL + stagger;
    }

    @ModifyConstant(method = "spreadTargets", constant = @Constant(intValue = 10))
    private int starforge$spreadInterval(int original) {
        return SF_SPREAD_INTERVAL;
    }

    @Redirect(method = "spreadTargets",
            at = @At(value = "FIELD",
                    target = "Ldev/entropy159/taczturrets/turret/TurretEntity;tickCount:I",
                    opcode = Opcodes.GETFIELD))
    private int starforge$dephaseSpread(dev.entropy159.taczturrets.turret.TurretEntity self) {
        // (tickCount + id) % interval: batch-loaded turrets no longer share a
        // common scan tick just because they spawned on the same tick.
        return self.tickCount + self.getId();
    }
}
