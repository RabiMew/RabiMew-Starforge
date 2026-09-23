package com.starforge.compat.mixin;

import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import com.ddd.guardvillagerstaczsupport.Config;
import com.starforge.compat.SupplyPointData;

import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.Container;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.entity.BlockEntity;
import tallestegg.guardvillagers.common.entities.Guard;

/**
 * Registered-supply-point cache for Guard Villagers TACZ Support.
 *
 * Upstream (1.0.1, decompiled): when a guard's per-guard container cache misses,
 * findNearestVanilla{Food,Ammo}Container walks BlockPos.withinManhattan over the
 * full configured radius calling getBlockEntity per position — ~2.1M lookups at
 * radius 64. This mixin lets guards ask the colony's SupplyPointData registry
 * first (positions a previous search already proved out) and only falls
 * through to the upstream area scan on a registry miss. Every registry hit is
 * re-validated against live inventory before use, and every successful upstream
 * scan result is registered for the next guard — logistics stay real.
 */
@Mixin(targets = "com.ddd.guardvillagerstaczsupport.TaczGunAttackGoal", remap = false)
public abstract class TaczGunAttackGoalMixin {

    @Shadow @Final private Guard guard;

    @Shadow private boolean isVanillaBlockEntity(BlockEntity be) { throw new AssertionError(); }
    @Shadow private boolean containerHasFood(Container container) { throw new AssertionError(); }
    @Shadow private boolean containerHasCompatibleAmmo(Container container, ItemStack stack) { throw new AssertionError(); }
    @Shadow private boolean isTimedOutAmmoContainer(BlockPos pos) { throw new AssertionError(); }
    @Shadow private boolean isTimedOutFoodContainer(BlockPos pos) { throw new AssertionError(); }

    @Inject(method = "findNearestVanillaAmmoContainer", at = @At("HEAD"), cancellable = true)
    private void starforge$registeredAmmo(ItemStack stack, CallbackInfoReturnable<BlockPos> cir) {
        if (!(this.guard.level() instanceof ServerLevel level)) return;
        double maxSqr = starforge$radiusSqr(Config.AMMO_SEARCH_RADIUS.get());
        BlockPos hit = SupplyPointData.get(level).nearest(this.guard.blockPosition(), maxSqr,
                SupplyPointData.Kind.AMMO,
                pos -> this.starforge$isAmmoPoint(level, pos, stack),
                pos -> !this.isTimedOutAmmoContainer(pos));
        if (hit != null) cir.setReturnValue(hit);
    }

    @Inject(method = "findNearestVanillaAmmoContainer", at = @At("RETURN"))
    private void starforge$learnAmmo(ItemStack stack, CallbackInfoReturnable<BlockPos> cir) {
        starforge$learn(cir.getReturnValue(), SupplyPointData.Kind.AMMO);
    }

    @Inject(method = "findNearestVanillaFoodContainer", at = @At("HEAD"), cancellable = true)
    private void starforge$registeredFood(CallbackInfoReturnable<BlockPos> cir) {
        if (!(this.guard.level() instanceof ServerLevel level)) return;
        double maxSqr = starforge$radiusSqr(Config.FOOD_SEARCH_RADIUS.get());
        BlockPos hit = SupplyPointData.get(level).nearest(this.guard.blockPosition(), maxSqr,
                SupplyPointData.Kind.FOOD,
                pos -> this.starforge$isFoodPoint(level, pos),
                pos -> !this.isTimedOutFoodContainer(pos));
        if (hit != null) cir.setReturnValue(hit);
    }

    @Inject(method = "findNearestVanillaFoodContainer", at = @At("RETURN"))
    private void starforge$learnFood(CallbackInfoReturnable<BlockPos> cir) {
        starforge$learn(cir.getReturnValue(), SupplyPointData.Kind.FOOD);
    }

    private void starforge$learn(BlockPos pos, SupplyPointData.Kind kind) {
        if (pos != null && this.guard.level() instanceof ServerLevel level) {
            SupplyPointData.get(level).add(pos, kind);
        }
    }

    private boolean starforge$isAmmoPoint(ServerLevel level, BlockPos pos, ItemStack stack) {
        BlockEntity be = level.getBlockEntity(pos);
        return be instanceof Container container
                && this.isVanillaBlockEntity(be)
                && this.containerHasCompatibleAmmo(container, stack);
    }

    private boolean starforge$isFoodPoint(ServerLevel level, BlockPos pos) {
        BlockEntity be = level.getBlockEntity(pos);
        return be instanceof Container container
                && this.isVanillaBlockEntity(be)
                && this.containerHasFood(container);
    }

    private static double starforge$radiusSqr(int radius) {
        return (double) radius * radius;
    }
}
