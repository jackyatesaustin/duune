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



app = Flask(__name__)
# Set up caching for the Flask app
cache = Cache(config={'CACHE_TYPE': 'simple'})  # You can switch to Redis if needed
cache.init_app(app)



# Assuming this object mirrors your surf_spots_config.js
# Set up default station as "ICAC1"
default_station_id = "ICAC1"


surf_spot_locations = {
    "Redondo Breakwater": {"lat": 33.863, "lon": -118.400, "station_id": default_station_id},
    "Hermosa Pier": {"lat": 33.862, "lon": -118.399, "station_id": default_station_id},
    "default": {"lat": 34.0522, "lon": -118.2437, "station_id": default_station_id}
}

surf_spots_config = {
    "Redondo Breakwater": {
        "lat": 33.863,
        "lon": -118.400,
        "station_id": "ICAC1",  # Closest station in Santa Monica
        "spot_id": 201,  # Spitcast ID
        "tide": {
            "low": 2,
            "moderate": 4.5,
            "high": 5.1,
            "veryHigh": 6
        },
        "wind": {
            "glassy": 5,
            "mild": 7,
            "bad": 10
        }
    },
    "Hermosa Pier": {
        "lat": 33.862,
        "lon": -118.399,
        "station_id": "ICAC1",  # Closest station in Santa Monica
        "tide": {
            "low": 2,
            "moderate": 4.5,
            "high": 5.1,
            "veryHigh": 6
        },
        "wind": {
            "glassy": 5,
            "mild": 7,
            "bad": 10
        }
    },
    "Manhattan Beach": {
        "lat": 33.884,
        "lon": -118.410,
        "station_id": "ICAC1",  # Closest station in Santa Monica
        "tide": {
            "low": 2,
            "moderate": 4.5,
            "high": 5.1,
            "veryHigh": 6
        },
        "wind": {
            "glassy": 5,
            "mild": 7,
            "bad": 10
        }
    },
    "El Porto": {
        "lat": 33.900,
        "lon": -118.420,
        "station_id": "ICAC1",  # Closest station in Santa Monica
        "tide": {
            "low": 2,
            "moderate": 4.5,
            "high": 5.1,
            "veryHigh": 6
        },
        "wind": {
            "glassy": 5,
            "mild": 7,
            "bad": 10
        }
    },
    "Dockweiler": {
        "lat": 33.931,
        "lon": -118.442,
        "station_id": "ICAC1",  # Closest station in Santa Monica
        "tide": {
            "low": 2,
            "moderate": 4.5,
            "high": 5.1,
            "veryHigh": 6
        },
        "wind": {
            "glassy": 5,
            "mild": 7,
            "bad": 10
        }
    },
    "Venice Pier South": {
        "lat": 33.976,
        "lon": -118.467,
        "station_id": "ICAC1",  # Closest station in Santa Monica
        "tide": {
            "low": 2,
            "moderate": 4.5,
            "high": 5.1,
            "veryHigh": 6
        },
        "wind": {
            "glassy": 5,
            "mild": 7,
            "bad": 10
        }
    },
    "County Line": {
        "lat": 34.049,
        "lon": -118.963,
        "station_id": "NTBC1",  # Closest station for County Line and Leo Carrillo
        "tide": {
            "low": 1.5,
            "moderate": 4.5,
            "high": 5.5,
            "veryHigh": 6.5
        },
        "wind": {
            "glassy": 4,
            "mild": 6,
            "bad": 8
        }
    },
    "Leo Carrillo": {
        "lat": 34.046,
        "lon": -118.939,
        "station_id": "NTBC1",  # Closest station for County Line and Leo Carrillo
        "tide": {
            "low": 1.5,
            "moderate": 4.5,
            "high": 5.5,
            "veryHigh": 6.5
        },
        "wind": {
            "glassy": 4,
            "mild": 6,
            "bad": 8
        }
    },
    "Zuma": {
        "lat": 34.010,
        "lon": -118.820,
        "station_id": "NTBC1",  # Closest station for Zuma
        "spot_id": 206,
        "tide": {
            "low": 1.5,
            "moderate": 4.5,
            "high": 5.5,
            "veryHigh": 6.5
        },
        "wind": {
            "glassy": 4,
            "mild": 6,
            "bad": 8
        }
    },
    "default": {
        "lat": 34.0522,
        "lon": -118.2437,
        "station_id": "ICAC1",  # Default station in Santa Monica
        "tide": {
            "low": 1.5,
            "moderate": 4,
            "high": 5,
            "veryHigh": 6
        },
        "wind": {
            "glassy": 4,
            "mild": 6,
            "bad": 8
        }
    }
}


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


@cache.cached(timeout=600, key_prefix="water_temp")
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
        {"spot_name": "County Line", "spot_id": 593}
    ]
    return jsonify(spots)



@app.route('/get_wave_forecast', methods=['GET'])
def get_wave_forecast():
    spot_id = request.args.get('spot_id')
    date_str = request.args.get('date')

    if not spot_id or not date_str:
        return jsonify({'error': 'Missing spot ID or date'}), 400

    try:
        date = datetime.strptime(date_str, '%Y-%m-%d')  # Ensure correct date format
        year, month, day = date.year, date.month, date.day

        # Fetch the forecast from Spitcast
        url = f"https://api.spitcast.com/api/spot_forecast/{spot_id}/{year}/{month}/{day}"
      #  print(f"Spitcast API URL: {url}")
        response = requests.get(url)

        if response.status_code != 200:
            return jsonify({'error': 'Failed to fetch forecast'}), 500

        forecast = response.json()
        return jsonify(forecast)
    except Exception as e:
     #   print(f"Error in get_wave_forecast: {e}")
        return jsonify({'error': str(e)}), 500


# Fetch wind data
@cache.cached(timeout=600, key_prefix=lambda: f"wind_data_{request.args.get('date', '')}")
def fetch_wind_data(date):
    print(f"Fetching wind data for date: {date}")
    WIND_API_URL = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": 34.0522,
        "longitude": -118.2437,
        "hourly": ["windspeed_10m", "winddirection_10m"],
        "timezone": "America/Los_Angeles",
        "start_date": date,
        "end_date": date,
    }
    response = requests.get(WIND_API_URL, params=params)
    data = response.json()
    
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
    
    return filtered_times, filtered_speeds, filtered_directions




# Fetch tide data
# Fetch tide data
@cache.cached(timeout=600, query_string=True, key_prefix="tide_data")
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

def calculate_best_times(minute_points, interpolated_speeds, interpolated_directions, interpolated_heights):
    best_times_to_go = []
    good_times_to_go = []
    best_start = None
    good_start = None

    for i in range(1, len(minute_points)):
        is_glassy_or_offshore = (interpolated_speeds[i] <= 5) or (270 <= interpolated_directions[i] <= 360) or (0 <= interpolated_directions[i] <= 90)
        is_moderate_tide = 2 <= interpolated_heights[i] <= 4.5

        if is_moderate_tide and is_glassy_or_offshore:
            if best_start is None:
                best_start = i
        elif best_start is not None:
            start_time = minute_points[best_start].isoformat()
            end_time = minute_points[i - 1].isoformat()
            best_times_to_go.append({'start': start_time, 'end': end_time, 'color': 'green', 'thickness': 6})
            best_start = None

        is_good_tide = not (interpolated_heights[i] < 2 or interpolated_heights[i] > 5.1)
        is_not_bad_wind = interpolated_speeds[i] <= 10

        if is_good_tide and is_not_bad_wind and best_start is None:
            if good_start is None:
                good_start = i
        elif good_start is not None:
            start_time = minute_points[good_start].isoformat()
            end_time = minute_points[i - 1].isoformat()
            good_times_to_go.append({'start': start_time, 'end': end_time, 'color': 'yellow', 'thickness': 3})
            good_start = None

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

     # Fetch lat/lon based on the surf spot
    location = surf_spot_locations.get(spot, surf_spot_locations['Hermosa Pier'])

    lat, lon = location['lat'], location['lon']

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

    wind_times, wind_speeds, wind_directions = fetch_wind_data(date)
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
    best_times_to_go, good_times_to_go = calculate_best_times(minute_points, interpolated_speeds, interpolated_directions, interpolated_heights)

    wind_times = [time.isoformat() for time in wind_times]
    tide_times = [time.isoformat() for time in tide_times]
    minute_points = [time.isoformat() for time in minute_points]

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
        'interpolated_heights': interpolated_heights.tolist()
    })

if __name__ == "__main__":
    app.run(debug=True)