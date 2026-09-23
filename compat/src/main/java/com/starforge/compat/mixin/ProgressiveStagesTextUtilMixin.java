package com.starforge.compat.mixin;

import com.enviouse.progressivestages.common.util.TextUtil;
import com.starforge.compat.StageI18n;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * ProgressiveStages composes every displayed stage string (unlock broadcasts,
 * lock messages with {stage} substituted, detail descriptions, toast/title)
 * through {@link TextUtil#parseColorCodes}, which yields a literal component.
 * When the raw text embeds a registered bilingual literal we rebuild it as a
 * composite component whose stage text is translatable, so server-sent
 * messages also render in each client's own locale.
 */
@Mixin(TextUtil.class)
public abstract class ProgressiveStagesTextUtilMixin {

    @Inject(method = "parseColorCodes", at = @At("HEAD"), cancellable = true)
    private static void starforge$translateInline(String raw, CallbackInfoReturnable<Component> cir) {
        if (StageI18n.containsPair(raw)) {
            cir.setReturnValue(StageI18n.translateInline(raw, TextUtil::parseColorCodes));
        }
    }
}
