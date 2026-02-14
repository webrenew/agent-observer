"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Preload } from "@react-three/drei";
import { Office } from "./Office";

function LoadingScreen() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0e0e0d]">
      <div className="text-center">
        <div className="text-sm font-medium text-[#9A9692]">
          Loading Agent Space...
        </div>
        <div className="mt-2 h-1 w-48 overflow-hidden rounded-full bg-[#1a1a19]">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#548C5A]" />
        </div>
      </div>
    </div>
  );
}

export function Scene() {
  return (
    <div className="relative h-screen w-screen">
      <Suspense fallback={<LoadingScreen />}>
        <Canvas
          shadows
          camera={{
            position: [8, 7, 8],
            fov: 45,
            near: 0.1,
            far: 100,
          }}
        >
          <Office />
          <OrbitControls
            autoRotate
            autoRotateSpeed={0.3}
            enableDamping
            dampingFactor={0.05}
            target={[0, 1, -6]}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.5}
            minDistance={8}
            maxDistance={18}
            enablePan={false}
          />
          <Preload all />
        </Canvas>
      </Suspense>
    </div>
  );
}
