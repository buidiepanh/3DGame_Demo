import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const TrashSortingGame3D = () => {
  const containerRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const gameStateRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    player: null,
    trash: [],
    bins: [],
    holding: null,
    keys: {},
    moveSpeed: 0.15,
    animationId: null
  });

  useEffect(() => {
    if (!containerRef.current || gameOver) return;

    try {
      const state = gameStateRef.current;
      
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
      
      // Reset state
      state.trash = [];
      state.bins = [];
      state.holding = null;
      state.keys = {};
      
      // Scene setup
      state.scene = new THREE.Scene();
      state.scene.background = new THREE.Color(0x87CEEB);

      // Camera setup
      const width = containerRef.current.clientWidth;
      const height = 600;
      state.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      state.camera.position.set(0, 8, 12);
      state.camera.lookAt(0, 0, 0);

      // Renderer setup
      state.renderer = new THREE.WebGLRenderer({ antialias: true });
      state.renderer.setSize(width, height);
      state.renderer.shadowMap.enabled = true;
      containerRef.current.appendChild(state.renderer.domElement);

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      state.scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 10, 5);
      directionalLight.castShadow = true;
      state.scene.add(directionalLight);

      // Đất
      const groundGeometry = new THREE.PlaneGeometry(30, 30);
      const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x90EE90 });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      state.scene.add(ground);

      // Grid
      const gridHelper = new THREE.GridHelper(30, 30, 0x666666, 0x444444);
      state.scene.add(gridHelper);

      // Player
      const playerGeometry = new THREE.SphereGeometry(0.5, 32, 32);
      const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x8B5CF6 });
      state.player = new THREE.Mesh(playerGeometry, playerMaterial);
      state.player.position.y = 0.5;
      state.player.castShadow = true;
      state.scene.add(state.player);

      // Player eyes
      const eyeGeometry = new THREE.SphereGeometry(0.1, 16, 16);
      const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
      const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      leftEye.position.set(-0.2, 0.2, 0.4);
      state.player.add(leftEye);
      const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      rightEye.position.set(0.2, 0.2, 0.4);
      state.player.add(rightEye);

      // rác
      const binTypes = [
        { color: 0x3B82F6, position: [-6, 0, -6], type: 'recyclable', name: 'Tái chế' },
        { color: 0x22C55E, position: [6, 0, -6], type: 'organic', name: 'Hữu cơ' },
        { color: 0xEF4444, position: [-6, 0, 6], type: 'general', name: 'Rác thải' },
        { color: 0xF59E0B, position: [6, 0, 6], type: 'hazardous', name: 'Nguy hại' }
      ];

      binTypes.forEach(binType => {
        const binGroup = new THREE.Group();
        
        const binGeometry = new THREE.BoxGeometry(1.5, 2, 1.5);
        const binMaterial = new THREE.MeshStandardMaterial({ color: binType.color });
        const bin = new THREE.Mesh(binGeometry, binMaterial);
        bin.position.y = 1;
        bin.castShadow = true;
        binGroup.add(bin);

        const lidGeometry = new THREE.BoxGeometry(1.7, 0.2, 1.7);
        const lid = new THREE.Mesh(lidGeometry, new THREE.MeshStandardMaterial({ color: binType.color }));
        lid.position.y = 2.1;
        binGroup.add(lid);

        binGroup.position.set(...binType.position);
        binGroup.userData = { type: binType.type, name: binType.name };
        state.bins.push(binGroup);
        state.scene.add(binGroup);
      });

      // Trash types
      const trashTypes = [
        { color: 0x4169E1, correct: 'recyclable', shape: 'cylinder' },
        { color: 0xFF6347, correct: 'organic', shape: 'sphere' },
        { color: 0x696969, correct: 'general', shape: 'box' },
        { color: 0xFF8C00, correct: 'hazardous', shape: 'cone' }
      ];

      const spawnTrash = () => {
        if (state.trash.length < 8 && !gameOver && lives > 0) {
          const trashType = trashTypes[Math.floor(Math.random() * trashTypes.length)];
          let geometry;
          
          switch(trashType.shape) {
            case 'cylinder':
              geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 16);
              break;
            case 'sphere':
              geometry = new THREE.SphereGeometry(0.4, 16, 16);
              break;
            case 'box':
              geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
              break;
            case 'cone':
              geometry = new THREE.ConeGeometry(0.4, 0.8, 16);
              break;
            default:
              geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
          }

          const material = new THREE.MeshStandardMaterial({ color: trashType.color });
          const trash = new THREE.Mesh(geometry, material);
          
          const angle = Math.random() * Math.PI * 2;
          const distance = 5 + Math.random() * 8;
          trash.position.set(
            Math.cos(angle) * distance,
            0.5,
            Math.sin(angle) * distance
          );
          
          trash.castShadow = true;
          trash.userData = { 
            correct: trashType.correct,
            rotationSpeed: (Math.random() - 0.5) * 0.05
          };
          
          state.trash.push(trash);
          state.scene.add(trash);
        }
      };

      // Spawn initial trash
      for (let i = 0; i < 5; i++) {
        setTimeout(() => spawnTrash(), i * 500);
      }
      const spawnInterval = setInterval(spawnTrash, 3000);

      // Input handling
      const handleKeyDown = (e) => {
        const key = e.key.toLowerCase();
        state.keys[key] = true;
        
        if (key === ' ') {
          e.preventDefault();
          
          if (!state.holding) {
            let nearest = null;
            let minDist = 2;
            
            state.trash.forEach(trash => {
              const dist = state.player.position.distanceTo(trash.position);
              if (dist < minDist) {
                minDist = dist;
                nearest = trash;
              }
            });
            
            if (nearest) {
              state.holding = nearest;
              state.trash = state.trash.filter(t => t !== nearest);
              setMessage(' Đã nhặt rác!');
            }
          } else {
            let dropped = false;
            state.bins.forEach(bin => {
              const dist = state.player.position.distanceTo(bin.position);
              if (dist < 2.5) {
                dropped = true;
                const correct = state.holding.userData.correct === bin.userData.type;
                
                if (correct) {
                  setScore(s => s + 10);
                  setMessage(`✓ Đúng! +10 điểm`);
                } else {
                  setScore(s => Math.max(0, s - 5));
                  setLives(l => {
                    const newLives = l - 1;
                    if (newLives <= 0) setGameOver(true);
                    return newLives;
                  });
                  setMessage(`✗ Sai! -5 điểm`);
                }
                
                state.scene.remove(state.holding);
                state.holding = null;
              }
            });
            
            if (!dropped) {
              setMessage('Gần thùng để thả!');
            }
          }
        }
      };

      const handleKeyUp = (e) => {
        state.keys[e.key.toLowerCase()] = false;
      };

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);

      // Animation loop
      const animate = () => {
        const moveVector = new THREE.Vector3();
        
        if (state.keys['w'] || state.keys['arrowup']) moveVector.z -= state.moveSpeed;
        if (state.keys['s'] || state.keys['arrowdown']) moveVector.z += state.moveSpeed;
        if (state.keys['a'] || state.keys['arrowleft']) moveVector.x -= state.moveSpeed;
        if (state.keys['d'] || state.keys['arrowright']) moveVector.x += state.moveSpeed;

        state.player.position.add(moveVector);
        state.player.position.x = Math.max(-14, Math.min(14, state.player.position.x));
        state.player.position.z = Math.max(-14, Math.min(14, state.player.position.z));

        if (moveVector.length() > 0) {
          state.player.rotation.y = Math.atan2(moveVector.x, moveVector.z);
        }

        state.camera.position.x = state.player.position.x;
        state.camera.position.z = state.player.position.z + 12;
        state.camera.lookAt(state.player.position);

        state.trash.forEach(trash => {
          trash.rotation.y += trash.userData.rotationSpeed;
          trash.position.y = 0.5 + Math.sin(Date.now() * 0.001 + trash.position.x) * 0.1;
        });

        if (state.holding) {
          state.holding.position.copy(state.player.position);
          state.holding.position.y = 2;
          state.holding.rotation.y += 0.05;
        }

        state.bins.forEach(bin => {
          const dist = state.player.position.distanceTo(bin.position);
          if (dist < 2.5 && state.holding) {
            bin.children[0].material.emissive = new THREE.Color(0xFFD700);
            bin.children[0].material.emissiveIntensity = 0.3;
          } else {
            bin.children[0].material.emissive = new THREE.Color(0x000000);
            bin.children[0].material.emissiveIntensity = 0;
          }
        });

        state.renderer.render(state.scene, state.camera);
        state.animationId = requestAnimationFrame(animate);
      };

      animate();
      setIsLoading(false);

      // Cleanup
      return () => {
        clearInterval(spawnInterval);
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
        if (state.animationId) cancelAnimationFrame(state.animationId);
        
        // Dispose Three.js objects
        state.trash.forEach(trash => {
          trash.geometry?.dispose();
          trash.material?.dispose();
          state.scene?.remove(trash);
        });
        state.bins.forEach(bin => {
          bin.children.forEach(child => {
            child.geometry?.dispose();
            child.material?.dispose();
          });
          state.scene?.remove(bin);
        });
        if (state.player) {
          state.player.geometry?.dispose();
          state.player.material?.dispose();
          state.player.children.forEach(child => {
            child.geometry?.dispose();
            child.material?.dispose();
          });
        }
        
        if (state.renderer) {
          state.renderer.dispose();
          if (containerRef.current && state.renderer.domElement && containerRef.current.contains(state.renderer.domElement)) {
            containerRef.current.removeChild(state.renderer.domElement);
          }
        }
      };
    } catch (err) {
      setError('Lỗi khởi tạo game: ' + err.message);
      setIsLoading(false);
    }
  }, [gameOver]);

  const movePlayer = (dx, dz) => {
    const state = gameStateRef.current;
    if (state.player) {
      state.player.position.x += dx;
      state.player.position.z += dz;
      state.player.position.x = Math.max(-14, Math.min(14, state.player.position.x));
      state.player.position.z = Math.max(-14, Math.min(14, state.player.position.z));
    }
  };

  const pickupOrDrop = () => {
    const state = gameStateRef.current;
    
    if (!state.holding) {
      let nearest = null;
      let minDist = 2;
      
      state.trash.forEach(trash => {
        const dist = state.player.position.distanceTo(trash.position);
        if (dist < minDist) {
          minDist = dist;
          nearest = trash;
        }
      });
      
      if (nearest) {
        state.holding = nearest;
        state.trash = state.trash.filter(t => t !== nearest);
        setMessage('Đã nhặt rác!');
      } else {
        setMessage('Không có rác gần!');
      }
    } else {
      let dropped = false;
      state.bins.forEach(bin => {
        const dist = state.player.position.distanceTo(bin.position);
        if (dist < 2.5) {
          dropped = true;
          const correct = state.holding.userData.correct === bin.userData.type;
          
          if (correct) {
            setScore(s => s + 10);
            setMessage(`✓ Đúng! +10`);
          } else {
            setScore(s => Math.max(0, s - 5));
            setLives(l => {
              const newLives = l - 1;
              if (newLives <= 0) setGameOver(true);
              return newLives;
            });
            setMessage(`✗ Sai! -5`);
          }
          
          state.scene.remove(state.holding);
          state.holding = null;
        }
      });
      
      if (!dropped) {
        setMessage('Gần thùng để thả!');
      }
    }
  };

  const resetGame = () => {
    const state = gameStateRef.current;

    // stop animation if still running
    if (state.animationId) {
      cancelAnimationFrame(state.animationId);
      state.animationId = null;
    }

    // dispose renderer and remove canvas if still present
    try {
      if (state.renderer) {
        state.renderer.dispose();
        if (containerRef.current && state.renderer.domElement && containerRef.current.contains(state.renderer.domElement)) {
          containerRef.current.removeChild(state.renderer.domElement);
        }
      }
    } catch (e) {
      console.error('Error disposing renderer:', e);}

    // reset in-memory game state
    state.scene = null;
    state.camera = null;
    state.renderer = null;
    state.trash = [];
    state.bins = [];
    state.holding = null;
    state.keys = {};

    // reset React state
    setScore(0);
    setLives(3);
    setMessage('');
    setError('');
    setGameOver(false);
    setIsLoading(true);
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      minHeight: '100vh', 
      backgroundColor: '#111827',
      padding: '20px'
    }}>
      <h1 style={{ 
        fontSize: '36px', 
        fontWeight: 'bold', 
        textAlign: 'center', 
        marginBottom: '20px',
        color: 'white'
      }}>
         Game Nhặt Rác 3D
      </h1>
      
      <div style={{ 
        display: 'flex', 
        gap: '20px',
        marginBottom: '20px' 
      }}>
        <div style={{ 
          backgroundColor: '#2563eb', 
          color: 'white', 
          padding: '15px 25px', 
          borderRadius: '10px',
          fontWeight: 'bold',
          fontSize: '20px'
        }}>
           {score}
        </div>
        <div style={{ 
          backgroundColor: '#dc2626', 
          color: 'white', 
          padding: '15px 25px', 
          borderRadius: '10px',
          fontWeight: 'bold',
          fontSize: '20px'
        }}>
           {lives}
        </div>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#dc2626',
          color: 'white',
          padding: '15px',
          borderRadius: '10px',
          marginBottom: '20px',
          maxWidth: '800px'
        }}>
           {error}
        </div>
      )}

      {message && (
        <div style={{ 
          backgroundColor: '#fbbf24', 
          color: 'black', 
          padding: '10px 20px', 
          borderRadius: '10px',
          marginBottom: '20px',
          fontWeight: '600'
        }}>
          {message}
        </div>
      )}

      {isLoading && (
        <div style={{
          color: 'white',
          fontSize: '20px',
          padding: '20px'
        }}>
           Đang tải game...
        </div>
      )}

      <div 
        ref={containerRef} 
        style={{ 
          width: '100%',
          maxWidth: '1200px',
          height: '600px',
          borderRadius: '10px',
          border: '4px solid #374151',
          backgroundColor: '#000'
        }}
      />

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        marginTop: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 70px)',
          gap: '5px',
          padding: '15px',
          backgroundColor: '#1f2937',
          borderRadius: '10px'
        }}>
          <div></div>
          <button onClick={() => movePlayer(0, -0.5)} style={btnStyle}>⬆️</button>
          <div></div>
          <button onClick={() => movePlayer(-0.5, 0)} style={btnStyle}>⬅️</button>
          <div></div>
          <button onClick={() => movePlayer(0.5, 0)} style={btnStyle}>➡️</button>
          <div></div>
          <button onClick={() => movePlayer(0, 0.5)} style={btnStyle}>⬇️</button>
          <div></div>
        </div>

        <button onClick={pickupOrDrop} style={{
          ...btnStyle,
          padding: '20px 40px',
          fontSize: '24px',
          backgroundColor: '#22c55e',
          alignSelf: 'center'
        }}>
           Nhặt
        </button>
      </div>

      <div style={{ 
        marginTop: '20px', 
        backgroundColor: '#1f2937', 
        color: 'white', 
        padding: '20px',
        borderRadius: '10px',
        maxWidth: '1200px',
        width: '100%'
      }}>
        <p style={{ marginBottom: '10px' }}>
           <strong>Điều khiển:</strong> Click vào màn hình game rồi dùng W/A/S/D hoặc phím mũi tên
        </p>
        <p style={{ marginBottom: '10px' }}>
          <strong>Hoặc:</strong> Dùng nút bấm bên dưới màn hình
        </p>
        <p>
           <strong>Mục tiêu:</strong> Nhặt rác và thả vào đúng thùng - Xanh dương (Tái chế), Xanh lá (Hữu cơ), Đỏ (Rác thải), Cam (Nguy hại)
        </p>
      </div>

      {gameOver && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: '#0b1220',
            color: 'white',
            borderRadius: '15px',
            padding: '40px',
            textAlign: 'center'
          }}>
            <h2 style={{ fontSize: '40px', marginBottom: '20px', color: '#dc2626' }}>
              Game Over!
            </h2>
            <p style={{ fontSize: '28px', marginBottom: '20px' }}>
              Điểm: <strong style={{ color: '#2563eb' }}>{score}</strong>
            </p>
            <button
              onClick={resetGame}
              style={{
                backgroundColor: '#22c55e',
                color: 'white',
                fontWeight: 'bold',
                padding: '15px 40px',
                borderRadius: '10px',
                fontSize: '24px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
               Chơi lại
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const btnStyle = {
  width: '70px',
  height: '70px',
  fontSize: '28px',
  backgroundColor: '#8B5CF6',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

export default TrashSortingGame3D;