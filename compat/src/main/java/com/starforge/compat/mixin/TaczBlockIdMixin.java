package com.starforge.compat.mixin;

import com.starforge.compat.TaczWorkbenchFallback;
import com.tacz.guns.api.DefaultAssets;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Default BlockId fallback for TACZ workbench shell items.
 *
 * Upstream (1.1.8, decompiled): workbench_a/b/c are generic shell items whose
 * real identity — display name, bedrock model, recipe tabs — comes from the
 * gunpack block index addressed by the stack's BlockId custom_data component.
 * Component-less stacks (JEI lock placeholders, quest icons, loot dropped
 * before the fix) resolve to EMPTY_BLOCK_ID and render the missing-texture
 * checkerboard under a raw block.tacz.workbench_* name. This mixin maps each
 * shell item to the default gunpack's index id only when the stack carries no
 * BlockId of its own; stacks with a real BlockId are untouched.
 * workbench_b stays unmapped: the default gunpack assigns it no index.
 */
@Mixin(targets = "com.tacz.guns.api.item.nbt.BlockItemDataAccessor", remap = false)
public interface TaczBlockIdMixin {

    @Inject(method = "getBlockId", at = @At("RETURN"), cancellable = true)
    default void starforge$fallbackBlockId(ItemStack stack, CallbackInfoReturnable<ResourceLocation> cir) {
        ResourceLocation ret = cir.getReturnValue();
        if (ret != null && !ret.equals(DefaultAssets.EMPTY_BLOCK_ID)) return;
        ResourceLocation fallback = TaczWorkbenchFallback.FALLBACK_IDS.get(BuiltInRegistries.ITEM.getKey(stack.getItem()));
        if (fallback != null) cir.setReturnValue(fallback);
    }
}
