"use client";

import { useEffect, useRef } from "react";

export default function NoiseOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true });
    if (!gl) return;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
    }
    window.addEventListener("resize", resize);
    resize();

    const vsSource = `attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
    const fsSource = `precision highp float;
      uniform vec2 resolution;
      float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
      void main() {
        float noise = random(gl_FragCoord.xy);
        gl_FragColor = vec4(0.0, 0.0, 0.0, noise * 0.15);
      }`;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const pos = gl.getAttribLocation(prog, "position");

    function draw() {
      gl!.useProgram(prog);
      gl!.enableVertexAttribArray(pos);
      gl!.vertexAttribPointer(pos, 2, gl!.FLOAT, false, 0, 0);
      gl!.uniform2f(
        gl!.getUniformLocation(prog, "resolution"),
        canvas!.width,
        canvas!.height
      );
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    }
    draw();
    window.addEventListener("resize", draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("resize", draw);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
        mixBlendMode: "multiply",
        opacity: 0.6,
      }}
    />
  );
}
