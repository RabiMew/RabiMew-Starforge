        float atmFogMultVar = ATMOSPHERIC_FOG_DENSITY * ATM_FOG_MULT;
        #if defined ADASTRA_PRESET
            atmFogMultVar *= ADASTRA_FOG_DENSITY_MULT;
        #endif