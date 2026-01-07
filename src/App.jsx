import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as THREE from "three";

/* ===================== CONSTANTS ===================== */
const PLAYER_CAPACITY = 5;
const PLAYER_MAX_HP = 3;

const PLAYER_MAX_SPEED = 0.25;
const PLAYER_ACCELERATION = 0.012;
const PLAYER_FRICTION = 0.9;
const PLAYER_TURN_SPEED = 0.045;

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

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x86efac })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    /* ===== PLAYER ===== */
    const player = new THREE.Group();

    const makeMesh = (geo, color) =>
      new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));

    const body = makeMesh(
      new THREE.CylinderGeometry(0.4, 0.5, 1.4, 8),
      0x2563eb
    );
    body.position.y = 1;

    const head = makeMesh(new THREE.SphereGeometry(0.35, 16, 16), 0xfcd34d);
    head.position.y = 2;

    const backpack = makeMesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), 0x14532d);
    backpack.position.set(0, 1.1, -0.45);

    const nose = makeMesh(new THREE.ConeGeometry(0.15, 0.4, 8), 0xdc2626);
    nose.position.set(0, 1.2, 0.6);
    nose.rotation.x = Math.PI / 2;

    player.add(body, head, backpack, nose);
    scene.add(player);

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
    for (let i = 0; i < OBSTACLE_COUNT; i++) {
      const o = makeMesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), 0x991b1b);
      o.position.set(
        (Math.random() - 0.5) * 25,
        0.75,
        (Math.random() - 0.5) * 25
      );
      obstacles.push(o);
      scene.add(o);
    }

    const state = {
      scene,
      camera,
      renderer,
      player,
      storage,
      trash,
      obstacles,
      inventory: [],
      velocity: new THREE.Vector3(),
      keys: {},
      joystick: { x: 0, y: 0 },
      lastDamageTime: 0,
      hitTime: 0,
      animationId: null,
      timerId: null,
      stopped: false,
      fallingItems: [],
      recycledInStorage: 0,
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

    const animate = () => {
      if (state.stopped) return;

      const isMobileMode = isMobileDevice();

      let turn = 0;
      let move = 0;

      if (isMobileMode) {
        const joyX = state.joystick.x;
        const joyY = state.joystick.y;

        if (Math.abs(joyX) > 0.1) {
          player.rotation.y -= joyX * PLAYER_TURN_SPEED * 2;
        }

        if (Math.abs(joyY) > 0.1) {
          move = joyY;
        }
      } else {
        turn = (state.keys["a"] ? 1 : 0) - (state.keys["d"] ? 1 : 0);
        move = (state.keys["s"] ? 1 : 0) - (state.keys["w"] ? 1 : 0);
        player.rotation.y += turn * PLAYER_TURN_SPEED;
      }

      const forward = new THREE.Vector3(
        Math.sin(player.rotation.y),
        0,
        Math.cos(player.rotation.y)
      );

      state.velocity.add(forward.multiplyScalar(move * PLAYER_ACCELERATION));

      if (state.velocity.length() > PLAYER_MAX_SPEED)
        state.velocity.setLength(PLAYER_MAX_SPEED);

      state.velocity.multiplyScalar(PLAYER_FRICTION);

      player.position.add(state.velocity);

      /* ===== COLLISION ===== */
      const COLLISION_RADIUS = 1.4;

      for (const o of obstacles) {
        const diff = player.position.clone().sub(o.position);
        const distance = diff.length();

        if (distance < COLLISION_RADIUS) {
          const normal = diff.normalize();
          const penetration = COLLISION_RADIUS - distance;

          player.position.add(normal.multiplyScalar(penetration + 0.01));

          const vDot = state.velocity.dot(normal);
          if (vDot < 0) {
            state.velocity.sub(normal.multiplyScalar(vDot));
          }

          state.velocity.add(normal.multiplyScalar(0.08));

          const now = Date.now();
          if (now - state.lastDamageTime > OBSTACLE_DAMAGE_COOLDOWN) {
            state.lastDamageTime = now;
            state.hitTime = now;

            setHudPulse(true);
            setTimeout(() => setHudPulse(false), 150);

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

      /* ===== HIT FLASH ===== */
      player.traverse((o) => {
        if (o.isMesh) {
          o.material.transparent = Date.now() - state.hitTime < 200;
          o.material.opacity = o.material.transparent ? 0.5 : 1;
        }
      });

      /* ===== AUTO PICKUP ===== */
      state.trash = state.trash.filter((t) => {
        const wp = new THREE.Vector3();
        t.getWorldPosition(wp);
        if (wp.distanceTo(player.position) < AUTO_PICKUP_DISTANCE) {
          if (state.inventory.length >= PLAYER_CAPACITY) return true;
          state.inventory.push(t);
          scene.remove(t);
          player.add(t);
          t.position.set(0, 0.8 + state.inventory.length * 0.25, -0.4);
          setInventoryCount(state.inventory.length);
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
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

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
          background:
            "linear-gradient(135deg, rgba(20, 83, 45, 0.95), rgba(34, 197, 94, 0.95))",
          color: "white",
          padding: "16px 32px",
          borderRadius: 20,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          border: "3px solid rgba(255,255,255,0.3)",
          minWidth: 320,
          textAlign: "center",
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
          <div>
            🎒 {inventoryCount}/{PLAYER_CAPACITY}
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
