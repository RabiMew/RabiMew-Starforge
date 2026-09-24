package com.starforge.compat.computer.client;

import java.util.List;

import com.mrcrayfish.furniture.refurbished.computer.Program;
import com.mrcrayfish.furniture.refurbished.computer.client.DisplayableProgram;
import com.mrcrayfish.furniture.refurbished.computer.client.Scene;
import com.starforge.compat.net.MonitorSnapshotPayload;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.network.chat.Component;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.api.distmarker.OnlyIn;

/** Read-only text panel: renders the snapshot lines the server pushed for this
 *  computer, or a localized "waiting" note until the first packet arrives.
 *  No data is fabricated on the client. Shared by both monitor programs via
 *  concrete subclasses (Display.bind is exact on the Program type). */
@OnlyIn(Dist.CLIENT)
public abstract class MonitorDisplay<T extends Program> extends DisplayableProgram<T> {

    private static final int WIDTH = 176, HEIGHT = 104;

    protected MonitorDisplay(T program) {
        super(program, WIDTH, HEIGHT);
        setScene(createScene());
    }

    protected Scene createScene() {
        return new TextScene();
    }

    protected static List<Component> currentLines(Program program, Component fallback) {
        MonitorSnapshotPayload snap =
            ClientPrograms.snapshot(program.getComputer().getComputerPos());
        return snap != null && snap.program().equals(program.getId())
            ? snap.lines() : List.of(fallback);
    }

    protected void renderLines(GuiGraphics graphics, int x, int y) {
        var font = Minecraft.getInstance().font;
        int ty = y + 6;
        for (Component line : currentLines(program, translation("waiting"))) {
            graphics.drawString(font, line, x + 6, ty, 0xFFd8e2dc, false);
            ty += font.lineHeight + 3;
        }
    }

    protected class TextScene extends Scene {
        @Override
        public void updateWidgets(int x, int y) {}

        @Override
        public void render(GuiGraphics graphics, int x, int y, float partialTick) {
            renderLines(graphics, x, y);
        }
    }
}
