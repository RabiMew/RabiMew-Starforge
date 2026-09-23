package com.starforge.compat;

import java.util.Map;

import net.minecraft.resources.ResourceLocation;

/**
 * Static fallback table for TaczBlockIdMixin. Interface mixins may not carry
 * fields, so the shell-item -> gunpack index-id mapping lives here instead.
 */
public final class TaczWorkbenchFallback {

    public static final Map<ResourceLocation, ResourceLocation> FALLBACK_IDS = Map.of(
            ResourceLocation.parse("tacz:workbench_a"), ResourceLocation.parse("tacz:ammo_workbench"),
            ResourceLocation.parse("tacz:workbench_c"), ResourceLocation.parse("tacz:attachment_workbench")
    );

    private TaczWorkbenchFallback() {}
}
