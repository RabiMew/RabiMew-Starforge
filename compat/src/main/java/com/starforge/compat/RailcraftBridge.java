package com.starforge.compat;

import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.material.MapColor;
import net.neoforged.fml.ModList;
import net.neoforged.neoforge.registries.DeferredBlock;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredItem;

/**
 * Registration holder for the Railcraft Charge &lt;-&gt; FE bridge. Everything
 * that touches {@code mods.railcraft.api.charge} lives behind this class so the
 * compat jar still loads on a pack without Railcraft: the register call is
 * skipped and no bridge class is ever resolved. {@link StarforgeCompat}
 * null-checks the holders before wiring capabilities or creative tabs.
 */
public final class RailcraftBridge {
    private RailcraftBridge() {}

    public static final boolean LOADED = ModList.get().isLoaded("railcraft");

    public static DeferredBlock<ChargeBridgeBlock> CHARGE_BRIDGE;
    public static DeferredItem<?> CHARGE_BRIDGE_ITEM;
    public static DeferredHolder<BlockEntityType<?>, BlockEntityType<ChargeBridgeBlockEntity>> CHARGE_BRIDGE_BE;

    public static void register() {
        if (!LOADED) return;
        CHARGE_BRIDGE = ModContent.BLOCKS.register("charge_bridge", () -> new ChargeBridgeBlock(
            BlockBehaviour.Properties.of()
                .mapColor(MapColor.METAL)
                .strength(3.5f)
                .sound(SoundType.METAL)
                .lightLevel(RailcraftBridge::bridgeLight)));
        CHARGE_BRIDGE_ITEM = ModContent.ITEMS.registerSimpleBlockItem(CHARGE_BRIDGE);
        CHARGE_BRIDGE_BE = ModContent.BLOCK_ENTITIES.register("charge_bridge", () -> BlockEntityType.Builder
            .of(ChargeBridgeBlockEntity::new, CHARGE_BRIDGE.get())
            .build(null));
    }

    static int bridgeLight(BlockState state) {
        return state.getValue(BlockStateProperties.POWERED) || !state.getValue(ChargeBridgeBlock.MODE).equals(ChargeBridgeMode.OFF) ? 3 : 0;
    }
}
