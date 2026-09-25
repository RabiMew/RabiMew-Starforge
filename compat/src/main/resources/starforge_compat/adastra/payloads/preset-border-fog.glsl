            #if defined ADASTRA_PRESET
                vec3 fogColorM = ADASTRA_SKY_HORIZON;
                #define BORDER_FOG_DENSITY BORDER_FOG_DENSITY_OVERWORLD
            #elif defined OVERWORLD
                bool isCustomSky;
                vec3 fogColorM = GetSky(VdotU, VdotS, dither, true, false, isCustomSky, false);
                #define BORDER_FOG_DENSITY BORDER_FOG_DENSITY_OVERWORLD
            #elif defined NETHER