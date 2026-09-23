package com.starforge.compat.mixin;

import com.starforge.compat.StageI18n;
import net.minecraft.network.chat.contents.TranslatableContents;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Mutable;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Stage names also reach players embedded as plain-String args inside
 * translatable components (e.g. {@code progressivestages.stage_required} with
 * the display name as %s). Rewriting those args into nested translatable
 * components lets the client's locale resolve the stage name inside the
 * surrounding message.
 */
@Mixin(TranslatableContents.class)
public abstract class TranslatableContentsMixin {

    @Shadow @Final @Mutable
    private Object[] args;

    @Inject(method = "<init>", at = @At("RETURN"))
    private void starforge$localizeStringArgs(String key, String fallback, Object[] args, CallbackInfo ci) {
        for (int i = 0; i < this.args.length; i++) {
            this.args[i] = StageI18n.localizeArg(this.args[i]);
        }
    }
}
