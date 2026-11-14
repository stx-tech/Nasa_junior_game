import { marsGeneration, opportunitySource } from './opportunity.js';

export const missions = [
  {
    id: 'moon',
    title: 'Moon · The Long Shadow',
    objective: 'Keep the crew safe and analyze two samples in four shifts. The air backup is low.',
    forecast: [
      'The panels are in sunlight. A ridge will shade them next shift.',
      'The panels are in shadow. Your battery is the only power source.',
      'The panels are back in sunlight.',
      'The panels are still in sunlight. Finish the science work.',
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
    objective: 'Keep the crew safe, grow one crop, and analyze two samples.',
    forecast: [
      'A dust storm is approaching. This is your best chance to store power.',
      'Dust blocks most of the sunlight. A radiation alert is expected next shift.',
      'Solar power is still low. A separate radiation alert calls for shelter.',
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
    objective: 'Keep enough energy to run the irrigation pump when it is needed.',
    forecast: [
      'The station has 7 energy. The lab can run now, and the greenhouse needs water after sunset.',
      'The grid is still down. Start the irrigation pump to water the greenhouse.',
    ],
    generation: [0, 0],
    battery: 7,
    modules: ['lab', 'pump'],
  },
];

export const modules = {
  crew: { name: 'Life Support', cost: 3, description: 'Supply air and recover water.' },
  lab: { name: 'Science Lab', cost: 3, description: 'Analyze one sample.' },
  greenhouse: { name: 'Greenhouse', cost: 2, description: 'Spend 1 water to grow the crop. It takes two growing shifts.' },
  shelter: { name: 'Shelter', cost: 1, description: 'Move the crew inside and power the shelter ventilation.' },
  pump: { name: 'Irrigation Pump', cost: 5, description: 'Water the plants after sunset.' },
};
