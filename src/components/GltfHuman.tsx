import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { GLOBE_RADIUS, simulationPointToVector, surfaceQuaternion } from '../lib/globe';
import type { DelegateState, NationState } from '../lib/types';

const MODEL_URL = '/models/Xbot.glb';

// A real rigged human (Mixamo Xbot) per delegate, standing on the globe surface:
// cloned skinned mesh, idle/walk animation driven by movement, tinted to the nation.
export function GltfHuman({
  delegate,
  nation,
  active,
  onSelect
}: {
  delegate: DelegateState;
  nation: NationState;
  active: boolean;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  const altitude = 0.28 + nation.territory.elevation * 0.05;
  const cloned = useMemo(() => {
    const copy = SkeletonUtils.clone(scene) as THREE.Group;
    const tint = new THREE.Color(nation.color).lerp(new THREE.Color('#ffffff'), 0.45);
    copy.traverse((object) => {
      object.castShadow = true;
      const mesh = object as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (mesh.isMesh && material?.clone) {
        const next = material.clone();
        next.color = tint;
        next.emissive = new THREE.Color(nation.color);
        next.emissiveIntensity = 0.07;
        mesh.material = next;
      }
    });
    return copy;
  }, [scene, nation.color]);

  const { actions, names } = useAnimations(animations, group);
  const walkName = useMemo(() => names.find((name) => /walk/i.test(name)) ?? names.find((name) => /run/i.test(name)) ?? names[0], [names]);
  const idleName = useMemo(() => names.find((name) => /idle/i.test(name)) ?? names[0], [names]);
  const position = useRef(simulationPointToVector(delegate.position, altitude, GLOBE_RADIUS));
  const moving = useRef(false);

  useEffect(() => {
    if (idleName && actions[idleName]) actions[idleName].reset().play();
  }, [actions, idleName]);

  useFrame((_, delta) => {
    if (!group.current) return;
    const target = simulationPointToVector(delegate.target, altitude, GLOBE_RADIUS);
    const distance = position.current.distanceTo(target);
    position.current.lerp(target, Math.min(1, delta * 0.48));
    group.current.position.copy(position.current);
    group.current.quaternion.slerp(surfaceQuaternion(position.current, delegate.heading), delta * 3.2);
    const isMoving = distance > 0.04;
    if (isMoving !== moving.current) {
      moving.current = isMoving;
      const next = isMoving ? walkName : idleName;
      const prev = isMoving ? idleName : walkName;
      if (next && actions[next]) actions[next].reset().fadeIn(0.25).play();
      if (prev && prev !== next && actions[prev]) actions[prev].fadeOut(0.25);
    }
  });

  return (
    <group ref={group} scale={0.5} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <primitive object={cloned} />
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.72, 24]} />
        <meshBasicMaterial color={active ? '#ffffff' : nation.color} transparent opacity={active ? 0.62 : 0.42} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
