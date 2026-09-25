    #if defined ADASTRA_PRESET
        starAmount -= float(ADASTRA_STAR_AMOUNT_OFFSET);
    #endif
    star = max0(star - starAmount * 0.1);
    star *= getStarEdgeFactor(fractPart, STAR_ROUNDNESS_OW / 10.0, STAR_SOFTNESS_OW);
    star *= star;

    star *= max0(1.0 - pow(abs(VdotS) * 1.002, 100.0) * starsAroundSun) * starBelowHorizonBrightness - horizonFactor * 0.5;
    #if !defined DAYLIGHT_STARS && (!defined ADASTRA_PRESET || ADASTRA_STARS_DAYLIGHT == 0)
        star *= pow2(pow2(invNoonFactor2)) * (1.0 - 0.5 * sunVisibility);
    #endif

    #ifdef CLEAR_SKY_WHEN_RAINING
        star *= min1(invRainFactorDynamic + 0.4);
    #else
        star *= invRainFactorDynamic;
    #endif

    vec3 starColor = GetStarColor(starCoord,
                                vec3(0.38, 0.4, 0.5),
                                  vec3(STAR_COLOR_1_OW_R, STAR_COLOR_1_OW_G, STAR_COLOR_1_OW_B),
                                  vec3(STAR_COLOR_2_OW_R, STAR_COLOR_2_OW_G, STAR_COLOR_2_OW_B),
                                  vec3(STAR_COLOR_3_OW_R, STAR_COLOR_3_OW_G, STAR_COLOR_3_OW_B),
                                  float(STAR_COLOR_VARIATION_OW));

    vec3 stars = 40.0 * star * starColor * starBrightness;
    #if defined ADASTRA_PRESET
        stars *= ADASTRA_STAR_BRIGHTNESS_MULT;
    #endif