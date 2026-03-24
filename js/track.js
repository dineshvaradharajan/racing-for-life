// ============================================================
//  TRACK GENERATION & MESH — Realistic racing visuals
// ============================================================

let _trackPartId = 0;
function tuid(prefix) { return prefix + '_' + (++_trackPartId); }

// ── Seeded pseudo-random for deterministic placement ──
let _trackSeed = 12345;
function trackRand() {
    _trackSeed = (_trackSeed * 16807 + 0) % 2147483647;
    return (_trackSeed & 0x7fffffff) / 2147483647;
}
function trackRandRange(a, b) { return a + trackRand() * (b - a); }

// Generate track with Catmull-Rom smoothing for silky curves
function generateTrack(trackDef) {
    // Generate coarse control points
    const coarse = [];
    const n = trackDef.segments;
    const radius = 200;
    for (let i = 0; i < n; i++) {
        const t = i / n * Math.PI * 2;
        const wiggle = Math.sin(t * 3) * trackDef.maxCurve * 60 + Math.cos(t * 5) * trackDef.maxCurve * 30;
        const r = radius + wiggle;
        const x = Math.cos(t) * r;
        const z = Math.sin(t) * r;
        const y = Math.sin(t * 2) * trackDef.hills * 15 + Math.cos(t * 4) * trackDef.hills * 8;
        coarse.push(new BABYLON.Vector3(x, Math.max(y, 0.5), z));
    }

    // Catmull-Rom interpolation for smooth curves (4x subdivision)
    const subdivisions = 4;
    const points = [];
    for (let i = 0; i < coarse.length; i++) {
        const p0 = coarse[(i - 1 + coarse.length) % coarse.length];
        const p1 = coarse[i];
        const p2 = coarse[(i + 1) % coarse.length];
        const p3 = coarse[(i + 2) % coarse.length];
        for (let s = 0; s < subdivisions; s++) {
            const t = s / subdivisions;
            const t2 = t * t, t3 = t2 * t;
            const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
            const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
            const z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
            points.push(new BABYLON.Vector3(x, Math.max(y, 0.3), z));
        }
    }
    return points;
}

function getTrackPointAt(points, t) {
    t = ((t % 1) + 1) % 1;
    const idx = t * points.length;
    const i0 = Math.floor(idx) % points.length;
    const i1 = (i0 + 1) % points.length;
    const frac = idx - Math.floor(idx);
    return BABYLON.Vector3.Lerp(points[i0], points[i1], frac);
}

function getTrackDirectionAt(points, t) {
    const p0 = getTrackPointAt(points, t - 0.001);
    const p1 = getTrackPointAt(points, t + 0.001);
    return p1.subtract(p0).normalize();
}

// Calculate track banking angle based on curvature
function getTrackBankAt(points, t) {
    const d0 = getTrackDirectionAt(points, t - 0.005);
    const d1 = getTrackDirectionAt(points, t + 0.005);
    const cross = d1.x * d0.z - d1.z * d0.x; // Signed curvature
    return cross * 4; // Banking angle in radians (negative = bank right)
}

// ── Compute curvature at each point (used for rumble strips & catch fencing) ──
function _curvatureAt(points, i) {
    const n = points.length;
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const d0 = p1.subtract(p0).normalize();
    const d1 = p2.subtract(p1).normalize();
    const cross = d1.x * d0.z - d1.z * d0.x;
    return cross; // positive = left turn, negative = right turn
}

function buildTrackMesh(trackDef) {
    const hw = trackDef.trackWidth / 2;
    const n = trackPoints.length;
    const up = new BABYLON.Vector3(0, 1, 0);

    // ── Road surface ──
    const roadVerts = [], roadIndices = [], roadUVs = [], roadColors = [];
    // ── Shoulder/runoff strips ──
    const shoulderLVerts = [], shoulderRVerts = [], shoulderIndices = [];
    // ── Curb geometry ──
    const curbLVerts = [], curbRVerts = [], curbIndices = [];
    const curbLColors = [], curbRColors = [];

    const shoulderWidth = 2.5;
    const curbW = 0.35, curbH = 0.10;

    // Pre-seed random for deterministic marks
    _trackSeed = 42;

    for (let i = 0; i <= n; i++) {
        const i0 = i % n;
        const i1 = (i + 1) % n;
        const p = trackPoints[i0];
        const pNext = trackPoints[i1];
        const dir = pNext.subtract(p).normalize();
        const right = BABYLON.Vector3.Cross(up, dir).normalize();

        // Road banking
        const bank = getTrackBankAt(trackPoints, i0 / n);
        const bankOffset = bank * 0.5;

        const left = p.add(right.scale(hw));
        const rght = p.subtract(right.scale(hw));
        left.y = p.y + 0.08 + bankOffset;
        rght.y = p.y + 0.08 - bankOffset;

        // Road vertices with 5 strips for asphalt variation
        // We use 5 vertices across: left edge, 1/4, center, 3/4, right edge
        const strips = 5;
        for (let s = 0; s < strips; s++) {
            const f = s / (strips - 1);
            const vx = left.x + (rght.x - left.x) * f;
            const vy = left.y + (rght.y - left.y) * f;
            const vz = left.z + (rght.z - left.z) * f;
            roadVerts.push(vx, vy, vz);
            roadUVs.push(f, i / n * 60);

            // Asphalt color variation — tire tracks, oil stains, wear
            let gray = 0.20 + trackRand() * 0.04; // base asphalt with subtle noise
            // Tire rubber marks — dark strips at ~25% and ~75% across
            const distToTireLine1 = Math.abs(f - 0.22);
            const distToTireLine2 = Math.abs(f - 0.78);
            if (distToTireLine1 < 0.06) gray -= 0.04 * (1 - distToTireLine1 / 0.06);
            if (distToTireLine2 < 0.06) gray -= 0.04 * (1 - distToTireLine2 / 0.06);
            // Racing line wear — slightly lighter path
            const distToRacingLine = Math.abs(f - 0.35);
            if (distToRacingLine < 0.08) gray += 0.015;
            // Oil stain patches (rare)
            if (trackRand() < 0.008) gray -= 0.06;
            // Center line area — slightly different
            if (Math.abs(f - 0.5) < 0.03) gray += 0.01;
            roadColors.push(gray, gray, gray * 0.98, 1);
        }

        if (i < n) {
            const vi = i * strips;
            for (let s = 0; s < strips - 1; s++) {
                roadIndices.push(vi + s, vi + s + strips, vi + s + 1);
                roadIndices.push(vi + s + 1, vi + s + strips, vi + s + strips + 1);
            }
        }

        // Shoulder strips (gravel/grass runoff)
        const sLeft = left.add(right.scale(shoulderWidth));
        sLeft.y = left.y - 0.05;
        const sRight = rght.subtract(right.scale(shoulderWidth));
        sRight.y = rght.y - 0.05;
        shoulderLVerts.push(left.x, left.y, left.z, sLeft.x, sLeft.y, sLeft.z);
        shoulderRVerts.push(rght.x, rght.y, rght.z, sRight.x, sRight.y, sRight.z);

        if (i < n) {
            const vi = i * 2;
            shoulderIndices.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3);
        }

        // Curb vertices
        const cLeft1 = left.clone();
        const cLeft2 = left.add(right.scale(curbW));
        cLeft2.y = cLeft1.y + curbH;
        curbLVerts.push(cLeft1.x, cLeft1.y, cLeft1.z, cLeft2.x, cLeft2.y, cLeft2.z);

        const cRight1 = rght.clone();
        const cRight2 = rght.subtract(right.scale(curbW));
        cRight2.y = cRight1.y + curbH;
        curbRVerts.push(cRight1.x, cRight1.y, cRight1.z, cRight2.x, cRight2.y, cRight2.z);

        const isRed = Math.floor(i / 3) % 2 === 0;
        const cr = 1, cg = isRed ? 0.1 : 1, cb = isRed ? 0.1 : 1, ca = 1;
        curbLColors.push(cr, cg, cb, ca, cr, cg, cb, ca);
        curbRColors.push(cr, cg, cb, ca, cr, cg, cb, ca);

        if (i < n) {
            const vi = i * 2;
            curbIndices.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3);
        }
    }

    // Road mesh with vertex colors for asphalt variation
    const roadMesh = new BABYLON.Mesh(tuid("road"), scene);
    const roadVD = new BABYLON.VertexData();
    roadVD.positions = roadVerts;
    roadVD.indices = roadIndices;
    roadVD.uvs = roadUVs;
    roadVD.colors = roadColors;
    const rn = [];
    BABYLON.VertexData.ComputeNormals(roadVerts, roadIndices, rn);
    roadVD.normals = rn;
    roadVD.applyToMesh(roadMesh);

    const roadMat = new BABYLON.StandardMaterial(tuid("roadMat"), scene);
    roadMat.diffuseColor = new BABYLON.Color3(1, 1, 1); // use vertex colors
    roadMat.specularColor = new BABYLON.Color3(0.18, 0.18, 0.18);
    roadMat.specularPower = 32;
    roadMat.backFaceCulling = false;
    // Wet road Fresnel reflection
    roadMat.reflectionFresnelParameters = new BABYLON.FresnelParameters();
    roadMat.reflectionFresnelParameters.leftColor = new BABYLON.Color3(0.12, 0.12, 0.15);
    roadMat.reflectionFresnelParameters.rightColor = new BABYLON.Color3(0, 0, 0);
    roadMat.reflectionFresnelParameters.power = 3;
    roadMat.reflectionFresnelParameters.bias = 0.05;
    roadMesh.material = roadMat;
    roadMesh.receiveShadows = true;
    roadMesh.hasVertexAlpha = false;

    // Shoulder meshes (gravel color)
    const shoulderMat = new BABYLON.StandardMaterial(tuid("shoulderMat"), scene);
    shoulderMat.diffuseColor = new BABYLON.Color3(0.4, 0.38, 0.32);
    shoulderMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    shoulderMat.backFaceCulling = false;

    [shoulderLVerts, shoulderRVerts].forEach((verts, si) => {
        const mesh = new BABYLON.Mesh(tuid("shoulder"), scene);
        const vd = new BABYLON.VertexData();
        vd.positions = verts;
        vd.indices = shoulderIndices;
        const sn = [];
        BABYLON.VertexData.ComputeNormals(verts, shoulderIndices, sn);
        vd.normals = sn;
        vd.applyToMesh(mesh);
        mesh.material = shoulderMat;
        mesh.receiveShadows = true;
    });

    // Center line dashes
    const dashMat = new BABYLON.StandardMaterial(tuid("dashMat"), scene);
    dashMat.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.9);
    dashMat.emissiveColor = new BABYLON.Color3(0.15, 0.15, 0.12);
    dashMat.backFaceCulling = false;

    // Merge dashes into fewer meshes for perf
    const dashBatchSize = 40;
    let dashVerts = [], dashInds = [], dashVI = 0;
    for (let i = 0; i < n; i += 3) {
        const i0 = i % n;
        const i1 = (i + 1) % n;
        const p0 = trackPoints[i0];
        const p1 = trackPoints[i1];
        const mid = p0.add(p1).scale(0.5);
        const dir = p1.subtract(p0);
        const len = dir.length();
        dir.normalize();
        const right = BABYLON.Vector3.Cross(up, dir).normalize();
        const dw = 0.15;
        const dl = len * 0.35;
        const a = mid.add(right.scale(dw)).add(dir.scale(-dl));
        const b = mid.subtract(right.scale(dw)).add(dir.scale(-dl));
        const c = mid.add(right.scale(dw)).add(dir.scale(dl));
        const d = mid.subtract(right.scale(dw)).add(dir.scale(dl));
        const y = mid.y + 0.28;
        dashVerts.push(a.x,y,a.z, b.x,y,b.z, c.x,y,c.z, d.x,y,d.z);
        dashInds.push(dashVI, dashVI+1, dashVI+2, dashVI+1, dashVI+3, dashVI+2);
        dashVI += 4;

        if (dashVI >= dashBatchSize * 4 || i + 3 >= n) {
            const dm = new BABYLON.Mesh(tuid("dashBatch"), scene);
            const dVD = new BABYLON.VertexData();
            dVD.positions = dashVerts;
            dVD.indices = dashInds;
            const dn = [];
            BABYLON.VertexData.ComputeNormals(dashVerts, dashInds, dn);
            dVD.normals = dn;
            dVD.applyToMesh(dm);
            dm.material = dashMat;
            dashVerts = []; dashInds = []; dashVI = 0;
        }
    }

    // Edge lines (solid white lines on road edges)
    const edgeMat = new BABYLON.StandardMaterial(tuid("edgeMat"), scene);
    edgeMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.85);
    edgeMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.08);
    edgeMat.backFaceCulling = false;

    for (let side = -1; side <= 1; side += 2) {
        const edgeVerts = [], edgeInds = [];
        const lineW = 0.15;
        for (let i = 0; i <= n; i++) {
            const i0 = i % n;
            const i1 = (i + 1) % n;
            const p = trackPoints[i0];
            const pN = trackPoints[i1];
            const dir = pN.subtract(p).normalize();
            const right = BABYLON.Vector3.Cross(up, dir).normalize();
            const edgePos = side > 0 ? p.add(right.scale(hw - 0.3)) : p.subtract(right.scale(hw - 0.3));
            const inner = edgePos.subtract(right.scale(lineW * side));
            const outer = edgePos.add(right.scale(lineW * side));
            const y = p.y + 0.26;
            edgeVerts.push(inner.x, y, inner.z, outer.x, y, outer.z);
            if (i < n) {
                const vi = i * 2;
                edgeInds.push(vi, vi+2, vi+1, vi+1, vi+2, vi+3);
            }
        }
        const edgeMesh = new BABYLON.Mesh(tuid("edge"), scene);
        const eVD = new BABYLON.VertexData();
        eVD.positions = edgeVerts;
        eVD.indices = edgeInds;
        const en = [];
        BABYLON.VertexData.ComputeNormals(edgeVerts, edgeInds, en);
        eVD.normals = en;
        eVD.applyToMesh(edgeMesh);
        edgeMesh.material = edgeMat;
    }

    // Curb meshes
    [[curbLVerts, curbLColors], [curbRVerts, curbRColors]].forEach(([verts, colors], ci) => {
        const curbMesh = new BABYLON.Mesh(tuid("curb"), scene);
        const vd = new BABYLON.VertexData();
        vd.positions = verts;
        vd.indices = curbIndices;
        vd.colors = colors;
        const cn = [];
        BABYLON.VertexData.ComputeNormals(verts, curbIndices, cn);
        vd.normals = cn;
        vd.applyToMesh(curbMesh);
        const cMat = new BABYLON.StandardMaterial(tuid("curbMat"), scene);
        cMat.backFaceCulling = false;
        curbMesh.material = cMat;
        curbMesh.hasVertexAlpha = false;
    });

    // ── Rumble strips on corners (red/white raised bumps inside of turns) ──
    buildRumbleStrips(trackDef);

    // ── Tire rubber marks on braking zones ──
    buildTireMarks(trackDef);

    // Start/finish checkered line
    const startP = trackPoints[0];
    const nextP = trackPoints[1];
    const startDir = nextP.subtract(startP).normalize();
    const startRight = BABYLON.Vector3.Cross(up, startDir).normalize();
    const checkerSize = trackDef.trackWidth / 8;

    // Merge checkers into single mesh
    const chVerts = [], chInds = [], chCols = [];
    let chVI = 0;
    for (let cx = -4; cx < 4; cx++) {
        for (let cz = 0; cz < 2; cz++) {
            const isBlack = (cx + cz) % 2 === 0;
            const g = isBlack ? 0.07 : 1;
            const center = startP.add(startRight.scale((cx + 0.5) * checkerSize)).add(startDir.scale((cz - 0.5) * checkerSize));
            const halfS = checkerSize / 2;
            const y = startP.y + 0.30;
            const r2 = startRight.scale(halfS);
            const f = startDir.scale(halfS);
            const a2 = center.add(r2).add(f);
            const b2 = center.subtract(r2).add(f);
            const c2 = center.add(r2).subtract(f);
            const d2 = center.subtract(r2).subtract(f);
            chVerts.push(a2.x,y,a2.z, b2.x,y,b2.z, c2.x,y,c2.z, d2.x,y,d2.z);
            chInds.push(chVI, chVI+1, chVI+2, chVI+1, chVI+3, chVI+2);
            chCols.push(g,g,g,1, g,g,g,1, g,g,g,1, g,g,g,1);
            chVI += 4;
        }
    }
    const chMesh = new BABYLON.Mesh(tuid("checkers"), scene);
    const chVD = new BABYLON.VertexData();
    chVD.positions = chVerts;
    chVD.indices = chInds;
    chVD.colors = chCols;
    const chN = [];
    BABYLON.VertexData.ComputeNormals(chVerts, chInds, chN);
    chVD.normals = chN;
    chVD.applyToMesh(chMesh);
    const chMat = new BABYLON.StandardMaterial(tuid("checkMat"), scene);
    chMat.backFaceCulling = false;
    chMesh.material = chMat;
    chMesh.hasVertexAlpha = false;

    // Start/finish gantry with timing lights
    buildStartGantry(trackDef, startP, startDir, startRight);

    // Pit lane
    buildPitLane(trackDef, startP, startDir, startRight);

    // LED timing board near start
    buildTimingBoard(trackDef, startP, startDir, startRight);
}

// ── Rumble strips on tight corners ──
function buildRumbleStrips(trackDef) {
    const n = trackPoints.length;
    const hw = trackDef.trackWidth / 2;
    const up = new BABYLON.Vector3(0, 1, 0);
    const curvThreshold = 0.015; // only add to real corners

    const rumbleVerts = [], rumbleInds = [], rumbleCols = [];
    let rVI = 0;

    for (let i = 0; i < n; i += 2) {
        const curv = _curvatureAt(trackPoints, i);
        const absCurv = Math.abs(curv);
        if (absCurv < curvThreshold) continue;

        const p = trackPoints[i];
        const i1 = (i + 1) % n;
        const pN = trackPoints[i1];
        const dir = pN.subtract(p).normalize();
        const right = BABYLON.Vector3.Cross(up, dir).normalize();
        const bank = getTrackBankAt(trackPoints, i / n);

        // Inside of turn: if curv > 0 (left turn), inside is left side
        const insideSide = curv > 0 ? 1 : -1;
        const basePos = p.add(right.scale(insideSide * (hw + 0.1)));
        const bumpW = 0.6;
        const bumpH = 0.12;
        const outer = basePos.add(right.scale(insideSide * bumpW));
        const y0 = p.y + 0.16 + bank * insideSide * 0.5;
        const y1 = y0 + bumpH;

        // Alternate red/white
        const isRed = Math.floor(i / 2) % 2 === 0;
        const cr = isRed ? 0.9 : 0.95;
        const cg = isRed ? 0.1 : 0.95;
        const cb = isRed ? 0.1 : 0.95;

        // Simple raised quad
        rumbleVerts.push(
            basePos.x, y0, basePos.z,
            outer.x, y1, outer.z,
            basePos.x + dir.x * 1.2, y0, basePos.z + dir.z * 1.2,
            outer.x + dir.x * 1.2, y1, outer.z + dir.z * 1.2
        );
        rumbleInds.push(rVI, rVI+1, rVI+2, rVI+1, rVI+3, rVI+2);
        for (let k = 0; k < 4; k++) rumbleCols.push(cr, cg, cb, 1);
        rVI += 4;
    }

    if (rumbleVerts.length > 0) {
        const mesh = new BABYLON.Mesh(tuid("rumble"), scene);
        const vd = new BABYLON.VertexData();
        vd.positions = rumbleVerts;
        vd.indices = rumbleInds;
        vd.colors = rumbleCols;
        const rn = [];
        BABYLON.VertexData.ComputeNormals(rumbleVerts, rumbleInds, rn);
        vd.normals = rn;
        vd.applyToMesh(mesh);
        const mat = new BABYLON.StandardMaterial(tuid("rumbleMat"), scene);
        mat.backFaceCulling = false;
        mesh.material = mat;
        mesh.hasVertexAlpha = false;
    }
}

// ── Tire rubber marks on braking zones (before sharp corners) ──
function buildTireMarks(trackDef) {
    const n = trackPoints.length;
    const hw = trackDef.trackWidth / 2;
    const up = new BABYLON.Vector3(0, 1, 0);
    const markMat = new BABYLON.StandardMaterial(tuid("tireMarkMat"), scene);
    markMat.diffuseColor = new BABYLON.Color3(0.08, 0.08, 0.08);
    markMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    markMat.backFaceCulling = false;
    markMat.alpha = 0.6;

    const markVerts = [], markInds = [];
    let mVI = 0;
    _trackSeed = 777;

    // Find sharp corners and add braking marks before them
    for (let i = 0; i < n; i += 4) {
        const curv = Math.abs(_curvatureAt(trackPoints, i));
        if (curv < 0.025) continue;

        // Place 2-3 tire mark lines leading into the corner
        const markCount = curv > 0.04 ? 3 : 2;
        for (let m = 0; m < markCount; m++) {
            const idx = ((i - 6 - m * 3) + n) % n;
            const p = trackPoints[idx];
            const pN = trackPoints[(idx + 1) % n];
            const dir = pN.subtract(p).normalize();
            const right = BABYLON.Vector3.Cross(up, dir).normalize();

            // Two tire marks at ~35% and ~65% width
            for (let lane = 0; lane < 2; lane++) {
                const offset = (lane === 0 ? -0.3 : 0.3) * hw + (trackRand() - 0.5) * 1.5;
                const pos = p.add(right.scale(offset));
                const markW = 0.18 + trackRand() * 0.08;
                const markL = 1.5 + trackRand() * 1.0;
                const y = p.y + 0.165;

                const a = pos.add(right.scale(markW)).subtract(dir.scale(markL));
                const b = pos.subtract(right.scale(markW)).subtract(dir.scale(markL));
                const c = pos.add(right.scale(markW)).add(dir.scale(markL));
                const d = pos.subtract(right.scale(markW)).add(dir.scale(markL));

                markVerts.push(a.x,y,a.z, b.x,y,b.z, c.x,y,c.z, d.x,y,d.z);
                markInds.push(mVI, mVI+1, mVI+2, mVI+1, mVI+3, mVI+2);
                mVI += 4;
            }
        }
    }

    if (markVerts.length > 0) {
        const mesh = new BABYLON.Mesh(tuid("tireMarks"), scene);
        const vd = new BABYLON.VertexData();
        vd.positions = markVerts;
        vd.indices = markInds;
        const mn = [];
        BABYLON.VertexData.ComputeNormals(markVerts, markInds, mn);
        vd.normals = mn;
        vd.applyToMesh(mesh);
        mesh.material = markMat;
    }
}

// ── Pit lane area ──
function buildPitLane(trackDef, startP, startDir, startRight) {
    const up = new BABYLON.Vector3(0, 1, 0);
    const hw = trackDef.trackWidth / 2;

    // Pit lane is offset to the right of the start, parallel to the track
    const pitOffset = hw + 8;
    const pitLen = 40;
    const pitW = 5;

    const pitBase = startP.add(startRight.scale(-pitOffset));

    // Pit lane surface
    const pitVerts = [], pitInds = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
        const f = (i / steps - 0.5) * pitLen;
        const pos = pitBase.add(startDir.scale(f));
        pitVerts.push(
            pos.x, startP.y + 0.12, pos.z,
            pos.x + startRight.x * pitW, startP.y + 0.12, pos.z + startRight.z * pitW
        );
        if (i < steps) {
            const vi = i * 2;
            pitInds.push(vi, vi+2, vi+1, vi+1, vi+2, vi+3);
        }
    }
    const pitMesh = new BABYLON.Mesh(tuid("pitLane"), scene);
    const pitVD = new BABYLON.VertexData();
    pitVD.positions = pitVerts;
    pitVD.indices = pitInds;
    const pn = [];
    BABYLON.VertexData.ComputeNormals(pitVerts, pitInds, pn);
    pitVD.normals = pn;
    pitVD.applyToMesh(pitMesh);

    const pitMat = new BABYLON.StandardMaterial(tuid("pitMat"), scene);
    pitMat.diffuseColor = new BABYLON.Color3(0.25, 0.25, 0.25);
    pitMat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
    pitMat.backFaceCulling = false;
    pitMesh.material = pitMat;
    pitMesh.receiveShadows = true;

    // Pit wall (low concrete wall between pit and track)
    const pitWall = BABYLON.MeshBuilder.CreateBox(tuid("pitWall"), {
        width: pitLen, height: 1.0, depth: 0.4
    }, scene);
    const wallMat = new BABYLON.StandardMaterial(tuid("pitWallMat"), scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.6);
    pitWall.material = wallMat;
    const wallPos = pitBase.add(startRight.scale(pitW * 0.5));
    pitWall.position = new BABYLON.Vector3(wallPos.x, startP.y + 0.5, wallPos.z);
    pitWall.rotation.y = Math.atan2(startDir.x, startDir.z);

    // Pit crew figures (simple box people) — 4 crew per pit box, 3 boxes
    const crewMat = new BABYLON.StandardMaterial(tuid("crewMat"), scene);
    crewMat.diffuseColor = new BABYLON.Color3(0.9, 0.1, 0.1);
    const crewBodyMat = new BABYLON.StandardMaterial(tuid("crewBodyMat"), scene);
    crewBodyMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.3);

    for (let box = 0; box < 3; box++) {
        const boxCenter = pitBase.add(startDir.scale((box - 1) * 10));
        for (let c = 0; c < 3; c++) {
            const crewPos = boxCenter.add(startRight.scale(-1 + c * 0.8));
            // Body
            const body = BABYLON.MeshBuilder.CreateBox(tuid("crewBody"), {
                width: 0.4, height: 1.2, depth: 0.3
            }, scene);
            body.material = crewBodyMat;
            body.position = new BABYLON.Vector3(crewPos.x, startP.y + 0.7, crewPos.z);
            // Head
            const head = BABYLON.MeshBuilder.CreateSphere(tuid("crewHead"), {
                diameter: 0.3, segments: 4
            }, scene);
            head.material = crewMat;
            head.position = new BABYLON.Vector3(crewPos.x, startP.y + 1.5, crewPos.z);
        }
    }
}

// ── LED timing board ──
function buildTimingBoard(trackDef, startP, startDir, startRight) {
    const hw = trackDef.trackWidth / 2;
    const boardPos = startP.add(startRight.scale(-(hw + 12))).add(startDir.scale(8));

    // Support posts
    const postMat = new BABYLON.StandardMaterial(tuid("tbPost"), scene);
    postMat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
    for (let s = -1; s <= 1; s += 2) {
        const post = BABYLON.MeshBuilder.CreateCylinder(tuid("tbPostMesh"), {
            diameter: 0.3, height: 5, tessellation: 6
        }, scene);
        post.material = postMat;
        post.position = new BABYLON.Vector3(
            boardPos.x + startRight.x * s * 2.5,
            startP.y + 2.5,
            boardPos.z + startRight.z * s * 2.5
        );
    }

    // Screen
    const screen = BABYLON.MeshBuilder.CreateBox(tuid("tbScreen"), {
        width: 6, height: 2.5, depth: 0.2
    }, scene);
    const screenMat = new BABYLON.StandardMaterial(tuid("tbScreenMat"), scene);
    screenMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    screenMat.emissiveColor = new BABYLON.Color3(0.0, 0.15, 0.0);
    screen.material = screenMat;
    screen.position = new BABYLON.Vector3(boardPos.x, startP.y + 4.2, boardPos.z);
    screen.rotation.y = Math.atan2(startDir.x, startDir.z);
    if (glowLayer) glowLayer.addIncludedOnlyMesh(screen);

    // Simulated LED rows (colored stripes on the screen face)
    for (let row = 0; row < 3; row++) {
        const ledStrip = BABYLON.MeshBuilder.CreatePlane(tuid("led"), {
            width: 5.2, height: 0.4
        }, scene);
        const ledMat = new BABYLON.StandardMaterial(tuid("ledMat"), scene);
        const colors = [
            new BABYLON.Color3(1, 0.1, 0.1),
            new BABYLON.Color3(0.1, 1, 0.1),
            new BABYLON.Color3(1, 0.8, 0.1)
        ];
        ledMat.emissiveColor = colors[row].scale(0.6);
        ledMat.disableLighting = true;
        ledStrip.material = ledMat;
        ledStrip.position = new BABYLON.Vector3(
            boardPos.x + startDir.x * 0.12,
            startP.y + 3.3 + row * 0.7,
            boardPos.z + startDir.z * 0.12
        );
        ledStrip.rotation.y = Math.atan2(startDir.x, startDir.z);
    }
}

// Build a start/finish gantry arch with timing lights
function buildStartGantry(trackDef, startP, startDir, startRight) {
    const hw = trackDef.trackWidth / 2;
    const pillarMat = new BABYLON.StandardMaterial(tuid("pillarMat"), scene);
    pillarMat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
    pillarMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);

    const bannerMat = new BABYLON.StandardMaterial(tuid("bannerMat"), scene);
    bannerMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    bannerMat.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.05);

    // Two pillars
    for (let side = -1; side <= 1; side += 2) {
        const pillar = BABYLON.MeshBuilder.CreateCylinder(tuid("gantryPillar"), {
            diameter: 0.5, height: 10, tessellation: 8
        }, scene);
        pillar.material = pillarMat;
        const pos = startP.add(startRight.scale(side * (hw + 2)));
        pillar.position = new BABYLON.Vector3(pos.x, startP.y + 5, pos.z);
        if (shadowGenerator) shadowGenerator.addShadowCaster(pillar);
    }

    // Cross beam
    const beam = BABYLON.MeshBuilder.CreateBox(tuid("gantryBeam"), {
        width: trackDef.trackWidth + 4, height: 1.5, depth: 0.6
    }, scene);
    beam.material = bannerMat;
    beam.position = new BABYLON.Vector3(startP.x, startP.y + 10, startP.z);
    beam.rotation.y = Math.atan2(startRight.x, startRight.z);
    if (shadowGenerator) shadowGenerator.addShadowCaster(beam);

    // ── Timing lights on the gantry (5 red lights like F1 start) ──
    const lightsMat = new BABYLON.StandardMaterial(tuid("timingLightMat"), scene);
    lightsMat.emissiveColor = new BABYLON.Color3(0.8, 0, 0);
    lightsMat.disableLighting = true;

    for (let li = 0; li < 5; li++) {
        const offset = (li - 2) * 1.8;
        const lightBulb = BABYLON.MeshBuilder.CreateSphere(tuid("timingLight"), {
            diameter: 0.5, segments: 6
        }, scene);
        lightBulb.material = lightsMat;
        const lpos = startP.add(startRight.scale(offset));
        lightBulb.position = new BABYLON.Vector3(lpos.x, startP.y + 10.8, lpos.z);
        // Housing box behind the light
        const housing = BABYLON.MeshBuilder.CreateBox(tuid("lightHousing"), {
            width: 0.7, height: 0.7, depth: 0.3
        }, scene);
        housing.material = bannerMat;
        housing.position = new BABYLON.Vector3(
            lpos.x - startDir.x * 0.3,
            startP.y + 10.8,
            lpos.z - startDir.z * 0.3
        );
        housing.rotation.y = Math.atan2(startRight.x, startRight.z);
    }
}

function addScenery(trackDef) {
    const name = trackDef.name;
    const isCity = name === 'Night City' || name === 'Midnight Highway';
    const isDesert = name === 'Desert Storm' || name === 'Volcano Ring';
    const isSnow = name === 'Snow Peak' || name === 'Thunder Mountain';
    const isTropical = name === 'Tropical Island';
    const isCoastal = name === 'Coastal Drive';
    const isNight = trackDef.skyColor === 0x0a0a2e || trackDef.skyColor === 0x050515 || trackDef.skyColor === 0x331111;
    const up = new BABYLON.Vector3(0, 1, 0);

    _trackSeed = 9999;

    // ── Terrain — Slow Roads-style rolling landscape ──
    // Larger terrain, higher resolution, better blending
    const terrainSize = 2400;
    const terrainSeg = 200;
    const terrain = BABYLON.MeshBuilder.CreateGround(tuid("terrain"), {
        width: terrainSize, height: terrainSize,
        subdivisions: terrainSeg, updatable: true
    }, scene);

    const posAttr = terrain.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const terrainColors = [];

    // Pre-sample track points densely for smooth road-terrain blending
    const trackSamples = [];
    for (let ti = 0; ti < trackPoints.length; ti += 2) {
        const tp = trackPoints[ti];
        trackSamples.push({ x: tp.x, y: tp.y, z: tp.z });
    }

    // Biome base colors — softer, more pastel
    const baseGreen = isDesert ? [0.78, 0.68, 0.45] :
                      isSnow ? [0.90, 0.91, 0.94] :
                      isCity ? [0.12, 0.12, 0.18] :
                      isTropical ? [0.25, 0.58, 0.30] :
                      [0.32, 0.56, 0.22]; // softer grass green

    // Noise helper — multi-octave value noise from sin/cos
    function terrainNoise(x, z, scale, octaves) {
        let val = 0, amp = 1, freq = scale, totalAmp = 0;
        for (let o = 0; o < octaves; o++) {
            val += (Math.sin(x * freq + o * 5.1) * Math.cos(z * freq * 0.87 + o * 3.7)
                  + Math.sin(x * freq * 0.73 + z * freq * 0.53 + o * 7.3) * 0.5) * amp;
            totalAmp += amp;
            amp *= 0.45;
            freq *= 2.1;
        }
        return val / totalAmp;
    }

    const trackHW = (trackDef.trackWidth || 14) / 2 + 4; // match road + shoulder width
    const blendDist = 80; // wider transition for smoother road-terrain merge

    for (let i = 0; i < posAttr.length; i += 3) {
        const x = posAttr[i];
        const z = posAttr[i + 2];

        // Generate natural terrain height — layered noise for organic hills
        let h = terrainNoise(x, z, 0.008, 5) * 25;  // broad rolling hills
        h += terrainNoise(x + 500, z + 300, 0.025, 3) * 8; // medium undulation
        h += terrainNoise(x + 100, z + 700, 0.06, 2) * 3;  // fine bumps

        // Biome scaling
        if (isDesert) { h = Math.max(h * 0.5, -1); } // dunes, mostly above ground
        else if (isSnow) { h *= 2.0; } // dramatic peaks
        else if (isTropical) { h *= 0.5; } // gentle rolling
        else if (isCity) { h *= 0.15; } // mostly flat with subtle undulation

        // Distance from world center — taper up at edges for "distant mountains" feel
        const distFromCenter = Math.sqrt(x * x + z * z);
        const edgeFactor = Math.max(0, (distFromCenter - 400) / 600);
        h += edgeFactor * edgeFactor * 30; // hills rise at edges like distant mountains

        // Find closest track point
        let minDist = Infinity, closestY = 0;
        for (const ts of trackSamples) {
            const dx = x - ts.x, dz = z - ts.z;
            const d = dx * dx + dz * dz;
            if (d < minDist) { minDist = d; closestY = ts.y; }
        }
        minDist = Math.sqrt(minDist);

        // Blend terrain with road — wide smooth transition
        if (minDist < trackHW) {
            // Under the road — match road height exactly
            h = closestY - 0.2;
        } else if (minDist < trackHW + blendDist) {
            // Smooth transition from road level to natural terrain
            let t = (minDist - trackHW) / blendDist;
            t = t * t * t * (t * (t * 6 - 15) + 10); // quintic smoothstep (smoother than cubic)
            const roadH = closestY - 0.2;
            h = roadH + (h - roadH) * t;
        }

        posAttr[i + 1] = h;

        // ── Vertex colors — rich, natural variation ──
        let cr = baseGreen[0], cg = baseGreen[1], cb = baseGreen[2];

        // Large landscape patches (meadows, darker patches)
        const patch1 = terrainNoise(x + 200, z + 100, 0.015, 2) * 0.12;
        const patch2 = terrainNoise(x - 300, z + 400, 0.04, 2) * 0.06;
        cr += patch1 * 0.4 + patch2 * 0.3;
        cg += patch1 + patch2;
        cb += patch1 * 0.2 + patch2 * 0.15;

        // Fine grass texture variation
        const grass = terrainNoise(x, z, 0.3, 2) * 0.05;
        cr += grass * 0.2;
        cg += grass;
        cb += grass * 0.1;

        // Height-based coloring — lower=richer green, higher=yellower/browner
        const heightBlend = Math.max(0, Math.min(1, (h - 2) / 20));
        cr += heightBlend * 0.08;
        cg -= heightBlend * 0.03;
        cb -= heightBlend * 0.04;

        // Slope darkening — steeper areas are darker (approximate from height neighbors)
        // Use local height gradient as proxy for slope
        const slopeProxy = Math.abs(terrainNoise(x, z, 0.05, 2)) * 0.06;
        cr -= slopeProxy;
        cg -= slopeProxy * 0.8;
        cb -= slopeProxy * 0.5;

        // Road shoulder — dirt/gravel transition
        if (minDist < trackHW + 20 && !isCity) {
            const shoulderBlend = Math.max(0, 1 - (minDist - trackHW) / 20);
            const sb2 = shoulderBlend * shoulderBlend;
            if (isDesert) {
                cr += sb2 * 0.05;
                cg -= sb2 * 0.02;
            } else if (isSnow) {
                // Snow is lighter near road (plowed)
                cr += sb2 * 0.05;
                cg += sb2 * 0.05;
                cb += sb2 * 0.05;
            } else {
                // Worn grass/dirt
                cr += sb2 * 0.12;
                cg -= sb2 * 0.06;
                cb -= sb2 * 0.05;
            }
        }

        // Atmospheric fade at distance — blend toward fog color at terrain edges
        if (distFromCenter > 500) {
            const fogBlend = Math.min(1, (distFromCenter - 500) / 600);
            const fogCol = scene.fogColor;
            cr = cr * (1 - fogBlend * 0.5) + fogCol.r * fogBlend * 0.5;
            cg = cg * (1 - fogBlend * 0.5) + fogCol.g * fogBlend * 0.5;
            cb = cb * (1 - fogBlend * 0.5) + fogCol.b * fogBlend * 0.5;
        }

        // Clamp
        cr = Math.max(0, Math.min(1, cr));
        cg = Math.max(0, Math.min(1, cg));
        cb = Math.max(0, Math.min(1, cb));
        terrainColors.push(cr, cg, cb, 1);
    }

    terrain.updateVerticesData(BABYLON.VertexBuffer.PositionKind, posAttr);
    terrain.createNormals(true);
    terrain.position.y = 0;
    terrain.receiveShadows = true;

    // Apply vertex colors
    terrain.setVerticesData(BABYLON.VertexBuffer.ColorKind, terrainColors);

    const terrainMat = new BABYLON.StandardMaterial(tuid("terrainMat"), scene);
    terrainMat.diffuseColor = new BABYLON.Color3(1, 1, 1); // vertex colors drive appearance
    terrainMat.specularColor = isSnow ? new BABYLON.Color3(0.15, 0.15, 0.2) : new BABYLON.Color3(0.02, 0.02, 0.02);
    terrainMat.backFaceCulling = false;
    terrain.material = terrainMat;

    // Terrain height sampler for vegetation placement
    scene._getTerrainHeight = function(x, z) {
        let h = terrainNoise(x, z, 0.008, 5) * 25;
        h += terrainNoise(x + 500, z + 300, 0.025, 3) * 8;
        h += terrainNoise(x + 100, z + 700, 0.06, 2) * 3;
        if (isDesert) { h = Math.max(h * 0.5, -1); }
        else if (isSnow) { h *= 2.0; }
        else if (isTropical) { h *= 0.5; }
        else if (isCity) { h *= 0.15; }
        const distFromCenter = Math.sqrt(x * x + z * z);
        const edgeFactor = Math.max(0, (distFromCenter - 400) / 600);
        h += edgeFactor * edgeFactor * 30;
        // Blend near track
        let minDist = Infinity, closestY = 0;
        for (const ts of trackSamples) {
            const dx = x - ts.x, dz = z - ts.z;
            const d = dx * dx + dz * dz;
            if (d < minDist) { minDist = d; closestY = ts.y; }
        }
        minDist = Math.sqrt(minDist);
        if (minDist < trackHW) {
            h = closestY - 0.2;
        } else if (minDist < trackHW + blendDist) {
            let t = (minDist - trackHW) / blendDist;
            t = t * t * t * (t * (t * 6 - 15) + 10);
            h = (closestY - 0.2) + (h - (closestY - 0.2)) * t;
        }
        return h;
    };

    // ── Grandstands near start line ──
    const startP = trackPoints[0];
    const startDir = getTrackDirectionAt(trackPoints, 0);
    const startRight = BABYLON.Vector3.Cross(up, startDir).normalize();

    for (let side of [-1, 1]) {
        const standGroup = new BABYLON.TransformNode(tuid("stand"), scene);
        for (let tier = 0; tier < 6; tier++) {
            const seatMat = new BABYLON.StandardMaterial(tuid("seatMat"), scene);
            seatMat.diffuseColor = isCity ? hexToColor3(0x333355) :
                                   new BABYLON.Color3(0.55 + tier * 0.05, 0.55 + tier * 0.03, 0.55);
            const seat = BABYLON.MeshBuilder.CreateBox(tuid("seat"), {
                width: 35, height: 1.2, depth: 3
            }, scene);
            seat.material = seatMat;
            seat.position = new BABYLON.Vector3(0, tier * 1.8, tier * 2.2);
            seat.parent = standGroup;
            seat.receiveShadows = true;
        }
        const roofMat = new BABYLON.StandardMaterial(tuid("roofMat"), scene);
        roofMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.35);
        const roof = BABYLON.MeshBuilder.CreateBox(tuid("standRoof"), {
            width: 37, height: 0.3, depth: 16
        }, scene);
        roof.material = roofMat;
        roof.position = new BABYLON.Vector3(0, 12, 5);
        roof.parent = standGroup;

        const pos = startP.add(startRight.scale(side * (trackDef.trackWidth / 2 + 18)));
        standGroup.position = pos;
        standGroup.rotation.y = Math.atan2(startDir.x, startDir.z);
    }

    // ── Track-side barriers (Armco) ──
    // addTrackBarriers(trackDef);

    // ── Catch fencing on fast corners ──
    // addCatchFencing(trackDef);

    // ── Sponsor banners/billboards ──
    addSponsorBanners(trackDef);

    // ── Flag marshal posts ──
    addMarshalPosts(trackDef);

    // ── Grass tufts & bushes near track edge ──
    if (!isCity && !isDesert) {
        addTrackEdgeVegetation(trackDef, isSnow);
    }

    // ── Environment objects ──
    if (!isCity && !isDesert) {
        addNaturalScenery(trackDef, isSnow, isTropical);
    } else if (isCity) {
        addCityScenery(trackDef, isNight);
    } else if (isDesert) {
        addDesertScenery(trackDef);
    }

    // ── Clouds (billboard planes) ──
    if (!isNight) {
        addClouds(trackDef);
    }

    // ── Dust motes for daytime ──
    if (!isNight && !isSnow) {
        addDustMotes();
    }

    // ── Birds for coastal/tropical ──
    if (isCoastal || isTropical) {
        addBirds();
    }

    // ── Atmospheric particles ──
    if (isSnow) {
        addSnowbanks(trackDef);
        createSnowfall();
    }
    if (name === 'Volcano Ring') {
        createEmberParticles();
    }
}

// ── Catch fencing on fast corners (tall mesh on outside of turns) ──
function addCatchFencing(trackDef) {
    const n = trackPoints.length;
    const hw = trackDef.trackWidth / 2;
    const up = new BABYLON.Vector3(0, 1, 0);

    const fenceMat = new BABYLON.StandardMaterial(tuid("fenceMat"), scene);
    fenceMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    fenceMat.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15);
    fenceMat.alpha = 0.25;
    fenceMat.backFaceCulling = false;

    const fenceH = 3;
    const curvThreshold = 0.02;
    let fenceVerts = [], fenceInds = [], fVI = 0;
    let inFence = false;

    for (let i = 0; i < n; i += 3) {
        const curv = _curvatureAt(trackPoints, i);
        const absCurv = Math.abs(curv);

        if (absCurv > curvThreshold) {
            const p = trackPoints[i];
            const i1 = (i + 1) % n;
            const pN = trackPoints[i1];
            const dir = pN.subtract(p).normalize();
            const right = BABYLON.Vector3.Cross(up, dir).normalize();

            // Outside of turn
            const outsideSide = curv > 0 ? -1 : 1;
            const basePos = p.add(right.scale(outsideSide * (hw + 5)));
            const y0 = p.y + 0.1;

            fenceVerts.push(basePos.x, y0, basePos.z, basePos.x, y0 + fenceH, basePos.z);
            if (fVI >= 2 && inFence) {
                fenceInds.push(fVI-2, fVI, fVI-1, fVI-1, fVI, fVI+1);
            }
            fVI += 2;
            inFence = true;
        } else {
            inFence = false;
        }
    }

    if (fenceVerts.length > 0) {
        const mesh = new BABYLON.Mesh(tuid("catchFence"), scene);
        const vd = new BABYLON.VertexData();
        vd.positions = fenceVerts;
        vd.indices = fenceInds;
        const fn = [];
        BABYLON.VertexData.ComputeNormals(fenceVerts, fenceInds, fn);
        vd.normals = fn;
        vd.applyToMesh(mesh);
        mesh.material = fenceMat;
    }
}

// ── Sponsor banners/billboards along the track ──
function addSponsorBanners(trackDef) {
    const n = trackPoints.length;
    const hw = trackDef.trackWidth / 2;
    const up = new BABYLON.Vector3(0, 1, 0);

    // Sponsor colors (simulated brand colors)
    const sponsorColors = [
        { bg: new BABYLON.Color3(0.9, 0.1, 0.1), em: new BABYLON.Color3(0.3, 0.02, 0.02) },
        { bg: new BABYLON.Color3(0.1, 0.1, 0.8), em: new BABYLON.Color3(0.02, 0.02, 0.2) },
        { bg: new BABYLON.Color3(0.1, 0.7, 0.1), em: new BABYLON.Color3(0.02, 0.15, 0.02) },
        { bg: new BABYLON.Color3(0.9, 0.7, 0.0), em: new BABYLON.Color3(0.2, 0.15, 0.0) },
        { bg: new BABYLON.Color3(0.8, 0.2, 0.8), em: new BABYLON.Color3(0.15, 0.03, 0.15) },
        { bg: new BABYLON.Color3(0.0, 0.7, 0.8), em: new BABYLON.Color3(0.0, 0.12, 0.15) },
    ];

    // Place billboards every ~25 track points
    const bannerSpacing = Math.floor(n / 12);
    for (let b = 0; b < 12; b++) {
        const i = (b * bannerSpacing + Math.floor(n * 0.1)) % n;
        const p = trackPoints[i];
        const dir = getTrackDirectionAt(trackPoints, i / n);
        const right = BABYLON.Vector3.Cross(up, dir).normalize();

        const side = b % 2 === 0 ? 1 : -1;
        const sc = sponsorColors[b % sponsorColors.length];

        // Billboard panel
        const billboard = BABYLON.MeshBuilder.CreatePlane(tuid("billboard"), {
            width: 8, height: 2.5
        }, scene);
        const billMat = new BABYLON.StandardMaterial(tuid("billMat"), scene);
        billMat.diffuseColor = sc.bg;
        billMat.emissiveColor = sc.em;
        billMat.backFaceCulling = false;
        billboard.material = billMat;

        const bpos = p.add(right.scale(side * (hw + 5)));
        billboard.position = new BABYLON.Vector3(bpos.x, p.y + 2.5, bpos.z);
        billboard.rotation.y = Math.atan2(dir.x, dir.z);

        // Support poles
        for (let ps = -1; ps <= 1; ps += 2) {
            const pole = BABYLON.MeshBuilder.CreateCylinder(tuid("billPole"), {
                diameter: 0.15, height: 3.5, tessellation: 6
            }, scene);
            const poleMat = new BABYLON.StandardMaterial(tuid("billPoleMat"), scene);
            poleMat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
            pole.material = poleMat;
            pole.position = new BABYLON.Vector3(
                bpos.x + right.x * ps * 3.5,
                p.y + 1.75,
                bpos.z + right.z * ps * 3.5
            );
        }

        // Color stripe at bottom (simulating text area)
        const stripe = BABYLON.MeshBuilder.CreatePlane(tuid("billStripe"), {
            width: 7.5, height: 0.5
        }, scene);
        const stripeMat = new BABYLON.StandardMaterial(tuid("billStripeMat"), scene);
        stripeMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
        stripeMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        stripeMat.backFaceCulling = false;
        stripe.material = stripeMat;
        stripe.position = new BABYLON.Vector3(bpos.x + dir.x * 0.05, p.y + 1.5, bpos.z + dir.z * 0.05);
        stripe.rotation.y = Math.atan2(dir.x, dir.z);
    }
}

// ── Flag marshal posts around the circuit ──
function addMarshalPosts(trackDef) {
    const n = trackPoints.length;
    const hw = trackDef.trackWidth / 2;
    const up = new BABYLON.Vector3(0, 1, 0);
    const postCount = 6;
    const spacing = Math.floor(n / postCount);

    const postMat = new BABYLON.StandardMaterial(tuid("marshalPostMat"), scene);
    postMat.diffuseColor = new BABYLON.Color3(1, 0.6, 0);

    const flagColors = [
        new BABYLON.Color3(1, 1, 0),    // yellow
        new BABYLON.Color3(0, 0.8, 0),  // green
        new BABYLON.Color3(0, 0, 1),    // blue
        new BABYLON.Color3(1, 1, 1),    // white
        new BABYLON.Color3(1, 0, 0),    // red
        new BABYLON.Color3(1, 1, 0),    // yellow
    ];

    for (let m = 0; m < postCount; m++) {
        const i = (m * spacing + Math.floor(n * 0.05)) % n;
        const p = trackPoints[i];
        const dir = getTrackDirectionAt(trackPoints, i / n);
        const right = BABYLON.Vector3.Cross(up, dir).normalize();

        const side = 1;
        const mpos = p.add(right.scale(side * (hw + 4)));

        // Post structure (small shelter)
        const shelter = BABYLON.MeshBuilder.CreateBox(tuid("marshalShelter"), {
            width: 1.5, height: 2.2, depth: 1.5
        }, scene);
        shelter.material = postMat;
        shelter.position = new BABYLON.Vector3(mpos.x, p.y + 1.1, mpos.z);

        // Flag pole
        const pole = BABYLON.MeshBuilder.CreateCylinder(tuid("flagPole"), {
            diameter: 0.08, height: 3, tessellation: 4
        }, scene);
        const poleMat = new BABYLON.StandardMaterial(tuid("fpMat"), scene);
        poleMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        pole.material = poleMat;
        pole.position = new BABYLON.Vector3(mpos.x, p.y + 3.5, mpos.z);

        // Flag (small plane)
        const flag = BABYLON.MeshBuilder.CreatePlane(tuid("flag"), {
            width: 0.8, height: 0.6
        }, scene);
        const flagMat = new BABYLON.StandardMaterial(tuid("flagMat"), scene);
        flagMat.diffuseColor = flagColors[m];
        flagMat.emissiveColor = flagColors[m].scale(0.15);
        flagMat.backFaceCulling = false;
        flag.material = flagMat;
        flag.position = new BABYLON.Vector3(mpos.x + 0.4, p.y + 4.7, mpos.z);
    }
}

// ── Grass tufts & bushes near track edge ──
function addTrackEdgeVegetation(trackDef, isSnow) {
    const n = trackPoints.length;
    const hw = trackDef.trackWidth / 2;
    const up = new BABYLON.Vector3(0, 1, 0);

    // Merge tufts into batches
    const grassColor = isSnow ? new BABYLON.Color3(0.55, 0.6, 0.5) : new BABYLON.Color3(0.2, 0.55, 0.15);
    const grassMat = new BABYLON.StandardMaterial(tuid("grassMat"), scene);
    grassMat.diffuseColor = grassColor;
    grassMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    grassMat.alpha = 0.7;
    grassMat.backFaceCulling = false;

    const bushMat = new BABYLON.StandardMaterial(tuid("bushMat"), scene);
    bushMat.diffuseColor = isSnow ?
        new BABYLON.Color3(0.3, 0.42, 0.25) :
        new BABYLON.Color3(0.12, 0.4, 0.1);
    bushMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);

    _trackSeed = 3456;

    // Place grass tufts
    const grassVerts = [], grassInds = [];
    let gVI = 0;
    for (let i = 0; i < n; i += 4) {
        const p = trackPoints[i];
        const dir = getTrackDirectionAt(trackPoints, i / n);
        const right = BABYLON.Vector3.Cross(up, dir).normalize();

        for (let side = -1; side <= 1; side += 2) {
            if (trackRand() < 0.15) continue;
            const dist = hw + 3 + trackRand() * 8;
            const gpos = p.add(right.scale(side * dist));
            const gH = 0.4 + trackRand() * 0.4;
            const gW = 0.25 + trackRand() * 0.2;

            // Grass tuft as a crossed pair of planes (X shape from above)
            const cx = gpos.x, cy = p.y + gH * 0.5, cz = gpos.z;
            // Plane 1
            grassVerts.push(
                cx - gW, p.y, cz,  cx + gW, p.y, cz,
                cx - gW, p.y + gH, cz,  cx + gW, p.y + gH, cz
            );
            grassInds.push(gVI, gVI+1, gVI+2, gVI+1, gVI+3, gVI+2);
            gVI += 4;
            // Plane 2 (rotated 90)
            grassVerts.push(
                cx, p.y, cz - gW,  cx, p.y, cz + gW,
                cx, p.y + gH, cz - gW,  cx, p.y + gH, cz + gW
            );
            grassInds.push(gVI, gVI+1, gVI+2, gVI+1, gVI+3, gVI+2);
            gVI += 4;
        }
    }

    if (grassVerts.length > 0) {
        const mesh = new BABYLON.Mesh(tuid("grassTufts"), scene);
        const vd = new BABYLON.VertexData();
        vd.positions = grassVerts;
        vd.indices = grassInds;
        const gn = [];
        BABYLON.VertexData.ComputeNormals(grassVerts, grassInds, gn);
        vd.normals = gn;
        vd.applyToMesh(mesh);
        mesh.material = grassMat;
    }

    // Scattered bushes (smaller, fewer)
    bushMat.alpha = 0.85;
    for (let i = 0; i < 25; i++) {
        const ti = Math.floor(trackRand() * n);
        const p = trackPoints[ti];
        const dir = getTrackDirectionAt(trackPoints, ti / n);
        const right = BABYLON.Vector3.Cross(up, dir).normalize();
        const side = trackRand() > 0.5 ? 1 : -1;
        const dist = hw + 15 + trackRand() * 12;
        const bpos = p.add(right.scale(side * dist));
        const bSize = 0.5 + trackRand() * 0.6;

        const bush = BABYLON.MeshBuilder.CreateCylinder(tuid("bush"), {
            diameterTop: 0, diameterBottom: bSize, height: bSize * 0.7, tessellation: 5
        }, scene);
        bush.material = bushMat;
        bush.position = new BABYLON.Vector3(bpos.x, p.y + bSize * 0.35, bpos.z);
    }

    // ── Trackside trees (follow the actual track path, very visible) ──
    const trunkMat2 = new BABYLON.StandardMaterial(tuid("tsTrunk"), scene);
    trunkMat2.diffuseColor = new BABYLON.Color3(0.35, 0.22, 0.1);
    trunkMat2.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    const foliageMat = new BABYLON.StandardMaterial(tuid("tsFoliage"), scene);
    foliageMat.diffuseColor = isSnow ? new BABYLON.Color3(0.15, 0.3, 0.15) : new BABYLON.Color3(0.12, 0.5, 0.12);
    foliageMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    const foliageMat2 = new BABYLON.StandardMaterial(tuid("tsFoliage2"), scene);
    foliageMat2.diffuseColor = isSnow ? new BABYLON.Color3(0.12, 0.25, 0.12) : new BABYLON.Color3(0.08, 0.42, 0.1);

    _trackSeed = 8765;
    for (let i = 0; i < n; i += 8) {
        const p = trackPoints[i];
        const dir = getTrackDirectionAt(trackPoints, i / n);
        const right = BABYLON.Vector3.Cross(up, dir).normalize();

        for (let side = -1; side <= 1; side += 2) {
            if (trackRand() < 0.65) continue; // ~35% chance per side
            const dist = hw + 20 + trackRand() * 18;
            const tpos = p.add(right.scale(side * dist));
            const trunkH = 3 + trackRand() * 4;

            // Trunk
            const trunk = BABYLON.MeshBuilder.CreateCylinder(tuid("tsTrunk"), {
                diameter: 0.35 + trackRand() * 0.2, height: trunkH, tessellation: 6
            }, scene);
            trunk.material = trunkMat2;
            trunk.position = new BABYLON.Vector3(tpos.x, p.y + trunkH / 2, tpos.z);

            // Foliage — low-poly stacked cones (Slow Roads style)
            const fWidth = 2.5 + trackRand() * 2.0;
            const layers = 2 + Math.floor(trackRand() * 2);
            for (let l = 0; l < layers; l++) {
                const layerScale = 1 - l * 0.25;
                const coneH = (1.5 + trackRand() * 1.0) * layerScale;
                const cone = BABYLON.MeshBuilder.CreateCylinder(tuid("tsFol"), {
                    diameterTop: fWidth * layerScale * 0.15,
                    diameterBottom: fWidth * layerScale,
                    height: coneH,
                    tessellation: 5 + Math.floor(trackRand() * 3)
                }, scene);
                cone.material = l === 0 ? (trackRand() > 0.5 ? foliageMat : foliageMat2) : foliageMat2;
                cone.position = new BABYLON.Vector3(
                    tpos.x + (trackRand() - 0.5) * 0.3,
                    p.y + trunkH + l * coneH * 0.6,
                    tpos.z + (trackRand() - 0.5) * 0.3
                );
                if (shadowGenerator && i < 60 && l === 0) shadowGenerator.addShadowCaster(cone);
            }
        }
    }

}

// Armco barriers along the track
function addTrackBarriers(trackDef) {
    const hw = trackDef.trackWidth / 2 + 4;
    const n = trackPoints.length;
    const up = new BABYLON.Vector3(0, 1, 0);

    const barrierMat = new BABYLON.StandardMaterial(tuid("barrierMat"), scene);
    barrierMat.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.6);
    barrierMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);

    // Merge barriers into batches
    const batchSize = 80;
    let bVerts = [], bInds = [], bVI = 0;
    let batchCount = 0;

    for (let i = 0; i < n; i += 8) {
        const i0 = i % n;
        const i1 = (i + 1) % n;
        const p = trackPoints[i0];
        const pN = trackPoints[i1];
        const dir = pN.subtract(p).normalize();
        const right = BABYLON.Vector3.Cross(up, dir).normalize();

        for (let side = -1; side <= 1; side += 2) {
            const pos = p.add(right.scale(side * hw));
            const bx = pos.x, bz = pos.z;
            const by = p.y + 0.55;
            const bw = 0.075, bh = 0.4, bd = 2.5;

            // Simple box as 8 vertices
            const dx = right.x * bw, dz = right.z * bw;
            const fx = dir.x * bd, fz = dir.z * bd;

            // Front face, back face (simplified box)
            bVerts.push(
                bx-dx-fx, by-bh, bz-dz-fz,  bx+dx-fx, by-bh, bz+dz-fz,
                bx-dx-fx, by+bh, bz-dz-fz,  bx+dx-fx, by+bh, bz+dz-fz,
                bx-dx+fx, by-bh, bz-dz+fz,  bx+dx+fx, by-bh, bz+dz+fz,
                bx-dx+fx, by+bh, bz-dz+fz,  bx+dx+fx, by+bh, bz+dz+fz
            );
            // 6 faces x 2 triangles
            bInds.push(
                bVI,bVI+1,bVI+2, bVI+1,bVI+3,bVI+2,  // front
                bVI+4,bVI+6,bVI+5, bVI+5,bVI+6,bVI+7, // back
                bVI,bVI+2,bVI+4, bVI+2,bVI+6,bVI+4,  // left
                bVI+1,bVI+5,bVI+3, bVI+3,bVI+5,bVI+7, // right
                bVI+2,bVI+3,bVI+6, bVI+3,bVI+7,bVI+6, // top
                bVI,bVI+4,bVI+1, bVI+1,bVI+4,bVI+5   // bottom
            );
            bVI += 8;
            batchCount++;

            if (batchCount >= batchSize) {
                const mesh = new BABYLON.Mesh(tuid("barrierBatch"), scene);
                const vd = new BABYLON.VertexData();
                vd.positions = bVerts;
                vd.indices = bInds;
                const bn = [];
                BABYLON.VertexData.ComputeNormals(bVerts, bInds, bn);
                vd.normals = bn;
                vd.applyToMesh(mesh);
                mesh.material = barrierMat;
                bVerts = []; bInds = []; bVI = 0; batchCount = 0;
            }
        }
    }

    // Flush remaining
    if (bVerts.length > 0) {
        const mesh = new BABYLON.Mesh(tuid("barrierBatch"), scene);
        const vd = new BABYLON.VertexData();
        vd.positions = bVerts;
        vd.indices = bInds;
        const bn = [];
        BABYLON.VertexData.ComputeNormals(bVerts, bInds, bn);
        vd.normals = bn;
        vd.applyToMesh(mesh);
        mesh.material = barrierMat;
    }
}

// Trees, grass, rocks for natural tracks
function addNaturalScenery(trackDef, isSnow, isTropical) {
    const treeMat = new BABYLON.StandardMaterial(tuid("treeMat"), scene);
    treeMat.diffuseColor = isSnow ? new BABYLON.Color3(0.15, 0.3, 0.15) :
                           isTropical ? new BABYLON.Color3(0.1, 0.55, 0.15) :
                           new BABYLON.Color3(0.12, 0.45, 0.12);
    treeMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

    const treeMat2 = new BABYLON.StandardMaterial(tuid("treeMat2"), scene);
    treeMat2.diffuseColor = isSnow ? new BABYLON.Color3(0.12, 0.25, 0.12) :
                            isTropical ? new BABYLON.Color3(0.08, 0.48, 0.12) :
                            new BABYLON.Color3(0.1, 0.38, 0.1);
    treeMat2.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);

    const treeMat3 = new BABYLON.StandardMaterial(tuid("treeMat3"), scene);
    treeMat3.diffuseColor = isSnow ? new BABYLON.Color3(0.18, 0.35, 0.18) :
                            isTropical ? new BABYLON.Color3(0.15, 0.6, 0.2) :
                            new BABYLON.Color3(0.15, 0.5, 0.15);
    treeMat3.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);

    const trunkMat = new BABYLON.StandardMaterial(tuid("trunkMat"), scene);
    trunkMat.diffuseColor = new BABYLON.Color3(0.35, 0.22, 0.1);
    trunkMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

    const darkGreenMat = new BABYLON.StandardMaterial(tuid("darkGreen"), scene);
    darkGreenMat.diffuseColor = new BABYLON.Color3(0.08, 0.35, 0.08);

    _trackSeed = 5555;

    // Height sampler for vegetation
    const getH = scene._getTerrainHeight || function() { return 0; };

    // Tree ring
    for (let i = 0; i < 100; i++) {
        const angle = (i / 100) * Math.PI * 2 + Math.sin(i * 3.7) * 0.2;
        const r = 225 + Math.sin(i * 2.3) * 30 + trackRand() * 40;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const groundY = getH(x, z);
        const trunkH = 3 + trackRand() * 3;

        if (isTropical) {
            // Palm trees
            const trunk = BABYLON.MeshBuilder.CreateCylinder(tuid("palmTrunk"), {
                diameterTop: 0.25, diameterBottom: 0.5, height: trunkH * 1.5, tessellation: 6
            }, scene);
            trunk.material = trunkMat;
            trunk.position = new BABYLON.Vector3(x, groundY + trunkH * 0.75, z);
            trunk.rotation.x = (trackRand() - 0.5) * 0.15;
            trunk.rotation.z = (trackRand() - 0.5) * 0.15;

            // Palm fronds
            for (let f = 0; f < 5; f++) {
                const frond = BABYLON.MeshBuilder.CreateDisc(tuid("frond"), {
                    radius: 2 + trackRand(), tessellation: 6
                }, scene);
                frond.material = treeMat;
                frond.position = new BABYLON.Vector3(x, groundY + trunkH * 1.5, z);
                frond.rotation.x = -0.3 - trackRand() * 0.5;
                frond.rotation.y = f * Math.PI * 2 / 5;
            }
        } else if (isSnow) {
            // Conifer trees (cone shape with multiple layers)
            const trunk = BABYLON.MeshBuilder.CreateCylinder(tuid("trunk"), {
                diameter: 0.4, height: trunkH * 0.5, tessellation: 6
            }, scene);
            trunk.material = trunkMat;
            trunk.position = new BABYLON.Vector3(x, groundY + trunkH * 0.25, z);

            // Multiple cone layers for fuller look
            const layers = 2 + Math.floor(trackRand() * 2);
            for (let l = 0; l < layers; l++) {
                const layerScale = 1 - l * 0.25;
                const cone = BABYLON.MeshBuilder.CreateCylinder(tuid("cone"), {
                    diameterTop: 0, diameterBottom: (3 + trackRand()) * layerScale,
                    height: trunkH * 0.5 * layerScale, tessellation: 6
                }, scene);
                cone.material = l === 0 ? treeMat : (l === 1 ? treeMat2 : treeMat3);
                cone.position = new BABYLON.Vector3(x, groundY + trunkH * (0.5 + l * 0.35) + 1, z);
                if (shadowGenerator && i < 40) shadowGenerator.addShadowCaster(cone);
            }

            // Snow cap on top
            if (trackRand() > 0.3) {
                const snowCap = BABYLON.MeshBuilder.CreateSphere(tuid("snowCap"), {
                    diameter: 0.8 + trackRand() * 0.4, segments: 4
                }, scene);
                const snowMat = new BABYLON.StandardMaterial(tuid("snowCapMat"), scene);
                snowMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.95);
                snowCap.material = snowMat;
                snowCap.position = new BABYLON.Vector3(x, groundY + trunkH * (0.5 + layers * 0.35) + 1.2, z);
                snowCap.scaling.y = 0.4;
            }
        } else {
            // Deciduous trees — low-poly stacked cones (Slow Roads style)
            const trunk = BABYLON.MeshBuilder.CreateCylinder(tuid("trunk"), {
                diameter: 0.4 + trackRand() * 0.3, height: trunkH, tessellation: 6
            }, scene);
            trunk.material = trunkMat;
            trunk.position = new BABYLON.Vector3(x, groundY + trunkH / 2, z);

            // Stacked cone foliage layers
            const fWidth = 3.0 + trackRand() * 2.0;
            const layers = 2 + Math.floor(trackRand() * 2);
            for (let l = 0; l < layers; l++) {
                const layerScale = 1 - l * 0.25;
                const coneH = (1.8 + trackRand() * 1.2) * layerScale;
                const cone = BABYLON.MeshBuilder.CreateCylinder(tuid("foliage"), {
                    diameterTop: fWidth * layerScale * 0.15,
                    diameterBottom: fWidth * layerScale,
                    height: coneH,
                    tessellation: 5 + Math.floor(trackRand() * 3)
                }, scene);
                cone.material = l === 0 ? (trackRand() > 0.4 ? treeMat : darkGreenMat) :
                                l === 1 ? treeMat2 : treeMat3;
                cone.position = new BABYLON.Vector3(
                    x + (trackRand() - 0.5) * 0.3,
                    groundY + trunkH + l * coneH * 0.6,
                    z + (trackRand() - 0.5) * 0.3
                );
                if (shadowGenerator && i < 40 && l === 0) shadowGenerator.addShadowCaster(cone);
            }
        }
    }

    // Scatter rocks with varied shapes
    const rockMat = new BABYLON.StandardMaterial(tuid("rockMat"), scene);
    rockMat.diffuseColor = isSnow ? new BABYLON.Color3(0.5, 0.5, 0.55) : new BABYLON.Color3(0.35, 0.32, 0.28);
    rockMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

    const rockMat2 = new BABYLON.StandardMaterial(tuid("rockMat2"), scene);
    rockMat2.diffuseColor = isSnow ? new BABYLON.Color3(0.45, 0.45, 0.5) : new BABYLON.Color3(0.4, 0.35, 0.3);

    for (let i = 0; i < 30; i++) {
        const angle = trackRand() * Math.PI * 2;
        const r = 250 + trackRand() * 100;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;

        // Varied rock shapes: use different mesh types
        let rock;
        const shapeRand = trackRand();
        if (shapeRand < 0.4) {
            // Rounded boulder
            rock = BABYLON.MeshBuilder.CreateSphere(tuid("rock"), {
                diameter: 1 + trackRand() * 2, segments: 5
            }, scene);
        } else if (shapeRand < 0.7) {
            // Angular rock (low-poly cylinder)
            rock = BABYLON.MeshBuilder.CreateCylinder(tuid("rock"), {
                diameterTop: trackRand() * 1.5,
                diameterBottom: 1.5 + trackRand() * 1.5,
                height: 1 + trackRand() * 1.5,
                tessellation: 4 + Math.floor(trackRand() * 3)
            }, scene);
        } else {
            // Flat slab
            rock = BABYLON.MeshBuilder.CreateBox(tuid("rock"), {
                width: 1.5 + trackRand() * 2,
                height: 0.5 + trackRand() * 0.8,
                depth: 1 + trackRand() * 1.5
            }, scene);
        }
        rock.material = trackRand() > 0.5 ? rockMat : rockMat2;
        rock.position = new BABYLON.Vector3(x, getH(x, z) + 0.3 + trackRand() * 0.3, z);
        rock.scaling = new BABYLON.Vector3(
            1 + trackRand() * 0.8,
            0.5 + trackRand() * 0.5,
            1 + trackRand() * 0.8
        );
        rock.rotation.y = trackRand() * Math.PI;
        rock.rotation.x = (trackRand() - 0.5) * 0.3;
    }
}

// City buildings with window lights, neon signs, traffic lights
function addCityScenery(trackDef, isNight) {
    _trackSeed = 7777;

    for (let i = 0; i < 60; i++) {
        const angle = (i / 60) * Math.PI * 2;
        const r = 260 + Math.sin(i * 1.7) * 50 + trackRand() * 20;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const h = 12 + trackRand() * 40;
        const w = 6 + trackRand() * 12;
        const d = 6 + trackRand() * 12;

        const bldgMat = new BABYLON.StandardMaterial(tuid("bldg"), scene);
        bldgMat.diffuseColor = new BABYLON.Color3(
            0.08 + trackRand() * 0.12,
            0.08 + trackRand() * 0.1,
            0.12 + trackRand() * 0.15
        );
        if (isNight) {
            bldgMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.04);
        }
        bldgMat.specularColor = new BABYLON.Color3(0.15, 0.15, 0.2);

        const bldg = BABYLON.MeshBuilder.CreateBox(tuid("bldg"), { width: w, height: h, depth: d }, scene);
        bldg.material = bldgMat;
        bldg.position = new BABYLON.Vector3(x, h / 2, z);
        bldg.receiveShadows = true;
        if (shadowGenerator && i < 20) shadowGenerator.addShadowCaster(bldg);

        // Window lights (emissive planes) — merged per building
        if (isNight && trackRand() > 0.3) {
            const windowMat = new BABYLON.StandardMaterial(tuid("winMat"), scene);
            const warmth = trackRand();
            windowMat.emissiveColor = new BABYLON.Color3(
                0.8 + warmth * 0.2,
                0.6 + warmth * 0.3,
                0.3 + warmth * 0.2
            );
            windowMat.disableLighting = true;

            const windowRows = Math.floor(h / 3);
            const windowCols = Math.floor(w / 2.5);
            const winVerts = [], winInds = [];
            let wVI = 0;

            for (let row = 0; row < windowRows; row++) {
                for (let col = 0; col < windowCols; col++) {
                    if (trackRand() > 0.5) continue;
                    const wx = x + (col - windowCols/2 + 0.5) * 2.2;
                    const wy = row * 3 + 2;
                    const wz = z + d/2 + 0.05;
                    const ww = 0.6, wh = 0.75;
                    winVerts.push(
                        wx-ww, wy-wh, wz,  wx+ww, wy-wh, wz,
                        wx-ww, wy+wh, wz,  wx+ww, wy+wh, wz
                    );
                    winInds.push(wVI, wVI+1, wVI+2, wVI+1, wVI+3, wVI+2);
                    wVI += 4;
                }
            }
            if (winVerts.length > 0) {
                const winMesh = new BABYLON.Mesh(tuid("windows"), scene);
                const wvd = new BABYLON.VertexData();
                wvd.positions = winVerts;
                wvd.indices = winInds;
                const wn = [];
                BABYLON.VertexData.ComputeNormals(winVerts, winInds, wn);
                wvd.normals = wn;
                wvd.applyToMesh(winMesh);
                winMesh.material = windowMat;
            }
        }
    }

    // ── Neon signs on some buildings ──
    if (isNight) {
        const neonSignColors = [
            new BABYLON.Color3(1, 0, 0.4),
            new BABYLON.Color3(0, 1, 0.8),
            new BABYLON.Color3(1, 0.4, 0),
            new BABYLON.Color3(0.4, 0, 1),
            new BABYLON.Color3(0, 0.8, 1),
        ];

        for (let i = 0; i < 15; i++) {
            const angle = (i / 15) * Math.PI * 2 + 0.3;
            const r = 258 + Math.sin(i * 2.1) * 30;
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;

            const signW = 2 + trackRand() * 3;
            const signH = 1 + trackRand() * 1.5;

            const sign = BABYLON.MeshBuilder.CreatePlane(tuid("neonSign"), {
                width: signW, height: signH
            }, scene);
            const signMat = new BABYLON.StandardMaterial(tuid("neonSignMat"), scene);
            const color = neonSignColors[i % neonSignColors.length];
            signMat.emissiveColor = color.scale(0.8);
            signMat.disableLighting = true;
            signMat.backFaceCulling = false;
            sign.material = signMat;
            sign.position = new BABYLON.Vector3(x, 6 + trackRand() * 12, z);
            sign.rotation.y = Math.atan2(-x, -z); // face center

            // Inner accent stripe
            const accent = BABYLON.MeshBuilder.CreatePlane(tuid("neonAccent"), {
                width: signW * 0.7, height: signH * 0.3
            }, scene);
            const accentMat = new BABYLON.StandardMaterial(tuid("neonAccentMat"), scene);
            accentMat.emissiveColor = new BABYLON.Color3(1, 1, 1).scale(0.5);
            accentMat.disableLighting = true;
            accentMat.backFaceCulling = false;
            accent.material = accentMat;
            accent.position = sign.position.clone();
            accent.position.y += signH * 0.1;
            accent.rotation.y = sign.rotation.y;
        }
    }

    // ── Traffic lights near track ──
    const n = trackPoints.length;
    const up = new BABYLON.Vector3(0, 1, 0);
    const trafficLightSpacing = Math.floor(n / 8);
    for (let t = 0; t < 8; t++) {
        const ti = (t * trafficLightSpacing + 10) % n;
        const p = trackPoints[ti];
        const dir = getTrackDirectionAt(trackPoints, ti / n);
        const right = BABYLON.Vector3.Cross(up, dir).normalize();

        const tlSide = t % 2 === 0 ? 1 : -1;
        const tlPos = p.add(right.scale(tlSide * (trackDef.trackWidth / 2 + 3)));

        // Pole
        const pole = BABYLON.MeshBuilder.CreateCylinder(tuid("tlPole"), {
            diameter: 0.15, height: 5, tessellation: 6
        }, scene);
        const poleMat = new BABYLON.StandardMaterial(tuid("tlPoleMat"), scene);
        poleMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        pole.material = poleMat;
        pole.position = new BABYLON.Vector3(tlPos.x, p.y + 2.5, tlPos.z);

        // Light housing
        const housing = BABYLON.MeshBuilder.CreateBox(tuid("tlHousing"), {
            width: 0.4, height: 1.2, depth: 0.3
        }, scene);
        const housingMat = new BABYLON.StandardMaterial(tuid("tlHousingMat"), scene);
        housingMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15);
        housing.material = housingMat;
        housing.position = new BABYLON.Vector3(tlPos.x, p.y + 5.5, tlPos.z);

        // Red/Yellow/Green lights
        const lightColors = [
            new BABYLON.Color3(0.9, 0.1, 0.1),
            new BABYLON.Color3(0.9, 0.7, 0.1),
            new BABYLON.Color3(0.1, 0.9, 0.1)
        ];
        for (let lc = 0; lc < 3; lc++) {
            const bulb = BABYLON.MeshBuilder.CreateSphere(tuid("tlBulb"), {
                diameter: 0.2, segments: 4
            }, scene);
            const bulbMat = new BABYLON.StandardMaterial(tuid("tlBulbMat"), scene);
            bulbMat.emissiveColor = lightColors[lc].scale(isNight ? 0.7 : 0.3);
            bulbMat.disableLighting = true;
            bulb.material = bulbMat;
            bulb.position = new BABYLON.Vector3(
                tlPos.x, p.y + 5.1 + lc * 0.35, tlPos.z
            );
        }
    }

    // ── Road markings (lane arrows, zebra crossings) ──
    const markingMat = new BABYLON.StandardMaterial(tuid("roadMarkMat"), scene);
    markingMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.85);
    markingMat.emissiveColor = new BABYLON.Color3(0.08, 0.08, 0.06);
    markingMat.backFaceCulling = false;

    // Zebra crossings at a few points
    for (let zc = 0; zc < 4; zc++) {
        const zi = Math.floor(n * (0.25 * zc + 0.12)) % n;
        const p = trackPoints[zi];
        const dir = getTrackDirectionAt(trackPoints, zi / n);
        const right = BABYLON.Vector3.Cross(up, dir).normalize();

        for (let stripe = -3; stripe <= 3; stripe++) {
            const spos = p.add(right.scale(stripe * 1.5));
            const zPlane = BABYLON.MeshBuilder.CreatePlane(tuid("zebra"), {
                width: 1.0, height: 0.4
            }, scene);
            zPlane.material = markingMat;
            zPlane.rotation.x = Math.PI / 2;
            zPlane.rotation.y = Math.atan2(dir.x, dir.z);
            zPlane.position = new BABYLON.Vector3(spos.x, p.y + 0.18, spos.z);
        }
    }

    // Street lights
    const lampMat = new BABYLON.StandardMaterial(tuid("lampMat"), scene);
    lampMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);

    let streetLightCount = 0;
    for (let i = 0; i < n; i += 15) {
        const p = trackPoints[i];
        const dir = getTrackDirectionAt(trackPoints, i / n);
        const right = BABYLON.Vector3.Cross(up, dir).normalize();

        for (let side = -1; side <= 1; side += 2) {
            const pos = p.add(right.scale(side * (trackDef.trackWidth / 2 + 4)));

            const pole = BABYLON.MeshBuilder.CreateCylinder(tuid("pole"), {
                diameter: 0.2, height: 6, tessellation: 6
            }, scene);
            pole.material = lampMat;
            pole.position = new BABYLON.Vector3(pos.x, p.y + 3, pos.z);

            if (isNight) {
                // Only add real PointLights for first few to save GPU
                if (streetLightCount < 8) {
                    const light = new BABYLON.PointLight(tuid("streetLight"), new BABYLON.Vector3(pos.x, p.y + 6.5, pos.z), scene);
                    light.diffuse = new BABYLON.Color3(1, 0.9, 0.7);
                    light.intensity = 2;
                    light.range = 25;
                }

                // Always add bulb mesh (cheap visual)
                const bulb = BABYLON.MeshBuilder.CreateSphere(tuid("bulb"), { diameter: 0.4, segments: 4 }, scene);
                const bulbMat = new BABYLON.StandardMaterial(tuid("bulbMat"), scene);
                bulbMat.emissiveColor = new BABYLON.Color3(1, 0.95, 0.8);
                bulbMat.disableLighting = true;
                bulb.material = bulbMat;
                bulb.position = new BABYLON.Vector3(pos.x, p.y + 6.2, pos.z);
                streetLightCount++;
            }
        }
    }
}

// Desert scenery: cacti, sand dunes with curved shapes, rocks
function addDesertScenery(trackDef) {
    const isVolcano = trackDef.name === 'Volcano Ring';
    _trackSeed = 6666;

    const rockMat = new BABYLON.StandardMaterial(tuid("desertRock"), scene);
    rockMat.diffuseColor = isVolcano ? new BABYLON.Color3(0.25, 0.12, 0.05) : new BABYLON.Color3(0.6, 0.5, 0.35);

    // Large rock formations with varied shapes
    for (let i = 0; i < 20; i++) {
        const angle = trackRand() * Math.PI * 2;
        const r = 270 + trackRand() * 80;
        const h = 3 + trackRand() * 8;

        // Use different shapes for variety
        let rock;
        const shapeType = trackRand();
        if (shapeType < 0.35) {
            // Mesa/butte shape
            rock = BABYLON.MeshBuilder.CreateCylinder(tuid("dRock"), {
                diameterTop: 2 + trackRand() * 3,
                diameterBottom: 3 + trackRand() * 4,
                height: h,
                tessellation: 5 + Math.floor(trackRand() * 3)
            }, scene);
        } else if (shapeType < 0.65) {
            // Spire
            rock = BABYLON.MeshBuilder.CreateCylinder(tuid("dRock"), {
                diameterTop: 0.5 + trackRand(),
                diameterBottom: 2 + trackRand() * 3,
                height: h * 1.3,
                tessellation: 5
            }, scene);
        } else {
            // Boulder cluster
            rock = BABYLON.MeshBuilder.CreateSphere(tuid("dRock"), {
                diameter: h * 0.8, segments: 5
            }, scene);
        }
        rock.material = rockMat;
        rock.position = new BABYLON.Vector3(Math.cos(angle) * r, h/2, Math.sin(angle) * r);
        rock.rotation.y = trackRand() * Math.PI;
        rock.scaling.x = 0.8 + trackRand() * 0.6;
        rock.scaling.z = 0.8 + trackRand() * 0.6;
        if (shadowGenerator && i < 10) shadowGenerator.addShadowCaster(rock);
    }

    // ── Sand dunes with proper curved shapes ──
    if (!isVolcano) {
        const duneMat = new BABYLON.StandardMaterial(tuid("duneMat"), scene);
        duneMat.diffuseColor = new BABYLON.Color3(0.85, 0.72, 0.45);
        duneMat.specularColor = new BABYLON.Color3(0.08, 0.07, 0.04);

        for (let i = 0; i < 12; i++) {
            const angle = trackRand() * Math.PI * 2;
            const r = 300 + trackRand() * 150;
            const duneW = 15 + trackRand() * 25;
            const duneH = 3 + trackRand() * 6;
            const duneD = 8 + trackRand() * 12;

            const dune = BABYLON.MeshBuilder.CreateSphere(tuid("dune"), {
                diameter: duneW, segments: 8
            }, scene);
            dune.material = duneMat;
            dune.position = new BABYLON.Vector3(
                Math.cos(angle) * r,
                duneH * 0.15,
                Math.sin(angle) * r
            );
            // Flatten vertically and stretch for dune shape
            dune.scaling = new BABYLON.Vector3(1, duneH / duneW, duneD / duneW);
            dune.rotation.y = angle + trackRand() * 0.5;
        }
    }

    // Cacti (for desert, not volcano)
    if (!isVolcano) {
        const cactusMat = new BABYLON.StandardMaterial(tuid("cactus"), scene);
        cactusMat.diffuseColor = new BABYLON.Color3(0.2, 0.45, 0.15);

        for (let i = 0; i < 25; i++) {
            const angle = trackRand() * Math.PI * 2;
            const r = 260 + trackRand() * 60;
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            const h = 2 + trackRand() * 3;

            const trunk = BABYLON.MeshBuilder.CreateCylinder(tuid("cactus"), {
                diameterTop: 0.4, diameterBottom: 0.5, height: h, tessellation: 6
            }, scene);
            trunk.material = cactusMat;
            trunk.position = new BABYLON.Vector3(x, h/2, z);

            // Arms
            if (trackRand() > 0.4) {
                const arm = BABYLON.MeshBuilder.CreateCylinder(tuid("cactusArm"), {
                    diameter: 0.3, height: 1.5, tessellation: 6
                }, scene);
                arm.material = cactusMat;
                arm.rotation.z = Math.PI / 4 * (trackRand() > 0.5 ? 1 : -1);
                arm.position = new BABYLON.Vector3(x + (trackRand() > 0.5 ? 0.5 : -0.5), h * 0.6, z);
            }
        }
    }

    // ── Heat haze effect (shimmering plane) ──
    if (!isVolcano) {
        const hazeMat = new BABYLON.StandardMaterial(tuid("hazeMat"), scene);
        hazeMat.diffuseColor = new BABYLON.Color3(0.85, 0.78, 0.55);
        hazeMat.alpha = 0.08;
        hazeMat.backFaceCulling = false;
        hazeMat.disableLighting = true;
        hazeMat.emissiveColor = new BABYLON.Color3(0.9, 0.85, 0.7);

        const haze = BABYLON.MeshBuilder.CreateGround(tuid("haze"), {
            width: 600, height: 600
        }, scene);
        haze.material = hazeMat;
        haze.position.y = 1.5;

        // Animate the haze alpha for shimmer
        scene.registerBeforeRender(() => {
            if (haze && !haze.isDisposed()) {
                hazeMat.alpha = 0.04 + Math.sin(performance.now() * 0.003) * 0.03;
            }
        });
    }

    // Lava glow for volcano
    if (isVolcano) {
        const lavaMat = new BABYLON.StandardMaterial(tuid("lava"), scene);
        lavaMat.emissiveColor = new BABYLON.Color3(0.8, 0.2, 0);
        lavaMat.disableLighting = true;

        for (let i = 0; i < 8; i++) {
            const angle = trackRand() * Math.PI * 2;
            const r = 240 + trackRand() * 40;
            const lava = BABYLON.MeshBuilder.CreateDisc(tuid("lava"), {
                radius: 3 + trackRand() * 5, tessellation: 8
            }, scene);
            lava.material = lavaMat;
            lava.rotation.x = Math.PI / 2;
            lava.position = new BABYLON.Vector3(Math.cos(angle) * r, 0.1, Math.sin(angle) * r);

            const glow = new BABYLON.PointLight(tuid("lavaGlow"), lava.position.add(new BABYLON.Vector3(0, 2, 0)), scene);
            glow.diffuse = new BABYLON.Color3(1, 0.3, 0);
            glow.intensity = 3;
            glow.range = 30;
        }
    }
}

// ── Clouds (billboard planes drifting slowly) ──
function addClouds(trackDef) {
    const cloudMat = new BABYLON.StandardMaterial(tuid("cloudMat"), scene);
    cloudMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    cloudMat.emissiveColor = new BABYLON.Color3(0.6, 0.6, 0.65);
    cloudMat.alpha = 0.3;
    cloudMat.disableLighting = true;
    cloudMat.backFaceCulling = false;

    const cloudMat2 = new BABYLON.StandardMaterial(tuid("cloudMat2"), scene);
    cloudMat2.diffuseColor = new BABYLON.Color3(0.95, 0.95, 1);
    cloudMat2.emissiveColor = new BABYLON.Color3(0.55, 0.55, 0.6);
    cloudMat2.alpha = 0.3;
    cloudMat2.disableLighting = true;
    cloudMat2.backFaceCulling = false;

    _trackSeed = 1234;
    const clouds = [];

    for (let i = 0; i < 8; i++) {
        const cloudW = 30 + trackRand() * 50;
        const cloudH = 8 + trackRand() * 15;
        const cloud = BABYLON.MeshBuilder.CreatePlane(tuid("cloud"), {
            width: cloudW, height: cloudH
        }, scene);
        cloud.material = trackRand() > 0.5 ? cloudMat : cloudMat2;
        cloud.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        const cx = (trackRand() - 0.5) * 800;
        const cy = 120 + trackRand() * 100;
        const cz = (trackRand() - 0.5) * 800;
        cloud.position = new BABYLON.Vector3(cx, cy, cz);

        cloud._driftX = (trackRand() - 0.5) * 1.5;
        cloud._driftZ = (trackRand() - 0.5) * 0.8;
        clouds.push(cloud);
    }

    // Animate cloud drift
    scene.registerBeforeRender(() => {
        const dt = scene.getEngine().getDeltaTime() / 1000;
        for (const c of clouds) {
            if (c.isDisposed()) continue;
            c.position.x += c._driftX * dt;
            c.position.z += c._driftZ * dt;
            // Wrap around
            if (c.position.x > 500) c.position.x = -500;
            if (c.position.x < -500) c.position.x = 500;
            if (c.position.z > 500) c.position.z = -500;
            if (c.position.z < -500) c.position.z = 500;
        }
    });
}

// ── Dust motes floating in sunbeams ──
function addDustMotes() {
    const moteMat = new BABYLON.StandardMaterial(tuid("moteMat"), scene);
    moteMat.emissiveColor = new BABYLON.Color3(1, 0.95, 0.7);
    moteMat.disableLighting = true;
    moteMat.alpha = 0.4;

    const motes = [];
    for (let i = 0; i < 60; i++) {
        const mote = BABYLON.MeshBuilder.CreateSphere(tuid("mote"), {
            diameter: 0.06 + Math.random() * 0.06, segments: 3
        }, scene);
        mote.material = moteMat;
        mote.position = new BABYLON.Vector3(
            (Math.random() - 0.5) * 80,
            2 + Math.random() * 15,
            (Math.random() - 0.5) * 80
        );
        mote._phase = Math.random() * Math.PI * 2;
        mote._speed = 0.3 + Math.random() * 0.5;
        mote._radius = 0.5 + Math.random() * 1.5;
        motes.push(mote);
    }

    scene.registerBeforeRender(() => {
        const t = performance.now() * 0.001;
        for (const m of motes) {
            if (m.isDisposed()) continue;
            m.position.y += Math.sin(t * m._speed + m._phase) * 0.005;
            m.position.x += Math.sin(t * 0.3 + m._phase) * 0.003;
            // Follow camera loosely
            if (scene.activeCamera) {
                const cam = scene.activeCamera.position;
                m.position.x += (cam.x - m.position.x) * 0.001;
                m.position.z += (cam.z - m.position.z) * 0.001;
            }
        }
    });
}

// ── Birds / seagulls (animated triangles) ──
function addBirds() {
    const birdMat = new BABYLON.StandardMaterial(tuid("birdMat"), scene);
    birdMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    birdMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    birdMat.backFaceCulling = false;

    const birds = [];
    for (let i = 0; i < 12; i++) {
        // Each bird is a small V-shaped mesh (two triangles)
        const birdVerts = [
            -0.5, 0, 0,   0, 0.1, -0.15,  0, 0, 0.3,  // left wing
             0.5, 0, 0,   0, 0.1, -0.15,  0, 0, 0.3   // right wing
        ];
        const birdInds = [0, 1, 2, 3, 4, 5];
        const bird = new BABYLON.Mesh(tuid("bird"), scene);
        const bvd = new BABYLON.VertexData();
        bvd.positions = birdVerts;
        bvd.indices = birdInds;
        const bn = [];
        BABYLON.VertexData.ComputeNormals(birdVerts, birdInds, bn);
        bvd.normals = bn;
        bvd.applyToMesh(bird);
        bird.material = birdMat;

        const angle = Math.random() * Math.PI * 2;
        const r = 50 + Math.random() * 200;
        bird.position = new BABYLON.Vector3(
            Math.cos(angle) * r,
            30 + Math.random() * 40,
            Math.sin(angle) * r
        );
        bird._angle = angle;
        bird._r = r;
        bird._speed = 0.1 + Math.random() * 0.15;
        bird._flapPhase = Math.random() * Math.PI * 2;
        bird._vertOffset = Math.random() * Math.PI * 2;
        birds.push(bird);
    }

    scene.registerBeforeRender(() => {
        const t = performance.now() * 0.001;
        for (const b of birds) {
            if (b.isDisposed()) continue;
            b._angle += b._speed * 0.01;
            b.position.x = Math.cos(b._angle) * b._r;
            b.position.z = Math.sin(b._angle) * b._r;
            b.position.y += Math.sin(t * 0.5 + b._vertOffset) * 0.02;
            b.rotation.y = b._angle + Math.PI / 2;
            // Wing flap (slight scaling on Y)
            const flapAngle = Math.sin(t * 5 + b._flapPhase);
            b.scaling.y = 0.8 + flapAngle * 0.4;
        }
    });
}

// ── Snowbanks along the road edges ──
function addSnowbanks(trackDef) {
    const n = trackPoints.length;
    const hw = trackDef.trackWidth / 2;
    const up = new BABYLON.Vector3(0, 1, 0);

    const snowMat = new BABYLON.StandardMaterial(tuid("snowbankMat"), scene);
    snowMat.diffuseColor = new BABYLON.Color3(0.92, 0.92, 0.97);
    snowMat.specularColor = new BABYLON.Color3(0.25, 0.25, 0.3);

    // Build snowbank strips as merged geometry
    const sbVerts = [], sbInds = [];
    let sbVI = 0;
    const bankH = 0.8;
    const bankW = 2.0;

    for (let i = 0; i < n; i += 4) {
        const p = trackPoints[i];
        const i1 = (i + 1) % n;
        const pN = trackPoints[i1];
        const dir = pN.subtract(p).normalize();
        const right = BABYLON.Vector3.Cross(up, dir).normalize();

        for (let side = -1; side <= 1; side += 2) {
            const edgePos = p.add(right.scale(side * (hw + 3)));
            const outerPos = edgePos.add(right.scale(side * bankW));
            const y0 = p.y;

            sbVerts.push(
                edgePos.x, y0 + 0.1, edgePos.z,
                outerPos.x, y0 + bankH, outerPos.z,
                edgePos.x + dir.x * 2, y0 + 0.1, edgePos.z + dir.z * 2,
                outerPos.x + dir.x * 2, y0 + bankH, outerPos.z + dir.z * 2
            );
            sbInds.push(sbVI, sbVI+1, sbVI+2, sbVI+1, sbVI+3, sbVI+2);
            sbVI += 4;
        }
    }

    if (sbVerts.length > 0) {
        const mesh = new BABYLON.Mesh(tuid("snowbanks"), scene);
        const vd = new BABYLON.VertexData();
        vd.positions = sbVerts;
        vd.indices = sbInds;
        const sn = [];
        BABYLON.VertexData.ComputeNormals(sbVerts, sbInds, sn);
        vd.normals = sn;
        vd.applyToMesh(mesh);
        mesh.material = snowMat;
    }

    // ── Frozen lake in the distance ──
    const lake = BABYLON.MeshBuilder.CreateDisc(tuid("frozenLake"), {
        radius: 60, tessellation: 24
    }, scene);
    const lakeMat = new BABYLON.StandardMaterial(tuid("lakeMat"), scene);
    lakeMat.diffuseColor = new BABYLON.Color3(0.7, 0.8, 0.9);
    lakeMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.5);
    lakeMat.specularPower = 64;
    lakeMat.alpha = 0.85;
    lake.material = lakeMat;
    lake.rotation.x = Math.PI / 2;
    lake.position = new BABYLON.Vector3(350, 0.05, 300);
}

function createSnowfall() {
    scene._snowParticles = [];
    const snowMat = new BABYLON.StandardMaterial(tuid("snowPartMat"), scene);
    snowMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    snowMat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.35);
    snowMat.alpha = 0.8;
    snowMat.disableLighting = true;

    for (let i = 0; i < 200; i++) {
        const flake = BABYLON.MeshBuilder.CreateSphere(tuid("snow"), { diameter: 0.15 + Math.random() * 0.1, segments: 3 }, scene);
        flake.material = snowMat;
        flake.position = new BABYLON.Vector3(
            (Math.random() - 0.5) * 200,
            Math.random() * 80,
            (Math.random() - 0.5) * 200
        );
        flake._idx = i;
        flake._speed = 3 + Math.random() * 4;
        scene._snowParticles.push(flake);
    }
}

function createEmberParticles() {
    const emberMat = new BABYLON.StandardMaterial(tuid("emberMat"), scene);
    emberMat.emissiveColor = new BABYLON.Color3(1, 0.4, 0);
    emberMat.disableLighting = true;

    scene._emberParticles = [];
    for (let i = 0; i < 50; i++) {
        const ember = BABYLON.MeshBuilder.CreateSphere(tuid("ember"), { diameter: 0.1, segments: 3 }, scene);
        ember.material = emberMat;
        ember.position = new BABYLON.Vector3(
            (Math.random() - 0.5) * 300,
            Math.random() * 15,
            (Math.random() - 0.5) * 300
        );
        ember._speed = 1 + Math.random() * 2;
        ember._drift = Math.random() * Math.PI * 2;
        scene._emberParticles.push(ember);
    }
}
