import { useFrame } from '@react-three/fiber';
import { WIND, windWanted } from './wind.js';

// Drives the shared wind uniforms. With wind on, it asks for a new frame every frame (the scene otherwise redraws only on change).
export default function Wind() {
  const enabled = windWanted();
  useFrame(({ clock, invalidate }) => {
    WIND.strength.value = enabled ? 1 : 0; if (!enabled) return;
    WIND.time.value = clock.getElapsedTime(); invalidate();
  });
  return null;
}
