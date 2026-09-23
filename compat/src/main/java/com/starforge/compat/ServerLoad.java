package com.starforge.compat;

import net.minecraft.server.MinecraftServer;
import net.neoforged.neoforge.server.ServerLifecycleHooks;

/**
 * Shared read of the server's smoothed MSPT so the compat mixins make one
 * consistent load decision per tick instead of each keeping their own metric.
 *
 * Thresholds follow docs/performance.md: degrade AI cadence once the average
 * tick cost leaves comfortable headroom, and pause NEW horde waves (never
 * killing live mobs) once the server is genuinely saturated.
 */
public final class ServerLoad {
    /** Above this average MSPT the horde pathing interval relaxes to tier 1. */
    private static final float MSPT_TIER1 = 40f;
    /** Above this average MSPT: tier 2 cadence and no new horde waves. */
    private static final float MSPT_TIER2 = 45f;

    private ServerLoad() {}

    /** Current smoothed tick time in milliseconds, or 0 when no server runs. */
    public static float mspt() {
        MinecraftServer server = ServerLifecycleHooks.getCurrentServer();
        return server == null ? 0f : server.getCurrentSmoothedTickTime();
    }

    /**
     * Scales the configured horde re-path interval by load:
     * base (25) normally, >=40 past tier 1, >=60 past tier 2.
     */
    public static int hordePathingInterval(int configured) {
        float mspt = mspt();
        if (mspt > MSPT_TIER2) return Math.max(configured, 60);
        if (mspt > MSPT_TIER1) return Math.max(configured, 40);
        return configured;
    }

    /**
     * True while the server is saturated enough that spawning a new horde wave
     * would deepen the backlog. Existing mobs keep fighting - this only skips
     * the wave spawn call.
     */
    public static boolean pauseHordeWaves() {
        return mspt() > MSPT_TIER2;
    }
}
