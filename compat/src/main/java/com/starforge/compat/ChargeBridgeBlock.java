package com.starforge.compat;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.util.RandomSource;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.EntityBlock;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityTicker;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import net.minecraft.world.level.block.state.properties.DirectionProperty;
import net.minecraft.world.level.block.state.properties.EnumProperty;
import net.minecraft.world.phys.BlockHitResult;
import mods.railcraft.api.charge.Charge;
import mods.railcraft.api.charge.ChargeBlock;
import mods.railcraft.api.charge.ChargeStorage;

import java.util.List;
import java.util.Map;

/**
 * FE &lt;-&gt; Railcraft Charge converter. This block joins the real Charge
 * network through the official {@link ChargeBlock} node API - the Charge side
 * is a {@code RECHARGEABLE} network battery created and persisted by Railcraft
 * itself ({@link ChargeStorage.Spec}), never a simulated store. The FE side is a
 * plain NeoForge {@code IEnergyStorage} capability served by
 * {@link ChargeBridgeBlockEntity}.
 * <p>
 * {@link #MODE} picks the allowed direction, {@link #POWERED} force-disables the
 * bridge while a redstone signal is applied. All conversion is strictly 1:1
 * (node losses 0, battery efficiency 1.0) and limited to one direction per tick,
 * so round-tripping can at most return the same energy - never more.
 */
public class ChargeBridgeBlock extends Block implements EntityBlock, ChargeBlock {
    public static final DirectionProperty FACING = BlockStateProperties.HORIZONTAL_FACING;
    public static final EnumProperty<ChargeBridgeMode> MODE = EnumProperty.create("mode", ChargeBridgeMode.class);
    public static final BooleanProperty POWERED = BlockStateProperties.POWERED;

    /** Charge node battery carried by this block's network node. */
    static final int CHARGE_CAPACITY = 4096;
    /** Per-tick draw budget this node advertises to the Charge network. */
    static final int CHARGE_MAX_DRAW = ChargeBridgeBlockEntity.FE_RATE;

    private static final Map<Charge, ChargeBlock.Spec> CHARGE_SPEC = Map.of(
        Charge.distribution,
        new ChargeBlock.Spec(ChargeBlock.ConnectType.BLOCK, 0f,
            new ChargeStorage.Spec(ChargeStorage.State.RECHARGEABLE,
                CHARGE_CAPACITY, CHARGE_MAX_DRAW, 1.0f)));

    public ChargeBridgeBlock(Properties props) {
        super(props);
        registerDefaultState(stateDefinition.any()
            .setValue(FACING, Direction.NORTH)
            .setValue(MODE, ChargeBridgeMode.AUTO)
            .setValue(POWERED, false));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(FACING, MODE, POWERED);
    }

    @Override
    public BlockState getStateForPlacement(BlockPlaceContext context) {
        return defaultBlockState().setValue(FACING, context.getHorizontalDirection().getOpposite());
    }

    // ---- Railcraft ChargeBlock contract ------------------------------------

    @Override
    public Map<Charge, ChargeBlock.Spec> getChargeSpecs(BlockState state, ServerLevel level, BlockPos pos) {
        return CHARGE_SPEC;
    }

    @Override
    public void onPlace(BlockState state, Level level, BlockPos pos, BlockState oldState, boolean moved) {
        super.onPlace(state, level, pos, oldState, moved);
        if (!level.isClientSide && !oldState.is(this)) {
            // neighborChanged never fires for the placed block itself, so a
            // bridge placed next to an already-powered source would run
            // unsuppressed until the next update. Sync POWERED like pistons do.
            if (level.hasNeighborSignal(pos) != state.getValue(POWERED)) {
                state = state.setValue(POWERED, level.hasNeighborSignal(pos));
                level.setBlock(pos, state, 2);
            }
            registerNode(state, (ServerLevel) level, pos);
        }
    }

    @Override
    public void onRemove(BlockState state, Level level, BlockPos pos, BlockState newState, boolean moved) {
        super.onRemove(state, level, pos, newState, moved);
        if (!level.isClientSide && !newState.is(this)) {
            deregisterNode((ServerLevel) level, pos);
        }
    }

    @Override
    public void tick(BlockState state, ServerLevel level, BlockPos pos, RandomSource random) {
        super.tick(state, level, pos, random);
        registerNode(state, level, pos);
    }

    // ---- FE side + mode switching ------------------------------------------

    @Override
    public void neighborChanged(BlockState state, Level level, BlockPos pos, Block block, BlockPos fromPos, boolean moving) {
        if (level.isClientSide) return;
        boolean powered = level.hasNeighborSignal(pos);
        if (powered != state.getValue(POWERED)) {
            level.setBlock(pos, state.setValue(POWERED, powered), 3);
        }
    }

    @Override
    protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hit) {
        if (!player.isShiftKeyDown()) return InteractionResult.PASS;
        if (!level.isClientSide) {
            ChargeBridgeMode next = state.getValue(MODE).next();
            level.setBlock(pos, state.setValue(MODE, next), 3);
            player.displayClientMessage(Component.translatable(
                "message.starforge_compat.charge_bridge.mode",
                Component.translatable("block.starforge_compat.charge_bridge.mode." + next.getSerializedName())), true);
        }
        return InteractionResult.sidedSuccess(level.isClientSide);
    }

    @Override
    public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
        return new ChargeBridgeBlockEntity(pos, state);
    }

    @Override
    public <T extends BlockEntity> BlockEntityTicker<T> getTicker(Level level, BlockState state, BlockEntityType<T> type) {
        return level.isClientSide ? null
            : (lvl, pos, st, be) -> {
                if (be instanceof ChargeBridgeBlockEntity bridge) {
                    bridge.serverTick();
                }
            };
    }

    // ---- instrumentation ----------------------------------------------------

    @Override
    public boolean hasAnalogOutputSignal(BlockState state) {
        return true;
    }

    @Override
    public int getAnalogOutputSignal(BlockState state, Level level, BlockPos pos) {
        return level instanceof ServerLevel serverLevel
            ? Charge.distribution.network(serverLevel).access(pos).getComparatorOutput()
            : 0;
    }

    @Override
    public void appendHoverText(ItemStack stack, Item.TooltipContext context, List<Component> tooltip, TooltipFlag flag) {
        tooltip.add(Component.translatable("tooltip.starforge_compat.charge_bridge.0",
            ChargeBridgeBlockEntity.FE_RATE));
        tooltip.add(Component.translatable("tooltip.starforge_compat.charge_bridge.1"));
    }
}
