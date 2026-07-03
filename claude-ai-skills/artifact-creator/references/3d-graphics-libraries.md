# 3D / Graphics Libraries

## Three.js (r128)

> ⚠️ Use dynamic `import("three")` — do NOT use static top-level import.
> OrbitControls and other extras are NOT available on the CDN.
> Do NOT use `THREE.CapsuleGeometry` — it was added in r142.

```jsx
import { useEffect, useRef } from "react";

export default function Scene() {
  const ref = useRef(null);

  useEffect(() => {
    let id;
    import("three").then(THREE => {
      const w = ref.current.clientWidth, h = ref.current.clientHeight;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas: ref.current, antialias: true, alpha: true });
      renderer.setSize(w, h);

      // Geometry
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshNormalMaterial()
      );
      scene.add(mesh);
      camera.position.z = 2;

      // Lighting (needed for MeshStandardMaterial / MeshPhongMaterial)
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(5, 5, 5);
      scene.add(light);
      scene.add(new THREE.AmbientLight(0x404040));

      const animate = () => {
        id = requestAnimationFrame(animate);
        mesh.rotation.x += 0.01;
        mesh.rotation.y += 0.01;
        renderer.render(scene, camera);
      };
      animate();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return <canvas ref={ref} width={400} height={300} style={{ borderRadius: 8 }} />;
}
```

### Available Geometries (r128)
`BoxGeometry`, `SphereGeometry`, `CylinderGeometry`, `ConeGeometry`, `TorusGeometry`,
`TorusKnotGeometry`, `PlaneGeometry`, `CircleGeometry`, `RingGeometry`, `DodecahedronGeometry`,
`IcosahedronGeometry`, `OctahedronGeometry`, `TetrahedronGeometry`, `TubeGeometry`, `ExtrudeGeometry`.

### Materials
- `MeshNormalMaterial` — colorful normals, no lighting needed
- `MeshBasicMaterial` — flat color, no lighting needed
- `MeshStandardMaterial` — PBR, needs lights (`color`, `metalness`, `roughness`)
- `MeshPhongMaterial` — specular highlights, needs lights

### Useful Patterns
```js
// Orbit manually (since OrbitControls unavailable)
let isDragging = false, prevX = 0, prevY = 0;
canvas.addEventListener("mousedown", e => { isDragging = true; prevX = e.clientX; prevY = e.clientY; });
canvas.addEventListener("mousemove", e => {
  if (!isDragging) return;
  mesh.rotation.y += (e.clientX - prevX) * 0.01;
  mesh.rotation.x += (e.clientY - prevY) * 0.01;
  prevX = e.clientX; prevY = e.clientY;
});
canvas.addEventListener("mouseup", () => isDragging = false);

// Particle system
const geo = new THREE.BufferGeometry();
const positions = new Float32Array(300).map(() => (Math.random() - 0.5) * 10);
geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const particles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.05, color: 0x3b82f6 }));
scene.add(particles);
```
