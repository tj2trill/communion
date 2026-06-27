import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLOBE_RADIUS, simulationPointToVector, surfaceQuaternion } from '../lib/globe';
import type { AffectState, AnatomyMode, ChatMessage, DelegateState, NationState, ProviderId } from '../lib/types';

// Visual identity per backing model so delegates are distinguishable at a glance.
const PROVIDER_COLOR: Record<ProviderId, string> = {
  openai: '#10a37f',
  anthropic: '#d97757',
  google: '#4285f4',
  xai: '#cfd2d6'
};

// Aura color keyed to the emotion carried by the delegate's most recent message.
const EMOTION_COLOR: Record<keyof AffectState, string> = {
  valence: '#ffcf5c',
  arousal: '#ff8a3d',
  trust: '#56d2c4',
  fear: '#b66bff',
  resolve: '#5b9dff'
};

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
  onSelect,
  surfaceMode = 'plane'
}: {
  delegate: DelegateState;
  nation: NationState;
  anatomyMode: AnatomyMode;
  message?: ChatMessage;
  active: boolean;
  onSelect: () => void;
  surfaceMode?: 'plane' | 'globe';
}) {
  const root = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const insignia = useRef<THREE.Mesh>(null);
  const auraRing = useRef<THREE.Mesh>(null);
  const altitude = surfaceMode === 'globe' ? 0.28 + nation.territory.elevation * 0.05 : nation.territory.elevation + 0.18;
  const currentPosition = useRef(
    surfaceMode === 'globe'
      ? simulationPointToVector(delegate.position, altitude, GLOBE_RADIUS)
      : new THREE.Vector3(delegate.position.x, altitude, delegate.position.z)
  );
  const phase = useMemo(() => delegate.provider.length * 0.71 + delegate.id.length * 0.13, [delegate.provider, delegate.id]);
  const providerColor = PROVIDER_COLOR[delegate.provider] ?? nation.secondaryColor;
  const emotionColor = message ? EMOTION_COLOR[message.emotion] ?? nation.color : nation.color;
  const skinVisible = anatomyMode === 'exterior' || anatomyMode === 'xray' || anatomyMode === 'organs';
  const skeletonVisible = anatomyMode === 'skeleton' || anatomyMode === 'xray';
  const organsVisible = anatomyMode === 'organs' || anatomyMode === 'xray';
  const skinOpacity = anatomyMode === 'xray' ? 0.18 : anatomyMode === 'organs' ? 0.12 : 1;

  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    const target = surfaceMode === 'globe'
      ? simulationPointToVector(delegate.target, altitude, GLOBE_RADIUS)
      : new THREE.Vector3(delegate.target.x, nation.territory.elevation + 0.18, delegate.target.z);
    const distance = currentPosition.current.distanceTo(target);
    currentPosition.current.lerp(target, Math.min(1, delta * 0.48));
    const moving = distance > 0.08;

    // Body language: walking gait while moving, otherwise a pose driven by the delegate's status.
    let lArm = 0;
    let rArm = 0;
    let lLeg = 0;
    let rLeg = 0;
    let lean = 0;
    let bob = 0;
    let headTilt = 0;
    if (moving) {
      const swing = Math.sin(t * 5.5 + phase) * 0.62;
      lArm = swing;
      rArm = -swing;
      lLeg = -swing * 0.75;
      rLeg = swing * 0.75;
      bob = Math.abs(Math.sin(t * 5.5 + phase)) * 0.035;
    } else {
      switch (delegate.status) {
        case 'speaking':
          rArm = -0.55 + Math.sin(t * 4.2 + phase) * 0.4;
          lArm = Math.sin(t * 3.1 + phase) * 0.14;
          lean = 0.07;
          headTilt = Math.sin(t * 4.2 + phase) * 0.05;
          break;
        case 'voting':
          rArm = -2.5; // hand raised
          lean = 0.0;
          break;
        case 'negotiating':
          lean = 0.16;
          rArm = -0.28;
          lArm = 0.2;
          headTilt = 0.06;
          break;
        case 'governing':
          lean = -0.02;
          break;
        case 'deliberating':
        default: {
          const sway = Math.sin(t * 1.3 + phase) * 0.05;
          lArm = sway;
          rArm = -sway;
          lean = Math.sin(t * 0.8 + phase) * 0.03;
          headTilt = Math.sin(t * 0.9 + phase) * 0.06;
        }
      }
      bob = Math.sin(t * 1.4 + phase) * 0.01;
    }

    if (leftArm.current) leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, lArm, delta * 8);
    if (rightArm.current) rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, rArm, delta * 8);
    if (leftLeg.current) leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, lLeg, delta * 8);
    if (rightLeg.current) rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, rLeg, delta * 8);
    if (head.current) head.current.rotation.z = THREE.MathUtils.lerp(head.current.rotation.z, headTilt, delta * 6);
    if (surfaceMode === 'globe') {
      const normal = currentPosition.current.clone().normalize();
      const displayPosition = currentPosition.current.clone().add(normal.multiplyScalar(bob));
      root.current.position.copy(displayPosition);
      root.current.quaternion.slerp(surfaceQuaternion(currentPosition.current, delegate.heading), delta * 3.2);
      root.current.rotateX(lean);
    } else {
      root.current.position.copy(currentPosition.current);
      root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, delegate.heading, delta * 2.5);
      root.current.rotation.x = THREE.MathUtils.lerp(root.current.rotation.x, lean, delta * 6);
      root.current.position.y += bob;
    }

    // Hovering provider insignia spins and bobs; aura pulses when the delegate is the active speaker.
    if (insignia.current) {
      insignia.current.rotation.y = t * 1.3;
      insignia.current.position.y = 2.66 + Math.sin(t * 1.8 + phase) * 0.04;
    }
    if (auraRing.current) {
      const mat = auraRing.current.material as THREE.MeshBasicMaterial;
      const base = active ? 0.6 : 0.42;
      mat.opacity = base + (active ? Math.abs(Math.sin(t * 3.4 + phase)) * 0.32 : 0);
      const scale = active ? 1 + Math.sin(t * 3.4 + phase) * 0.06 : 1;
      auraRing.current.scale.set(scale, scale, scale);
    }
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
    <group ref={root} scale={surfaceMode === 'globe' ? 0.42 : 1} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      {skinVisible && (
        <group>
          <group ref={head} position={[0, 2.18, 0]}>
            <mesh castShadow>{skinMaterial}<sphereGeometry args={[0.29, 22, 18]} /></mesh>
            {anatomyMode === 'exterior' && (
              <>
                <mesh position={[-0.105, 0.04, 0.255]}><sphereGeometry args={[0.027, 8, 8]} /><meshBasicMaterial color="#132229" /></mesh>
                <mesh position={[0.105, 0.04, 0.255]}><sphereGeometry args={[0.027, 8, 8]} /><meshBasicMaterial color="#132229" /></mesh>
              </>
            )}
          </group>
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

      {/* Provider insignia: a hovering crystal colored by the AI model driving this delegate. */}
      <mesh ref={insignia} position={[0, 2.66, 0]}>
        <octahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial color={providerColor} emissive={providerColor} emissiveIntensity={0.8} roughness={0.3} metalness={0.4} toneMapped={false} />
      </mesh>

      {/* Aura ring: emotion-tinted, pulses while this delegate is the active speaker. */}
      <mesh ref={auraRing} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.48, 32]} />
        <meshBasicMaterial color={active ? emotionColor : nation.color} transparent opacity={active ? 0.6 : 0.42} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      <Html center position={[0, 2.96, 0]} distanceFactor={13} className="avatar-label-wrapper">
        <div className={`avatar-label ${active ? 'active' : ''}`} style={{ borderColor: nation.color }}>
          <span className="avatar-dot" style={{ background: providerColor }} />
          <strong>{delegate.displayName}</strong>
          <small>{delegate.role} · {delegate.status}</small>
        </div>
      </Html>
      {message && (
        <Html center position={[0.9, 3.56, 0]} distanceFactor={13} className="speech-wrapper">
          <div className="speech-bubble" style={{ borderColor: emotionColor }}>{message.content.slice(0, 120)}{message.content.length > 120 ? '…' : ''}</div>
        </Html>
      )}
    </group>
  );
}
