/**
 * Smart POI Scheduler - Automatically distributes POIs across available days
 * considering category balance, travel times, and constraints.
 *
 * Uses ORS Matrix API for real travel times when available.
 * Philosophy: Assisted Automation - algorithm proposes based on logistics,
 * user handles final balancing via saturation warnings.
 */

// Default scheduling constraints
export const DEFAULT_CONSTRAINTS = {
  maxFoodPerDay: 2,              // Max food/restaurant POIs per day (1-4)
  maxHoursPerDay: 8,             // Max dwell time hours per day (4-12)
  maxTravelMinutesInCluster: 15, // Max travel time (minutes) within a cluster
};

// Food-related categories for balance checking
const FOOD_CATEGORIES = ['Food', 'Restaurants', 'Restaurant', 'Cafe', 'Bar', 'Dining'];

/**
 * Calculate the Haversine distance between two coordinates in kilometers.
 * Used as fallback when no travel matrix is available.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a POI category is food-related.
 * @param {string} category - POI category
 * @returns {boolean}
 */
function isFoodCategory(category) {
  if (!category) return false;
  return FOOD_CATEGORIES.some(food =>
    category.toLowerCase().includes(food.toLowerCase())
  );
}

/**
 * Calculate the centroid of POIs on a given day.
 * @param {Array} pois - Array of POI objects with latitude/longitude
 * @returns {{ lat: number, lon: number } | null}
 */
function calculateCentroid(pois) {
  if (!pois || pois.length === 0) return null;

  const validPois = pois.filter(p => p.latitude && p.longitude);
  if (validPois.length === 0) return null;

  const sumLat = validPois.reduce((sum, p) => sum + p.latitude, 0);
  const sumLon = validPois.reduce((sum, p) => sum + p.longitude, 0);

  return {
    lat: sumLat / validPois.length,
    lon: sumLon / validPois.length,
  };
}

/**
 * Get the total dwell time for a day in minutes.
 * @param {Array} pois - Array of POI objects
 * @returns {number} Total dwell time in minutes
 */
function getDayDwellTime(pois) {
  return pois.reduce((total, poi) => total + (poi.dwell_time || 60), 0);
}

/**
 * Count food POIs for a day.
 * @param {Array} pois - Array of POI objects
 * @returns {number}
 */
function countFoodPOIs(pois) {
  return pois.filter(poi => isFoodCategory(poi.category)).length;
}

/**
 * Get travel time between two locations from the matrix.
 * Falls back to Haversine estimation if matrix not available.
 * @param {string} fromId - Source location ID
 * @param {string} toId - Destination location ID
 * @param {Object|null} matrix - Travel matrix from ORS
 * @param {string} profile - Transport profile (for fallback estimation)
 * @returns {number} Travel time in seconds
 */
function getTravelTime(fromId, toId, matrix, profile = 'foot-walking') {
  if (matrix && matrix.durations && matrix.durations[fromId]?.[toId] !== undefined) {
    return matrix.durations[fromId][toId];
  }
  // Return 0 for same location
  if (fromId === toId) return 0;
  // No matrix available, return a fallback (handled elsewhere)
  return null;
}

/**
 * Estimate travel time from coordinates when matrix is not available.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @param {string} profile - Transport profile
 * @returns {number} Estimated travel time in seconds
 */
function estimateTravelTime(lat1, lon1, lat2, lon2, profile = 'foot-walking') {
  const distance = haversineDistance(lat1, lon1, lat2, lon2) * 1000; // Convert to meters

  // Average speeds in m/s
  const speeds = {
    'foot-walking': 1.4,      // ~5 km/h
    'cycling-regular': 4.2,   // ~15 km/h
    'driving-car': 8.3,       // ~30 km/h (urban average)
  };

  const speed = speeds[profile] || 1.4;
  return distance / speed;
}

/**
 * Calculate total travel time for a day's POIs.
 * @param {Array} dayPOIs - POIs scheduled for the day
 * @param {Object|null} accommodation - Accommodation for the day
 * @param {Object|null} matrix - Travel matrix
 * @param {string} profile - Transport profile
 * @returns {number} Total travel time in minutes
 */
function calculateDayTravelTime(dayPOIs, accommodation, matrix, profile = 'foot-walking') {
  if (!dayPOIs || dayPOIs.length === 0) return 0;

  let totalSeconds = 0;

  // Travel from accommodation to first POI
  if (accommodation?.latitude && accommodation?.longitude && dayPOIs[0]?.latitude && dayPOIs[0]?.longitude) {
    const fromId = `accom_${accommodation.dayNumber || 'start'}`;
    const toId = `poi_${dayPOIs[0].id}`;

    const matrixTime = getTravelTime(fromId, toId, matrix);
    if (matrixTime !== null) {
      totalSeconds += matrixTime;
    } else {
      totalSeconds += estimateTravelTime(
        accommodation.latitude, accommodation.longitude,
        dayPOIs[0].latitude, dayPOIs[0].longitude,
        profile
      );
    }
  }

  // Travel between POIs
  for (let i = 0; i < dayPOIs.length - 1; i++) {
    const from = dayPOIs[i];
    const to = dayPOIs[i + 1];

    if (!from.latitude || !from.longitude || !to.latitude || !to.longitude) continue;

    const fromId = `poi_${from.id}`;
    const toId = `poi_${to.id}`;

    const matrixTime = getTravelTime(fromId, toId, matrix);
    if (matrixTime !== null) {
      totalSeconds += matrixTime;
    } else {
      totalSeconds += estimateTravelTime(
        from.latitude, from.longitude,
        to.latitude, to.longitude,
        profile
      );
    }
  }

  return Math.round(totalSeconds / 60);
}

/**
 * Cluster POIs by travel time using matrix.
 * @param {Array} pois - Array of POI objects
 * @param {number} maxMinutes - Maximum travel time within cluster (minutes)
 * @param {Object|null} matrix - Travel matrix
 * @param {string} profile - Transport profile
 * @returns {Array<Array>} Array of POI clusters
 */
function clusterPOIsByTravelTime(pois, maxMinutes, matrix, profile = 'foot-walking') {
  const clusters = [];
  const assigned = new Set();
  const maxSeconds = maxMinutes * 60;

  // Sort POIs by having coordinates first
  const sortedPOIs = [...pois].sort((a, b) => {
    const aHasCoords = a.latitude && a.longitude ? 1 : 0;
    const bHasCoords = b.latitude && b.longitude ? 1 : 0;
    return bHasCoords - aHasCoords;
  });

  for (const poi of sortedPOIs) {
    if (assigned.has(poi.id)) continue;

    const cluster = [poi];
    assigned.add(poi.id);

    if (poi.latitude && poi.longitude) {
      // Find nearby POIs by travel time
      for (const other of sortedPOIs) {
        if (assigned.has(other.id)) continue;
        if (!other.latitude || !other.longitude) continue;

        const fromId = `poi_${poi.id}`;
        const toId = `poi_${other.id}`;

        let travelSeconds;
        const matrixTime = getTravelTime(fromId, toId, matrix);
        if (matrixTime !== null) {
          travelSeconds = matrixTime;
        } else {
          travelSeconds = estimateTravelTime(
            poi.latitude, poi.longitude,
            other.latitude, other.longitude,
            profile
          );
        }

        if (travelSeconds <= maxSeconds) {
          cluster.push(other);
          assigned.add(other.id);
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Score a POI for placement on a specific day.
 * Higher scores are better.
 * @param {Object} poi - POI to score
 * @param {Array} dayPOIs - POIs already assigned to this day
 * @param {Object} constraints - Scheduling constraints
 * @param {Object|null} accommodation - Accommodation for the day
 * @param {Object|null} matrix - Travel matrix
 * @param {string} profile - Transport profile
 * @returns {number} Score for this placement
 */
function scorePOIForDay(poi, dayPOIs, constraints, accommodation = null, matrix = null, profile = 'foot-walking') {
  let score = 100; // Base score

  const currentDwellTime = getDayDwellTime(dayPOIs);
  const poiDwellTime = poi.dwell_time || 60;
  const maxMinutes = (constraints.maxHoursPerDay || DEFAULT_CONSTRAINTS.maxHoursPerDay) * 60;

  // Calculate travel time if adding this POI
  const currentTravelTime = calculateDayTravelTime(dayPOIs, accommodation, matrix, profile);
  const projectedPOIs = [...dayPOIs, poi];
  const projectedTravelTime = calculateDayTravelTime(projectedPOIs, accommodation, matrix, profile);
  const addedTravelTime = projectedTravelTime - currentTravelTime;

  // Time fitness - penalize if adding this POI would exceed budget (including travel time)
  const projectedTotal = currentDwellTime + poiDwellTime + addedTravelTime;
  if (projectedTotal > maxMinutes) {
    score -= 50; // Heavy penalty for exceeding time budget
  } else {
    // Bonus for good time fit (filling up day without exceeding)
    const fillRatio = projectedTotal / maxMinutes;
    score += fillRatio * 20; // Up to 20 point bonus for filling day well
  }

  // Penalty for excessive travel time for this single POI
  if (addedTravelTime > 30) {
    score -= Math.min(30, addedTravelTime - 30); // Penalty grows with travel time over 30 min
  }

  // Category penalty - check food limit
  const maxFood = constraints.maxFoodPerDay || DEFAULT_CONSTRAINTS.maxFoodPerDay;
  const currentFoodCount = countFoodPOIs(dayPOIs);

  if (isFoodCategory(poi.category)) {
    if (currentFoodCount >= maxFood) {
      score -= 80; // Strong penalty for exceeding food limit
    } else if (currentFoodCount === maxFood - 1) {
      score -= 20; // Mild penalty for using last food slot
    }
  }

  // Geographic bonus based on accommodation (start point)
  if (poi.latitude && poi.longitude && accommodation?.latitude && accommodation?.longitude) {
    const fromId = `accom_${accommodation.dayNumber || 'start'}`;
    const toId = `poi_${poi.id}`;

    let travelToAccom;
    const matrixTime = getTravelTime(fromId, toId, matrix);
    if (matrixTime !== null) {
      travelToAccom = matrixTime / 60; // Convert to minutes
    } else {
      travelToAccom = estimateTravelTime(
        accommodation.latitude, accommodation.longitude,
        poi.latitude, poi.longitude,
        profile
      ) / 60;
    }

    // Prefer POIs close to accommodation (within 10 minutes = bonus)
    if (travelToAccom <= 10) {
      score += 15 * (1 - travelToAccom / 10);
    }
  }

  // Geographic bonus - reward proximity to existing POIs on this day
  if (poi.latitude && poi.longitude && dayPOIs.length > 0) {
    const lastPOI = dayPOIs[dayPOIs.length - 1];
    if (lastPOI.latitude && lastPOI.longitude) {
      const fromId = `poi_${lastPOI.id}`;
      const toId = `poi_${poi.id}`;

      let travelFromLast;
      const matrixTime = getTravelTime(fromId, toId, matrix);
      if (matrixTime !== null) {
        travelFromLast = matrixTime / 60; // minutes
      } else {
        travelFromLast = estimateTravelTime(
          lastPOI.latitude, lastPOI.longitude,
          poi.latitude, poi.longitude,
          profile
        ) / 60;
      }

      const maxTravelMinutes = constraints.maxTravelMinutesInCluster || DEFAULT_CONSTRAINTS.maxTravelMinutesInCluster;

      if (travelFromLast <= maxTravelMinutes) {
        // Close to last POI - bonus based on proximity
        score += 30 * (1 - travelFromLast / maxTravelMinutes);
      } else if (travelFromLast <= maxTravelMinutes * 2) {
        // Within reasonable distance
        score += 10;
      } else {
        // Far from cluster - penalty
        score -= 15;
      }
    }
  }

  // Bonus for adding to empty day (helps with distribution)
  if (dayPOIs.length === 0) {
    score += 5;
  }

  return score;
}

/**
 * Generate saturation warnings for a schedule.
 * Returns warnings instead of auto-balancing (user decides).
 * @param {Object} schedule - Schedule object
 * @param {Array} days - Array of day objects
 * @param {Object} constraints - Scheduling constraints
 * @param {Object|null} matrix - Travel matrix
 * @param {Object} accommodationsByDay - Accommodations by day number
 * @param {string} profile - Transport profile
 * @returns {Array} Array of warning objects
 */
function generateSaturationWarnings(schedule, days, constraints, matrix, accommodationsByDay, profile = 'foot-walking') {
  const warnings = [];
  const maxMinutes = (constraints.maxHoursPerDay || DEFAULT_CONSTRAINTS.maxHoursPerDay) * 60;
  const maxFood = constraints.maxFoodPerDay || DEFAULT_CONSTRAINTS.maxFoodPerDay;

  // Calculate average POIs per day for distribution warning
  const totalPOIs = Object.values(schedule).reduce((sum, pois) => sum + pois.length, 0);
  const avgPOIs = totalPOIs / days.length;

  for (const day of days) {
    const dayPOIs = schedule[day.date] || [];
    const accommodation = accommodationsByDay[day.dayNumber];

    const dwellTime = getDayDwellTime(dayPOIs);
    const travelTime = calculateDayTravelTime(dayPOIs, accommodation, matrix, profile);
    const totalTime = dwellTime + travelTime;
    const foodCount = countFoodPOIs(dayPOIs);

    // Time exceeded warning
    if (totalTime > maxMinutes) {
      warnings.push({
        dayNumber: day.dayNumber,
        type: 'time_exceeded',
        severity: 'error',
        message: `Day ${day.dayNumber} exceeds time budget by ${Math.round((totalTime - maxMinutes) / 60 * 10) / 10} hours`,
        values: { totalMinutes: totalTime, maxMinutes, dwellTime, travelTime },
      });
    } else if (totalTime >= maxMinutes * 0.9) {
      warnings.push({
        dayNumber: day.dayNumber,
        type: 'time_near_limit',
        severity: 'warning',
        message: `Day ${day.dayNumber} is at ${Math.round(totalTime / maxMinutes * 100)}% capacity`,
        values: { totalMinutes: totalTime, maxMinutes },
      });
    }

    // Food limit exceeded warning
    if (foodCount > maxFood) {
      warnings.push({
        dayNumber: day.dayNumber,
        type: 'food_exceeded',
        severity: 'error',
        message: `Day ${day.dayNumber} has ${foodCount} food stops (max ${maxFood})`,
        values: { foodCount, maxFood },
      });
    }

    // Distribution warning (too many or too few POIs)
    if (dayPOIs.length > avgPOIs * 1.5 && dayPOIs.length >= 5) {
      warnings.push({
        dayNumber: day.dayNumber,
        type: 'overloaded',
        severity: 'warning',
        message: `Day ${day.dayNumber} has ${dayPOIs.length} POIs (avg ${Math.round(avgPOIs)})`,
        values: { poiCount: dayPOIs.length, avgPOIs: Math.round(avgPOIs) },
      });
    }

    // No accommodation warning
    if (!accommodation || !accommodation.name) {
      warnings.push({
        dayNumber: day.dayNumber,
        type: 'no_accommodation',
        severity: 'info',
        message: `Day ${day.dayNumber} has no accommodation set`,
        values: {},
      });
    }
  }

  return warnings;
}

/**
 * Generate a smart schedule distributing POIs across available days.
 * @param {Array} pois - Array of POI objects to schedule
 * @param {Array} days - Array of day objects with { date, dayNumber }
 * @param {Object} constraints - Scheduling constraints
 * @param {Object} accommodationsByDay - Accommodations keyed by dayNumber { 1: { latitude, longitude, ... }, ... }
 * @param {Object|null} travelMatrix - Travel matrix from ORS (optional)
 * @param {string} profile - Transport profile (default: 'foot-walking')
 * @returns {Object} Schedule result with assignments, stats, and warnings
 */
export function generateSmartSchedule(pois, days, constraints = {}, accommodationsByDay = {}, travelMatrix = null, profile = 'foot-walking') {
  const mergedConstraints = { ...DEFAULT_CONSTRAINTS, ...constraints };

  if (!pois || pois.length === 0 || !days || days.length === 0) {
    return {
      schedule: {},
      assignments: [],
      stats: {
        totalPOIs: 0,
        distributedPOIs: 0,
        avgHoursPerDay: 0,
        daysUsed: 0,
      },
      warnings: [],
    };
  }

  // Initialize schedule with empty arrays for each day
  const schedule = {};
  days.forEach(day => {
    schedule[day.date] = [];
  });

  // Separate anchored POIs from unanchored POIs
  const anchoredPOIs = pois.filter(poi => poi.is_anchored && poi.anchored_time && poi.scheduled_date);
  const unanchoredPOIs = pois.filter(poi => !poi.is_anchored);

  const assignments = [];

  // Pre-assign anchored POIs to their scheduled days
  for (const poi of anchoredPOIs) {
    const day = days.find(d => d.date === poi.scheduled_date);
    if (day) {
      schedule[day.date].push(poi);
      assignments.push({
        id: poi.id,
        scheduled_date: day.date,
        day_order: 0, // Will be re-ordered later
        is_anchored: true,
        anchored_time: poi.anchored_time,
      });
    }
  }

  // Sort anchored POIs by time within each day
  for (const day of days) {
    schedule[day.date].sort((a, b) => {
      if (!a.anchored_time || !b.anchored_time) return 0;
      return a.anchored_time.localeCompare(b.anchored_time);
    });
  }

  // Cluster unanchored POIs by travel time
  const maxTravelMinutes = mergedConstraints.maxTravelMinutesInCluster || DEFAULT_CONSTRAINTS.maxTravelMinutesInCluster;
  const clusters = clusterPOIsByTravelTime(unanchoredPOIs, maxTravelMinutes, travelMatrix, profile);

  // Flatten clusters while preserving cluster order (keeps nearby POIs together in queue)
  const poisToAssign = clusters.flat();

  // Assign unanchored POIs to days using scoring
  for (const poi of poisToAssign) {
    let bestDay = null;
    let bestScore = -Infinity;

    for (const day of days) {
      const dayPOIs = schedule[day.date];
      // Get accommodation location for this day (if available)
      const accommodation = accommodationsByDay[day.dayNumber];
      const accommodationWithDay = accommodation ? { ...accommodation, dayNumber: day.dayNumber } : null;

      const score = scorePOIForDay(poi, dayPOIs, mergedConstraints, accommodationWithDay, travelMatrix, profile);

      if (score > bestScore) {
        bestScore = score;
        bestDay = day;
      }
    }

    if (bestDay) {
      schedule[bestDay.date].push(poi);

      assignments.push({
        id: poi.id,
        scheduled_date: bestDay.date,
        day_order: 0, // Will be set below
        is_anchored: false,
      });
    }
  }

  // Recalculate day_order for all assignments
  days.forEach(day => {
    schedule[day.date].forEach((poi, index) => {
      const assignment = assignments.find(a => a.id === poi.id);
      if (assignment) {
        assignment.day_order = index;
      }
    });
  });

  // Generate saturation warnings (instead of auto-balancing)
  const warnings = generateSaturationWarnings(
    schedule, days, mergedConstraints, travelMatrix, accommodationsByDay, profile
  );

  // Calculate stats
  const daysWithPOIs = days.filter(day => schedule[day.date].length > 0);
  const totalMinutes = Object.values(schedule).reduce((sum, dayPOIs) => sum + getDayDwellTime(dayPOIs), 0);
  const avgMinutesPerDay = daysWithPOIs.length > 0 ? totalMinutes / daysWithPOIs.length : 0;

  return {
    schedule,
    assignments,
    stats: {
      totalPOIs: pois.length,
      distributedPOIs: assignments.length,
      avgHoursPerDay: Math.round(avgMinutesPerDay / 60 * 10) / 10, // Round to 1 decimal
      daysUsed: daysWithPOIs.length,
      anchoredCount: anchoredPOIs.length,
    },
    warnings,
  };
}

/**
 * Get schedule summary by day for preview.
 * @param {Object} schedule - Schedule object from generateSmartSchedule
 * @param {Array} days - Array of day objects
 * @param {Object} constraints - Scheduling constraints
 * @param {Object} accommodationsByDay - Accommodations keyed by dayNumber { 1: { name, latitude, longitude, ... }, ... }
 * @param {Object|null} travelMatrix - Travel matrix
 * @param {string} profile - Transport profile
 * @returns {Array} Array of day summaries for preview
 */
export function getSchedulePreview(schedule, days, constraints = {}, accommodationsByDay = {}, travelMatrix = null, profile = 'foot-walking') {
  const mergedConstraints = { ...DEFAULT_CONSTRAINTS, ...constraints };

  return days.map(day => {
    const dayPOIs = schedule[day.date] || [];
    const dwellTimeMinutes = getDayDwellTime(dayPOIs);
    const accommodation = accommodationsByDay[day.dayNumber] || null;
    const travelTimeMinutes = calculateDayTravelTime(dayPOIs, accommodation, travelMatrix, profile);
    const totalTimeMinutes = dwellTimeMinutes + travelTimeMinutes;

    const foodCount = countFoodPOIs(dayPOIs);
    const maxMinutes = mergedConstraints.maxHoursPerDay * 60;
    const maxFood = mergedConstraints.maxFoodPerDay;

    // Count anchored POIs
    const anchoredCount = dayPOIs.filter(poi => poi.is_anchored).length;

    // Generate day-specific warnings
    const dayWarnings = [];

    if (totalTimeMinutes > maxMinutes) {
      dayWarnings.push({
        type: 'time_exceeded',
        severity: 'error',
        message: `Exceeds budget by ${Math.round((totalTimeMinutes - maxMinutes) / 60 * 10) / 10}h`,
      });
    } else if (totalTimeMinutes >= maxMinutes * 0.9) {
      dayWarnings.push({
        type: 'time_near_limit',
        severity: 'warning',
        message: `${Math.round(totalTimeMinutes / maxMinutes * 100)}% capacity`,
      });
    }

    if (foodCount > maxFood) {
      dayWarnings.push({
        type: 'food_exceeded',
        severity: 'error',
        message: `${foodCount} food stops (max ${maxFood})`,
      });
    }

    if (!accommodation || !accommodation.name) {
      dayWarnings.push({
        type: 'no_accommodation',
        severity: 'info',
        message: 'No accommodation set',
      });
    }

    return {
      ...day,
      pois: dayPOIs,
      poiCount: dayPOIs.length,
      anchoredCount,
      dwellTimeMinutes,
      dwellTimeHours: Math.round(dwellTimeMinutes / 60 * 10) / 10,
      travelTimeMinutes,
      totalTimeMinutes,
      totalTimeHours: Math.round(totalTimeMinutes / 60 * 10) / 10,
      foodCount,
      accommodation,
      warnings: dayWarnings,
      // Legacy warnings format (for backwards compatibility)
      warningsLegacy: {
        timeExceeded: totalTimeMinutes > maxMinutes,
        foodExceeded: foodCount > maxFood,
        atTimeLimit: totalTimeMinutes >= maxMinutes * 0.9 && totalTimeMinutes <= maxMinutes,
        atFoodLimit: foodCount === maxFood,
        noAccommodation: !accommodation || !accommodation.name,
      },
    };
  });
}
