package com.starforge.compat.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

import com.starforge.compat.ServerLoad;

import net.neoforged.neoforge.common.ModConfigSpec;

/**
 * Load-scaled horde re-pathing.
 *
 * Upstream (The Hordes 1.6.3f): HordeTrackPlayerGoal initialises its recalc
 * countdown with a per-mob random offset — repaths are already staggered — and
 * resets it to the flat config value (hordes-common.toml hordePathingInterval,
 * 25 in this pack). This redirect keeps the upstream stagger and only swaps the
 * reset value for a load-scaled one: 25 normal, >=40 when MSPT > 40, >=60 when
 * MSPT > 45. Existing mobs are never deleted or stalled harder than this.
 */
@Mixin(targets = "net.smileycorp.hordes.common.ai.HordeTrackPlayerGoal", remap = false)
public abstract class HordePathingMixin {

    @Redirect(method = {"<init>", "tick"},
            at = @At(value = "INVOKE",
                    target = "Lnet/neoforged/neoforge/common/ModConfigSpec$ConfigValue;get()Ljava/lang/Object;"))
    private Object starforge$scaledPathingInterval(ModConfigSpec.ConfigValue<?> config) {
        Object base = config.get();
        if (base instanceof Number n) {
            return ServerLoad.hordePathingInterval(n.intValue());
        }
        return base;
    }
}
