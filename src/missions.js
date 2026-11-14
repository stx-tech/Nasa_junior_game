// Stand-in mission data for the map harness. Codex owns the real rules and balance;
// only `id`, `environment` and `generation` are read by the 3D stage.
export const MISSIONS = [
  {
    id: 'moon',
    title: 'Moon · The Long Shadow',
    environment: 'moon',
    generation: [7, 0, 7, 7],
    forecast: ['Sunlight', 'Shadow', 'Sunlight', 'Sunlight'],
    startBattery: 3,
    labGoal: 2,
    briefing: 'Walk around the base. Pick what to power each shift. A shadow is coming.',
  },
  {
    id: 'mars',
    title: 'Mars · Dust on the Horizon',
    environment: 'placeholder',
    palette: { ground: 0xb5653a, sky: 0xd9a577, module: 0xe9e6df },
    generation: [9, 7, 5, 2, 0, 1, 3, 8],
    forecast: ['Clear', 'Dusty', 'Dusty', 'Storm', 'Storm', 'Storm', 'Clearing', 'Clear'],
    startBattery: 6,
    labGoal: 3,
    briefing: 'A dust storm is coming. (Map not built yet.)',
  },
];
