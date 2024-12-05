import math
from flask import Flask, jsonify, render_template, request
import requests
from datetime import datetime, timedelta
import pytz
import numpy as np
from scipy.interpolate import CubicSpline
import ndbc_api as ndbc
import pandas as pd
from flask_caching import Cache
import logging
from datetime import datetime, timedelta

from surf_spots_config import surf_spots_config





app = Flask(__name__)
# Set up caching for the Flask app
cache = Cache(config={'CACHE_TYPE': 'simple'})  # You can switch to Redis if needed
cache.init_app(app)



# Assuming this object mirrors your surf_spots_config.js
# Set up default station as "ICAC1"
default_station_id = "ICAC1"



#################### scraping wave data from noaa ############################################

from datetime import datetime
import pytz
import requests

def fetch_wave_data():
    try:
        now = datetime.now()
        year = now.year
        month = now.month
        day = now.day
        
        url = f"https://api.spitcast.com/api/buoy_ww3/12/{year}/{month}/{day}"
        print(f"Fetching wave data from: {url}")
        
        response = requests.get(url)
        response.raise_for_status()
        
        data = response.json()
        wave_data = []
        
        # Process forecast data
        for entry in data:
            # Get GMT date components
            date_gmt = entry.get('date_gmt', {})
            if date_gmt:
                # Convert GMT date components to datetime
                forecast_dt = datetime(
                    year=date_gmt.get('yy', 2024),
                    month=date_gmt.get('mm', 1),
                    day=date_gmt.get('dd', 1),
                    hour=date_gmt.get('hh', 0)
                )
                
                # Convert to Pacific time
                pacific_tz = pytz.timezone('America/Los_Angeles')
                local_dt = forecast_dt.replace(tzinfo=pytz.UTC).astimezone(pacific_tz)
                
                # Get all valid swells (numbered 0-5)
                swells = []
                for i in range(6):  # Check all possible swells
                    swell = entry.get(str(i), {})
                    if all(swell.get(key) is not None for key in ['dir', 'hs', 'tp']):
                        # Calculate inverse direction
                        direction = (swell['dir'] + 180) % 360 if swell['dir'] is not None else None
                        swells.append({
                            "direction": direction,
                            "height": swell['hs'],  # Wave height in meters
                            "period": swell['tp']   # Wave period in seconds
                        })
                
                # Get dominant swell data and invert its direction too
                dom_data = entry.get('dom', {})
                dom_direction = (dom_data.get('dir') + 180) % 360 if dom_data.get('dir') is not None else None
                
                wave_data.append({
                    "timestamp": local_dt.isoformat(),
                    "swells": swells,
                    "dominant": {
                        "direction": dom_direction,
                        "height": dom_data.get('hs'),  # Wave height in meters
                        "period": dom_data.get('tp')   # Wave period in seconds
                    },
                    "hst": entry.get('hst')  # Include significant wave height
                })
        
        # Sort by timestamp to ensure chronological order
        wave_data.sort(key=lambda x: x['timestamp'])
        
        print(f"Processed wave data (first 2 entries): {wave_data[:2]}")
        print(f"Total forecast entries: {len(wave_data)}")
        return wave_data
        
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while fetching the wave data: {e}")
        return []
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return []


@app.route('/wave_data', methods=['GET'])
def get_wave_data():
    wave_data = fetch_wave_data()
    return jsonify(wave_data)



#################### getting water temp with ndbc-api ############################################

# Fetch nearest station based on lat/lon using NdbcApi
def find_nearest_station(lat, lon):
    try:
        api = ndbc.NdbcApi()  # Step 2: Initialize the API
        nearest_station = api.nearest_station(lat=lat, lon=lon)
        station_id = nearest_station['station_id']
      #  print(f"Nearest station ID: {station_id}")
        return station_id
    except Exception as e:
      #  print(f"Error finding nearest station: {e}")
        return None
    

# Fetch standard meteorological data including WTMP (water temperature)
def fetch_stdmet_data(station_id, start_date, end_date):
    try:
        api = ndbc.NdbcApi()  # Step 2: Initialize the API
        df_stdmet = api.get_data(
            station_id=station_id, 
            mode='stdmet',  # Standard meteorological data
            start_time=start_date, 
            end_time=end_date, 
            as_df=True
        )
     #   print(f"Available measurements from {station_id}: {df_stdmet.info(verbose=True)}")
        return df_stdmet
    except Exception as e:
     #   print(f"Error fetching stdmet data: {e}")
        return None


# @cache.cached(timeout=600, key_prefix="water_temp")
def fetch_water_temp_by_station(station_id, start_date, end_date):
    print(f"Fetching water temperature for station: {station_id}, date: {start_date} to {end_date}")  # Print when 
    # Fetch standard meteorological data
    data = fetch_stdmet_data(station_id, start_date, end_date)
    if data is not None and 'WTMP' in data.columns and not data['WTMP'].empty:
        latest_temp_celsius = data['WTMP'].iloc[-1]  # Get the latest temperature in Celsius
        latest_temp_fahrenheit = (latest_temp_celsius * 9/5) + 32  # Convert to Fahrenheit
        return f"{latest_temp_fahrenheit:.2f}"
    else:
        return "Water temperature unavailable"
    
################################################################



@app.route('/get_water_temp', methods=['GET'])
def get_water_temp():
    spot = request.args.get('spot', 'default')
    config = surf_spots_config.get(spot, surf_spots_config['default'])

    station_id = config.get('station_id', default_station_id)

    # Get current date
    start_date = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    end_date = datetime.now().strftime('%Y-%m-%d')

    water_temp = fetch_water_temp_by_station(station_id, start_date, end_date)
    return jsonify({'water_temp': water_temp})


@app.route('/get_spot_id', methods=['GET'])
def get_spot_id():
    # Example static mapping of surf spots to their IDs
    # SPITCAST SPOT IDS
    spots = [
        {"spot_name": "Redondo Breakwater", "spot_id": 201},
        {"spot_name": "Hermosa Pier", "spot_id": 203},
        {"spot_name": "Manhattan Beach", "spot_id": 210},
        {"spot_name": "Manhattan Beach Pier South", "spot_id": 210},
        {"spot_name": "Manhattan Beach Pier North", "spot_id": 210},
        {"spot_name": "Bruces Beach", "spot_id": 210},
        {"spot_name": "El Porto", "spot_id": 402},
        {"spot_name": "Dockweiler", "spot_id": 402},
        {"spot_name": "Venice Pier South", "spot_id": 204},
        {"spot_name": "Venice Pier North", "spot_id": 204},
        {"spot_name": "Venice Bay", "spot_id": 204},
        {"spot_name": "Venice Breakwater", "spot_id": 204},
        {"spot_name": "Santa Monica Bay St", "spot_id": 725},
        {"spot_name": "Will Rogers", "spot_id": 724},
        {"spot_name": "Sunset", "spot_id": 387},
        {"spot_name": "Topanga", "spot_id": 388},
        {"spot_name": "Malibu First Point", "spot_id": 205},
        {"spot_name": "Malibu Second Point", "spot_id": 387},
        {"spot_name": "Malibu Third Point", "spot_id": 387},
        {"spot_name": "Zuma", "spot_id": 206},
        {"spot_name": "Leo Carrillo", "spot_id": 638},
        {"spot_name": "County Line", "spot_id": 207}
    ]
    return jsonify(spots)



@app.route('/get_wave_forecast', methods=['GET'])
def get_wave_forecast():
    spot_id = request.args.get('spot_id')
    date_str = request.args.get('date')

    if not spot_id or not date_str:
        return jsonify({'error': 'Missing spot ID or date'}), 400

    try:
        # Log the requested date
        print(f"[get_wave_forecast] Requested forecast date: {date_str}")
        
        # Log current date
        current_date = datetime.now()
        print(f"[get_wave_forecast] Current date: {current_date.strftime('%Y-%m-%d')}")

        # Use requested date for forecast
        forecast_date = datetime.strptime(date_str, '%Y-%m-%d')
        year, month, day = forecast_date.year, forecast_date.month, forecast_date.day

        # Fetch the forecast from Spitcast
        url = f"https://api.spitcast.com/api/spot_forecast/{spot_id}/{year}/{month}/{day}"
        print(f"[get_wave_forecast] Fetching forecast from: {url}")
        response = requests.get(url)

        if response.status_code != 200:
            print(f"[get_wave_forecast] API Error: {response.status_code}")
            return jsonify({'error': 'Failed to fetch forecast'}), 500

        forecast = response.json()
        print(f"[get_wave_forecast] Successfully fetched forecast for {date_str}")
        
        # Check if this is El Porto (spot_id 402)
        if spot_id == '402':  # El Porto's spot ID
            print(f"[get_wave_forecast] Processing El Porto (spot_id: {spot_id})")
            wave_data = fetch_wave_data()
            
            if wave_data:
                print(f"[get_wave_forecast] Wave data entries found: {len(wave_data)}")
                for wave in wave_data:
                    dom_direction = wave['dominant']['direction']
                    if dom_direction:
                        print(f"[get_wave_forecast] Found dominant direction: {dom_direction}°")
                        if 279 <= dom_direction <= 288:
                            print(f"[get_wave_forecast] Direction {dom_direction}° is in range (279-288)")
                            # Only increase heights between 2.5 and 4 feet
                            for entry in forecast:
                                if 1 <= entry['size_ft'] <= 3.2:
                                    entry['size_ft'] = entry['size_ft'] * 1.33
                                    print(f"[get_wave_forecast] Increased height from {entry['size_ft']/1.4:.1f}ft to {entry['size_ft']:.1f}ft")
                            print(f"[get_wave_forecast] Finished processing wave heights")
                            break
                        else:
                            print(f"[get_wave_forecast] Direction {dom_direction}° not in range (279-288)")
            else:
                print("[get_wave_forecast] No wave data available for swell direction check")

        return jsonify(forecast)
    except Exception as e:
        print(f"[get_wave_forecast] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# Fetch wind data
# @cache.memoize(timeout=600)
def fetch_wind_data(date, lat, lon):
    print(f"Fetching wind data for date: {date}")
    WIND_API_URL = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ["windspeed_10m", "winddirection_10m"],
        "timezone": "America/Los_Angeles",
        "start_date": date,
        "end_date": date,
    }
    response = requests.get(WIND_API_URL, params=params)
    data = response.json()

    #response = requests.get(WIND_API_URL, params=params)
    #data = response.json()
    print(f"[Wind API] Raw response data:", data)  # Let's see the raw data
    print(f"[Wind API] Units from API:", data['hourly_units'])  # Check wh
    
    print(f"[Wind API] Response received for {lat}, {lon}")
    print(f"[Wind API] Raw response data:", data)
    print(f"[Wind API] Available wind measurements:", data['hourly'].keys())

    
    la_tz = pytz.timezone('America/Los_Angeles')
    wind_times = [la_tz.localize(datetime.fromisoformat(time)) for time in data['hourly']['time']]
    wind_speeds = [max(0, float(speed)) for speed in data['hourly']['windspeed_10m']]
    wind_directions = [float(direction) for direction in data['hourly']['winddirection_10m']]
    
    filtered_times, filtered_speeds, filtered_directions = [], [], []
    
    for time, speed, direction in zip(wind_times, wind_speeds, wind_directions):
        if 4 <= time.hour <= 21:
            filtered_times.append(time)
            filtered_speeds.append(speed)
            filtered_directions.append(direction)

    #logger.debug(f"Wind data sample - Speed: {wind_speeds[0]} km/h, Direction: {wind_directions[0]}°")
    
    return filtered_times, filtered_speeds, filtered_directions




# Fetch tide data
# Fetch tide data
# @cache.cached(timeout=600, query_string=True, key_prefix="tide_data")
def fetch_tide_data(date):
    NOAA_API_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"
    station_id = "9410660"
    formatted_date = datetime.strptime(date, "%Y-%m-%d").strftime('%Y%m%d')
    params = {
        "product": "predictions",
        "datum": "MLLW",
        "station": station_id,
        "time_zone": "lst_ldt",
        "units": "english",
        "interval": "h",
        "format": "json",
        "begin_date": formatted_date,
        "end_date": formatted_date,
    }
    response = requests.get(NOAA_API_URL, params=params)
    data = response.json()

    la_tz = pytz.timezone('America/Los_Angeles')
    tide_times = [la_tz.localize(datetime.strptime(item['t'], '%Y-%m-%d %H:%M')) for item in data['predictions']]
    tide_heights = [float(item['v']) for item in data['predictions']]

    # Ensure that only the expected two values (times and heights) are returned
    return tide_times, tide_heights




# Fetch sunrise and sunset times
def fetch_sun_times(date):
    SUN_API_URL = "https://api.sunrise-sunset.org/json"
    params = {
        "lat": 34.0522,
        "lng": -118.2437,
        "formatted": 0,
        "date": date
    }
    response = requests.get(SUN_API_URL, params=params)
    data = response.json()
    la_tz = pytz.timezone('America/Los_Angeles')
    sunrise = datetime.fromisoformat(data['results']['sunrise']).astimezone(la_tz)
    sunset = datetime.fromisoformat(data['results']['sunset']).astimezone(la_tz)
    return sunrise, sunset

def interpolate_data(times, data, minute_points):
    times_numeric = [t.timestamp() for t in times]
    minute_points_numeric = [t.timestamp() for t in minute_points]
    cs = CubicSpline(times_numeric, data)
    interpolated_data = cs(minute_points_numeric)
    return np.maximum(interpolated_data, 0)  # Ensure no negative values for wind speeds



import logging
from datetime import timedelta

# Set up logging to output to a file
logging.basicConfig(
    filename="debug_best_times.log",
    level=logging.DEBUG,
    format="%(asctime)s - %(message)s"
)

def calculate_best_times(minute_points, interpolated_speeds, interpolated_directions, interpolated_heights, spot_config):
    best_times_to_go = []
    good_times_to_go = []
    best_start = None
    good_start = None
    tolerance_period = timedelta(minutes=5)

    logging.debug("Starting best times calculation with tolerance for temporary failures")
    logging.debug("Time\tTide Height\tWind Speed\tWind Direction\tis_moderate_tide\tis_high_tide\tis_offshore\tis_glassy")

    temporary_fail_start = None
    good_temporary_fail_start = None

    for i in range(len(minute_points)):
        time = minute_points[i]
        height = interpolated_heights[i]
        speed = interpolated_speeds[i]
        direction = interpolated_directions[i]

        # Best Times conditions (keeping existing logic)
        is_moderate_tide = spot_config['tide']['low'] <= height <= spot_config['tide']['moderate']
        is_offshore = spot_config['offshore_wind']['min'] <= direction <= spot_config['offshore_wind']['max']
        is_glassy = speed <= spot_config['wind']['glassy']

        # Good Times conditions (new logic)
        is_high_tide = spot_config['tide']['moderate'] < height <= spot_config['tide']['high']

        # Best Times Logic (unchanged from original)
        if is_moderate_tide and (is_offshore or is_glassy):
            temporary_fail_start = None
            if best_start is None:
                best_start = time
                logging.debug(f"Starting Best Time at {best_start.isoformat()}")
        else:
            if best_start and not temporary_fail_start:
                temporary_fail_start = time
                logging.debug(f"Temporary condition failure started at {time.isoformat()}")

            if best_start and temporary_fail_start and (time - temporary_fail_start > tolerance_period):
                best_times_to_go.append({
                    'start': best_start.isoformat(),
                    'end': time.isoformat(),
                    'color': 'green',
                    'thickness': 6
                })
                logging.debug(f"Ending Best Time: {best_start.isoformat()} to {time.isoformat()} - Tolerance exceeded")
                best_start = None
                temporary_fail_start = None

        # Good Times Logic (new)
        if is_high_tide and (is_offshore or is_glassy):
            if good_start is None:
                good_start = time
        else:
            if good_start:
                good_times_to_go.append({
                    'start': good_start.isoformat(),
                    'end': time.isoformat(),
                    'color': 'yellow',
                    'thickness': 4
                })
                good_start = None

    # Finalize the last best period if still active (unchanged)
    if best_start is not None:
        best_times_to_go.append({
            'start': best_start.isoformat(),
            'end': minute_points[-1].isoformat(),
            'color': 'green',
            'thickness': 6
        })
        logging.debug(f"Ending Best Time: {best_start.isoformat()} to {minute_points[-1].isoformat()}")

    # Finalize the last good period if still active
    if good_start is not None:
        good_times_to_go.append({
            'start': good_start.isoformat(),
            'end': minute_points[-1].isoformat(),
            'color': 'yellow',
            'thickness': 4
        })

    return best_times_to_go, good_times_to_go




@app.route('/')
def index():
    return render_template('index.html')


@app.route('/get_data', methods=['GET'])
def get_data():
    date = request.args.get('date', default=datetime.now().strftime('%Y-%m-%d'))
    spot = request.args.get('spot', default='Hermosa Pier')

    # Get the configuration for the selected spot, or fallback to default
    spot_config = surf_spots_config.get(spot, surf_spots_config['default'])
    spot_id = spot_config.get('spot_id')  # Get the spot ID from config

        # Get the configuration for the selected spot
    config = surf_spots_config.get(spot, surf_spots_config['default'])
    
    print(f"[get_data] Request for spot: {spot}, date: {date}")
    print(f"[get_data] Using config: {config}")

    lat = config['lat']
    lon = config['lon']
    
    print(f"[get_data] Fetching data for spot: {spot}")
    print(f"[get_data] Using coordinates: lat={lat}, lon={lon}")

     # Fetch lat/lon based on the surf spot
    # location = surf_spot_locations.get(spot, surf_spot_locations['Hermosa Pier'])

    location = surf_spots_config.get(spot, surf_spots_config['default'])

    # lat, lon = location['lat'], location['lon']

    # Fetch wind data using the specific lat/lon for the surf spot
    wind_times, wind_speeds, wind_directions = fetch_wind_data(date, lat, lon)

    # Find nearest station based on lat/lon
    station_id = find_nearest_station(lat, lon) or default_station_id

    # Get current date for fetching stdmet data
    start_date = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    end_date = datetime.now().strftime('%Y-%m-%d')

    # Fetch water temperature
    water_temp = fetch_water_temp_by_station(station_id, start_date, end_date)
  #  print("Water temperature received:", water_temp)

    # Determine what to wear based on water temperature
    try:
        water_temp_float = float(water_temp)
    except ValueError:
        water_temp_float = None

    
    if water_temp_float is not None:
        if water_temp_float > 74:
            wear = "Bathing Suit"
        elif 69 <= water_temp_float <= 74:
            wear = "Spring Suit"
        elif 60 <= water_temp_float <= 68:
            wear = "3/2 Wetsuit"
        elif 57 <= water_temp_float <= 59:
            wear = "5/4 Wetsuit & Booties"
        else:
            wear = "5/4 Wetsuit & Booties & Hood"
    else:
        wear = "Recommendation unavailable"

    # wind_times, wind_speeds, wind_directions = fetch_wind_data(date)
    tide_times, tide_heights = fetch_tide_data(date)
    sunrise, sunset = fetch_sun_times(date)

    # Interpolate data for minute-by-minute precision
    start_time = datetime.strptime(date, "%Y-%m-%d").replace(hour=4, minute=0, second=0, microsecond=0, tzinfo=pytz.timezone('America/Los_Angeles'))
    end_time = datetime.strptime(date, "%Y-%m-%d").replace(hour=21, minute=0, second=0, microsecond=0, tzinfo=pytz.timezone('America/Los_Angeles'))
    minute_points = [start_time + timedelta(minutes=i) for i in range((end_time - start_time).seconds // 60)]
    
    interpolated_speeds = interpolate_data(wind_times, wind_speeds, minute_points)
    interpolated_directions = interpolate_data(wind_times, wind_directions, minute_points)
    interpolated_heights = interpolate_data(tide_times, tide_heights, minute_points)

    

    # Calculate best and good times to go
    # best_times_to_go, good_times_to_go = calculate_best_times(minute_points, interpolated_speeds, interpolated_directions, interpolated_heights)
        # Pass spot_config to calculate_best_times
    best_times_to_go, good_times_to_go = calculate_best_times(
        minute_points, 
        interpolated_speeds, 
        interpolated_directions, 
        interpolated_heights,
        spot_config
    )

    wind_times = [time.isoformat() for time in wind_times]
    tide_times = [time.isoformat() for time in tide_times]
    minute_points = [time.isoformat() for time in minute_points]

    print(f"[DEBUG] Spot config for {spot}:", spot_config)
    print(f"[DEBUG] Offshore wind range: {spot_config.get('offshore_wind', {}).get('min')} to {spot_config.get('offshore_wind', {}).get('max')}")

    return jsonify({
        'wind': {
            'times': wind_times,
            'speeds': wind_speeds,
            'directions': wind_directions
        },
        'tide': {
            'times': tide_times,
            'heights': tide_heights
        },
        'sun': {
            'sunrise': sunrise.isoformat(),
            'sunset': sunset.isoformat()
        },
        'wear': wear,  # Clothing recommendation based on temperature
        'water_temp': water_temp,
        'best_times': best_times_to_go,
        'good_times': good_times_to_go,
        'minute_points': minute_points,
        'interpolated_speeds': interpolated_speeds.tolist(),
        'interpolated_heights': interpolated_heights.tolist(),
        'interpolated_directions': interpolated_directions.tolist(),
        'spot_config': spot_config  # Include spot configuration directly here
    })













import pytz
from datetime import datetime, timedelta
import requests

import os

# ... existing code ...

def get_best_surf_spots_by_intervals():
    results = {"today": [], "tomorrow": []}
    pacific_tz = pytz.timezone("America/Los_Angeles")
    current_time = datetime.now(pytz.UTC).astimezone(pacific_tz)
    print(f"Current Pacific time: {current_time}")

    BASE_URL = os.environ.get('BASE_URL', 'http://127.0.0.1:5000')
    
    for day_offset in [0, 1]:  # 0 for today, 1 for tomorrow
        date = (current_time + timedelta(days=day_offset)).strftime('%Y-%m-%d')
        day_name = "today" if day_offset == 0 else "tomorrow"
        
        print(f"Processing {day_name}: {date}")
        
        sunrise, sunset = fetch_sun_times(date)
        print(f"{day_name.capitalize()} sunrise at {sunrise}, sunset at {sunset}")
        
        interval_start = sunrise

        while interval_start < sunset:
            interval_end = interval_start + timedelta(hours=2)
            if interval_end > sunset:
                interval_end = sunset
            print(f"Checking interval {interval_start.strftime('%H:%M')} to {interval_end.strftime('%H:%M')}")

            spot_heights = []
            for spot_name, spot_data in surf_spots_config.items():
                if "spot_id" not in spot_data:
                    print(f"Skipping '{spot_name}' due to missing 'spot_id' in config")
                    continue
                
                spot_id = spot_data["spot_id"]
                wave_data_url = f"{BASE_URL}/get_wave_forecast?spot_id={spot_id}&date={date}"
                response = requests.get(wave_data_url)
                
                if response.status_code != 200:
                    print(f"Failed to fetch wave data for spot '{spot_name}'")
                    continue
                
                wave_data = response.json()

                interval_wave_heights = []
                for entry in wave_data:
                    try:
                        entry_time = pacific_tz.localize(datetime(
                            entry['date_local'].get('yy'),
                            entry['date_local'].get('mm'),
                            entry['date_local'].get('dd'),
                            entry['date_local'].get('hh', 0),
                            entry['date_local'].get('min', 0)
                        ))
                        
                        if interval_start <= entry_time < interval_end:
                            interval_wave_heights.append(entry['size_ft'])
                    except KeyError as e:
                        print(f"KeyError encountered in 'date_local': {entry['date_local']}")
                        continue

                if interval_wave_heights:
                    average_height = sum(interval_wave_heights) / len(interval_wave_heights)
                    spot_heights.append((spot_name, average_height))

            # Sort all spots by wave height
            sorted_spots = sorted(spot_heights, key=lambda x: x[1], reverse=True)

            # Add all spots to results for the day
            results[day_name].append({
                "interval": f"{interval_start.strftime('%H:%M')} - {interval_end.strftime('%H:%M')}",
                "spots": sorted_spots  # Include all spots instead of just top 2
            })

            interval_start = interval_end

    print("Completed processing all surf spots by intervals")
    return results



@app.route('/best_surf_spots')
def get_best_surf_spots():
    try:
        app.logger.info('Starting best surf spots calculation')
        
        # Get timezone info from headers
        tz_name = request.headers.get('X-Timezone-Name', 'America/Los_Angeles')
        client_tz = pytz.timezone(tz_name)
        
        # Get today's date in the client's timezone
        today = datetime.now(client_tz).date()
        tomorrow = today + timedelta(days=1)
        
        app.logger.info(f'Processing dates - Today: {today}, Tomorrow: {tomorrow}')
        
        # Get best spots with detailed error handling
        try:
            best_spots = get_best_surf_spots_by_intervals()
            app.logger.info('Successfully calculated best surf spots')
            return jsonify(best_spots)
        except Exception as e:
            app.logger.error(f'Error in get_best_surf_spots_by_intervals: {str(e)}', exc_info=True)
            raise
        
    except Exception as e:
        app.logger.error(f'Error in best_surf_spots route: {str(e)}', exc_info=True)
        return jsonify({
            'error': str(e),
            'message': 'Failed to calculate best surf spots',
            'timestamp': datetime.now().isoformat()
        }), 500







@app.route('/spot_best_times', methods=['GET'])
def get_spot_best_times():
    # Get spot name from query parameter, default to Hermosa Pier
    spot = request.args.get('spot', default='Hermosa Pier')
    date = request.args.get('date', default=datetime.now().strftime('%Y-%m-%d'))

    try:
        # Get spot configuration
        spot_config = surf_spots_config.get(spot, surf_spots_config['default'])
        lat = spot_config['lat']
        lon = spot_config['lon']

        # Fetch required data
        wind_times, wind_speeds, wind_directions = fetch_wind_data(date, lat, lon)
        tide_times, tide_heights = fetch_tide_data(date)
        sunrise, sunset = fetch_sun_times(date)

        # Create minute-by-minute points
        start_time = datetime.strptime(date, "%Y-%m-%d").replace(
            hour=4, minute=0, second=0, microsecond=0, 
            tzinfo=pytz.timezone('America/Los_Angeles')
        )
        end_time = datetime.strptime(date, "%Y-%m-%d").replace(
            hour=21, minute=0, second=0, microsecond=0, 
            tzinfo=pytz.timezone('America/Los_Angeles')
        )
        minute_points = [start_time + timedelta(minutes=i) 
                        for i in range((end_time - start_time).seconds // 60)]

        # Interpolate data
        interpolated_speeds = interpolate_data(wind_times, wind_speeds, minute_points)
        interpolated_directions = interpolate_data(wind_times, wind_directions, minute_points)
        interpolated_heights = interpolate_data(tide_times, tide_heights, minute_points)

        # Get wave forecast
        spot_id = spot_config.get('spot_id')
        wave_response = requests.get(f"{request.url_root}get_wave_forecast?spot_id={spot_id}&date={date}")
        wave_forecast = wave_response.json() if wave_response.ok else None

        # Calculate best times
        best_times, good_times = calculate_best_times(
            minute_points,
            interpolated_speeds,
            interpolated_directions,
            interpolated_heights,
            spot_config
        )

        # Format times in a more readable way
        formatted_best_times = []
        for time_period in best_times:
            start = datetime.fromisoformat(time_period['start']).strftime('%I:%M %p')
            end = datetime.fromisoformat(time_period['end']).strftime('%I:%M %p')
            formatted_best_times.append(f"{start} to {end}")

        formatted_good_times = []
        for time_period in good_times:
            start = datetime.fromisoformat(time_period['start']).strftime('%I:%M %p')
            end = datetime.fromisoformat(time_period['end']).strftime('%I:%M %p')
            formatted_good_times.append(f"{start} to {end}")

        return jsonify({
            'spot': spot,
            'date': date,
            'best_times': formatted_best_times,
            'good_times': formatted_good_times,
            'sunrise': sunrise.strftime('%I:%M %p'),
            'sunset': sunset.strftime('%I:%M %p'),
            'conditions': {
                'tide_range': spot_config.get('tide', {}),
                'wind_direction': spot_config.get('offshore_wind', {}),
                'wind_speed': spot_config.get('wind', {})
            }
        })

    except Exception as e:
        return jsonify({
            'error': f"Error processing spot {spot}: {str(e)}"
        }), 500














# Guard against double execution
if __name__ == "__main__":
    app.run(debug=True)



