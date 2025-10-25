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

interface WeaponConfig {
  name: string;
  ammo: number;
  color: number;
  size: { width: number; height: number; depth: number };
  barrelLength: number;
  fireRate: number;
}

const WEAPONS: WeaponConfig[] = [
  { name: 'Пистолет', ammo: 12, color: 0x333333, size: { width: 0.1, height: 0.1, depth: 0.4 }, barrelLength: 0.25, fireRate: 300 },
  { name: 'Автомат', ammo: 30, color: 0x1a1a1a, size: { width: 0.12, height: 0.12, depth: 0.6 }, barrelLength: 0.4, fireRate: 100 },
  { name: 'Снайперка', ammo: 5, color: 0x2d5016, size: { width: 0.08, height: 0.08, depth: 0.8 }, barrelLength: 0.6, fireRate: 800 },
];

const Index = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [username, setUsername] = useState('');
  const [health, setHealth] = useState(100);
  const [ammo, setAmmo] = useState(12);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [currentWeapon, setCurrentWeapon] = useState(0);
  const [canShoot, setCanShoot] = useState(true);
  
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);
  const weaponRef = useRef<THREE.Group | null>(null);
  const playersRef = useRef<Map<string, { mesh: THREE.Group; label: THREE.Sprite }>>(new Map());
  const velocityRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector3());
  const keysRef = useRef({ w: false, a: false, s: false, d: false, shift: false });
  const weaponSwayRef = useRef({ x: 0, y: 0 });
  const bobPhaseRef = useRef(0);

  const createWeaponModel = (config: WeaponConfig) => {
    const weapon = new THREE.Group();
    
    const gunBody = new THREE.Mesh(
      new THREE.BoxGeometry(config.size.width, config.size.height, config.size.depth),
      new THREE.MeshStandardMaterial({ color: config.color, metalness: 0.8, roughness: 0.3 })
    );
    gunBody.position.set(0.15, -0.1, -0.3);
    
    const gunBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, config.barrelLength, 8),
      new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 })
    );
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0.15, -0.05, -(0.3 + config.barrelLength / 2));
    
    const gunHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.15, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    gunHandle.position.set(0.15, -0.2, -0.25);

    weapon.add(gunBody);
    weapon.add(gunBarrel);
    weapon.add(gunHandle);
    
    return weapon;
  };

  const switchWeapon = (weaponIndex: number) => {
    if (weaponIndex === currentWeapon || weaponIndex >= WEAPONS.length) return;
    
    const camera = cameraRef.current;
    if (!camera) return;

    if (weaponRef.current) {
      const oldWeapon = weaponRef.current;
      let animProgress = 0;
      const animInterval = setInterval(() => {
        animProgress += 0.1;
        oldWeapon.position.y = -0.5 * animProgress;
        if (animProgress >= 1) {
          clearInterval(animInterval);
          camera.remove(oldWeapon);
          
          const newWeapon = createWeaponModel(WEAPONS[weaponIndex]);
          newWeapon.position.y = -0.5;
          camera.add(newWeapon);
          weaponRef.current = newWeapon;
          
          let raiseProgress = 0;
          const raiseInterval = setInterval(() => {
            raiseProgress += 0.1;
            newWeapon.position.y = -0.5 + 0.5 * raiseProgress;
            if (raiseProgress >= 1) {
              clearInterval(raiseInterval);
            }
          }, 16);
        }
      }, 16);
    }
    
    setCurrentWeapon(weaponIndex);
    setAmmo(WEAPONS[weaponIndex].ammo);
  };

  useEffect(() => {
    if (!mountRef.current || !isPlaying) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1A1F2C);
    scene.fog = new THREE.Fog(0x1A1F2C, 10, 80);
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

    const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    scene.add(dirLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 150),
      new THREE.MeshStandardMaterial({ color: 0x2a2d3a, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(150, 75, 0x9b87f5, 0x444444);
    scene.add(gridHelper);

    for (let i = 0; i < 20; i++) {
      const width = 2 + Math.random() * 3;
      const height = 2 + Math.random() * 4;
      const depth = 2 + Math.random() * 3;
      
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ color: 0x7E69AB })
      );
      box.position.set(
        Math.random() * 60 - 30,
        height / 2,
        Math.random() * 60 - 30
      );
      box.castShadow = true;
      box.receiveShadow = true;
      scene.add(box);
    }

    for (let i = 0; i < 5; i++) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(10, 5, 1),
        new THREE.MeshStandardMaterial({ color: 0x6E59A5 })
      );
      wall.position.set(
        Math.random() * 50 - 25,
        2.5,
        Math.random() * 50 - 25
      );
      wall.rotation.y = Math.random() * Math.PI;
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);
    }

    const weapon = createWeaponModel(WEAPONS[currentWeapon]);
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
      
      if (e.code === 'Space' && ammo > 0 && canShoot) {
        shoot();
      }
      
      if (e.key === 'r' || e.key === 'к') {
        reload();
      }
      
      const weaponKeys = ['1', '2', '3'];
      const keyIndex = weaponKeys.indexOf(e.key);
      if (keyIndex !== -1) {
        switchWeapon(keyIndex);
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
      if (!canShoot) return;
      
      setAmmo(prev => Math.max(0, prev - 1));
      setCanShoot(false);
      
      setTimeout(() => setCanShoot(true), WEAPONS[currentWeapon].fireRate);
      
      if (weaponRef.current) {
        weaponRef.current.position.z += 0.15;
        weaponRef.current.rotation.x -= 0.1;
        setTimeout(() => {
          if (weaponRef.current) {
            weaponRef.current.position.z -= 0.15;
            weaponRef.current.rotation.x += 0.1;
          }
        }, 80);
      }

      const muzzleFlash = new THREE.PointLight(0xffa500, 3, 8);
      muzzleFlash.position.copy(camera.position);
      muzzleFlash.position.add(
        new THREE.Vector3(0.15, -0.05, -0.6).applyQuaternion(camera.quaternion)
      );
      scene.add(muzzleFlash);
      setTimeout(() => scene.remove(muzzleFlash), 50);

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      if (intersects.length > 0 && intersects[0].distance < 100) {
        const hitPoint = intersects[0].point;
        const hitMarker = new THREE.Mesh(
          new THREE.SphereGeometry(0.08),
          new THREE.MeshBasicMaterial({ color: 0xea384c })
        );
        hitMarker.position.copy(hitPoint);
        scene.add(hitMarker);
        setTimeout(() => scene.remove(hitMarker), 200);
      }
    };

    const reload = () => {
      setAmmo(WEAPONS[currentWeapon].ammo);
    };

    if (isMultiplayer) {
      for (let i = 0; i < 5; i++) {
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
          Math.random() * 20 - 10,
          0.9,
          Math.random() * 20 - 10
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

        const speed = keysRef.current.shift ? 12.0 : 7.0;

        if (keysRef.current.w || keysRef.current.s) {
          velocityRef.current.z -= directionRef.current.z * speed * delta;
        }
        if (keysRef.current.a || keysRef.current.d) {
          velocityRef.current.x -= directionRef.current.x * speed * delta;
        }

        controls.moveRight(-velocityRef.current.x * delta);
        controls.moveForward(-velocityRef.current.z * delta);

        const isMoving = keysRef.current.w || keysRef.current.s || keysRef.current.a || keysRef.current.d;
        
        if (isMoving && weaponRef.current) {
          bobPhaseRef.current += delta * 10;
          const bobAmount = 0.02;
          weaponRef.current.position.y = Math.sin(bobPhaseRef.current) * bobAmount;
          weaponRef.current.position.x = 0.15 + Math.cos(bobPhaseRef.current * 0.5) * bobAmount;
        } else if (weaponRef.current) {
          weaponRef.current.position.y *= 0.9;
          weaponRef.current.position.x = weaponRef.current.position.x * 0.9 + 0.15 * 0.1;
        }
      }

      playersRef.current.forEach((player) => {
        player.mesh.position.x += Math.sin(Date.now() * 0.001) * 0.03;
        player.mesh.position.z += Math.cos(Date.now() * 0.001) * 0.03;
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
  }, [isPlaying, isMultiplayer, ammo, currentWeapon, canShoot]);

  const startGame = (multiplayer: boolean) => {
    if (!username.trim()) return;
    setIsMultiplayer(multiplayer);
    setIsPlaying(true);
  };

  const reloadAmmo = () => {
    setAmmo(WEAPONS[currentWeapon].ammo);
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
            <p>1, 2, 3 - смена оружия | Мышь - прицеливание</p>
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
          <span>{ammo}/{WEAPONS[currentWeapon].ammo}</span>
        </div>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-6 h-6 border-2 border-[#9b87f5] rounded-full opacity-60">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-[#9b87f5] rounded-full" />
        </div>
      </div>

      <div className="absolute bottom-8 right-8 space-y-2">
        <Button
          onClick={reloadAmmo}
          className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white w-12 h-12"
        >
          <Icon name="RotateCw" size={20} />
        </Button>
        <Button
          onClick={() => {
            setIsPlaying(false);
            setHealth(100);
            setCurrentWeapon(0);
            setAmmo(WEAPONS[0].ammo);
          }}
          className="bg-[#ea384c] hover:bg-[#d32f3f] text-white w-12 h-12"
        >
          <Icon name="X" size={20} />
        </Button>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {WEAPONS.map((weapon, index) => (
          <button
            key={index}
            onClick={() => switchWeapon(index)}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              currentWeapon === index 
                ? 'bg-[#9b87f5] text-white scale-110' 
                : 'bg-black/50 text-gray-400 hover:bg-black/70'
            }`}
          >
            {index + 1}. {weapon.name}
          </button>
        ))}
      </div>

      <div className="absolute top-8 left-8 text-white font-bold text-lg bg-black/50 px-4 py-2 rounded-lg pointer-events-none">
        {username}
      </div>
    </div>
  );
};

export default Index;
