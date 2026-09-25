            #if defined ADASTRA_PRESET && ADASTRA_WEATHER_RAIN_ENABLED == 0
                float pNormalMult = 0.0;
            #else
                float pNormalMult = 0.02 * rainFactor * inRainy * pow2(lmCoordM.y);
            #endif