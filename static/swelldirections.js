// Function to get the nearest swell data to a target time
function getNearestSwellData(waveData, targetTime) {
    if (!waveData || waveData.length === 0) return null;

    console.log('[swelldirections] Target Time:', new Date(targetTime).toLocaleString());

    // Find the entry with the closest timestamp
    const nearestData = waveData.reduce((nearest, current) => {
        const currentTime = new Date(current.timestamp);
        const nearestTime = new Date(nearest.timestamp);
        const targetDateTime = new Date(targetTime);

        return Math.abs(currentTime - targetDateTime) < Math.abs(nearestTime - targetDateTime) 
            ? current 
            : nearest;
    });

    console.log('[swelldirections] Nearest Data Timestamp:', new Date(nearestData.timestamp).toLocaleString());
    return nearestData;
}




// Helper function to convert degrees to cardinal direction
function degreesToCardinal(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(((degrees % 360) / 22.5));
    return directions[index % 16];
}

// Helper function to classify swell period
function classifyPeriod(period) {
    if (period >= 12) return 'Long Period';
    if (period >= 8) return 'Medium Period';
    return 'Short Period';
}

// Function to format swell direction data more concisely
function formatSwellData(swellData) {
    if (!swellData || !swellData.swells || swellData.swells.length === 0) {
        return 'No data available';
    }

    console.log('[swelldirections] Formatting Swell Data:', swellData);
    
    // Calculate total wave height
    const totalHeight = swellData.swells.reduce((sum, swell) => sum + swell.height, 0);
    
    return swellData.swells.map(swell => {
        const cardinal = degreesToCardinal(swell.direction);
        const periodType = classifyPeriod(swell.period);
        const percentage = ((swell.height / totalHeight) * 100).toFixed(0);
        return `${cardinal} (${swell.direction}°) ${periodType} (${swell.period}s) ${percentage}%`;
    }).join('\n');
}


// Main function to get swell directions at specific times
async function getDailySwellDirections(date) {
    try {
        console.log('[swelldirections] Input Date:', date.toLocaleString());
        
        const response = await fetch('/wave_data');
        if (!response.ok) throw new Error('Failed to fetch wave data');
        const waveData = await response.json();
        
        console.log('[swelldirections] Wave Data First Entry:', new Date(waveData[0].timestamp).toLocaleString());
        console.log('[swelldirections] Wave Data Last Entry:', new Date(waveData[waveData.length-1].timestamp).toLocaleString());

        // Create target times for 8am, 12pm, and 4pm in local time
        const targetTimes = [8, 12, 16].map(hour => {
            const targetDate = new Date(date);
            targetDate.setHours(hour, 0, 0, 0);
            console.log(`[swelldirections] Target Time for ${hour}:00:`, targetDate.toLocaleString());
            return targetDate;
        });

        // Get swell data for each target time
        const swellDirections = targetTimes.map(targetTime => {
            const nearestData = getNearestSwellData(waveData, targetTime);
            return {
                time: targetTime.toLocaleTimeString([], { hour: 'numeric', hour12: true }),
                swells: formatSwellData(nearestData)
            };
        });

        console.log('[swelldirections] Final Swell Directions:', swellDirections);
        return swellDirections;
    } catch (error) {
        console.error('[swelldirections] Error fetching swell directions:', error);
        return null;
    }
}

// Function to update the swell direction display
async function updateSwellDirections(date = new Date()) {
    try {
        console.log('[swelldirections] Raw input date:', date);
        
        // Create date object and adjust for timezone
        const [year, month, day] = date.split('-').map(Number);
        const workingDate = new Date(year, month - 1, day);  // Use local time constructor
        
        // Force the date to be interpreted as Pacific Time (UTC-8)
        workingDate.setHours(8);  // Set to 8 AM Pacific to ensure correct date
        
        console.log('[swelldirections] Parsed working date:', workingDate.toLocaleString());

        const swellDirections = await getDailySwellDirections(workingDate);
        if (!swellDirections) return;

        // Update each time period's display without the prefix labels
        document.getElementById('morningSwells').textContent = swellDirections[0].swells;
        document.getElementById('lunchSwells').textContent = swellDirections[1].swells;
        document.getElementById('afternoonSwells').textContent = swellDirections[2].swells;

    } catch (error) {
        console.error('[swelldirections] Error updating swell directions:', error);
        document.getElementById('morningSwells').textContent = 'Data unavailable';
        document.getElementById('lunchSwells').textContent = 'Data unavailable';
        document.getElementById('afternoonSwells').textContent = 'Data unavailable';
    }
}

// Export functions if using modules
export { getDailySwellDirections, updateSwellDirections };