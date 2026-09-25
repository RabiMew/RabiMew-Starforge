        #if defined ADASTRA_PRESET
            lightColorMult = vec3(ADASTRA_LIGHT_MULT);
        #elif defined OVERWORLD
            vec3 morningLightMult = vec3(LIGHT_MORNING_R, LIGHT_MORNING_G, LIGHT_MORNING_B) * LIGHT_MORNING_I;