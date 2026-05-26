/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";

interface PsychedelicWaterBackgroundProps {
  onImageChanged?: (width: number, height: number) => void;
}

export default function PsychedelicWaterBackground({ onImageChanged }: PsychedelicWaterBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Custom Controls State exactly matched with user's defaults
  const [speed] = useState<number>(1.2);
  const [intensity] = useState<number>(0.8);
  const [rgbShift] = useState<number>(1.5);
  
  // Track if a custom image has been loaded
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Keep references to values to use directly in the WebGL loop safely
  const uniformsRef = useRef({
    speed: 1.2,
    intensity: 0.8,
    rgbShift: 1.5,
    width: window.innerWidth,
    height: window.innerHeight,
    imgWidth: 1024,
    imgHeight: 1024,
    time: 0,
    textureNeedsUpdate: false,
    imageElement: null as HTMLImageElement | HTMLCanvasElement | null,
  });

  // Keep uniforms updated from state triggers
  useEffect(() => {
    uniformsRef.current.speed = speed;
    uniformsRef.current.intensity = intensity;
    uniformsRef.current.rgbShift = rgbShift;
  }, [speed, intensity, rgbShift]);

  // Generate an immersive, detailed procedural star-cluster graphic to serve as the default fluid source
  const generateProceduralTexture = (): HTMLCanvasElement => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // 1. Deep cosmos base color gradient
      ctx.fillStyle = "#0c0308";
      ctx.fillRect(0, 0, 1024, 1024);

      // 2. High-contrast neon pink/magenta cluster nodes & nebulas
      const radial1 = ctx.createRadialGradient(256, 300, 10, 256, 300, 500);
      radial1.addColorStop(0, "rgba(236, 72, 153, 0.45)"); // Neon Pink
      radial1.addColorStop(0.4, "rgba(131, 24, 67, 0.2)"); // Deep Rose
      radial1.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = radial1;
      ctx.fillRect(0, 0, 1024, 1024);

      const radial2 = ctx.createRadialGradient(800, 700, 10, 800, 700, 600);
      radial2.addColorStop(0, "rgba(219, 39, 119, 0.35)"); // Vivid Pink Hub
      radial2.addColorStop(0.5, "rgba(15, 3, 10, 0.1)");
      radial2.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = radial2;
      ctx.fillRect(0, 0, 1024, 1024);

      // 3. Warm golden/amber nodes to mimic decentralized cluster hubs (perfect for Aptos)
      const radialAmber = ctx.createRadialGradient(850, 220, 20, 850, 220, 450);
      radialAmber.addColorStop(0, "rgba(245, 158, 11, 0.35)"); // Cyber Amber
      radialAmber.addColorStop(0.5, "rgba(245, 158, 11, 0.05)");
      radialAmber.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = radialAmber;
      ctx.fillRect(0, 0, 1024, 1024);

      // 4. Concentric storage rings to supply rich geometric distortion patterns
      ctx.strokeStyle = "rgba(236, 72, 153, 0.3)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(512, 512, 280, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(245, 158, 11, 0.2)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(512, 512, 160, 0, Math.PI * 2);
      ctx.stroke();

      // High-resolution grid coordinates
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(512, 512);
        ctx.lineTo(512 + Math.cos(angle) * 460, 512 + Math.sin(angle) * 460);
        ctx.stroke();
      }

      // 5. Build decentralized cluster storage nodes (dots and logical lines)
      ctx.fillStyle = "rgba(236, 72, 153, 0.75)";
      for (let i = 0; i < 40; i++) {
        const x = Math.sin(i * 3.7) * 420 + 512;
        const y = Math.cos(i * 7.1) * 420 + 512;
        ctx.beginPath();
        ctx.arc(x, y, 3.5 + (i % 5), 0, Math.PI * 2);
        ctx.fill();

        // High contrast central rings around subset of nodes to act as storage blocks
        if (i % 4 === 0) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, 12, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw node physical inter-links
        if (i % 3 === 0) {
          ctx.strokeStyle = "rgba(245, 158, 11, 0.25)";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(512, 512);
          ctx.stroke();
        }
      }

      // Draw elegant concentric orbital nodes
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      for (let r = 0; r < 5; r++) {
        const dotsCount = 10 + r * 8;
        const orbitRadius = 70 + r * 80;
        for (let d = 0; d < dotsCount; d++) {
          const angle = (d * Math.PI * 2) / dotsCount;
          const x = 512 + Math.cos(angle) * orbitRadius;
          const y = 512 + Math.sin(angle) * orbitRadius;
          ctx.beginPath();
          ctx.arc(x, y, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    return canvas;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
    if (!gl) {
      console.error("WebGL context initialization failed.");
      return;
    }

    // Flip Y loaded textures to preserve correct orientation
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    const vsSource = `
      attribute vec2 position;
      varying vec2 vUv;
      void main() {
        vUv = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      uniform sampler2D u_texture;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_imageResolution;
      
      uniform float u_speed;
      uniform float u_intensity;
      uniform float u_rgbShift;
      
      varying vec2 vUv;

      vec2 getCoverUv(vec2 uv, vec2 res, vec2 imgRes) {
        float rs = res.x / res.y;
        float ri = imgRes.x / imgRes.y;
        vec2 newRes = rs < ri ? vec2(imgRes.x * res.y / imgRes.y, res.y) : vec2(res.x, imgRes.y * res.x / imgRes.x);
        vec2 offset = (rs < ri ? vec2((newRes.x - res.x) / 2.0, 0.0) : vec2(0.0, (newRes.y - res.y) / 2.0)) / newRes;
        return uv * res / newRes + offset;
      }

      void main() {
        vec2 uv = getCoverUv(vUv, u_resolution, u_imageResolution);
        float t = u_time * u_speed;
        
        // Accurate waves formula for high fluid realism
        float waveX = sin(uv.y * 12.0 + t) * 0.015 + sin(uv.x * 6.0 - t * 0.8) * 0.01;
        float waveY = cos(uv.x * 12.0 + t) * 0.015 + cos(uv.y * 6.0 - t * 1.2) * 0.01;
        
        waveX *= u_intensity;
        waveY *= u_intensity;

        vec2 distortedUv = uv + vec2(waveX, waveY);

        // Chromatic Aberration Shift calculation
        float shift = 0.0055 * u_rgbShift;
        float r = texture2D(u_texture, distortedUv + vec2(shift * sin(t * 1.8), shift * cos(t * 1.3))).r;
        float g = texture2D(u_texture, distortedUv).g;
        float b = texture2D(u_texture, distortedUv + vec2(-shift * cos(t * 1.8), -shift * sin(t * 1.3))).b;

        // Custom pink-cosmological color grading formula mapping Aptos visual palette
        vec3 color = vec3(r, g, b);
        color.r = pow(color.r, 0.9) * 1.02;
        color.g = pow(color.g, 1.25) * 0.55;
        color.b = pow(color.b, 0.95) * 0.98;

        // Overlay a deep space stable pink gradient to keep visuals rich even with low texture inputs
        vec3 stablePink = vec3(0.65, 0.08, 0.45) * 0.12;
        color += stablePink;

        // Balance visual luminance so text visibility is preserved beautifully
        color *= 0.72;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const compileShader = (type: number, src: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compiles issue: " + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Shader programmatic link fails: " + gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Bootstrap with our high-fidelity procedural storage-cluster graphic
    let initialGraphic: HTMLCanvasElement | null = generateProceduralTexture();
    uniformsRef.current.imageElement = initialGraphic;
    uniformsRef.current.imgWidth = initialGraphic.width;
    uniformsRef.current.imgHeight = initialGraphic.height;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, initialGraphic);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const uTextureLoc = gl.getUniformLocation(program, "u_texture");
    const uTimeLoc = gl.getUniformLocation(program, "u_time");
    const uResolutionLoc = gl.getUniformLocation(program, "u_resolution");
    const uImgResolutionLoc = gl.getUniformLocation(program, "u_imageResolution");
    const uSpeedLoc = gl.getUniformLocation(program, "u_speed");
    const uIntensityLoc = gl.getUniformLocation(program, "u_intensity");
    const uRgbShiftLoc = gl.getUniformLocation(program, "u_rgbShift");

    gl.uniform1i(uTextureLoc, 0);

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      uniformsRef.current.width = width;
      uniformsRef.current.height = height;
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    let animationFrameId: number;
    const epoch = performance.now();

    const renderLoop = () => {
      animationFrameId = requestAnimationFrame(renderLoop);

      if (uniformsRef.current.textureNeedsUpdate && uniformsRef.current.imageElement) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, uniformsRef.current.imageElement);
        uniformsRef.current.textureNeedsUpdate = false;
      }

      const elapsed = (performance.now() - epoch) / 1000.0;
      uniformsRef.current.time = elapsed;

      gl.uniform1f(uTimeLoc, elapsed);
      gl.uniform2f(uResolutionLoc, uniformsRef.current.width, uniformsRef.current.height);
      gl.uniform2f(uImgResolutionLoc, uniformsRef.current.imgWidth, uniformsRef.current.imgHeight);
      gl.uniform1f(uSpeedLoc, uniformsRef.current.speed);
      gl.uniform1f(uIntensityLoc, uniformsRef.current.intensity);
      gl.uniform1f(uRgbShiftLoc, uniformsRef.current.rgbShift);

      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      gl.deleteTexture(texture);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      initialGraphic = null;
    };
  }, []);

  const handleImageFile = (file: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        uniformsRef.current.imageElement = img;
        uniformsRef.current.imgWidth = img.width;
        uniformsRef.current.imgHeight = img.height;
        uniformsRef.current.textureNeedsUpdate = true;
        if (onImageChanged) onImageChanged(img.width, img.height);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div 
      className="fixed inset-0 w-full h-full z-0 overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleImageFile(e.dataTransfer.files[0]);
        }
      }}
      id="psychedelic-loop-view"
    >
      {/* GL render plane - locked to background with zero intrusive pointer actions initially */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover block pointer-events-none" />

      {/* Subtle, Gorgeous Drag-over border glow (Non-intrusive) */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 pointer-events-none border-[6px] border-dashed border-pink-500/80 animate-pulse bg-pink-950/10 backdrop-blur-[2px] flex items-center justify-center transition-all duration-300">
          <div className="bg-black/90 p-6 rounded-2xl border border-pink-500/30 text-center max-w-xs flex flex-col items-center">
            <Upload className="w-8 h-8 text-pink-500 animate-bounce mb-2" />
            <h1 className="text-sm font-bold text-white mb-1 font-sans">Drop Custom Background</h1>
            <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
              Release to map the texture into the liquid rendering pipeline instantly.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
