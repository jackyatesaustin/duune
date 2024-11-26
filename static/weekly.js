// Cache for weekly regional data
const weeklyWaveCache = {};

// Constants for regions
const REGIONS = {
    southBay: {
        id: 'southBayWaveHeightPlot',
        spots: ['El Porto', 'Redondo Breakwater']
    },
    laWest: {
        id: 'laWestWaveHeightPlot',
        spots: ['Venice Breakwater', 'Will Rogers']
    },
    southMalibu: {
        id: 'southMalibuWaveHeightPlot',
        spots: ['Sunset', 'Malibu First Point']
    },
    northMalibu: {
        id: 'northMalibuWaveHeightPlot',
        spots: ['Zuma', 'Leo Carrillo']
    }
};



// Helper function to convert degrees to cardinal directions
function degreesToCardinal(degrees) {
    const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(((degrees + 11.25) % 360) / 22.5);
    return cardinals[index % 16];
}





async function updateRegionalOverviews(startDate) {
    console.log(`%c[RegionalOverviews] Starting regional overview updates from ${startDate}`, 
        "color: purple; font-weight: bold;");

        const nextWeekBtn = document.getElementById('nextWeekBtn');
        const isNextWeek = nextWeekBtn.classList.contains('active');
    

    const windowWidth = window.innerWidth;
    const isMobile = windowWidth <= 768;

    // Generate array of 7 consecutive dates for display purposes only
    const dates = [];
    const start = new Date(`${startDate}T00:00:00-08:00`);  // Force PST timezone

        // If next week is active, offset the start date by 7 days
        if (isNextWeek) {
            start.setDate(start.getDate() + 7);
        }
    

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + i);
        const year = currentDate.getUTCFullYear();
        const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getUTCDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
    }

    for (const [regionName, region] of Object.entries(REGIONS)) {
        try {
            let regionalData = new Map();
            let spotDataLog = {};

            // Fetch data for each spot in the region
            for (const spot of region.spots) {
                const spotId = await getSpotId(spot);
                if (!spotId) continue;

                spotDataLog[spot] = {};
                
                // Only fetch forecast once with the start date
                const waveData = await getSpotForecast(spotId, startDate);
                
                if (waveData && waveData.length > 0) {
                    // Process the wave data for each date we want to display
                    waveData.forEach(dataPoint => {
                        const timeKey = dataPoint.time.getTime();
                        const dataDate = dataPoint.time.toISOString().split('T')[0];
                        
                        // Only process if this date is in our display range
                        if (dates.includes(dataDate)) {
                            if (!regionalData.has(timeKey)) {
                                regionalData.set(timeKey, []);
                            }
                            regionalData.get(timeKey).push(dataPoint.height);
                            
                            if (!spotDataLog[spot][dataDate]) {
                                spotDataLog[spot][dataDate] = [];
                            }
                            
                            spotDataLog[spot][dataDate].push({
                                time: dataPoint.time.toLocaleString(),
                                height: dataPoint.height
                            });
                        }
                    });
                }
            }

            if (regionalData.size === 0) {
                console.error(`%c[RegionalOverviews] No valid data collected for ${regionName}`, "color: red;");
                continue;
            }

            // Convert Map to arrays for plotting
            const times = Array.from(regionalData.keys()).sort();
            const heights = times.map(time => {
                const heightsAtTime = regionalData.get(time);
                return heightsAtTime.reduce((sum, h) => sum + h, 0) / heightsAtTime.length;
            });

            // Create shapes array for night shading and day separators
            const shapes = [];

            // Add night shading and day separators for each date
            for (let i = 0; i < 7; i++) {
                const currentDate = new Date(dates[i]);
                const sunApiUrl = `https://api.sunrise-sunset.org/json?lat=34.0522&lng=-118.2437&date=${dates[i]}&formatted=0`;
                
                try {
                    const response = await fetch(sunApiUrl);
                    const sunData = await response.json();
                    
                    if (sunData.status === 'OK') {
                        const sunriseTime = new Date(sunData.results.sunrise);
                        const sunsetTime = new Date(sunData.results.sunset);

                        // Night shading
                        shapes.push({
                            type: 'rect',
                            xref: 'x',
                            yref: 'paper',
                            x0: sunsetTime.getTime(),
                            x1: sunriseTime.getTime() + (24 * 60 * 60 * 1000),
                            y0: 0,
                            y1: 1,
                            fillcolor: '#E5E5E5',
                            opacity: 0.3,
                            line: { width: 0 }
                        });

                        // Day separator
                        shapes.push({
                            type: 'line',
                            xref: 'x',
                            yref: 'paper',
                            x0: new Date(currentDate.setHours(0, 0, 0, 0)).getTime(),
                            x1: new Date(currentDate.setHours(0, 0, 0, 0)).getTime(),
                            y0: 0,
                            y1: 1,
                            line: {
                                color: 'rgba(0, 0, 255, 0.3)',
                                width: 1,
                                dash: 'dot'
                            }
                        });
                    }
                } catch (error) {
                    console.error(`Failed to fetch sun times for ${dates[i]}:`, error);
                }
            }

            // Fetch wave data for swell information
            let waveData = [];
            try {
                const response = await fetch('/wave_data');
                if (response.ok) {
                    waveData = await response.json();
                }
            } catch (error) {
                console.error(`%c[RegionalOverviews] Error fetching wave data:`, "color: red;", error);
            }

            // Create trace for the plot
            const trace = {
                x: times.map(t => new Date(t)),
                y: heights,
                mode: 'lines',
                line: { 
                    color: 'blue', 
                    width: 3,
                    shape: 'spline',
                    smoothing: 1.3
                },
                hovertemplate: `
                    <b>%{x|%I:%M %p}</b><br>
                    %{x|%a %b %d}<br>
                    Height: %{y:.1f} ft<br>
                    %{customdata}<br>
                    <extra></extra>
                `,
                customdata: times.map(time => {
                    const timeDate = new Date(time);
                    const matchingWaveData = waveData.find(d => 
                        Math.abs(new Date(d.timestamp).getTime() - timeDate.getTime()) < 300000
                    );

                    if (matchingWaveData?.swells) {
                        return matchingWaveData.swells.map((swell, index) => 
                            `Swell ${index + 1}: ${swell.direction}° ${degreesToCardinal(swell.direction)} @ ${swell.period}s`
                        ).join('<br>');
                    }
                    return 'No swell data available';
                })
            };

            // Create layout
            const layout = {
                width: document.getElementById(region.id).offsetWidth,
                height: 200,
                margin: {
                    l: isMobile ? 35 : 45,
                    r: isMobile ? 15 : 20,
                    t: 20,
                    b: isMobile ? 30 : 40,
                    pad: 0
                },
                xaxis: {
                    tickformat: '%a<br>%d',
                    dtick: 24 * 3600 * 1000,
                    tickmode: 'array',
                    tickvals: dates.map(date => new Date(`${date}T12:00:00`).getTime()),
                    range: [
                        new Date(`${dates[0]}T00:00:00`).getTime(),
                        new Date(`${dates[6]}T23:59:59`).getTime()
                    ],
                    tickfont: { size: isMobile ? 10 : 12 },
                    fixedrange: true,
                    showgrid: false,
                    zeroline: false
                },
                yaxis: {
                    tickfont: { size: isMobile ? 10 : 12 },
                    titlefont: { size: isMobile ? 12 : 14 },
                    fixedrange: true,
                    showgrid: false,
                    zeroline: false
                },
                shapes: shapes,
                showlegend: false,
                autosize: true,
                hovermode: 'x',
                hoverdistance: 50,
                dragmode: false,
                hoverlabel: {
                    bgcolor: 'white',
                    bordercolor: '#c7c7c7',
                    font: { size: 12 }
                }
            };

            // Plot the graph
            Plotly.newPlot(region.id, [trace], layout, {
                responsive: true,
                displayModeBar: false,
                staticPlot: false,
                scrollZoom: false,
                doubleClick: false,
                modeBarButtonsToRemove: ['zoom2d', 'pan2d', 'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d']
            });

            console.log(`%c[RegionalOverviews] Successfully plotted 7-day forecast for ${regionName}`, "color: green;");
        } catch (error) {
            console.error(`%c[RegionalOverviews] Error processing ${regionName}:`, "color: red;", error);
        }
    }
}



document.addEventListener('DOMContentLoaded', function() {
    const thisWeekBtn = document.getElementById('thisWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    let isInitialized = false;

    function updateButtonStates(activeBtn) {
        thisWeekBtn.classList.toggle('active', activeBtn === thisWeekBtn);
        nextWeekBtn.classList.toggle('active', activeBtn === nextWeekBtn);
    }

    thisWeekBtn.addEventListener('click', async () => {
        updateButtonStates(thisWeekBtn);
        clearRegionalPlots();
        const today = new Date();
        await updateRegionalOverviews(today.toISOString().split('T')[0]);
    });

    nextWeekBtn.addEventListener('click', async () => {
        updateButtonStates(nextWeekBtn);
        clearRegionalPlots();
        const today = new Date();  // Just use today's date
        await updateRegionalOverviews(today.toISOString().split('T')[0]);
    });

    // Initialize on load
    if (!isInitialized) {
        isInitialized = true;
        thisWeekBtn.click();
    }
});






// Helper function to clear plots
function clearRegionalPlots() {
    const regions = ['southBayWaveHeightPlot', 'laWestWaveHeightPlot', 
                    'southMalibuWaveHeightPlot', 'northMalibuWaveHeightPlot'];
    regions.forEach(regionId => {
        const plotDiv = document.getElementById(regionId);
        if (plotDiv) {
            Plotly.purge(plotDiv);
        }
    });
}













async function getSpotId(spotName) {
    console.log(`%c[getSpotId] Fetching Spot ID for: ${spotName}`, "color: blue; font-weight: bold;");
    try {
        const response = await fetch('/get_spot_id');
        const spots = await response.json();
        
        console.log(`%c[getSpotId] Fetched spots:`, "color: blue;", spots);
        
        const selectedSpot = spots.find(spot => spot.spot_name === spotName);

        if (selectedSpot) {
            const spotId = selectedSpot.spot_id;
            console.log(`%c[getSpotId] Spot found! Spot Name: ${spotName}, Spot ID: ${spotId}`, "color: green; font-weight: bold;");
            return spotId;  // Return the correct spotId
        } else {
            console.error(`%c[getSpotId] Spot ID not found for: ${spotName}`, "color: red; font-weight: bold;");
            return null;
        }
    } catch (error) {
        console.error(`%c[getSpotId] Failed to fetch spot ID or wave forecast for: ${spotName}`, "color: red; font-weight: bold;", error);
        return null;
    }
}



async function getSpotForecast(spotId, date) {  // Keep the date parameter
    try {
        console.log(`%c[Forecast Fetch] Fetching wave forecast for Spot ID: ${spotId} and Date: ${date}`, "color: teal; font-weight: bold;");

        const response = await fetch(`/get_wave_forecast?spot_id=${spotId}&date=${date}`);
        const forecast = await response.json();
        console.log(`%c[Forecast Fetch] Response received for Spot ID: ${spotId}, Date: ${date}`, "color: teal;");

        // Log the raw forecast data
        console.log(`%c[Forecast Fetch] Raw forecast data:`, "color: teal;", forecast);

        if (!forecast || forecast.error) {
            console.error(`%c[Forecast Error] Invalid forecast data received:`, "color: red; font-weight: bold;", forecast);
            return null;
        }

        // Create a temporary object to store unique hourly data
        const uniqueHourlyData = {};
        
        // Initialize the cache for this date if it doesn't exist
        if (!weeklyWaveCache[date]) {
            weeklyWaveCache[date] = [];
        }
        
        // Clear existing data for this date
        weeklyWaveCache[date] = [];

        if (Array.isArray(forecast)) {
            forecast.forEach(item => {
                if (item && item.time !== undefined && item.height !== undefined) {
                    weeklyWaveCache[date].push({
                        time: item.time,
                        height: item.height
                    });
                }
            });

            // Sort the data by time
            weeklyWaveCache[date].sort((a, b) => a.time - b.time);
        }
        
        console.log(`%c[Forecast Cache] Cached wave data for ${date}:`, "color: teal;", weeklyWaveCache[date]);
        console.log(`%c[Forecast Cache] Full cached wave data after update:`, "color: teal;", weeklyWaveCache);

        return weeklyWaveCache[date];

    } catch (error) {
        console.error(`%c[Forecast Error] Failed to fetch wave forecast for Spot ID: ${spotId}`, "color: red; font-weight: bold;", error);
        return null;
    }
}

// Helper function to generate dates
function generateDates(startDate, numDays) {
    const dates = [];
    const start = new Date(startDate);
    
    for (let i = 0; i < numDays; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        dates.push(formattedDate);
    }
    
    return dates;
}






async function getSpotForecast(spotId, date) {
    try {
        console.log(`%c[Forecast Fetch] Fetching wave forecast for Spot ID: ${spotId} and Date: ${date}`, "color: teal; font-weight: bold;");

        const response = await fetch(`/get_wave_forecast?spot_id=${spotId}&date=${date}`);
        const forecast = await response.json();
        console.log(`%c[Forecast Fetch] Response received for Spot ID: ${spotId}, Date: ${date}`, "color: teal;");

        // Log the raw forecast data
        console.log(`%c[Forecast Fetch] Raw forecast data:`, "color: teal;", forecast);

        // Check if we received an error response
        if (forecast.error) {
            console.error(`%c[Forecast Error] Server returned error:`, "color: red; font-weight: bold;", forecast.error);
            return null;
        }

        // Create a temporary object to store unique hourly data
        const uniqueHourlyData = {};
        
        forecast.forEach(item => {
            const localDateObj = item.date_local;
            const localDate = `${localDateObj.yy}-${String(localDateObj.mm).padStart(2, '0')}-${String(localDateObj.dd).padStart(2, '0')}`;
            
            // Create a key for each hour of each date
            const hourKey = `${localDate}-${localDateObj.hh}`;
            
            // Only keep the entry if we haven't seen this hour before or if it has a higher wave height
            if (!uniqueHourlyData[hourKey] || item.size_ft > uniqueHourlyData[hourKey].height) {
                uniqueHourlyData[hourKey] = {
                    date: localDate,
                    time: new Date(localDateObj.yy, localDateObj.mm - 1, localDateObj.dd, localDateObj.hh, 0),
                    height: parseFloat(item.size_ft.toFixed(3))
                };
            }
        });

        // Convert the unique hourly data back into the cached format
        if (!weeklyWaveCache[date]) {
            weeklyWaveCache[date] = [];
        }
        
        // Clear existing data for this date
        weeklyWaveCache[date] = [];
        
        Object.values(uniqueHourlyData).forEach(item => {
            weeklyWaveCache[date].push({
                time: item.time,
                height: item.height
            });
        });

        // Sort the data by time
        weeklyWaveCache[date].sort((a, b) => a.time - b.time);
        
        console.log(`%c[Forecast Cache] Cached wave data for ${date}:`, "color: teal;", weeklyWaveCache[date]);
        console.log(`%c[Forecast Cache] Full cached wave data after update:`, "color: teal;", weeklyWaveCache);

        return weeklyWaveCache[date];

    } catch (error) {
        console.error(`%c[Forecast Error] Failed to fetch wave forecast for Spot ID: ${spotId}`, "color: red; font-weight: bold;", error);
        return null;
    }
}

