            #if defined ADASTRA_PRESET
                vec3 fogColorM = ADASTRA_FOG_COLOR;
            #elif defined OVERWORLD
                vec3 fogColorM = GetAtmFogColor(altitudeFactorRaw, VdotS);
            #else
                vec3 fogColorM = endSkyColor * 1.5;
            #endif