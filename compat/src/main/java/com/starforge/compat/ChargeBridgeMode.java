package com.starforge.compat;

import net.minecraft.util.StringRepresentable;

/**
 * Conversion direction of the charge bridge. Stored as a blockstate property so
 * neighbours, probes and Jade-style readers can inspect it without the block
 * entity. Cycled by sneak-right-clicking with an empty hand; an active redstone
 * signal forces {@link #OFF} regardless of this property.
 */
public enum ChargeBridgeMode implements StringRepresentable {
    /** Bidirectional: whichever side has surplus drives the conversion. */
    AUTO("auto"),
    /** Forge Energy is converted into Railcraft Charge. */
    FE_TO_CHARGE("fe_to_charge"),
    /** Railcraft Charge is drawn and emitted as Forge Energy. */
    CHARGE_TO_FE("charge_to_fe"),
    /** No conversion in either direction. */
    OFF("off");

    private final String name;

    ChargeBridgeMode(String name) {
        this.name = name;
    }

    @Override
    public String getSerializedName() {
        return name;
    }

    public ChargeBridgeMode next() {
        return switch (this) {
            case AUTO -> FE_TO_CHARGE;
            case FE_TO_CHARGE -> CHARGE_TO_FE;
            case CHARGE_TO_FE -> OFF;
            case OFF -> AUTO;
        };
    }
}
