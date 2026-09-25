package com.starforge.compat;

import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModList;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.event.lifecycle.FMLClientSetupEvent;

import com.starforge.compat.computer.client.ClientPrograms;

/**
 * Client-only entrypoint: binds the DisplayableProgram factories onto
 * Refurbished's Display registry. Kept in a separate @Mod class so the
 * dedicated server never links the client-only graphics classes.
 */
@Mod(value = StarforgeCompat.MODID, dist = Dist.CLIENT)
public class StarforgeCompatClient {
    public StarforgeCompatClient(IEventBus modBus) {
        if (ModList.get().isLoaded("refurbished_furniture")) {
            ClientPrograms.register();
        }
        if (ModList.get().isLoaded("euphoria_patcher")) {
            // Runs after all mod constructors (Euphoria's generated pack exists
            // by then) and long before Iris builds its first pipeline.
            modBus.addListener((FMLClientSetupEvent e) -> AdAstraShaderPatch.apply());
        }
    }
}
