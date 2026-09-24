package com.starforge.compat.fluid;

import com.mrcrayfish.furniture.refurbished.blockentity.fluid.FluidContainer;

import it.unimi.dsi.fastutil.Pair;
import net.minecraft.world.level.material.Fluid;
import net.minecraft.world.level.material.Fluids;
import net.neoforged.neoforge.fluids.FluidStack;
import net.neoforged.neoforge.fluids.capability.IFluidHandler;

/**
 * Bridges a Refurbished {@link FluidContainer} to the NeoForge
 * {@link IFluidHandler} capability so sinks/basins/toilets/baths work with
 * pipes, pumps and the Supplementaries faucet. Refurbished stores amounts as
 * long mB (bucket = 1000), matching the NeoForge convention, so values are
 * passed through with a clamp to int.
 */
public class RefurbishedFluidHandler implements IFluidHandler {

    private final FluidContainer container;

    public RefurbishedFluidHandler(FluidContainer container) {
        this.container = container;
    }

    private FluidStack stored() {
        Fluid fluid = container.getStoredFluid();
        if (fluid == null || fluid == Fluids.EMPTY || container.getStoredAmount() <= 0)
            return FluidStack.EMPTY;
        return new FluidStack(fluid.builtInRegistryHolder(), (int) container.getStoredAmount());
    }

    @Override
    public int getTanks() {
        return 1;
    }

    @Override
    public FluidStack getFluidInTank(int tank) {
        return tank == 0 ? stored() : FluidStack.EMPTY;
    }

    @Override
    public int getTankCapacity(int tank) {
        return tank == 0 ? (int) Math.min(Integer.MAX_VALUE, container.getCapacity()) : 0;
    }

    @Override
    public boolean isFluidValid(int tank, FluidStack stack) {
        return tank == 0 && !stack.isEmpty();
    }

    @Override
    public int fill(FluidStack resource, FluidAction action) {
        if (resource.isEmpty()) return 0;
        return (int) container.push(resource.getFluid(), resource.getAmount(), action.simulate());
    }

    @Override
    public FluidStack drain(FluidStack resource, FluidAction action) {
        if (resource.isEmpty()) return FluidStack.EMPTY;
        return drain(resource.getFluid(), resource.getAmount(), action);
    }

    @Override
    public FluidStack drain(int maxDrain, FluidAction action) {
        return drain(null, maxDrain, action);
    }

    private FluidStack drain(Fluid fluid, int maxDrain, FluidAction action) {
        Fluid storedFluid = container.getStoredFluid();
        if (storedFluid == null || storedFluid == Fluids.EMPTY) return FluidStack.EMPTY;
        if (fluid != null && fluid != storedFluid) return FluidStack.EMPTY;
        Pair<Fluid, Long> pulled = container.pull(maxDrain, action.simulate());
        if (pulled == null || pulled.first() == null || pulled.second() <= 0)
            return FluidStack.EMPTY;
        return new FluidStack(pulled.first().builtInRegistryHolder(),
            (int) Math.min(Integer.MAX_VALUE, pulled.second()));
    }
}
