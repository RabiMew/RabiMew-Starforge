package com.starforge.compat.computer.client;

import com.mrcrayfish.furniture.refurbished.computer.client.Scene;
import com.mrcrayfish.furniture.refurbished.computer.client.widget.ComputerButton;
import com.starforge.compat.computer.SecurityProgram;
import com.starforge.compat.net.MonitorActionPayload;

import net.minecraft.client.gui.GuiGraphics;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.api.distmarker.OnlyIn;
import net.neoforged.neoforge.network.PacketDistributor;

/** Display binding for the Security program: status lines plus the single
 *  bounded control (toggle the alarm lamps registered near this computer). */
@OnlyIn(Dist.CLIENT)
public class SecurityDisplay extends MonitorDisplay<SecurityProgram> {

    public SecurityDisplay(SecurityProgram program) {
        super(program);
    }

    @Override
    protected Scene createScene() {
        return new SecurityScene();
    }

    private class SecurityScene extends Scene {
        private final ComputerButton toggle;

        SecurityScene() {
            toggle = new ComputerButton(0, 0, translation("toggle_alarms"),
                (b) -> PacketDistributor.sendToServer(new MonitorActionPayload(
                    program.getComputer().getComputerPos(),
                    SecurityProgram.ACTION_TOGGLE_ALARMS)));
            toggle.setWidth(120);
            addWidget(toggle);
            getRenderables().add(toggle);
        }

        @Override
        public void updateWidgets(int x, int y) {
            toggle.setPosition(x + 6, y + height - 26);
        }

        @Override
        public void render(GuiGraphics graphics, int x, int y, float partialTick) {
            renderLines(graphics, x, y);
        }
    }
}
