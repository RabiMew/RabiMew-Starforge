package com.starforge.compat.net;

import java.util.List;

import net.minecraft.core.BlockPos;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.ComponentSerialization;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;

/** Server→client snapshot for a Starforge computer program: the rendered
 *  lines (translatable, already carrying their args) plus whether the program
 *  offers its control action. */
public record MonitorSnapshotPayload(BlockPos computer, ResourceLocation program,
        List<Component> lines, boolean hasControl) implements CustomPacketPayload {

    public static final Type<MonitorSnapshotPayload> TYPE =
        new Type<>(ResourceLocation.fromNamespaceAndPath("starforge_compat", "monitor_snapshot"));

    public static final StreamCodec<RegistryFriendlyByteBuf, MonitorSnapshotPayload> CODEC =
        StreamCodec.composite(
            BlockPos.STREAM_CODEC, MonitorSnapshotPayload::computer,
            ResourceLocation.STREAM_CODEC, MonitorSnapshotPayload::program,
            ComponentSerialization.STREAM_CODEC.apply(ByteBufCodecs.list(16)),
                MonitorSnapshotPayload::lines,
            ByteBufCodecs.BOOL, MonitorSnapshotPayload::hasControl,
            MonitorSnapshotPayload::new);

    @Override
    public Type<? extends CustomPacketPayload> type() {
        return TYPE;
    }
}
