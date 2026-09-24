package com.starforge.compat;

import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.function.Predicate;

import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.LongArrayTag;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.saveddata.SavedData;

/**
 * Per-dimension registry of vanilla containers a TACZ guard has already proven
 * useful (a search found food/compatible ammo inside). Guards query this before
 * paying for a Manhattan area scan, so a colony's logistics get cheaper the
 * more it is used - the registry only records WHERE supplies were found, it
 * never fabricates contents: every candidate is re-validated live before use.
 *
 * Pools are insertion-ordered and capped; stale entries are pruned lazily the
 * first time a guard re-checks them, so the set size stays proportional to how
 * many distinct supply chests the colony actually maintains.
 */
public class SupplyPointData extends SavedData {
    private static final String NAME = "starforge_compat_supply_points";
    private static final int MAX_POINTS = 512;

    public enum Kind { AMMO, FOOD }

    private final Set<BlockPos> ammo = new LinkedHashSet<>();
    private final Set<BlockPos> food = new LinkedHashSet<>();

    public static SupplyPointData get(ServerLevel level) {
        return level.getDataStorage().computeIfAbsent(factory(), NAME);
    }

    public static SavedData.Factory<SupplyPointData> factory() {
        return new SavedData.Factory<>(SupplyPointData::new, SupplyPointData::load, null);
    }

    public static SupplyPointData load(CompoundTag tag, HolderLookup.Provider provider) {
        SupplyPointData data = new SupplyPointData();
        for (long packed : tag.getLongArray("ammo")) data.ammo.add(BlockPos.of(packed));
        for (long packed : tag.getLongArray("food")) data.food.add(BlockPos.of(packed));
        return data;
    }

    @Override
    public CompoundTag save(CompoundTag tag, HolderLookup.Provider provider) {
        tag.put("ammo", new LongArrayTag(ammo.stream().mapToLong(BlockPos::asLong).toArray()));
        tag.put("food", new LongArrayTag(food.stream().mapToLong(BlockPos::asLong).toArray()));
        return tag;
    }

    private Set<BlockPos> pool(Kind kind) {
        return kind == Kind.AMMO ? ammo : food;
    }

    /** Registered-point count for status readouts (Starforge Control app). */
    public int poolSize(Kind kind) {
        return pool(kind).size();
    }

    public void add(BlockPos pos, Kind kind) {
        Set<BlockPos> pool = pool(kind);
        if (pool.add(pos.immutable())) {
            if (pool.size() > MAX_POINTS) {
                Iterator<BlockPos> it = pool.iterator();
                it.next();
                it.remove();
            }
            setDirty();
        }
    }

    public void remove(BlockPos pos, Kind kind) {
        if (pool(kind).remove(pos)) setDirty();
    }

    /**
     * Nearest registered point within {@code maxDistSqr} that is still real
     * ({@code exists}) and currently usable ({@code usable}). Entries failing
     * {@code exists} are pruned permanently (broken chest, wrong block);
     * entries failing only {@code usable} are kept (temporarily unreachable).
     */
    public BlockPos nearest(BlockPos origin, double maxDistSqr, Kind kind,
                            Predicate<BlockPos> exists, Predicate<BlockPos> usable) {
        Set<BlockPos> pool = pool(kind);
        BlockPos best = null;
        double bestSqr = maxDistSqr;
        boolean pruned = false;
        for (Iterator<BlockPos> it = pool.iterator(); it.hasNext();) {
            BlockPos pos = it.next();
            double d = pos.distSqr(origin);
            if (d > maxDistSqr) continue;
            if (!exists.test(pos)) {
                it.remove();
                pruned = true;
                continue;
            }
            if (d < bestSqr && usable.test(pos)) {
                bestSqr = d;
                best = pos;
            }
        }
        if (pruned) setDirty();
        return best;
    }
}
