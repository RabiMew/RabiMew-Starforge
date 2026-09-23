package com.starforge.compat.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import com.starforge.compat.ServerLoad;

import net.minecraft.server.level.ServerPlayer;

/**
 * Pauses NEW horde waves while the server is saturated (avg MSPT > 45).
 * The horde event itself keeps running and existing mobs keep fighting —
 * a skipped wave simply never materialises, which is the documented
 * degradation order: shed spawn pressure before touching live combat.
 */
@Mixin(targets = "net.smileycorp.hordes.hordeevent.capability.HordeEvent", remap = false)
public abstract class HordeWavePauseMixin {

    @Inject(method = "spawnWave", at = @At("HEAD"), cancellable = true)
    private void starforge$deferWaveUnderLoad(ServerPlayer player, int amount, CallbackInfo ci) {
        if (ServerLoad.pauseHordeWaves()) ci.cancel();
    }
}
