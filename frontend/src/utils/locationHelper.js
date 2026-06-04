import axios from 'axios';

const martCoords = [11.1085, 77.3411]; // DailyMart Central Hub in Tiruppur

export const getDistance = (lat1, lon1, lat2, lon2) => {
  if (window.L) {
    return window.L.latLng(lat1, lon1).distanceTo(window.L.latLng(lat2, lon2)) / 1000;
  }
  // Fallback Haversine formula if Leaflet is not initialized
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const reverseGeocodeAndValidate = async (lat, lng) => {
  const dist = getDistance(martCoords[0], martCoords[1], lat, lng);

  if (dist > 20) {
    return {
      valid: false,
      error: "⚠️ Delivery Boundary Restriction: The selected location is more than 20 km away from the store. DailyMart only delivers within a 20 km radius.",
      distance: dist.toFixed(2)
    };
  }

  try {
    const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    if (res.data) {
      const addr = res.data.address || {};
      const county = addr.county || addr.state_district || addr.district || addr.city || addr.town || '';
      const displayName = res.data.display_name || '';
      
      const isTiruppur = county.toLowerCase().includes('tiruppur') || displayName.toLowerCase().includes('tiruppur');
      
      if (!isTiruppur) {
        return {
          valid: false,
          error: "⚠️ Delivery Boundary Restriction: The selected location lies in a neighboring district. DailyMart only delivers within Tiruppur District bounds.",
          distance: dist.toFixed(2)
        };
      }

      const area = addr.suburb || addr.neighbourhood || addr.village || addr.city_district || addr.town || addr.hamlet || addr.road || '';
      const finalArea = area || (res.data.display_name ? res.data.display_name.split(',')[0].trim() : '');
      const postcode = addr.postcode || '';
      const road = addr.road || '';
      const suburb = addr.suburb || addr.neighbourhood || addr.village || addr.city_district || addr.town || addr.hamlet || '';
      
      let streetAndArea = '';
      if (road && suburb) {
        streetAndArea = `${road}, ${suburb}`;
      } else {
        streetAndArea = road || suburb || finalArea || '';
      }

      const displayAddr = finalArea ? `${finalArea}, Tiruppur` : 'Tiruppur';

      return {
        valid: true,
        lat,
        lng,
        address: displayAddr,
        area: finalArea,
        distance: dist.toFixed(2),
        postcode,
        streetAndArea
      };
    }
  } catch (err) {
    console.error('Reverse Geocode Request Failed:', err);
  }

  return {
    valid: true,
    lat,
    lng,
    address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    area: '',
    distance: dist.toFixed(2),
    postcode: '',
    streetAndArea: ''
  };
};
