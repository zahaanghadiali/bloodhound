/**
 * "Find a pet blood donor" flow.
 */

const steps = [
  {
    id: 'species',
    type: 'choice',
    options: [
      { value: 'dog', label: '🐶 Dog', keywords: ['dog'] },
      { value: 'cat', label: '🐱 Cat', keywords: ['cat'] },
    ],
    prompt: () => "Who's this for?\n🐶 Dog\n🐱 Cat",
    next: () => 'location',
  },
  {
    id: 'location',
    type: 'location',
    prompt: () => 'Where should we look?\nShare location 📍 (preferred), or type your city',
    next: () => null, // end of flow -> triggers donor search
  },
];

module.exports = {
  id: 'findDonor',
  openingMessage: 'Sniffing out matches near you 🐾',
  steps,
  firstStepId: 'species',
};
