package com.starforge.compat;

import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.neoforged.neoforge.energy.EnergyStorage;
import net.neoforged.neoforge.energy.IEnergyStorage;

/**
 * Receive-only FE buffer for the burner. Drains {@link #FE_PER_TICK} while lit;
 * Farmer's Delight's own heat check reads the LIT blockstate, so cutting power
 * cuts heat. No free energy is created.
 */
public class ElectricBurnerBlockEntity extends BlockEntity {
    public static final int CAPACITY = 8000;
    public static final int MAX_RECEIVE = 800;
    public static final int FE_PER_TICK = 40;

    private final BurnerStorage storage = new BurnerStorage();

    private final class BurnerStorage extends EnergyStorage {
        BurnerStorage() {
            super(CAPACITY, MAX_RECEIVE, 0);
        }

        boolean canBurn() {
            return energy >= FE_PER_TICK;
        }

        void drain() {
            energy -= FE_PER_TICK;
        }

        @Override
        public int receiveEnergy(int maxReceive, boolean simulate) {
            int received = super.receiveEnergy(maxReceive, simulate);
            if (received > 0 && !simulate) {
                setChanged();
            }
            return received;
        }
    }

    public ElectricBurnerBlockEntity(BlockPos pos, BlockState state) {
        super(ModContent.ELECTRIC_BURNER_BE.get(), pos, state);
    }

    public IEnergyStorage energy() {
        return storage;
    }

    public void serverTick() {
        BlockState state = getBlockState();
        boolean powered = storage.canBurn();
        if (powered) {
            storage.drain();
            setChanged();
        }
        if (state.getValue(ElectricBurnerBlock.LIT) != powered) {
            level.setBlock(worldPosition,
                state.setValue(ElectricBurnerBlock.LIT, powered), 3);
            setChanged();
        }
    }

    @Override
    protected void saveAdditional(CompoundTag tag, HolderLookup.Provider provider) {
        super.saveAdditional(tag, provider);
        tag.put("Energy", storage.serializeNBT(provider));
    }

    @Override
    protected void loadAdditional(CompoundTag tag, HolderLookup.Provider provider) {
        super.loadAdditional(tag, provider);
        storage.deserializeNBT(provider, tag.get("Energy"));
    }
}
