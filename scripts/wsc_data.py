import pandas as pd
import json

# Load the CSV, skip the metadata rows
file_path = '08MG012_HGD_20250704T0328.csv'
df = pd.read_csv(file_path, skiprows=9)  # Skip first 9 rows

# Remove any empty rows
df = df.dropna(subset=['Date (PST)', 'Value (m)'])

# Prepare the JSON data array
data = []
for _, row in df.iterrows():
    # Format: 2025-02-28 or similar
    date_iso = row['Date (PST)'].split()[0].replace('/', '-')
    parts = date_iso.split('-')
    year = parts[0]
    month = parts[1].zfill(2)
    day = parts[2].zfill(2)
    json_date = f"{day}.{month}.{year}"
    data.append({
        "date": json_date,
        "waterLevel": f"{row['Value (m)']:.2f}",
        "liveStorage": "",
        "storagePercentage": "",
        "inflow": "",
        "powerHouseDischarge": "",
        "spillwayRelease": "",
        "totalOutflow": "",
        "rainfall": ""
    })

# Write to JSON file
with open('harisson_formatted.json', 'w') as f:
    json.dump(data, f, indent=2)
print("Saved formatted data to coquitlam_formatted.json")
