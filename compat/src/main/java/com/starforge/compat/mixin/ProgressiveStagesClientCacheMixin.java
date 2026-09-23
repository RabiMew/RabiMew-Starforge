package com.starforge.compat.mixin;

import com.enviouse.progressivestages.client.ClientStageCache;
import com.enviouse.progressivestages.common.api.StageId;
import com.starforge.compat.StageI18n;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Client-side localization for every String render path fed by
 * {@link ClientStageCache}: map node labels, detail-panel titles, node
 * tooltips, category chips and the search filter all read these getters.
 * Exact bilingual literals are swapped for the client locale's text; anything
 * else passes through untouched.
 */
@Mixin(ClientStageCache.class)
public abstract class ProgressiveStagesClientCacheMixin {

    @Inject(method = {"getDisplayName", "getDescription", "getCategory"},
            at = @At("RETURN"), cancellable = true)
    private static void starforge$localizeStageStrings(StageId id, CallbackInfoReturnable<String> cir) {
        cir.setReturnValue(StageI18n.localize(cir.getReturnValue()));
    }
}
