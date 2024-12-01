/*
ideas

1. making timedate global and referencing it
can we do this globally and then reference it so we're not getting it everytime -     // Fetch sunrise and sunset times for the selected spot and date
    const sunApiUrl = `https://api.sunrise-sunset.org/json?lat=34.0522&lng=-118.2437&date=${date}&formatted=0`;
    let sunriseTime, sunsetTime;




*/


// hiding the url
//window.history.replaceState({}, '', '/surf-report-la');



// At the top of the file with other global variables
let isInitialLoad = true;
let isUpdatingBiggestDays = false;

// Utility function to get date with timezone offset (at top of file)
function getFormattedDate(daysOffset = 0) {
    const date = new Date();
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const currentDate = new Date(date.getTime() + (daysOffset * 86400000) - timezoneOffset);
    return currentDate.toISOString().split('T')[0];
}


// Updated window.onload function THAT LOADS THE BUTTONS 
window.onload = async function () {
    console.log("%c[App Init] Page loaded. Initializing application...", "color: blue; font-weight: bold;");

    const dateInput = document.getElementById('dateInput');
    const spotSelect = document.getElementById('spotSelect');


    // Initialize with timezone-adjusted date
    const currentDate = getFormattedDate(); // No offset for today
    dateInput.value = currentDate;
    
    // Initial data for today's date and current spot
    let currentSpot = spotSelect.value;
    let currentSpotId = await getSpotId(currentSpot);
//    let currentDate = todayISO;

    if (!currentSpotId) {
        console.error("%c[App Init] Error: Failed to resolve initial spot ID.", "color: red; font-weight: bold;");
        return;
    }

    //update label above waveheight graph      
    updateSpotDateLabel(currentSpot, currentDate);
    
    // Fetch wave forecast and generate date buttons before initial getData call
    await getSpotForecast(currentSpotId);
    await generateDateButtons(currentSpotId);

    // Single getData call that will trigger the initial update
    await getData();  

    await updateTopUpcomingDays(currentSpot);
    await updateBiggestUpcomingLADays();

};



    
    spotSelect.addEventListener('change', async function (e) {
        const newSpot = e.target.value;
        const currentDate = document.getElementById('dateInput').value;
        
        
        // If we're still in initial load, wait until it's complete
        if (isInitialLoad) {
            console.log(`%c[Spot Change] Initial load in progress, waiting to change to ${newSpot}...`, "color: orange;");
            // Set the spot value but return early
            spotSelect.value = newSpot;
            return;
        }
        
        try {
            // Clear existing data
            cachedWaveData = {};

            // Force clear any existing plots
            Plotly.purge('windPlot');
            Plotly.purge('tidePlot');
            Plotly.purge('bestTimesPlot');
            Plotly.purge('waveHeightPlot');
            


            
            // Get spot ID and regenerate date buttons
            const spotId = await getSpotId(newSpot);
            await getSpotForecast(spotId);
            await generateDateButtons(spotId);
            await getData(true, true); 
            await updateTopUpcomingDays(newSpot);
            await updateBiggestUpcomingLADays();
            
            console.log(`%c[Spot Change] Successfully updated to ${newSpot}`, "color: green; font-weight: bold;");
        } catch (error) {
            console.error('[Spot Change] Error updating spot:', error);
        }
    });
    
    // Then at the end of your window.onload, after all initial data is loaded:
    isInitialLoad = false;



    let currentDate = new Date().toISOString().split('T')[0];  // Initialize with today's date

    // Event listener for date change
    dateInput.addEventListener('change', async function () {
        //const newDate = dateInput.value;
        const newDate = dateInput.value;
        const currentSpot = document.getElementById('spotSelect').value;
        console.log(`%c[Date Change] Detected date change: New date: ${newDate}, Current date: ${currentDate}`, "color: orange; font-weight: bold;");


        

        // Only update the data if the date changes, without reloading the buttons
        if (newDate !== currentDate) {
            console.log("%c[Date Change] Date changed! Updating data without reloading buttons...", "color: orange; font-weight: bold;");
            currentDate = newDate;

            // Force clear any existing plots
            Plotly.purge('windPlot');
            Plotly.purge('tidePlot');
            Plotly.purge('bestTimesPlot');
            Plotly.purge('waveHeightPlot');

            


            // Check if the wave data is already cached for the new date
            if (!cachedWaveData || !cachedWaveData[newDate]) {
                console.log(`%c[Date Change] No cached data for ${newDate}. Fetching wave data for the new date...`, "color: orange;");
                const spotId = await getSpotId(currentSpot);
                if (!spotId) {
                    console.error("%c[Date Change] Error: Spot ID is undefined.", "color: red; font-weight: bold;");
                    return;
                }
                await getSpotForecast(spotId, newDate);  // Fetch the wave forecast for the new date
            } else {
                console.log(`%c[Date Change] Cached wave data found for ${newDate}. Skipping fetch...`, "color: orange;");
            }



            // Fetch and update data for the selected spot and date
            await getData(false, false);  // This should update the graphs and information
        } else {
            console.log("%c[Date Change] No change in date detected. Skipping data update.", "color: orange;");
        }
    });






let cachedWaveData = {}; // To store wave data keyed by date
let cachedRegionalData = {};

const selectedSpot = '';




async function getSpotForecast(spotId) {
    try {
        const localToday = new Date();
        const formattedToday = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
        console.log(`%c[Forecast Fetch] Fetching wave forecast for Spot ID: ${spotId} and Date: ${formattedToday}`, "color: teal; font-weight: bold;");

        const response = await fetch(`/get_wave_forecast?spot_id=${spotId}&date=${formattedToday}`);
        const forecast = await response.json();
        console.log(`%c[Forecast Fetch] Response received for Spot ID: ${spotId}, Date: ${formattedToday}`, "color: teal;");

                // Log the raw forecast data
                console.log(`%c[Forecast Fetch] Raw forecast data:`, "color: teal;", forecast);

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
        cachedWaveData = {}; // Clear existing cache
        
        Object.values(uniqueHourlyData).forEach(item => {
            if (!cachedWaveData[item.date]) {
                cachedWaveData[item.date] = [];
            }
            cachedWaveData[item.date].push({
                time: item.time,
                height: item.height
            });
        });

        // Sort the data by time for each date
        for (const date in cachedWaveData) {
            cachedWaveData[date].sort((a, b) => a.time - b.time);
        }
        
        console.log(`%c[Forecast Cache] Cached wave data for ${formattedToday}:`, "color: teal;", cachedWaveData[formattedToday]);
        console.log(`%c[Forecast Cache] Full cached wave data after update:`, "color: teal;", cachedWaveData);

    } catch (error) {
        console.error(`%c[Forecast Error] Failed to fetch wave forecast for Spot ID: ${spotId}`, "color: red; font-weight: bold;", error);
    }
}







//testing
function updateWaveGraph(date, sunrise, sunset) {
    
    const callId = Math.random().toString(36).substr(2, 5); // Generate a unique ID for this call
    
    console.log(`%c[Wave Height call id ${callId}] Starting graph update for date: ${date}`, "color: blue; font-weight: bold;");    
    console.log(`%c[Wave Height call id ${callId}] Stack trace:`, "color: blue;", new Error().stack);
    
    
    
    console.log(`%c[WaveGraph] Starting updateWaveGraph for date: ${date}`, "color: purple; font-weight: bold;");    
    const waveDataForDate = cachedWaveData[date];

    if (!waveDataForDate) {
        console.error(`%c[WaveGraph Error] No wave data available for the selected date: ${date}`, "color: red; font-weight: bold;");
        return;
    }

    console.log(`%c[WaveGraph] Wave data found for ${date}:`, "color: purple;", waveDataForDate);

        // Filter data for 4 AM to 8 PM before any processing
        const filteredWaveData = waveDataForDate.filter(item => {
            const hour = item.time.getHours();
            return hour >= 4 && hour <= 20;
        });
    
        console.log(`%c[WaveGraph] Filtered wave data (4AM-8PM) for ${date}:`, "color: purple;", filteredWaveData);


    // Sort the data chronologically
    const sortedWaveData = [...waveDataForDate].sort((a, b) => a.time - b.time);




    // Log all wave heights with consistent formatting
    console.log(`%c[Wave Height] All heights for ${date} (4AM-8PM):`, "color: blue; font-weight: bold;");
    sortedWaveData.forEach(data => {
        const hour = data.time.getHours();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        console.log(`[Wave Heights by hour] ${date} ${hour12}:00 ${ampm}: ${data.height.toFixed(1)} ft`);
    });

    // Map times and heights from filtered data
    let waveTimes = sortedWaveData.map(item => item.time);
    let waveHeights = sortedWaveData.map(item => item.height);

    console.log(`%c[WaveGraph] Mapping wave times and heights for ${date}:`, "color: purple;");
    console.log("%c[WaveGraph] Wave Times (4AM-8PM):", "color: purple;", waveTimes);
    console.log("%c[WaveGraph] Wave Heights (4AM-8PM):", "color: purple;", waveHeights);






    // Sort the times and corresponding heights to ensure proper plotting
    waveTimes.sort((a, b) => a - b);
    waveHeights = waveTimes.map(time => {
        const index = waveDataForDate.findIndex(item => item.time.getTime() === time.getTime());
        return waveDataForDate[index].height;
    });

    console.log("%c[WaveGraph] Sorted Wave Times:", "color: purple;", waveTimes);
    console.log("%c[WaveGraph] Mapped Heights After Sorting:", "color: purple;", waveHeights);


    const trace = {
        x: waveTimes,
        y: waveHeights,
        mode: 'lines',
        name: 'Wave Height',
        line: { 
            color: 'blue', 
            width: 3,
            shape: 'spline',    // Add spline shape for smoothing
            smoothing: 1.3      // Add smoothing factor
        },
        fill: 'tozeroy',
        fillcolor: '#add8e6', //'rgba(128, 128, 128, 0.2)',  // Default fill
        hovertemplate: `
            <b>%{x|%I:%M %p}</b><br>
            %{x|%a %b %d}<br>
            Height: %{y:.1f} ft
            <extra></extra>
        `,
        hoverlabel: { 
            bgcolor: 'white', 
            namelength: 0,
            font: { size: 14, family: 'Arial, sans-serif' }
        }
    };

    console.log("%c[WaveGraph] Trace Data Ready for Plot:", "color: purple;", trace);

    const shapes = [];

    if (sunrise && sunset) {
        console.log(`%c[WaveGraph] Sunrise and Sunset times available: Sunrise - ${sunrise}, Sunset - ${sunset}`, "color: purple;");
        shapes.push(
            {
                type: 'rect',
                xref: 'x',
                yref: 'paper',
                x0: new Date(`${date}T00:00:00`),
                x1: sunrise,
                y0: 0,
                y1: 1,
                //fillcolor: 'rgba(211, 211, 211, 0.3)',
                //fillcolor: '#E5E5E5',
                fillcolor: '#E5E5E5',
                opacity: 0.3,
                line: { width: 0 }
            },
            {
                type: 'rect',
                xref: 'x',
                yref: 'paper',
                x0: sunset,
                x1: new Date(`${date}T23:59:59`),
                y0: 0,
                y1: 1,
                //fillcolor: 'rgba(211, 211, 211, 0.3)',
                //fillcolor: '#E5E5E5',
                fillcolor: '#E5E5E5',
                opacity: 0.3,
                line: { width: 0 }
            }
        );
    }


    const spot = document.getElementById('spotSelect').value;
    //const dateInput = document.getElementById('dateInput');



        // Responsive design settings
        const windowWidth = window.innerWidth;
        const isMobile = windowWidth <= 768;  // Detect if mobile (you can tweak the pixel threshold)
        
        const layout = {
            title: {
                text: `Wave height for ${spot} on ${date}`,
                font: { size: isMobile ? 10 : 14 }  // Smaller title on mobile
            },
            xaxis: {
                tickformat: '%-I %p',  // Format as "1 PM", "2 PM", etc.
                dtick: 3600000,        // Show ticks every hour (3600000ms = 1 hour)
                range: [
                    new Date(date + 'T04:00:00').getTime(),  // 4 AM
                    new Date(date + 'T20:00:00').getTime()   // 8 PM
                ],
                tickfont: {
                    size: isMobile ? 10 : 14,
                },
                fixedrange: true,  // Disable x-axis zoom
                showgrid: false,   // Remove vertical grid lines
                zeroline: false    // Remove x-axis zero line
            },
            yaxis: { 
             //t)', 
                tickfont: {
                    size: isMobile ? 10 : 14
                },
                titlefont: {
                    size: isMobile ? 12 : 16
                },
                fixedrange: true,  // Disable y-axis zoom
                showgrid: false,   // Remove vertical grid lines
                zeroline: false    // Remove x-axis zero line
            },
            height: isMobile ? 250 : 300,
            margin: { 
                l: isMobile ? 40 : 50, 
                r: isMobile ? 30 : 50, 
                t: isMobile ? 30 : 40, 
                b: isMobile ? 40 : 50 
            },
            shapes: shapes,
            hovermode: 'x',           // Changed from 'closest' to 'x'
            hoverdistance: 50,        // Adjusted for better touch response
            hoverlabel: {
                namelength: -1,
                bgcolor: 'white',
                font: { size: 12 }
            },
            dragmode: false          // Disable drag mode
        };
        
        Plotly.newPlot('waveHeightPlot', [trace], layout, { 
            responsive: true, 
            displayModeBar: false, 
            staticPlot: false,
            scrollZoom: false,         // Disable scroll zoom
            doubleClick: false,        // Disable double-click zoom
            modeBarButtonsToRemove: ['zoom2d', 'pan2d', 'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d']
        });
    console.log("%c[WaveGraph] Plotly Plot Updated Successfully for date: " + date, "color: green; font-weight: bold;");

}
















//working
let dataFetched = false;  // A flag to track if data was fetched already
async function getData(shouldGenerateButtons = false, updateUpcomingDays = false) {
   // cachedWaveData = {}
    console.log(`%c[getData] Starting data fetch...`, "color: navy; font-weight: bold;");
    //console.log('[getData] Function called with spot:', spot, 'date:', date);

    

    dataFetched = false;

    const dateInput = document.getElementById('dateInput');
    const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0]; // Default to today if no date input
    const spot = document.getElementById('spotSelect').value;
    const surfSpotNameElement = document.getElementById('surfSpotName');




    console.log('[getData] Function called with spot:', spot, 'date:', date);


    //update label above waveheight graph      
    updateSpotDateLabel(spot, date);

    console.log(`%c[getData] Selected Spot: ${spot}, Date: ${date}`, "color: navy;");


    // Store previous spot
    const previousSpot = surfSpotNameElement.getAttribute('data-previous-spot') || '';

    // Immediately update the surf spot title
    surfSpotNameElement.textContent = spot;

    // Check if the selected spot is different from the previous spot
    if (previousSpot !== spot) {
        console.log(`%c[getData] Spot has changed from ${previousSpot} to ${spot}`, "color: navy;");
        surfSpotNameElement.setAttribute('data-previous-spot', spot);

        Plotly.purge('windPlot');
        Plotly.purge('tidePlot');
        Plotly.purge('bestTimesPlot');
        Plotly.purge('waveHeightPlot');

        // Update the biggest day box while loading
        document.getElementById('biggestDayLeft').textContent = '..loading..';
        document.getElementById('biggestDayCenter').textContent = '..loading..';
        document.getElementById('biggestDayRight').textContent = '..loading..';

        updateUpcomingDays = true;  // Force update of upcoming days
    }



    const spotId = await getSpotId(spot);
    if (!spotId) {
        console.error(`%c[getData Error] Spot ID not found for ${spot}`, "color: red; font-weight: bold;");
        dataFetched = false;
        return;
    }


        // Always fetch new wave data when getData is called
        console.log(`%c[getData] Fetching wave forecast for Spot ID: ${spotId}, Date: ${date}`, "color: navy;");
        await getSpotForecast(spotId);

    // Force clear any existing cached data
    // cachedWaveData[spot] = null;
    const waveDataForDate = cachedWaveData[date];
    


    

    // Fetch sunrise and sunset times for the selected spot and date
    const sunApiUrl = `https://api.sunrise-sunset.org/json?lat=34.0522&lng=-118.2437&date=${date}&formatted=0`;
    let sunriseTime, sunsetTime;


    try {
        const sunResponse = await fetch(sunApiUrl);
        const sunData = await sunResponse.json();

        if (sunData.status === "OK") {
            sunriseTime = new Date(sunData.results.sunrise);
            sunsetTime = new Date(sunData.results.sunset);
            console.log(`%c[getData] Sunrise: ${sunriseTime}, Sunset: ${sunsetTime}`, "color: navy;");
        } else {
            console.error(`%c[getData Error] Failed to fetch sun times for Date: ${date}`, "color: red; font-weight: bold;");
            return;
        }
    } catch (error) {
        console.error(`%c[getData Error] Error fetching sun times: ${error}`, "color: red; font-weight: bold;");
        return;
    }

    const selectedDate = document.getElementById('dateInput').value;

    updateWaveGraph(selectedDate, sunriseTime, sunsetTime);  // Update graph based on selected date, sunrise, and sunset times


    const url = `/get_data?date=${date}&spot=${encodeURIComponent(spot)}`;
    console.log("[getData] API URL:", url);

    const response = await fetch(`/get_data?date=${date}&spot=${spot}`);
    console.log(`[getData] Requesting data from: /get_data?date=${date}&spot=${spot}`);

    if (!response.ok) {
        console.error(`%c[getData Error] Error fetching data from backend: ${response.statusText}`, "color: red; font-weight: bold;");
        dataFetched = false; // Ensure the flag is reset in case of failure
        return;
    }
    const data = await response.json();

    // Use the updated config and clear any cached items
    // cachedWaveData[spot] = data;

    console.log(`%c[getData] Backend data received:`, "color: navy;", data);
    console.log(`%c[getData] backend Spot Config:`, "color: navy;", data.spot_config);
    console.log(`%c[getData] backend Wind Config:`, "color: navy;", data.spot_config?.wind);
    console.log(`%c[getData] backend Tide Config:`, "color: navy;", data.spot_config?.tide);



    // Log the data received from the backend
  //  console.log('Data received from backend:', data);

    //const config = surfSpotsConfig[spot] || surfSpotsConfig['default'];
    const config = data.spot_config;
    console.log(`[getData] Updated config for ${spot}:`, config);

    // Update elements with data
    const waterTemp = data.water_temp !== "Unavailable" ? `${data.water_temp} °F` : "Water temperature unavailable";
    document.getElementById('waterTemp').textContent = waterTemp;
    const wearRecommendation = data.wear || "Recommendation unavailable";
    document.getElementById('wearRecommendation').textContent = wearRecommendation;
    document.getElementById('sunTimes').textContent = `${new Date(data.sun.sunrise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} & ${new Date(data.sun.sunset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    

    // Get the peak wave height from cached data
    let peakWaveHeight = 0;

    if (waveDataForDate && waveDataForDate.length > 0) {
        peakWaveHeight = Math.max(...waveDataForDate.map(item => item.height));
        console.log(`%c[getData] Peak wave height for Date: ${date} is ${peakWaveHeight} ft`, "color: navy;");
    } else {
        console.log(`%c[getData Error] No wave data available for the selected date: ${date}`, "color: red; font-weight: bold;");
    }


    // Determine the board recommendation based on the peak wave height
    let boardRecommendation = "Board recommendation unavailable"; // Default fallback

    if (peakWaveHeight <= 2.2) {
        boardRecommendation = "Longboard";
    } else if (peakWaveHeight <= 3) {
        boardRecommendation = "Fish, Groveler, or Longboard";
    } else if (peakWaveHeight <= 3.6) {
        boardRecommendation = "Fish, Groveler, or Shortboard";
    } else if (peakWaveHeight <= 5.5) {
        boardRecommendation = "Shortboard";
    } else if (peakWaveHeight <= 7) {
        boardRecommendation = "Shortboard or Step-Up";
    } else {
        boardRecommendation = "Guns Out!";
    }

    // Update the board recommendation element
    document.getElementById('boardRecommendation').textContent = boardRecommendation;
    console.log(`%c[getData] Board Recommendation: ${boardRecommendation}`, "color: navy;");


    if (updateUpcomingDays) {
        const spotName = document.getElementById('spotSelect').value;
        console.log(`%c[getData] Updating top upcoming days for Spot: ${spot}`, "color: navy;");
        await updateTopUpcomingDays(spotName);
    }
    dataFetched = false; // Reset flag after fetching data is complete


    

    // Only regenerate date buttons if explicitly requested (i.e., when the surf spot changes)
    if (shouldGenerateButtons) {
        console.log(`%c[getData] Generating date buttons...`, "color: navy;");
        
        await generateDateButtons();
    }



    const minutePoints = data.minute_points.map(t => new Date(t));
    const interpolatedSpeeds = data.interpolated_speeds;
    const interpolatedHeights = data.interpolated_heights;

    const interpolatedDirections = data.interpolated_directions;

    console.log(`%c[getData] Wind Directions:`, "color: navy;", interpolatedDirections);



     // Check if spot exists in the config; if not, fallback to default
    //const config = surfSpotsConfig[spot] || surfSpotsConfig['default'];x

    // Ensure spot configuration exists or default to current data
    //const spotConfig = surfSpotsConfig[spot] || surfSpotsConfig.default;

   // const tideConfig = spotConfig.tide;
   // const windConfig = spotConfig.wind;
   //const windConfig = config.wind;
   //const tideConfig = config.tide;
   const windConfig = data.spot_config.wind;
   const tideConfig = data.spot_config.tide;

    console.log(`%c[getData] Here is the config variable: `, "color: navy;", config);
    console.log(`%c[getData] Wind and Tide Config for ${spot}:`, "color: navy;", windConfig, tideConfig);

   // generateDateButtons(); // Generate the date buttons as before

    // Populate Best and Good times
    document.getElementById('bestTimesList').innerHTML = '';
    document.getElementById('goodTimesList').innerHTML = '';

// Inside getData function where the times are populated
data.best_times.forEach(period => {
    const startTime = new Date(period.start).toLocaleTimeString([], { hour: 'numeric' }); // Remove minutes
    const endTime = new Date(period.end).toLocaleTimeString([], { hour: 'numeric' }); // Remove minutes
    const listItem = document.createElement('li');
    listItem.textContent = `${startTime} - ${endTime}`;
    document.getElementById('bestTimesList').appendChild(listItem);
});

data.good_times.forEach(period => {
    const startTime = new Date(period.start).toLocaleTimeString([], { hour: 'numeric' }); // Remove minutes
    const endTime = new Date(period.end).toLocaleTimeString([], { hour: 'numeric' }); // Remove minutes
    const listItem = document.createElement('li');
    listItem.textContent = `${startTime} - ${endTime}`;
    document.getElementById('goodTimesList').appendChild(listItem);
});

    const minTime = minutePoints[0];
    const maxTime = minutePoints[minutePoints.length - 1];

    console.log(`%c[getData] Wind and Tide Config for ${spot}:`, "color: navy;", windConfig, tideConfig);

    // Wind graph calculations using the config
    
    /*
    const glassySegments = getConditionSegments(interpolatedSpeeds, speed => speed <= config.wind.glassy);
    const mildWindSegments = getConditionSegments(interpolatedSpeeds, speed => speed > config.wind.glassy && speed <= config.wind.mild);
    const badWindSegments = getConditionSegments(interpolatedSpeeds, speed => speed > config.wind.mild);
    */



    // Get segments by wind speed only - make them mutually exclusive
    const glassySegments = getConditionSegments(interpolatedSpeeds, speed => speed <= windConfig.glassy);
    const mildWindSegments = getConditionSegments(interpolatedSpeeds, speed => speed > windConfig.glassy && speed <= windConfig.mild);
    const badWindSegments = getConditionSegments(interpolatedSpeeds, speed => speed > windConfig.mild);

    const windTraces = [];
    let showLegendGlassy = true, showLegendMild = true, showLegendBad = true;

    // Debug
    console.log("Glassy segments:", glassySegments);
    console.log("Mild segments:", mildWindSegments);
    console.log("Bad segments:", badWindSegments);





    
    

// Glassy segments
// Glassy segments
glassySegments.forEach(segment => {
    // Create arrays for offshore and non-offshore points within this segment
    const offshorePoints = { x: [], y: [] };
    const nonOffshorePoints = { x: [], y: [] };
    
    // Sort each point in the segment
    segment.forEach(i => {
        const direction = interpolatedDirections[i] % 360;
        const min = data.spot_config.offshore_wind.min;
        const max = data.spot_config.offshore_wind.max;
        const isOffshore = min < max ? 
            (direction >= min && direction <= max) :
            (direction >= min || direction <= max);
            
        if (isOffshore) {
            offshorePoints.x.push(minutePoints[i]);
            offshorePoints.y.push(interpolatedSpeeds[i]);
        } else {
            nonOffshorePoints.x.push(minutePoints[i]);
            nonOffshorePoints.y.push(interpolatedSpeeds[i]);
        }
    });

    // Create offshore trace if we have offshore points
    if (offshorePoints.x.length > 0) {
        const offshoreTrace = {
            x: offshorePoints.x,
            y: offshorePoints.y,
            mode: 'lines',
            name: '',
            line: { 
                color: 'darkgreen',
                width: 3,
                simplify: false
            },
            fill: 'tozeroy',
            fillcolor: 'rgba(0, 100, 0, 0.3)',
            showlegend: showLegendGlassy,
            text: offshorePoints.x.map((_, idx) => [
                degreesToArrow(interpolatedDirections[segment[idx]] % 360),
                degreesToCardinal(interpolatedDirections[segment[idx]] % 360),
                Math.round(interpolatedDirections[segment[idx]] % 360)
            ]),
            hovertemplate: 
                'Offshore<br>' +
                '💨 %{y:.1f} km/h<br>' + 
                '🕒 %{x|%I:%M %p}<br>' + 
                '🧭 %{text[0]} %{text[1]} (%{text[2]}°)<extra></extra>',
            hoverlabel: { 
                bgcolor: 'white', 
                namelength: 0,
                font: { size: 14, family: 'Arial, sans-serif' }
            }
        };
        windTraces.push(offshoreTrace);
    }

    // Create non-offshore trace if we have non-offshore points
    if (nonOffshorePoints.x.length > 0) {
        const nonOffshoreTrace = {
            x: nonOffshorePoints.x,
            y: nonOffshorePoints.y,
            mode: 'lines',
            name: '',
            line: { 
                color: 'limegreen',
                width: 3,
                simplify: false
            },
            fill: 'tozeroy',
            fillcolor: 'rgba(0, 255, 0, 0.2)',
            showlegend: showLegendGlassy,
            text: nonOffshorePoints.x.map((_, idx) => [
                degreesToArrow(interpolatedDirections[segment[idx]] % 360),
                degreesToCardinal(interpolatedDirections[segment[idx]] % 360),
                Math.round(interpolatedDirections[segment[idx]] % 360)
            ]),
            hovertemplate: 
                'Glassy<br>' +
                '💨 %{y:.1f} km/h<br>' + 
                '🕒 %{x|%I:%M %p}<br>' + 
                '🧭 %{text[0]} %{text[1]} (%{text[2]}°)<extra></extra>',
            hoverlabel: { 
                bgcolor: 'white', 
                namelength: 0,
                font: { size: 14, family: 'Arial, sans-serif' }
            }
        };
        windTraces.push(nonOffshoreTrace);
    }
    
    showLegendGlassy = false;
});



// Mild segments
mildWindSegments.forEach(segment => {
    const offshorePoints = { x: [], y: [] };
    const nonOffshorePoints = { x: [], y: [] };
    
    segment.forEach(i => {
        const direction = interpolatedDirections[i] % 360;
        const min = data.spot_config.offshore_wind.min;
        const max = data.spot_config.offshore_wind.max;
        const isOffshore = min < max ? 
            (direction >= min && direction <= max) :
            (direction >= min || direction <= max);
            
        if (isOffshore) {
            offshorePoints.x.push(minutePoints[i]);
            offshorePoints.y.push(interpolatedSpeeds[i]);
        } else {
            nonOffshorePoints.x.push(minutePoints[i]);
            nonOffshorePoints.y.push(interpolatedSpeeds[i]);
        }
    });

    // Create offshore trace if we have offshore points
    if (offshorePoints.x.length > 0) {
        const offshoreTrace = {
            x: offshorePoints.x,
            y: offshorePoints.y,
            mode: 'lines',
            name: '',
            line: { 
                color: 'darkgreen',
                width: 3,
                simplify: false
            },
            fill: 'tozeroy',
            fillcolor: 'rgba(0, 100, 0, 0.3)',
            showlegend: showLegendMild,
            text: offshorePoints.x.map((_, idx) => [
                degreesToArrow(interpolatedDirections[segment[idx]] % 360),
                degreesToCardinal(interpolatedDirections[segment[idx]] % 360),
                Math.round(interpolatedDirections[segment[idx]] % 360)
            ]),
            hovertemplate: 
                'Offshore<br>' +
                '💨 %{y:.1f} km/h<br>' + 
                '🕒 %{x|%I:%M %p}<br>' + 
                '🧭 %{text[0]} %{text[1]} (%{text[2]}°)<extra></extra>',
            hoverlabel: { 
                bgcolor: 'white', 
                namelength: 0,
                font: { size: 14, family: 'Arial, sans-serif' }
            }
        };
        windTraces.push(offshoreTrace);
    }

    // Create non-offshore trace if we have non-offshore points
    if (nonOffshorePoints.x.length > 0) {
        const nonOffshoreTrace = {
            x: nonOffshorePoints.x,
            y: nonOffshorePoints.y,
            mode: 'lines',
            name: '',
            line: { 
                color: 'yellow',
                width: 3,
                simplify: false
            },
            fill: 'tozeroy',
            fillcolor: 'rgba(255, 255, 0, 0.2)',
            showlegend: showLegendMild,
            text: nonOffshorePoints.x.map((_, idx) => [
                degreesToArrow(interpolatedDirections[segment[idx]] % 360),
                degreesToCardinal(interpolatedDirections[segment[idx]] % 360),
                Math.round(interpolatedDirections[segment[idx]] % 360)
            ]),
            hovertemplate: 
                'Mild<br>' +
                '💨 %{y:.1f} km/h<br>' + 
                '🕒 %{x|%I:%M %p}<br>' + 
                '🧭 %{text[0]} %{text[1]} (%{text[2]}°)<extra></extra>',
            hoverlabel: { 
                bgcolor: 'white', 
                namelength: 0,
                font: { size: 14, family: 'Arial, sans-serif' }
            }
        };
        windTraces.push(nonOffshoreTrace);
    }
    
    showLegendMild = false;
});

// Bad segments
badWindSegments.forEach(segment => {
    const offshorePoints = { x: [], y: [] };
    const nonOffshorePoints = { x: [], y: [] };
    
    segment.forEach(i => {
        const direction = interpolatedDirections[i] % 360;
        const min = data.spot_config.offshore_wind.min;
        const max = data.spot_config.offshore_wind.max;
        const isOffshore = min < max ? 
            (direction >= min && direction <= max) :
            (direction >= min || direction <= max);
            
        if (isOffshore) {
            offshorePoints.x.push(minutePoints[i]);
            offshorePoints.y.push(interpolatedSpeeds[i]);
        } else {
            nonOffshorePoints.x.push(minutePoints[i]);
            nonOffshorePoints.y.push(interpolatedSpeeds[i]);
        }
    });

    // Create offshore trace if we have offshore points
    if (offshorePoints.x.length > 0) {
        const offshoreTrace = {
            x: offshorePoints.x,
            y: offshorePoints.y,
            mode: 'lines',
            name: '',
            line: { 
                color: 'darkgreen',
                width: 3,
                simplify: false
            },
            fill: 'tozeroy',
            fillcolor: 'rgba(0, 100, 0, 0.3)',
            showlegend: showLegendBad,
            text: offshorePoints.x.map((_, idx) => [
                degreesToArrow(interpolatedDirections[segment[idx]] % 360),
                degreesToCardinal(interpolatedDirections[segment[idx]] % 360),
                Math.round(interpolatedDirections[segment[idx]] % 360)
            ]),
            hovertemplate: 
                'Offshore<br>' +
                '💨 %{y:.1f} km/h<br>' + 
                '🕒 %{x|%I:%M %p}<br>' + 
                '🧭 %{text[0]} %{text[1]} (%{text[2]}°)<extra></extra>',
            hoverlabel: { 
                bgcolor: 'white', 
                namelength: 0,
                font: { size: 14, family: 'Arial, sans-serif' }
            }
        };
        windTraces.push(offshoreTrace);
    }

    // Create non-offshore trace if we have non-offshore points
    if (nonOffshorePoints.x.length > 0) {
        const nonOffshoreTrace = {
            x: nonOffshorePoints.x,
            y: nonOffshorePoints.y,
            mode: 'lines',
            name: '',
            line: { 
                color: 'red',
                width: 3,
                simplify: false
            },
            fill: 'tozeroy',
            fillcolor: 'rgba(255, 0, 0, 0.2)',
            showlegend: showLegendBad,
            text: nonOffshorePoints.x.map((_, idx) => [
                degreesToArrow(interpolatedDirections[segment[idx]] % 360),
                degreesToCardinal(interpolatedDirections[segment[idx]] % 360),
                Math.round(interpolatedDirections[segment[idx]] % 360)
            ]),
            hovertemplate: 
                'Bad<br>' +
                '💨 %{y:.1f} km/h<br>' + 
                '🕒 %{x|%I:%M %p}<br>' + 
                '🧭 %{text[0]} %{text[1]} (%{text[2]}°)<extra></extra>',
            hoverlabel: { 
                bgcolor: 'white', 
                namelength: 0,
                font: { size: 14, family: 'Arial, sans-serif' }
            }
        };
        windTraces.push(nonOffshoreTrace);
    }
    
    showLegendBad = false;
});






    const lowTideSegments = getConditionSegments(interpolatedHeights, height => height < data.spot_config.tide.low);
    const moderateTideSegments = getConditionSegments(interpolatedHeights, height => 
        height >= data.spot_config.tide.low && height <= data.spot_config.tide.moderate
    );
    const highTideSegments = getConditionSegments(interpolatedHeights, height => 
        height > data.spot_config.tide.moderate && height <= data.spot_config.tide.high
    );
    const veryHighTideSegments = getConditionSegments(interpolatedHeights, height => height > data.spot_config.tide.high);




    // Clear Best and Good times list
    const bestTimesList = document.getElementById('bestTimesList');
    const goodTimesList = document.getElementById('goodTimesList');
    bestTimesList.innerHTML = '';
    goodTimesList.innerHTML = '';

    // Populate Best Times list
    if (data.best_times.length > 0) {
        data.best_times.forEach(period => {
            const startTime = new Date(period.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const endTime = new Date(period.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const listItem = document.createElement('li');
            listItem.textContent = `${startTime} - ${endTime}`;
            bestTimesList.appendChild(listItem);
        });
    } else {
        // If Best Times is empty, show a reason
        let reason = '';
        if (badWindSegments.length > 0) {
            reason = 'It’s pretty windy!';
        } else if (veryHighTideSegments.length > 0 || lowTideSegments.length > 0) {
            reason = 'The tide is too high or too low.';
        } else {
            reason = 'Conditions are not optimal.';
        }
        const noBestTimeMessage = document.createElement('p');
        noBestTimeMessage.style.fontStyle = 'italic';
        noBestTimeMessage.textContent = reason;
        bestTimesList.appendChild(noBestTimeMessage);
    }

    // Populate Good Times list
    if (data.good_times.length > 0) {
        data.good_times.forEach(period => {
            const startTime = new Date(period.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const endTime = new Date(period.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const listItem = document.createElement('li');
            listItem.textContent = `${startTime} - ${endTime}`;
            goodTimesList.appendChild(listItem);
        });
    } else {
        // If Good Times is empty, show a reason
        let reason = '';
        if (badWindSegments.length > 0) {
            reason = 'It’s pretty windy!';
        } else if (veryHighTideSegments.length > 0 || lowTideSegments.length > 0) {
            reason = 'The tides are too high or too low.';
        } else {
            reason = 'Conditions are not ideal.';
        }
        const noGoodTimeMessage = document.createElement('p');
        noGoodTimeMessage.style.fontStyle = 'italic';
        noGoodTimeMessage.textContent = reason;
        goodTimesList.appendChild(noGoodTimeMessage);
    }



    const tideTraces = [];
    let showLegendLow = true, showLegendModerate = true, showLegendHigh = true, showLegendVeryHigh = true;


// Update the trace colors and names
veryHighTideSegments.forEach(segment => {
    tideTraces.push({
        x: segment.map(i => minutePoints[i]),
        y: segment.map(i => interpolatedHeights[i]),
        mode: 'lines',
        //name: `Very High Tide (> ${data.spot_config.tide.veryHigh} ft)`,
        line: { color: 'red', width: 3 },
        fill: 'tozeroy',
        fillcolor: 'rgba(255, 0, 0, 0.2)',
        showlegend: showLegendVeryHigh,
        hovertemplate: 
        'Very High<br>' +
        '📏 %{y:.1f} ft<br>' +
        '🕒 %{x|%I:%M %p}<extra></extra>',
        hoverlabel: { 
            bgcolor: 'white', 
            namelength: 0,
            font: { size: 14, family: 'Arial, sans-serif' }
        }
    });
    showLegendVeryHigh = false;
});

highTideSegments.forEach(segment => {
    tideTraces.push({
        x: segment.map(i => minutePoints[i]),
        y: segment.map(i => interpolatedHeights[i]),
        mode: 'lines',
       // name: `High Tide (${data.spot_config.tide.high}-${data.spot_config.tide.veryHigh} ft)`,
        line: { color: 'yellow', width: 3 },
        fill: 'tozeroy',
        fillcolor: 'rgba(255, 255, 0, 0.2)',
        showlegend: showLegendHigh,
        hovertemplate: 
        'High<br>' +
        '📏 %{y:.1f} ft<br>' +
        '🕒 %{x|%I:%M %p}<extra></extra>',
        hoverlabel: { 
            bgcolor: 'white', 
            namelength: 0,
            font: { size: 14, family: 'Arial, sans-serif' }
        }
    });
    showLegendHigh = false;
});

moderateTideSegments.forEach(segment => {
    tideTraces.push({
        x: segment.map(i => minutePoints[i]),
        y: segment.map(i => interpolatedHeights[i]),
        mode: 'lines',
       // name: `Good Tide (${data.spot_config.tide.low}-${data.spot_config.tide.high} ft)`,
        line: { color: 'limegreen', width: 6 },
        fill: 'tozeroy',
        fillcolor: 'rgba(0, 255, 0, 0.2)',
        showlegend: showLegendModerate,
        hovertemplate: 
        'Good<br>' +
        '📏 %{y:.1f} ft<br>' +
        '🕒 %{x|%I:%M %p}<extra></extra>',
        hoverlabel: { 
            bgcolor: 'white', 
            namelength: 0,
            font: { size: 14, family: 'Arial, sans-serif' }
        }
    });
    showLegendModerate = false;
});

lowTideSegments.forEach(segment => {
    tideTraces.push({
        x: segment.map(i => minutePoints[i]),
        y: segment.map(i => interpolatedHeights[i]),
        mode: 'lines',
        //name: `Low Tide (< ${data.spot_config.tide.low} ft)`,
       // name: `Low Tide)`,
        line: { color: 'red', width: 3 },
        fill: 'tozeroy',
        fillcolor: 'rgba(255, 0, 0, 0.2)',
        showlegend: showLegendLow,
        hovertemplate: 
        'Low<br>' +
        '📏 %{y:.1f} ft<br>' +
        '🕒 %{x|%I:%M %p}<extra></extra>',
        hoverlabel: { 
            bgcolor: 'white', 
            namelength: 0,
            font: { size: 14, family: 'Arial, sans-serif' }
        }
    });
    showLegendLow = false;
});




    // Adjust for mobile screen responsiveness
    const isMobile = window.innerWidth < 768;

// First layout definition (around line 1000)
const layout = {
    xaxis: {
        range: [minTime, maxTime],
        tickformat: '%-I %p',
        dtick: isMobile ? 7200000 : 3600000,
        title: '',
        tickfont: {
            size: isMobile ? 10 : 12,
        },
        fixedrange: true,
        showgrid: false,   // Remove vertical grid lines
        zeroline: false    // Remove x-axis zero line
    },
    yaxis: { 
        title: '', 
        tickfont: {
            size: isMobile ? 10 : 12,
        },
        fixedrange: true,
        showgrid: false,   // Remove vertical grid lines
        zeroline: false    // Remove x-axis zero line
    },
    height: isMobile ? 200 : 240,
    margin: { l: isMobile ? 40 : 50, r: 40, t: 30, b: isMobile ? 30 : 40 },
    hovermode: 'closest',
    showlegend: false,
    shapes: [
        // Before sunrise
        {
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: minTime,
            x1: sunriseTime,
            y0: 0,
            y1: 1,
            fillcolor: '#E5E5E5',
            opacity: 0.3,
            line: { width: 0 }
        },
        // After sunset
        {
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: sunsetTime,
            x1: maxTime,
            y0: 0,
            y1: 1,
            fillcolor: '#E5E5E5',
            opacity: 0.3,
            line: { width: 0 }
        }
    ]
};

const windLayout = {
    xaxis: {
        tickformat: '%I %p',  // 12-hour format
        dtick: isMobile ? 3 * 3600 * 1000 : 3600 * 1000,  // Every 3 hours on mobile
        tickfont: { size: isMobile ? 8 : 12 },
        fixedrange: true,  // Disable zoom for all devices
        showgrid: false,   // Remove vertical grid lines
        zeroline: false    // Remove x-axis zero line
    },
    yaxis: {
     //   title: isMobile ? null : 'Wind Speed (km/h)',  // Remove title on mobile
        tickfont: { size: isMobile ? 8 : 12 },
        titlefont: { size: isMobile ? 10 : 14 },
        fixedrange: isMobile,  // Disable zoom on mobile
        showgrid: false,   // Remove horizontal grid lines
        zeroline: false    // Remove y-axis zero line
    },
    height: isMobile ? 150 : 200,
    margin: {
        l: isMobile ? 25 : 50,
        r: isMobile ? 15 : 40,
        t: isMobile ? 20 : 30,   // Slightly more top margin for title
        b: isMobile ? 20 : 40
    },
    title: {
        text: `Wind speed for ${spot} on ${date}`,
        font: { size: isMobile ? 10 : 14 }  // Smaller title on mobile
    },
    showlegend: false,
    dragmode: false,
    hovermode: 'closest',  // Better touch response
    hoverdistance: -1       // Show hover for entire width
};

// Create background traces for day/night
const maxWindSpeed = Math.max(...interpolatedSpeeds) * 1.1; // Get max wind speed and add 10% buffer

const nightTraces = [
    // Before sunrise
    {
        x: [minTime, minTime, sunriseTime, sunriseTime],
        y: [0, maxWindSpeed, maxWindSpeed, 0],  // Create a complete rectangle
        fill: 'toself',
        fillcolor: '#E5E5E5',
        mode: 'none',
        showlegend: false,
        hoverinfo: 'skip',
        opacity: 0.3
    },
    // After sunset
    {
        x: [sunsetTime, sunsetTime, maxTime, maxTime],
        y: [0, maxWindSpeed, maxWindSpeed, 0],  // Create a complete rectangle
        fill: 'toself',
        fillcolor: '#E5E5E5',
        mode: 'none',
        showlegend: false,
        hoverinfo: 'skip',
        opacity: 0.3
    }
];

// Combine night traces with wind traces and plot
Plotly.newPlot('windPlot', [...nightTraces, ...windTraces], windLayout, { 
    responsive: true,
    displayModeBar: false,
    showTips: false,
    scrollZoom: false,  // Disable scroll zoom
    doubleClick: false, // Disable double-click zoom
    modeBarButtonsToRemove: ['zoom2d', 'pan2d', 'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d'],
    staticPlot: false  // Allow hover interactions but disable all other interactions
});



    // Tide graph layout
    console.log(`Updating tide graph for spot: ${spot} with ${tideTraces.length} trace(s) on ${date}.`);


    const tideLayout = {
        xaxis: {
            tickformat: '%I %p',
            dtick: isMobile ? 3 * 3600 * 1000 : 3600 * 1000,  // Every 3 hours on mobile
            tickfont: { size: isMobile ? 8 : 12 },
            fixedrange: true,  // Disable zoom for all devices
            showgrid: false,   // Remove vertical grid lines
            zeroline: false    // Remove x-axis zero line
        },
        yaxis: {
        //    title: isMobile ? null : 'Tide Height (ft)',  // Remove title on mobile
            tickfont: { size: isMobile ? 8 : 12 },
            titlefont: { size: isMobile ? 10 : 14 },
            fixedrange: isMobile,  // Disable zoom on mobile
            showgrid: false,   // Remove vertical grid lines
            zeroline: false    // Remove x-axis zero line
        },
        height: isMobile ? 150 : 200,
        margin: {
            l: isMobile ? 25 : 50,
            r: isMobile ? 15 : 40,
            t: isMobile ? 20 : 30,   // Slightly more top margin for title
            b: isMobile ? 20 : 40
        },
        title: {
            text: `Tide for ${spot} on ${date}`,
            font: { size: isMobile ? 10 : 14 }  // Smaller title on mobile
        },
        showlegend: false,
        dragmode: false,  // Disable drag mode
        hovermode: 'closest',  // Changed from 'x unified' to 'closest'
        hoverdistance: -1,      // Adjusted for better touch response
    };



// Get the max tide height for the background
const maxTideHeight = Math.max(...interpolatedHeights) * 1.1; // Add 10% buffer

// Create background traces for day/night in tide graph
const tideNightTraces = [
    // Before sunrise
    {
        x: [minTime, minTime, sunriseTime, sunriseTime],
        y: [0, maxTideHeight, maxTideHeight, 0],  // Create a complete rectangle
        fill: 'toself',
        fillcolor: '#E5E5E5',
        mode: 'none',
        showlegend: false,
        hoverinfo: 'skip',
        opacity: 0.3
    },
    // After sunset
    {
        x: [sunsetTime, sunsetTime, maxTime, maxTime],
        y: [0, maxTideHeight, maxTideHeight, 0],  // Create a complete rectangle
        fill: 'toself',
        fillcolor: '#E5E5E5',
        mode: 'none',
        showlegend: false,
        hoverinfo: 'skip',
        opacity: 0.3
    }
];

// Render tide graph with night traces
Plotly.newPlot('tidePlot', [...tideNightTraces, ...tideTraces], tideLayout, { 
    responsive: true,
    displayModeBar: false,
    showTips: false,
    scrollZoom: false,
    doubleClick: false,
    modeBarButtonsToRemove: ['zoom2d', 'pan2d', 'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d'],
    staticPlot: false
});


    /*
                    BEST TIMES GRAPH    
    */

    // Best Times Graph
// Best Times Graph
let bestTimesTraces = [];

// Add unfavorable times FIRST (base layer)
const unfavorablePoints = [];
let currentTime = new Date(minTime);
while (currentTime <= maxTime) {
    // Check if this time falls within any best or good time period
    const isInBestTime = data.best_times.some(period => 
        currentTime >= new Date(period.start) && currentTime <= new Date(period.end)
    );
    const isInGoodTime = data.good_times.some(period => 
        currentTime >= new Date(period.start) && currentTime <= new Date(period.end)
    );

    // Only add point if it's not in a best or good time period
    if (!isInBestTime && !isInGoodTime) {
        unfavorablePoints.push(new Date(currentTime));
    }
    currentTime.setMinutes(currentTime.getMinutes() + 5);
}





if (unfavorablePoints.length > 0) {
    bestTimesTraces.push({
        x: unfavorablePoints,
        y: Array(unfavorablePoints.length).fill(0.5),
        mode: 'lines',
        line: { color: 'red', width: 3 },
        hoverinfo: 'all',
        hovertemplate: 
            '🚫 Unfavorable Time<br>' +
            '%{x|%I:%M %p}<br>' +
            'Wind Speed: %{text[0]:.2f} km/h<br>' +
            'Wind Direction: %{text[1]} %{text[2]} (%{text[3]}°)<br>' +
            'Tide Height: %{text[4]:.2f} ft<extra></extra>',
        text: unfavorablePoints.map(point => {
            const index = minutePoints.findIndex(t => t.getTime() === point.getTime());
            return [
                interpolatedSpeeds[index],
                degreesToArrow(interpolatedDirections[index]),
                degreesToCardinal(interpolatedDirections[index]),
                Math.round(interpolatedDirections[index]),
                interpolatedHeights[index]
            ];
        }),
        hoverlabel: { 
            bgcolor: 'white', 
            namelength: 0,
            font: { size: 14, family: 'Arial, sans-serif' }
        }
    });
}

// Then add good times
data.good_times.forEach(period => {
    const startTime = new Date(period.start);
    const endTime = new Date(period.end);
    
    // Create array of points every 5 minutes between start and end
    const points = [];
    let currentTime = new Date(startTime);
    while (currentTime <= endTime) {
        points.push(new Date(currentTime));
        currentTime.setMinutes(currentTime.getMinutes() + 5);
    }
    
    bestTimesTraces.push({
        x: points,
        y: Array(points.length).fill(0.5),
        mode: 'lines',
     //   fill: 'tozeroy',  // Add fill to make hover area larger
        line: { color: 'yellow', width: period.thickness },
        hoverinfo: 'all',
        hovertemplate: 
            '✨ Good Time<br>' +
            '%{x|%I:%M %p}<br>' +
            'Wind Speed: %{text[0]:.2f} km/h<br>' +
            'Wind Direction: %{text[1]} %{text[2]} (%{text[3]}°)<br>' +
            'Tide Height: %{text[4]:.2f} ft<extra></extra>',
        text: points.map(point => {
            const index = minutePoints.findIndex(t => t.getTime() === point.getTime());
            return [
                interpolatedSpeeds[index],
                degreesToArrow(interpolatedDirections[index]),
                degreesToCardinal(interpolatedDirections[index]),
                Math.round(interpolatedDirections[index]),
                interpolatedHeights[index]
            ];
        }),
        hoverlabel: { 
            bgcolor: 'white', 
            namelength: 0,
            font: { size: 14, family: 'Arial, sans-serif' }
        }
    });
});


// Finally add best times on top
data.best_times.forEach(period => {
    const startTime = new Date(period.start);
    const endTime = new Date(period.end);
    
    // Create array of points every 5 minutes between start and end
    const points = [];
    let currentTime = new Date(startTime);
    while (currentTime <= endTime) {
        points.push(new Date(currentTime));
        currentTime.setMinutes(currentTime.getMinutes() + 5);
    }
    
    bestTimesTraces.push({
        x: points,
        y: Array(points.length).fill(0.5),
        mode: 'lines',
     //   fill: 'tozeroy',  // Add fill to make hover area larger
        line: { color: 'limegreen', width: period.thickness },
        hoverinfo: 'all',
        hovertemplate: 
            '✨ Best Time<br>' +
            '%{x|%I:%M %p}<br>' +
            'Wind Speed: %{text[0]:.2f} km/h<br>' +
            'Wind Direction: %{text[1]} %{text[2]} (%{text[3]}°)<br>' +
            'Tide Height: %{text[4]:.2f} ft<extra></extra>',
        text: points.map(point => {
            const index = minutePoints.findIndex(t => t.getTime() === point.getTime());
            return [
                interpolatedSpeeds[index],
                degreesToArrow(interpolatedDirections[index]),
                degreesToCardinal(interpolatedDirections[index]),
                Math.round(interpolatedDirections[index]),
                interpolatedHeights[index]
            ];
        }),
        hoverlabel: { 
            bgcolor: 'white', 
            namelength: 0,
            font: { size: 14, family: 'Arial, sans-serif' }
        }
    });
});




const bestTimesNightTraces = [
    // Before sunrise
    {
        x: [minTime, minTime, sunriseTime, sunriseTime],
        y: [0, 1, 1, 0],  // Best times graph uses 0-1 range
        fill: 'toself',
        fillcolor: '#E5E5E5',
        mode: 'none',
        showlegend: false,
        hoverinfo: 'skip',
        opacity: 0.3
    },
    // After sunset
    {
        x: [sunsetTime, sunsetTime, maxTime, maxTime],
        y: [0, 1, 1, 0],  // Best times graph uses 0-1 range
        fill: 'toself',
        fillcolor: '#E5E5E5',
        mode: 'none',
        showlegend: false,
        hoverinfo: 'skip',
        opacity: 0.3
    }
];

// Render best times graph with night traces
Plotly.newPlot('bestTimesPlot', [...bestTimesNightTraces, ...bestTimesTraces], {
    ...layout,
    height: isMobile ? 100 : 120,
    yaxis: { 
        visible: false,
        showgrid: false,   // Remove vertical grid lines
        zeroline: false    // Remove x-axis zero line
    },
    xaxis: { 
        ...layout.xaxis,
        fixedrange: true,
        showgrid: false,   // Remove vertical grid lines
        zeroline: false    // Remove x-axis zero line
    },
    responsive: true,
    hovermode: 'closest',
    showlegend: false,
    hoverdistance: 50,
    hoverlabel: {
        namelength: -1
    },
    dragmode: false  // Add drag prevention
},
{
    displayModeBar: false,
    responsive: true,
    showTips: false,
    scrollZoom: false,  // Add scroll zoom prevention
    doubleClick: false  // Add double-click zoom prevention
});




    // Sync Hover for vertical lines
    const drawVerticalLine = (xValue) => {
        const update = {
            shapes: [{
                type: 'line',
                x0: xValue,
                x1: xValue,
                y0: 0,
                y1: 1,
                xref: 'x',
                yref: 'paper',
                line: {
                    color: 'grey',
                    width: 1,
                    dash: 'dot'
                }
            }]
        };
        Plotly.relayout('windPlot', update);
        Plotly.relayout('tidePlot', update);
        Plotly.relayout('bestTimesPlot', update);
    };

    const clearVerticalLine = () => {
        const clearUpdate = { shapes: [] };
        Plotly.relayout('windPlot', clearUpdate);
        Plotly.relayout('tidePlot', clearUpdate);
        Plotly.relayout('bestTimesPlot', clearUpdate);
    };

    document.getElementById('windPlot').on('plotly_hover', event => drawVerticalLine(event.points[0].x));
    document.getElementById('tidePlot').on('plotly_hover', event => drawVerticalLine(event.points[0].x));
    document.getElementById('bestTimesPlot').on('plotly_hover', event => drawVerticalLine(event.points[0].x));

    document.getElementById('windPlot').on('plotly_unhover', clearVerticalLine);
    document.getElementById('tidePlot').on('plotly_unhover', clearVerticalLine);
    document.getElementById('bestTimesPlot').on('plotly_unhover', clearVerticalLine);

    // Populate Legends
    /*
    document.getElementById('windLegend').innerHTML = `
        <div class="legend-item green"><span></span> Glassy (<= ${windConfig.glassy} km/h)</div>
        <div class="legend-item yellow"><span></span> Mild Wind (${windConfig.glassy}-${windConfig.mild} km/h)</div>
        <div class="legend-item red"><span></span> Bad Wind (> ${windConfig.mild} km/h)</div>
    `;
    */
    document.getElementById('windLegend').innerHTML = `
    <div class="legend-item darkgreen"><span></span> Offshore</div>
    <div class="legend-item green"><span></span> Glassy</div>
    <div class="legend-item yellow"><span></span> Mild</div>
    <div class="legend-item red"><span></span> Bad</div>
`;

    document.getElementById('tideLegend').innerHTML = `
        <div class="legend-item lightcoral"><span></span> Low</div>
        <div class="legend-item green"><span></span> Moderate</div>
        <div class="legend-item yellow"><span></span> High</div>
        <div class="legend-item red"><span></span> Very High</div>
    `;
    document.getElementById('bestTimesLegend').innerHTML = `
        <div class="legend-item green"><span></span> Best</div>
        <div class="legend-item yellow"><span></span> Good</div>
        <div class="legend-item red"><span></span> Unfavorable</div>
    `;

    // Simulate the loading process for the graph (or after your data fetch is done)
    setTimeout( async() => {
        // After the data is fetched and the graph is ready, hide the loading GIF and message, show the graph
        waveLoading.style.display = 'none';  // Hide the loading GIF and message
        waveHeightPlot.style.display = 'block';  // Show the wave height plot
     //   updateWaveGraph(date, sunriseTime, sunsetTime);  // Update the graph

        
    //    await updateRegionalOverviews(startDate.toISOString().split('T')[0]);



        // Hide loading for wind graph and show the plot
        document.getElementById('windLoading').style.display = 'none';
        document.getElementById('windPlot').style.display = 'block';
       // Plotly.newPlot('windPlot', windTraces, windLayout, { responsive: true });  // This is the existing wind plot update

        // Hide loading for tide graph and show the plot
        document.getElementById('tideLoading').style.display = 'none';
        document.getElementById('tidePlot').style.display = 'block';
      //  Plotly.newPlot('tidePlot', tideTraces, tideLayout, { responsive: true });  // This is th

    }, 2000);  // Simulate a delay or adjust based on the actual graph load time

}





function checkOffshoreWind(direction, config) {
    if (!config || !config.offshore_wind) return false;
    
    const normalizedDirection = direction % 360;  // First normalize to 0-360
    const min = config.offshore_wind.min;
    const max = config.offshore_wind.max;
    
    // If min is less than max, simple range check
    if (min < max) {
        return normalizedDirection >= min && normalizedDirection <= max;
    }
    
    // If min is greater than max, we need to check if the direction is either:
    // 1. Greater than or equal to min (e.g., >= 350) OR
    // 2. Less than or equal to max (e.g., <= 30)
    return normalizedDirection >= min || normalizedDirection <= max;
}





// Add this helper function to convert degrees to cardinal directions
function degreesToCardinal(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(((degrees % 360) / 22.5)) % 16;
    return directions[index];
}



function degreesToArrow(degrees) {
    // Add 180 degrees to invert the direction (wind is coming FROM this direction)
    degrees = (degrees + 180) % 360;
    
    // Map degrees to arrows (8 directions)
    const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
    const index = Math.round(degrees / 45) % 8;
    return arrows[index];
}




// Can you show me what getConditionSegments looks like? Let's add a debug version:
function getConditionSegments(values, condition) {
    console.log(`%c[getConditionSegments] Starting with ${values.length} values`, "color: orange");
    const segments = [];
    let currentSegment = [];
    
    for (let i = 0; i < values.length; i++) {
        if (condition(values[i], i)) {
            currentSegment.push(i);
        } else if (currentSegment.length > 0) {
            segments.push(currentSegment);
            currentSegment = [];
        }
    }
    
    if (currentSegment.length > 0) {
        segments.push(currentSegment);
    }
    
    console.log(`%c[getConditionSegments] Found ${segments.length} segments`, "color: orange");
    return segments;
}






async function generateDateButtons(spotId) {
    console.log(`%c[Date Buttons] Starting to generate date buttons for Spot ID: ${spotId}`, "color: purple; font-weight: bold;");
    //console.log(`%c[Date Buttons] Current cache state:`, "color: purple;", cachedWaveData);
    console.log(`%c[Date Buttons] Current cache state:`, "color: purple;", cachedWaveData); // Debug cache
    console.log(`%c[Date Buttons] Starting to generate date buttons for Spot ID: ${spotId}`, "color: purple; font-weight: bold;");
    console.log(`%c[Date Buttons] Current spot:`, "color: purple;", document.getElementById('spotSelect').value);
    console.log(`%c[Date Buttons] Current cache state:`, "color: purple;", cachedWaveData);

    
    
    const forecastContainer = document.getElementById('extendedForecast');
    forecastContainer.innerHTML = ''; // Clear any existing buttons
    console.log(`%c[Date Buttons] Cleared existing date buttons in the forecast container`, "color: purple;");

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const buttonsData = [];

    const date = new Date();
    const timezoneOffset = date.getTimezoneOffset() * 60000; // Handle timezone offset

    console.log(`%c[Date Buttons] Preparing buttons for the next 17 days`, "color: purple;");

    // Prepare buttons data for the next 17 days
    for (let i = 0; i < 17; i++) {
        const currentDate = new Date(date.getTime() + i * 86400000 - timezoneOffset);
        const localDate = currentDate.toISOString().split('T')[0];

        const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : daysOfWeek[currentDate.getDay()];
        const dateFormatted = `${currentDate.getMonth() + 1}/${currentDate.getDate()}`;

        buttonsData.push({ dayName, dateFormatted, localDate });
        console.log(`%c[Date Buttons] Prepared data for: ${dayName} (${localDate})`, "color: purple;");
    }

    const fragment = document.createDocumentFragment(); // Batch DOM updates using a fragment

    try {
        // Generate buttons based on wave data
        for (const { dayName, dateFormatted, localDate } of buttonsData) {

            const waveDataForDate = cachedWaveData[localDate];
            
            if (waveDataForDate) {
                    // Log all wave heights for this date
                console.log(`%c[Date Buttons Wave Heights] ${dayName} ${dateFormatted}:`, "color: blue; font-weight: bold;");
                console.log('Date Buttons  Full wave data for this date:', waveDataForDate); // Log the entire wave data object

                
                // Filter wave data for times between 4 AM and 8 PM
                const filteredWaveData = waveDataForDate.filter(item => {
                    const hour = new Date(item.time).getHours();
                    return hour >= 4 && hour <= 20;  // 4 AM to 8 PM
                });

                if (filteredWaveData.length > 0) {
                    const peakWaveHeight = Math.max(...filteredWaveData.map(item => item.height));
                    const lowWaveHeight = Math.min(...filteredWaveData.map(item => item.height));

                    // Create button and add it to the fragment
                    const button = document.createElement('button');
                    button.className = 'date-button';
                    button.innerHTML = `${dayName}<br>${dateFormatted}<br>${peakWaveHeight.toFixed(1)}-${lowWaveHeight.toFixed(1)} ft`;

                    button.onclick = () => {
                        console.log(`%c[Date Buttons] Button clicked for Date: ${localDate}`, "color: purple;");
                        try {
                            document.getElementById('dateInput').value = localDate;
                            getData(false, false);  // Don't regenerate buttons or update upcoming days
                        } catch (error) {
                            console.error(`%c[Date Buttons] Error handling button click:`, "color: red;", error);
                        }
                    };

                    fragment.appendChild(button);
                    console.log(`%c[Date Buttons] Created button for ${localDate} with wave range: ${peakWaveHeight.toFixed(1)}-${lowWaveHeight.toFixed(1)} ft`, "color: purple;");
                } else {
                    console.log(`%c[Date Buttons] No wave data found for ${localDate} between 4 AM and 8 PM`, "color: purple;");
                }
            } else {
                console.log(`%c[Date Buttons] No cached wave data for ${localDate}`, "color: purple;");
            }
        }

        // Append all generated buttons to the forecast container
        forecastContainer.appendChild(fragment);
        console.log(`%c[Date Buttons] All date buttons appended to the forecast container`, "color: purple; font-weight: bold;");
    } catch (error) {
        console.error(`%c[Date Buttons] Error generating date buttons:`, "color: red; font-weight: bold;", error);
        forecastContainer.innerHTML = '<p>Error loading forecast dates. Please try again later.</p>';
    }
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



function filterTimesForDay(waveTimes, startHour = 5, endHour = 21) {
    console.log(`%c[filterTimesForDay] Filtering times between ${startHour}:00 and ${endHour}:00`, "color: purple; font-weight: bold;");
    console.log(`%c[filterTimesForDay] Initial wave times:`, "color: purple;", waveTimes);

    return waveTimes.filter(time => {
        const hours = time.getHours();
        return hours >= startHour && hours <= endHour;
    });
}



function filterTimesAndHeightsForDay(waveTimes, waveHeights, startHour = 5, endHour = 21) {
    console.log(`%c[filterTimesAndHeightsForDay] Filtering wave times and heights between ${startHour}:00 and ${endHour}:00`, "color: purple; font-weight: bold;");
    console.log(`%c[filterTimesAndHeightsForDay] Initial wave times:`, "color: purple;", waveTimes);
    console.log(`%c[filterTimesAndHeightsForDay] Initial wave heights:`, "color: purple;", waveHeights);

    let filteredTimes = [];
    let filteredHeights = [];
    for (let i = 0; i < waveTimes.length; i++) {
        const hours = waveTimes[i].getHours();
        console.log(`%c[filterTimesAndHeightsForDay] Time: ${waveTimes[i].toLocaleTimeString()} (Hours: ${hours})`, "color: purple;");
        if (hours >= startHour && hours <= endHour) {
            console.log(`%c[filterTimesAndHeightsForDay] Time ${waveTimes[i].toLocaleTimeString()} is within the range`, "color: green;");
            filteredTimes.push(waveTimes[i]);
            filteredHeights.push(waveHeights[i]);
        }
    }
    console.log(`%c[filterTimesAndHeightsForDay] Filtered times:`, "color: purple;", filteredTimes);
    console.log(`%c[filterTimesAndHeightsForDay] Filtered heights:`, "color: purple;", filteredHeights);
    return { filteredTimes, filteredHeights };
}


/*
async function updateTopUpcomingDays(spotName) {
    console.log(`%c[updateTopUpcomingDays] Starting... Initial Load: ${isInitialLoad}, Is Updating: ${isUpdatingBiggestDays}`, "color: darkblue; font-weight: bold;");

    if (isUpdatingBiggestDays) {
        console.log(`%c[updateTopUpcomingDays] Update already in progress, skipping...`, "color: darkblue;");
        return;
    }
    
    isUpdatingBiggestDays = true;
    console.log(`%c[updateTopUpcomingDays] Setting loading state. Initial Load: ${isInitialLoad}`, "color: darkblue;");


    try {
        // Immediately update the surf spot name in the title
        document.getElementById('surfSpotName').textContent = spotName;
    
        // Only show loading state if this is the first load
        if (isInitialLoad) {
            document.getElementById('biggestDayLeft').textContent = '..loading..';
            document.getElementById('biggestDayCenter').textContent = '..loading..';
            document.getElementById('biggestDayRight').textContent = '..loading..';
        }
    
        const daysWithWaveData = [];
        console.log(`%c[updateTopUpcomingDays] Fetching cached wave data...`, "color: darkblue;");
    

//            console.log(`%c[updateTopUpcomingDays] Wave data found for ${dateKey}:`, "color: purple;", cachedWaveData[dateKey]);


        // Fetch cached wave data and sunrise/sunset times
        for (const dateKey of Object.keys(cachedWaveData)) {
            console.log(`%c[updateTopUpcomingDays] Wave data found for ${dateKey}:`, "color: purple;", cachedWaveData[dateKey]);

//            console.log(`%c[updateTopUpcomingDays] Processing wave data for date: ${dateKey}`, "color: darkblue;");
            const waveDataForDate = cachedWaveData[dateKey];
    
            // Adjust the date to local time to fix the UTC issue
            const correctDate = new Date(Date.parse(dateKey + 'T00:00:00'));
    
            const sunApiUrl = `https://api.sunrise-sunset.org/json?lat=34.0522&lng=-118.2437&date=${dateKey}&formatted=0`;
            let sunriseTime, sunsetTime;
    
            console.log(`%c[updateTopUpcomingDays] Fetching sunrise/sunset data for ${dateKey}...`, "color: darkblue;");
    
            try {
                const sunResponse = await fetch(sunApiUrl);
                const sunData = await sunResponse.json();
    
                if (sunData.status === "OK") {
                    sunriseTime = new Date(sunData.results.sunrise);
                    sunsetTime = new Date(sunData.results.sunset);
                    console.log(`%c[updateTopUpcomingDays] Sunrise: ${sunriseTime}, Sunset: ${sunsetTime} for ${dateKey}`, "color: darkblue;");
                } else {
                    console.error(`Error fetching sun times for ${dateKey}`);
                    continue;
                }
            } catch (error) {
                console.error("Error fetching sun times:", error);
                continue;
            }

            if (waveDataForDate && waveDataForDate.length > 0) {
                // Filter wave data for times between 4 AM and 8 PM
                const filteredWaveData = waveDataForDate.filter(item => {
                    const hour = item.time.getHours();
                    return hour >= 4 && hour <= 20;
                });
                
                console.log(`%c[updateTopUpcomingDays] Filtered wave data length for ${dateKey}: ${filteredWaveData.length}`, "color: darkblue;");
                if (filteredWaveData.length > 0) {
                    const maxWaveHeight = Math.max(...filteredWaveData.map(item => item.height));
                    const minWaveHeight = Math.min(...filteredWaveData.map(item => item.height));
            
                    daysWithWaveData.push({
                        date: correctDate,
                        waveRange: `${maxWaveHeight.toFixed(1)} - ${minWaveHeight.toFixed(1)} ft`,
                        maxWaveHeight
                    });
                }
            }
        }


        
    
        console.log(`%c[updateTopUpcomingDays] Sorting days by wave height...`, "color: darkblue;");
        // Sort and display the biggest upcoming days
        daysWithWaveData.sort((a, b) => b.maxWaveHeight - a.maxWaveHeight);
    
        if (daysWithWaveData.length > 0) {
            const topDays = daysWithWaveData.slice(0, 3);
            console.log(`%c[updateTopUpcomingDays] Top days:`, "color: darkblue;", topDays);
    
            const updateDateAndGraph = (date) => {
                const localDate = date.toISOString().split('T')[0]; // Correct local date format
                document.getElementById('dateInput').value = localDate;
                console.log(`%c[updateTopUpcomingDays] Updating data and graph for date: ${localDate}`, "color: darkblue;");
                getData(); // Update data and graph based on the new date
            };
    
            // Update the biggest days with the top upcoming days
            document.getElementById('biggestDayLeft').textContent = `${topDays[0].date.toLocaleDateString([], { month: 'short', day: 'numeric' })}: ${topDays[0].waveRange}`;
            document.getElementById('biggestDayLeft').onclick = () => updateDateAndGraph(topDays[0].date);
    
            if (topDays[1]) {
                document.getElementById('biggestDayCenter').textContent = `${topDays[1].date.toLocaleDateString([], { month: 'short', day: 'numeric' })}: ${topDays[1].waveRange}`;
                document.getElementById('biggestDayCenter').onclick = () => updateDateAndGraph(topDays[1].date);
            }
    
            if (topDays[2]) {
                document.getElementById('biggestDayRight').textContent = `${topDays[2].date.toLocaleDateString([], { month: 'short', day: 'numeric' })}: ${topDays[2].waveRange}`;
                document.getElementById('biggestDayRight').onclick = () => updateDateAndGraph(topDays[2].date);
            }
        } else {
            document.getElementById('biggestDayLeft').textContent = 'Loading this. One sec...';
            document.getElementById('biggestDayCenter').textContent = '';
            document.getElementById('biggestDayRight').textContent = '';
        }
    } finally {
        isUpdatingBiggestDays = false;
        isInitialLoad = false;
        console.log(`%c[updateTopUpcomingDays] Finished. Reset flags - Initial Load: ${isInitialLoad}, Is Updating: ${isUpdatingBiggestDays}`, "color: darkblue;");
    }
}
*/

async function updateTopUpcomingDays(spotName) {
    console.log(`%c[updateTopUpcomingDays] Starting... Initial Load: ${isInitialLoad}, Is Updating: ${isUpdatingBiggestDays}`, "color: darkblue; font-weight: bold;");

    if (isUpdatingBiggestDays) {
        console.log(`%c[updateTopUpcomingDays] Update already in progress, skipping...`, "color: darkblue;");
        return;
    }
    
    isUpdatingBiggestDays = true;
    console.log(`%c[updateTopUpcomingDays] Setting loading state. Initial Load: ${isInitialLoad}`, "color: darkblue;");

    try {
        // Immediately update the surf spot name in the title
        document.getElementById('surfSpotName').textContent = spotName;
    
        // Only show loading state if this is the first load
        if (isInitialLoad) {
            document.getElementById('biggestDayLeft').textContent = '..loading..';
            document.getElementById('biggestDayCenter').textContent = '..loading..';
            document.getElementById('biggestDayRight').textContent = '..loading..';
        }
    
        const daysWithWaveData = [];
        console.log(`%c[updateTopUpcomingDays] Processing cached wave data...`, "color: darkblue;");

        // Process cached wave data
        for (const dateKey of Object.keys(cachedWaveData)) {
            const waveDataForDate = cachedWaveData[dateKey];
            
            if (waveDataForDate && waveDataForDate.length > 0) {
                // Filter wave data for times between 4 AM and 8 PM
                const filteredWaveData = waveDataForDate.filter(item => {
                    const hour = item.time.getHours();
                    return hour >= 4 && hour <= 20;
                });
                
                console.log(`%c[updateTopUpcomingDays] Filtered wave data for ${dateKey}: ${filteredWaveData.length} points`, "color: darkblue;");
                
                if (filteredWaveData.length > 0) {
                    const maxWaveHeight = Math.max(...filteredWaveData.map(item => item.height));
                    const minWaveHeight = Math.min(...filteredWaveData.map(item => item.height));
                    const correctDate = new Date(Date.parse(dateKey + 'T00:00:00'));
            
                    daysWithWaveData.push({
                        date: correctDate,
                        waveRange: `${maxWaveHeight.toFixed(1)}-${minWaveHeight.toFixed(1)} ft`,
                        maxWaveHeight
                    });
                }
            }
        }
    
        console.log(`%c[updateTopUpcomingDays] Sorting days by wave height...`, "color: darkblue;");
        daysWithWaveData.sort((a, b) => b.maxWaveHeight - a.maxWaveHeight);
    
        if (daysWithWaveData.length > 0) {
            const topDays = daysWithWaveData.slice(0, 3);
            console.log(`%c[updateTopUpcomingDays] Top days:`, "color: darkblue;", topDays);
    
            const updateDateAndGraph = (date) => {
                const localDate = date.toISOString().split('T')[0];
                document.getElementById('dateInput').value = localDate;
                console.log(`%c[updateTopUpcomingDays] Updating data and graph for date: ${localDate}`, "color: darkblue;");
                getData();
            };
    
            // Update the biggest days with the top upcoming days
            document.getElementById('biggestDayLeft').textContent = `${topDays[0].date.toLocaleDateString([], { month: 'short', day: 'numeric' })}: ${topDays[0].waveRange}`;
            document.getElementById('biggestDayLeft').onclick = () => updateDateAndGraph(topDays[0].date);
    
            if (topDays[1]) {
                document.getElementById('biggestDayCenter').textContent = `${topDays[1].date.toLocaleDateString([], { month: 'short', day: 'numeric' })}: ${topDays[1].waveRange}`;
                document.getElementById('biggestDayCenter').onclick = () => updateDateAndGraph(topDays[1].date);
            }
    
            if (topDays[2]) {
                document.getElementById('biggestDayRight').textContent = `${topDays[2].date.toLocaleDateString([], { month: 'short', day: 'numeric' })}: ${topDays[2].waveRange}`;
                document.getElementById('biggestDayRight').onclick = () => updateDateAndGraph(topDays[2].date);
            }
        } else {
            document.getElementById('biggestDayLeft').textContent = 'No wave data available';
            document.getElementById('biggestDayCenter').textContent = '';
            document.getElementById('biggestDayRight').textContent = '';
        }
    } finally {
        isUpdatingBiggestDays = false;
        isInitialLoad = false;
        console.log(`%c[updateTopUpcomingDays] Finished. Reset flags - Initial Load: ${isInitialLoad}, Is Updating: ${isUpdatingBiggestDays}`, "color: darkblue;");
    }
}



function adjustToLocalDate(utcDateString) {
    const utcDate = new Date(utcDateString);
    const timezoneOffset = utcDate.getTimezoneOffset() * 60000; // Offset in milliseconds
    const localDate = new Date(utcDate.getTime() - timezoneOffset);
    return localDate;
}



//working but slow
/*
async function updateBiggestUpcomingLADays() {
    console.log(`%c[updateBiggestUpcomingLADays] Starting LA-wide update for biggest upcoming days`, "color: darkgreen; font-weight: bold;");

    // Set loading state for LA biggest days
    document.getElementById('laDayLeft').textContent = '..loading..';
    document.getElementById('laDayCenter').textContent = '..loading..';
    document.getElementById('laDayRight').textContent = '..loading..';

    const spots = await fetch('/get_spot_id').then(res => res.json());
    console.log(`%c[updateBiggestUpcomingLADays] Fetched spots:`, "color: darkgreen;", spots);

    // Create today's date in local time
    const today = new Date();
    const todayLocal = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
    let laSpotsWaveData = [];

    for (const spot of spots) {
        const spotId = spot.spot_id;
        console.log(`%c[updateBiggestUpcomingLADays] Processing spot: ${spot.spot_name} (ID: ${spotId})`, "color: darkgreen;");

        for (let i = 0; i < 17; i++) {
            // Calculate the date in local time
            const dateToCheck = new Date(todayLocal.getTime() + i * 86400000);
            const dateToFetch = dateToCheck.toISOString().split('T')[0];
            
            console.log(`%c[updateBiggestUpcomingLADays] Fetching wave data for date: ${dateToFetch}`, "color: darkgreen;");

            if (!cachedWaveData[dateToFetch]) {
                console.log(`%c[updateBiggestUpcomingLADays] No cached data found for ${dateToFetch}. Fetching forecast for Spot ID: ${spotId}`, "color: darkgreen;");
                await getSpotForecast(spotId, dateToFetch);
            }

            const waveDataForDate = cachedWaveData[dateToFetch];
            if (waveDataForDate && waveDataForDate.length > 0) {
                const maxWaveHeight = Math.max(...waveDataForDate.map(item => item.height));
                const minWaveHeight = Math.min(...waveDataForDate.map(item => item.height));

                laSpotsWaveData.push({
                    spotName: spot.spot_name,
                    date: dateToCheck, // Use the local date object
                    waveRange: `${maxWaveHeight.toFixed(1)} - ${minWaveHeight.toFixed(1)} ft`,
                    maxWaveHeight
                });
                console.log(`%c[updateBiggestUpcomingLADays] Added data for ${spot.spot_name} on ${dateToFetch}: ${maxWaveHeight.toFixed(1)} - ${minWaveHeight.toFixed(1)} ft`, "color: darkgreen;");
            }
        }
    }

    console.log(`%c[updateBiggestUpcomingLADays] Sorting spots by wave height...`, "color: darkgreen;");
    // Sort LA spots by wave height, descending
    laSpotsWaveData.sort((a, b) => b.maxWaveHeight - a.maxWaveHeight);

    // Display the top 3 biggest upcoming LA-wide days
    const topUpcomingLADays = laSpotsWaveData.slice(0, 3);
    console.log(`%c[updateBiggestUpcomingLADays] Top 3 upcoming LA-wide days:`, "color: darkgreen;", topUpcomingLADays);

    if (topUpcomingLADays.length > 0) {
        const updateSpotAndData = async (spotName, date) => {
            console.log(`%c[updateBiggestUpcomingLADays] Updating spot: ${spotName} and date: ${date}`, "color: darkgreen;");

            const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            document.getElementById('dateInput').value = localDate;
            document.getElementById('spotSelect').value = spotName; // Update the selected spot

            // Ensure all relevant elements are updated with the new spot
            await updateTopUpcomingDays(spotName); // Update the biggest upcoming days for the new spot
            const spotId = await getSpotId(spotName); // Fetch the correct Spot ID for the selected spot
            await generateDateButtons(spotId); // Update the date buttons based on the selected spot
            await getData(false, true, spotId, localDate); // Update the graphs and other info
        };

        document.getElementById('laDayLeft').textContent = `${topUpcomingLADays[0].spotName}: ${topUpcomingLADays[0].date.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${topUpcomingLADays[0].waveRange}`;
        document.getElementById('laDayLeft').onclick = () => updateSpotAndData(topUpcomingLADays[0].spotName, topUpcomingLADays[0].date);

        if (topUpcomingLADays[1]) {
            document.getElementById('laDayCenter').textContent = `${topUpcomingLADays[1].spotName}: ${topUpcomingLADays[1].date.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${topUpcomingLADays[1].waveRange}`;
            document.getElementById('laDayCenter').onclick = () => updateSpotAndData(topUpcomingLADays[1].spotName, topUpcomingLADays[1].date);
        }

        if (topUpcomingLADays[2]) {
            document.getElementById('laDayRight').textContent = `${topUpcomingLADays[2].spotName}: ${topUpcomingLADays[2].date.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${topUpcomingLADays[2].waveRange}`;
            document.getElementById('laDayRight').onclick = () => updateSpotAndData(topUpcomingLADays[2].spotName, topUpcomingLADays[2].date);
        }
    } else {
        console.log(`%c[updateBiggestUpcomingLADays] No wave data available for upcoming days`, "color: darkgreen;");
        document.getElementById('laDayLeft').textContent = 'No wave data available';
        document.getElementById('laDayCenter').textContent = '';
        document.getElementById('laDayRight').textContent = '';
    }
}
*/


async function updateBiggestUpcomingLADays() {
    console.log(`%c[updateBiggestUpcomingLADays] Starting LA-wide update for biggest upcoming days`, "color: darkgreen; font-weight: bold;");

    // Set loading state for LA biggest days
    document.getElementById('laDayLeft').textContent = '..loading..';
    document.getElementById('laDayCenter').textContent = '..loading..';
    document.getElementById('laDayRight').textContent = '..loading..';

    const spots = await fetch('/get_spot_id').then(res => res.json());
    console.log(`%c[updateBiggestUpcomingLADays] Fetched spots:`, "color: darkgreen;", spots);

    // Create today's date in local time
    const today = new Date();
    const todayLocal = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
    let laSpotsWaveData = [];

    // Clear cached wave data before fetching new data
    cachedWaveData = {};

    for (const spot of spots) {
        const spotId = spot.spot_id;
        console.log(`%c[updateBiggestUpcomingLADays] Processing spot: ${spot.spot_name} (ID: ${spotId})`, "color: darkgreen;");

        // Fetch forecast data for the spot
        await getSpotForecast(spotId);

        // Process each day's data
        for (let i = 0; i < 17; i++) {
            const dateToCheck = new Date(todayLocal.getTime() + i * 86400000);
            const dateString = dateToCheck.toISOString().split('T')[0];
            
            const waveDataForDate = cachedWaveData[dateString];
            if (waveDataForDate && waveDataForDate.length > 0) {
                const dayHeights = waveDataForDate.map(item => item.height);
                const maxWaveHeight = Math.max(...dayHeights);
                const minWaveHeight = Math.min(...dayHeights);

                laSpotsWaveData.push({
                    spotName: spot.spot_name,
                    date: dateToCheck,
                    waveRange: `${maxWaveHeight.toFixed(1)}-${minWaveHeight.toFixed(1)}ft`,
                    maxWaveHeight
                });
            }
        }
    }

    // Sort by max wave height and get top 3
    laSpotsWaveData.sort((a, b) => b.maxWaveHeight - a.maxWaveHeight);
    const topDays = laSpotsWaveData.slice(0, 3);

    // Update the UI with the top days
    if (topDays.length > 0) {
        const updateSpotAndData = async (spotName, date) => {
            const localDate = date.toISOString().split('T')[0];
            document.getElementById('dateInput').value = localDate;
            document.getElementById('spotSelect').value = spotName;
            
            await getData(true, true);  // Regenerate buttons and update upcoming days
        };

        // Update buttons with top days
        document.getElementById('laDayLeft').textContent = 
            `${topDays[0].spotName}: ${topDays[0].date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${topDays[0].waveRange}`;
        document.getElementById('laDayLeft').onclick = () => updateSpotAndData(topDays[0].spotName, topDays[0].date);

        if (topDays[1]) {
            document.getElementById('laDayCenter').textContent = 
                `${topDays[1].spotName}: ${topDays[1].date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${topDays[1].waveRange}`;
            document.getElementById('laDayCenter').onclick = () => updateSpotAndData(topDays[1].spotName, topDays[1].date);
        }

        if (topDays[2]) {
            document.getElementById('laDayRight').textContent = 
                `${topDays[2].spotName}: ${topDays[2].date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${topDays[2].waveRange}`;
            document.getElementById('laDayRight').onclick = () => updateSpotAndData(topDays[2].spotName, topDays[2].date);
        }
    } else {
        document.getElementById('laDayLeft').textContent = 'No wave data available';
        document.getElementById('laDayCenter').textContent = '';
        document.getElementById('laDayRight').textContent = '';
    }
}




function formatDate(selectedDate) {
    // Create date object in PST/PDT
    const date = new Date(`${selectedDate}T00:00:00-08:00`);  // Force PST timezone
    console.log('[formatDate] Input date:', selectedDate);
    console.log('[formatDate] Created date object:', date);
    
    // Format the date with explicit timezone
    const options = { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        timeZone: 'America/Los_Angeles'
    };
    const formattedDate = date.toLocaleDateString('en-US', options);
    console.log('[formatDate] Formatted date:', formattedDate);

    // Add ordinal suffix
    const dayNum = date.getDate();
    let suffix = 'th';
    if (dayNum % 10 === 1 && dayNum !== 11) suffix = 'st';
    else if (dayNum % 10 === 2 && dayNum !== 12) suffix = 'nd';
    else if (dayNum % 10 === 3 && dayNum !== 13) suffix = 'rd';

    const finalDate = formattedDate.replace(dayNum, dayNum + suffix);
    console.log('[formatDate] Final date with suffix:', finalDate);
    
    return finalDate;
}


// Function to update the label above the wave height graph
function updateSpotDateLabel(selectedSpot, selectedDate) {
    console.log("%c[Update Label] Starting to update spot and date label...", "color: blue; font-weight: bold;");
    
    const spotDateElement = document.getElementById('spotDateAboveGraph');
    
    if (!spotDateElement) {
        console.error("%c[Update Label Error] spotDateElement is not defined.", "color: red; font-weight: bold;");
        return;
    }

    console.log(`%c[Update Label] Selected spot: ${selectedSpot}`, "color: green;");
    console.log(`%c[Update Label] Selected date: ${selectedDate}`, "color: green;");
    
    if (!selectedSpot || !selectedDate) {
        console.error("%c[Update Label Error] Spot or date is missing.", "color: red; font-weight: bold;");
        return;
    }

    // Format the selected date before updating the label
    const formattedDate = formatDate(selectedDate);
    spotDateElement.textContent = `${selectedSpot} | ${formattedDate}`;
    console.log("%c[Update Label] Label updated successfully.", "color: blue; font-weight: bold;");
}









/* WEEKLY REPORTS */


/*
async function updateRegionalOverviews(startDate) {
    //console.log(`%c[RegionalOverviews] Starting regional overview updates for 7 days from ${startDate}`, "color: purple; font-weight: bold;");
    console.log('%c[RegionalOverviews] Call stack:', 'color: purple; font-weight: bold;', 
        new Error().stack);
    console.log(`%c[RegionalOverviews] Starting regional overview updates for 7 days from ${startDate}`, 
        "color: purple; font-weight: bold;");




    //get the surf spots that are most different directionally facing, or get the surf spots that are at the ends of the region
    const regions = {
        southBay: {
            id: 'southBayWaveHeightPlot',
            // spots: ['Redondo Breakwater', 'Hermosa Pier', 'Manhattan Beach', 'El Porto', 'Dockweiler']
            spots: ['El Porto', 'Redondo Breakwater']
        },
        laWest: {
            id: 'laWestWaveHeightPlot',
            //spots: ['Venice Breakwater', 'Santa Monica Bay St', 'Will Rogers']
            spots: ['Venice Breakwater', 'Will Rogers']
        },
        southMalibu: {
            id: 'southMalibuWaveHeightPlot',
           // spots: ['Sunset', 'Topanga', 'Malibu First Point']
            spots: ['Sunset', 'Malibu First Point']
        },
        northMalibu: {
            id: 'northMalibuWaveHeightPlot',
            //spots: ['Zuma', 'Leo Carrillo', 'County Line']
            spots: ['Zuma', 'Leo Carrillo']
        }
    };






    const windowWidth = window.innerWidth;
    const isMobile = windowWidth <= 768;

    // Generate array of 7 consecutive dates
    const dates = [];
    //const start = new Date(startDate);
    const start = new Date(`${startDate}T00:00:00-08:00`);  // Force PST timezone




    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + i);
        // Use UTC methods to avoid timezone shifts
        const year = currentDate.getUTCFullYear();
        const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getUTCDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
    }


    console.log(`%c[RegionalOverviews] Processing dates:`, "color: purple;", dates);

    for (const [regionName, region] of Object.entries(regions)) {
        console.log(`%c[RegionalOverviews] Processing ${regionName} with spots:`, "color: blue;", region.spots);

        
        try {

            let regionalData = new Map(); // Reset for each region
            let spotDataLog = {}; // Reset for each region's logging purposes





            // Fetch data for each spot in the region
            for (const spot of region.spots) {
                const spotId = await getSpotId(spot);
                if (!spotId) {
                    console.error(`%c[RegionalOverviews] ❌ Could not get ID for spot: ${spot}`, "color: red;");
                    continue;
                }
                console.log(`%c[RegionalOverviews] ✓ Got spot ID for ${spot}: ${spotId}`, "color: green;");
                
                spotDataLog[spot] = {}; // Initialize logging object for this spot

                // Get forecast data for each date
                for (const currentDate of dates) {
                    console.log(`%c[RegionalOverviews] Fetching data for ${spot} on ${currentDate}`, "color: blue;");
                    await getSpotForecast(spotId, currentDate);


                    console.log(`RegionalOverviews] Wave data for ${currentDate}:`, {
                        dataPoints: cachedWaveData[currentDate]?.length || 0,
                        firstPoint: cachedWaveData[currentDate]?.[0]?.time.toLocaleString(),
                        lastPoint: cachedWaveData[currentDate]?.[cachedWaveData[currentDate]?.length - 1]?.time.toLocaleString()
                    });
                    
                    if (cachedWaveData[currentDate]) {
                        spotDataLog[spot][currentDate] = []; // Initialize array for this date

                        cachedWaveData[currentDate].forEach(dataPoint => {
                            // Adjust the timeKey to PST before storing
                        // Adjust the time to PST before using it as a key
                        const pstTime = new Date(dataPoint.time);
                        const timeKey = pstTime.getTime();
                        
                        if (!regionalData.has(timeKey)) {
                            regionalData.set(timeKey, []);
                        }
                        regionalData.get(timeKey).push(dataPoint.height);
                            // Log the data point
                            spotDataLog[spot][currentDate].push({
                                time: dataPoint.time.toLocaleString(),
                                height: dataPoint.height
                            });
                        });

                        console.log(`%c[RegionalOverviews] ✓ Data points for ${spot} on ${currentDate}:`, "color: green;", 
                            spotDataLog[spot][currentDate]);
                    } else {
                        console.warn(`%c[RegionalOverviews] ⚠ No data found for ${spot} on ${currentDate}`, "color: orange;");
                    }
                }
            }

            if (regionalData.size === 0) {
                console.error(`%c[RegionalOverviews] ❌ No valid data collected for ${regionName}`, "color: red;");
                continue;
            }

            // Log detailed data for each spot
            console.log(`%c[RegionalOverviews] Detailed data for ${regionName}:`, "color: purple;", spotDataLog);

            // Convert Map to arrays for plotting and log averages
            const times = Array.from(regionalData.keys()).sort();
            console.log('Data Range Debug:', {
                firstDataPoint: new Date(times[0]).toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}),
                lastDataPoint: new Date(times[times.length - 1]).toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}),
                totalPoints: times.length
            });


            const heights = times.map(time => {
                const heightsAtTime = regionalData.get(time);
                const avg = heightsAtTime.reduce((sum, height) => sum + height, 0) / heightsAtTime.length;
                
                // Log the averaging calculation
                console.log(`%c[RegionalOverviews] Average calculation for ${new Date(time).toLocaleString()}:`, "color: blue;", {
                    individualHeights: heightsAtTime,
                    averageHeight: avg
                });
                
                return avg;
            });

            console.log(`%c[RegionalOverviews] ${regionName} data summary:`, "color: blue;", {
                totalTimepoints: times.length,
                heightRange: {
                    min: Math.min(...heights),
                    max: Math.max(...heights),
                    avg: heights.reduce((sum, h) => sum + h, 0) / heights.length
                }
            });

            // Inside updateRegionalOverviews function, where we create the trace and layout
            // Inside updateRegionalOverviews function, where we create the trace and layout
            // Create shapes array for night shading and day separators
            const shapes = [];

            // Special case for first day - add shading from start to sunrise
            const firstDayDate = new Date(dates[0]);
            const firstDaySunApiUrl = `https://api.sunrise-sunset.org/json?lat=34.0522&lng=-118.2437&date=${dates[0]}&formatted=0`;
            try {
                const firstDayResponse = await fetch(firstDaySunApiUrl);
                const firstDaySunData = await firstDayResponse.json();
                
                if (firstDaySunData.status === 'OK') {
                    const firstDaySunrise = new Date(firstDaySunData.results.sunrise);
                    
                    // Add shading from start of day to sunrise
                    shapes.push({
                        type: 'rect',
                        xref: 'x',
                        yref: 'paper',
                        x0: new Date(firstDayDate.setHours(0, 0, 0, 0)).getTime(),
                        x1: firstDaySunrise.getTime(),
                        y0: 0,
                        y1: 1,
                        fillcolor: '#E5E5E5',
                        opacity: 0.3,
                        line: { width: 0 }
                    });
                }
            } catch (error) {
                console.error(`Failed to fetch sun times for first day:`, error);
            }


            for (let i = 0; i < 7; i++) {
                const currentDate = new Date(dates[i]);
                
                // Get sunrise/sunset times for each date
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

                        // Add vertical line for start of each day
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

            // Add one final line for the end of the last day
            shapes.push({
                type: 'line',
                xref: 'x',
                yref: 'paper',
                x0: new Date(dates[6] + 'T23:59:59').getTime(),
                x1: new Date(dates[6] + 'T23:59:59').getTime(),
                y0: 0,
                y1: 1,
                line: {
                    color: 'rgba(0, 0, 255, 0.3)',
                    width: 1,
                    dash: 'dot'
                }
            });

            let waveData = [];
            try {
                const response = await fetch('/wave_data');
                if (response.ok) {
                    waveData = await response.json();
                    console.log(`%c[RegionalOverviews] Fetched wave data:`, "color: purple;", waveData);
                } else {
                    console.error(`%c[RegionalOverviews] Failed to fetch wave data`, "color: red;");
                }
            } catch (error) {
                console.error(`%c[RegionalOverviews] Error fetching wave data:`, "color: red;", error);
            }



            // Inside updateRegionalOverviews function, modify the trace creation:

            const trace = {
                x: times.map(t => new Date(t)), // Remove the 8-hour adjustment

                y: heights,
                mode: 'lines',
            // name: 'Average Wave Height',
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
                    // Convert time to Date object if it isn't already
                    const timeDate = time instanceof Date ? time : new Date(time);
                    
                    // Find matching wave data for this timestamp
                    const matchingWaveData = waveData.find(d => {
                        // Convert wave data timestamp to Date object
                        const waveTime = new Date(d.timestamp);
                        // Compare timestamps rounded to minutes for better matching
                        return Math.abs(waveTime.getTime() - timeDate.getTime()) < 300000; // Within 5 minutes
                    });

                    if (matchingWaveData && matchingWaveData.swells) {
                        // Create a string for each swell
                        const swellsText = matchingWaveData.swells.map((swell, index) => 
                            `Swell ${index + 1}: ${swell.direction}° ${degreesToCardinal(swell.direction)} @ ${swell.period}s`
                        ).join('<br>');
                        
                        return swellsText;
                    }
                    return 'No swell data available';
                })
            };



            
            // Create layout with shapes included
            const layout = {
                width: document.getElementById(region.id).offsetWidth, // Set explicit width
                xaxis: {
                    //tickformat: '%a %m/%d',
                    tickformat: '%a<br>%d', // Changed from '%a %m/%d'
                    dtick: 24 * 3600 * 1000,
                    tickmode: 'array',
                    tickvals: dates.map(date => {
                        return new Date(`${date}T12:00:00`).getTime(); // Remove timezone specification
                    }),
                    range: [
                        new Date(`${dates[0]}T00:00:00`).getTime(),
                        new Date(`${dates[6]}T23:59:59`).getTime()
                    ],
                    // Add debug logging
                    rangeDebug: {
                        start: new Date(`${dates[0]}T00:00:00`).toLocaleString(),
                        end: new Date(`${dates[6]}T23:59:59`).toLocaleString()
                    },
                    tickfont: { size: isMobile ? 10 : 12 },
                    fixedrange: true,
                    showgrid: false,   // Remove vertical grid lines
                    zeroline: false    // Remove x-axis zero line
                },
                yaxis: {
                // title: 'Height (ft)',
                    tickfont: { size: isMobile ? 10 : 12 },
                    titlefont: { size: isMobile ? 12 : 14 },
                    fixedrange: true,
                    showgrid: false,   // Remove vertical grid lines
                    zeroline: false    // Remove x-axis zero line
                },
                height: 200,
                margin: {
                    l: isMobile ? 35 : 45,  // Reduced left margin
                    r: isMobile ? 15 : 20,  // Reduced right margin
                    t: 20,                  // Keep top margin small
                    b: isMobile ? 30 : 40,  // Bottom margin for x-axis labels
                    pad: 0                  // Remove internal padding
                },
                shapes: shapes,
                showlegend: false,
                autosize: true,
                hovermode: 'x',           // Changed from 'x unified' to 'x'
                hoverdistance: 50,        // Adjusted for better touch response
                dragmode: false,
                hoverlabel: {
                    bgcolor: 'white',
                    bordercolor: '#c7c7c7',
                    font: { size: 12 }
                }
            };


            // Clear loading animation before plotting
            if (document.getElementById(region.id).loadingInterval) {
                clearInterval(document.getElementById(region.id).loadingInterval);
            }


            // Plot the graph
            Plotly.newPlot(region.id, [trace], layout, {
                responsive: true,
                displayModeBar: false,
                staticPlot: false,
                scrollZoom: false,
                doubleClick: false,      // Disable double-click zoom
                modeBarButtonsToRemove: ['zoom2d', 'pan2d', 'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d']
            });

                    console.log(`%c[RegionalOverviews] ✓ Successfully plotted 7-day forecast for ${regionName}`, "color: green;");
                } catch (error) {

                    console.error(`%c[RegionalOverviews] ❌ Error processing ${regionName}:`, "color: red;", error);
                }
    }
}




// Add a flag at the top of your file
let isInitialized = false;

document.addEventListener('DOMContentLoaded', function() {
    const thisWeekBtn = document.getElementById('thisWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');

    function updateButtonStates(activeBtn) {
        thisWeekBtn.classList.toggle('active', activeBtn === thisWeekBtn);
        nextWeekBtn.classList.toggle('active', activeBtn === nextWeekBtn);
    }

    thisWeekBtn.addEventListener('click', async () => {
        console.log('%c[WeekSelector] Switching to This Week view', 'color: purple;');
        updateButtonStates(thisWeekBtn);
        
        // Clear existing plots and show loading for all regions
        const regions = ['southBayWaveHeightPlot', 'laWestWaveHeightPlot', 'southMalibuWaveHeightPlot', 'northMalibuWaveHeightPlot'];
        regions.forEach(regionId => {
            const plotDiv = document.getElementById(regionId);
            if (plotDiv) {
                Plotly.purge(plotDiv);
            }
        });
        
        const today = new Date();
        await updateRegionalOverviews(today.toISOString().split('T')[0]);
    });

    nextWeekBtn.addEventListener('click', async () => {
        console.log('%c[WeekSelector] Switching to Next Week view', 'color: purple;');
        updateButtonStates(nextWeekBtn);
        
        // Clear existing plots and show loading for all regions
        const regions = ['southBayWaveHeightPlot', 'laWestWaveHeightPlot', 'southMalibuWaveHeightPlot', 'northMalibuWaveHeightPlot'];
        regions.forEach(regionId => {
            const plotDiv = document.getElementById(regionId);
            if (plotDiv) {
                Plotly.purge(plotDiv);
            }
        });
        
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        await updateRegionalOverviews(nextWeek.toISOString().split('T')[0]);
    });

    // Add handler for the best times button
    const getBestTimesBtn = document.getElementById('getBestTimesBtn');
    if (getBestTimesBtn) {
        getBestTimesBtn.addEventListener('click', fetchBestTimes);
    }

    // Initialize only if not already done
    if (!isInitialized) {
        isInitialized = true;
        thisWeekBtn.click();
    }
});

*/








/* WEEKLY REPORTS */










window.addEventListener('resize', function() {
    Plotly.Plots.resize(document.getElementById('waveHeightPlot'));
    Plotly.Plots.resize(document.getElementById('bestTimesPlot'));
    Plotly.Plots.resize(document.getElementById('windPlot'));
    Plotly.Plots.resize(document.getElementById('tidePlot'));
});





// Add this helper function
async function checkServerConnection() {
    try {
        const response = await fetch('/health_check');  // You'll need to add this endpoint to your Flask app
        if (!response.ok) {
            throw new Error('Server not responding');
        }
        return true;
    } catch (error) {
        console.error('%c[Server Check] Backend server is not running!', 'color: red; font-weight: bold;');
        // Maybe show a user-friendly message
        alert('Unable to connect to server. Please ensure the application is running.');
        return false;
    }
}


















/* Best Spots by Time */



// Global variables
let bestSpotsData = null;
let loadingInterval;

// Loading messages array
const loadingMessages = [
    "Checking out the sandbars...",
    "Looking at the wind...",
    "Checking the tide...",
    "Getting a coffee...",
    "Checking buoys...",
    "Drinking more coffee..."
];

// Function to start loading animation
function startLoadingAnimation() {
    const container = document.getElementById('bestSpotsContent');
    let currentMessageIndex = 0;
    
    // Clear any existing intervals
    if (loadingInterval) clearInterval(loadingInterval);
    
    // Show initial message
    container.innerHTML = `<div class="loading">${loadingMessages[0]}</div>`;
    
    // Start rotating messages
    loadingInterval = setInterval(() => {
        currentMessageIndex = (currentMessageIndex + 1) % loadingMessages.length;
        const loadingElement = container.querySelector('.loading');
        if (loadingElement) {
            loadingElement.textContent = loadingMessages[currentMessageIndex];
        } else {
            clearInterval(loadingInterval);
        }
    }, 2000);
}

// Function to stop loading animation
function stopLoadingAnimation() {
    if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
    }
    // Clear loading message if it's still showing
    const loadingElement = document.querySelector('.loading');
    if (loadingElement) {
        loadingElement.remove();
    }
}

// Function to format time to 12-hour format
function formatTime(timeStr) {
    try {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) {
            console.error('Invalid time format:', timeStr);
            return timeStr; // Return original if parsing fails
        }
        const period = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch (error) {
        console.error('Error formatting time:', error);
        return timeStr; // Return original if error occurs
    }
}

function formatInterval(intervalStr) {
    try {
        const [start, end] = intervalStr.split(' - ');
        
        // Get all intervals for the day
        const dayData = bestSpotsData.today || bestSpotsData.tomorrow;
        const isFirstInterval = dayData && dayData[0].interval === intervalStr;
        const isLastInterval = dayData && dayData[dayData.length - 1].interval === intervalStr;
        
        // Format the times, replacing first/last with Sunrise/Sunset
        const startTime = isFirstInterval ? 'Sunrise' : formatTime(start);
        const endTime = isLastInterval ? 'Sunset' : formatTime(end);
        
        return `${startTime} - ${endTime}`;
    } catch (error) {
        console.error('Error formatting interval:', error);
        return intervalStr; // Return original if error occurs
    }
}




// Update the formatBestSpotsInterval function
function formatBestSpotsInterval(interval) {
    if (!interval.spots || interval.spots.length === 0) {
        return '';
    }

    const spots = interval.spots
        .map((spot, index) => {
            const height = typeof spot[1] === 'number' ? spot[1].toFixed(1) : '?';
            return `
                <div class="spot-item ${index < 2 ? 'top-spot' : ''}">
                    <span class="spot-rank">#${index + 1}</span>
                    <span class="spot-name">${spot[0]}</span>
                    <span class="spot-height">${height}ft</span>
                </div>
            `;
        })
        .join('');
    
    return `
        <div class="interval-box">
            <div class="interval-time">${formatInterval(interval.interval)}</div>
            <div class="interval-spots">${spots}</div>
        </div>
    `;
}





// Function to display best spots
// Update the display function with better logging
function displayBestSpots(day) {
    const container = document.getElementById('bestSpotsContent');
    
    // Add detailed logging
    console.log(`[Best Spots Display] Starting display for ${day}`);
    console.log(`[Best Spots Display] Current bestSpotsData:`, bestSpotsData);
    
    if (!bestSpotsData) {
        console.log('[Best Spots Display] No data available, showing loading animation');
        startLoadingAnimation();
        return;
    }

    const dayData = bestSpotsData[day];
    console.log(`[Best Spots Display] Data for ${day}:`, dayData);

    if (!dayData || !Array.isArray(dayData)) {
        console.log(`[Best Spots Display] Invalid or missing data for ${day}`);
        container.innerHTML = `<div class="error">No data available for ${day}</div>`;
        return;
    }

    if (dayData.length === 0) {
        console.log(`[Best Spots Display] Empty data array for ${day}`);
        container.innerHTML = '<div class="no-data">No spots available for this time period</div>';
        return;
    }

    const html = dayData
        .map(interval => formatBestSpotsInterval(interval))
        .filter(html => html !== '')
        .join('');

    if (!html) {
        console.log(`No valid intervals found for ${day}`);
        container.innerHTML = '<div class="no-data">No spots available for this time period</div>';
        return;
    }

    console.log(`Successfully rendered ${day}'s data`);
    container.innerHTML = html;
}


// Function to fetch and initialize best spots data
// Update the initializeBestSpots function with better error logging
// Add this helper function
function debugDateInfo() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log('[Date Debug] Current date/time info:', {
        currentTime: now.toLocaleString(),
        currentTimeISO: now.toISOString(),
        tomorrowDate: tomorrow.toLocaleString(),
        tomorrowISO: tomorrow.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: now.getTimezoneOffset(),
        localTime: now.toLocaleTimeString(),
        utcTime: now.toUTCString()
    });
}

// Update initializeBestSpots
// Function to fetch and initialize best spots data
async function initializeBestSpots(forceRefresh = false) {
    try {
        startLoadingAnimation();
        
        if (!bestSpotsData || forceRefresh) {
            // Get local timezone info
            const localDate = new Date();
            const tzOffset = localDate.getTimezoneOffset();
            const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;

            console.log('[Best Spots Init] Data received:', bestSpotsData);
            console.log('[Best Spots Init] Today data:', bestSpotsData?.today);
            console.log('[Best Spots Init] Tomorrow data:', bestSpotsData?.tomorrow);
            
            console.log('[Best Spots Init] Timezone info:', {
                localTime: localDate.toLocaleString(),
                utcTime: localDate.toUTCString(),
                tzOffset: tzOffset,
                tzName: tzName
            });

            const response = await fetch('/best_surf_spots', {
                headers: {
                    'X-Timezone-Offset': tzOffset,
                    'X-Timezone-Name': tzName,
                    'X-Local-Time': localDate.toISOString()
                }
            });
            
            bestSpotsData = await response.json();
        }
        
        stopLoadingAnimation();
        displayBestSpots('today');
    } catch (error) {
        console.error('[Best Spots Init] Error:', error);
        stopLoadingAnimation();
        document.getElementById('bestSpotsContent').innerHTML = `
            <div class="error">
                Unable to load best spots data. Please try again later.
                <br><small>Error: ${error.message}</small>
                <br><small>Local Time: ${new Date().toLocaleString()}</small>
                <br><small>Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}</small>
            </div>`;
    }
}

// Add event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const todayBtn = document.getElementById('todayBestSpotsBtn');
    const tomorrowBtn = document.getElementById('tomorrowBestSpotsBtn');

    if (!todayBtn || !tomorrowBtn) {
        console.error('[DOM Load] Could not find best spots buttons');
        return;
    }

    function updateButtonStates(activeBtn) {
        todayBtn.classList.toggle('active', activeBtn === todayBtn);
        tomorrowBtn.classList.toggle('active', activeBtn === tomorrowBtn);
    }

    todayBtn.addEventListener('click', () => {
        console.log('[Button Click] Today button clicked');
        updateButtonStates(todayBtn);
        displayBestSpots('today');
    });

    tomorrowBtn.addEventListener('click', () => {
        console.log('[Button Click] Tomorrow button clicked');
        updateButtonStates(tomorrowBtn);
        displayBestSpots('tomorrow'); // Simply display tomorrow's data without reloading
    });

    // Initial load
    initializeBestSpots().catch(error => {
        console.error('[DOM Load] Failed to initialize best spots:', error);
    });
});

/* End Best Spots by Time */












/* Making the buttons at the top of the page */

// Modify the showTab function to handle loading regional overviews
function showTab(tabName) {
    console.log(`%c[Tabs] Switching to tab: ${tabName}`, "color: blue; font-weight: bold;");
    
    // Hide all content sections first
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });

    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // Show the selected content and activate the button
    document.getElementById(tabName).style.display = 'block';
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');


    /*
    // Special handling for Weekly Report tab
    if (tabName === 'weeklyReportContent') {
        console.log(`%c[Tabs] Loading regional overviews for Weekly Report tab`, "color: blue;");
        
        // Get the current date
        const today = new Date();
        const startDate = today.toISOString().split('T')[0];
        
        // Initialize the regional overviews
        updateRegionalOverviews(startDate);
        
        // Make sure "This Week" button is active by default
        const thisWeekBtn = document.getElementById('thisWeekBtn');
        if (thisWeekBtn) {
            thisWeekBtn.classList.add('active');
            document.getElementById('nextWeekBtn')?.classList.remove('active');
        }
    }*/
}


// Remove or comment out any automatic calls to updateRegionalOverviews
document.addEventListener('DOMContentLoaded', function() {
    // Hide all content sections initially
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });

    // Show Pick a Spot & Date tab by default
    showTab('pickSpotContent');

    // Add click handlers for tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            showTab(button.dataset.tab);
        });
    });

    /*
    // Initialize week selector buttons (but don't trigger updateRegionalOverviews)
    const thisWeekBtn = document.getElementById('thisWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    */

    /*
    if (thisWeekBtn && nextWeekBtn) {
        thisWeekBtn.addEventListener('click', async () => {
            console.log('%c[WeekSelector] Switching to This Week view', 'color: purple;');
            thisWeekBtn.classList.add('active');
            nextWeekBtn.classList.remove('active');
            const today = new Date();
            await updateRegionalOverviews(today.toISOString().split('T')[0]);
        });

        nextWeekBtn.addEventListener('click', async () => {
            console.log('%c[WeekSelector] Switching to Next Week view', 'color: purple;');
            nextWeekBtn.classList.add('active');
            thisWeekBtn.classList.remove('active');
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            await updateRegionalOverviews(nextWeek.toISOString().split('T')[0]);
        });
    }
    */
});


/* End Making the buttons at the top of the page */






async function fetchBestTimes() {
    const spotSelect = document.getElementById('bestTimesSpotSelect');
    const resultsDiv = document.getElementById('bestTimesResults');
    const selectedSpot = spotSelect.value;
    
    // Show loading state
    resultsDiv.innerHTML = '<div class="loading">Loading best times...</div>';
    
    try {
        const response = await fetch(`/spot_best_times?spot=${encodeURIComponent(selectedSpot)}`);
        const data = await response.json();
        
        if (response.ok) {
            displayBestTimes(data);
        } else {
            resultsDiv.innerHTML = `<div class="error">Error: ${data.error || 'Failed to fetch best times'}</div>`;
        }
    } catch (error) {
        resultsDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

function displayBestTimes(data) {
    const resultsDiv = document.getElementById('bestTimesResults');
    
    const html = `
        <h3>${data.spot} - ${data.date}</h3>
        
        <div class="sun-times">
            <p>🌅 Sunrise: ${data.sunrise}</p>
            <p>🌇 Sunset: ${data.sunset}</p>
        </div>

        <div class="times-section">
            <h4>Best Times to Surf:</h4>
            ${data.best_times.map(time => `
                <div class="time-block best-time">
                    ${time}
                </div>
            `).join('')}
        </div>

        <div class="times-section">
            <h4>Good Times to Surf:</h4>
            ${data.good_times.map(time => `
                <div class="time-block good-time">
                    ${time}
                </div>
            `).join('')}
        </div>

        <div class="conditions-info">
            <h4>Conditions Used:</h4>
            <pre>${JSON.stringify(data.conditions, null, 2)}</pre>
        </div>
    `;
    
    resultsDiv.innerHTML = html;
}