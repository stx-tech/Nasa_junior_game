// Representative values from NASA/JPL's 2007 dust storm update.
export const opportunitySource = 'https://www.jpl.nasa.gov/news/martian-skies-brighten-slightly/';
const referenceWh = 700; // NASA reports above 700 Wh before the storm.
const lowWh = 128;
const recoveryWh = 243;

// The fictional base scales rover output to 10 energy per clear shift.
// The low point lasts two shifts for planning practice.
export const marsGeneration = [referenceWh, lowWh, lowWh, recoveryWh]
  .map(wattHours => Math.round(10 * wattHours / referenceWh));
