// Tower Rush — shared game math. Pure & dependency-free so it is safe to
// import from BOTH the client component and the server route (no node:crypto
// here; the provably-fair seed→crashFloor derivation lives server-side in the
// API route).
//
// Model
// -----
// A round builds floors 1..N. Floor 1 (the base) is always placed. Every floor
// above the base survives with probability SURVIVE_P; otherwise the tower
// collapses and the stake is lost.
//
//   coeff(f) = BASE_COEFF * GROWTH^(f-1)        (f = floors placed, f >= 1)
//   P(reach floor f) = SURVIVE_P^(f-1)
//
// With GROWTH = 1 / SURVIVE_P and BASE_COEFF = RTP, the expected return is a
// flat RTP at EVERY cash-out point — a fair, standard crash curve with a small
// house edge. Max win is uncapped (you can keep building).

export const TOWER_RTP = 0.97 // ~3% house edge
export const TOWER_SURVIVE_P = 0.8 // ~20% collapse chance per floor above base
export const TOWER_GROWTH = 1 / TOWER_SURVIVE_P // 1.25
export const TOWER_BASE_COEFF = TOWER_RTP // coefficient after the base floor

// UI sizing for the block art (kept in the shared lib so visuals stay
// consistent). STRIDE is the vertical step between stacked storeys — a touch
// less than the block height so floors overlap slightly and connect.
export const TOWER_BLOCK_W = 112
export const TOWER_BLOCK_H = 88
export const TOWER_STACK_STRIDE = 72

export const TOWER_MIN_STAKE = 1

/** Coefficient after `floor` floors have been placed (floor >= 1). */
export function towerCoeffAt(floor: number): number {
  if (floor <= 0) return 0
  return +(TOWER_BASE_COEFF * Math.pow(TOWER_GROWTH, floor - 1)).toFixed(2)
}

/**
 * Turn a uniform float u in [0,1) into the floor at which the tower collapses.
 * Geometric distribution: P(crashFloor = 2 + m) = SURVIVE_P^m * (1 - SURVIVE_P).
 * crashFloor >= 2, so the base floor is always safe.
 */
export function crashFloorFromUniform(u: number): number {
  let x = u
  if (!(x > 0)) x = 1e-12
  if (x >= 1) x = 1 - 1e-12
  return 2 + Math.floor(Math.log(x) / Math.log(TOWER_SURVIVE_P))
}
