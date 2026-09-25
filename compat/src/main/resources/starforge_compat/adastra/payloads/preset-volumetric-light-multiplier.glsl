    #ifdef OVERWORLD
        #if defined ADASTRA_PRESET
            float presetMult = ADASTRA_VL_MULT;
        #else
            float presetMult = 1.0;
        #endif
        vlMult *= presetMult;

        vec3 vlColor = lightColor;