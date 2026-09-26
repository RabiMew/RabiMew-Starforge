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

import com.starforge.compat.computer.StarforgePrograms;
import com.starforge.compat.fluid.RefurbishedFluidCaps;
import com.starforge.compat.net.StarforgeNet;

/**
 * Starforge Compatibility — small behavior-level glue that tags/KubeJS cannot express:
 * <ul>
 *   <li>{@code electric_burner}: FE-powered heat source for Farmer's Delight
 *       (works via FD's own HEAT_SOURCES tag + vanilla LIT blockstate).</li>
 *   <li>{@code horde_alarm}: redstone source driven by The Hordes start/end events.</li>
 *   <li>{@code starforge:stage} horde-script condition: ProgressiveStages team
 *       era stages as spawn-table gates (replaces the unbuilt GameStages path).</li>
 *   <li>Refurbished computer programs (Starforge Control, Security) plus a
 *       NeoForge fluid-capability bridge for Refurbished sinks/basins/toilets/baths.</li>
 *   <li>{@code charge_bridge}: bidirectional FE &lt;-&gt; Railcraft Charge
 *       converter using the official Charge node API (present only when
 *       Railcraft is loaded).</li>
 *   <li>hidden easter egg: first real player-kill grants an edible victim head
 *       and a hidden advancement ({@link EdiblePlayerHead}).</li>
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
        modBus.addListener(StarforgeNet::register);
        NeoForge.EVENT_BUS.addListener(EdiblePlayerHead::onPlayerDeath);
        NeoForge.EVENT_BUS.addListener(EdiblePlayerHead::onFinishUsing);
        NeoForge.EVENT_BUS.addListener(EdiblePlayerHead::onTooltip);
        if (ModList.get().isLoaded("hordes")) {
            NeoForge.EVENT_BUS.addListener(HordeHooks::onHordeStart);
            NeoForge.EVENT_BUS.addListener(HordeHooks::onHordeEnd);
            if (ModList.get().isLoaded("progressivestages")) {
                HordeStageCondition.register();
            }
        }
        if (ModList.get().isLoaded("refurbished_furniture")) {
            StarforgePrograms.register();
        }
        RailcraftBridge.register();
    }

    private void registerCapabilities(RegisterCapabilitiesEvent event) {
        event.registerBlockEntity(
            Capabilities.EnergyStorage.BLOCK,
            ModContent.ELECTRIC_BURNER_BE.get(),
            (be, side) -> be.energy());
        if (RailcraftBridge.CHARGE_BRIDGE_BE != null) {
            event.registerBlockEntity(
                Capabilities.EnergyStorage.BLOCK,
                RailcraftBridge.CHARGE_BRIDGE_BE.get(),
                (be, side) -> be.energy());
        }
        if (ModList.get().isLoaded("refurbished_furniture")) {
            RefurbishedFluidCaps.register(event);
        }
    }

    private void addCreativeTabs(BuildCreativeModeTabContentsEvent event) {
        if (event.getTabKey() == CreativeModeTabs.REDSTONE_BLOCKS) {
            event.accept(ModContent.HORDE_ALARM_ITEM);
        }
        if (event.getTabKey() == CreativeModeTabs.FUNCTIONAL_BLOCKS) {
            event.accept(ModContent.ELECTRIC_BURNER_ITEM);
            if (RailcraftBridge.CHARGE_BRIDGE_ITEM != null) {
                event.accept(RailcraftBridge.CHARGE_BRIDGE_ITEM);
            }
        }
    }
}
