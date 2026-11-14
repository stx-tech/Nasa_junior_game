import { marsGeneration, opportunitySource } from './opportunity.js';

export const missions = [
  {
    id: 'moon',
    title: 'Moon · The Long Shadow',
    objective: 'Give the astronauts air to breathe for all 4 shifts. Study 2 Moon rocks in the lab.',
    forecast: [
      'Solar panels turn sunlight into electricity. A hill will shade them next shift.',
      'The solar panels are in shadow and make no electricity. You can only use what is in the battery.',
      'The panels are back in sunlight.',
      'The panels are still in sunlight. Check if you have studied 2 rocks.',
    ],
    generation: [7, 0, 7, 7],
    battery: 1,
    air: 1,
    labTarget: 2,
    modules: ['crew', 'lab'],
  },
  {
    id: 'mars',
    title: 'Mars · Dust on the Horizon',
    objective: 'Keep the crew safe, harvest food once, and study 2 samples in the lab.',
    forecast: [
      'A dust storm is approaching. This is your best chance to store power.',
      'Dust blocks the sun. A radiation warning is expected next shift. Radiation is invisible rays and particles that can harm astronauts.',
      'The panels still make little electricity. There is a radiation warning. Move the crew into the safe room.',
      'The skies are a little brighter. Solar power is still below normal.',
    ],
    generation: marsGeneration,
    battery: 6,
    science: {
      url: opportunitySource,
      description: 'During a 2007 dust storm, NASA’s Opportunity rover went from over 700 watt-hours per Martian day to as low as 128. It later reached 243. This training mission scales those readings into game energy and keeps the low point for two shifts.',
    },
    labTarget: 2,
    cropTarget: 1,
    shelterShift: 2,
    modules: ['crew', 'greenhouse', 'lab', 'shelter'],
  },
  {
    id: 'earth',
    title: 'Earth · Keep the Pump Ready',
    objective: 'Water the greenhouse after sunset. You have one battery to power the station.',
    forecast: [
      'The station has 7 energy. The lab can run now, and the greenhouse needs water after sunset.',
      'The power is still out. Turn on the water pump to water the plants.',
    ],
    generation: [0, 0],
    battery: 7,
    modules: ['lab', 'pump'],
  },
];

export const modules = {
  crew: { name: 'Life Support', cost: 3, description: 'Gives astronauts air to breathe and cleans water so they can use it again.' },
  lab: { name: 'Science Lab', cost: 3, description: 'Astronauts study one rock here each time you turn it on.' },
  greenhouse: { name: 'Greenhouse', cost: 2, description: 'A room where plants grow for food. Use 1 water each time. Water the plants twice to get food.' },
  shelter: { name: 'Shelter', cost: 1, description: 'A safe room where astronauts can wait until the danger passes.' },
  pump: { name: 'Water Pump', cost: 5, description: 'Moves water to the plants after sunset.' },
};
