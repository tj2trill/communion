import { MapControls, RoundedBox } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import type { AnatomyMode, OverlayMode, WorldState } from '../lib/types';
import { Humanoid } from './Humanoid';
import { CapitalCluster, CommunicationPulse, RelationArc, Territory } from './WorldMap';


export interface WorldSceneProps {
  world: WorldState;
  anatomyMode: AnatomyMode;
  overlay: OverlayMode;
  selectedNationId: string;
  onSelectNation: (nationId: string) => void;
}

function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 17, 18);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

function SceneContent({ world, anatomyMode, overlay, selectedNationId, onSelectNation }: WorldSceneProps) {
  const recentMessages = world.messages.slice(-4);
  return (
    <>
      <CameraRig />
      <color attach="background" args={['#061016']} />
      <fog attach="fog" args={['#061016', 19, 43]} />
      <ambientLight intensity={0.72} />
      <hemisphereLight args={['#ccecff', '#152328', 1.15]} />
      <directionalLight position={[-8, 18, 10]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[10, 8, -8]} intensity={18} distance={34} color="#67c8be" />

      <RoundedBox args={[30.5, 0.5, 15.5]} radius={0.65} smoothness={5} position={[0, -0.46, 0]} receiveShadow>
        <meshStandardMaterial color="#0b2933" roughness={0.42} metalness={0.18} />
      </RoundedBox>
      <gridHelper args={[30, 30, '#2d5864', '#15333d']} position={[0, -0.18, 0]} />

      {world.nations.map((nation) => (
        <Territory
          key={nation.id}
          nation={nation}
          selected={nation.id === selectedNationId}
          overlay={overlay}
          world={world}
          onSelect={() => onSelectNation(nation.id)}
        />
      ))}
      {world.nations.map((nation) => <CapitalCluster key={`capital-${nation.id}`} nation={nation} />)}
      {world.relations.map((relation) => <RelationArc key={relation.id} relation={relation} world={world} overlay={overlay} />)}
      {recentMessages.map((message, index) => <CommunicationPulse key={message.id} message={message} world={world} index={index} />)}

      {world.delegates.map((delegate) => {
        const nation = world.nations.find((item) => item.id === delegate.nationId)!;
        const message = [...world.messages].reverse().find((item) => item.fromDelegateId === delegate.id && item.turn >= world.turn - 2);
        return (
          <Humanoid
            key={delegate.id}
            delegate={delegate}
            nation={nation}
            anatomyMode={anatomyMode}
            message={message}
            active={delegate.id === world.currentDelegateId}
            onSelect={() => onSelectNation(nation.id)}
          />
        );
      })}

      <MapControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={9}
        maxDistance={36}
        minPolarAngle={0.38}
        maxPolarAngle={1.44}
        target={[0, 0, 0]}
      />
    </>
  );
}

export function WorldScene(props: WorldSceneProps) {
  return (
    <Canvas shadows dpr={[1, 1.7]} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}>
      <Suspense fallback={null}>
        <SceneContent {...props} />
      </Suspense>
    </Canvas>
  );
}
