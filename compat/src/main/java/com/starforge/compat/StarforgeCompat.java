package com.starforge.compat;

import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.ModList;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.capabilities.Capabilities;
import net.neoforged.neoforge.capabilities.RegisterCapabilitiesEvent;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.BuildCreativeModeTabContentsEvent;
import net.minecraft.world.item.CreativeModeTabs;

/**
 * Starforge Compatibility — small behavior-level glue that tags/KubeJS cannot express:
 * <ul>
 *   <li>{@code electric_burner}: FE-powered heat source for Farmer's Delight
 *       (works via FD's own HEAT_SOURCES tag + vanilla LIT blockstate).</li>
 *   <li>{@code horde_alarm}: redstone source driven by The Hordes start/end events.</li>
 * </ul>
 */
@Mod(StarforgeCompat.MODID)
public class StarforgeCompat {
    public static final String MODID = "starforge_compat";

    public StarforgeCompat(IEventBus modBus, ModContainer container) {
        ModContent.BLOCKS.register(modBus);
        ModContent.ITEMS.register(modBus);
        ModContent.BLOCK_ENTITIES.register(modBus);
        modBus.addListener(this::registerCapabilities);
        modBus.addListener(this::addCreativeTabs);
        if (ModList.get().isLoaded("hordes")) {
            NeoForge.EVENT_BUS.addListener(HordeHooks::onHordeStart);
            NeoForge.EVENT_BUS.addListener(HordeHooks::onHordeEnd);
        }
    }

    private void registerCapabilities(RegisterCapabilitiesEvent event) {
        event.registerBlockEntity(
            Capabilities.EnergyStorage.BLOCK,
            ModContent.ELECTRIC_BURNER_BE.get(),
            (be, side) -> be.energy());
    }

    private void addCreativeTabs(BuildCreativeModeTabContentsEvent event) {
        if (event.getTabKey() == CreativeModeTabs.REDSTONE_BLOCKS) {
            event.accept(ModContent.HORDE_ALARM_ITEM);
        }
        if (event.getTabKey() == CreativeModeTabs.FUNCTIONAL_BLOCKS) {
            event.accept(ModContent.ELECTRIC_BURNER_ITEM);
        }
    }
}
