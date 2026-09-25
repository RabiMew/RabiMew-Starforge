    #if defined ADASTRA_PRESET
        #ifndef COMPOSITE1
            vec3 noonClearLightColor = mix(ADASTRA_AMBIENT_DAY, ADASTRA_LIGHT_COLOR, noonFactor);
        #else
            vec3 noonClearLightColor = ADASTRA_LIGHT_COLOR;
        #endif
        vec3 noonClearAmbientColor = ADASTRA_AMBIENT_DAY;

        #ifndef COMPOSITE1
            vec3 sunsetClearLightColor = mix(ADASTRA_AMBIENT_DAY, ADASTRA_LIGHT_COLOR, noonFactor);
        #else
            vec3 sunsetClearLightColor = ADASTRA_LIGHT_COLOR;
        #endif
        vec3 sunsetClearAmbientColor = ADASTRA_AMBIENT_DAY;

        #if !defined COMPOSITE1 && !defined DEFERRED1
            vec3 nightClearLightColor = ADASTRA_AMBIENT_NIGHT;
        #elif defined DEFERRED1
            vec3 nightClearLightColor = ADASTRA_AMBIENT_NIGHT;
        #else
            vec3 nightClearLightColor = ADASTRA_AMBIENT_NIGHT;
        #endif
        vec3 nightClearAmbientColor = ADASTRA_AMBIENT_NIGHT;

        vec3 drlcSnowM = vec3(0.0), drlcDryM = vec3(0.0);
        vec3 drlcRainMP = vec3(0.0);
        vec3 drlcRainM = vec3(0.0);
        vec3 dayRainLightColor = ADASTRA_LIGHT_COLOR;
        vec3 dayRainAmbientColor = ADASTRA_AMBIENT_DAY;
        vec3 nightRainLightColor = ADASTRA_AMBIENT_NIGHT;
        vec3 nightRainAmbientColor = ADASTRA_AMBIENT_NIGHT;

        #ifndef COMPOSITE1
            float noonFactorDM = noonFactor;
        #else
            float noonFactorDM = noonFactor * noonFactor;
        #endif
        vec3 dayLightColor = mix(sunsetClearLightColor, noonClearLightColor, noonFactorDM);
        vec3 dayAmbientColor = mix(sunsetClearAmbientColor, noonClearAmbientColor, noonFactorDM);

        vec3 clearLightColor = mix(nightClearLightColor, dayLightColor, sunVisibility2);
        vec3 clearAmbientColor = mix(nightClearAmbientColor, dayAmbientColor, sunVisibility2);

        float rainShadowVisReduce = 0.0;
        vec3 rainLightColor = mix(nightRainLightColor, dayRainLightColor, sunVisibility2) * 2.5;
        vec3 rainAmbientColor = mix(nightRainAmbientColor, dayRainAmbientColor, sunVisibility2);

        vec3 lightColor = mix(clearLightColor, rainLightColor, rainFactor);
        #if SILHOUETTE == 0
            vec3 ambientColor = mix(clearAmbientColor, rainAmbientColor, rainFactor);
        #elif SILHOUETTE == 1
            vec3 ambientColor = mix(clearAmbientColor, rainAmbientColor, rainFactor) * mix(SILHOUETTE_BRIGHTNESS, 1.0, sunVisibility);
        #else
            vec3 ambientColor = mix(clearAmbientColor, rainAmbientColor, rainFactor) * SILHOUETTE_BRIGHTNESS;
        #endif

        #ifdef OVERWORLD_BEAMS
            vec3 ambientColorBeam = mix(clearAmbientColor, rainAmbientColor, rainFactor);
            vec3 ColorBeam = mix(ADASTRA_LIGHT_COLOR, ambientColorBeam, BEAMS_AMBIENT_INFLUENCE);
        #else
            vec3 ColorBeam = vec3(0.0);
        #endif
    #elif defined OVERWORLD