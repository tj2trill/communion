import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer, GammaCorrectionShader, RenderPass, ShaderPass, UnrealBloomPass } from 'three-stdlib';

// AAA-ish bloom pass. three-stdlib in this project ships no OutputPass, so the
// final colour-space conversion is done with GammaCorrectionShader (the standard
// last pass for this composer version). A positive-priority useFrame hands the
// render loop to the composer, so the default r3f auto-render is suppressed.
export function PostProcessing({
  strength = 0.48,
  radius = 0.42,
  threshold = 0.86
}: {
  strength?: number;
  radius?: number;
  threshold?: number;
}) {
  const { gl, scene, camera, size } = useThree();
  const bloomRef = useRef<UnrealBloomPass | null>(null);

  const composer = useMemo(() => {
    const instance = new EffectComposer(gl);
    instance.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), strength, radius, threshold);
    bloomRef.current = bloom;
    instance.addPass(bloom);
    instance.addPass(new ShaderPass(GammaCorrectionShader));
    return instance;
    // Rebuild only when the renderer/scene/camera identity changes; bloom params
    // are applied live in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useEffect(() => {
    if (!bloomRef.current) return;
    bloomRef.current.strength = strength;
    bloomRef.current.radius = radius;
    bloomRef.current.threshold = threshold;
  }, [strength, radius, threshold]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
    composer.setPixelRatio(gl.getPixelRatio());
  }, [composer, gl, size]);

  useEffect(() => () => composer.dispose(), [composer]);

  useFrame(() => {
    composer.render();
  }, 1);

  return null;
}
