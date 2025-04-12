const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl");

if (!gl) {
  alert("WebGL is not supported by your browser.");
}

// === Sliders & UI Elements ===
const freqSlider = document.getElementById("frequency-slider");
const ampSlider = document.getElementById("amplitude-slider");
const speedSlider = document.getElementById("speed-slider");

const freqValue = document.getElementById("frequency-value");
const ampValue = document.getElementById("amplitude-value");
const speedValue = document.getElementById("speed-value");

const equationLabel = document.getElementById("equation");
const hoverLabel = document.getElementById("hover-label");

// === Parameters ===
let frequency = parseFloat(freqSlider.value);
let amplitude = parseFloat(ampSlider.value);
let speed = parseFloat(speedSlider.value);
let time = 0;

// === Update on slider input ===
freqSlider.addEventListener("input", () => {
  frequency = parseFloat(freqSlider.value);
  freqValue.textContent = frequency.toFixed(2);
});
ampSlider.addEventListener("input", () => {
  amplitude = parseFloat(ampSlider.value);
  ampValue.textContent = amplitude.toFixed(2);
});
speedSlider.addEventListener("input", () => {
  speed = parseFloat(speedSlider.value);
  speedValue.textContent = speed.toFixed(2);
});

// === Wave Geometry ===
const points = 200;
let vertices = [];

function updateVertices() {
  vertices = [];
  for (let i = 0; i <= points; i++) {
    const x = (i / points) * 4 * Math.PI - 2 * Math.PI;
    const y = Math.sin(x * frequency + time) * amplitude;
    vertices.push(x / (2 * Math.PI));
    vertices.push(y);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
}

const vertexBuffer = gl.createBuffer();

// === Grid Geometry ===
let gridLines = [];
const spacing = 0.5;
for (let x = -1; x <= 1; x += spacing) {
  gridLines.push(x, -1, x, 1);
}
for (let y = -1; y <= 1; y += spacing) {
  gridLines.push(-1, y, 1, y);
}
const gridBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridLines), gl.STATIC_DRAW);

// === Dot Buffers ===
const dotBuffer = gl.createBuffer();
const hoverDotBuffer = gl.createBuffer();
const trailBuffer = gl.createBuffer();
const maxTrailPoints = 20;
let trailPoints = [];

// === Shaders ===
const vertexShaderSource = `
  attribute vec2 a_position;
  void main() {
    gl_PointSize = 10.0;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform bool u_isGrid;
  uniform bool u_isDot;
  uniform bool u_isTrail;
  uniform float u_time;

  void main() {
    if (u_isGrid) {
      gl_FragColor = vec4(0.4, 0.4, 0.4, 1.0);
    } else if (u_isDot) {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float alpha = 1.0 - smoothstep(0.3, 0.5, d);
      gl_FragColor = vec4(1.0, 1.0, 0.3, alpha);
    } else if (u_isTrail) {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float alpha = 1.0 - smoothstep(0.0, 0.5, d);
      gl_FragColor = vec4(1.0, 1.0, 0.7, alpha * 0.6);
    } else {
      float r = 0.5 + 0.5 * sin(u_time);
      float g = 0.5 + 0.5 * sin(u_time + 2.0);
      float b = 0.5 + 0.5 * sin(u_time + 4.0);
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  }
`;

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

// === Get Locations ===
const a_position = gl.getAttribLocation(program, "a_position");
const u_isGrid = gl.getUniformLocation(program, "u_isGrid");
const u_isDot = gl.getUniformLocation(program, "u_isDot");
const u_isTrail = gl.getUniformLocation(program, "u_isTrail");
const u_time = gl.getUniformLocation(program, "u_time");

gl.enableVertexAttribArray(a_position);

// === Hover Handler ===
let hoverX = 0;
let hoverY = 0;

canvas.addEventListener("mousemove", (e) => {
  const bounds = canvas.getBoundingClientRect();
  const mouseX = e.clientX - bounds.left;
  const normalizedX = (mouseX / bounds.width) * 2 - 1;
  const xMath = normalizedX * 2 * Math.PI;
  const y = Math.sin(xMath * frequency + time) * amplitude;
  hoverX = normalizedX;
  hoverY = y;

  hoverLabel.style.display = "block";
  hoverLabel.style.left = `${e.clientX + 10}px`;
  hoverLabel.style.top = `${e.clientY + 10}px`;
  hoverLabel.textContent = `x = ${xMath.toFixed(2)}, y = ${y.toFixed(2)}`;

  gl.bindBuffer(gl.ARRAY_BUFFER, hoverDotBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([hoverX, hoverY]),
    gl.DYNAMIC_DRAW
  );
});

canvas.addEventListener("mouseleave", () => {
  hoverLabel.style.display = "none";
});

// === Render Loop ===
function renderScene() {
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.1, 0.1, 0.1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.useProgram(program);
  gl.uniform1f(u_time, time);

  // === Draw Grid ===
  gl.uniform1i(u_isGrid, true);
  gl.uniform1i(u_isDot, false);
  gl.uniform1i(u_isTrail, false);
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.LINES, 0, gridLines.length / 2);

  // === Draw Sine Wave ===
  updateVertices();
  gl.uniform1i(u_isGrid, false);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.LINE_STRIP, 0, vertices.length / 2);

  // === Update trail dot
  const x = Math.sin(time * 0.5) * 0.9;
  const y = Math.sin(x * frequency * 2 * Math.PI + time) * amplitude;
  trailPoints.unshift({ x, y, age: 0 });
  if (trailPoints.length > maxTrailPoints) trailPoints.pop();
  trailPoints.forEach((p) => p.age++);

  const trailData = [];
  trailPoints.forEach((p) => trailData.push(p.x, p.y));
  gl.uniform1i(u_isTrail, true);
  gl.bindBuffer(gl.ARRAY_BUFFER, trailBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(trailData), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.POINTS, 0, trailPoints.length);

  // === Dot (follows wave)
  gl.uniform1i(u_isDot, true);
  gl.uniform1i(u_isTrail, false);
  gl.bindBuffer(gl.ARRAY_BUFFER, dotBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x, y]), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.POINTS, 0, 1);

  // === Hover dot (on mouse move)
  gl.bindBuffer(gl.ARRAY_BUFFER, hoverDotBuffer);
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.POINTS, 0, 1);

  // === Equation Text Update
  equationLabel.textContent = `y = ${amplitude.toFixed(
    2
  )} × sin(${frequency.toFixed(2)}x + ${time.toFixed(1)})`;

  time += speed;
  requestAnimationFrame(renderScene);
}

renderScene();
