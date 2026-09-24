package com.starforge.compat.computer;

import com.mrcrayfish.furniture.refurbished.computer.Computer;

import net.minecraft.resources.ResourceLocation;

/**
 * Installs Starforge's two console programs on the Refurbished computer via its
 * own Computer.get().installProgram API. The four stock apps (Paddle Ball,
 * Home Control, Marketplace, Coin Miner) are untouched - these are appended.
 * Install order fixes the program_icons.png atlas index: starforge_control = 0,
 * security = 1.
 */
public final class StarforgePrograms {
    public static final ResourceLocation STARFORGE_CONTROL =
        ResourceLocation.fromNamespaceAndPath("starforge_compat", "starforge_control");
    public static final ResourceLocation SECURITY =
        ResourceLocation.fromNamespaceAndPath("starforge_compat", "security");

    private StarforgePrograms() {}

    public static void register() {
        Computer.get().installProgram(STARFORGE_CONTROL, StarforgeControlProgram::new);
        Computer.get().installProgram(SECURITY, SecurityProgram::new);
    }
}
