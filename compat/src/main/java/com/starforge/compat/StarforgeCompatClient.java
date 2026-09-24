package com.starforge.compat;

import net.neoforged.api.distmarker.Dist;
import net.neoforged.fml.ModList;
import net.neoforged.fml.common.Mod;

import com.starforge.compat.computer.client.ClientPrograms;

/**
 * Client-only entrypoint: binds the DisplayableProgram factories onto
 * Refurbished's Display registry. Kept in a separate @Mod class so the
 * dedicated server never links the client-only graphics classes.
 */
@Mod(value = StarforgeCompat.MODID, dist = Dist.CLIENT)
public class StarforgeCompatClient {
    public StarforgeCompatClient() {
        if (ModList.get().isLoaded("refurbished_furniture")) {
            ClientPrograms.register();
        }
    }
}
