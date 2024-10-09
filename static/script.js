// Updated window.onload function THAT LOADS THE BUTTONS 
//working

window.onload = async function () {
    console.log("Page loaded, attempting to initialize...");

    const dateInput = document.getElementById('dateInput');
    const spotSelect = document.getElementById('spotSelect');

    if (!dateInput || !spotSelect) {
        console.error("Required elements not found on the page.");
        return;
    }

    console.log("Elements found. Setting default values.");

    const today = new Date(); 
    const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000); 
    const todayISO = localToday.toISOString().split('T')[0];

    // Set min and max attributes for the date input
    dateInput.min = todayISO;
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 13);
    dateInput.max = maxDate.toISOString().split('T')[0];

    // Set the date input value to the current local date
    dateInput.value = todayISO;

    // Initial setup for spot and date buttons
    let currentSpot = spotSelect.value;
    let currentSpotId = await getSpotId(currentSpot);

    if (!currentSpotId) {
        console.error("Failed to resolve initial spot ID.");
        return;
    }

  //  console.log(`Initial spot selected: ${currentSpot} with spot ID: ${currentSpotId}`);

    // Fetch wave data for the next 17 days before generating buttons
  //  console.log("Fetching wave data for initial load...");
    for (let i = 0; i < 17; i++) {
        const dateToFetch = new Date(today.getTime() + i * 86400000).toISOString().split('T')[0];
        if (!cachedWaveData[dateToFetch]) {
            console.log(`Fetching wave data for ${dateToFetch} at spot ID: ${currentSpotId}`);
            await getSpotForecast(currentSpotId, dateToFetch);  // Fetch wave data for each day
        }
    }

 //   console.log("Wave data fetched. Now generating date buttons...");
    await generateDateButtons(currentSpotId);  // Ensure the correct spotId is passed after wave data is available

    await getData();  // Fetch initial data and update the graphs
    await updateTopUpcomingDays(currentSpot);  // Load the top upcoming days for the selected spot

    // Fetch and display the biggest upcoming days for LA-wide spots
    console.log("Fetching biggest upcoming days for LA...");
    await updateBiggestUpcomingLADays();  // This function will load LA-wide data only once on initial load

    // Event listener for surf spot change
    document.getElementById('spotSelect').addEventListener('change', async function () {
     //   console.log("Surf spot changed. Regenerating date buttons and updating data.");
        
        // Clear the cached data when the spot changes
        cachedWaveData = {};

        // Regenerate date buttons and update data for the new spot
        currentSpot = spotSelect.value;
        currentSpotId = await getSpotId(currentSpot);

        if (!currentSpotId) {
            console.error("Failed to resolve new spot ID.");
            return;
        }

      //  console.log(`New spot selected: ${currentSpot} with spot ID: ${currentSpotId}`);
        
        // Fetch wave data for the new spot before generating buttons
     //   console.log("Fetching wave data for new spot...");
        for (let i = 0; i < 17; i++) {
            const dateToFetch = new Date(today.getTime() + i * 86400000).toISOString().split('T')[0];
            if (!cachedWaveData[dateToFetch]) {
       //         console.log(`Fetching wave data for ${dateToFetch} at spot ID: ${currentSpotId}`);
                await getSpotForecast(currentSpotId, dateToFetch);  // Fetch wave data for each day
            }
        }

      //  console.log("Wave data fetched for new spot. Now generating date buttons...");
        await generateDateButtons(currentSpotId);  // Pass the new spotId after wave data is available

        // Update data and top upcoming days for the new spot
        await getData();
        await updateTopUpcomingDays(currentSpot);  // Reload the top upcoming days only when the spot changes
    });

    // Event listener for date change
    document.getElementById('dateInput').addEventListener('change', async function () {
    //    console.log("Date changed. Updating data for the selected date.");
        
        // Only update data for the changed date without regenerating the top upcoming days or the date buttons
        await getData(false);  // Pass `false` to avoid refreshing the upcoming days
    });
};





let cachedWaveData = {}; // To store wave data keyed by date

//testing
async function getSpotForecast(spotId) {
    try {
        const localToday = new Date();
        const formattedToday = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
       // console.log("Fetching forecast for spot ID", spotId, "and date", formattedToday);

        const response = await fetch(`/get_wave_forecast?spot_id=${spotId}&date=${formattedToday}`);
        const forecast = await response.json();
        //console.log("Full API Response:", forecast);

      //  console.log("Forecast data received for today:", forecast);

        cachedWaveData[formattedToday] = [];  // Initialize cache for today's date

       // console.log("Complete API response:", forecast);

       // console.log("Cached wave data after processing:", cachedWaveData[formattedToday]);
        //console.log("Cached wave data after processing:", cachedWaveData);


        
        
        forecast.forEach(item => {
            const localDateObj = item.date_local;
            const localDate = `${localDateObj.yy}-${String(localDateObj.mm).padStart(2, '0')}-${String(localDateObj.dd).padStart(2, '0')}`;
        
            // Ensure correct 24-hour format for time without mixing hours and minutes
            const waveTime = new Date(localDateObj.yy, localDateObj.mm - 1, localDateObj.dd, localDateObj.hh, 0); // Keep minutes as 0
        
            if (!cachedWaveData[localDate]) {
                cachedWaveData[localDate] = [];
            }
        
            cachedWaveData[localDate].push({
                time: waveTime,
                height: parseFloat(item.size_ft.toFixed(3))  // Ensure correct height precision
            });
        });
        
        
        

       //console.log("Cached wave data after fetch:", cachedWaveData);

    } catch (error) {
        console.error("Error fetching wave forecast:", error);
    }
}





//testing
function updateWaveGraph(date, sunrise, sunset) {
  //  console.log(`Starting updateWaveGraph for date: ${date}`);
    
    const waveDataForDate = cachedWaveData[date];
    
    if (!waveDataForDate) {
        console.error("No wave data available for the selected date.");
        return;
    }

    // Map times and heights
    let waveTimes = waveDataForDate.map(item => item.time);
    let waveHeights = waveDataForDate.map(item => item.height);

    // Sort the times and corresponding heights to ensure proper plotting
    waveTimes.sort((a, b) => a - b);
    waveHeights = waveTimes.map(time => {
        const index = waveDataForDate.findIndex(item => item.time.getTime() === time.getTime());
        return waveDataForDate[index].height;
    });

    // Plot data with sorted times and heights
    const trace = {
        x: waveTimes,
        y: waveHeights,
        mode: 'lines+markers',
        name: 'Wave Height (ft)',
        line: { color: 'blue', width: 4 },
        hovertemplate: 'Time: %{x}<br>Height: %{y} ft<extra></extra>'
    };

    const shapes = [];

    if (sunrise && sunset) {
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

    const layout = {
       //title: `Wave Height`,
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

    Plotly.newPlot('waveHeightPlot', [trace], layout, { responsive: true });
}


//working

let dataFetched = false;  // A flag to track if data was fetched already

async function getData(shouldGenerateButtons = false, updateUpcomingDays = false) {    


    if (dataFetched) {
      //  console.log("Data already fetched, skipping redundant execution.");
        return;
    }

    dataFetched = true;

    
    const dateInput = document.getElementById('dateInput');
    const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0]; // Default to today if no date input
    const spot = document.getElementById('spotSelect').value;

    // Array of GIF URLs
    const gifArray = [
        '/static/loading1.webp',
        '/static/loading2.webp'
    ];

    // Select a random GIF from the array
    const randomGif = gifArray[Math.floor(Math.random() * gifArray.length)];

    // Set the selected GIF and show the loading GIF and message, hide the wave height plot
    const waveHeightPlot = document.getElementById('waveHeightPlot');
    const waveLoading = document.getElementById('waveLoading');
    const loadingGif = document.getElementById('loadingGif');
    waveLoading.style.display = 'block';  // Show the loading GIF and message
    waveHeightPlot.style.display = 'none';  // Hide the graph until loading is complete
    loadingGif.src = randomGif;  // Set the random GIF source

    const selectedSpotDateLabel = document.getElementById('selectedSpotDateLabel');
    const spotDateAboveGraph = document.getElementById('spotDateAboveGraph');
    
    if (selectedSpotDateLabel && spotDateAboveGraph) {
        // Instead of creating a new Date object, just format the string passed in 'YYYY-MM-DD'
        const formattedDate = new Date(date).toISOString().split('T')[0]; // ensures the correct date string format
        selectedSpotDateLabel.textContent = `Selected Spot: ${spot} | Date: ${formattedDate}`;
        spotDateAboveGraph.textContent = `Details & Graphs | ${spot} | ${formattedDate}`;  // Label above the graph
    }
    


    const spotId = await getSpotId(spot);
    if (!spotId) {
        console.error("Spot ID not found");
        return;
    }

    console.log(`Selected Spot: ${spot}, Spot ID: ${spotId}`); // Log the selected spot and SpotId

    if (!cachedWaveData || !cachedWaveData[date]) {
   //     console.log("No cached data for date. Fetching forecast.");
        await getSpotForecast(spotId); // Fetch wave data for the spot and date
    } else {
        console.log("");
    }

    if (!date) {
        const dateInput = document.getElementById('dateInput');
        date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0]; // Default to today if no date input
    }

    console.log(`Fetching data for Spot ID: ${spotId}, Date: ${date}`);


    // Log the wave heights for each hour
    const waveDataForDate = cachedWaveData[date];
    if (waveDataForDate) {
      //  console.log(`Wave heights for ${spot} on ${date}:`);
        waveDataForDate.forEach(item => {
        //    console.log(`Time: ${item.time}, Height: ${item.height} ft`);
        });
    } else {
        //console.log(`No wave data available for ${spot} on ${date}`);
        console.log("");
    }

    
    // Fetch sunrise and sunset times for the selected spot and date
    const sunApiUrl = `https://api.sunrise-sunset.org/json?lat=34.0522&lng=-118.2437&date=${date}&formatted=0`;
    let sunriseTime, sunsetTime;

    try {
        const sunResponse = await fetch(sunApiUrl);
        const sunData = await sunResponse.json();

        if (sunData.status === "OK") {
            sunriseTime = new Date(sunData.results.sunrise);
            sunsetTime = new Date(sunData.results.sunset);
        } else {
            console.error("Error fetching sun times for", date);
            return;
        }
    } catch (error) {
        console.error("Error fetching sun times:", error);
        return;
    }

    const selectedDate = document.getElementById('dateInput').value;
    updateWaveGraph(selectedDate, sunriseTime, sunsetTime);  // Update graph based on selected date, sunrise, and sunset times

    const response = await fetch(`/get_data?date=${date}&spot=${spot}`);
    if (!response.ok) {
        console.error('Error fetching data from backend:', response.statusText);
        dataFetched = false; // Ensure the flag is reset in case of failure
        return;
    }
    const data = await response.json();

    // Log the data received from the backend
  //  console.log('Data received from backend:', data);

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
     //   console.log("Peak wave height for the day:", peakWaveHeight);
    } else {
        //console.log("No wave data available for the selected date.");
        console.log("");
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
    
    // Additional logging if necessary
   // console.log('Board Recommendation:', boardRecommendation);
    
    // Sync the graphs and other information based on the data
    // Only update the top upcoming days if explicitly requested (when the spot changes)
    // Call `updateTopUpcomingDays` if a new spot is selected or the data is updated
    if (updateUpcomingDays) {
        const spotName = document.getElementById('spotSelect').value;
        console.log(`Updating top upcoming days for spot: ${spotName}`);
        await updateTopUpcomingDays(spotName);
    }
    dataFetched = false; // Reset flag after fetching data is complete


    

    // Only regenerate date buttons if explicitly requested (i.e., when the surf spot changes)
    if (shouldGenerateButtons) {
        await generateDateButtons();
    }



    const minutePoints = data.minute_points.map(t => new Date(t));
    const interpolatedSpeeds = data.interpolated_speeds;
    const interpolatedHeights = data.interpolated_heights;

     // Check if spot exists in the config; if not, fallback to default
    const config = surfSpotsConfig[spot] || surfSpotsConfig['default'];

    // Ensure spot configuration exists or default to current data
    const spotConfig = surfSpotsConfig[spot] || surfSpotsConfig.default;
    const tideConfig = spotConfig.tide;
    const windConfig = spotConfig.wind;

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


    // Wind graph calculations using the config
    const glassySegments = getConditionSegments(interpolatedSpeeds, speed => speed <= config.wind.glassy);
    const mildWindSegments = getConditionSegments(interpolatedSpeeds, speed => speed > config.wind.glassy && speed <= config.wind.mild);
    const badWindSegments = getConditionSegments(interpolatedSpeeds, speed => speed > config.wind.mild);

    const windTraces = [];
    let showLegendGlassy = true, showLegendMild = true, showLegendBad = true;

    glassySegments.forEach(segment => {
        windTraces.push({
            x: segment.map(i => minutePoints[i]),
            y: segment.map(i => interpolatedSpeeds[i]),
            mode: 'lines',
            name: `Glassy (<= ${windConfig.glassy} km/h)`,
            line: { color: 'limegreen', width: 6 },
            fill: 'tozeroy',
            fillcolor: 'rgba(0, 255, 0, 0.2)',
            showlegend: showLegendGlassy,
            hovertemplate: '%{y:.1f} km/h<br>%{x}<extra></extra>'
        });
        showLegendGlassy = false;
    });

    mildWindSegments.forEach(segment => {
        windTraces.push({
            x: segment.map(i => minutePoints[i]),
            y: segment.map(i => interpolatedSpeeds[i]),
            mode: 'lines',
            name: `Mild Wind (${windConfig.glassy}-${windConfig.mild} km/h)`,
            line: { color: 'yellow', width: 6 },
            fill: 'tozeroy',
            fillcolor: 'rgba(255, 255, 0, 0.2)',
            showlegend: showLegendMild,
            hovertemplate: '%{y:.1f} km/h<br>%{x}<extra></extra>'
        });
        showLegendMild = false;
    });

    badWindSegments.forEach(segment => {
        windTraces.push({
            x: segment.map(i => minutePoints[i]),
            y: segment.map(i => interpolatedSpeeds[i]),
            mode: 'lines',
            name: `Bad Wind (> ${windConfig.mild} km/h)`,
            line: { color: 'red', width: 3 },
            fill: 'tozeroy',
            fillcolor: 'rgba(255, 0, 0, 0.2)',
            showlegend: showLegendBad,
            hovertemplate: '%{y:.1f} km/h<br>%{x}<extra></extra>'
        });
        showLegendBad = false;
    });

    // Tide graph calculations using the config
    const lowTideSegments = getConditionSegments(interpolatedHeights, height => height < config.tide.low);
    const moderateTideSegments = getConditionSegments(interpolatedHeights, height => height >= config.tide.low && height <= config.tide.moderate);
    const highTideSegments = getConditionSegments(interpolatedHeights, height => height > config.tide.moderate && height <= config.tide.high);
    const veryHighTideSegments = getConditionSegments(interpolatedHeights, height => height > config.tide.high);

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
            hovertemplate: '%{y:.1f} ft<br>%{x}<extra></extra>'
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
            hovertemplate: '%{y:.1f} ft<br>%{x}<extra></extra>'
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
            hovertemplate: '%{y:.1f} ft<br>%{x}<extra></extra>'
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
            hovertemplate: '%{y:.1f} ft<br>%{x}<extra></extra>'
        });
        showLegendVeryHigh = false;
    });

 // Existing layout for the graphs
const layout = {
    xaxis: {
        range: [minTime, maxTime],
        tickformat: '%-I %p', // Adjust time format to 12-hour with AM/PM
        dtick: 3600000, // Tick every hour (in milliseconds)
        title: '',
        fixedrange: true // Disable scrolling on the x-axis for consistency
    },
    yaxis: { 
        title: '', 
        fixedrange: true // Disable scrolling on the y-axis
    },
    height: 240,
    margin: { l: 50, r: 50, t: 40, b: 40 },
    hovermode: 'x unified',
    showlegend: false
};

// Wind graph layout
const windLayout = {
    ...layout,  // Inherit from the common layout
    yaxis: {
        title: 'Wind Speed (km/h)',
        fixedrange: true,  // Disable scrolling
    },
};

// Render wind graph
Plotly.newPlot('windPlot', windTraces, windLayout, { responsive: true });

// Tide graph layout
const tideLayout = {
    ...layout,  // Inherit from the common layout
    yaxis: {
        title: 'Tide Height (ft)',
        fixedrange: true,  // Disable scrolling
    },
};

// Render tide graph
Plotly.newPlot('tidePlot', tideTraces, tideLayout, { responsive: true });

// Best Times Graph
let bestTimesTraces = [];
data.best_times.forEach(period => {
    const startTime = new Date(period.start);
    const endTime = new Date(period.end);
    bestTimesTraces.push({
        x: [startTime, endTime],
        y: [0.5, 0.5],
        mode: 'lines',
        line: { color: 'limegreen', width: period.thickness },
        hovertemplate: '%{y:.1f} km/h<br>%{x}<extra></extra>',
        showlegend: true
    });
});

data.good_times.forEach(period => {
    const startTime = new Date(period.start);
    const endTime = new Date(period.end);
    bestTimesTraces.push({
        x: [startTime, endTime],
        y: [0.5, 0.5],
        mode: 'lines',
        line: { color: 'yellow', width: period.thickness },
        hovertemplate: '%{y:.1f} km/h<br>%{x}<extra></extra>',
        showlegend: true
    });
});

// Render Best Times Graph with synchronized layout
Plotly.newPlot('bestTimesPlot', bestTimesTraces, {
    ...layout,  // Use the same layout as wind and tide graphs to ensure alignment
    height: 120,
    yaxis: { visible: false }, // Hide y-axis for best times
    xaxis: { 
        ...layout.xaxis,
        fixedrange: true  // Ensure scrolling is disabled on x-axis for Best Times
    },
    responsive: true 
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
    document.getElementById('windLegend').innerHTML = `
        <div class="legend-item green"><span></span> Glassy (<= ${windConfig.glassy} km/h)</div>
        <div class="legend-item yellow"><span></span> Mild Wind (${windConfig.glassy}-${windConfig.mild} km/h)</div>
        <div class="legend-item red"><span></span> Bad Wind (> ${windConfig.mild} km/h)</div>
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
    }, 2000);  // Simulate a delay or adjust based on the actual graph load time
}



// Utility function to get segments of conditions
function getConditionSegments(data, conditionFn) {
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
    return segments;
}

// Updated generateDateButtons function
async function generateDateButtons(spotId) {
  //  console.log(`Starting generateDateButtons for spot ID: ${spotId}`);
    const forecastContainer = document.getElementById('extendedForecast');
    forecastContainer.innerHTML = ''; // Clear existing buttons

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sunTimesCache = {}; 
    const buttonsData = [];
    const sunApiUrls = [];

    // Calculate today's date and pre-generate the next 17 days
    const date = new Date();
    const timezoneOffset = date.getTimezoneOffset() * 60000;

    // Collect URLs for sunrise/sunset data
    for (let i = 0; i < 17; i++) {
        const currentDate = new Date(date.getTime() + i * 86400000 - timezoneOffset); // Shift by days and correct timezone
        const localDate = currentDate.toISOString().split('T')[0];

        const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : daysOfWeek[currentDate.getDay()];
        const dateFormatted = `${currentDate.getMonth() + 1}/${currentDate.getDate()}`;

        buttonsData.push({ dayName, dateFormatted, localDate });

        // Store URL for sunrise/sunset API call
        sunApiUrls.push({
            url: `https://api.sunrise-sunset.org/json?lat=34.0522&lng=-118.2437&date=${localDate}&formatted=0`,
            localDate
        });

      //  console.log(`Button data prepared for ${dayName}: ${dateFormatted} (${localDate})`);
    }

 //   console.log("Fetching sunrise/sunset data in parallel...");
    const sunResponses = await Promise.all(sunApiUrls.map(api => fetch(api.url).then(res => res.json())));

    // Populate the sunTimesCache from fetched data
    sunResponses.forEach((sunData, index) => {
        const { localDate } = sunApiUrls[index];
        if (sunData.status === "OK") {
            sunTimesCache[localDate] = {
                sunrise: new Date(sunData.results.sunrise),
                sunset: new Date(sunData.results.sunset),
            };
        //    console.log(`Sun times fetched for ${localDate}: Sunrise: ${sunTimesCache[localDate].sunrise}, Sunset: ${sunTimesCache[localDate].sunset}`);
        }
    });

    const fragment = document.createDocumentFragment(); // For batch DOM updates

    // Process wave data and generate buttons
    for (const { dayName, dateFormatted, localDate } of buttonsData) {
        const { sunrise, sunset } = sunTimesCache[localDate] || {};

        if (!sunrise || !sunset) {
        //    console.log(`Sun times not available for ${localDate}`);
            continue;
        }

        const waveDataForDate = cachedWaveData[localDate];
        if (waveDataForDate) {
            const filteredWaveData = waveDataForDate.filter(item => item.time >= sunrise && item.time <= sunset);

            if (filteredWaveData.length > 0) {
                const peakWaveHeight = Math.max(...filteredWaveData.map(item => item.height));
                const lowWaveHeight = Math.min(...filteredWaveData.map(item => item.height));

                // Create and append button
                const button = document.createElement('button');
                button.className = 'date-button';
                button.innerHTML = `${dayName}<br>${dateFormatted}<br>${peakWaveHeight.toFixed(1)}-${lowWaveHeight.toFixed(1)} ft`;

                button.onclick = () => {
                    document.getElementById('dateInput').value = localDate;
                    getData(); // Update data and graph
                };

                fragment.appendChild(button);
            } else {
              //  console.log(`No wave data found for ${localDate} at spot ID: ${spotId}`);
              console.log("");
            }
        } else {
            // console.log(`No cached wave data found for ${localDate} at spot ID: ${spotId}`);
            console.log("");
        }
    }



    // Append all buttons at once to minimize DOM manipulations
    forecastContainer.appendChild(fragment);
    //console.log("All date buttons appended to the forecast container.");
}

async function getSpotId(spotName) {
    try {
        const response = await fetch('/get_spot_id');
        const spots = await response.json();
        
        //console.log("Fetched spots:", spots);  // Log all spots for debugging
        
        const selectedSpot = spots.find(spot => spot.spot_name === spotName);

        if (selectedSpot) {
            const spotId = selectedSpot.spot_id;
           // console.log(`Spot ID for ${spotName}:`, spotId);  // Log the found spotId
            return spotId;  // Return the correct spotId
        } else {
            console.error(`Spot ID not found for ${spotName}`);
            return null;
        }
    } catch (error) {
        console.error("Failed to fetch spot ID or wave forecast:", error);
        return null;
    }
}

function filterTimesForDay(waveTimes, startHour = 5, endHour = 21) {
    return waveTimes.filter(time => {
        const hours = time.getHours();
        return hours >= startHour && hours <= endHour;
    });
}

function filterTimesAndHeightsForDay(waveTimes, waveHeights, startHour = 5, endHour = 21) {
    let filteredTimes = [];
    let filteredHeights = [];
    for (let i = 0; i < waveTimes.length; i++) {
        const hours = waveTimes[i].getHours();
        if (hours >= startHour && hours <= endHour) {
            filteredTimes.push(waveTimes[i]);
            filteredHeights.push(waveHeights[i]);
        }
    }
    return { filteredTimes, filteredHeights };
}


async function updateTopUpcomingDays(spotName) {
    // Ensure the surf spot name is displayed
    document.getElementById('surfSpotName').textContent = spotName;

    // Clear the loading message in the biggest-day elements
    document.getElementById('biggestDayLeft').textContent = '';
    document.getElementById('biggestDayCenter').textContent = '';
    document.getElementById('biggestDayRight').textContent = '';

    const daysWithWaveData = [];
    const date = new Date(); 
    const timezoneOffset = date.getTimezoneOffset() * 60000; // Adjust for timezone

    // Reuse the cached data, ensuring the dates are correct (use local time)
    for (const dateKey of Object.keys(cachedWaveData)) {
        const waveDataForDate = cachedWaveData[dateKey];
        const correctDate = new Date(new Date(dateKey).getTime() - timezoneOffset); // Fix date shift issue

        // Fetch sunrise and sunset times for this date
        const sunApiUrl = `https://api.sunrise-sunset.org/json?lat=34.0522&lng=-118.2437&date=${dateKey}&formatted=0`;
        let sunriseTime, sunsetTime;

        try {
            const sunResponse = await fetch(sunApiUrl);
            const sunData = await sunResponse.json();

            if (sunData.status === "OK") {
                sunriseTime = new Date(sunData.results.sunrise);
                sunsetTime = new Date(sunData.results.sunset);
            } else {
                console.error("Error fetching sun times for", dateKey);
                continue;
            }
        } catch (error) {
            console.error("Error fetching sun times:", error);
            continue;
        }

        if (waveDataForDate && waveDataForDate.length > 0) {
            // Filter wave data between sunrise and sunset
            const filteredWaveData = waveDataForDate.filter(item => item.time >= sunriseTime && item.time <= sunsetTime);

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

    // Sort by highest peak wave heights first
    daysWithWaveData.sort((a, b) => b.maxWaveHeight - a.maxWaveHeight);

    // Display the top 3 biggest upcoming days
    if (daysWithWaveData.length > 0) {
        const topDays = daysWithWaveData.slice(0, 3);

        // Add onclick to update the date input and get data
        const updateDateAndGraph = (date) => {
            const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            document.getElementById('dateInput').value = localDate;
            getData(); // Update data and graph based on the new date
        };

        // Update the buttons with the top upcoming days
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
    }
}


async function updateBiggestUpcomingLADays() {
    // Set loading state for LA biggest days
    document.getElementById('laDayLeft').textContent = '..loading..';
    document.getElementById('laDayCenter').textContent = '..loading..';
    document.getElementById('laDayRight').textContent = '..loading..';

    const spots = await fetch('/get_spot_id').then(res => res.json());
    console.log("Fetched spots:", spots); // Log fetched spots to check their existence
    const today = new Date();
    let laSpotsWaveData = [];

    for (const spot of spots) {
        const spotId = spot.spot_id;
        for (let i = 0; i < 17; i++) {
            const dateToFetch = new Date(today.getTime() + i * 86400000).toISOString().split('T')[0];
            if (!cachedWaveData[dateToFetch]) {
                await getSpotForecast(spotId, dateToFetch);  // Fetch wave data for each day
            }

            const waveDataForDate = cachedWaveData[dateToFetch];
            if (waveDataForDate && waveDataForDate.length > 0) {
                const maxWaveHeight = Math.max(...waveDataForDate.map(item => item.height));
                const minWaveHeight = Math.min(...waveDataForDate.map(item => item.height));

                laSpotsWaveData.push({
                    spotName: spot.spot_name,
                    date: new Date(dateToFetch),
                    waveRange: `${maxWaveHeight.toFixed(1)} - ${minWaveHeight.toFixed(1)} ft`,
                    maxWaveHeight
                });
            }
        }
    }

    // Sort LA spots by wave height, descending
    laSpotsWaveData.sort((a, b) => b.maxWaveHeight - a.maxWaveHeight);

    // Display the top 3 biggest upcoming LA-wide days
    const topUpcomingLADays = laSpotsWaveData.slice(0, 3);
    if (topUpcomingLADays.length > 0) {
        const updateSpotAndData = async (spotName, date) => {
            console.log(`Updating for spot: ${spotName} and date: ${date}`);

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
        document.getElementById('laDayLeft').textContent = 'No wave data available';
        document.getElementById('laDayCenter').textContent = '';
        document.getElementById('laDayRight').textContent = '';
    }
}


window.addEventListener('resize', function() {
    Plotly.Plots.resize(document.getElementById('waveHeightPlot'));
    Plotly.Plots.resize(document.getElementById('bestTimesPlot'));
    Plotly.Plots.resize(document.getElementById('windPlot'));
    Plotly.Plots.resize(document.getElementById('tidePlot'));
});