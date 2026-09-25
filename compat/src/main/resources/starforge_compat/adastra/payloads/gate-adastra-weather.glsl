    #if defined ADASTRA_PRESET && (ADASTRA_WEATHER_RAIN_ENABLED == 0 || ADASTRA_WEATHER_SNOW_ENABLED == 0)
        if ((color.r + color.g < 1.5 && ADASTRA_WEATHER_RAIN_ENABLED == 0) ||
            (color.r + color.g >= 1.5 && ADASTRA_WEATHER_SNOW_ENABLED == 0)) discard;
    #endif