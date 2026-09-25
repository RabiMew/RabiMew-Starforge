    #if defined ADASTRA_PRESET
        vec3 skyColorTweaked = ADASTRA_SKY_MID;
        vec3 skyColorM = ADASTRA_SKY_MID;
        vec3 skyColorM2 = ADASTRA_SKY_MID;

        vec3 noonUpSkyColor     = ADASTRA_SKY_UP;
        vec3 noonMiddleSkyColor = ADASTRA_SKY_MID;
        vec3 noonDownSkyColor   = ADASTRA_SKY_HORIZON;

        vec3 sunsetUpSkyColor     = ADASTRA_SUNSET_TINT;
        vec3 sunsetMiddleSkyColor = ADASTRA_SUNSET_TINT;
        vec3 sunsetDownSkyColorP  = ADASTRA_SUNSET_TINT;
        vec3 sunsetDownSkyColor   = ADASTRA_SUNSET_TINT;

        vec3 dayUpSkyColor     = mix(noonUpSkyColor, sunsetUpSkyColor, invNoonFactor2);
        vec3 dayMiddleSkyColor = mix(noonMiddleSkyColor, sunsetMiddleSkyColor, invNoonFactor2);
        vec3 dayDownSkyColor   = mix(noonDownSkyColor, sunsetDownSkyColor, invNoonFactor2);

        vec3 nightColFactor      = ADASTRA_SKY_HORIZON;
        vec3 nightUpSkyColor     = ADASTRA_SKY_UP;
        vec3 nightMiddleSkyColor = ADASTRA_SKY_MID;
        vec3 nightDownSkyColor   = ADASTRA_SKY_HORIZON;
    #elif defined OVERWORLD