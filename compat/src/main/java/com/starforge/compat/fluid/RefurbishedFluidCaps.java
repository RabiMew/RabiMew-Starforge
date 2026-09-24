package com.starforge.compat.fluid;

import com.mrcrayfish.furniture.refurbished.core.ModBlockEntities;

import net.neoforged.neoforge.capabilities.Capabilities;
import net.neoforged.neoforge.capabilities.RegisterCapabilitiesEvent;

/**
 * Exposes Refurbished's built-in fluid containers (kitchen sink, basin,
 * toilet, bath) as NeoForge {@code IFluidHandler} block capabilities so pipes,
 * pumps and the Supplementaries faucet see them as real tanks. Loaded only
 * when refurbished_furniture is present.
 */
public final class RefurbishedFluidCaps {
    private RefurbishedFluidCaps() {}

    public static void register(RegisterCapabilitiesEvent event) {
        event.registerBlockEntity(Capabilities.FluidHandler.BLOCK,
            ModBlockEntities.KITCHEN_SINK.get(),
            (be, side) -> new RefurbishedFluidHandler(be.getFluidContainer()));
        event.registerBlockEntity(Capabilities.FluidHandler.BLOCK,
            ModBlockEntities.BASIN.get(),
            (be, side) -> new RefurbishedFluidHandler(be.getFluidContainer()));
        event.registerBlockEntity(Capabilities.FluidHandler.BLOCK,
            ModBlockEntities.TOILET.get(),
            (be, side) -> new RefurbishedFluidHandler(be.getFluidContainer()));
        event.registerBlockEntity(Capabilities.FluidHandler.BLOCK,
            ModBlockEntities.BATH.get(),
            (be, side) -> new RefurbishedFluidHandler(be.getFluidContainer()));
    }
}
