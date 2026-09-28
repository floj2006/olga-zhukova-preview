/**
 * DEMONSTRATION RATES, not Olga's confirmed commercial offer.
 * Replace the amounts with approved rates, then set demo: false.
 * All amounts are in RUB. Rates include up to 4 hours by default.
 */
window.EVENT_PRICING = Object.freeze({
  demo: true,
  format: {
    wedding: 35000,
    corporate: 30000,
    anniversary: 25000,
    graduation: 30000,
  },
  guests: { intimate: 0, medium: 3000, large: 6000, grand: 10000 },
  duration: { short: 0, standard: 7000, full: 14000, undecided: 0 },
  location: { city: 0, nearby: 4000, region: 8000, other: 0 },
  support: { host: 0, dj: 12000, complete: 18000, undecided: 0 },
});
