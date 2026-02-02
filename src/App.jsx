import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* ===================== CONSTANTS ===================== */
const PLAYER_CAPACITY = 5;
const PLAYER_MAX_HP = 10;

const PLAYER_MAX_SPEED = 0.2;
const PLAYER_ACCELERATION = 0.008;
const PLAYER_FRICTION = 0.92;
const PLAYER_TURN_SPEED = 0.045;
const PLAYER_TURN_FRICTION = 0.77; // Turn inertia friction
const PLAYER_COLLISION_RADIUS = 1.5;
const OBSTACLE_COLLISION_RADIUS = 1.0;

// Special zones
const SPEED_ZONE_COUNT = 3;
const SLOW_ZONE_COUNT = 3;
const ZONE_RADIUS = 3;

const TOTAL_TRASH = 12;
const OBSTACLE_COUNT = 6;
const OBSTACLE_DAMAGE_COOLDOWN = 1000;

const AUTO_PICKUP_DISTANCE = 1.2;
const STORAGE_ZONE_RADIUS = 4;

const GAME_TIME = 60;
const REQUIRED_PERCENTAGE = 80;

/* ===================== UTILS ===================== */
const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);

/* ===================== COMPONENT ===================== */
export default function RecycleGame() {
  const navigate = useNavigate();
  const containerRef = useRef();
  const gameRef = useRef({});

  const [inventoryCount, setInventoryCount] = useState(0);
  const [recycledCount, setRecycledCount] = useState(0);
  const [hp, setHp] = useState(PLAYER_MAX_HP);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [hudPulse, setHudPulse] = useState(false);
  const [damageFlash, setDamageFlash] = useState(false);
  const [screenShake, setScreenShake] = useState({ x: 0, y: 0 });
  const [inventoryFull, setInventoryFull] = useState(false);
  const [currentZone, setCurrentZone] = useState(null); // 'speed' | 'slow' | null

  /* ===================== INIT ===================== */
  useEffect(() => {
    setIsMobile(isMobileDevice());

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa7f3d0);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    /* ===== OCEAN GROUND ===== */
    const gltfLoaderGround = new GLTFLoader();
    let oceanModel = null;
    
    gltfLoaderGround.load(
      '/asset/ocean__water_perfect_loop.glb',
      (gltf) => {
        oceanModel = gltf.scene;
        
        // Scale ocean to fit game area (adjust as needed)
        oceanModel.scale.set(0.5, 0.5, 0.5);
        oceanModel.position.set(0, -0.3, 0);
        
        // Enable shadows
        oceanModel.traverse((child) => {
          if (child.isMesh) {
            child.receiveShadow = true;
          }
        });
        
        scene.add(oceanModel);
        
        // Store reference for animation
        state.oceanModel = oceanModel;
        
        // Check for animation mixer
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(oceanModel);
          gltf.animations.forEach((clip) => {
            mixer.clipAction(clip).play();
          });
          state.oceanMixer = mixer;
        }
      },
      (progress) => {
        console.log('Loading ocean...', (progress.loaded / progress.total * 100) + '%');
      },
      (error) => {
        console.error('Error loading ocean:', error);
        // Fallback to simple plane if model fails
        const fallbackGround = new THREE.Mesh(
          new THREE.PlaneGeometry(100, 100),
          new THREE.MeshStandardMaterial({ color: 0x0ea5e9 })
        );
        fallbackGround.rotation.x = -Math.PI / 2;
        scene.add(fallbackGround);
      }
    );

    // Add a darker underwater plane for depth effect
    const underwaterPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ 
        color: 0x0c4a6e,
        transparent: true,
        opacity: 0.8
      })
    );
    underwaterPlane.rotation.x = -Math.PI / 2;
    underwaterPlane.position.y = -2;
    scene.add(underwaterPlane);

    // Change background to sky blue
    scene.background = new THREE.Color(0x7dd3fc);

    /* ===== PLAYER ===== */
    const player = new THREE.Group();
    scene.add(player);

    const makeMesh = (geo, color) =>
      new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));

    // Load 3D model for player
    const gltfLoader = new GLTFLoader();
    let playerModel = null;
    
    gltfLoader.load(
      '/asset/fishing_boat_low_poly_style.glb',
      (gltf) => {
        playerModel = gltf.scene;
        
        // Scale and position the model
        playerModel.scale.set(0.8, 0.8, 0.8); // Adjust scale as needed
        playerModel.position.y = 0.5; // Adjust height
        playerModel.rotation.y = Math.PI * 3 / 2; // Face forward
        
        // Enable shadows for the model
        playerModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        player.add(playerModel);
        
        // Store reference for hit flash effect
        state.playerModel = playerModel;
      },
      (progress) => {
        console.log('Loading model...', (progress.loaded / progress.total * 100) + '%');
      },
      (error) => {
        console.error('Error loading model:', error);
        // Fallback to simple mesh if model fails to load
        const fallbackBody = makeMesh(
          new THREE.CylinderGeometry(0.4, 0.5, 1.4, 8),
          0x2563eb
        );
        fallbackBody.position.y = 1;
        player.add(fallbackBody);
      }
    );

    /* ===== STORAGE ===== */
    const storage = makeMesh(new THREE.CylinderGeometry(2, 2, 1, 32), 0x22c55e);
    storage.position.set(0, 0.5, -15);
    scene.add(storage);

    /* ===== TRASH ===== */
    const trash = [];
    for (let i = 0; i < TOTAL_TRASH; i++) {
      const t = makeMesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), 0xfacc15);
      t.position.set(
        (Math.random() - 0.5) * 30,
        0.3,
        (Math.random() - 0.5) * 30
      );
      trash.push(t);
      scene.add(t);
    }

    /* ===== OBSTACLES ===== */
    const obstacles = [];
    const minDistFromPlayer = 5; // Minimum distance from player start
    const minDistBetweenObstacles = 4; // Minimum distance between obstacles
    
    for (let i = 0; i < OBSTACLE_COUNT; i++) {
      const o = makeMesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), 0x991b1b);
      
      let validPosition = false;
      let attempts = 0;
      
      while (!validPosition && attempts < 50) {
        const x = (Math.random() - 0.5) * 25;
        const z = (Math.random() - 0.5) * 25;
        
        // Check distance from player start (0, 0)
        const distFromPlayer = Math.sqrt(x * x + z * z);
        
        // Check distance from storage zone
        const distFromStorage = Math.sqrt(x * x + (z - (-15)) * (z - (-15)));
        
        if (distFromPlayer > minDistFromPlayer && distFromStorage > 6) {
          // Check distance from other obstacles
          let tooClose = false;
          for (const existingObs of obstacles) {
            const dx = x - existingObs.position.x;
            const dz = z - existingObs.position.z;
            if (Math.sqrt(dx * dx + dz * dz) < minDistBetweenObstacles) {
              tooClose = true;
              break;
            }
          }
          
          if (!tooClose) {
            o.position.set(x, 0.75, z);
            validPosition = true;
          }
        }
        attempts++;
      }
      
      // Fallback if no valid position found
      if (!validPosition) {
        o.position.set(
          (Math.random() - 0.5) * 25,
          0.75,
          (Math.random() - 0.5) * 25
        );
      }
      
      obstacles.push(o);
      scene.add(o);
    }

    /* ===== SPECIAL ZONES ===== */
    const speedZones = [];
    const slowZones = [];
    const allZonePositions = []; // Track all zone positions to prevent overlap
    const MIN_ZONE_DISTANCE = ZONE_RADIUS * 2.5; // Minimum distance between zones

    // Helper function to find valid zone position
    const findValidZonePosition = () => {
      let attempts = 0;
      while (attempts < 100) {
        const x = (Math.random() - 0.5) * 35;
        const z = (Math.random() - 0.5) * 35;
        
        // Check distance from player start
        const distFromPlayer = Math.sqrt(x * x + z * z);
        if (distFromPlayer < 8) {
          attempts++;
          continue;
        }
        
        // Check distance from storage
        const distFromStorage = Math.sqrt(x * x + (z + 15) * (z + 15));
        if (distFromStorage < 8) {
          attempts++;
          continue;
        }
        
        // Check distance from obstacles
        let tooCloseToObstacle = false;
        for (const obs of obstacles) {
          const dx = x - obs.position.x;
          const dz = z - obs.position.z;
          if (Math.sqrt(dx * dx + dz * dz) < ZONE_RADIUS + 2) {
            tooCloseToObstacle = true;
            break;
          }
        }
        if (tooCloseToObstacle) {
          attempts++;
          continue;
        }
        
        // Check distance from other zones
        let tooCloseToZone = false;
        for (const pos of allZonePositions) {
          const dx = x - pos.x;
          const dz = z - pos.z;
          if (Math.sqrt(dx * dx + dz * dz) < MIN_ZONE_DISTANCE) {
            tooCloseToZone = true;
            break;
          }
        }
        if (tooCloseToZone) {
          attempts++;
          continue;
        }
        
        return { x, z };
      }
      return null; // Could not find valid position
    };

    // Create speed boost zones (blue/cyan)
    for (let i = 0; i < SPEED_ZONE_COUNT; i++) {
      const position = findValidZonePosition();
      if (!position) continue; // Skip if no valid position found
      
      const { x, z } = position;
      allZonePositions.push({ x, z });
      
      const zoneGeo = new THREE.CylinderGeometry(ZONE_RADIUS, ZONE_RADIUS, 0.1, 32);
      const zoneMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4, // Cyan
        transparent: true,
        opacity: 0.4,
      });
      const zone = new THREE.Mesh(zoneGeo, zoneMat);
      
      zone.position.set(x, 0.05, z);
      zone.userData.type = 'speed';
      zone.userData.multiplier = 1.8; // 80% faster
      speedZones.push(zone);
      scene.add(zone);

      // Add glow ring effect
      const ringGeo = new THREE.RingGeometry(ZONE_RADIUS - 0.1, ZONE_RADIUS, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.06, z);
      scene.add(ring);

      // Add arrow indicator
      const arrowGeo = new THREE.ConeGeometry(0.3, 0.6, 4);
      const arrowMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4 });
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.position.set(x, 0.5, z);
      arrow.rotation.z = Math.PI; // Point up
      zone.userData.arrow = arrow;
      scene.add(arrow);
    }

    // Create slow zones (orange/mud)
    for (let i = 0; i < SLOW_ZONE_COUNT; i++) {
      const position = findValidZonePosition();
      if (!position) continue; // Skip if no valid position found
      
      const { x, z } = position;
      allZonePositions.push({ x, z });
      
      const zoneGeo = new THREE.CylinderGeometry(ZONE_RADIUS, ZONE_RADIUS, 0.15, 32);
      const zoneMat = new THREE.MeshStandardMaterial({
        color: 0x92400e, // Brown/mud
        transparent: true,
        opacity: 0.5,
      });
      const zone = new THREE.Mesh(zoneGeo, zoneMat);
      
      zone.position.set(x, 0.08, z);
      zone.userData.type = 'slow';
      zone.userData.multiplier = 0.4; // 60% slower
      slowZones.push(zone);
      scene.add(zone);

      // Add warning ring
      const ringGeo = new THREE.RingGeometry(ZONE_RADIUS - 0.1, ZONE_RADIUS, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.09, z);
      scene.add(ring);

      // Add slow icon (waves)
      const iconGeo = new THREE.TorusGeometry(0.4, 0.08, 8, 16);
      const iconMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24 });
      const icon = new THREE.Mesh(iconGeo, iconMat);
      icon.position.set(x, 0.4, z);
      icon.rotation.x = Math.PI / 2;
      zone.userData.icon = icon;
      scene.add(icon);
    }

    const allZones = [...speedZones, ...slowZones];

    const state = {
      scene,
      camera,
      renderer,
      player,
      storage,
      trash,
      obstacles,
      allZones,
      speedZones,
      slowZones,
      inventory: [],
      velocity: new THREE.Vector3(),
      angularVelocity: 0, // For turn inertia
      keys: {},
      joystick: { x: 0, y: 0 },
      lastDamageTime: 0,
      hitTime: 0,
      animationId: null,
      timerId: null,
      stopped: false,
      fallingItems: [],
      scatteredItems: [], // Items scattered when hit
      recycledInStorage: 0,
      speedMultiplier: 1,
      lastInventoryFullWarning: 0,
    };
    gameRef.current = state;

    const down = (e) => (state.keys[e.key.toLowerCase()] = true);
    const up = (e) => (state.keys[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    state.timerId = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          endGame("timeout");
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    const endGame = (reason) => {
      state.stopped = true;
      cancelAnimationFrame(state.animationId);
      clearInterval(state.timerId);

      setGameOver(true);

      if (reason === "win") {
        setMessage("🎉 Hoàn thành! Đã thu gom hết rác!");
      } else if (reason === "timeout") {
        setMessage(
          `⏰ Hết giờ! Đã gom được ${state.recycledInStorage}/${TOTAL_TRASH} rác vào kho`
        );
      } else {
        setMessage("💀 Va chạm vật cản – Hết mạng!");
      }
    };

    const clock = new THREE.Clock();

    const animate = () => {
      if (state.stopped) return;

      const delta = clock.getDelta();

      // Update ocean animation
      if (state.oceanMixer) {
        state.oceanMixer.update(delta);
      }

      const isMobileMode = isMobileDevice();

      let turnInput = 0;
      let move = 0;

      /* ===== CHECK SPECIAL ZONES ===== */
      let inZone = null;
      state.speedMultiplier = 1;

      for (const zone of state.allZones) {
        const dx = player.position.x - zone.position.x;
        const dz = player.position.z - zone.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < ZONE_RADIUS) {
          inZone = zone.userData.type;
          state.speedMultiplier = zone.userData.multiplier;

          // Animate zone indicators
          if (zone.userData.arrow) {
            zone.userData.arrow.position.y = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
            zone.userData.arrow.rotation.y += 0.05;
          }
          if (zone.userData.icon) {
            zone.userData.icon.rotation.z += 0.03;
          }
          break;
        }
      }

      setCurrentZone(inZone);

      // Animate all zone indicators
      for (const zone of state.allZones) {
        if (zone.userData.arrow) {
          zone.userData.arrow.rotation.y += 0.02;
        }
        if (zone.userData.icon) {
          zone.userData.icon.rotation.z += 0.01;
        }
      }

      if (isMobileMode) {
        const joyX = state.joystick.x;
        const joyY = state.joystick.y;

        if (Math.abs(joyX) > 0.1) {
          turnInput = -joyX;
        }

        if (Math.abs(joyY) > 0.1) {
          move = joyY;
        }
      } else {
        turnInput = (state.keys["a"] ? 1 : 0) - (state.keys["d"] ? 1 : 0);
        move = (state.keys["s"] ? 1 : 0) - (state.keys["w"] ? 1 : 0);
      }

      /* ===== TURN WITH INERTIA ===== */
      // Apply turn input to angular velocity
      state.angularVelocity += turnInput * PLAYER_TURN_SPEED * 0.3;

      // Apply friction to angular velocity (creates turn inertia)
      state.angularVelocity *= PLAYER_TURN_FRICTION;

      // Stop completely if very slow
      if (Math.abs(state.angularVelocity) < 0.001) {
        state.angularVelocity = 0;
      }

      // Apply angular velocity to rotation
      player.rotation.y += state.angularVelocity;

      const forward = new THREE.Vector3(
        Math.sin(player.rotation.y),
        0,
        Math.cos(player.rotation.y)
      );

      // Apply acceleration based on input (affected by zone)
      const effectiveAccel = PLAYER_ACCELERATION * state.speedMultiplier;
      if (Math.abs(move) > 0.01) {
        state.velocity.add(forward.clone().multiplyScalar(move * effectiveAccel));
      }

      // Apply friction (creates inertia effect - player slides when stopping)
      // Slow zones have more friction
      const effectiveFriction = inZone === 'slow' ? PLAYER_FRICTION * 0.95 : PLAYER_FRICTION;
      state.velocity.multiplyScalar(effectiveFriction);

      // Clamp max speed (affected by zone)
      const effectiveMaxSpeed = PLAYER_MAX_SPEED * state.speedMultiplier;
      if (state.velocity.length() > effectiveMaxSpeed) {
        state.velocity.setLength(effectiveMaxSpeed);
      }

      // Stop completely if very slow
      if (state.velocity.length() < 0.001) {
        state.velocity.set(0, 0, 0);
      }

      // Calculate next position before applying
      const nextPosition = player.position.clone().add(state.velocity);

      /* ===== COLLISION ===== */
      let collided = false;
      const combinedRadius = PLAYER_COLLISION_RADIUS + OBSTACLE_COLLISION_RADIUS;

      for (const o of obstacles) {
        const diff = nextPosition.clone().sub(o.position);
        diff.y = 0; // Only check horizontal distance
        const distance = diff.length();

        if (distance < combinedRadius) {
          collided = true;
          
          // Calculate push direction (away from obstacle)
          const pushDir = diff.clone().normalize();
          const penetration = combinedRadius - distance;

          // Push player out of obstacle
          nextPosition.add(pushDir.clone().multiplyScalar(penetration + 0.05));

          // Reflect velocity off the obstacle surface
          const velocityDot = state.velocity.dot(pushDir);
          if (velocityDot < 0) {
            // Remove velocity component going into obstacle
            state.velocity.sub(pushDir.clone().multiplyScalar(velocityDot * 1.5));
          }
          
          // Add bounce effect
          state.velocity.add(pushDir.clone().multiplyScalar(0.05));

          // Apply damage with cooldown
          const now = Date.now();
          if (now - state.lastDamageTime > OBSTACLE_DAMAGE_COOLDOWN) {
            state.lastDamageTime = now;
            state.hitTime = now;

            // Damage flash effect
            setDamageFlash(true);
            setTimeout(() => setDamageFlash(false), 200);

            // Screen shake effect
            const shakeIntensity = 8;
            const shakeInterval = setInterval(() => {
              setScreenShake({
                x: (Math.random() - 0.5) * shakeIntensity,
                y: (Math.random() - 0.5) * shakeIntensity,
              });
            }, 30);
            setTimeout(() => {
              clearInterval(shakeInterval);
              setScreenShake({ x: 0, y: 0 });
            }, 300);

            setHudPulse(true);
            setTimeout(() => setHudPulse(false), 150);

            // Drop all items from inventory
            if (state.inventory.length > 0) {
              const playerWorldPos = new THREE.Vector3();
              player.getWorldPosition(playerWorldPos);

              state.inventory.forEach((item, idx) => {
                player.remove(item);
                scene.add(item);

                // Set initial position at player
                item.position.copy(playerWorldPos);
                item.position.y = 1.5 + idx * 0.2;

                // Calculate scatter direction (away from obstacle)
                const scatterAngle = Math.random() * Math.PI * 2;
                const scatterSpeed = 0.15 + Math.random() * 0.1;
                const scatterDir = new THREE.Vector3(
                  Math.cos(scatterAngle) * scatterSpeed,
                  0.08 + Math.random() * 0.05, // Upward velocity
                  Math.sin(scatterAngle) * scatterSpeed
                );

                state.scatteredItems.push({
                  mesh: item,
                  velocity: scatterDir,
                  startTime: Date.now(),
                  bounces: 0,
                });

                // Add back to trash array so player can pick up again
                state.trash.push(item);
              });

              state.inventory = [];
              setInventoryCount(0);
            }

            setHp((hp) => {
              if (hp <= 1) {
                endGame("death");
                return 0;
              }
              return hp - 1;
            });
          }
        }
      }

      // Apply final position after collision resolution
      player.position.copy(nextPosition);

      /* ===== HIT FLASH ===== */
      const isHit = Date.now() - state.hitTime < 200;
      player.traverse((o) => {
        if (o.isMesh && o.material) {
          // Clone material if needed to avoid affecting original
          if (!o.userData.originalMaterial) {
            o.userData.originalMaterial = o.material.clone();
          }
          
          if (isHit) {
            o.material.transparent = true;
            o.material.opacity = 0.5;
            // Add red tint for damage effect
            if (o.material.color) {
              o.material.emissive = new THREE.Color(0xff0000);
              o.material.emissiveIntensity = 0.5;
            }
          } else {
            o.material.transparent = false;
            o.material.opacity = 1;
            if (o.material.emissive) {
              o.material.emissiveIntensity = 0;
            }
          }
        }
      });

      /* ===== AUTO PICKUP ===== */
      state.trash = state.trash.filter((t) => {
        const wp = new THREE.Vector3();
        t.getWorldPosition(wp);
        if (wp.distanceTo(player.position) < AUTO_PICKUP_DISTANCE) {
          if (state.inventory.length >= PLAYER_CAPACITY) {
            // Show inventory full warning (with cooldown)
            const now = Date.now();
            if (now - state.lastInventoryFullWarning > 500) {
              state.lastInventoryFullWarning = now;
              setInventoryFull(true);
              setTimeout(() => setInventoryFull(false), 800);
            }
            return true;
          }
          state.inventory.push(t);
          scene.remove(t);
          player.add(t);
          t.position.set(0, 0.8 + state.inventory.length * 0.25, -0.4);
          setInventoryCount(state.inventory.length);
          setInventoryFull(false); // Clear warning if was showing
          setHudPulse(true);
          setTimeout(() => setHudPulse(false), 150);
          return false;
        }
        return true;
      });

      /* ===== STORAGE ===== */
      if (
        player.position.distanceTo(storage.position) < STORAGE_ZONE_RADIUS &&
        state.inventory.length
      ) {
        const count = state.inventory.length;

        state.inventory.forEach((t, idx) => {
          player.remove(t);
          scene.add(t);

          const worldPos = new THREE.Vector3();
          player.getWorldPosition(worldPos);
          t.position.copy(worldPos);
          t.position.y = 2 + idx * 0.3;

          state.fallingItems.push({
            mesh: t,
            startY: t.position.y,
            targetY: storage.position.y + 0.5,
            startTime: Date.now(),
            duration: 500 + idx * 100,
          });
        });

        state.inventory = [];
        setInventoryCount(0);

        state.recycledInStorage += count;
        setRecycledCount(state.recycledInStorage);

        if (state.recycledInStorage >= TOTAL_TRASH) {
          setTimeout(() => {
            endGame("win");
          }, 800);
        }

        setHudPulse(true);
        setTimeout(() => setHudPulse(false), 200);
      }

      /* ===== Animate falling items ===== */
      const now = Date.now();
      state.fallingItems = state.fallingItems.filter((item) => {
        const elapsed = now - item.startTime;
        const progress = Math.min(elapsed / item.duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        item.mesh.position.y = THREE.MathUtils.lerp(
          item.startY,
          item.targetY,
          easeProgress
        );

        item.mesh.rotation.y += 0.1;

        if (progress >= 1) {
          scene.remove(item.mesh);
          return false;
        }
        return true;
      });

      /* ===== Animate scattered items ===== */
      const GRAVITY = 0.008;
      const GROUND_Y = 0.3;
      const SCATTER_DURATION = 2000; // 2 seconds max

      state.scatteredItems = state.scatteredItems.filter((item) => {
        const elapsed = now - item.startTime;

        // Apply gravity
        item.velocity.y -= GRAVITY;

        // Update position
        item.mesh.position.add(item.velocity);

        // Rotate while flying
        item.mesh.rotation.x += 0.15;
        item.mesh.rotation.z += 0.1;

        // Bounce off ground
        if (item.mesh.position.y < GROUND_Y) {
          item.mesh.position.y = GROUND_Y;
          item.velocity.y *= -0.4; // Bounce with energy loss
          item.velocity.x *= 0.7; // Friction
          item.velocity.z *= 0.7;
          item.bounces++;
        }

        // Stop animation after duration or multiple bounces
        if (elapsed > SCATTER_DURATION || item.bounces > 3) {
          // Settle on ground
          item.mesh.position.y = GROUND_Y;
          item.mesh.rotation.x = 0;
          item.mesh.rotation.z = 0;
          return false;
        }

        return true;
      });

      const camOffset = new THREE.Vector3(0, 4, 8).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        player.rotation.y
      );
      camera.position.copy(player.position.clone().add(camOffset));
      camera.lookAt(player.position.x, 1.5, player.position.z);

      renderer.render(scene, camera);
      state.animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      clearInterval(state.timerId);
      cancelAnimationFrame(state.animationId);
    };
  }, []);

  /* ===================== MOBILE JOYSTICK ===================== */
  const handleJoystick = (e, start) => {
    const joy = gameRef.current.joystick;
    if (!e.touches) return;
    const t = e.touches[0];
    if (start) {
      joy.startX = t.clientX;
      joy.startY = t.clientY;
    } else {
      joy.x = THREE.MathUtils.clamp((t.clientX - joy.startX) / 50, -1, 1);
      joy.y = THREE.MathUtils.clamp((t.clientY - joy.startY) / 50, -1, 1);
    }
  };

  const resetJoystick = () => {
    gameRef.current.joystick.x = 0;
    gameRef.current.joystick.y = 0;
  };

  const progressPercent = (recycledCount / TOTAL_TRASH) * 100;
  const requiredTrash = Math.ceil((REQUIRED_PERCENTAGE / 100) * TOTAL_TRASH); // 10 rác
  const canProceed = recycledCount >= requiredTrash;

  const handleGameOverAction = () => {
    if (message.includes("Hoàn thành") || canProceed) {
      navigate("/sorting");
      window.location.reload();
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Damage Flash Overlay */}
      {damageFlash && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle, transparent 30%, rgba(255, 0, 0, 0.6) 100%)",
            pointerEvents: "none",
            zIndex: 100,
            animation: "pulse 0.2s ease-out",
          }}
        />
      )}

      {/* Zone Indicator */}
      {currentZone && (
        <div
          style={{
            position: "absolute",
            bottom: 150,
            left: "50%",
            transform: "translateX(-50%)",
            background: currentZone === 'speed' 
              ? "linear-gradient(135deg, rgba(6, 182, 212, 0.9), rgba(34, 211, 238, 0.9))"
              : "linear-gradient(135deg, rgba(146, 64, 14, 0.9), rgba(251, 191, 36, 0.9))",
            color: "white",
            padding: "12px 24px",
            borderRadius: 12,
            fontSize: 18,
            fontWeight: "bold",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            border: "2px solid rgba(255,255,255,0.4)",
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {currentZone === 'speed' ? (
            <>
              <span style={{ fontSize: 24 }}>⚡</span>
              <span>Tăng tốc!</span>
              <span style={{ fontSize: 14, opacity: 0.9 }}>+80%</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 24 }}>🐌</span>
              <span>Vùng lầy!</span>
              <span style={{ fontSize: 14, opacity: 0.9 }}>-60%</span>
            </>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          transform: `translate(${screenShake.x}px, ${screenShake.y}px)`,
          transition: screenShake.x === 0 ? "transform 0.1s ease-out" : "none",
        }}
      />

      {/* HUD */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: "50%",
          transform: `translateX(-50%) ${
            hudPulse ? "scale(1.08)" : "scale(1)"
          }`,
          transition: "transform 0.15s ease",
          background: inventoryFull
            ? "linear-gradient(135deg, rgba(185, 28, 28, 0.95), rgba(239, 68, 68, 0.95))"
            : "linear-gradient(135deg, rgba(20, 83, 45, 0.95), rgba(34, 197, 94, 0.95))",
          color: "white",
          padding: "16px 32px",
          borderRadius: 20,
          boxShadow: inventoryFull
            ? "0 0 20px rgba(239, 68, 68, 0.8), 0 0 40px rgba(239, 68, 68, 0.4)"
            : "0 8px 32px rgba(0,0,0,0.3)",
          border: inventoryFull
            ? "3px solid rgba(255, 100, 100, 0.9)"
            : "3px solid rgba(255,255,255,0.3)",
          minWidth: 320,
          textAlign: "center",
          animation: inventoryFull ? "inventoryFullPulse 0.3s ease-in-out infinite" : "none",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-around",
            marginBottom: 12,
            fontSize: 18,
            fontWeight: "bold",
          }}
        >
          <div>
            ❤️ {hp}/{PLAYER_MAX_HP}
          </div>
          <div style={{
            color: inventoryFull ? "#fca5a5" : "white",
            animation: inventoryFull ? "textBlink 0.4s ease-in-out infinite" : "none",
          }}>
            {inventoryFull ? "🎒❌" : "🎒"} {inventoryCount}/{PLAYER_CAPACITY}
            {inventoryFull && <span style={{ fontSize: 12, marginLeft: 4 }}>ĐẦY!</span>}
          </div>
          <div>⏱️ {timeLeft}s</div>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 14, marginBottom: 6, opacity: 0.9 }}>
            🗑️ Đã gom vào kho: {recycledCount}/{TOTAL_TRASH}
          </div>
          <div
            style={{
              width: "100%",
              height: 24,
              background: "rgba(0,0,0,0.3)",
              borderRadius: 12,
              overflow: "hidden",
              border: "2px solid rgba(255,255,255,0.4)",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "linear-gradient(90deg, #fbbf24, #facc15, #fde047)",
                transition: "width 0.3s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: "bold",
                color: "#000",
              }}
            >
              {progressPercent > 15 && `${Math.round(progressPercent)}%`}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Joystick */}
      {isMobile && (
        <div
          onTouchStart={(e) => handleJoystick(e, true)}
          onTouchMove={(e) => handleJoystick(e)}
          onTouchEnd={resetJoystick}
          style={{
            position: "absolute",
            bottom: 30,
            left: 30,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            border: "3px solid rgba(255,255,255,0.5)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.6)",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
      )}

      {/* Game Over Screen */}
      {gameOver && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            color: "white",
            padding: 20,
          }}
        >
          <h1
            style={{
              fontSize: 48,
              marginBottom: 20,
              textShadow: "0 4px 16px rgba(0,0,0,0.5)",
              textAlign: "center",
            }}
          >
            {message}
          </h1>

          {/* Thông báo điều kiện */}
          {!message.includes("Hoàn thành") && (
            <div
              style={{
                background: canProceed
                  ? "rgba(34, 197, 94, 0.2)"
                  : "rgba(239, 68, 68, 0.2)",
                border: canProceed ? "2px solid #22c55e" : "2px solid #ef4444",
                borderRadius: 16,
                padding: 24,
                marginBottom: 24,
                maxWidth: 500,
              }}
            >
              <div
                style={{ fontSize: 20, marginBottom: 12, fontWeight: "bold" }}
              >
                {canProceed
                  ? "✅ Đủ điều kiện qua màn!"
                  : "❌ Chưa đủ điều kiện"}
              </div>
              <div style={{ fontSize: 16, opacity: 0.9 }}>
                Cần thu gom ít nhất{" "}
                <span style={{ fontWeight: "bold", color: "#fbbf24" }}>
                  {requiredTrash}/{TOTAL_TRASH}
                </span>{" "}
                rác vào kho (≥{REQUIRED_PERCENTAGE}%)
              </div>
              <div style={{ fontSize: 16, marginTop: 8 }}>
                Bạn đã gom vào kho:{" "}
                <span
                  style={{
                    fontWeight: "bold",
                    color: canProceed ? "#22c55e" : "#ef4444",
                  }}
                >
                  {recycledCount}/{TOTAL_TRASH}
                </span>{" "}
                rác
              </div>
            </div>
          )}

          <button
            onClick={handleGameOverAction}
            style={{
              padding: "16px 48px",
              fontSize: 24,
              background:
                message.includes("Hoàn thành") || canProceed
                  ? "linear-gradient(135deg, #22c55e, #16a34a)"
                  : "linear-gradient(135deg, #ef4444, #dc2626)",
              color: "white",
              border: "none",
              borderRadius: 12,
              cursor: "pointer",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              fontWeight: "bold",
            }}
          >
            {message.includes("Hoàn thành") || canProceed
              ? "➡️ Sang màn phân loại"
              : "🔁 Chơi lại"}
          </button>
        </div>
      )}
    </div>
  );
}
