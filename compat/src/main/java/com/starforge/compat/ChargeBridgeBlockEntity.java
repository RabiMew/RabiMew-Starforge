package com.starforge.compat;

import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.neoforged.neoforge.energy.IEnergyStorage;
import mods.railcraft.api.charge.Charge;
import mods.railcraft.api.charge.ChargeStorage;

/**
 * The converter's working side. Holds a modest FE buffer exposed to energy
 * networks and, once per tick, performs a single-direction conversion against
 * the real Railcraft Charge network through {@link Charge#distribution}.
 * <p>
 * Conservation contract: every tick the block moves at most {@link #FE_RATE}
 * energy, in exactly one direction, 1 unit for 1 unit. FE removed from the
 * buffer equals charge accepted by the network battery; charge removed from
 * the grid equals FE added to the buffer. Nothing is created and partial moves
 * take the smaller side, so no rounding can accumulate. Grid losses are 0 and
 * battery efficiency 1.0 (see {@link ChargeBridgeBlock}), so a round trip can
 * only return what it was given.
 */
public class ChargeBridgeBlockEntity extends BlockEntity {
    /** Conversion throughput cap per tick, both directions combined. */
    public static final int FE_RATE = 256;
    /** Internal FE buffer - several seconds of throughput to absorb bursts. */
    public static final int FE_CAPACITY = 4096;
    /** AUTO mode converts only outside this dead zone (no oscillation). */
    private static final int AUTO_HIGH = FE_CAPACITY * 3 / 4;
    private static final int AUTO_LOW = FE_CAPACITY / 4;

    private final BridgeStorage storage = new BridgeStorage();

    /**
     * FE capability face. External networks may push and pull at FE_RATE per
     * tick each way (cumulative, not per call), so a fast pipe cannot turn the
     * block into an unbounded power bus. What actually crosses the Charge
     * boundary is decided in {@link #serverTick} and is capped separately.
     */
    private final class BridgeStorage implements IEnergyStorage {
        int energy;
        private int receivedThisTick;
        private int extractedThisTick;

        void resetTickCounters() {
            receivedThisTick = 0;
            extractedThisTick = 0;
        }

        /** Deposit without counting against the external receive budget. */
        int fillInternal(int amount) {
            int accepted = Math.min(amount, FE_CAPACITY - energy);
            energy += accepted;
            return accepted;
        }

        @Override
        public int receiveEnergy(int maxReceive, boolean simulate) {
            int accepted = Math.min(
                Math.min(maxReceive, FE_RATE - receivedThisTick), FE_CAPACITY - energy);
            if (accepted <= 0) return 0;
            if (!simulate) {
                energy += accepted;
                receivedThisTick += accepted;
                setChanged();
            }
            return accepted;
        }

        @Override
        public int extractEnergy(int maxExtract, boolean simulate) {
            int extracted = Math.min(
                Math.min(maxExtract, FE_RATE - extractedThisTick), energy);
            if (extracted <= 0) return 0;
            if (!simulate) {
                energy -= extracted;
                extractedThisTick += extracted;
                setChanged();
            }
            return extracted;
        }

        @Override public int getEnergyStored() { return energy; }
        @Override public int getMaxEnergyStored() { return FE_CAPACITY; }
        @Override public boolean canExtract() { return true; }
        @Override public boolean canReceive() { return true; }
    }

    public ChargeBridgeBlockEntity(BlockPos pos, BlockState state) {
        super(RailcraftBridge.CHARGE_BRIDGE_BE.get(), pos, state);
    }

    public IEnergyStorage energy() {
        return storage;
    }

    public void serverTick() {
        storage.resetTickCounters();
        if (!(level instanceof ServerLevel serverLevel)) return;
        BlockState state = getBlockState();
        if (state.getValue(ChargeBridgeBlock.POWERED)) return;
        ChargeBridgeMode mode = state.getValue(ChargeBridgeBlock.MODE);
        if (mode == ChargeBridgeMode.OFF) return;

        Charge.Access access = Charge.distribution.network(serverLevel).access(worldPosition);

        // Exactly one conversion direction may run per tick. In AUTO the buffer
        // level picks the direction with hysteresis: above the high mark the FE
        // side is clearly oversupplied (push to Charge), below the low mark the
        // FE side is drained (pull from Charge). Inside the dead zone nothing
        // moves, so the bridge can never push charge it just pulled back out in
        // the same tick.
        boolean toCharge = switch (mode) {
            case FE_TO_CHARGE -> true;
            case CHARGE_TO_FE -> false;
            case AUTO -> storage.energy >= AUTO_HIGH;
            case OFF -> false; // unreachable
        };
        boolean fromCharge = switch (mode) {
            case FE_TO_CHARGE -> false;
            case CHARGE_TO_FE -> true;
            case AUTO -> storage.energy <= AUTO_LOW;
            case OFF -> false; // unreachable
        };

        if (toCharge) {
            // FE -> Charge: inject into this node's RECHARGEABLE network battery.
            // receiveEnergy returns what the battery actually accepted; only
            // that amount leaves the buffer.
            ChargeStorage battery = access.storage().orElse(null);
            if (battery != null && storage.energy > 0) {
                int moved = battery.receiveEnergy(Math.min(FE_RATE, storage.energy), false);
                if (moved > 0) {
                    storage.energy -= moved;
                    setChanged();
                }
            }
        } else if (fromCharge) {
            // Charge -> FE: removeCharge drains the grid's active batteries and
            // reports the amount actually taken; the buffer never overfills, so
            // charge cannot vanish.
            int space = FE_CAPACITY - storage.energy;
            if (space > 0) {
                int moved = access.removeCharge(Math.min(FE_RATE, space), false);
                if (moved > 0) {
                    storage.fillInternal(moved);
                    setChanged();
                }
            }
        }
    }

    @Override
    protected void saveAdditional(CompoundTag tag, HolderLookup.Provider provider) {
        super.saveAdditional(tag, provider);
        tag.putInt("Fe", storage.energy);
    }

    @Override
    protected void loadAdditional(CompoundTag tag, HolderLookup.Provider provider) {
        super.loadAdditional(tag, provider);
        storage.energy = Math.min(tag.getInt("Fe"), FE_CAPACITY);
    }
}
