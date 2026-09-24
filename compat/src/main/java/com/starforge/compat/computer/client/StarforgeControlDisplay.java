package com.starforge.compat.computer.client;

import com.starforge.compat.computer.StarforgeControlProgram;

import net.neoforged.api.distmarker.Dist;
import net.neoforged.api.distmarker.OnlyIn;

/** Display binding for the Starforge Control program (pure status readout). */
@OnlyIn(Dist.CLIENT)
public class StarforgeControlDisplay extends MonitorDisplay<StarforgeControlProgram> {
    public StarforgeControlDisplay(StarforgeControlProgram program) {
        super(program);
    }
}
