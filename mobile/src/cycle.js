// 'demo_2' -> 'Demo 2', 'adoption_1' -> 'Adoption 1'. A plot's cycle tells
// apart the same farmer growing the same crop again in a later cycle.
export function cycleLabel(cycle) {
  if (!cycle) return '';
  const [type, number] = cycle.split('_');
  return `${type.charAt(0).toUpperCase()}${type.slice(1)} ${number}`;
}
