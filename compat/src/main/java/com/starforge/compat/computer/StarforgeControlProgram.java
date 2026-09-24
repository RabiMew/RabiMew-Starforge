package com.starforge.compat.computer;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import com.mrcrayfish.furniture.refurbished.blockentity.ElectricityGeneratorBlockEntity;
import com.mrcrayfish.furniture.refurbished.blockentity.IComputer;
import com.mrcrayfish.furniture.refurbished.electricity.IElectricityNode;
import com.starforge.compat.HordeAlarmData;
import com.starforge.compat.SupplyPointData;

import earth.terrarium.adastra.api.systems.OxygenApi;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.neoforged.fml.ModList;

/**
 * Starforge Control — industrial base overview on the Refurbished computer.
 * Every figure comes from a real API: the Refurbished electricity network the
 * computer is wired into, Energized Furniture's FE storage, ProgressiveStages,
 * Ad Astra's oxygen system and this pack's own supply-point registry. Home
 * Control keeps the smart-home job; this panel never controls devices.
 */
public class StarforgeControlProgram extends MonitorProgram {

    private static final String L10N = "computer_program.starforge_compat.starforge_control.";
    private static final boolean AD_ASTRA = ModList.get().isLoaded("ad_astra");
    private static final boolean ENERGIZED = ModList.get().isLoaded("energizedfurniture");
    private static final boolean STAGES = ModList.get().isLoaded("progressivestages");

    public StarforgeControlProgram(ResourceLocation id, IComputer computer) {
        super(id, computer);
    }

    @Override
    protected List<Component> collect(ServerPlayer player, ServerLevel level, BlockPos pos) {
        List<Component> lines = new ArrayList<>();
        collectPower(level, pos, lines);
        collectStage(player, lines);
        collectOxygen(level, pos, lines);
        collectSupplies(level, lines);
        lines.add(Component.translatable(L10N + "horde",
            Component.translatable(HordeAlarmData.get(level).active()
                ? L10N + "horde.active" : L10N + "horde.calm")));
        return lines;
    }

    private void collectPower(ServerLevel level, BlockPos pos, List<Component> lines) {
        BlockEntity self = level.getBlockEntity(pos);
        if (!(self instanceof IElectricityNode node)) {
            lines.add(Component.translatable(L10N + "power.unavailable"));
            return;
        }
        List<IElectricityNode> network = IElectricityNode.searchNodes(node);
        int powered = 0;
        for (IElectricityNode n : network) {
            if (n.isNodePowered()) powered++;
        }
        long fe = 0, feCap = 0;
        int sources = 0, transformers = 0;
        for (BlockPos srcPos : node.getPowerSources()) {
            BlockEntity src = level.getBlockEntity(srcPos);
            if (!(src instanceof ElectricityGeneratorBlockEntity)) continue;
            sources++;
            if (ENERGIZED && src instanceof dev.setupteam.energizedfurniture.blockentity
                    .EnergyTransformerBlockEntity transformer) {
                transformers++;
                fe += transformer.getStorage().getEnergyStored();
                feCap += transformer.getStorage().getMaxEnergyStored();
            }
        }
        lines.add(Component.translatable(L10N + "power.nodes", network.size(), powered, sources));
        if (ENERGIZED) {
            lines.add(transformers > 0
                ? Component.translatable(L10N + "power.fe", fe, feCap, transformers)
                : Component.translatable(L10N + "power.fe.none"));
        } else {
            lines.add(Component.translatable(L10N + "power.fe.unavailable"));
        }
    }

    private void collectStage(ServerPlayer player, List<Component> lines) {
        if (!STAGES) {
            lines.add(Component.translatable(L10N + "stage.unavailable"));
            return;
        }
        Set<com.enviouse.progressivestages.common.api.StageId> stages =
            com.enviouse.progressivestages.common.api.ProgressiveStagesAPI.getStages(player);
        Set<String> eras = new TreeSet<>();
        for (var stage : stages) {
            if ("modpack".equals(stage.getNamespace()) && stage.getPath().endsWith("_age")) {
                eras.add(stage.getPath());
            }
        }
        lines.add(Component.translatable(L10N + "stage",
            stages.size(), Component.literal(String.join(", ", eras))));
    }

    private void collectOxygen(ServerLevel level, BlockPos pos, List<Component> lines) {
        if (!AD_ASTRA) {
            lines.add(Component.translatable(L10N + "oxygen.unavailable"));
            return;
        }
        boolean oxygen = OxygenApi.API.hasOxygen(level, pos);
        lines.add(Component.translatable(L10N + "oxygen",
            Component.translatable(oxygen ? L10N + "oxygen.yes" : L10N + "oxygen.no")));
    }

    private void collectSupplies(ServerLevel level, List<Component> lines) {
        SupplyPointData data = SupplyPointData.get(level);
        lines.add(Component.translatable(L10N + "supplies",
            data.poolSize(SupplyPointData.Kind.FOOD), data.poolSize(SupplyPointData.Kind.AMMO)));
    }
}
