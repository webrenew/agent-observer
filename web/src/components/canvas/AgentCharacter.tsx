"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import type { Agent, AgentStatus } from "@/types";
import { STATUS_LABELS } from "@/types";

const STATUS_GLOW: Record<AgentStatus, string> = {
  idle: "#94a3b8",
  thinking: "#facc15",
  streaming: "#4ade80",
  tool_calling: "#a78bfa",
  waiting: "#fb923c",
  error: "#ef4444",
  done: "#22d3ee",
};

interface AgentCharacterProps {
  agent: Agent;
  position: [number, number, number];
  rotation?: [number, number, number];
  partyTargetPosition?: [number, number, number] | null;
  partyLookAtPosition?: [number, number, number] | null;
}

export function AgentCharacter({
  agent,
  position,
  rotation = [0, 0, 0],
  partyTargetPosition = null,
  partyLookAtPosition = null,
}: AgentCharacterProps) {
  const rootGroup = useRef<Group>(null);
  const group = useRef<Group>(null);
  const { appearance, status } = agent;
  const glow = STATUS_GLOW[status];
  const isPizzaParty = agent.activeCelebration === "pizza_party" && partyTargetPosition !== null;
  const isDancing = agent.activeCelebration === "dance_party" && partyTargetPosition !== null;
  const isGathering = isPizzaParty || isDancing;

  useFrame((_state, delta) => {
    if (!group.current || !rootGroup.current) return;
    const t = performance.now() / 1000;

    const target = isGathering ? partyTargetPosition : position;
    const root = rootGroup.current;
    const blend = Math.min(1, delta * (isGathering ? 4.2 : 7));
    root.position.x += (target[0] - root.position.x) * blend;
    root.position.z += (target[2] - root.position.z) * blend;
    root.position.y += (target[1] - root.position.y) * blend;

    if (isGathering && partyLookAtPosition) {
      const yaw = Math.atan2(
        partyLookAtPosition[0] - root.position.x,
        partyLookAtPosition[2] - root.position.z
      );
      root.rotation.y += (yaw - root.rotation.y) * Math.min(1, delta * 5);
    } else {
      root.rotation.y += (rotation[1] - root.rotation.y) * Math.min(1, delta * 8);
      root.rotation.x = rotation[0];
      root.rotation.z = rotation[2];
    }

    // Reset position to prevent drift between status changes
    group.current.position.x = 0;
    group.current.position.y = 0;

    const head = group.current.children[0]; // head group
    const leftArm = group.current.children[3];
    const rightArm = group.current.children[4];
    if (!head || !leftArm || !rightArm) return;

    // Reset
    head.rotation.x = 0;
    head.rotation.y = 0;
    leftArm.rotation.x = 0;
    rightArm.rotation.x = 0;

    if (isDancing) {
      group.current.position.y = Math.abs(Math.sin(t * 6)) * 0.15;
      group.current.rotation.y = Math.sin(t * 3) * 0.4;
      head.rotation.z = Math.sin(t * 4) * 0.3;
      leftArm.rotation.x = Math.sin(t * 6) * 1.2 - 1.5;
      rightArm.rotation.x = Math.sin(t * 6 + Math.PI) * 1.2 - 1.5;
      return;
    }

    switch (status) {
      case "thinking":
        // Subtle head tilt, looking around
        head.rotation.y = Math.sin(t * 0.8) * 0.3;
        head.rotation.x = Math.sin(t * 0.5) * 0.1;
        group.current.position.y = Math.sin(t * 2) * 0.03;
        break;
      case "streaming":
        // Rapid typing
        leftArm.rotation.x = Math.sin(t * 10) * 0.12 - 1.2;
        rightArm.rotation.x = Math.sin(t * 10 + 1) * 0.12 - 1.2;
        head.rotation.x = -0.1;
        break;
      case "tool_calling":
        // Writing — one arm moves
        rightArm.rotation.x = Math.sin(t * 4) * 0.1 - 1.0;
        head.rotation.x = -0.15;
        break;
      case "error":
        // Shaking
        group.current.position.x = Math.sin(t * 20) * 0.02;
        leftArm.rotation.x = -0.8;
        rightArm.rotation.x = -0.8;
        break;
      case "done":
        // Victory arms
        leftArm.rotation.x = -2.5;
        rightArm.rotation.x = -2.5;
        group.current.position.y = Math.abs(Math.sin(t * 3)) * 0.05;
        break;
      default:
        // Idle — subtle breathing
        group.current.position.y = Math.sin(t * 1.5) * 0.01;
        break;
    }
  });

  return (
    <group ref={rootGroup} position={position} rotation={rotation}>
      <group ref={group}>
        {/* Head */}
        <group position={[0, 1.6, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial color={appearance.skinTone} />
          </mesh>
          {/* Eyes */}
          <mesh position={[-0.14, 0.03, 0.31]}>
            <boxGeometry args={[0.1, 0.1, 0.02]} />
            <meshStandardMaterial
              color={glow}
              emissive={glow}
              emissiveIntensity={0.6}
            />
          </mesh>
          <mesh position={[0.14, 0.03, 0.31]}>
            <boxGeometry args={[0.1, 0.1, 0.02]} />
            <meshStandardMaterial
              color={glow}
              emissive={glow}
              emissiveIntensity={0.6}
            />
          </mesh>
          {/* Mouth */}
          <mesh position={[0, -0.12, 0.31]}>
            <boxGeometry args={[0.16, 0.04, 0.02]} />
            <meshStandardMaterial color="#8B5E3C" />
          </mesh>
          {/* Hair */}
          <mesh position={[0, 0.28, -0.04]} castShadow>
            <boxGeometry
              args={
                appearance.hairStyle === "mohawk"
                  ? [0.2, 0.35, 0.6]
                  : appearance.hairStyle === "long"
                    ? [0.65, 0.2, 0.7]
                    : appearance.hairStyle === "ponytail"
                      ? [0.65, 0.15, 0.7]
                      : [0.65, 0.15, 0.65]
              }
            />
            <meshStandardMaterial color={appearance.hairColor} />
          </mesh>
        </group>

        {/* Body */}
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[0.6, 0.8, 0.4]} />
          <meshStandardMaterial color={appearance.shirtColor} />
        </mesh>

        {/* Legs */}
        <mesh position={[-0.15, 0.3, 0]} castShadow>
          <boxGeometry args={[0.25, 0.5, 0.25]} />
          <meshStandardMaterial color={appearance.pantsColor} />
        </mesh>
        <mesh position={[0.15, 0.3, 0]} castShadow>
          <boxGeometry args={[0.25, 0.5, 0.25]} />
          <meshStandardMaterial color={appearance.pantsColor} />
        </mesh>

        {/* Left Arm */}
        <group position={[-0.42, 1.05, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.2, 0.65, 0.2]} />
            <meshStandardMaterial color={appearance.shirtColor} />
          </mesh>
        </group>

        {/* Right Arm */}
        <group position={[0.42, 1.05, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.2, 0.65, 0.2]} />
            <meshStandardMaterial color={appearance.shirtColor} />
          </mesh>
        </group>

        {/* Status indicator — floating dot above head */}
        <mesh position={[0, 2.15, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial
            color={glow}
            emissive={glow}
            emissiveIntensity={1}
          />
        </mesh>
      </group>

      {/* Name + status label */}
      <Html position={[0, 2.4, 0]} center distanceFactor={10} zIndexRange={[0, 0]}>
        <div className="pointer-events-none select-none text-center whitespace-nowrap">
          <div className="text-xs font-bold text-white drop-shadow-lg">
            {agent.name}
          </div>
          <div className="text-[10px] text-white/70">
            {STATUS_LABELS[status]}
          </div>
        </div>
      </Html>
    </group>
  );
}
