// Coral Run — everything on screen: the sky, the pseudo-3D archipelago, the rings
// and beacons, the aircraft in chase view, the HUD and the screens. One job: paint
// the world the pilot sees, at 1280x720, from canvas alone.
import { COLS, FAR_Z, FOCAL, HORIZON_FRACTION, NEAR_Z, ROWS, VIEW_HEIGHT, VIEW_WIDTH } from './config.js';
import { groundColor, groundHeight, isOnRunway } from './terrain.js';
import { MISSION_BRIEFS, MISSION_NAMES, missionProgress } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CRASHED = 'crashed';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

function compassLabel(deg) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(deg / 45) % 8];
}

function headingDeg(heading) {
  return ((heading * 180) / Math.PI % 360 + 360) % 360;
}

export function createRenderer(canvas) {
  canvas.width = VIEW_WIDTH;
  canvas.height = VIEW_HEIGHT;
  const ctx = canvas.getContext('2d');
  const cx = VIEW_WIDTH / 2;
  const horizonY = VIEW_HEIGHT * HORIZON_FRACTION;

  /** Project a world point into screen space from the chase camera. */
  function project(wx, wy, wz, cam) {
    const dx = wx - cam.x;
    const dz = wz - cam.z;
    const forward = dx * Math.sin(cam.heading) + dz * Math.cos(cam.heading);
    if (forward < NEAR_Z * 0.5) return null;
    const right = dx * Math.cos(cam.heading) - dz * Math.sin(cam.heading);
    return {
      x: cx + (right * FOCAL) / forward,
      y: horizonY - ((wy - cam.y) * FOCAL) / forward,
      depth: forward,
    };
  }

  function drawSky(time) {
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
    sky.addColorStop(0, '#1c4f8a');
    sky.addColorStop(0.55, '#5ea3d6');
    sky.addColorStop(1, '#cfe8f5');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_WIDTH, horizonY + 40);
    // Sun, low over the sea to the north-east.
    const sunX = cx + 430;
    const sunY = 92;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 120);
    glow.addColorStop(0, 'rgba(255, 244, 200, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 226, 140, 0.55)');
    glow.addColorStop(1, 'rgba(255, 226, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    void time;
  }

  function drawClouds(cam, clouds) {
    ctx.save();
    for (const cloud of clouds) {
      const p = project(cloud.x, cloud.y, cloud.z, cam);
      if (!p || p.y > horizonY + 30) continue;
      const r = (cloud.s * FOCAL) / p.depth;
      if (r < 2) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.42, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - r * 0.55, p.y + r * 0.1, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + r * 0.55, p.y + r * 0.08, r * 0.65, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Terrain: depth rows from far to near, each row a band of coloured quads. */
  function drawTerrain(cam) {
    const depths = [];
    for (let i = 0; i <= ROWS; i += 1) {
      depths.push(NEAR_Z * Math.pow(FAR_Z / NEAR_Z, i / ROWS));
    }
    // Sea below the horizon, as the far backdrop for rows that end in water.
    ctx.fillStyle = '#1d6f9e';
    ctx.fillRect(0, horizonY, VIEW_WIDTH, VIEW_HEIGHT - horizonY);
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      const dFar = depths[row + 1];
      const dNear = depths[row];
      // Distance haze: far ground fades into the horizon sky so the rows blend.
      const haze = Math.min(0.72, Math.max(0, (dFar - 120) / 900));
      const halfFar = (dFar * (VIEW_WIDTH / 2)) / FOCAL;
      const halfNear = (dNear * (VIEW_WIDTH / 2)) / FOCAL;
      const sinH = Math.sin(cam.heading);
      const cosH = Math.cos(cam.heading);
      for (let col = 0; col < COLS; col += 1) {
        const t0 = col / COLS;
        const t1 = (col + 1) / COLS;
        const latFar0 = -halfFar + 2 * halfFar * t0;
        const latFar1 = -halfFar + 2 * halfFar * t1;
        const latNear0 = -halfNear + 2 * halfNear * t0;
        const latNear1 = -halfNear + 2 * halfNear * t1;
        // World position of the quad's far edge centre, for its colour.
        const midLat = (latFar0 + latFar1) / 2;
        const wx = cam.x + midLat * cosH + dFar * sinH;
        const wz = cam.z - midLat * sinH + dFar * cosH;
        const h = groundHeight(wx, wz);
        const yFar = horizonY - ((h - cam.y) * FOCAL) / dFar;
        const yNear = horizonY - ((h - cam.y) * FOCAL) / dNear;
        const xFar0 = cx + (latFar0 * FOCAL) / dFar;
        const xFar1 = cx + (latFar1 * FOCAL) / dFar;
        const xNear0 = cx + (latNear0 * FOCAL) / dNear;
        const xNear1 = cx + (latNear1 * FOCAL) / dNear;
        ctx.fillStyle = hazeColor(groundColor(h, wx, wz), haze);
        ctx.beginPath();
        ctx.moveTo(xFar0, yFar);
        ctx.lineTo(xFar1, yFar);
        ctx.lineTo(xNear1, yNear);
        ctx.lineTo(xNear0, yNear);
        ctx.closePath();
        ctx.fill();
      }
    }
    void isOnRunway;
  }

  /** Blend a hex colour toward the horizon haze colour by `amount` (0..1). */
  function hazeColor(hex, amount) {
    if (amount <= 0) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const mix = (c, h) => Math.round(c + (h - c) * amount);
    return `rgb(${mix(r, 207)}, ${mix(g, 232)}, ${mix(b, 245)})`;
  }

  function drawRing(p, r, color, glowColor) {
    ctx.save();
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 7;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawMarkers(cam, missions, time) {
    const items = [];
    for (const ring of missions.rings) {
      if (!ring.passed) items.push({ x: ring.x, y: ring.y, z: ring.z, r: ring.r, kind: 'ring' });
    }
    for (const beacon of missions.beacons) {
      if (!beacon.passed) items.push({ x: beacon.x, y: beacon.y, z: beacon.z, r: beacon.r, kind: 'beacon' });
    }
    items.sort((a, b) => {
      const da = (a.x - cam.x) * Math.sin(cam.heading) + (a.z - cam.z) * Math.cos(cam.heading);
      const db = (b.x - cam.x) * Math.sin(cam.heading) + (b.z - cam.z) * Math.cos(cam.heading);
      return db - da;
    });
    for (const item of items) {
      const p = project(item.x, item.y, item.z, cam);
      if (!p) continue;
      const r = Math.max(3, (item.r * FOCAL) / p.depth);
      if (item.kind === 'ring') {
        drawRing(p, r, '#ffd23e', '#ff9d00');
      } else {
        // Beacon: a pulsing diamond pylon with a light on top.
        const pulse = 0.7 + 0.3 * Math.sin(time * 3 + item.x);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#ff5a3c';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - r);
        ctx.lineTo(p.x + r * 0.55, p.y);
        ctx.lineTo(p.x, p.y + r);
        ctx.lineTo(p.x - r * 0.55, p.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2, r * 0.18), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /** The aircraft, seen from behind and above, banking with the roll. */
  function drawPlane(plane, time) {
    const planeY = horizonY + 168 - plane.pitch * 260;
    const scale = 1 + plane.speed / 1400;
    ctx.save();
    ctx.translate(cx, planeY);
    ctx.rotate(-plane.roll * 0.9);
    ctx.scale(scale, scale);
    // Wings.
    ctx.fillStyle = '#e8eef4';
    ctx.beginPath();
    ctx.moveTo(-150, 6);
    ctx.lineTo(-34, -8);
    ctx.lineTo(34, -8);
    ctx.lineTo(150, 6);
    ctx.lineTo(138, 16);
    ctx.lineTo(-138, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c33';
    ctx.fillRect(-150, 6, 26, 5);
    ctx.fillRect(124, 6, 26, 5);
    // Tailplane.
    ctx.fillStyle = '#d5dde6';
    ctx.beginPath();
    ctx.moveTo(-58, -34);
    ctx.lineTo(58, -34);
    ctx.lineTo(44, -24);
    ctx.lineTo(-44, -24);
    ctx.closePath();
    ctx.fill();
    // Fuselage, seen from the tail.
    const body = ctx.createLinearGradient(0, -52, 0, 26);
    body.addColorStop(0, '#f4f7fa');
    body.addColorStop(0.6, '#dfe7ee');
    body.addColorStop(1, '#9fb0c0');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, -8, 30, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fin.
    ctx.fillStyle = '#2f6fb2';
    ctx.beginPath();
    ctx.moveTo(-6, -34);
    ctx.lineTo(6, -34);
    ctx.lineTo(10, -78);
    ctx.lineTo(-10, -78);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(-10, -78);
    ctx.lineTo(10, -78);
    ctx.lineTo(7, -64);
    ctx.lineTo(-7, -64);
    ctx.closePath();
    ctx.fill();
    // Prop blur and nav lights.
    const spin = 0.35 + 0.65 * Math.abs(Math.sin(time * 40));
    ctx.fillStyle = `rgba(180, 200, 220, ${0.25 + spin * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(0, -8, 34, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-152, 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#34c759';
    ctx.beginPath();
    ctx.arc(152, 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHud(world) {
    const { plane, missions, time } = world;
    const deg = headingDeg(plane.heading);
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    // Top bar.
    ctx.fillStyle = 'rgba(8, 20, 34, 0.55)';
    ctx.fillRect(0, 0, VIEW_WIDTH, 54);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${MISSION_NAMES[missions.mission]}  ·  ${missionProgress(missions)}`, 16, 34);
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`SCORE ${missions.score}`, cx, 35);
    ctx.textAlign = 'right';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`LIVES ${'✈'.repeat(Math.max(0, missions.lives))}`, VIEW_WIDTH - 16, 34);
    // Centre message.
    if (missions.message && time < missions.messageUntil) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(8, 20, 34, 0.6)';
      const w = ctx.measureText(missions.message).width + 36;
      ctx.fillRect(cx - w / 2, 66, w, 42);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(missions.message, cx, 96);
    }
    // Instruments, bottom-left: altitude, speed, heading.
    ctx.textAlign = 'left';
    ctx.font = 'bold 30px system-ui, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`ALT ${Math.max(0, Math.round(plane.y * 3))} ft`, 16, VIEW_HEIGHT - 96);
    ctx.fillText(`SPD ${Math.round(plane.speed)} kt`, 16, VIEW_HEIGHT - 58);
    ctx.fillText(`HDG ${String(Math.round(deg)).padStart(3, '0')}° ${compassLabel(deg)}`, 16, VIEW_HEIGHT - 20);
    // Artificial horizon, bottom-centre-left.
    const ahX = 330;
    const ahY = VIEW_HEIGHT - 62;
    const ahR = 44;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ahX, ahY, ahR, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(ahX, ahY);
    ctx.rotate(-plane.roll);
    ctx.translate(0, plane.pitch * 90);
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-ahR, -ahR, ahR * 2, ahR);
    ctx.fillStyle = '#8a6a45';
    ctx.fillRect(-ahR, 0, ahR * 2, ahR);
    ctx.restore();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ahX, ahY, ahR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ahX - 18, ahY);
    ctx.lineTo(ahX + 18, ahY);
    ctx.stroke();
    // Throttle and fuel, bottom-right.
    const barX = VIEW_WIDTH - 250;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('THR', barX, VIEW_HEIGHT - 96);
    ctx.fillText('FUEL', barX, VIEW_HEIGHT - 58);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(barX + 64, VIEW_HEIGHT - 110, 170, 16);
    ctx.fillRect(barX + 64, VIEW_HEIGHT - 72, 170, 16);
    ctx.fillStyle = plane.throttle > 0.85 ? '#ff9d00' : '#5ec4ff';
    ctx.fillRect(barX + 64, VIEW_HEIGHT - 110, 170 * plane.throttle, 16);
    ctx.fillStyle = plane.fuel < 20 ? '#ff3b30' : '#34c759';
    ctx.fillRect(barX + 64, VIEW_HEIGHT - 72, 170 * (plane.fuel / 100), 16);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round(plane.throttle * 100)}%`, barX + 64, VIEW_HEIGHT - 118);
    ctx.fillText(`${Math.round(plane.fuel)}%`, barX + 64, VIEW_HEIGHT - 80);
    // Stall warning.
    if (world.stalled) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillStyle = Math.floor(time * 4) % 2 === 0 ? '#ff3b30' : '#ffffff';
      ctx.fillText('STALL — NOSE DOWN, ADD POWER', cx, 150);
    }
    // Target marker: an arrow at the screen edge toward the next objective.
    drawTargetMarker(world);
    ctx.restore();
  }

  function drawTargetMarker(world) {
    const target = world.target;
    if (!target) return;
    const p = project(target.x, target.y, target.z, world.cam);
    const dist = Math.round(Math.hypot(target.x - world.plane.x, target.y - world.plane.y, target.z - world.plane.z));
    ctx.save();
    ctx.textAlign = 'center';
    if (p && p.x > 60 && p.x < VIEW_WIDTH - 60 && p.y > 80 && p.y < VIEW_HEIGHT - 160) {
      // In view: a small diamond over the target.
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 14);
      ctx.lineTo(p.x + 14, p.y);
      ctx.lineTo(p.x, p.y + 14);
      ctx.lineTo(p.x - 14, p.y);
      ctx.closePath();
      ctx.stroke();
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillStyle = '#ffd23e';
      ctx.fillText(`${dist} ft`, p.x, p.y - 20);
    } else {
      // Off view: an arrow on the screen edge in the target's direction.
      let ax = p ? p.x : cx;
      let ay = p ? p.y : 200;
      ax = Math.max(40, Math.min(VIEW_WIDTH - 40, ax));
      ay = Math.max(90, Math.min(VIEW_HEIGHT - 170, ay));
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(ax, ay - 12);
      ctx.lineTo(ax + 10, ay + 8);
      ctx.lineTo(ax - 10, ay + 8);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(`${dist} ft`, ax, ay + 28);
    }
    ctx.restore();
  }

  function overlay(title, lines, accent) {
    ctx.save();
    ctx.fillStyle = 'rgba(6, 16, 28, 0.62)';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText(title, cx, 250);
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, cx, 310 + i * 36));
    ctx.restore();
  }

  function draw(world, screen, best) {
    const { plane, missions, course, time } = world;
    const cam = {
      x: plane.x - Math.sin(plane.heading) * 11,
      z: plane.z - Math.cos(plane.heading) * 11,
      y: plane.y + 3.2,
      heading: plane.heading,
    };
    world.cam = cam;
    drawSky(time);
    drawClouds(cam, course.clouds);
    drawTerrain(cam);
    drawMarkers(cam, missions, time);
    if (screen === SCREEN_TITLE) {
      // Parked on the runway: the plane sits still, prop turning slowly.
      drawPlane({ ...plane, speed: 0, pitch: 0, roll: 0 }, time);
      overlay('CORAL RUN', [
        'Island-hopping flight: rings, beacons, and one runway home.',
        'Arrows fly · W/S throttle · mouse steers · P pause · M mute · R restart',
        `Best score: ${best}`,
        'Press Space or click to fly',
      ], '#ffd23e');
      return;
    }
    drawPlane(plane, time);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(world);
    if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Press P or Space to keep flying.'], '#ffffff');
    } else if (screen === SCREEN_CRASHED) {
      overlay('CRASHED', [
        missions.lives > 0
          ? `${missions.lives} ${missions.lives === 1 ? 'life' : 'lives'} left — press Space to climb back in.`
          : 'Out of lives.',
        `Score ${missions.score}`,
      ], '#ff6a5a');
    } else if (screen === SCREEN_WIN) {
      const timeBonus = Math.max(0, 3600 - Math.round(world.elapsed)) * 1;
      overlay('ALL MISSIONS COMPLETE', [
        `Rings 8/8 · Beacons 3/3 · Touchdown on the runway`,
        `Score ${missions.score}  ·  Time bonus +${timeBonus}`,
        `Best score: ${Math.max(best, missions.score + timeBonus)}`,
        'Press R to fly it again.',
      ], '#ffd23e');
    } else if (screen === SCREEN_OVER) {
      overlay('GAME OVER', [
        'The sea keeps the plane this time.',
        `Score ${missions.score}  ·  Best ${best}`,
        'Press R to fly again.',
      ], '#ff6a5a');
    }
    void MISSION_BRIEFS;
  }

  return { draw };
}
