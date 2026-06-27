import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { GLOBE_RADIUS } from '../lib/globe';
import type { OverlayMode } from '../lib/types';

// Photoreal Earth globe using real satellite textures (day color, surface normals,
// ocean specular, and night city-lights = population glow) plus a cloud shell and
// atmosphere. Drop-in replacement for the canvas-drawn <Globe/>; same props.
export function RealisticGlobe({ overlay }: { overlay: OverlayMode }) {
  const clouds = useRef<THREE.Mesh>(null);
  const [dayMap, normalMap, specularMap, cloudMap, lightsMap] = useTexture([
    '/textures/earth_atmos_2048.jpg',
    '/textures/earth_normal_2048.jpg',
    '/textures/earth_specular_2048.jpg',
    '/textures/earth_clouds_1024.png',
    '/textures/earth_lights_2048.png'
  ]);
  dayMap.colorSpace = THREE.SRGBColorSpace;
  dayMap.anisotropy = 8;

  useFrame(({ clock }) => {
    if (clouds.current) clouds.current.rotation.y = clock.elapsedTime * 0.012;
  });

  const conflict = overlay === 'conflict';

  return (
    <group>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[GLOBE_RADIUS, 128, 96]} />
        <meshStandardMaterial
          map={dayMap}
          normalMap={normalMap}
          metalnessMap={specularMap}
          metalness={0.32}
          roughness={0.72}
          emissiveMap={lightsMap}
          emissive={conflict ? '#ff9a6a' : '#ffd98a'}
          emissiveIntensity={conflict ? 1.7 : 1.35}
        />
      </mesh>

      {/* Cloud shell. */}
      <mesh ref={clouds}>
        <sphereGeometry args={[GLOBE_RADIUS * 1.01, 96, 72]} />
        <meshStandardMaterial map={cloudMap} transparent opacity={0.42} depthWrite={false} />
      </mesh>

      {/* Inner haze + outer atmosphere rim. */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS + 0.04, 96, 72]} />
        <meshBasicMaterial color="#8fdcff" transparent opacity={0.05} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS + 0.55, 96, 72]} />
        <meshBasicMaterial color="#5aa9ff" transparent opacity={0.06} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}
