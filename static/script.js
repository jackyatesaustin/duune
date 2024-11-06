// At the top of the file with other global variables
let isInitialLoad = true;
let isUpdatingBiggestDays = false;


// Updated window.onload function THAT LOADS THE BUTTONS 
window.onload = async function () {
    console.log("%c[App Init] Page loaded. Initializing application...", "color: blue; font-weight: bold;");

    const dateInput = document.getElementById('dateInput');
    const spotSelect = document.getElementById('spotSelect');
    const today = new Date(); 
    const todayISO = today.toISOString().split('T')[0];
    dateInput.value = todayISO;
    
    // Initial data for today's date and current spot
    let currentSpot = spotSelect.value;
    let currentSpotId = await getSpotId(currentSpot);
    let currentDate = todayISO;

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

    // Lazy load wave data for the next 16 days after the page has loaded
    setTimeout(async () => {
        console.log("%c[Lazy Load] Lazy loading wave data for the next 16 days...", "color: green; font-weight: bold;");
        for (let i = 1; i < 17; i++) {
            const futureDate = new Date(today.getTime() + i * 86400000).toISOString().split('T')[0];
            if (!cachedWaveData[futureDate]) {
                await getSpotForecast(currentSpotId, futureDate);
            }
        }
        // Update biggest upcoming days only once after all data is loaded
        await updateTopUpcomingDays(currentSpot);
        await updateBiggestUpcomingLADays();
    }, 5000);


    //when a new spot is selected
    
    spotSelect.addEventListener('change', async function (e) {
        const newSpot = e.target.value;
        const currentDate = document.getElementById('dateInput').value;
        
        try {
            // Clear existing data
            cachedWaveData = {};
            
            // Update upcoming days for the new spot
            await updateTopUpcomingDays(newSpot);
            
            // Get spot ID and regenerate date buttons
            const spotId = await getSpotId(newSpot);
            await generateDateButtons(spotId);
            
            // Get new data with the spot ID
            await getData(newSpot, currentDate);
            
            console.log(`%c[Spot Change] Successfully updated to ${newSpot}`, "color: green; font-weight: bold;");
        } catch (error) {
            console.error('[Spot Change] Error updating spot:', error);
        }
    });
    




    // Event listener for date change
    dateInput.addEventListener('change', async function () {
        const newDate = dateInput.value;
        console.log(`%c[Date Change] Detected date change: New date: ${newDate}, Current date: ${currentDate}`, "color: orange; font-weight: bold;");
        

        // Only update the data if the date changes, without reloading the buttons
        if (newDate !== currentDate) {
            console.log("%c[Date Change] Date changed! Updating data without reloading buttons...", "color: orange; font-weight: bold;");
            currentDate = newDate;
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
            await getData();  // This should update the graphs and information
        } else {
            console.log("%c[Date Change] No change in date detected. Skipping data update.", "color: orange;");
        }
    });
};





let cachedWaveData = {}; // To store wave data keyed by date
const selectedSpot = '';

//working

async function getSpotForecast(spotId) {
    try {
        const localToday = new Date();
        const formattedToday = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
        console.log(`%c[Forecast Fetch] Fetching wave forecast for Spot ID: ${spotId} and Date: ${formattedToday}`, "color: teal; font-weight: bold;");

        const response = await fetch(`/get_wave_forecast?spot_id=${spotId}&date=${formattedToday}`);
        const forecast = await response.json();
        console.log(`%c[Forecast Fetch] Response received for Spot ID: ${spotId}, Date: ${formattedToday}`, "color: teal;");


        cachedWaveData[formattedToday] = [];  // Initialize cache for today's date
        console.log(`%c[Forecast Cache] Initializing cache for Date: ${formattedToday}`, "color: teal;");

        
        forecast.forEach(item => {
            const localDateObj = item.date_local;
            const localDate = `${localDateObj.yy}-${String(localDateObj.mm).padStart(2, '0')}-${String(localDateObj.dd).padStart(2, '0')}`;
        
            // Ensure correct 24-hour format for time without mixing hours and minutes
            const waveTime = new Date(localDateObj.yy, localDateObj.mm - 1, localDateObj.dd, localDateObj.hh, 0); // Keep minutes as 0
        
            if (!cachedWaveData[localDate]) {
                console.log(`%c[Forecast Cache] Creating new cache for Date: ${localDate}`, "color: teal;");
                cachedWaveData[localDate] = [];
            }
        
            cachedWaveData[localDate].push({
                time: waveTime,
                height: parseFloat(item.size_ft.toFixed(3))  // Ensure correct height precision
            });
        });
        
        // Log the cached wave data after parsing the forecast
        console.log(`%c[Forecast Cache] Cached wave data for ${formattedToday}:`, "color: teal;", cachedWaveData[formattedToday]);
        console.log(`%c[Forecast Cache] Full cached wave data after update:`, "color: teal;", cachedWaveData);

    } catch (error) {
        console.error(`%c[Forecast Error] Failed to fetch wave forecast for Spot ID: ${spotId} and Date: ${date || 'today'}`, "color: red; font-weight: bold;", error);
    }
}



//testing
function updateWaveGraph(date, sunrise, sunset) {
    console.log(`%c[WaveGraph] Starting updateWaveGraph for date: ${date}`, "color: purple; font-weight: bold;");    
    const waveDataForDate = cachedWaveData[date];

    if (!waveDataForDate) {
        console.error(`%c[WaveGraph Error] No wave data available for the selected date: ${date}`, "color: red; font-weight: bold;");
        return;
    }

    console.log(`%c[WaveGraph] Wave data found for ${date}:`, "color: purple;", waveDataForDate);


    // Map times and heights
    let waveTimes = waveDataForDate.map(item => item.time);
    let waveHeights = waveDataForDate.map(item => item.height);

    console.log(`%c[WaveGraph] Mapping wave times and heights for ${date}:`, "color: purple;");
    console.log("%c[WaveGraph] Wave Times (Before Sorting):", "color: purple;", waveTimes);
    console.log("%c[WaveGraph] Wave Heights (Before Sorting):", "color: purple;", waveHeights);


    // Sort the times and corresponding heights to ensure proper plotting
    waveTimes.sort((a, b) => a - b);
    waveHeights = waveTimes.map(time => {
        const index = waveDataForDate.findIndex(item => item.time.getTime() === time.getTime());
        return waveDataForDate[index].height;
    });

    console.log("%c[WaveGraph] Sorted Wave Times:", "color: purple;", waveTimes);
    console.log("%c[WaveGraph] Mapped Heights After Sorting:", "color: purple;", waveHeights);


    // Plot data with sorted times and heights
    const trace = {
        x: waveTimes,
        y: waveHeights,
        mode: 'lines+markers',
        name: 'Wave Height (ft)',
        line: { color: 'blue', width: 4 },
        hovertemplate: 'Time: %{x}<br>Height: %{y} ft<extra></extra>'
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
                fillcolor: 'rgba(211, 211, 211, 0.3)',
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
                fillcolor: 'rgba(211, 211, 211, 0.3)',
                line: { width: 0 }
            }
        );
    }


    const spot = document.getElementById('spotSelect').value;
    //const dateInput = document.getElementById('dateInput');

    /*
    const layout = {
       //title: `Wave Height`,
       title: `Wave Height for ${spot} on ${date}`, // Add this line for spot and date label
        xaxis: {
            tickformat: '%-I %p',
            dtick: 3600000,
            range: [new Date(`${date}T00:00:00`).getTime(), new Date(`${date}T23:59:59`).getTime()],
        },
        yaxis: { title: 'Wave Height (ft)' },
        height: 300,
        margin: { l: 50, r: 50, t: 40, b: 40 },
        shapes: shapes
    };
    */

        // Responsive design settings
        const windowWidth = window.innerWidth;
        const isMobile = windowWidth <= 768;  // Detect if mobile (you can tweak the pixel threshold)
        
        const layout = {
           title: `Wave Height for ${spot} on ${date}`,
           xaxis: {
               tickformat: '%-I %p',
               dtick: isMobile ? 7200000 : 3600000,  // Use fewer ticks on mobile
               range: [new Date(`${date}T00:00:00`).getTime(), new Date(`${date}T23:59:59`).getTime()],
               tickfont: {
                   size: isMobile ? 10 : 14,  // Smaller font size on mobile
               }
           },
           yaxis: { 
               title: 'Wave Height (ft)', 
               tickfont: {
                   size: isMobile ? 10 : 14  // Adjust y-axis tick size for mobile
               },
               titlefont: {
                   size: isMobile ? 12 : 16  // Adjust title size for mobile
               }
           },
           height: isMobile ? 250 : 300,  // Smaller height on mobile
           margin: { 
               l: isMobile ? 40 : 50, 
               r: isMobile ? 30 : 50, 
               t: isMobile ? 30 : 40, 
               b: isMobile ? 40 : 50 
           },
           shapes: shapes
        };

    console.log("%c[WaveGraph] Layout for Plot Ready:", "color: purple;", layout);
    Plotly.newPlot('waveHeightPlot', [trace], layout, { responsive: true, displayModeBar: false, staticPlot: true });
    console.log("%c[WaveGraph] Plotly Plot Updated Successfully for date: " + date, "color: green; font-weight: bold;");

}



//working
let dataFetched = false;  // A flag to track if data was fetched already
async function getData(shouldGenerateButtons = false, updateUpcomingDays = false) {
    cachedWaveData = {}
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


    if (!cachedWaveData || !cachedWaveData[date]) {
        console.log(`%c[getData] Fetching wave forecast for Spot ID: ${spotId}, Date: ${date}`, "color: navy;");
        await getSpotForecast(spotId); // Fetch wave data for the spot and date
    } else {
        console.log(`%c[getData] Using cached wave data for Date: ${date}`, "color: green;");
    }


    // Force clear any existing cached data
    cachedWaveData[spot] = null;
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
    cachedWaveData[spot] = data;

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

    data.best_times.forEach(period => {
        const startTime = new Date(period.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const endTime = new Date(period.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const listItem = document.createElement('li');
        listItem.textContent = `${startTime} - ${endTime}`;
        document.getElementById('bestTimesList').appendChild(listItem);
    });

    data.good_times.forEach(period => {
        const startTime = new Date(period.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const endTime = new Date(period.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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

    // For each segment type, create a single trace with the appropriate color
    glassySegments.forEach(segment => {
        const isOffshore = interpolatedDirections[segment[0]] >= data.spot_config.offshore_wind.min && 
                        interpolatedDirections[segment[0]] <= data.spot_config.offshore_wind.max;
        
        // Create a single trace for this segment
        
        const trace = {
            x: segment.map(i => minutePoints[i]),
            y: segment.map(i => interpolatedSpeeds[i]),
            mode: 'lines',
            name: ``,
            line: { 
                color: isOffshore ? 'darkgreen' : 'limegreen',
                width: 3,
                simplify: false  // Prevent line simplification
            },
            fill: 'tozeroy',
            fillcolor: isOffshore ? 'rgba(0, 100, 0, 0.3)' : 'rgba(0, 255, 0, 0.2)',
            showlegend: showLegendGlassy,
            //hovertemplate: '%{y:.1f} km/h<br>Direction: ' + degreesToCardinal(interpolatedDirections[segment[0]]) + '<br>%{x}<extra></extra>'
            //hovertemplate: '%{y:.1f} km/h<br>Direction: ' + degreesToCardinal(interpolatedDirections[segment[0]]) + '<br>%{x|%I:%M %p}<extra></extra>'
            hovertemplate: 
            (isOffshore ? '🌊 Offshore<br>' : '🌬️ Glassy<br>') +
            '💨 %{y:.1f} km/h<br>' + 
            '🕒 %{x|%I:%M %p}<br>' + 
            '🧭 ' + degreesToArrow(interpolatedDirections[segment[0]]) + ' ' + 
            degreesToCardinal(interpolatedDirections[segment[0]]) + ' ' +
            `(${Math.round(interpolatedDirections[segment[0]])}°)` + '<extra></extra>',
            hoverinfo: 'text',
            hoverlabel: { 
                bgcolor: 'white', 
                namelength: 0,
                font: { size: 14, family: 'Arial, sans-serif' }
            }
        };
        
        windTraces.push(trace);
        showLegendGlassy = false;
    });

    mildWindSegments.forEach(segment => {
        const isOffshore = interpolatedDirections[segment[0]] >= data.spot_config.offshore_wind.min && 
                        interpolatedDirections[segment[0]] <= data.spot_config.offshore_wind.max;
        
        const trace = {
            x: segment.map(i => minutePoints[i]),
            y: segment.map(i => interpolatedSpeeds[i]),
            mode: 'lines',
            name: ``,
            line: { 
                color: isOffshore ? 'darkgreen' : 'yellow',
                width: 3,
                simplify: false
            },
            fill: 'tozeroy',
            fillcolor: isOffshore ? 'rgba(0, 100, 0, 0.3)' : 'rgba(255, 255, 0, 0.2)',
            showlegend: showLegendMild,
            //hovertemplate: '%{y:.1f} km/h<br>Direction: ' + degreesToCardinal(interpolatedDirections[segment[0]]) + '<br>%{x}<extra></extra>'
            //hovertemplate: '%{y:.1f} km/h<br>Direction: ' + degreesToCardinal(interpolatedDirections[segment[0]]) + '<br>%{x|%I:%M %p}<extra></extra>'
            hovertemplate: 
            (isOffshore ? 'Offshore<br>' : 'Mild<br>') +
            '💨 %{y:.1f} km/h<br>' + 
            '🕒 %{x|%I:%M %p}<br>' + 
            '🧭 ' + degreesToArrow(interpolatedDirections[segment[0]]) + ' ' + 
            degreesToCardinal(interpolatedDirections[segment[0]]) + ' ' +
            `(${Math.round(interpolatedDirections[segment[0]])}°)` + '<extra></extra>',
            hoverinfo: 'text',
            hoverlabel: { 
                bgcolor: 'white', 
                namelength: 0,
                font: { size: 14, family: 'Arial, sans-serif' }
            }
        };
        windTraces.push(trace);
        showLegendMild = false;
    });

    badWindSegments.forEach(segment => {
        const isOffshore = interpolatedDirections[segment[0]] >= data.spot_config.offshore_wind.min && 
                        interpolatedDirections[segment[0]] <= data.spot_config.offshore_wind.max;
        
        const trace = {
            x: segment.map(i => minutePoints[i]),
            y: segment.map(i => interpolatedSpeeds[i]),
            mode: 'lines',
            name: ``,
            line: { 
                color: isOffshore ? 'darkgreen' : 'red',
                width: 3,
                simplify: false
            },
            fill: 'tozeroy',
            fillcolor: isOffshore ? 'rgba(0, 100, 0, 0.3)' : 'rgba(255, 0, 0, 0.2)',
            showlegend: showLegendBad,
            //hovertemplate: '%{y:.1f} km/h<br>Direction: ' + degreesToCardinal(interpolatedDirections[segment[0]]) + '<br>%{x}<extra></extra>'
            //hovertemplate: '%{y:.1f} km/h<br>Direction: ' + degreesToCardinal(interpolatedDirections[segment[0]]) + '<br>%{x|%I:%M %p}<extra></extra>'
            hovertemplate: 
            (isOffshore ? 'Offshore<br>' : 'Bad<br>') +
            '💨 %{y:.1f} km/h<br>' + 
            '🕒 %{x|%I:%M %p}<br>' + 
            '🧭 ' + degreesToArrow(interpolatedDirections[segment[0]]) + ' ' + 
            degreesToCardinal(interpolatedDirections[segment[0]]) + ' ' +
            `(${Math.round(interpolatedDirections[segment[0]])}°)` + '<extra></extra>',
            hoverinfo: 'text',
            hoverlabel: { 
                bgcolor: 'white', 
                namelength: 0,
                font: { size: 14, family: 'Arial, sans-serif' }
            }
        };
        windTraces.push(trace);
        showLegendBad = false;
    });





    const lowTideSegments = getConditionSegments(interpolatedHeights, height => height < tideConfig.low);
    const moderateTideSegments = getConditionSegments(interpolatedHeights, height => height >= tideConfig.low && height <= tideConfig.moderate);
    const highTideSegments = getConditionSegments(interpolatedHeights, height => height > tideConfig.moderate && height <= tideConfig.high);
    const veryHighTideSegments = getConditionSegments(interpolatedHeights, height => height > tideConfig.high);
    

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

    lowTideSegments.forEach(segment => {
        tideTraces.push({
            x: segment.map(i => minutePoints[i]),
            y: segment.map(i => interpolatedHeights[i]),
            mode: 'lines',
            name: `Low Tide (< ${tideConfig.moderate} ft)`,
            line: { color: 'lightcoral', width: 3 },
            fill: 'tozeroy',
            fillcolor: 'rgba(255, 192, 192, 0.2)',
            showlegend: showLegendLow,
            //hovertemplate: '%{y:.1f} ft<br>%{x}<extra></extra>'
            //hovertemplate: '%{y:.1f} ft<br>%{x|%I:%M %p}<extra></extra>'
            hovertemplate: 
            '🌊 Low<br>' +
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

    moderateTideSegments.forEach(segment => {
        tideTraces.push({
            x: segment.map(i => minutePoints[i]),
            y: segment.map(i => interpolatedHeights[i]),
            mode: 'lines',
            name: `Moderate Tide (${tideConfig.moderate}-${tideConfig.high} ft)`,
            line: { color: 'limegreen', width: 6 },
            fill: 'tozeroy',
            fillcolor: 'rgba(0, 255, 0, 0.2)',
            showlegend: showLegendModerate,
            //hovertemplate: '%{y:.1f} ft<br>%{x}<extra></extra>'
            //hovertemplate: '%{y:.1f} ft<br>%{x|%I:%M %p}<extra></extra>'
            hovertemplate: 
            '🌊 Moderate<br>' +
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

    highTideSegments.forEach(segment => {
        tideTraces.push({
            x: segment.map(i => minutePoints[i]),
            y: segment.map(i => interpolatedHeights[i]),
            mode: 'lines',
            name: `High Tide (${tideConfig.high}-${tideConfig.veryHigh} ft)`,
            line: { color: 'yellow', width: 6 },
            fill: 'tozeroy',
            fillcolor: 'rgba(255, 255, 0, 0.2)',
            showlegend: showLegendHigh,
            //hovertemplate: '%{y:.1f} ft<br>%{x}<extra></extra>'
            //hovertemplate: '%{y:.1f} ft<br>%{x|%I:%M %p}<extra></extra>'
            hovertemplate: 
            '🌊 High<br>' +
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

    veryHighTideSegments.forEach(segment => {
        tideTraces.push({
            x: segment.map(i => minutePoints[i]),
            y: segment.map(i => interpolatedHeights[i]),
            mode: 'lines',
            name: `Very High Tide (> ${tideConfig.veryHigh} ft)`,
            line: { color: 'red', width: 3 },
            fill: 'tozeroy',
            fillcolor: 'rgba(255, 0, 0, 0.2)',
            showlegend: showLegendVeryHigh,
            //hovertemplate: '%{y:.1f} ft<br>%{x}<extra></extra>'
            //hovertemplate: '%{y:.1f} ft<br>%{x|%I:%M %p}<extra></extra>'
            hovertemplate: 
            '🌊 Very High<br>' +
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


    // Adjust for mobile screen responsiveness
    const isMobile = window.innerWidth < 768;

    // Existing layout for the graphs
    const layout = {
        xaxis: {
            range: [minTime, maxTime],
            tickformat: '%-I %p', // Adjust time format to 12-hour with AM/PM
            dtick: isMobile ? 7200000 : 3600000, // On mobile, show ticks every 2 hours
            dtick: 3600000, // Tick every hour (in milliseconds)
            title: '',
            tickfont: {
                size: isMobile ? 10 : 12, // Smaller font for mobile
            },
            fixedrange: true // Disable scrolling on the x-axis for consistency
        },
        yaxis: { 
            title: '', 
            tickfont: {
                size: isMobile ? 10 : 12, // Smaller font for mobile
            },
            fixedrange: true // Disable scrolling on the y-axis
        },
        height: isMobile ? 200 : 240, // Adjust height for mobile screens
        margin: { l: isMobile ? 40 : 50, r: 40, t: 30, b: isMobile ? 30 : 40 }, // Adjust margins for mobile
        margin: { l: 50, r: 50, t: 40, b: 40 },
        hovermode: 'closest',
        showlegend: false
    };

    // Wind graph layout
    const windLayout = {
        title: `Wind Speed for ${spot} on ${date}`, // Add spot and da
        ...layout,  // Inherit from the common layout
        yaxis: {
            title: 'Wind Speed (km/h)',
            fixedrange: true,  // Disable scrolling
        },
        hoverlabel: {
            namelength: 0  // Show full label length
        },
        hovermode: 'closest',
        showlegend: false
    };

    // Render wind graph
    console.log(`Updating wind graph for spot: ${spot} with ${windTraces.length} trace(s) .`);
    //Plotly.newPlot('windPlot', windTraces, windLayout, { responsive: true });
    Plotly.newPlot('windPlot', windTraces, windLayout, { 
        responsive: true,
        displayModeBar: false,  // Optional: removes the modebar
        showTips: false  // Removes tooltips
    });

    // Tide graph layout
    console.log(`Updating tide graph for spot: ${spot} with ${tideTraces.length} trace(s) on ${date}.`);
    const tideLayout = {
        title: `Tide for ${spot} on ${date}`, // Add spot and da
        ...layout,  // Inherit from the common layout
        yaxis: {
            title: 'Tide Height (ft)',
            fixedrange: true,  // Disable scrolling
        },
        hoverlabel: {
            namelength: 0  // Show full label length
        },
        hovermode: 'closest',
        showlegend: false
    };

    // Render tide graph
    Plotly.newPlot('tidePlot', tideTraces, tideLayout, { responsive: true });


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
      //  fill: 'tozeroy',  // Add fill to make hover area larger
        line: { color: 'red', width: 3 },
        hoverinfo: 'all',
        hovertemplate: 
            '🚫 Unfavorable Time<br>' +
            '🕒 %{x|%I:%M %p}<extra></extra>',
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
            '👍 Good Time<br>' +
            '🕒 %{x|%I:%M %p}<extra></extra>',
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
            '🕒 %{x|%I:%M %p}<extra></extra>',
        hoverlabel: { 
            bgcolor: 'white', 
            namelength: 0,
            font: { size: 14, family: 'Arial, sans-serif' }
        }
    });
});




    // Render Best Times Graph with synchronized layout
    Plotly.newPlot('bestTimesPlot', bestTimesTraces, {
        ...layout,  // Use the same layout as wind and tide graphs to ensure alignment
        height: isMobile ? 100 : 120, // Adjust height for mobile
        height: 120,
        yaxis: { visible: false }, // Hide y-axis for best times
        xaxis: { 
            ...layout.xaxis,
            fixedrange: true  // Ensure scrolling is disabled on x-axis for Best Times
        },
        responsive: true, 
        hovermode: 'closest',  // Make sure this is set
        showlegend: false,
        hoverdistance: 50,  // Increase hover sensitivity
        hoverlabel: {
            namelength: -1  // Show full label length
        }
        }, {
            displayModeBar: false,  // Optional: removes the modebar
            responsive: true,
            showTips: false  // Removes tooltips
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
    <div class="legend-item green"><span></span> Glassy</div>
    <div class="legend-item yellow"><span></span> Mild Wind</div>
    <div class="legend-item red"><span></span> Strong Wind</div>
    <div class="legend-item darkgreen"><span></span> Offshore Wind</div>
`;

    document.getElementById('tideLegend').innerHTML = `
        <div class="legend-item lightcoral"><span></span> Low Tide (< ${tideConfig.moderate} ft)</div>
        <div class="legend-item green"><span></span> Moderate Tide (${tideConfig.moderate}-${tideConfig.high} ft)</div>
        <div class="legend-item yellow"><span></span> High Tide (${tideConfig.high}-${tideConfig.veryHigh} ft)</div>
        <div class="legend-item red"><span></span> Very High Tide (> ${tideConfig.veryHigh} ft)</div>
    `;
    document.getElementById('bestTimesLegend').innerHTML = `
        <div class="legend-item green"><span></span> Best Time</div>
        <div class="legend-item yellow"><span></span> Good Time</div>
    `;

    // Simulate the loading process for the graph (or after your data fetch is done)
    setTimeout(() => {
        // After the data is fetched and the graph is ready, hide the loading GIF and message, show the graph
        waveLoading.style.display = 'none';  // Hide the loading GIF and message
        waveHeightPlot.style.display = 'block';  // Show the wave height plot
        updateWaveGraph(date, sunriseTime, sunsetTime);  // Update the graph

        // Hide loading for wind graph and show the plot
        document.getElementById('windLoading').style.display = 'none';
        document.getElementById('windPlot').style.display = 'block';
        Plotly.newPlot('windPlot', windTraces, windLayout, { responsive: true });  // This is the existing wind plot update

        // Hide loading for tide graph and show the plot
        document.getElementById('tideLoading').style.display = 'none';
        document.getElementById('tidePlot').style.display = 'block';
        Plotly.newPlot('tidePlot', tideTraces, tideLayout, { responsive: true });  // This is th

    }, 2000);  // Simulate a delay or adjust based on the actual graph load time

}


// Utility function to get segments of conditions
/*
function getConditionSegments(data, conditionFn) {
    console.log(`%c[getConditionSegments] Starting to process data with length: ${data.length}`, "color: purple; font-weight: bold;");
    const segments = [];
    let segment = [];
    for (let i = 0; i < data.length; i++) {
        if (conditionFn(data[i])) {
            segment.push(i);
        } else if (segment.length) {
            segments.push(segment);
            segment = [];
        }
    }
    if (segment.length) segments.push(segment);
    console.log(`%c[getConditionSegments] Finished processing. Total segments found: ${segments.length}`, "color: purple; font-weight: bold;");
    return segments;
}
*/



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

// Updated generateDateButtons function


async function generateDateButtons(spotId) {
    console.log(`%c[Date Buttons] Starting to generate date buttons for Spot ID: ${spotId}`, "color: purple; font-weight: bold;");
    
    const forecastContainer = document.getElementById('extendedForecast');
    forecastContainer.innerHTML = ''; // Clear any existing buttons
    console.log(`%c[Date Buttons] Cleared existing date buttons in the forecast container`, "color: purple;");

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sunTimesCache = {};
    const buttonsData = [];
    const sunApiUrls = [];

    const date = new Date();
    const timezoneOffset = date.getTimezoneOffset() * 60000; // Handle timezone offset

    console.log(`%c[Date Buttons] Preparing buttons for the next 17 days`, "color: purple;");

    // Prepare buttons data and sunrise/sunset API calls for the next 17 days
    for (let i = 0; i < 17; i++) {
        const currentDate = new Date(date.getTime() + i * 86400000 - timezoneOffset);
        const localDate = currentDate.toISOString().split('T')[0];

        const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : daysOfWeek[currentDate.getDay()];
        const dateFormatted = `${currentDate.getMonth() + 1}/${currentDate.getDate()}`;

        buttonsData.push({ dayName, dateFormatted, localDate });
        sunApiUrls.push({
            url: `https://api.sunrise-sunset.org/json?lat=34.0522&lng=-118.2437&date=${localDate}&formatted=0`,
            localDate
        });

        console.log(`%c[Date Buttons] Prepared data for: ${dayName} (${localDate})`, "color: purple;");
    }

    // Fetch all sunrise/sunset times in parallel
    console.log(`%c[Date Buttons] Fetching sunrise/sunset data for all 17 days...`, "color: purple;");
    const sunResponses = await Promise.all(sunApiUrls.map(api => fetch(api.url).then(res => res.json())));

    // Cache the fetched sunrise/sunset times
    sunResponses.forEach((sunData, index) => {
        const { localDate } = sunApiUrls[index];
        if (sunData.status === "OK") {
            sunTimesCache[localDate] = {
                sunrise: new Date(sunData.results.sunrise),
                sunset: new Date(sunData.results.sunset),
            };
            console.log(`%c[Date Buttons] Cached sunrise/sunset data for ${localDate}`, "color: purple;");
        } else {
            console.error(`%c[Date Buttons] Error fetching sunrise/sunset data for ${localDate}`, "color: red; font-weight: bold;");
        }
    });

    const fragment = document.createDocumentFragment(); // Batch DOM updates using a fragment

    // Generate buttons based on wave data and sunrise/sunset times
    for (const { dayName, dateFormatted, localDate } of buttonsData) {
        const { sunrise, sunset } = sunTimesCache[localDate] || {};

        if (!sunrise || !sunset) {
            console.log(`%c[Date Buttons] Skipping button creation for ${localDate} (No sunrise/sunset data)`, "color: purple;");
            continue;
        }

        const waveDataForDate = cachedWaveData[localDate];
        if (waveDataForDate) {
            const filteredWaveData = waveDataForDate.filter(item => item.time >= sunrise && item.time <= sunset);
            if (filteredWaveData.length > 0) {
                const peakWaveHeight = Math.max(...filteredWaveData.map(item => item.height));
                const lowWaveHeight = Math.min(...filteredWaveData.map(item => item.height));

                // Create button and add it to the fragment
                const button = document.createElement('button');
                button.className = 'date-button';
                button.innerHTML = `${dayName}<br>${dateFormatted}<br>${peakWaveHeight.toFixed(1)}-${lowWaveHeight.toFixed(1)} ft`;

                button.onclick = () => {
                    console.log(`%c[Date Buttons] Button clicked for Date: ${localDate}`, "color: purple;");
                    document.getElementById('dateInput').value = localDate;
                    getData();  // Trigger data update for selected date
                };

                fragment.appendChild(button);
                console.log(`%c[Date Buttons] Created button for ${localDate} with wave range: ${peakWaveHeight.toFixed(1)}-${lowWaveHeight.toFixed(1)} ft`, "color: purple;");
            } else {
                console.log(`%c[Date Buttons] No wave data found for ${localDate}`, "color: purple;");
            }
        } else {
            console.log(`%c[Date Buttons] No cached wave data for ${localDate}`, "color: purple;");
        }
    }

    // Append all generated buttons to the forecast container
    forecastContainer.appendChild(fragment);
    console.log(`%c[Date Buttons] All date buttons appended to the forecast container`, "color: purple; font-weight: bold;");
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
    console.log(`%c[updateTopUpcomingDays] Updating top upcoming days for spot: ${spotName}`, "color: darkblue; font-weight: bold;");

    // Immediately update the surf spot name in the title
    document.getElementById('surfSpotName').textContent = spotName;

    // Immediately set loading indicators for the biggest-day elements
    document.getElementById('biggestDayLeft').textContent = '..loading..';
    document.getElementById('biggestDayCenter').textContent = '..loading..';
    document.getElementById('biggestDayRight').textContent = '..loading..';

    const daysWithWaveData = [];
    console.log(`%c[updateTopUpcomingDays] Fetching cached wave data...`, "color: darkblue;");

    // Fetch cached wave data and sunrise/sunset times
    for (const dateKey of Object.keys(cachedWaveData)) {
        console.log(`%c[updateTopUpcomingDays] Processing wave data for date: ${dateKey}`, "color: darkblue;");
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
            // Filter the wave data to include only data points between sunrise and sunset
            const filteredWaveData = waveDataForDate.filter(item => item.time >= sunriseTime && item.time <= sunsetTime);
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
        document.getElementById('biggestDayLeft').textContent = 'No wave data available for upcoming days';
        document.getElementById('biggestDayCenter').textContent = '';
        document.getElementById('biggestDayRight').textContent = '';
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
        console.log(`%c[updateTopUpcomingDays] Fetching cached wave data...`, "color: darkblue;");
    
        // Fetch cached wave data and sunrise/sunset times
        for (const dateKey of Object.keys(cachedWaveData)) {
            console.log(`%c[updateTopUpcomingDays] Processing wave data for date: ${dateKey}`, "color: darkblue;");
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
                // Filter the wave data to include only data points between sunrise and sunset
                const filteredWaveData = waveDataForDate.filter(item => item.time >= sunriseTime && item.time <= sunsetTime);
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
            document.getElementById('biggestDayLeft').textContent = 'No wave data available for upcoming days';
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





// Function to format the date in "Saturday, Oct 12th 2024" format using selectedDate
function formatDate(selectedDate) {
    // Manually parse the selectedDate string to ensure correct local date
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day); // JavaScript months are zero-indexed

    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    
    // Format the date to "Saturday, Oct 12 2024"
    const formattedDate = date.toLocaleDateString('en-US', options);

    // Add ordinal suffix to the day
    let suffix = 'th';
    if (day % 10 === 1 && day !== 11) {
        suffix = 'st';
    } else if (day % 10 === 2 && day !== 12) {
        suffix = 'nd';
    } else if (day % 10 === 3 && day !== 13) {
        suffix = 'rd';
    }

    // Inject the day with the suffix into the formatted date
    return formattedDate.replace(day, day + suffix);
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



window.addEventListener('resize', function() {
    Plotly.Plots.resize(document.getElementById('waveHeightPlot'));
    Plotly.Plots.resize(document.getElementById('bestTimesPlot'));
    Plotly.Plots.resize(document.getElementById('windPlot'));
    Plotly.Plots.resize(document.getElementById('tidePlot'));
});


