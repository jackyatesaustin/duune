const surfSpotsConfig = {
    "Hermosa Breakwater": {
        lat: 33.863,
        lon: -118.400,
        buoyId: "9410840", // Closest buoy in Santa Monica
        tide: {
            low: 2,
            moderate: 4.5,
            high: 5.1,
            veryHigh: 6
        },
        wind: {
            glassy: 5,
            mild: 7,
            bad: 10
        }
    },
    "Hermosa Pier": {
        lat: 33.862,
        lon: -118.399,
        buoyId: "9410840", // Closest buoy in Santa Monica
        tide: {
            low: 2,
            moderate: 4.5,
            high: 5.1,
            veryHigh: 6
        },
        wind: {
            glassy: 5,
            mild: 7,
            bad: 10
        }
    },
    "default": {
        lat: 34.0522, // Default to Los Angeles
        lon: -118.2437,
        buoyId: "9410660", // Default buoy in LA Harbor
        tide: {
            low: 1.5,
            moderate: 4,
            high: 5,
            veryHigh: 6
        },
        wind: {
            glassy: 4,
            mild: 6,
            bad: 8
        }
    }
};
