export function getFlameBubbleAngles(baseAngle: number, bubblesPerShot: number, spreadDegrees: number): number[] {
  if (bubblesPerShot <= 1) {
    return [normalizeAngle(baseAngle)];
  }

  const angles: number[] = [];
  const step = bubblesPerShot === 1 ? 0 : (spreadDegrees * 2) / (bubblesPerShot - 1);
  const start = -spreadDegrees;

  for (let index = 0; index < bubblesPerShot; index++) {
    angles.push(normalizeAngle(baseAngle + start + step * index));
  }

  return angles;
}

function normalizeAngle(angle: number): number {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}
