import requests
from datetime import datetime

def fetch_wave_data():
    # Get current date
    now = datetime.now()
    year = now.year
    month = now.month
    day = now.day

    # Format URL with the current date
    url = f"https://api.spitcast.com/api/buoy_ww3/12/{year}/{month}/{day}"
    
    try:
        # Make API request
        response = requests.get(url)
        response.raise_for_status()  # Check for HTTP errors
        
        # Parse JSON response
        data = response.json()

        # Print or process the data as needed
        print("Wave Data for Current Date and the Next 13 Days:")
        for day_data in data:
            timestamp = day_data.get("timestamp")
            dom = day_data.get("dom", {})
            direction = dom.get("dir")
            wave_height = dom.get("hs")
            peak_period = dom.get("tp")
            
            # Print formatted data
            print(f"Timestamp: {timestamp}, Direction: {direction}°, Wave Height: {wave_height}m, Peak Period: {peak_period}s")
    
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while fetching the data: {e}")

if __name__ == "__main__":
    fetch_wave_data()
