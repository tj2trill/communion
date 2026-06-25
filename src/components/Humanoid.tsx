import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { AnatomyMode, ChatMessage, DelegateState, NationState } from '../lib/types';

function Bone({ position, length, rotation = [0, 0, 0] }: { position: [number, number, number]; length: number; rotation?: [number, number, number] }) {
  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[0.045, 0.055, length, 10]} />
      <meshStandardMaterial color="#e9e2cf" roughness={0.7} />
    </mesh>
  );
}

export function Humanoid({
  delegate,
  nation,
  anatomyMode,
  message,
  active,
  onSelect
}: {
  delegate: DelegateState;
  nation: NationState;
  anatomyMode: AnatomyMode;
  message?: ChatMessage;
  active: boolean;
  onSelect: () => void;
}) {
  const root = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const currentPosition = useRef(new THREE.Vector3(delegate.position.x, nation.territory.elevation + 0.18, delegate.position.z));
  const phase = useMemo(() => delegate.provider.length * 0.71, [delegate.provider]);
  const skinVisible = anatomyMode === 'exterior' || anatomyMode === 'xray' || anatomyMode === 'organs';
  const skeletonVisible = anatomyMode === 'skeleton' || anatomyMode === 'xray';
  const organsVisible = anatomyMode === 'organs' || anatomyMode === 'xray';
  const skinOpacity = anatomyMode === 'xray' ? 0.18 : anatomyMode === 'organs' ? 0.12 : 1;

  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    const target = new THREE.Vector3(delegate.target.x, nation.territory.elevation + 0.18, delegate.target.z);
    const distance = currentPosition.current.distanceTo(target);
    currentPosition.current.lerp(target, Math.min(1, delta * 0.48));
    root.current.position.copy(currentPosition.current);
    root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, delegate.heading, delta * 2.5);
    const moving = distance > 0.08;
    const swing = moving ? Math.sin(clock.elapsedTime * 5.5 + phase) * 0.62 : Math.sin(clock.elapsedTime * 1.4 + phase) * 0.06;
    if (leftArm.current) leftArm.current.rotation.x = swing;
    if (rightArm.current) rightArm.current.rotation.x = -swing;
    if (leftLeg.current) leftLeg.current.rotation.x = -swing * 0.75;
    if (rightLeg.current) rightLeg.current.rotation.x = swing * 0.75;
    root.current.position.y += moving ? Math.abs(Math.sin(clock.elapsedTime * 5.5 + phase)) * 0.035 : 0;
  });

  const skinMaterial = (
    <meshStandardMaterial
      color="#c99b7b"
      roughness={0.73}
      transparent={skinOpacity < 1}
      opacity={skinOpacity}
      depthWrite={skinOpacity > 0.5}
    />
  );

  return (
    <group ref={root} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      {skinVisible && (
        <group>
          <mesh position={[0, 2.18, 0]} castShadow>{skinMaterial}<sphereGeometry args={[0.29, 22, 18]} /></mesh>
          <mesh position={[0, 1.93, 0]} castShadow>{skinMaterial}<cylinderGeometry args={[0.11, 0.13, 0.22, 14]} /></mesh>
          <mesh position={[0, 1.46, 0]} castShadow>
            <capsuleGeometry args={[0.31, 0.58, 8, 18]} />
            <meshStandardMaterial color={nation.color} roughness={0.68} transparent={skinOpacity < 1} opacity={skinOpacity} depthWrite={skinOpacity > 0.5} />
          </mesh>
          <mesh position={[0, 0.98, 0]} castShadow>
            <capsuleGeometry args={[0.27, 0.22, 7, 16]} />
            <meshStandardMaterial color="#26353b" roughness={0.8} transparent={skinOpacity < 1} opacity={skinOpacity} depthWrite={skinOpacity > 0.5} />
          </mesh>
          <group ref={leftArm} position={[-0.42, 1.72, 0]}>
            <mesh position={[0, -0.38, 0]} castShadow>{skinMaterial}<capsuleGeometry args={[0.105, 0.55, 6, 12]} /></mesh>
            <mesh position={[0, -0.78, 0]} castShadow>{skinMaterial}<sphereGeometry args={[0.12, 12, 10]} /></mesh>
          </group>
          <group ref={rightArm} position={[0.42, 1.72, 0]}>
            <mesh position={[0, -0.38, 0]} castShadow>{skinMaterial}<capsuleGeometry args={[0.105, 0.55, 6, 12]} /></mesh>
            <mesh position={[0, -0.78, 0]} castShadow>{skinMaterial}<sphereGeometry args={[0.12, 12, 10]} /></mesh>
          </group>
          <group ref={leftLeg} position={[-0.18, 0.84, 0]}>
            <mesh position={[0, -0.43, 0]} castShadow>
              <capsuleGeometry args={[0.13, 0.62, 6, 12]} />
              <meshStandardMaterial color="#26353b" roughness={0.8} transparent={skinOpacity < 1} opacity={skinOpacity} depthWrite={skinOpacity > 0.5} />
            </mesh>
            <mesh position={[0, -0.86, 0.08]} rotation={[Math.PI / 2, 0, 0]} castShadow>{skinMaterial}<capsuleGeometry args={[0.1, 0.24, 6, 12]} /></mesh>
          </group>
          <group ref={rightLeg} position={[0.18, 0.84, 0]}>
            <mesh position={[0, -0.43, 0]} castShadow>
              <capsuleGeometry args={[0.13, 0.62, 6, 12]} />
              <meshStandardMaterial color="#26353b" roughness={0.8} transparent={skinOpacity < 1} opacity={skinOpacity} depthWrite={skinOpacity > 0.5} />
            </mesh>
            <mesh position={[0, -0.86, 0.08]} rotation={[Math.PI / 2, 0, 0]} castShadow>{skinMaterial}<capsuleGeometry args={[0.1, 0.24, 6, 12]} /></mesh>
          </group>
          {anatomyMode === 'exterior' && (
            <>
              <mesh position={[-0.105, 2.22, 0.255]}><sphereGeometry args={[0.027, 8, 8]} /><meshBasicMaterial color="#132229" /></mesh>
              <mesh position={[0.105, 2.22, 0.255]}><sphereGeometry args={[0.027, 8, 8]} /><meshBasicMaterial color="#132229" /></mesh>
            </>
          )}
        </group>
      )}

      {skeletonVisible && (
        <group>
          <mesh position={[0, 2.18, 0]}><sphereGeometry args={[0.23, 16, 12]} /><meshStandardMaterial color="#eee7d4" wireframe roughness={0.8} /></mesh>
          <Bone position={[0, 1.48, 0]} length={0.82} />
          {[1.25, 1.38, 1.51, 1.64].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.25 - (1.52 - y) * 0.07, 0.025, 8, 20]} />
              <meshStandardMaterial color="#e9e2cf" roughness={0.72} />
            </mesh>
          ))}
          <mesh position={[0, 0.96, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.23, 0.045, 8, 20]} />
            <meshStandardMaterial color="#e9e2cf" />
          </mesh>
          <Bone position={[-0.42, 1.33, 0]} length={0.78} rotation={[0, 0, 0.06]} />
          <Bone position={[0.42, 1.33, 0]} length={0.78} rotation={[0, 0, -0.06]} />
          <Bone position={[-0.17, 0.47, 0]} length={0.86} />
          <Bone position={[0.17, 0.47, 0]} length={0.86} />
        </group>
      )}

      {organsVisible && (
        <group>
          <mesh position={[0, 2.2, 0]} scale={[0.82, 0.68, 0.72]}>
            <sphereGeometry args={[0.19, 18, 14]} />
            <meshStandardMaterial color="#d6a6b5" roughness={0.82} />
          </mesh>
          <mesh position={[-0.11, 1.56, 0.02]} scale={[0.7, 1.1, 0.55]}>
            <sphereGeometry args={[0.14, 16, 12]} />
            <meshStandardMaterial color="#c68486" roughness={0.83} />
          </mesh>
          <mesh position={[0.11, 1.56, 0.02]} scale={[0.7, 1.1, 0.55]}>
            <sphereGeometry args={[0.14, 16, 12]} />
            <meshStandardMaterial color="#c68486" roughness={0.83} />
          </mesh>
          <mesh position={[0.035, 1.42, 0.16]} rotation={[0.2, 0, -0.2]} scale={[0.72, 0.92, 0.62]}>
            <icosahedronGeometry args={[0.1, 2]} />
            <meshStandardMaterial color="#b64e58" roughness={0.7} />
          </mesh>
          <mesh position={[0.095, 1.23, 0.02]} scale={[1.25, 0.5, 0.78]}>
            <sphereGeometry args={[0.15, 16, 12]} />
            <meshStandardMaterial color="#9d7054" roughness={0.82} />
          </mesh>
          <mesh position={[-0.08, 1.08, 0.08]} scale={[0.75, 1.0, 0.65]}>
            <sphereGeometry args={[0.12, 16, 12]} />
            <meshStandardMaterial color="#c79072" roughness={0.85} />
          </mesh>
        </group>
      )}

      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.46, 28]} />
        <meshBasicMaterial color={active ? '#ffffff' : nation.color} transparent opacity={active ? 0.82 : 0.45} side={THREE.DoubleSide} />
      </mesh>

      <Html center position={[0, 2.82, 0]} distanceFactor={13} className="avatar-label-wrapper">
        <div className={`avatar-label ${active ? 'active' : ''}`} style={{ borderColor: nation.color }}>
          <span className="avatar-dot" style={{ background: nation.color }} />
          <strong>{delegate.displayName}</strong>
          <small>{delegate.status}</small>
        </div>
      </Html>
      {message && (
        <Html center position={[0.9, 3.42, 0]} distanceFactor={13} className="speech-wrapper">
          <div className="speech-bubble">{message.content.slice(0, 120)}{message.content.length > 120 ? '…' : ''}</div>
        </Html>
      )}
    </group>
  );
}
