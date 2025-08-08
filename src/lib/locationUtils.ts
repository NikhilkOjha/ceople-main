interface LocationData {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

export const getUserLocation = async (): Promise<LocationData> => {
  try {
    // Try multiple free IP geolocation services
    const services = [
      'https://ipapi.co/json/',
      'https://ipapi.com/ip_api.php?ip=',
      'https://api.ipgeolocation.io/ipgeo?apiKey=free'
    ];

    for (const service of services) {
      try {
        const response = await fetch(service, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          
          // Handle different response formats
          if (data.country_name || data.country) {
            return {
              country: data.country_name || data.country,
              region: data.region_name || data.region,
              city: data.city,
              latitude: data.latitude,
              longitude: data.longitude,
              timezone: data.timezone?.name || data.timezone
            };
          }
        }
      } catch (error) {
        console.warn(`Failed to get location from ${service}:`, error);
        continue;
      }
    }

    // Fallback: return basic location data
    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown'
    };
  } catch (error) {
    console.error('Error getting user location:', error);
    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown'
    };
  }
};

export const getClientIP = (): string => {
  // This is a simplified version - in production, you'd get this from your server
  // For now, we'll use a placeholder
  return '127.0.0.1';
};

export const saveUserLocation = async (userId: string): Promise<void> => {
  try {
    const locationData = await getUserLocation();
    const ipAddress = getClientIP();

    const response = await fetch(`https://ceople-main.onrender.com/api/user-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        ipAddress,
        locationData
      }),
    });

    if (!response.ok) {
      console.error('Failed to save user location');
    }
  } catch (error) {
    console.error('Error saving user location:', error);
  }
};
