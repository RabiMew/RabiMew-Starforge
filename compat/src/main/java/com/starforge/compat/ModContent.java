package com.starforge.compat;

import net.minecraft.core.registries.Registries;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.material.MapColor;
import net.neoforged.neoforge.registries.DeferredBlock;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredItem;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModContent {
    private ModContent() {}

    public static final DeferredRegister.Blocks BLOCKS =
        DeferredRegister.createBlocks(StarforgeCompat.MODID);
    public static final DeferredRegister.Items ITEMS =
        DeferredRegister.createItems(StarforgeCompat.MODID);
    public static final DeferredRegister<BlockEntityType<?>> BLOCK_ENTITIES =
        DeferredRegister.create(Registries.BLOCK_ENTITY_TYPE, StarforgeCompat.MODID);

    public static final DeferredBlock<ElectricBurnerBlock> ELECTRIC_BURNER =
        BLOCKS.register("electric_burner", () -> new ElectricBurnerBlock(
            BlockBehaviour.Properties.of()
                .mapColor(MapColor.METAL)
                .strength(3.5f)
                .sound(SoundType.METAL)
                .lightLevel(ModContent::litLight)));

    public static final DeferredBlock<HordeAlarmBlock> HORDE_ALARM =
        BLOCKS.register("horde_alarm", () -> new HordeAlarmBlock(
            BlockBehaviour.Properties.of()
                .mapColor(MapColor.COLOR_RED)
                .strength(0.3f)
                .sound(SoundType.GLASS)
                .lightLevel(ModContent::activeLight)));

    public static final DeferredItem<?> ELECTRIC_BURNER_ITEM =
        ITEMS.registerSimpleBlockItem(ELECTRIC_BURNER);
    public static final DeferredItem<?> HORDE_ALARM_ITEM =
        ITEMS.registerSimpleBlockItem(HORDE_ALARM);

    public static final DeferredHolder<BlockEntityType<?>, BlockEntityType<ElectricBurnerBlockEntity>> ELECTRIC_BURNER_BE =
        BLOCK_ENTITIES.register("electric_burner", () -> BlockEntityType.Builder
            .of(ElectricBurnerBlockEntity::new, ELECTRIC_BURNER.get())
            .build(null));

    public static final DeferredHolder<BlockEntityType<?>, BlockEntityType<HordeAlarmBlockEntity>> HORDE_ALARM_BE =
        BLOCK_ENTITIES.register("horde_alarm", () -> BlockEntityType.Builder
            .of(HordeAlarmBlockEntity::new, HORDE_ALARM.get())
            .build(null));

    static int litLight(BlockState state) {
        return state.getValue(BlockStateProperties.LIT) ? 13 : 0;
    }

    static int activeLight(BlockState state) {
        return state.getValue(HordeAlarmBlock.ACTIVE) ? 15 : 0;
    }
}
