import * as THREE from 'three';
import type { Vec2 } from './types';

export const GLOBE_RADIUS = 8;

export function simulationPointToLonLat(point: Vec2) {
  return {
    lon: (point.x / 25) * 155,
    lat: -(point.z / 14) * 64
  };
}

export function lonLatToVector(lon: number, lat: number, radius = GLOBE_RADIUS) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export function simulationPointToVector(point: Vec2, altitude = 0, radius = GLOBE_RADIUS) {
  const { lon, lat } = simulationPointToLonLat(point);
  return lonLatToVector(lon, lat, radius + altitude);
}

export function surfaceQuaternion(position: THREE.Vector3, heading = 0) {
  const normal = position.clone().normalize();
  const upright = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const turn = new THREE.Quaternion().setFromAxisAngle(normal, heading);
  return turn.multiply(upright);
}
