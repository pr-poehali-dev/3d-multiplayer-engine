import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';

interface Player {
  id: string;
  position: THREE.Vector3;
  rotation: number;
  username: string;
  health: number;
}

const Index = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [username, setUsername] = useState('');
  const [health, setHealth] = useState(100);
  const [ammo, setAmmo] = useState(30);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);
  const weaponRef = useRef<THREE.Group | null>(null);
  const playersRef = useRef<Map<string, { mesh: THREE.Group; label: THREE.Sprite }>>(new Map());
  const velocityRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector3());
  const keysRef = useRef({ w: false, a: false, s: false, d: false, shift: false });

  useEffect(() => {
    if (!mountRef.current || !isPlaying) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1A1F2C);
    scene.fog = new THREE.Fog(0x1A1F2C, 10, 50);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.6, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0x404040, 1);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    scene.add(dirLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x2a2d3a, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(100, 50, 0x9b87f5, 0x444444);
    scene.add(gridHelper);

    for (let i = 0; i < 10; i++) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(2, 3, 2),
        new THREE.MeshStandardMaterial({ color: 0x7E69AB })
      );
      box.position.set(
        Math.random() * 40 - 20,
        1.5,
        Math.random() * 40 - 20
      );
      box.castShadow = true;
      box.receiveShadow = true;
      scene.add(box);
    }

    const weapon = new THREE.Group();
    const gunBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })
    );
    gunBody.position.set(0.15, -0.1, -0.3);
    
    const gunBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 })
    );
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0.15, -0.05, -0.5);
    
    const gunHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.15, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    gunHandle.position.set(0.15, -0.2, -0.25);

    weapon.add(gunBody);
    weapon.add(gunBarrel);
    weapon.add(gunHandle);
    camera.add(weapon);
    scene.add(camera);
    weaponRef.current = weapon;

    const controls = new PointerLockControls(camera, renderer.domElement);
    controlsRef.current = controls;

    renderer.domElement.addEventListener('click', () => {
      controls.lock();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keysRef.current) {
        keysRef.current[key as keyof typeof keysRef.current] = true;
      }
      if (e.code === 'Space' && ammo > 0) {
        shoot();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keysRef.current) {
        keysRef.current[key as keyof typeof keysRef.current] = false;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    const shoot = () => {
      setAmmo(prev => Math.max(0, prev - 1));
      
      if (weaponRef.current) {
        weaponRef.current.position.z += 0.1;
        setTimeout(() => {
          if (weaponRef.current) weaponRef.current.position.z -= 0.1;
        }, 100);
      }

      const muzzleFlash = new THREE.PointLight(0xffa500, 2, 5);
      muzzleFlash.position.copy(camera.position);
      muzzleFlash.position.add(
        new THREE.Vector3(0.15, -0.05, -0.5).applyQuaternion(camera.quaternion)
      );
      scene.add(muzzleFlash);
      setTimeout(() => scene.remove(muzzleFlash), 50);

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      if (intersects.length > 0 && intersects[0].distance < 50) {
        const hitPoint = intersects[0].point;
        const hitMarker = new THREE.Mesh(
          new THREE.SphereGeometry(0.05),
          new THREE.MeshBasicMaterial({ color: 0xea384c })
        );
        hitMarker.position.copy(hitPoint);
        scene.add(hitMarker);
        setTimeout(() => scene.remove(hitMarker), 200);
      }
    };

    if (isMultiplayer) {
      for (let i = 0; i < 3; i++) {
        const playerGroup = new THREE.Group();
        
        const body = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.3, 1.2, 4, 8),
          new THREE.MeshStandardMaterial({ color: 0x9b87f5 })
        );
        body.castShadow = true;
        playerGroup.add(body);

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(0, 0, 256, 64);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 32px Roboto';
          ctx.textAlign = 'center';
          ctx.fillText(`Player${i + 1}`, 128, 42);
        }
        
        const labelTexture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture });
        const label = new THREE.Sprite(labelMaterial);
        label.scale.set(2, 0.5, 1);
        label.position.y = 2;
        playerGroup.add(label);

        playerGroup.position.set(
          Math.random() * 10 - 5,
          0.9,
          Math.random() * 10 - 5
        );
        scene.add(playerGroup);
        
        playersRef.current.set(`bot${i}`, { mesh: playerGroup, label });
      }
    }

    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (controls.isLocked) {
        velocityRef.current.x -= velocityRef.current.x * 10.0 * delta;
        velocityRef.current.z -= velocityRef.current.z * 10.0 * delta;

        directionRef.current.z = Number(keysRef.current.w) - Number(keysRef.current.s);
        directionRef.current.x = Number(keysRef.current.a) - Number(keysRef.current.d);
        directionRef.current.normalize();

        const speed = keysRef.current.shift ? 6.0 : 3.0;

        if (keysRef.current.w || keysRef.current.s) {
          velocityRef.current.z -= directionRef.current.z * speed * delta;
        }
        if (keysRef.current.a || keysRef.current.d) {
          velocityRef.current.x -= directionRef.current.x * speed * delta;
        }

        controls.moveRight(-velocityRef.current.x * delta);
        controls.moveForward(-velocityRef.current.z * delta);
      }

      playersRef.current.forEach((player) => {
        player.mesh.position.x += Math.sin(Date.now() * 0.001) * 0.02;
        player.mesh.position.z += Math.cos(Date.now() * 0.001) * 0.02;
        player.mesh.lookAt(camera.position);
        player.label.lookAt(camera.position);
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isPlaying, isMultiplayer, ammo]);

  const startGame = (multiplayer: boolean) => {
    if (!username.trim()) return;
    setIsMultiplayer(multiplayer);
    setIsPlaying(true);
  };

  const reload = () => {
    setAmmo(30);
  };

  if (!isPlaying) {
    return (
      <div className="min-h-screen bg-[#1A1F2C] flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-4">
            <Icon name="Crosshair" className="mx-auto text-[#9b87f5]" size={64} />
            <h1 className="text-5xl font-bold text-white">FPS Arena</h1>
            <p className="text-gray-400 text-lg">3D Multiplayer Shooter</p>
          </div>

          <div className="space-y-4">
            <Input
              placeholder="Введи никнейм"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-[#2a2d3a] border-[#9b87f5] text-white text-lg h-12"
              maxLength={12}
            />

            <div className="space-y-3">
              <Button
                onClick={() => startGame(false)}
                disabled={!username.trim()}
                className="w-full bg-[#9b87f5] hover:bg-[#7E69AB] text-white h-12 text-lg"
              >
                <Icon name="User" className="mr-2" size={20} />
                Одиночная игра
              </Button>

              <Button
                onClick={() => startGame(true)}
                disabled={!username.trim()}
                className="w-full bg-[#7E69AB] hover:bg-[#6E59A5] text-white h-12 text-lg"
              >
                <Icon name="Users" className="mr-2" size={20} />
                Мультиплеер (боты)
              </Button>
            </div>
          </div>

          <div className="pt-8 space-y-2 text-sm text-gray-500">
            <p>WASD - движение | Shift - бег</p>
            <p>Пробел - стрельба | R - перезарядка</p>
            <p>Мышь - прицеливание</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div ref={mountRef} className="w-full h-full" />

      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-8 text-white text-xl font-bold pointer-events-none">
        <div className="flex items-center gap-2 bg-black/50 px-4 py-2 rounded-lg">
          <Icon name="Heart" className="text-[#ea384c]" size={24} />
          <span>{health}</span>
        </div>
        <div className="flex items-center gap-2 bg-black/50 px-4 py-2 rounded-lg">
          <Icon name="Zap" className="text-[#9b87f5]" size={24} />
          <span>{ammo}/30</span>
        </div>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-6 h-6 border-2 border-[#9b87f5] rounded-full opacity-60">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-[#9b87f5] rounded-full" />
        </div>
      </div>

      <div className="absolute bottom-8 right-8 space-y-2">
        <Button
          onClick={reload}
          className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white w-12 h-12"
        >
          <Icon name="RotateCw" size={20} />
        </Button>
        <Button
          onClick={() => {
            setIsPlaying(false);
            setHealth(100);
            setAmmo(30);
          }}
          className="bg-[#ea384c] hover:bg-[#d32f3f] text-white w-12 h-12"
        >
          <Icon name="X" size={20} />
        </Button>
      </div>

      <div className="absolute top-8 left-8 text-white font-bold text-lg bg-black/50 px-4 py-2 rounded-lg pointer-events-none">
        {username}
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white text-xl font-bold opacity-0 transition-opacity" id="click-to-play">
        <div className="bg-black/80 px-8 py-4 rounded-lg">
          Кликни для управления
        </div>
      </div>
    </div>
  );
};

export default Index;
