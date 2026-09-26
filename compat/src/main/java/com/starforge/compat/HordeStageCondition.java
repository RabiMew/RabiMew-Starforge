package com.starforge.compat;

import com.google.gson.JsonElement;

import com.enviouse.progressivestages.common.api.ProgressiveStagesAPI;
import com.enviouse.progressivestages.common.api.StageId;

import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.smileycorp.atlas.api.data.DataType;
import net.smileycorp.hordes.common.HordesLogger;
import net.smileycorp.hordes.common.data.DataRegistry;
import net.smileycorp.hordes.common.data.conditions.Condition;
import net.smileycorp.hordes.common.data.values.ValueGetter;
import net.smileycorp.hordes.common.event.HordePlayerEvent;
import net.smileycorp.hordes.hordeevent.data.HordeContext;

/**
 * {@code starforge:stage} horde-script condition backed by ProgressiveStages.
 *
 * The Hordes ships a {@code gamestages:gamestage} condition that queries the
 * darkhax GameStages API — this pack runs ProgressiveStages instead (team-scope
 * era stages modpack:survival_age → modpack:quantum_age), so the upstream
 * condition is never registered here. This mirrors it: the JSON value may be a
 * literal stage id or any hordes ValueGetter-producing object, and apply()
 * resolves the team-scope stage against the horde target player.
 *
 * Registered via DataRegistry's public deserializer hook at mod construction —
 * no mixin needed. Loaded only when both hordes and progressivestages are
 * present (guarded in the mod constructor), so the hard class references are
 * safe.
 */
public final class HordeStageCondition implements Condition {

    private final ValueGetter<String> stage;

    private HordeStageCondition(ValueGetter<String> stage) {
        this.stage = stage;
    }

    @Override
    public boolean apply(HordeContext<? extends HordePlayerEvent> ctx) {
        ServerPlayer player = ctx.getPlayer();
        if (player == null) return false;
        String id = stage.get(ctx);
        if (id == null || id.isEmpty()) return false;
        try {
            return ProgressiveStagesAPI.hasStage(player, StageId.parse(id));
        } catch (Exception e) {
            return false;
        }
    }

    public static HordeStageCondition deserialize(JsonElement json) {
        try {
            return new HordeStageCondition(ValueGetter.readValue(DataType.STRING, json));
        } catch (Exception e) {
            HordesLogger.logError("Incorrect parameters for condition starforge:stage", e);
            return null;
        }
    }

    public static void register() {
        DataRegistry.registerConditionDeserializer(
            ResourceLocation.fromNamespaceAndPath("starforge", "stage"),
            HordeStageCondition::deserialize);
    }
}
