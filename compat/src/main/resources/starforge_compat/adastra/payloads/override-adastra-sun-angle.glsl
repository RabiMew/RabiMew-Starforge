        #if defined ADASTRA_PRESET
            const float sunPathRotation = ADASTRA_SUN_ANGLE_OVERRIDE;
            #if ADASTRA_SUN_ANGLE_OVERRIDE == 0
                #define PERPENDICULAR_TWEAKS
            #endif
        #elif SUN_ANGLE == -1
            #if SHADER_STYLE == 1
                const float sunPathRotation = 0.0;
                #define PERPENDICULAR_TWEAKS
            #elif SHADER_STYLE == 4
                const float sunPathRotation = -40.0;
            #endif
        #elif SUN_ANGLE == 0
            const float sunPathRotation = 0.0;
            #define PERPENDICULAR_TWEAKS
        #elif SUN_ANGLE == 20
            const float sunPathRotation = 20.0;
        #elif SUN_ANGLE == 30
            const float sunPathRotation = 30.0;
        #elif SUN_ANGLE == 40
            const float sunPathRotation = 40.0;
        #elif SUN_ANGLE == 50
            const float sunPathRotation = 50.0;
        #elif SUN_ANGLE == 60
            const float sunPathRotation = 60.0;
        #elif SUN_ANGLE == -20
            const float sunPathRotation = -20.0;
        #elif SUN_ANGLE == -30
            const float sunPathRotation = -30.0;
        #elif SUN_ANGLE == -40
            const float sunPathRotation = -40.0;
        #elif SUN_ANGLE == -50
            const float sunPathRotation = -50.0;
        #elif SUN_ANGLE == -60
            const float sunPathRotation = -60.0;
        #endif