package com.starforge.compat.net;

import net.minecraft.core.BlockPos;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;

/** Client→server control request from a Starforge computer program. The
 *  action string is validated server-side against the program the player
 *  actually has open; nothing here is trusted. */
public record MonitorActionPayload(BlockPos computer, String action) implements CustomPacketPayload {

    public static final Type<MonitorActionPayload> TYPE =
        new Type<>(ResourceLocation.fromNamespaceAndPath("starforge_compat", "monitor_action"));

    public static final StreamCodec<FriendlyByteBuf, MonitorActionPayload> CODEC =
        StreamCodec.composite(
            BlockPos.STREAM_CODEC, MonitorActionPayload::computer,
            ByteBufCodecs.STRING_UTF8, MonitorActionPayload::action,
            MonitorActionPayload::new);

    @Override
    public Type<? extends CustomPacketPayload> type() {
        return TYPE;
    }
}
