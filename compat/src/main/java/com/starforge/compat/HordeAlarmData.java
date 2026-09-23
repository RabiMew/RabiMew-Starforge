package com.starforge.compat;

import java.util.HashSet;
import java.util.Set;

import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.LongArrayTag;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.saveddata.SavedData;

/**
 * Per-dimension record of registered alarm positions plus the current horde
 * flag. Bounded by the number of placed alarms - never a world scan.
 */
public class HordeAlarmData extends SavedData {
    private static final String NAME = "starforge_compat_horde_alarms";

    private final Set<BlockPos> alarms = new HashSet<>();
    private boolean active;

    public static HordeAlarmData get(ServerLevel level) {
        return level.getDataStorage().computeIfAbsent(factory(), NAME);
    }

    public static SavedData.Factory<HordeAlarmData> factory() {
        return new SavedData.Factory<>(HordeAlarmData::new, HordeAlarmData::load, null);
    }

    public static HordeAlarmData load(CompoundTag tag, HolderLookup.Provider provider) {
        HordeAlarmData data = new HordeAlarmData();
        data.active = tag.getBoolean("active");
        for (long packed : tag.getLongArray("alarms")) {
            data.alarms.add(BlockPos.of(packed));
        }
        return data;
    }

    @Override
    public CompoundTag save(CompoundTag tag, HolderLookup.Provider provider) {
        tag.putBoolean("active", active);
        tag.put("alarms", new LongArrayTag(
            alarms.stream().mapToLong(BlockPos::asLong).toArray()));
        return tag;
    }

    public boolean active() {
        return active;
    }

    public void setActive(boolean value) {
        if (active != value) {
            active = value;
            setDirty();
        }
    }

    public Set<BlockPos> alarms() {
        return alarms;
    }

    public void addAlarm(BlockPos pos) {
        if (alarms.add(pos.immutable())) {
            setDirty();
        }
    }

    public void removeAlarm(BlockPos pos) {
        if (alarms.remove(pos)) {
            setDirty();
        }
    }
}
