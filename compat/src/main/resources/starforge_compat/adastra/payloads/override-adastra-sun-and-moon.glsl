        #if SUN_MOON_STYLE >= 2
            float absVdotS = abs(VdotS);
            #if SUN_MOON_STYLE == 2
                float sunSizeFactor1 = 0.9975;
                float sunSizeFactor2 = 400.0;
                float moonCrescentOffset = 0.0055;
                float moonPhaseFactor1 = 2.45;
                float moonPhaseFactor2 = 750.0;
            #else
                float sunSizeFactor1 = 0.9983;
                float sunSizeFactor2 = 588.235;
                float moonCrescentOffset = 0.0042;
                float moonPhaseFactor1 = 2.2;
                float moonPhaseFactor2 = 1000.0;
            #endif
            #if defined ADASTRA_PRESET
                float sunSizeScale = ADASTRA_SUN_SIZE_MULT * ADASTRA_SUN_SIZE_MULT;
                sunSizeFactor1 = 1.0 - (1.0 - sunSizeFactor1) * sunSizeScale;
                sunSizeFactor2 = 1.0 / (1.0 - sunSizeFactor1);
            #endif
            if (absVdotS > sunSizeFactor1) {
                float sunMoonMixer = sqrt1(sunSizeFactor2 * (absVdotS - sunSizeFactor1));

                #ifdef SUN_MOON_DURING_RAIN
                    sunMoonMixer *= 1.0 - 0.4 * rainFactor2;
                #else
                    sunMoonMixer *= 1.0 - rainFactor2;
                #endif

                if (VdotS > 0.0) {
                    #if defined ADASTRA_PRESET
                        float sunGlareMixer = sqrt1(sunMoonMixer) * ADASTRA_SUN_GLARE_MULT;
                    #endif
                    sunMoonMixer = pow2(sunMoonMixer) * GetHorizonFactor(SdotU);
                    #if defined ADASTRA_PRESET
                        sunMoonMixer = mix(
                            sunGlareMixer * GetHorizonFactor(SdotU),
                            sunMoonMixer,
                            float(ADASTRA_SUN_VISIBLE)
                        );
                    #endif

                    #ifdef CAVE_FOG
                        sunMoonMixer *= 1.0 - 0.65 * GetCaveFactor();
                    #endif
                    float sunBrightness = 25.0;
                    if (tonemap == ACESTonemap) color.rgb = mix(color.rgb, vec3(1.0, 0.698, 0.5451) * sunBrightness, sunMoonMixer);
                    else
                    color.rgb = mix(color.rgb, vec3(0.9, 0.5, 0.3) * sunBrightness, sunMoonMixer);
                } else {
                    #if defined ADASTRA_PRESET && ADASTRA_MOON_VISIBLE == 0
                        sunMoonMixer = 0.0;
                    #else
                        float horizonFactor = GetHorizonFactor(-SdotU);
                        sunMoonMixer = max0(sunMoonMixer - 0.25) * 1.33333 * horizonFactor;

                        starCoord = GetStarCoordUpperHemisphere(viewPos.xyz, 1.0) * 0.5 + 0.617;
                        float moonNoise = texture2DLod(noisetex, starCoord, 0.0).g
                                        + texture2DLod(noisetex, starCoord * 2.5, 0.0).g * 0.7
                                        + texture2DLod(noisetex, starCoord * 5.0, 0.0).g * 0.5;
                        moonNoise = max0(moonNoise - 0.75) * 1.7;
                        vec3 moonColor = vec3(0.38, 0.4, 0.5);
                        #if BLOOD_MOON > 0
                            moonColor = mix(moonColor, vec3(0.4588, 0.149, 0.149) * 1.5, getBloodMoon(sunVisibility));
                        #endif
                        moonColor *= (1.2 - (0.2 + 0.2 * sqrt1(nightFactor)) * moonNoise);

                        if (moonPhase >= 1) {
                            float moonPhaseOffset = 0.0;
                            if (moonPhase != 4) {
                                moonPhaseOffset = moonCrescentOffset;
                                moonColor *= 8.5;
                            } else moonColor *= 10.0;
                            if (moonPhase > 4) {
                                moonPhaseOffset = -moonPhaseOffset;
                            }

                            float ang = fract(timeAngle - (0.25 + moonPhaseOffset));
                            ang = (ang + (cos(ang * 3.14159265358979) * -0.5 + 0.5 - ang) / 3.0) * 6.28318530717959;
                            vec2 sunRotationData2 = vec2(cos(sunPathRotation * 0.01745329251994), -sin(sunPathRotation * 0.01745329251994));
                            vec3 rawSunVec2 = (gbufferModelView * vec4(vec3(-sin(ang), cos(ang) * sunRotationData2) * 2000.0, 1.0)).xyz;

                            float moonPhaseVdosS = dot(nViewPos, normalize(rawSunVec2.xyz));

                            sunMoonMixer *= pow2(1.0 - min1(pow(abs(moonPhaseVdosS), moonPhaseFactor2) * moonPhaseFactor1));
                        } else moonColor *= 4.0;

                        #ifdef CAVE_FOG
                            sunMoonMixer *= 1.0 - 0.5 * GetCaveFactor();
                        #endif

                        color.rgb = mix(color.rgb, moonColor, sunMoonMixer);
                    #endif
                }
            }
        #endif